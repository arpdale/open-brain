# Slack Capture (`#hey-otis`)

Personal Slack-channel capture surface for Open Brain. Type in `#hey-otis` (in the `go-blossom` workspace) → message gets embedded and stored in your `thoughts` table with metadata, then the bot replies in-thread confirming what was captured.

> Mode 2 (personal-only). Not upstreamed.

## What's in this folder

- `README.md` — this file
- `manifest.yml` — Slack app manifest (reproducibility; create app from this in Slack admin UI)

The actual function source lives in `supabase/functions/ingest-thought/` and the schema migration in `supabase/migrations/20260428120000_add_idempotency_key.sql`. Both are required Supabase paths and can't move.

## How it works

1. You post a message in `#hey-otis`.
2. Slack POSTs the event to the `ingest-thought` Edge Function.
3. Function verifies the Slack signature (HMAC-SHA256 with the signing secret).
4. Function filters: only your user ID, only the capture channel, not bot messages, not edits.
5. Function does a **claim-first idempotency insert** with `idempotency_key = "slack:<channel>:<ts>"`. Slack's <3s timeout + retry behavior is handled by the UNIQUE constraint — duplicate retries silently no-op.
6. Function returns 200 to Slack within ~100ms. Slack stops retrying.
7. In the background (`EdgeRuntime.waitUntil`), the function:
   - Embeds the text via OpenRouter `text-embedding-3-small`
   - Extracts metadata via OpenRouter `gpt-4o-mini` (`type`, `category`, `people`, `action_items`, `dates_mentioned` — no `topics`)
   - Updates the row with embedding + full metadata
   - Posts a threaded confirmation reply to your message

## Architecture decisions

See `.planning/capture-input/slack/{DISCOVERY,APPROACH,PLAN}.md` for the full audit trail. Short version:
- **Single channel**, not multi-channel project routing (deferred to v1.5)
- **LLM-extract** for richer metadata + nicer confirmation reply
- **Claim-first idempotency** to handle Slack's retry behavior (race-condition-free)
- **Slack signature verification** as the auth mechanism (no shared brain-key)
- **`EdgeRuntime.waitUntil`** for proper serverless background processing
- **All metadata stored in `metadata` jsonb**, not new table columns (consistent with our existing schema philosophy)

## Setup walkthrough

### 1. Create the Slack app

1. Go to <https://api.slack.com/apps> → **Create New App** → **From an app manifest**.
2. Pick the `go-blossom` workspace.
3. Paste the contents of `manifest.yml`. Click Next, then Create.
4. After creation, click **Install to Workspace** → Allow.

### 2. Capture credentials

In the Slack app admin UI, copy these four values (you'll need them for Phase 3):

| Where to find it | Value name |
|---|---|
| OAuth & Permissions → **Bot User OAuth Token** | starts with `xoxb-…` |
| Basic Information → App Credentials → **Signing Secret** | (random hex string) |
| In Slack: right-click `#hey-otis` → View channel details → bottom: Channel ID | starts with `C…` |
| Already known: maintainer's user ID | `U0448BPN16F` |

### 3. Set Supabase secrets

```bash
supabase secrets set \
  SLACK_BOT_TOKEN=xoxb-... \
  SLACK_SIGNING_SECRET=... \
  SLACK_CAPTURE_CHANNEL=C... \
  SLACK_CAPTURE_USER_ID=U0448BPN16F
```

`OPENROUTER_API_KEY` is already set (used by `open-brain-mcp`).

### 4. Apply the migration

```bash
supabase db push
```

Or apply via Supabase MCP. Adds `idempotency_key` column + partial unique index. Reversible.

### 5. Deploy the Edge Function

```bash
supabase functions deploy ingest-thought --no-verify-jwt
```

`--no-verify-jwt` because Slack doesn't send Supabase JWTs; auth comes from Slack signature verification inside the function. The function URL is then:

```
https://<project-ref>.supabase.co/functions/v1/ingest-thought
```

### 6. Configure Slack Event Subscription

1. In Slack app config → **Event Subscriptions** → toggle Enable.
2. Request URL: paste the function URL from step 5.
3. Slack POSTs a `url_verification` challenge. The function verifies the signature and responds with the challenge. Slack shows ✅ Verified.
4. Subscribe to bot events: `message.channels` (and `message.groups` if `#hey-otis` is private).
5. Save changes. Slack may prompt to reinstall the app — accept.

### 7. Invite the bot to the channel

In Slack, in `#hey-otis`:

```
/invite @hey-otis
```

### 8. Smoke test

Post a test message in `#hey-otis`:

```
test capture from hey-otis
```

You should see a threaded reply within ~5 seconds: `✓ Captured as *note* …`. The thought should appear in the dashboard at `dsr-open-brain.vercel.app` under source `slack`.

## Troubleshooting

**Slack URL verification fails** (Slack admin UI shows red X next to request URL):
- Most common: signing secret typo. Re-copy from Slack admin and `supabase secrets set SLACK_SIGNING_SECRET=...`.
- Or: function not deployed yet. `supabase functions list` should show ACTIVE.

**Messages in channel but no capture happening**:
- `supabase functions logs ingest-thought` should show received events.
- If logs are silent, Event Subscription URL may be wrong or unverified.
- If logs show "invalid signature": signing secret mismatch.
- If logs show events but filter rejections: check `SLACK_CAPTURE_CHANNEL` and `SLACK_CAPTURE_USER_ID` match your actual values.

**Duplicate rows for the same message**:
- Should be impossible due to UNIQUE constraint on `idempotency_key`.
- If you see them: check `select id, content, idempotency_key, created_at from thoughts where idempotency_key = 'slack:<channel>:<ts>';`.

**Threaded confirmation never arrives but row exists**:
- Background processing failed. Check `supabase functions logs ingest-thought`.
- Common: OpenRouter rate limit, malformed LLM response. Row will have `content` but no `embedding`/extracted metadata. Re-process by deleting the row and re-posting, or by manually updating.

**Bot replies on its own messages (loop)**:
- Should be impossible due to `event.bot_id` filter.
- If it happens: bot OAuth scope changed or filter regressed; check the function source.

## Rollback

In reverse order:

1. Slack: app config → Event Subscriptions → toggle off (or just remove the request URL).
2. `supabase functions delete ingest-thought`
3. `supabase secrets unset SLACK_BOT_TOKEN SLACK_SIGNING_SECRET SLACK_CAPTURE_CHANNEL SLACK_CAPTURE_USER_ID`
4. ```sql
   drop index if exists thoughts_idempotency_key_uniq;
   alter table public.thoughts drop column if exists idempotency_key;
   ```
5. `git revert` the feature branch / PR.
6. (Optional) Delete the Slack app from <https://api.slack.com/apps>.

End state: identical to before — 130 thoughts (plus any net-new captures from Slack), no idempotency_key column, no ingest-thought function, no Slack secrets. Slack channel and app remain harmlessly until you delete them manually.

## Cost ceiling

At ~20 captures/day (Daniel's reported usage): ~$0.10–0.30/month total OpenRouter cost (embeddings + LLM extraction). Single-user; no rate limit needed at v1.

## Known limitations (v1.5+ backlog)

See `.planning/capture-input/slack/PLAN.md` for the full deferred list. Highlights:
- Edits and deletes (`message_changed`, `message_deleted`) ignored — re-edit a captured message in Slack and the row stays as originally captured.
- Attachments (files, images, link unfurls) not captured.
- Multi-channel project routing not implemented.
- Slash command `/brain <text>` not implemented.
- Voice memo capture not implemented (would be a different surface entirely).

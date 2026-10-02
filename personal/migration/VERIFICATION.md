# Migration preparation results — 2026-10-02

Status: candidate implemented, deployed and verified; production cutover pending.
Supabase is still authoritative. No source write fence is installed, no existing
client has been switched, and the source project/functions/data remain available.

## Deployed candidates

- Worker: `https://open-brain-neon.arpdale.workers.dev`
- Dashboard preview: `https://open-brain-mrjl809bi-arpdale.vercel.app`
- Vercel deployment: `dpl_23EThw7ChERVJKHNuS6Hiw27iPPR`
- Neon: `silent-wave-89224791`, branch `br-late-cloud-b4nyht2e`
- Queues: `open-brain-enrichment` and `open-brain-enrichment-dlq`

After testing, the Worker has `WRITES_ENABLED=false` and
`SLACK_REPLIES_ENABLED=false`. The target database write fence is installed on
thoughts and jobs to block invocations retaining older environment flags. There
are no remaining test records or jobs. Reads remain available with existing auth.
The preview is protected by both Vercel deployment protection and application
login. Temporary share URLs and all credentials remain private.

## Verification evidence

| Verification | Result |
| --- | --- |
| Full-row/embedding hashes after cleanup | Exact match to 762-row source snapshot |
| Vector dimensions | 762 of 762 are 1536-dimensional |
| SQL similarity parity | 15 cases, 129 results, matching IDs/ranks/rounded scores |
| Actual MCP SDK clients | 14 checks passed: source tool compatibility, all four tools, persistence, edit/search/delete/restore, missing/invalid auth |
| Deployed signed Slack ingestion + queue | 10 checks passed: signatures/replay, channel/user/bot rejection, duplicate delivery, enrichment, failed-job recovery, cleanup |
| Migrated Slack duplicates | 6 checks passed: retained vector/metadata unchanged with no enrichment, missing-vector recovery on original ID, repeated duplicate stability |
| Deployed importer | 7 checks passed: auth, dimensions, insert/lookup/vector match/update, exact supplied-vector preservation, cleanup |
| Actual local importer transports | Both ChatGPT and Notion Python adapters performed authenticated lookups successfully |
| Browser against deployed dashboard | 11 checks passed: login failures/success, secure cookie, protected routes, pagination, source/project filters, detail/neighbors, search, Ask, edit + reload, delete + Undo, logout/malformed cookie |
| Database fence rehearsal | Runtime writes rejected on both tables, owner refresh permitted; zero-row statements used |
| Local backend | Typecheck and 17 tests passed; production dependency audit found 0 vulnerabilities |
| Local dashboard | Build/typecheck/lint and 2 auth tests passed |
| Secret scan | No retained secrets/connection URLs found in changed Git files |

The dashboard browser test initially reloaded while Save was still pending;
the test now waits for editing mode to close. The corrected complete flow passed.
An initial request immediately after Worker creation needed a repeat; the full
MCP suite subsequently passed. Cloudflare analytics for the verification window
reported 79 successful invocations and four client disconnects, zero execution
errors. Aggregate CPU p50 was about 3.5 ms and p99 about 41 ms (mixed HTTP/queue
work); this small sample is not a long-term Free-tier capacity guarantee.

The final source recheck still found 31,730,835 database bytes, 762 thoughts,
zero missing vectors, zero Auth users and zero Storage objects, and the same
four original deployed functions. `runtime-waituntil-check` remains a 410
tombstone. No source data or original function was removed or changed.

## Remaining cutover work

Follow the fenced final-sync sequence in README.md, then switch the hosted Claude
connector, both local Claude Code entries, Slack Event Subscriptions, Vercel
production and local importer environments. Production still depends on Supabase
until those steps are performed. The new Worker source and deployed preview have
no Supabase runtime dependency; obsolete Supabase variables were removed from
Preview targets only. Historical/reference code and rollback source remain.

Hosted Claude's connector UI has no URL-edit control; it may need recreation
with the same key and tool approvals. Other clients not visible in accessible
local settings/account UI cannot be conclusively ruled out; monitor old endpoint
logs during cutover. Do not print query-string keys when inspecting logs.

Private candidate files are prepared for both local Claude URL replacements,
hosted Claude's authenticated endpoint, importer variables, and dashboard Neon
variables. `prepare-clients.py` preserves all unrelated Claude settings and can
regenerate its candidate from the latest live file before applying. Local importer
code is adapted, but its new environment variables are not active until cutover.

Synthetic tests deliberately sent no Slack messages. Signed challenge, durable
enrichment and recovery were tested; live threaded confirmation delivery remains
to be checked after cutover using an explicitly authorized temporary message.
Slack confirmation is at least once around a crash between send and checkpoint;
database content and queue claims are idempotent. Queue delivery exhaustion or
24-hour expiry leaves durable database jobs for authenticated manual recovery.

Original ignored importer scripts were not backed up before adaptation; see
IMPORTER-ROLLBACK.md for the disclosed limitation and reconstructed adapters.
Private backups are local; no separate off-device backup was created.

No paid plan or subscription was added. The existing Neon Launch account is
usage-billed: estimated $0.53–$1.59/month compute at .25 CU for 20–60 active
hours, roughly cents for this dataset's storage, plus restore history. Frequent
traffic can keep compute awake (~$19.35/month at continuous .25 CU). Workers and
Queues are intended to stay within free allowances; a paid Workers upgrade, if
needed, starts at $5/month and has not been authorized. Existing Vercel and model
usage remains additional. See README.md for pricing sources and limits.

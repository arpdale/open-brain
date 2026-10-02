# Personal Neon backend

Cloudflare Worker replaces the three operational Edge Functions. PostgreSQL
credentials remain server-side. Existing Supabase function source stays untouched
for rollback. Apply `sql/jobs.sql` after the portable thoughts schema and runtime role.

`/mcp` (also `/functions/v1/open-brain-mcp`) preserves the four remote MCP tools,
key header/query authentication, Streamable HTTP and Claude Accept workaround.
`/update-thought` accepts the original edit/delete/undelete body and
`x-dashboard-secret`. `/ingest-thought` retains signed Slack events, replay
protection, allowed channel/user, bot/subtype filters and idempotency.

Slack acceptance commits a thought and durable job atomically, then awaits Queue
acceptance. Consumer leases fence duplicate work, preserve completed enrichment,
retry failures and leave exhausted jobs recoverable after DLQ delivery.
Authenticated `POST /recover-jobs` requeues up to50 pending/error/expired jobs;
`GET /jobs/:id` reports status without thought content. No periodic polling keeps
Neon awake. Replies are at least once: a crash after Slack accepts a message but
before the completion commit can cause a duplicate confirmation. The same
`client_msg_id` is reused; do not rely on Slack guaranteeing deduplication.

`WRITES_ENABLED=false` freezes capture/update/import writes and queue consumers.
`SLACK_REPLIES_ENABLED=false` suppresses all outbound Slack messages during
candidate verification. These are deployment variables, never request overrides.
Authenticated `GET /runtime-status` reports both flags. Set allowed browser origins
in `ALLOWED_ORIGINS`; requests without Origin remain compatible with native MCP
clients. A platform rate-limit binding limits each IP to120 requests/minute.

`POST /import-thought`, authenticated with `x-brain-key`, supports bounded actions:
lookup(key,value), match(embedding,threshold?,limit?,filter?),
insert(content,embedding,metadata), update(id,content,embedding,metadata).
Vectors must contain1536 finite numbers and use the retained embedding model.
Lookup/match return `{rows}`, mutations return `{id}`. Import writes preserve
provided metadata and do not infer or regenerate embeddings.

Secrets: DATABASE_URL (restricted runtime role), OPENROUTER_API_KEY,
MCP_ACCESS_KEY, UPDATE_THOUGHT_SECRET, SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET,
SLACK_CAPTURE_CHANNEL, SLACK_CAPTURE_USER_ID. Never commit `.dev.vars`.

Run `npm ci`, `npm run types`, `npm run typecheck`, `npm test`, `npm run build`.
Wrangler dry run writes minified `dist/index.js`. Local security tests supplement
the independent deployed SDK/client and SQL integrity verification.

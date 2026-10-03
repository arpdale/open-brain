# Personal Open Brain: Neon migration

Dashboard authentication was subsequently moved to managed Neon Auth on 2026-10-03.
See [dashboard authentication](../dashboard/README.md) for current email-code login
and owner-only access. References below to the shared password/session describe
the original database cutover.

This directory migrates the active personal deployment. Community recipes, the upstream `server/` example, and the original Supabase functions remain historical/reference code. They are not dependencies of the new deployed application.

See [VERIFICATION.md](VERIFICATION.md) for deployed test results and the exact current state. The user-approved production cutover is complete: Neon is authoritative, Supabase is write-fenced and retained for rollback.

## Architecture and access

- Neon project `silent-wave-89224791`, PostgreSQL 18, AWS Ohio, production branch `br-late-cloud-b4nyht2e`.
- Compute: 0.25–1 CU, suspend after 300 seconds idle. No periodic database polling.
- `extensions.vector` preserves 1536-dimensional `openai/text-embedding-3-small` embeddings, HNSW cosine index, JSONB metadata, IDs and microsecond timestamps.
- Cloudflare Worker hosts authenticated remote Streamable HTTP MCP and ingestion/update/import endpoints. Cloudflare Queues handles durable Slack enrichment.
- Vercel hosts `personal/dashboard`; `DATABASE_URL` is server-only and uses the `open_brain_dashboard` SELECT-only role. The Worker uses `open_brain_runtime`, with no schema administration or table DELETE privilege.
- Existing `x-brain-key` / MCP URL-key compatibility, dashboard signed session cookie and update secret, Slack HMAC/replay/channel/user checks remain independent of database authentication.
- Zero Supabase Auth users does not mean unauthenticated: these three application access controls remain required.

## Source audit, 2026-10-02

Supabase `eykyhucukwfepphxvajc` (`open-brain`) was healthy, PostgreSQL 17, 31,730,835 bytes. It held 762 thoughts; all 762 had 1536-dimensional embeddings and the same embedding model. No deleted rows, Auth users, storage objects/buckets, vault secrets, realtime subscriptions/publication tables, or cron extension/jobs were present.

Application objects: `thoughts`, seven indexes (including PK, fingerprint/idempotency unique indexes), `thoughts_updated_at` trigger, and SQL functions `match_thoughts`, `upsert_thought`, `update_updated_at`. Source RLS allowed service-role access. Neon replaces that Supabase-specific role predicate with explicit non-owner application-role policies and grants. The core RPC remains SECURITY INVOKER and preserves cosine comparison, strict `>` threshold, ordering and metadata containment.

Source extensions: plpgsql, pg_stat_statements, uuid-ossp, pgcrypto, supabase_vault, vector. Neon application restore installs vector, pgcrypto, uuid-ossp; empty Supabase-owned auth/storage/vault/realtime infrastructure is not an application dependency.

Functions: `open-brain-mcp` v10, `ingest-thought` v2, `update-thought` v3. `runtime-waituntil-check` v5 is explicitly tombstoned and returns 410; it is not a runtime dependency. All four original functions remain deployed for rollback. A short-lived JWT- and shared-secret-protected migration function transferred seven allowlisted runtime secrets encrypted to a one-time local RSA key, then was deleted; it never returned plaintext secrets.

## Private backups

Private files are in `.local/migration-2026-10-02/`, ignored by Git and Vercel, with a mode-700 parent and mode-600 secret/dump files. Do not commit or share that directory.

`source/schema.sql`, `source/data.sql`, downloaded source functions, original local environments, original Claude client config, and Vercel production settings/env preserve rollback context. `source/manifest.json` records hashes. `source/function-secrets.json` contains retained application secrets; `database-roles.json` contains new restricted credentials. Keep a separate encrypted offline copy according to your backup policy.

The Supabase CLI COPY dump includes all existing application records plus empty auth/storage tables. Original provider settings and managed schemas remain available on the untouched source project. This is a logical application backup, not a byte-for-byte provider image.

`backup.py --owner-url-file PRIVATE_URL_FILE --output NEW_PRIVATE_FILE` takes a transactionally consistent client-side COPY backup of both Neon application tables and refuses to overwrite a file. Keep `schema.sql`, `../backend/sql/jobs.sql`, restricted role configuration, and retained secrets with the backup. A tested candidate snapshot is saved privately as `neon-candidate-data.sql`. Restore a later complete application backup into an empty database: apply the schema, restore `thoughts` before `thought_jobs`, create/grant the restricted roles as in `restore.py`, then verify counts/hashes and job status before enabling consumers. `restore.py` itself restores the original source snapshot and checks its fixed expected hashes.

Vercel's sensitive-variable export leaves secret values blank. Never overwrite active settings with those blank exports; actual application credentials remain in the private original local environment/function-secret backups. Ignored importer originals were not preserved before editing; [IMPORTER-ROLLBACK.md](IMPORTER-ROLLBACK.md) documents that limitation and rollback adapters.

## Restore and integrity

Install `psycopg[binary]==3.2.10` into a private virtual environment. Put a new empty target's owner connection URL in the private `neon-owner-url` file. `restore.py --private-dir PATH` refuses an existing thoughts table, restores the application schema and COPY data in one transaction, creates restricted roles, and checks the captured source hashes before committing. It is deliberately tied to this captured snapshot; update its expected manifest when restoring a later backup.

`verify.py --private-dir PATH` checks every column and embedding, vector dimensions, restricted-role privileges, and 15 search cases against source results. Captured baseline:

- Rows: 762
- Every-column hash: `20ab7eb412f7d6f4532dcc82c8dce56f`
- Vector hash: `14a3c636b106a4d8080612cdac5bafd8`
- Search hash: `fe38919d9633adf180abe19ccfbd2f37` (129 returned matches across 15 cases)

No embeddings are regenerated during database migration. New capture/edit/search tests incur normal provider usage only.

## Active clients and completed cutover

- Worker production version `d57a22a9e91a4bcfa13d8307418ba4b7`: writes and Slack replies enabled; target fence removed.
- Vercel production deployment `dpl_ByTfCfDMDtqY2LwJVHjAKFYEiQ4J` serves `https://hey-otis.vercel.app`. A direct production build was used because preview promotion was rejected. All Vercel environment targets have zero Supabase keys.
- Hosted Claude connector **Open Brain (Neon)**, ID `c707740d-d052-4dd3-9e23-c109d0cbe14c`, is connected with four tools, each set to Needs approval. The old connector is disconnected; its rollback configuration is retained privately.
- Both local Claude Code entries, `open-brain` and `open-brain2`, point to the Worker MCP endpoint. Their latest configuration was updated atomically with all other fields preserved.
- Slack app **otis-listener** Event Subscription is verified and saved as `https://open-brain-neon.arpdale.workers.dev/ingest-thought` using the signed challenge.
- Repository-root `.env.local` and the dashboard environment use the new server-only configuration; Supabase variables were removed. Local ChatGPT and Notion importers use the authenticated import API and preserve supplied vectors. The ignored Ask-mode Supabase test is historical.

The source `migration_write_fence` blocks writes while retaining reads and all original data/functions. Under that fence, 762 rows matched the exact captured hashes. Docker-based pg_dump stopped during the final snapshot attempt; the existing COPY snapshot was reused only after proving its every-row/vector hashes still matched the fenced source. Final target refresh and integrity checks passed.

The sequence below remains the operational procedure for repeating a controlled cutover; it is no longer pending work.

Safe write cutover sequence:

1. Finish candidate enrichment and remove test jobs/records before disabling target writes. Confirm no processing jobs, unexpired leases, or pending real jobs. Disable target writes, then apply `fence-target.sql` as the exact Neon table owner. It waits for existing table writes and blocks the runtime role on thoughts and jobs, including invocations retaining earlier environment flags. Only the table owner can restore under this fence. Preserve a target backup. A deadlock rolls this transaction back safely; drain the concurrent work and retry. Environment flags alone are insufficient as a database fence.
2. Confirm no pending source Slack enrichments; stop/finish any local import process. Apply `fence-source.sql` only after approval. Its lock waits for existing transactions, then rejects every source write, including service-role writes. Reads continue; old write clients receive errors and must be switched promptly.
3. Take a fresh source COPY dump while fenced. Use `refresh.py --source-fenced --owner-url-file PATH --data-dump PATH`; it refuses target-only records and never silently deletes them. Keep the target fence installed during this owner-only refresh. Compare the final full-row/vector hashes, not just counts.
4. Keep target writes disabled until old candidate invocations and queue leases have drained. Confirm the intended deployment using authenticated `/runtime-status`; inspect job state and deployment logs as well as elapsed time. Provider and SQL requests are bounded, and queue leases expire. Enable writes in the intended deployment while the database fence still blocks writes, then apply `unfence-target.sql` immediately before switching clients, dashboard domain, Slack subscription and local env. Enable Slack replies only for the final production configuration after synthetic tests are removed. Verify every path again. Check old endpoint logs for remaining callers without printing URL query keys.
5. Leave source fenced and available for rollback. Do not pause/delete/cancel Supabase until explicitly authorized.

## Rollback

Before cutover, Supabase is authoritative and needs no rollback action; simply do not promote/switch. Candidate writes are only temporary test records and must be precisely cleaned.

After cutover, first finish or drain queued jobs, disable target writes, and apply `fence-target.sql` to block stale invocations before reconciling. Back up target data and export all changes since the final source snapshot, including edits, soft deletes, new IDs, vectors and timestamps. Reconcile those changes into Supabase under a controlled maintenance window. Verify full hashes/counts before using `unfence-source.sql` and restoring old clients/domain/Slack URL. Never switch to a stale source or restore an old dump over newer writes. Retained original functions and private configuration allow restoring the old deployment without reconstructing secrets.

## Cost

As checked 2026-10-02, existing Neon organization is Launch: $0.106/CU-hour + $0.35/GB-month plus restore-history usage where applicable, no monthly minimum. At .25 CU for 20–60 active hours/month, compute is $0.53–$1.59. The source-size storage estimate is roughly one cent/month; actual Neon billed size/history may differ. Frequent traffic can keep compute awake (about $19.35/month at .25 CU continuously), and bursts can scale to the 1-CU cap.

Workers Free: 100,000 requests/day and 10ms CPU/invocation. Queues Free: 10,000 operations/day, normally three operations/message, 24-hour retention. Retained database job state supports recovery after queue expiry. If Free CPU limits are exceeded, Workers Paid starts at $5/account/month; no upgrade is authorized automatically. Existing Vercel and OpenRouter usage continues.

Sources: https://neon.com/pricing ; https://neon.com/docs/extensions/pgvector ; https://developers.cloudflare.com/workers/platform/pricing/ ; https://developers.cloudflare.com/queues/platform/pricing/ .

### Retained integrations for rollback

The original hosted Claude connector (`0e7aad2d-42de-4ada-8fa0-68517cd7ca6a`) is disconnected. Its previous Supabase URL/key and tool approvals are retained privately for rollback. The current connected connector is **Open Brain (Neon)** with the same access-key compatibility and explicit tool approval settings.

Slack app **otis-listener** (`A0B1AEKK77A`) in **Blossom** (`T044Y5N4CMN`) now uses the verified Worker ingestion URL. The existing signing secret and bot token were preserved. Signed challenge, ingestion and queue behavior were tested, but no outgoing Slack confirmation message was sent during verification.

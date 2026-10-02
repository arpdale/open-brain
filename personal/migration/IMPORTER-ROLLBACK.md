# Local importer configuration and rollback

Two ignored local scripts were adapted during migration:

- `.planning/imports/chatgpt/capture-thoughts.py`
- `.planning/imports/notion/ingest.py`

Their **original files were not backed up before those edits** and are not in
Git. Do not describe them as exact original backups. Current adapted copies are
retained privately, mode 600, in:

- `.local/migration-2026-10-02/adapted-importers/chatgpt-capture-thoughts.py`
- `.local/migration-2026-10-02/adapted-importers/notion-ingest.py`

These copies contain code, not embedded credentials. Preserve sync-log files,
Notion ingest-log files, and extracted input files; they were not changed by the
adapter migration. The machine's crontab was checked and is empty, and targeted
LaunchAgent/LaunchDaemon inventory found no Open Brain import job.

## Candidate configuration

Both scripts read environment in this order: preexisting process environment,
script-local `.env`, repository-root `.env.local`, repository-root `.env`. First
assignment wins. Configure `IMPORT_THOUGHT_URL` to the candidate `/import-thought`
endpoint and `MCP_ACCESS_KEY` to its existing access key. Preserve
`OPENROUTER_API_KEY`. The migrated adapters use `x-brain-key` and never receive a
database connection string. Existing input parsing, metadata, IDs, supplied
1536-dimensional vectors and sync state are retained.

Lookups now fail explicitly on an API failure rather than silently treating
failed lookup as a missing record. This prevents accidental duplicates.

## Restoring Supabase ingestion

Before rollback, stop import processes, fence/drain target writes, back up both
systems, reconcile changes made in Neon into Supabase, and verify the restored
source data as described in the main migration README. Do not resume importers
against an unreconciled stale source.

Retrieve `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENROUTER_API_KEY`
from the retained private source configuration. Put them in a private local
file, never source control. Remove candidate `IMPORT_THOUGHT_URL` and
`MCP_ACCESS_KEY` from the importer environment after code restoration.

Because there is no exact original script backup, restore the **database adapter
behavior** explicitly while retaining current parsing and sync logic:

1. Replace global `IMPORT_THOUGHT_URL`/`MCP_ACCESS_KEY` reads with
   `SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")` and
   `SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")`.
2. Replace `import_request` calls with the operations below, using existing
   `http_request`, its retries/backoff, and headers `Content-Type: application/json`,
   `apikey: SUPABASE_KEY`, `Authorization: Bearer <SUPABASE_KEY>`.
3. Restore the command-line required-environment checks to `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, and `OPENROUTER_API_KEY`.

| Current action | Supabase operation and response adaptation |
| --- | --- |
| ChatGPT lookup | GET `/rest/v1/thoughts?metadata->>source_file=eq.<URL-encoded source_file>&select=id&limit=1`; JSON is an array, return first ID or None. |
| Notion lookup | GET `/rest/v1/thoughts?metadata->>notion_page_id=eq.<URL-encoded page ID>&select=id,metadata&limit=10`; examine array entries for matching `notion_section`, return ID or None. |
| ChatGPT semantic match | POST `/rest/v1/rpc/match_thoughts` with `query_embedding`, `match_threshold=.92`, `match_count=1`, `filter={"source": source}`; JSON is an array, return first match or None. |
| Insert, both scripts | POST `/rest/v1/thoughts`, `Prefer: return=representation`, body `{content,embedding,metadata}`; accept HTTP 200/201 and read ID from first array element. |
| Update, both scripts | PATCH `/rest/v1/thoughts?id=eq.<existing UUID>`, `Prefer: return=minimal`, body `{content,embedding,metadata}`; accept HTTP 200/204 and return existing ID. |

These operations reconstruct the observed former adapter semantics. Keep
lookup errors explicit unless deliberately reverting that safety improvement.
Do not regenerate existing embeddings as part of rollback. Preserve update IDs,
metadata and timestamps according to the data reconciliation procedure.

Validate Python syntax, run `--dry-run` against input files, and use one temporary
record for lookup, supplied-vector insert/match/update verification before
resuming ordinary imports. Precisely clean that test record. Keep candidate
code copies and migration records so the Neon version can be restored if needed.

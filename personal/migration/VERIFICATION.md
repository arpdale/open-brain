# Migration results — 2026-10-02

Status: user-approved production cutover completed. Neon is authoritative.
Supabase is retained with `migration_write_fence` installed; original records
and functions remain available for rollback. No retirement was performed.

## Active production

- Worker: `https://open-brain-neon.arpdale.workers.dev`
- Worker version: `d57a22a9e91a4bcfa13d8307418ba4b7`
- Dashboard: `https://hey-otis.vercel.app`
- Vercel deployment: `dpl_ByTfCfDMDtqY2LwJVHjAKFYEiQ4J`
- Neon: `silent-wave-89224791`, branch `br-late-cloud-b4nyht2e`
- Queues: `open-brain-enrichment` and `open-brain-enrichment-dlq`

Target writes and Slack replies are enabled and the target database fence is
removed. Source writes remain fenced. No temporary test records or jobs remain.
A direct production dashboard build replaced the candidate because preview
promotion was rejected. All Vercel targets and active local environments have
zero Supabase variables; database credentials remain server-side.

The tested branch is pushed to `origin/contrib/arpdale/neon-migration` and Vercel
production branch tracking is set to that branch. The original `main` remains
unchanged and no longer controls production. Committed Worker flags match the
live enabled state; synthetic Slack suites must use a separate candidate with
replies suppressed. Existing Claude Code sessions may need restarting to reload
their updated MCP configuration.

The seven importer checks also passed after cutover. Slack bot authentication
passed, and Slack itself verified the new signed request URL. A short
post-cutover source log window returned no old Edge/API endpoint events; that
does not rule out an undiscovered client returning later.

## Verification evidence

| Verification | Result |
| --- | --- |
| Full-row/embedding hashes after cleanup | Exact match to 762-row source snapshot |
| Vector dimensions | 762 of 762 are 1536-dimensional |
| SQL similarity parity | 15 cases, 129 results, matching IDs/ranks/rounded scores |
| Actual MCP SDK clients | 14 checks passed before and after cutover: source tool compatibility, all four tools, persistence, edit/search/delete/restore, missing/invalid auth |
| Deployed signed Slack ingestion + queue | 10 checks passed: signatures/replay, channel/user/bot rejection, duplicate delivery, enrichment, failed-job recovery, cleanup |
| Migrated Slack duplicates | 6 checks passed: retained vector/metadata unchanged with no enrichment, missing-vector recovery on original ID, repeated duplicate stability |
| Deployed importer | 7 checks passed: auth, dimensions, insert/lookup/vector match/update, exact supplied-vector preservation, cleanup |
| Actual local importer transports | Both ChatGPT and Notion Python adapters performed authenticated lookups successfully |
| Browser against deployed dashboard | 11 checks passed before and after cutover: login failures/success, secure cookie, protected routes, pagination, source/project filters, detail/neighbors, search, Ask, edit + reload, delete + Undo, logout/malformed cookie |
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

## Final sync and client configuration

With the source fenced, all 762 records matched the captured every-column and
vector hashes. The final Docker pg_dump attempt stopped; the existing COPY
snapshot was reused only after this exact-hash proof against the fenced source.
The final target refresh and full integrity verification passed. No embeddings
were regenerated for migration.

Hosted Claude **Open Brain (Neon)** is connected under connector ID
`c707740d-d052-4dd3-9e23-c109d0cbe14c`, with all four tools set to Needs approval.
The old connector is disconnected and retained for rollback. Both local Claude
Code URLs were updated atomically against the latest settings, preserving all
other fields. Slack's signed challenge was verified and its Worker ingestion URL
saved. Root/dashboard local environments now configure Neon, Worker updates and
the authenticated importer API. Supabase secrets were removed from active
Vercel configuration across all environment targets.

Post-cutover verification reran the actual MCP client suite (14 checks) and
production dashboard browser suite (11 checks); both passed and exact temporary
fixture cleanup completed. Historical/reference Supabase code remains for
community examples and rollback. Unknown clients outside accessible settings
cannot be ruled out; monitor old endpoint callers without printing URL keys.

## Remaining limitations

Synthetic tests deliberately sent no Slack messages. Signed challenge, durable
enrichment and recovery were tested; live threaded confirmation delivery remains
unverified until an explicitly authorized temporary message is sent. Slack replies are now enabled in production.
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

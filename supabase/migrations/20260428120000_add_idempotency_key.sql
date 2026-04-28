-- Add idempotency_key for claim-first capture pattern.
-- Used by the ingest-thought Edge Function (Slack capture and any future capture
-- surfaces that need to deduplicate retried webhook deliveries).
--
-- Partial unique index enforces uniqueness only on non-null values, so the 130
-- existing rows (which have NULL idempotency_key) are unaffected — no backfill
-- required, no data risk.
--
-- Reversible:
--   drop index if exists thoughts_idempotency_key_uniq;
--   alter table public.thoughts drop column if exists idempotency_key;

alter table public.thoughts
  add column if not exists idempotency_key text;

create unique index if not exists thoughts_idempotency_key_uniq
  on public.thoughts (idempotency_key)
  where idempotency_key is not null;

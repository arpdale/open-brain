-- Backfill embedding_provider + embedding_model into all thoughts metadata.
--
-- HISTORY: This migration was originally applied via Supabase MCP on
-- 2026-04-27 as Phase 0 of the personal/dashboard build. At that point we
-- had not yet established a file-tracked migrations convention.
--
-- This file is added retroactively so the `supabase/migrations/` history is
-- consistent with what's actually been applied to the live DB. It is
-- idempotent — the predicate excludes rows that already have these keys, so
-- re-running on a fresh DB (or re-running here) only updates rows that need it.
--
-- Closes the embedding-model/provider drift loop: every row now records
-- exactly what model produced its embedding, detectable via
-- `select distinct metadata->>'embedding_model' from thoughts;`.

update public.thoughts
set metadata = metadata
  || jsonb_build_object(
       'embedding_provider', 'openrouter',
       'embedding_model', 'openai/text-embedding-3-small'
     )
where metadata->>'embedding_model' is null;

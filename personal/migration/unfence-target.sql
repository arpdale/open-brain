-- CUTOVER/ROLLBACK ONLY. Remove after final refresh integrity checks, with
-- old candidate invocations drained and deployment configuration verified.
BEGIN;
LOCK TABLE public.thoughts, public.thought_jobs IN SHARE ROW EXCLUSIVE MODE;
DROP TRIGGER IF EXISTS migration_target_write_fence ON public.thoughts;
DROP TRIGGER IF EXISTS migration_target_write_fence ON public.thought_jobs;
DROP FUNCTION IF EXISTS public.migration_target_write_fence();
COMMIT;

-- Rollback only after target writes have been fenced and reconciled.
BEGIN;
DROP TRIGGER IF EXISTS migration_write_fence ON public.thoughts;
DROP FUNCTION IF EXISTS public.migration_write_fence();
COMMIT;

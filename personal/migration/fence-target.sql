-- CUTOVER ONLY. Run as the Neon table owner after draining candidate jobs.
-- Old invocations retaining earlier Worker env remain blocked. The exact
-- table owner can refresh the final source snapshot while this fence is active.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='open_brain_runtime')
     OR current_user::regrole::oid <> (SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.thoughts'::regclass)
  THEN RAISE EXCEPTION 'Target fence requires Neon application schema and exact table owner'; END IF;
END $$;
LOCK TABLE public.thoughts, public.thought_jobs IN SHARE ROW EXCLUSIVE MODE;
CREATE OR REPLACE FUNCTION public.migration_target_write_fence() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
  IF current_user::regrole::oid <> (SELECT relowner FROM pg_catalog.pg_class WHERE oid=TG_RELID) THEN
    RAISE EXCEPTION 'Open Brain migration: target writes temporarily unavailable' USING ERRCODE='55000';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.migration_target_write_fence() FROM PUBLIC;
DROP TRIGGER IF EXISTS migration_target_write_fence ON public.thoughts;
CREATE TRIGGER migration_target_write_fence BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
ON public.thoughts FOR EACH STATEMENT EXECUTE FUNCTION public.migration_target_write_fence();
DROP TRIGGER IF EXISTS migration_target_write_fence ON public.thought_jobs;
CREATE TRIGGER migration_target_write_fence BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
ON public.thought_jobs FOR EACH STATEMENT EXECUTE FUNCTION public.migration_target_write_fence();
COMMIT;

-- CUTOVER ONLY: apply after approval, after checking pending Slack captures.
-- The table lock waits for already-running writes to commit before fencing.
BEGIN;
LOCK TABLE public.thoughts IN SHARE ROW EXCLUSIVE MODE;
CREATE OR REPLACE FUNCTION public.migration_write_fence() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'Open Brain migration: writes temporarily unavailable' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION public.migration_write_fence() FROM PUBLIC;
CREATE TRIGGER migration_write_fence BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
ON public.thoughts FOR EACH STATEMENT EXECUTE FUNCTION public.migration_write_fence();
COMMIT;

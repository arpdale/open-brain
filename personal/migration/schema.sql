-- Portable application objects captured from the live source, 2026-10-02.
-- Apply once to an empty Neon database; data is restored separately.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
SET search_path = public, extensions, pg_catalog;
SET check_function_bodies = false;
CREATE OR REPLACE FUNCTION "public"."match_thoughts"("query_embedding" "extensions"."vector", "match_threshold" double precision DEFAULT 0.7, "match_count" integer DEFAULT 10, "filter" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("id" "uuid", "content" "text", "metadata" "jsonb", "similarity" double precision, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select
    t.id,
    t.content,
    t.metadata,
    1 - (t.embedding <=> query_embedding) as similarity,
    t.created_at
  from thoughts t
  where 1 - (t.embedding <=> query_embedding) > match_threshold
    and (filter = '{}'::jsonb or t.metadata @> filter)
  order by t.embedding <=> query_embedding
  limit match_count;
end;
$$;





CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;





CREATE OR REPLACE FUNCTION "public"."upsert_thought"("p_content" "text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_fingerprint TEXT;
  v_result JSONB;
  v_id UUID;
BEGIN
  v_fingerprint := encode(sha256(convert_to(
    lower(trim(regexp_replace(p_content, '\s+', ' ', 'g'))),
    'UTF8'
  )), 'hex');

  INSERT INTO thoughts (content, content_fingerprint, metadata)
  VALUES (p_content, v_fingerprint, COALESCE(p_payload->'metadata', '{}'::jsonb))
  ON CONFLICT (content_fingerprint) WHERE content_fingerprint IS NOT NULL DO UPDATE
  SET updated_at = now(),
      metadata = thoughts.metadata || COALESCE(EXCLUDED.metadata, '{}'::jsonb)
  RETURNING id INTO v_id;

  v_result := jsonb_build_object('id', v_id, 'fingerprint', v_fingerprint);
  RETURN v_result;
END;
$$;




SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."thoughts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content" "text" NOT NULL,
    "embedding" "extensions"."vector"(1536),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "content_fingerprint" "text",
    "idempotency_key" "text",
    "deleted_at" timestamp with time zone
);





ALTER TABLE ONLY "public"."thoughts"
    ADD CONSTRAINT "thoughts_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "idx_thoughts_fingerprint" ON "public"."thoughts" USING "btree" ("content_fingerprint") WHERE ("content_fingerprint" IS NOT NULL);



CREATE INDEX "thoughts_created_at_idx" ON "public"."thoughts" USING "btree" ("created_at" DESC);



CREATE INDEX "thoughts_embedding_idx" ON "public"."thoughts" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops");



CREATE UNIQUE INDEX "thoughts_idempotency_key_uniq" ON "public"."thoughts" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "thoughts_metadata_idx" ON "public"."thoughts" USING "gin" ("metadata");



CREATE INDEX "thoughts_visible_idx" ON "public"."thoughts" USING "btree" ("created_at" DESC, "id" DESC) WHERE ("deleted_at" IS NULL);



CREATE OR REPLACE TRIGGER "thoughts_updated_at" BEFORE UPDATE ON "public"."thoughts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();




ALTER TABLE public.thoughts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.thoughts FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_thoughts(extensions.vector,double precision,integer,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_thought(text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_updated_at() FROM PUBLIC;
ALTER FUNCTION public.match_thoughts(extensions.vector,double precision,integer,jsonb) SET search_path = public, extensions, pg_catalog;
ALTER FUNCTION public.upsert_thought(text,jsonb) SET search_path = public, extensions, pg_catalog;
ALTER FUNCTION public.update_updated_at() SET search_path = public, extensions, pg_catalog;

"""CUTOVER ONLY: refresh target from a new write-fenced source COPY snapshot.
The target must have fence-target.sql installed. Stops if target-only records exist.
Requires --source-fenced confirmation; never deletes application records.
"""
import argparse
from pathlib import Path
import psycopg
p=argparse.ArgumentParser();p.add_argument('--owner-url-file',type=Path,required=True);p.add_argument('--data-dump',type=Path,required=True);p.add_argument('--source-fenced',action='store_true',required=True)
a=p.parse_args();data=a.data_dump.read_text();start=data.index('COPY "public"."thoughts" ');e=data.index('\n',start);end=data.index('\n\\.\n',e)
with psycopg.connect(a.owner_url_file.read_text().strip()) as c:
 c.execute('set search_path=public,extensions,pg_catalog')
 c.execute('LOCK TABLE thoughts IN ACCESS EXCLUSIVE MODE')
 assert c.execute("select current_user::regrole::oid = relowner from pg_catalog.pg_class where oid='public.thoughts'::regclass").fetchone()[0], 'Refresh requires exact target table owner'
 fences=c.execute("select count(*) from pg_catalog.pg_trigger where tgname='migration_target_write_fence' and tgrelid in ('public.thoughts'::regclass,'public.thought_jobs'::regclass) and tgenabled in ('O','A')").fetchone()[0]
 assert fences==2,'Target thoughts/jobs write fences missing; apply fence-target.sql first'
 c.execute('CREATE TEMP TABLE migration_snapshot (LIKE thoughts INCLUDING DEFAULTS) ON COMMIT DROP')
 with c.cursor().copy(data[start:e].replace('"public"."thoughts"','migration_snapshot',1)) as cp:cp.write(data[e+1:end]+'\n')
 extras=c.execute('select count(*) from thoughts t where not exists(select 1 from migration_snapshot s where s.id=t.id)').fetchone()[0]
 assert extras==0,'Target-only records found: reconcile rather than discard them'
 c.execute('ALTER TABLE thoughts DISABLE TRIGGER thoughts_updated_at')
 c.execute('''INSERT INTO thoughts SELECT * FROM migration_snapshot
 ON CONFLICT(id) DO UPDATE SET content=EXCLUDED.content,embedding=EXCLUDED.embedding,metadata=EXCLUDED.metadata,created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at,content_fingerprint=EXCLUDED.content_fingerprint,idempotency_key=EXCLUDED.idempotency_key,deleted_at=EXCLUDED.deleted_at''')
 c.execute('ALTER TABLE thoughts ENABLE TRIGGER thoughts_updated_at')
 mismatch=c.execute('select count(*) from thoughts t join migration_snapshot s using(id) where row_to_json(t)::text <> row_to_json(s)::text').fetchone()[0]
 assert mismatch==0,'Refreshed records differ; rolled back'
 print('Final snapshot restored and verified:',c.execute('select count(*) from thoughts').fetchone()[0],'records')

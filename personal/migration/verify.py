"""Check restored records, vector data, restricted roles, and search stability.
No private contents or credentials are printed.
"""
import argparse,json
from pathlib import Path
import psycopg
p=argparse.ArgumentParser();p.add_argument('--private-dir',required=True,type=Path);a=p.parse_args();d=a.private_dir
with psycopg.connect((d/'neon-owner-url').read_text().strip()) as c:
 c.execute('set search_path=public,extensions,pg_catalog')
 row=c.execute("select count(*),md5(string_agg(md5(row_to_json(t)::text), '' order by id)),md5(string_agg(md5(embedding::text), '' order by id)) from public.thoughts t").fetchone()
 assert row==(762,'20ab7eb412f7d6f4532dcc82c8dce56f','14a3c636b106a4d8080612cdac5bafd8'),'Source snapshot mismatch'
 search=c.execute("with samples as (select id,embedding from thoughts order by id limit 5), cases as (select s.id,t.threshold,m.id as match_id,round(m.similarity::numeric,8) as score from samples s cross join (values (0.2::float8),(0.5),(0.7)) t(threshold) cross join lateral match_thoughts(s.embedding,t.threshold,10,'{}') m) select count(*),md5(string_agg(id::text||threshold::text||match_id::text||score::text,'' order by id,threshold,score desc,match_id)) from cases").fetchone()
 assert search==(129,'fe38919d9633adf180abe19ccfbd2f37'),'Search results differ from source'
 dims=c.execute('select vector_dims(embedding),count(*) from thoughts group by 1').fetchall();assert dims==[(1536,762)]
 roles=c.execute("select rolname,rolsuper,rolcreaterole,rolcreatedb,rolbypassrls from pg_roles where rolname like 'open_brain_%'").fetchall();assert all(not any(r[1:]) for r in roles)
 # Fixed existing vectors exercise RPC threshold, order and JSON filter semantics without re-embedding.
 ids=[r[0] for r in c.execute('select id from thoughts order by id limit 5')]
 samples=[]
 for id in ids:
  for threshold in [0.2,0.5,0.7]:
   matches=c.execute('select id,similarity from match_thoughts((select embedding from thoughts where id=%s),%s,10,\'{}\')',(id,threshold)).fetchall()
   samples.append({'query_id':str(id),'threshold':threshold,'results':[[str(i),v] for i,v in matches]})
 (d/'neon-search-samples.json').write_text(json.dumps(samples))
creds=json.loads((d/'database-roles.json').read_text())
for name,url in creds.items():
 with psycopg.connect(url) as c:
  assert c.execute('select count(*) from thoughts').fetchone()[0]==762
  assert c.execute('select count(*) from match_thoughts((select embedding from thoughts limit 1),0.5,10)').fetchone()[0]>0
  assert not c.execute("select has_table_privilege(current_user,'thoughts','DELETE')").fetchone()[0]
  if name.endswith('dashboard'):assert not c.execute("select has_table_privilege(current_user,'thoughts','UPDATE')").fetchone()[0]
print(json.dumps({'integrity':'PASS','rows':762,'vector_dimensions':1536,'all_columns_hash':row[1],'vectors_hash':row[2],'restricted_roles':'PASS','search_cases':len(samples),'search_parity':'PASS','search_hash':search[1]}))

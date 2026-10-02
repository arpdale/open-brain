"""Restore an untouched COPY snapshot into an empty Neon database.
Requires psycopg[binary]; credentials and dumps stay in a private directory.
"""
import argparse, json, os, secrets
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, quote
import psycopg
from psycopg import sql

p=argparse.ArgumentParser()
p.add_argument('--private-dir',type=Path,required=True)
a=p.parse_args(); private=a.private_dir
owner=(private/'neon-owner-url').read_text().strip()
with psycopg.connect(owner) as conn:
    assert conn.execute("select to_regclass('public.thoughts')").fetchone()[0] is None, 'Refusing restore: target table exists'
    conn.execute(Path(__file__).with_name('schema.sql').read_text())
    data=(private/'source/data.sql').read_text()
    header='COPY "public"."thoughts" '
    start=data.index(header); end_header=data.index('\n',start)
    end=data.index('\n\\.\n',end_header)
    with conn.cursor().copy(data[start:end_header]) as cp:
        cp.write(data[end_header+1:end]+'\n')
    creds={}
    for role in ['open_brain_runtime','open_brain_dashboard']:
        password=secrets.token_urlsafe(36)
        conn.execute(sql.SQL('CREATE ROLE {} LOGIN PASSWORD {} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS').format(sql.Identifier(role),sql.Literal(password)))
        conn.execute(sql.SQL('ALTER ROLE {} SET search_path = public, extensions, pg_catalog').format(sql.Identifier(role)))
        conn.execute(sql.SQL('GRANT USAGE ON SCHEMA public, extensions TO {}').format(sql.Identifier(role)))
        u=urlsplit(owner)
        creds[role]=urlunsplit((u.scheme,quote(role)+':'+quote(password)+'@'+u.netloc.split('@')[-1],u.path,u.query,u.fragment))
    conn.execute('''GRANT SELECT,INSERT,UPDATE ON public.thoughts TO open_brain_runtime;
      GRANT SELECT ON public.thoughts TO open_brain_dashboard;
      CREATE POLICY runtime_access ON public.thoughts TO open_brain_runtime USING (true) WITH CHECK (true);
      CREATE POLICY dashboard_read ON public.thoughts FOR SELECT TO open_brain_dashboard USING (true);
      GRANT EXECUTE ON FUNCTION public.match_thoughts(extensions.vector,double precision,integer,jsonb) TO open_brain_runtime,open_brain_dashboard;
      GRANT EXECUTE ON FUNCTION public.upsert_thought(text,jsonb) TO open_brain_runtime;
      GRANT EXECUTE ON FUNCTION public.update_updated_at() TO open_brain_runtime;
      REVOKE CREATE ON SCHEMA public FROM PUBLIC;''')
    row=conn.execute("select count(*),md5(string_agg(md5(row_to_json(t)::text), '' order by id)),md5(string_agg(md5(embedding::text), '' order by id)) from public.thoughts t").fetchone()
    expected=(762,'20ab7eb412f7d6f4532dcc82c8dce56f','14a3c636b106a4d8080612cdac5bafd8')
    assert row==expected, 'Integrity check failed; transaction rolled back'
    dest=private/'database-roles.json'
    fd=os.open(dest,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as f: json.dump(creds,f)
    print(json.dumps({'rows':row[0],'all_columns_hash':row[1],'vectors_hash':row[2],'integrity':'PASS'}))

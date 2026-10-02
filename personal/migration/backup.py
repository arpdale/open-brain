"""Client-side COPY backup of application tables; output must stay private.
Schema is versioned in schema.sql and ../backend/sql/jobs.sql. Credentials and
role passwords are backed up separately. No server-side file access is used.
"""
import argparse
import os
from pathlib import Path
import psycopg
from psycopg import sql

p = argparse.ArgumentParser()
p.add_argument('--owner-url-file', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
a = p.parse_args()
# Exclusive create prevents accidentally replacing an earlier backup.
fd = os.open(a.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'wb') as out, psycopg.connect(a.owner_url_file.read_text().strip()) as c:
    c.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
    for table in ['thoughts', 'thought_jobs']:
        columns = [r[0] for r in c.execute(
            'SELECT attname FROM pg_attribute WHERE attrelid=%s::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum',
            ('public.' + table,))]
        names = sql.SQL(', ').join(map(sql.Identifier, columns))
        qualified = sql.Identifier('public', table)
        out.write(sql.SQL('COPY {} ({}) FROM stdin;\n').format(qualified, names).as_string(c).encode())
        with c.cursor().copy(sql.SQL('COPY {} ({}) TO STDOUT').format(qualified, names)) as cp:
            for chunk in cp:
                out.write(chunk)
        out.write(b'\\.\n\n')
print('Private application COPY backup saved')

// Run from repository root: node personal/backend-tests/dashboard.mjs
// Configure DASHBOARD_URL, DASHBOARD_SHARE_URL_FILE, PLAYWRIGHT_MODULE;
// optionally PRIVATE_DIR, BASE_URL, ADMIN_DATABASE_URL, BRAIN_PASSWORD.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {neon} from '@neondatabase/serverless';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const privateDir=resolve(process.env.PRIVATE_DIR || '.local/migration-2026-10-02');
assert(process.env.DASHBOARD_URL && process.env.DASHBOARD_SHARE_URL_FILE && process.env.PLAYWRIGHT_MODULE,
  'Set candidate preview URL, private share URL file and installed Playwright module path');
const secret={...JSON.parse(await readFile(join(privateDir,'source/function-secrets.json'),'utf8')),...process.env};
const sql=neon(process.env.ADMIN_DATABASE_URL || (await readFile(join(privateDir,'neon-owner-url'),'utf8')).trim());
const marker=`dashboard-verification-${randomUUID()}`;
const content=`${marker}: A temporary note about a purple telescope observing Saturn rings.`;
const fixture={content,updatedContent:content+' Updated to observe Jupiter moons.',query:content,source:'migration_test',project:marker};
let password=process.env.BRAIN_PASSWORD;
if(!password){
  const env=await readFile(join(privateDir,'source/dashboard.env'),'utf8');
  password=env.match(/^\s*BRAIN_PASSWORD=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g,'');
}
assert(password,'Missing app password');
const base=(process.env.BASE_URL || 'https://open-brain-neon.arpdale.workers.dev').replace(/\/$/,'');
const client=new Client({name:'dashboard-fixture',version:'1'});
const ids=new Set(),manifest=join(privateDir,`${marker}-manifest.json`),fixturePath=join(privateDir,`${marker}-fixture.json`);
await mkdir(privateDir,{recursive:true,mode:0o700});
async function save(state){await writeFile(manifest,JSON.stringify({marker,ids:[...ids],state,updatedAt:new Date().toISOString()},null,2),{mode:0o600});}
async function scan(){for(const row of await sql`SELECT id FROM public.thoughts WHERE content=${content} OR content=${fixture.updatedContent}`)ids.add(row.id);}
let failed=false;
await save('running');
try{
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`),{requestInit:{headers:{'x-brain-key':secret.MCP_ACCESS_KEY}}}));
  const result=await client.callTool({name:'capture_thought',arguments:{content}},undefined,{timeout:120000});
  assert(!result.isError,'Fixture capture failed');
  await scan();assert.equal(ids.size,1,'Fixture count mismatch');fixture.id=[...ids][0];
  await save('fixture-created');
  await sql`UPDATE public.thoughts SET metadata=metadata||${JSON.stringify({source:fixture.source,migration_test_project:marker})}::jsonb WHERE id=${fixture.id}`;
  await writeFile(fixturePath,JSON.stringify(fixture),{mode:0o600});
  console.log('PASS temporary dashboard fixture prepared');
  const script=fileURLToPath(new URL('../dashboard/tests/deployed.mjs',import.meta.url));
  const code=await new Promise((resolveExit,reject)=>{
    const child=spawn(process.execPath,[script],{stdio:'inherit',env:{...process.env,DASHBOARD_FIXTURE_FILE:fixturePath,BRAIN_PASSWORD:password}});
    child.on('error',reject);child.on('exit',resolveExit);
  });
  if(code!==0)throw Error('Dashboard verification failed');
}catch(error){failed=true;console.error(`FAIL dashboard verification orchestration; ${error?.name || 'Error'}`);}
finally{
  try{
    // Capture accepted fixture writes even if MCP/client failed before returning.
    await scan();await save('cleaning');
    for(const id of ids)await sql`DELETE FROM public.thoughts WHERE id=${id} AND (content=${content} OR content=${fixture.updatedContent})`;
    assert.equal((await sql`SELECT count(*)::int AS count FROM public.thoughts WHERE content=${content} OR content=${fixture.updatedContent}`)[0].count,0);
    await save('cleaned');console.log('PASS exact dashboard fixture cleaned');
  }catch{failed=true;await save('cleanup-required');console.error('FAIL cleanup; exact IDs retained privately');}
  await client.close();
}
if(failed)process.exitCode=1;

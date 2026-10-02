import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {neon} from '@neondatabase/serverless';
const privateDir=resolve(process.env.PRIVATE_DIR || '.local/migration-2026-10-02');
const base=(process.env.BASE_URL || 'https://open-brain-neon.arpdale.workers.dev').replace(/\/$/,'');
const secret={...JSON.parse(await readFile(join(privateDir,'source/function-secrets.json'),'utf8')),...process.env};
const sql=neon(process.env.ADMIN_DATABASE_URL || (await readFile(join(privateDir,'neon-owner-url'),'utf8')).trim());
const runId=randomUUID(),marker=`legacy-slack-verification-${runId}`;
const seconds=Math.floor(Date.now()/1000),suffix=Math.floor(Math.random()*899999)+100000;
const fixtures=[0,1].map(i=>({id:randomUUID(),ts:`${seconds}.${suffix+i}`,content:`${marker}-${i}: Temporary migrated Slack thought about violet telescopes.`}));
const jobIds=new Set(),checks=[],manifest=join(privateDir,`legacy-slack-verification-records-${runId}.json`);
await mkdir(privateDir,{recursive:true,mode:0o700});
async function save(state='running'){await writeFile(manifest,JSON.stringify({runId,marker,thoughtIds:fixtures.map(x=>x.id),jobIds:[...jobIds],state,updatedAt:new Date().toISOString()},null,2),{mode:0o600})}
await save();
const pass=name=>{checks.push(name);console.log(`PASS ${name}`)};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function inspect(f){const rows=await sql`SELECT t.id,t.content,t.metadata,t.embedding::text AS embedding,extensions.vector_dims(t.embedding) AS dimensions,j.id AS job_id,j.status,j.attempts FROM public.thoughts t LEFT JOIN public.thought_jobs j ON j.thought_id=t.id WHERE t.id=${f.id} AND t.content=${f.content}`;assert.equal(rows.length,1);const row=rows[0];if(row.job_id){jobIds.add(row.job_id);await save()}return row}
async function send(f){const timestamp=String(Math.floor(Date.now()/1000));const body=JSON.stringify({type:'event_callback',event_id:`verification-${runId}-${f.id}`,event:{type:'message',channel:secret.SLACK_CAPTURE_CHANNEL,user:secret.SLACK_CAPTURE_USER_ID,text:f.content,ts:f.ts,event_ts:f.ts}});
  const signature='v0='+createHmac('sha256',secret.SLACK_SIGNING_SECRET).update(`v0:${timestamp}:${body}`).digest('hex');
  const res=await fetch(`${base}/ingest-thought`,{method:'POST',headers:{'content-type':'application/json','x-slack-request-timestamp':timestamp,'x-slack-signature':signature},body,signal:AbortSignal.timeout(30000)});assert.equal(res.status,200);await res.arrayBuffer();
}
async function complete(f){const until=Date.now()+180000;while(Date.now()<until){const row=await inspect(f);if(row.status==='complete')return row;await sleep(2000)}throw new Error('legacy background job completion timed out')}
let failure;
try{
  const status=await fetch(`${base}/runtime-status`,{headers:{'x-dashboard-secret':secret.UPDATE_THOUGHT_SECRET},signal:AbortSignal.timeout(30000)});assert.equal(status.status,200);const runtime=await status.json();assert.equal(runtime.slackRepliesEnabled,false);assert.equal(runtime.writesEnabled,true);
  pass('legacy runtime permits writes with Slack replies suppressed');
  const source=(await sql`SELECT embedding::text AS embedding FROM public.thoughts WHERE embedding IS NOT NULL ORDER BY id LIMIT 1`)[0];assert.ok(source);const vector=JSON.parse(source.embedding);
  const metadata={source:'slack',verification_run:runId,embedding_provider:'openrouter',embedding_model:'openai/text-embedding-3-small',slack_channel:secret.SLACK_CAPTURE_CHANNEL,slack_user:secret.SLACK_CAPTURE_USER_ID};
  // Simulate copied records whose old idempotency keys predate the jobs table.
  for(const [index,f] of fixtures.entries()){
    const key=`slack:${secret.SLACK_CAPTURE_CHANNEL}:${f.ts}`;
    await sql`INSERT INTO public.thoughts(id,content,idempotency_key,metadata,embedding) VALUES(${f.id},${f.content},${key},${JSON.stringify({...metadata,slack_ts:f.ts})}::jsonb,${index===0?JSON.stringify(vector):null}::extensions.vector)`;
    assert.equal((await inspect(f)).job_id,null);
  }
  pass('legacy fixtures seeded with exact IDs and no durable jobs');
  await send(fixtures[0]);const preserved=await complete(fixtures[0]);assert.equal(preserved.attempts,0);assert.equal(preserved.embedding,source.embedding);assert.deepEqual(preserved.metadata,{...metadata,slack_ts:fixtures[0].ts});
  assert.equal((await sql`SELECT count(*)::int AS count FROM public.thoughts WHERE idempotency_key=${`slack:${secret.SLACK_CAPTURE_CHANNEL}:${fixtures[0].ts}`}`)[0].count,1);
  pass('late migrated duplicate gets complete job without reembedding or metadata changes');
  await send(fixtures[0]);const duplicate=await inspect(fixtures[0]);assert.equal(duplicate.job_id,preserved.job_id);assert.equal(duplicate.attempts,0);assert.equal(duplicate.embedding,source.embedding);
  pass('repeated legacy duplicate retains original vector and complete job');
  await send(fixtures[1]);const enriched=await complete(fixtures[1]);assert.ok(enriched.attempts>=1);assert.equal(enriched.dimensions,1536);assert.ok(enriched.embedding);assert.equal(enriched.id,fixtures[1].id);
  pass('legacy missing vector gets durable enrichment on original ID');
}catch(error){failure=error;console.error(`FAIL legacy Slack verification after ${checks.length} checks; ${error?.name || 'Error'}`)}
finally{
  try{
    for(const f of fixtures){const rows=await sql`SELECT j.id FROM public.thought_jobs j JOIN public.thoughts t ON t.id=j.thought_id WHERE t.id=${f.id} AND t.content=${f.content}`;for(const row of rows)jobIds.add(row.id)}await save();
    for(const f of fixtures){for(let n=0;n<95;n++){const rows=await sql`SELECT status FROM public.thought_jobs WHERE thought_id=${f.id}`;if(!rows.length||rows[0].status!=='processing')break;await sleep(2000)}}
    for(const f of fixtures){await sql`DELETE FROM public.thought_jobs j USING public.thoughts t WHERE j.thought_id=${f.id} AND t.id=j.thought_id AND t.content=${f.content}`;await sql`DELETE FROM public.thoughts WHERE id=${f.id} AND content=${f.content}`}
    assert.equal((await sql`SELECT count(*)::int AS count FROM public.thoughts WHERE id=ANY(${fixtures.map(f=>f.id)}::uuid[])`)[0].count,0);await save('cleaned');pass('precise legacy fixtures and jobs cleanup');
  }catch(error){failure ||= error;await save('cleanup-required');console.error('FAIL legacy cleanup; exact IDs retained privately')}
  await writeFile(join(privateDir,`legacy-slack-verification-results-${runId}.json`),JSON.stringify({runId,baseUrl:base,passed:checks,failed:Boolean(failure),manifest},null,2),{mode:0o600});
}
if(failure)process.exitCode=1;else console.log(`Verified ${checks.length} legacy checks; temporary rows removed.`);

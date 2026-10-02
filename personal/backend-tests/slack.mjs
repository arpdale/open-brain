import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { neon } from '@neondatabase/serverless';

const privateDir = resolve(process.env.PRIVATE_DIR || '.local/migration-2026-10-02');
const base = (process.env.BASE_URL || 'https://open-brain-neon.arpdale.workers.dev').replace(/\/$/, '');
const secret = { ...JSON.parse(await readFile(join(privateDir, 'source/function-secrets.json'), 'utf8')), ...process.env };
const sql = neon(process.env.ADMIN_DATABASE_URL || (await readFile(join(privateDir, 'neon-owner-url'), 'utf8')).trim());
const runId = randomUUID(), marker = `slack-migration-verification-${runId}`;
const contents = [0,1,2,3].map(i => `${marker}-${i}: Temporary note about violet binoculars observing Saturn.`);
const ts = `${Math.floor(Date.now()/1000)}.${Math.floor(Math.random()*900000)+100000}`;
const ids = new Set(), jobIds = new Set(), checks = [];
const manifest = join(privateDir, `slack-verification-records-${runId}.json`);
await mkdir(privateDir, {recursive:true,mode:0o700});
async function save(state='running') {
  await writeFile(manifest, JSON.stringify({runId,marker,contents,thoughtIds:[...ids],jobIds:[...jobIds],state,updatedAt:new Date().toISOString()},null,2), {mode:0o600});
}
await save();
const pass = name => {checks.push(name);console.log(`PASS ${name}`)};
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
async function scan() {
  for(const content of contents) {
    const rows=await sql`SELECT t.id,j.id AS job_id FROM public.thoughts t LEFT JOIN public.thought_jobs j ON j.thought_id=t.id WHERE t.content=${content}`;
    for(const r of rows){ids.add(r.id);if(r.job_id)jobIds.add(r.job_id)}
  }
  await save();
}
async function send(payload,{timestamp=Math.floor(Date.now()/1000),bad=false,missing=false}={}) {
  const body=JSON.stringify(payload), stamp=String(timestamp);
  const signature='v0='+createHmac('sha256',secret.SLACK_SIGNING_SECRET).update(`v0:${stamp}:${body}`).digest('hex');
  return fetch(`${base}/ingest-thought`,{method:'POST',headers:{'content-type':'application/json',...(!missing?{'x-slack-request-timestamp':stamp,'x-slack-signature':bad?'v0=invalid':signature}:{})},body,signal:AbortSignal.timeout(30000)});
}
function event(content,extra={}) {
  return {type:'event_callback',event_id:`verification-${runId}`,event:{type:'message',channel:secret.SLACK_CAPTURE_CHANNEL,user:secret.SLACK_CAPTURE_USER_ID,text:content,ts,event_ts:ts,...extra}};
}
async function state(id) {
  const rows=await sql`SELECT j.id,j.thought_id,j.status,j.attempts,j.replied_at,j.enriched_at,j.last_error,t.embedding IS NOT NULL AS embedded,extensions.vector_dims(t.embedding) AS dimensions FROM public.thought_jobs j JOIN public.thoughts t ON t.id=j.thought_id WHERE j.id=${id}`;
  assert.equal(rows.length,1);return rows[0];
}
async function complete(id) {
  const deadline=Date.now()+180000;
  while(Date.now()<deadline){const r=await state(id);if(r.status==='complete')return r;await sleep(2000)}
  throw new Error('background completion timed out');
}
let failure;
try {
  // An accepted synthetic event is forbidden until server-side suppression is attested.
  const config=await fetch(`${base}${process.env.STATUS_PATH || '/runtime-status'}`,{headers:{'x-dashboard-secret':secret.UPDATE_THOUGHT_SECRET},signal:AbortSignal.timeout(30000)});
  assert.equal(config.status,200,'authenticated runtime status unavailable');
  const runtime=await config.json();
  assert.equal(runtime.slackRepliesEnabled,false,'outbound Slack replies must be disabled');
  pass('server-side Slack replies disabled before synthetic events');
  const challenge=`verification-${runId}`;
  const challenged=await send({type:'url_verification',challenge});assert.equal(challenged.status,200);
  const answer=await challenged.text();assert.ok(answer===challenge || JSON.parse(answer).challenge===challenge);
  pass('signed Slack URL challenge');
  for(const options of [{missing:true},{bad:true},{timestamp:Math.floor(Date.now()/1000)-601}]) {
    const denied=await send(event(contents[0]),options);assert.ok([401,403].includes(denied.status));
  }
  await scan();assert.equal(ids.size,0);pass('missing invalid and stale Slack signatures rejected without writes');
  const ignored=[event(contents[1],{channel:'C_VERIFICATION_WRONG_CHANNEL'}),event(contents[2],{user:'U_VERIFICATION_WRONG_USER'}),event(contents[3],{bot_id:'B_VERIFICATION_BOT',subtype:'bot_message'})];
  for(const payload of ignored){const res=await send(payload);assert.equal(res.status,200)}
  await scan();assert.equal(ids.size,0);pass('wrong channel wrong user and bot messages ignored');
  const accepted=event(contents[0]);
  // Drain response but never display it. Scan IDs even if the response is lost.
  let sendError;
  try {const res=await send(accepted);assert.equal(res.status,200);await res.arrayBuffer()}catch(error){sendError=error}
  await scan();if(sendError)throw sendError;
  assert.equal(ids.size,1);assert.equal(jobIds.size,1);
  const id=[...jobIds][0];pass('accepted event atomically persisted one thought and durable job');
  const duplicates=await Promise.all([send(accepted),send(accepted)]);
  for(const res of duplicates)assert.equal(res.status,200);
  await scan();assert.equal(ids.size,1);assert.equal(jobIds.size,1);pass('concurrent duplicate deliveries idempotent');
  const done=await complete(id);assert.equal(done.embedded,true);assert.equal(done.dimensions,1536);assert.ok(done.enriched_at);
  pass('deployed queue enrichment completes with persisted 1536-dimensional vector');
  // Scope recovery mutation solely to our recorded test job, preserving its completed enrichment.
  await sql`UPDATE public.thought_jobs SET status='error',lease_token=NULL,lease_until=now()-interval '1 minute',last_error='verification controlled retry',updated_at=now() WHERE id=${id} AND thought_id=${done.thought_id}`;
  const negative=await fetch(`${base}/recover-jobs`,{method:'POST',headers:{'x-dashboard-secret':'invalid-verification-key'},signal:AbortSignal.timeout(30000)});
  assert.ok([401,403].includes(negative.status));pass('job recovery invalid authentication rejected');
  const recovered=await fetch(`${base}/recover-jobs`,{method:'POST',headers:{'x-dashboard-secret':secret.UPDATE_THOUGHT_SECRET},signal:AbortSignal.timeout(30000)});
  assert.equal(recovered.status,200);
  const final=await complete(id);assert.ok(final.attempts>done.attempts);assert.equal(final.dimensions,1536);
  pass('controlled failed test job recovered by deployed authenticated recovery');
} catch(error) {
  failure=error;console.error(`FAIL Slack verification after ${checks.length} checks; ${error?.name || 'Error'}`);
} finally {
  try {
    await scan();
    // Wait for any live consumer lease before removing rows it might still use.
    for(const id of jobIds){for(let n=0;n<95;n++){const r=await state(id);if(r.status!=='processing')break;await sleep(2000)}}
    for(const id of jobIds) await sql`DELETE FROM public.thought_jobs j USING public.thoughts t WHERE j.id=${id} AND t.id=j.thought_id AND t.content=ANY(${contents}::text[])`;
    for(const id of ids) await sql`DELETE FROM public.thoughts WHERE id=${id} AND content=ANY(${contents}::text[])`;
    assert.equal((await sql`SELECT count(*)::int AS count FROM public.thoughts WHERE content=ANY(${contents}::text[])`)[0].count,0);
    await save('cleaned');pass('precise Slack test jobs and thoughts cleanup');
  }catch(error){failure ||= error;await save('cleanup-required');console.error('FAIL cleanup; exact IDs retained privately')}
  await writeFile(join(privateDir,`slack-verification-results-${runId}.json`),JSON.stringify({runId,baseUrl:base,passed:checks,failed:Boolean(failure),manifest},null,2),{mode:0o600});
}
if(failure)process.exitCode=1;else console.log(`Verified ${checks.length} Slack checks; temporary rows removed.`);

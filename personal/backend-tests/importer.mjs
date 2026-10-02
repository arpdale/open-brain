import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {neon} from '@neondatabase/serverless';
const privateDir=resolve(process.env.PRIVATE_DIR || '.local/migration-2026-10-02');
const base=(process.env.BASE_URL || 'https://open-brain-neon.arpdale.workers.dev').replace(/\/$/,'');
const secret={...JSON.parse(await readFile(join(privateDir,'source/function-secrets.json'),'utf8')),...process.env};
const sql=neon(process.env.ADMIN_DATABASE_URL || (await readFile(join(privateDir,'neon-owner-url'),'utf8')).trim());
const runId=randomUUID(),marker=`importer-verification-${runId}`;
const content=`${marker}: Temporary imported vector preservation fixture.`,edited=`${marker}: Updated imported vector preservation fixture.`;
const ids=new Set(),checks=[],manifest=join(privateDir,`importer-verification-records-${runId}.json`);
await mkdir(privateDir,{recursive:true,mode:0o700});
async function save(state='running'){await writeFile(manifest,JSON.stringify({runId,marker,ids:[...ids],state,updatedAt:new Date().toISOString()},null,2),{mode:0o600})}
await save();
const pass=name=>{checks.push(name);console.log(`PASS ${name}`)};
async function scan(){for(const r of await sql`SELECT id FROM public.thoughts WHERE content=${content} OR content=${edited}`)ids.add(r.id);await save()}
async function post(body,key=secret.MCP_ACCESS_KEY){return fetch(`${base}/import-thought`,{method:'POST',headers:{'content-type':'application/json',...(key?{'x-brain-key':key}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)})}
async function persisted(id){const r=await sql`SELECT id,content,metadata,embedding::text AS embedding,extensions.vector_dims(embedding) AS dimensions FROM public.thoughts WHERE id=${id}`;assert.equal(r.length,1);return r[0]}
let failure;
try{
  // Retain an existing vector entirely in memory; no embedding provider calls.
  const source=(await sql`SELECT embedding::text AS embedding FROM public.thoughts WHERE embedding IS NOT NULL ORDER BY id LIMIT 1`)[0];
  assert.ok(source);const embedding=JSON.parse(source.embedding);assert.equal(embedding.length,1536);
  const metadata={source:'migration_verification',verification_run:runId,embedding_provider:'openrouter',embedding_model:'openai/text-embedding-3-small',topics:['migration-verification']};
  const insert={action:'insert',content,embedding,metadata};
  for(const key of ['', 'invalid-verification-key']){const response=await post(insert,key);assert.ok([401,403].includes(response.status))}
  await scan();assert.equal(ids.size,0);pass('importer missing and invalid auth reject writes');
  const malformed=await post({...insert,embedding:[1,2,3]});assert.equal(malformed.status,400);await scan();assert.equal(ids.size,0);
  pass('importer wrong embedding dimensions rejected');
  let error;
  try{const response=await post(insert);assert.equal(response.status,200);const body=await response.json();assert.ok(body.id);ids.add(body.id);await save()}catch(e){error=e}
  await scan();if(error)throw error;assert.equal(ids.size,1);const id=[...ids][0];
  const row=await persisted(id);assert.equal(row.content,content);assert.deepEqual(row.metadata,metadata);assert.equal(row.embedding,source.embedding);assert.equal(row.dimensions,1536);
  pass('deployed importer persists supplied vector and metadata byte-equivalently');
  const lookup=await post({action:'lookup',key:'verification_run',value:runId});assert.equal(lookup.status,200);
  const looked=(await lookup.json()).rows;assert.equal(looked.length,1);assert.equal(looked[0].id,id);pass('deployed importer metadata lookup');
  const match=await post({action:'match',embedding,threshold:0.1,limit:10,filter:{verification_run:runId}});assert.equal(match.status,200);
  const matched=(await match.json()).rows;assert.equal(matched.length,1);assert.equal(matched[0].id,id);assert.ok(matched[0].similarity>0.999);
  pass('deployed importer vector matching with metadata filter');
  const changed={...metadata,import_update_verified:true};
  const update=await post({action:'update',id,content:edited,embedding,metadata:changed});assert.equal(update.status,200);
  const after=await persisted(id);assert.equal(after.content,edited);assert.deepEqual(after.metadata,changed);assert.equal(after.embedding,source.embedding);
  pass('deployed importer update preserves supplied vector without regeneration');
}catch(error){failure=error;console.error(`FAIL importer verification after ${checks.length} checks; ${error?.name || 'Error'}`)}
finally{
  try{await scan();for(const id of ids)await sql`DELETE FROM public.thoughts WHERE id=${id} AND (content=${content} OR content=${edited})`;
    assert.equal((await sql`SELECT count(*)::int AS count FROM public.thoughts WHERE content=${content} OR content=${edited}`)[0].count,0);await save('cleaned');pass('precise importer fixture cleanup')
  }catch(error){failure ||= error;await save('cleanup-required');console.error('FAIL cleanup; exact IDs retained privately')}
  await writeFile(join(privateDir,`importer-verification-results-${runId}.json`),JSON.stringify({runId,baseUrl:base,passed:checks,failed:Boolean(failure),manifest},null,2),{mode:0o600});
}
if(failure)process.exitCode=1;else console.log(`Verified ${checks.length} importer checks; temporary fixture removed.`);

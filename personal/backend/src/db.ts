import {neon,neonConfig} from '@neondatabase/serverless';
import type {Env,Thought,Job} from './types';
// A transport policy, not mutable request state. Each individual SQL fetch
// gets a fresh timeout, including SQL performed after provider calls.
neonConfig.fetchFunction=(input:Parameters<typeof fetch>[0],init?:Parameters<typeof fetch>[1])=>fetch(input,{...init,signal:AbortSignal.timeout(20000)});
export function db(env:Env){return neon(env.DATABASE_URL)}
export async function matches(env:Env,embedding:number[],threshold:number,limit:number,filter:Record<string,unknown>={}):Promise<Thought[]>{
  const sql=db(env);
  return await sql`select m.* from public.match_thoughts(${JSON.stringify(embedding)}::extensions.vector,${threshold}::double precision,${Math.min(200,limit*4)}::integer,${JSON.stringify(filter)}::jsonb) m join public.thoughts t on t.id=m.id where t.deleted_at is null order by m.similarity desc limit ${limit}` as Thought[];
}
export async function claimSlack(env:Env,text:string,key:string,md:Record<string,unknown>,channel:string,thread:string):Promise<{id:string,status:string}|undefined>{
  const sql=db(env);
  // Both inserts commit together. Concurrent deliveries either win this claim,
  // or see the existing row on the next statement, never a half-created job.
  const rows=await sql`with thought as (insert into public.thoughts(content,idempotency_key,metadata) values (${text},${key},${JSON.stringify(md)}::jsonb) on conflict (idempotency_key) where idempotency_key is not null do nothing returning id), job as (insert into public.thought_jobs(thought_id,channel,thread_ts) select id,${channel},${thread} from thought returning id,status) select * from job`;
  if(rows.length)return rows[0] as {id:string,status:string};
  // Migrated Slack rows predate thought_jobs. Late redelivery must not 500 or
  // repeat completed enrichment/replies. Atomically attach a complete marker
  // to embedded rows, or a pending job to raw rows needing recovery. A racing
  // delivery preserves the winning job's current state through this no-op upsert.
  const existing=await sql`insert into public.thought_jobs(thought_id,channel,thread_ts,status,enriched_at) select t.id,${channel},${thread},case when t.embedding is null then 'pending' else 'complete' end,case when t.embedding is null then null else now() end from public.thoughts t where t.idempotency_key=${key} on conflict(thought_id) do update set thought_id=excluded.thought_id returning id,status`;
  return existing[0] as {id:string,status:string}|undefined;
}
export async function leaseJob(env:Env,id:string):Promise<Job|undefined>{
  const token=crypto.randomUUID(),sql=db(env);
  const rows=await sql`with claimed as (update public.thought_jobs set status='processing',attempts=attempts+1,lease_token=${token}::uuid,lease_until=now()+interval '3 minutes',updated_at=now() where id=${id}::uuid and status<>'complete' and (lease_until is null or lease_until<now()) returning *) select j.*,t.content,t.metadata,t.embedding::text,t.deleted_at from claimed j join public.thoughts t on t.id=j.thought_id`;
  return rows[0] as Job|undefined;
}

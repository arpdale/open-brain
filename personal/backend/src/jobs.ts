import type {Env} from './types';
import {db,leaseJob} from './db';
import {getEmbedding} from './ai';
import {extractSlack} from './slack-meta';
import {uuid} from './security';

export async function processJob(env:Env,id:string):Promise<'complete'|'busy'> {
  uuid(id);
  if(env.WRITES_ENABLED!=='true')throw new Error('writes_disabled');
  const sql=db(env),job=await leaseJob(env,id);
  if(!job){const state=await sql`select status from public.thought_jobs where id=${id}::uuid`;return !state.length||state[0].status==='complete'?'complete':'busy'}
  try {
    if(job.deleted_at){await sql`update public.thought_jobs set status='complete',lease_until=null,last_error='thought_deleted',updated_at=now() where id=${id}::uuid and lease_token=${job.lease_token}::uuid`;return 'complete'}
    if(!job.enriched_at){
      const [embedding,md]=await Promise.all([getEmbedding(env,job.content),extractSlack(env,job.content)]);
      // Condition prevents a concurrent edit or delete from receiving stale vectors.
      const saved=await sql`with updated as (update public.thoughts t set embedding=${JSON.stringify(embedding)}::extensions.vector,metadata=t.metadata||${JSON.stringify(md)}::jsonb where id=${job.thought_id}::uuid and content=${job.content} and deleted_at is null and exists(select 1 from public.thought_jobs j where j.id=${id}::uuid and j.lease_token=${job.lease_token}::uuid and j.lease_until>now()) returning id) update public.thought_jobs set enriched_at=now(),updated_at=now() where id=${id}::uuid and lease_token=${job.lease_token}::uuid and exists(select 1 from updated) returning id`;
      if(!saved.length)throw new Error('stale_job');
      job.metadata={...job.metadata,...md};
    }
    const renewed=await sql`update public.thought_jobs set lease_until=now()+interval '1 minute',updated_at=now() where id=${id}::uuid and lease_token=${job.lease_token}::uuid and status='processing' and lease_until>now() returning id`;
    if(!renewed.length)throw new Error('lease_expired');
    if(env.SLACK_REPLIES_ENABLED==='true'&&!job.replied_at){
      const md=job.metadata;const lines=[md.category?`✓ Captured as *${md.type}* — ${md.category}`:`✓ Captured as *${md.type??'note'}*`];
      for(const [key,label] of [['people','People'],['action_items','Action items'],['dates_mentioned','Dates']]){const values=md[key];if(Array.isArray(values)&&values.length)lines.push(`${label}: ${values.join(key==='action_items'?'; ':', ')}`)}
      const response=await fetch('https://slack.com/api/chat.postMessage',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${env.SLACK_BOT_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({channel:job.channel,thread_ts:job.thread_ts,text:lines.join('\n'),client_msg_id:job.id})});
      if(!response.ok)throw new Error('slack_reply_failed');
      const reply=await response.json() as {ok?:boolean};if(!reply.ok)throw new Error('slack_reply_failed');
    }
    const completed=await sql`update public.thought_jobs set status='complete',replied_at=now(),lease_until=null,last_error=null,updated_at=now() where id=${id}::uuid and lease_token=${job.lease_token}::uuid and status='processing' and lease_until>now() returning id`;
    if(!completed.length)throw new Error('lease_expired');
    return 'complete';
  }catch(error){
    // Persist non-sensitive diagnostics; Queue retry/DLQ retains the delivery.
    await sql`update public.thought_jobs set status='error',last_error='processing_failed',lease_until=null,updated_at=now() where id=${id}::uuid and lease_token=${job.lease_token}::uuid and status='processing'`;
    throw error;
  }
}

export async function consume(batch:MessageBatch<unknown>,env:Env):Promise<void>{
  for(const message of batch.messages){
    try{const body=message.body;if(!body||typeof body!=='object'||!('id' in body)||typeof body.id!=='string'){message.ack();continue}const status=await processJob(env,body.id);if(status==='busy')message.retry({delaySeconds:180});else message.ack()}
    catch{console.error(JSON.stringify({event:'enrichment_retry',attempt:message.attempts}));message.retry({delaySeconds:60})}
  }
}

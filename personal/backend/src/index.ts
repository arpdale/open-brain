import {Hono} from 'hono';
import {StreamableHTTPTransport} from '@hono/mcp';
import type {Env} from './types';
import {createMcp} from './mcp';
import {db,matches,claimSlack} from './db';
import {getEmbedding,EMBEDDING_MODEL,EMBEDDING_PROVIDER} from './ai';
import {consume} from './jobs';
import {boundedBody,objectBody,HttpError,equalSecret,verifySlack,content,uuid,vector,metadata} from './security';

const app=new Hono<{Bindings:Env}>();
const mcpPaths=['/mcp','/functions/v1/open-brain-mcp'];
function writeGate(env:Env){if(env.WRITES_ENABLED!=='true')throw new HttpError(503,'writes temporarily disabled')}
function brainKey(req:Request,env:Env,query=false){const key=req.headers.get('x-brain-key')||(query?new URL(req.url).searchParams.get('key'):null)||'';if(!equalSecret(key,env.MCP_ACCESS_KEY))throw new HttpError(401,'Invalid or missing access key')}
function dashboardKey(req:Request,env:Env){if(!equalSecret(req.headers.get('x-dashboard-secret')??'',env.UPDATE_THOUGHT_SECRET))throw new HttpError(401,'unauthorized')}
app.use('*',async(c,next)=>{
  const origin=c.req.header('origin');
  const allowed=c.env.ALLOWED_ORIGINS.split(',').map(s=>s.trim());
  if(origin&&!allowed.includes(origin))throw new HttpError(403,'origin not allowed');
  if(origin){c.header('Access-Control-Allow-Origin',origin);c.header('Vary','Origin');c.header('Access-Control-Allow-Headers','content-type,x-brain-key,accept,mcp-session-id,mcp-protocol-version');c.header('Access-Control-Allow-Methods','GET,POST,OPTIONS,DELETE');c.header('Access-Control-Expose-Headers','mcp-session-id')}
  c.header('Cache-Control','no-store');c.header('X-Content-Type-Options','nosniff');c.header('Referrer-Policy','no-referrer');
  if(c.req.method==='OPTIONS')return c.text('ok');
  const {success}=await c.env.REQUEST_LIMITER.limit({key:c.req.header('cf-connecting-ip')??'unknown'});
  if(!success)return c.json({error:'rate limit exceeded'},429,{'Retry-After':'60'});
  await next();
});
app.get('/health',c=>c.json({ok:true,backend:'neon',slackRepliesEnabled:c.env.SLACK_REPLIES_ENABLED==='true',writesEnabled:c.env.WRITES_ENABLED==='true'}));
app.get('/runtime-status',c=>{dashboardKey(c.req.raw,c.env);return c.json({slackRepliesEnabled:c.env.SLACK_REPLIES_ENABLED==='true',writesEnabled:c.env.WRITES_ENABLED==='true'})});
for(const path of mcpPaths)app.all(path,async c=>{
  brainKey(c.req.raw,c.env,true);
  const headers=new Headers(c.req.raw.headers);
  if(!headers.get('accept')?.includes('text/event-stream'))headers.set('Accept','application/json, text/event-stream');
  const body=c.req.method==='POST'?await boundedBody(c.req.raw):undefined;
  const req=new Request(c.req.raw.url,{method:c.req.method,headers,body});
  Object.defineProperty(c.req,'raw',{value:req,writable:true});
  const transport=new StreamableHTTPTransport();
  const server=createMcp(c.env);await server.connect(transport);
  return transport.handleRequest(c);
});
app.post('/update-thought',async c=>{
  dashboardKey(c.req.raw,c.env);writeGate(c.env);
  const b=objectBody(await boundedBody(c.req.raw)),id=uuid(b.id),sql=db(c.env);
  if(b.action==='edit'){
    const text=content(b.content);let embedding:number[];
    try{embedding=await getEmbedding(c.env,text)}catch{throw new HttpError(502,'re-embed failed')}
    const rows=await sql`update public.thoughts set content=${text},embedding=${JSON.stringify(embedding)}::extensions.vector,metadata=coalesce(metadata,'{}'::jsonb)||${JSON.stringify({embedding_provider:EMBEDDING_PROVIDER,embedding_model:EMBEDDING_MODEL,edited_at:new Date().toISOString()})}::jsonb where id=${id}::uuid and deleted_at is null returning id`;
    if(!rows.length)throw new HttpError(404,'not found');
  }else if(b.action==='delete')await sql`update public.thoughts set deleted_at=now() where id=${id}::uuid and deleted_at is null`;
  else if(b.action==='undelete')await sql`update public.thoughts set deleted_at=null where id=${id}::uuid`;
  else throw new HttpError(400,'invalid body');
  return c.json({ok:true});
});
app.post('/ingest-thought',async c=>{
  const raw=await boundedBody(c.req.raw);
  if(!await verifySlack(c.req.raw,raw,c.env.SLACK_SIGNING_SECRET))throw new HttpError(401,'invalid signature');
  const b=objectBody(raw);
  if(b.type==='url_verification')return c.json({challenge:b.challenge});
  const event=b.event as Record<string,unknown>|undefined;
  if(!event||event.type!=='message'||event.subtype||event.bot_id||event.channel!==c.env.SLACK_CAPTURE_CHANNEL||event.user!==c.env.SLACK_CAPTURE_USER_ID)return c.text('ok');
  if(typeof event.text!=='string'||!event.text.trim())return c.text('ok');
  const text=content(event.text);if(typeof event.ts!=='string'||!/^\d+\.\d+$/.test(event.ts))throw new HttpError(400,'invalid timestamp');
  const thread=typeof event.thread_ts==='string'?event.thread_ts:event.ts;
  writeGate(c.env);
  const md={source:'slack',slack_channel:c.env.SLACK_CAPTURE_CHANNEL,slack_user:c.env.SLACK_CAPTURE_USER_ID,slack_ts:event.ts,slack_thread_ts:typeof event.thread_ts==='string'?event.thread_ts:null,embedding_provider:EMBEDDING_PROVIDER,embedding_model:EMBEDDING_MODEL};
  const job=await claimSlack(c.env,text,`slack:${c.env.SLACK_CAPTURE_CHANNEL}:${event.ts}`,md,c.env.SLACK_CAPTURE_CHANNEL,thread);
  if(!job)throw new HttpError(500,'claim failed');
  if(job.status!=='complete'){
    // Await durable queue acceptance before acknowledging. If this fails, the
    // job persists pending and Slack retries recover the same UUID.
    await c.env.ENRICHMENT_QUEUE.send({id:job.id});
  }
  return c.json({ok:true,job_id:job.id});
});
app.get('/jobs/:id',async c=>{
  dashboardKey(c.req.raw,c.env);const id=uuid(c.req.param('id')),sql=db(c.env);
  const rows=await sql`select id,thought_id,status,attempts,last_error,enriched_at,replied_at,created_at,updated_at from public.thought_jobs where id=${id}::uuid`;
  if(!rows.length)throw new HttpError(404,'not found');return c.json(rows[0]);
});
app.post('/recover-jobs',async c=>{
  dashboardKey(c.req.raw,c.env);writeGate(c.env);const sql=db(c.env);
  const rows=await sql`select id from public.thought_jobs where status<>'complete' and (lease_until is null or lease_until<now()) order by created_at limit 50`;
  for(const row of rows)await c.env.ENRICHMENT_QUEUE.send({id:row.id});
  return c.json({queued:rows.length});
});
app.post('/import-thought',async c=>{
  brainKey(c.req.raw,c.env);const b=objectBody(await boundedBody(c.req.raw)),sql=db(c.env);
  if(b.action==='lookup'){
    if(typeof b.key!=='string'||!/^[a-zA-Z0-9_]{1,100}$/.test(b.key)||typeof b.value!=='string'||b.value.length>1000)throw new HttpError(400,'invalid lookup');
    return c.json({rows:await sql`select id,content,metadata,created_at from public.thoughts where deleted_at is null and metadata->>${b.key}=${b.value} order by created_at desc limit 100`});
  }
  if(b.action==='match'){
    const embedding=vector(b.embedding),threshold=b.threshold??0.5,limit=b.limit??10;
    if(typeof threshold!=='number'||!Number.isFinite(threshold)||threshold<0||threshold>1||typeof limit!=='number'||!Number.isInteger(limit)||limit<1||limit>50)throw new HttpError(400,'invalid search');
    return c.json({rows:await matches(c.env,embedding,threshold,limit,b.filter===undefined?{}:metadata(b.filter))});
  }
  if(b.action!=='insert'&&b.action!=='update')throw new HttpError(400,'invalid action');
  writeGate(c.env);const text=content(b.content),embedding=vector(b.embedding),md=metadata(b.metadata);
  const rows=b.action==='insert'?await sql`insert into public.thoughts(content,embedding,metadata) values(${text},${JSON.stringify(embedding)}::extensions.vector,${JSON.stringify(md)}::jsonb) returning id`:await sql`update public.thoughts set content=${text},embedding=${JSON.stringify(embedding)}::extensions.vector,metadata=${JSON.stringify(md)}::jsonb where id=${uuid(b.id)}::uuid and deleted_at is null returning id`;
  if(!rows.length)throw new HttpError(404,'not found');return c.json({id:rows[0].id});
});
app.onError((error,c)=>{if(error instanceof HttpError)return c.json({error:error.message},error.status as 400);console.error(JSON.stringify({event:'request_failed',path:c.req.path}));return c.json({error:'request failed'},500)});
export default {fetch:app.fetch,queue:consume} satisfies ExportedHandler<Env>;

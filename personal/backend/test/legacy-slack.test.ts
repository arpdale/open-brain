import {describe,it,expect,vi,beforeEach} from 'vitest';
const mocks=vi.hoisted(()=>({sql:vi.fn()}));
vi.mock('@neondatabase/serverless',()=>({neon:()=>mocks.sql,neonConfig:{}}));
import {claimSlack} from '../src/db';
import worker from '../src/index';
import type {Env} from '../src/types';
describe('late Slack deliveries against migrated rows',()=>{
  beforeEach(()=>mocks.sql.mockReset());
  it('returns existing embedded legacy row as complete rather than missing job',async()=>{
    mocks.sql.mockResolvedValueOnce([]).mockResolvedValueOnce([{id:'existing-job',status:'complete'}]);
    expect(await claimSlack({DATABASE_URL:'test'} as Env,'content','slack:channel:1',{},'channel','1')).toEqual({id:'existing-job',status:'complete'});
  });
  it.each([['complete',0],['pending',1]])('acknowledges late %s delivery and queues only unfinished work',async(status,sends)=>{
    const send=vi.fn(async()=>{});
    const env={DATABASE_URL:'test',SLACK_SIGNING_SECRET:'test-signing-secret',SLACK_CAPTURE_CHANNEL:'channel',SLACK_CAPTURE_USER_ID:'user',WRITES_ENABLED:'true',SLACK_REPLIES_ENABLED:'false',ALLOWED_ORIGINS:'',REQUEST_LIMITER:{limit:async()=>({success:true})},ENRICHMENT_QUEUE:{send}} as Env;
    mocks.sql.mockResolvedValueOnce([]).mockResolvedValueOnce([{id:'existing-job',status}]);
    const ts=String(Math.floor(Date.now()/1000)),body=JSON.stringify({type:'event_callback',event:{type:'message',channel:'channel',user:'user',ts:ts+'.001',text:'legacy fixture'}});
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SLACK_SIGNING_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`v0:${ts}:${body}`)));
    const signature='v0='+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    const response=await worker.fetch(new Request('https://example.test/ingest-thought',{method:'POST',body,headers:{'x-slack-request-timestamp':ts,'x-slack-signature':signature}}),env);
    expect(response.status).toBe(200);expect(await response.json()).toEqual({ok:true,job_id:'existing-job'});expect(send).toHaveBeenCalledTimes(sends);
  });
  it('returns pending legacy job for durable recovery of missing vector',async()=>{
    mocks.sql.mockResolvedValueOnce([]).mockResolvedValueOnce([{id:'recovery-job',status:'pending'}]);
    expect(await claimSlack({DATABASE_URL:'test'} as Env,'content','slack:channel:2',{},'channel','2')).toEqual({id:'recovery-job',status:'pending'});
  });
  it('keeps newly claimed atomic job path to one database statement',async()=>{
    mocks.sql.mockResolvedValueOnce([{id:'new-job',status:'pending'}]);
    expect(await claimSlack({DATABASE_URL:'test'} as Env,'content','slack:channel:3',{},'channel','3')).toEqual({id:'new-job',status:'pending'});
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });
});

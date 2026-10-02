import {describe,it,expect,vi} from 'vitest';
import worker from '../src/index';
import type {Env} from '../src/types';
const env={DATABASE_URL:'postgresql://test:test@db.example.test/test',MCP_ACCESS_KEY:'test-brain-key',UPDATE_THOUGHT_SECRET:'test-update-key',SLACK_SIGNING_SECRET:'test-slack-key',SLACK_REPLIES_ENABLED:'false',WRITES_ENABLED:'false',ALLOWED_ORIGINS:'https://claude.ai',REQUEST_LIMITER:{limit:vi.fn(async()=>({success:true}))}} as Env;
async function request(path:string,init:RequestInit={}){return worker.fetch(new Request(`https://example.test${path}`,init),env)}
describe('route access controls before external calls',()=>{
  it('rejects absent or wrong MCP keys',async()=>{expect((await request('/mcp',{method:'POST',headers:{'x-brain-key':'wrong'},body:'{}'})).status).toBe(401)});
  it('serves actual MCP tools/list with Claude Accept workaround',async()=>{const response=await request('/mcp',{method:'POST',headers:{'x-brain-key':env.MCP_ACCESS_KEY,'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list',params:{}})});expect(response.status).toBe(200);const body=await response.text();for(const name of ['search_thoughts','list_thoughts','thought_stats','capture_thought'])expect(body).toContain(name)});
  it('restricts origins for authenticated browser requests',async()=>{expect((await request('/mcp',{method:'POST',headers:{origin:'https://attacker.test','x-brain-key':env.MCP_ACCESS_KEY},body:'{}'})).status).toBe(403)});
  it('exposes suppression state only through authenticated runtime status',async()=>{expect((await request('/runtime-status')).status).toBe(401);const response=await request('/runtime-status',{headers:{'x-dashboard-secret':env.UPDATE_THOUGHT_SECRET}});expect(await response.json()).toEqual({slackRepliesEnabled:false,writesEnabled:false})});
  it('rejects updates without auth and freezes authorized writes',async()=>{expect((await request('/update-thought',{method:'POST',body:'{}'})).status).toBe(401);expect((await request('/update-thought',{method:'POST',headers:{'x-dashboard-secret':env.UPDATE_THOUGHT_SECRET},body:'{}'})).status).toBe(503)});
  it('rejects unsigned Slack deliveries',async()=>{expect((await request('/ingest-thought',{method:'POST',body:'{}'})).status).toBe(401)});
  it('enforces rate limit before provider/SQL calls',async()=>{vi.mocked(env.REQUEST_LIMITER.limit).mockResolvedValueOnce({success:false});expect((await request('/health')).status).toBe(429)});
});

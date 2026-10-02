import {describe,it,expect} from 'vitest';
import {verifySlack,equalSecret,boundedBody,vector} from '../src/security';
const secret='test-signing-secret';
async function signed(body:string,ts=Math.floor(Date.now()/1000)){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`v0:${ts}:${body}`)));
  const signature='v0='+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return new Request('https://example.test/ingest-thought',{method:'POST',headers:{'x-slack-request-timestamp':String(ts),'x-slack-signature':signature},body});
}
describe('Slack authentication and bounded inputs',()=>{
  it('accepts a genuine signature and rejects body tampering',async()=>{const req=await signed('{"event":1}');expect(await verifySlack(req,'{"event":1}',secret)).toBe(true);expect(await verifySlack(req,'{"event":2}',secret)).toBe(false)});
  it('rejects replayed requests despite a valid signature',async()=>{const req=await signed('{}',Math.floor(Date.now()/1000)-301);expect(await verifySlack(req,'{}',secret)).toBe(false)});
  it('fails closed for absent secrets',()=>{expect(equalSecret('','')).toBe(false);expect(equalSecret('test',undefined)).toBe(false);expect(equalSecret('wrong','test')).toBe(false)});
  it('bounds bodies even without content-length',async()=>{const req=new Request('https://example.test',{method:'POST',body:'x'.repeat(11)});await expect(boundedBody(req,10)).rejects.toThrow('body too large')});
  it('requires exactly1536 finite vector dimensions',()=>{expect(vector(Array(1536).fill(1)).length).toBe(1536);expect(()=>vector(Array(1535).fill(1))).toThrow();expect(()=>vector([...Array(1535).fill(1),NaN])).toThrow()});
});

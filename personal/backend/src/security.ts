export function equalSecret(a:string, b:string|undefined):boolean {
  if (!b || !a) return false;
  const aa=new TextEncoder().encode(a), bb=new TextEncoder().encode(b);
  if (aa.length!==bb.length) return false;
  let diff=0; for (let i=0;i<aa.length;i++) diff|=aa[i]^bb[i];
  return diff===0;
}
export async function verifySlack(req:Request, body:string, secret:string):Promise<boolean> {
  const ts=req.headers.get('x-slack-request-timestamp')??'', sig=req.headers.get('x-slack-signature')??'';
  if (!/^\d+$/.test(ts)||Math.abs(Date.now()/1000-Number(ts))>300) return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`v0:${ts}:${body}`)));
  return equalSecret(sig,'v0='+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''));
}
export class HttpError extends Error {constructor(public status:number,message:string){super(message)}}
export async function boundedBody(req:Request|Response,max=512000):Promise<string> {
  const length=Number(req.headers.get('content-length')??0);
  if(length>max) throw new HttpError(413,'body too large');
  if(!req.body) return '';
  const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new HttpError(413,'body too large')}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength}
  return new TextDecoder().decode(bytes);
}
export function objectBody(text:string):Record<string,unknown> {try{const value:unknown=JSON.parse(text);if(value&&typeof value==='object'&&!Array.isArray(value))return value as Record<string,unknown>}catch{}throw new HttpError(400,'invalid json')}
export function uuid(value:unknown):string {if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))throw new HttpError(400,'invalid id');return value}
export function content(value:unknown):string {if(typeof value!=='string'||!value.trim()||value.length>100000)throw new HttpError(400,'invalid content');return value.trim()}
export function vector(value:unknown):number[] {if(!Array.isArray(value)||value.length!==1536||value.some(x=>typeof x!=='number'||!Number.isFinite(x)))throw new HttpError(400,'invalid embedding');return value as number[]}
export function metadata(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||JSON.stringify(value).length>100000)throw new HttpError(400,'invalid metadata');return value as Record<string,unknown>}

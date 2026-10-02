export type Env = Omit<CloudflareBindings,'WRITES_ENABLED'|'SLACK_REPLIES_ENABLED'> & {
  WRITES_ENABLED:string;
  SLACK_REPLIES_ENABLED:string;
  DATABASE_URL: string;
  OPENROUTER_API_KEY: string;
  MCP_ACCESS_KEY: string;
  UPDATE_THOUGHT_SECRET: string;
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
  SLACK_CAPTURE_CHANNEL: string;
  SLACK_CAPTURE_USER_ID: string;
};
export type Thought = {id:string;content:string;metadata:Record<string,unknown>;created_at:string;similarity?:number};
export type Job = {id:string;thought_id:string;channel:string;thread_ts:string;status:string;lease_token:string;enriched_at:string|null;replied_at:string|null;content:string;metadata:Record<string,unknown>;embedding:string|null;deleted_at:string|null};

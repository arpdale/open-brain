-- Durable Slack enrichment state. Queue messages contain only job UUIDs.
create table if not exists public.thought_jobs (
  id uuid primary key default gen_random_uuid(),
  thought_id uuid not null unique references public.thoughts(id),
  channel text not null,
  thread_ts text not null,
  status text not null default 'pending' check (status in ('pending','processing','complete','error')),
  attempts integer not null default 0,
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  enriched_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists thought_jobs_recovery_idx on public.thought_jobs(status,lease_until,created_at) where status <> 'complete';
alter table public.thought_jobs enable row level security;
create policy runtime_jobs_access on public.thought_jobs to open_brain_runtime using (true) with check (true);
grant select,insert,update on public.thought_jobs to open_brain_runtime;

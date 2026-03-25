create extension if not exists pgcrypto;

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  status text not null default 'sync_pending',
  workspace_path text not null,
  openclaw_agent_id text,
  binding_key text,
  metadata_json jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint agents_status_check check (
    status in ('sync_pending', 'provisioning', 'ready', 'sync_failed')
  ),
  constraint agents_name_length_check check (char_length(trim(name)) >= 2),
  constraint agents_slug_length_check check (char_length(trim(slug)) >= 2),
  constraint agents_workspace_path_unique unique (workspace_path),
  constraint agents_user_slug_unique unique (user_id, slug)
);

create unique index if not exists agents_openclaw_agent_id_unique
  on public.agents (openclaw_agent_id)
  where openclaw_agent_id is not null;

create index if not exists agents_user_created_at_idx
  on public.agents (user_id, created_at desc);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_agents_updated_at on public.agents;
create trigger set_agents_updated_at
before update on public.agents
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.agents enable row level security;

drop policy if exists "agents_select_own" on public.agents;
create policy "agents_select_own"
on public.agents
for select
using (auth.uid() = user_id);

drop policy if exists "agents_insert_own" on public.agents;
create policy "agents_insert_own"
on public.agents
for insert
with check (auth.uid() = user_id);

drop policy if exists "agents_update_own" on public.agents;
create policy "agents_update_own"
on public.agents
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "agents_delete_own" on public.agents;
create policy "agents_delete_own"
on public.agents
for delete
using (auth.uid() = user_id);

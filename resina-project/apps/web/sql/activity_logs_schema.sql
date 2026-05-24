-- Activity Logs Table
-- Records significant admin actions (comment deletions, announcement deletions, etc.)
-- for display in the dashboard Activity Log section.

create extension if not exists pgcrypto;

create table if not exists public.activity_logs (
  id            uuid        primary key default gen_random_uuid(),
  action_type   text        not null,
  actor_name    text        not null default 'System',
  actor_auth_user_id uuid   null,
  actor_role    text        null,
  detail        text        not null,
  reference_id  uuid        null,
  created_at    timestamptz not null default now()
);

alter table public.activity_logs
  add column if not exists actor_auth_user_id uuid null;

alter table public.activity_logs
  add column if not exists actor_role text null;

create index if not exists idx_activity_logs_created_at on public.activity_logs(created_at desc);
create index if not exists idx_activity_logs_actor_role on public.activity_logs(actor_role);

alter table public.activity_logs enable row level security;

-- Authenticated admins can read all log entries
drop policy if exists activity_logs_select_authenticated on public.activity_logs;
create policy activity_logs_select_authenticated
on public.activity_logs
for select
to authenticated
using (true);

-- Authenticated admins can insert log entries
drop policy if exists activity_logs_insert_authenticated on public.activity_logs;
create policy activity_logs_insert_authenticated
on public.activity_logs
for insert
to authenticated
with check (auth.uid() is not null);

do $$
begin
  begin
    alter publication supabase_realtime add table public.activity_logs;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end
$$;

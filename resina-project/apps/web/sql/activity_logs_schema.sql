-- Activity Logs Table
-- Records significant admin actions (comment deletions, announcement deletions, etc.)
-- for display in the dashboard Activity Log section.

create extension if not exists pgcrypto;

create table if not exists public.activity_logs (
  id            uuid        primary key default gen_random_uuid(),
  action_type   text        not null,
  actor_name    text        not null default 'System',
  detail        text        not null,
  reference_id  uuid        null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_activity_logs_created_at on public.activity_logs(created_at desc);

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

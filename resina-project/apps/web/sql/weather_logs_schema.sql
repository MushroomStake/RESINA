create extension if not exists pgcrypto;

create table if not exists public.weather_logs (
  id uuid primary key default gen_random_uuid(),
  temperature integer not null,
  humidity integer,
  heat_index numeric(4,1),
  weather_main text,
  weather_description text,
  intensity text not null,
  signal_no text not null default 'No Signal',
  manual_description text not null default '',
  broadcast_date date not null default ((now() at time zone 'Asia/Manila')::date),
  broadcast_time time not null default ((now() at time zone 'Asia/Manila')::time),
  icon_path text,
  recorded_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.weather_logs add column if not exists manual_description text not null default '';
alter table public.weather_logs add column if not exists broadcast_date date not null default ((now() at time zone 'Asia/Manila')::date);
alter table public.weather_logs add column if not exists broadcast_time time not null default ((now() at time zone 'Asia/Manila')::time);
alter table public.weather_logs add column if not exists humidity integer;
alter table public.weather_logs add column if not exists heat_index numeric(4,1);
alter table public.weather_logs add column if not exists weather_main text;
alter table public.weather_logs add column if not exists weather_description text;
alter table public.weather_logs add column if not exists signal_no text not null default 'No Signal';
alter table public.weather_logs drop column if exists color_coded_warning;

create index if not exists idx_weather_logs_recorded_at on public.weather_logs(recorded_at desc);

alter table public.weather_logs enable row level security;

drop policy if exists weather_logs_select_authenticated on public.weather_logs;
create policy weather_logs_select_authenticated
on public.weather_logs
for select
to authenticated
using (true);

drop policy if exists weather_logs_insert_authenticated on public.weather_logs;
create policy weather_logs_insert_authenticated
on public.weather_logs
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists weather_logs_update_authenticated on public.weather_logs;
create policy weather_logs_update_authenticated
on public.weather_logs
for update
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists weather_logs_delete_authenticated on public.weather_logs;
create policy weather_logs_delete_authenticated
on public.weather_logs
for delete
to authenticated
using (auth.uid() is not null);

do $$
begin
  begin
    alter publication supabase_realtime add table public.weather_logs;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end
$$;

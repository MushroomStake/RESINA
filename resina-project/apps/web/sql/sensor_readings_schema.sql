create table if not exists public.sensor_readings (
  id bigint generated always as identity not null,
  water_level numeric(4, 2) not null,
  status text not null,
  reading_date date not null default ((now() at time zone 'Asia/Manila')::date),
  reading_time time not null default ((now() at time zone 'Asia/Manila')::time),
  created_at timestamp with time zone not null default now(),
  constraint sensor_readings_pkey primary key (id)
) TABLESPACE pg_default;

alter table public.sensor_readings
  add column if not exists reading_date date not null default ((now() at time zone 'Asia/Manila')::date);

alter table public.sensor_readings
  add column if not exists reading_time time not null default ((now() at time zone 'Asia/Manila')::time);

create index if not exists idx_sensor_readings_created_at on public.sensor_readings(created_at desc);

alter table public.sensor_readings enable row level security;

drop policy if exists sensor_readings_select_authenticated on public.sensor_readings;
create policy sensor_readings_select_authenticated
on public.sensor_readings
for select
to authenticated
using (true);

drop policy if exists sensor_readings_insert_authenticated on public.sensor_readings;
create policy sensor_readings_insert_authenticated
on public.sensor_readings
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists sensor_readings_update_authenticated on public.sensor_readings;
create policy sensor_readings_update_authenticated
on public.sensor_readings
for update
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists sensor_readings_delete_authenticated on public.sensor_readings;
create policy sensor_readings_delete_authenticated
on public.sensor_readings
for delete
to authenticated
using (auth.uid() is not null);

do $$
begin
  begin
    alter publication supabase_realtime add table public.sensor_readings;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end
$$;
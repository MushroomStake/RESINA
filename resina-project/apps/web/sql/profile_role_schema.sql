-- RESINA admin profile + personnel role table schema
-- Run this in Supabase SQL Editor

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  first_name text,
  middle_name text,
  last_name text,
  full_name text not null,
  email text not null unique,
  phone_number text,
  address_purok text,
  resident_status text not null check (resident_status in ('resident', 'non_resident')) default 'resident',
  profile_avatar text,
  role text not null check (role in ('admin', 'member', 'user')) default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists address_purok text;

alter table public.profiles
  add column if not exists resident_status text not null default 'resident';

alter table public.profiles
  add column if not exists profile_avatar text;

alter table public.profiles
  add column if not exists phone_number text;

alter table public.profiles
  drop constraint if exists profiles_resident_status_check;

alter table public.profiles
  add constraint profiles_resident_status_check check (resident_status in ('resident', 'non_resident'));

-- Keep existing databases in sync with the role policy above.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'member', 'user'));

alter table public.profiles
  alter column role set default 'user';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Read profiles when authenticated
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

-- Users can update their own profile row
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

-- Users can insert their own profile row
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = auth_user_id);

-- IMPORTANT:
-- Do not use a policy that queries public.profiles from within a profiles policy,
-- because it can recurse through RLS and trigger PostgREST 500 errors.
drop policy if exists "profiles_admin_all" on public.profiles;

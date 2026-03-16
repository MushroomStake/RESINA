-- RESINA announcements + media + comments schema
-- Run this in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  alert_level text not null check (alert_level in ('normal', 'warning', 'emergency')) default 'normal',
  posted_by_auth_user_id uuid,
  posted_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcement_media (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  file_name text not null,
  public_url text not null,
  storage_path text not null unique,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_announcement_media_announcement_id
  on public.announcement_media(announcement_id);

-- Comment table for soon-to-be-used resident feedback.
create table if not exists public.announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  commenter_auth_user_id uuid,
  commenter_name text not null,
  comment_body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_announcement_comments_announcement_id
  on public.announcement_comments(announcement_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_announcements_updated_at on public.announcements;
create trigger trg_announcements_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;
alter table public.announcement_media enable row level security;
alter table public.announcement_comments enable row level security;

-- Announcements policies
-- Keep it authenticated-only for now; tighten to role-based later if needed.
drop policy if exists "announcements_select_authenticated" on public.announcements;
create policy "announcements_select_authenticated"
on public.announcements
for select
to authenticated
using (true);

drop policy if exists "announcements_insert_authenticated" on public.announcements;
create policy "announcements_insert_authenticated"
on public.announcements
for insert
to authenticated
with check (true);

drop policy if exists "announcements_update_authenticated" on public.announcements;
create policy "announcements_update_authenticated"
on public.announcements
for update
to authenticated
using (true)
with check (true);

drop policy if exists "announcements_delete_authenticated" on public.announcements;
create policy "announcements_delete_authenticated"
on public.announcements
for delete
to authenticated
using (true);

-- Media policies
drop policy if exists "announcement_media_select_authenticated" on public.announcement_media;
create policy "announcement_media_select_authenticated"
on public.announcement_media
for select
to authenticated
using (true);

drop policy if exists "announcement_media_insert_authenticated" on public.announcement_media;
create policy "announcement_media_insert_authenticated"
on public.announcement_media
for insert
to authenticated
with check (true);

drop policy if exists "announcement_media_delete_authenticated" on public.announcement_media;
create policy "announcement_media_delete_authenticated"
on public.announcement_media
for delete
to authenticated
using (true);

-- Comment policies
drop policy if exists "announcement_comments_select_authenticated" on public.announcement_comments;
create policy "announcement_comments_select_authenticated"
on public.announcement_comments
for select
to authenticated
using (true);

drop policy if exists "announcement_comments_insert_authenticated" on public.announcement_comments;
create policy "announcement_comments_insert_authenticated"
on public.announcement_comments
for insert
to authenticated
with check (true);

drop policy if exists "announcement_comments_delete_authenticated" on public.announcement_comments;
create policy "announcement_comments_delete_authenticated"
on public.announcement_comments
for delete
to authenticated
using (true);

-- Create public bucket used by the announcements page for uploaded images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'announcement-images',
  'announcement-images',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies for bucket access.
drop policy if exists "announcement_images_public_read" on storage.objects;
create policy "announcement_images_public_read"
on storage.objects
for select
to public
using (bucket_id = 'announcement-images');

drop policy if exists "announcement_images_auth_insert" on storage.objects;
create policy "announcement_images_auth_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'announcement-images');

drop policy if exists "announcement_images_auth_update" on storage.objects;
create policy "announcement_images_auth_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'announcement-images')
with check (bucket_id = 'announcement-images');

drop policy if exists "announcement_images_auth_delete" on storage.objects;
create policy "announcement_images_auth_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'announcement-images');

-- Seed sample announcement + sample comment for testing the comments table.
with seed_announcement as (
  insert into public.announcements (
    title,
    description,
    alert_level,
    posted_by_name
  )
  values (
    'Sample Community Advisory',
    'This is a seeded announcement for initial testing of comments and media workflows.',
    'normal',
    'System Seeder'
  )
  returning id
)
insert into public.announcement_comments (
  announcement_id,
  commenter_name,
  comment_body
)
select
  id,
  'Maria Dela Cruz',
  'Thank you for the update. We will share this with our neighborhood group.'
from seed_announcement;

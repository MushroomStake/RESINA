create extension if not exists pgcrypto;

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sensor', 'comment')),
  title text not null,
  message text not null,
  target_url text not null,
  source_table text not null,
  source_record_id text not null,
  thread_key text not null,
  actor_name text not null default '',
  is_read boolean not null default false,
  read_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (source_table, source_record_id)
);

alter table public.admin_notifications
  add column if not exists thread_key text not null default '';

alter table public.admin_notifications
  add column if not exists is_read boolean not null default false;

alter table public.admin_notifications
  add column if not exists read_at timestamptz null;

alter table public.admin_notifications
  add column if not exists actor_name text not null default '';

create index if not exists idx_admin_notifications_created_at
  on public.admin_notifications(created_at desc);

create index if not exists idx_admin_notifications_kind
  on public.admin_notifications(kind);

create index if not exists idx_admin_notifications_thread_key
  on public.admin_notifications(thread_key);

create index if not exists idx_admin_notifications_unread
  on public.admin_notifications(kind, thread_key, is_read);

alter table public.admin_notifications enable row level security;

drop policy if exists admin_notifications_select_authenticated on public.admin_notifications;
create policy admin_notifications_select_authenticated
on public.admin_notifications
for select
to authenticated
using (true);

drop policy if exists admin_notifications_update_authenticated on public.admin_notifications;
create policy admin_notifications_update_authenticated
on public.admin_notifications
for update
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

create or replace function public.create_sensor_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_notifications (
    kind,
    title,
    message,
    target_url,
    source_table,
    source_record_id,
    thread_key,
    actor_name
  ) values (
    'sensor',
    'New sensor reading',
    case
      when new.water_level is null then format('Status updated (%s).', coalesce(new.status, 'Unknown'))
      else format('Water level is %s m (%s).', to_char(new.water_level, 'FM999990.00'), coalesce(new.status, 'Unknown'))
    end,
    '/admin/history?recordId=' || new.id::text,
    'sensor_readings',
    new.id::text,
    new.id::text,
    ''
  )
  on conflict (source_table, source_record_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_sensor_readings_notification on public.sensor_readings;
create trigger trg_sensor_readings_notification
after insert on public.sensor_readings
for each row execute function public.create_sensor_notification();

create or replace function public.create_comment_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  announcement_title text;
  existing_unread_count integer;
begin
  select coalesce(title, 'Announcement')
    into announcement_title
    from public.announcements
   where id = new.announcement_id;

  select count(*)
    into existing_unread_count
    from public.admin_notifications
   where kind = 'comment'
     and thread_key = new.announcement_id::text
     and is_read = false;

  if existing_unread_count > 0 then
    with latest_unread as (
      select id
        from public.admin_notifications
       where kind = 'comment'
         and thread_key = new.announcement_id::text
         and is_read = false
       order by created_at desc
       limit 1
    )
    update public.admin_notifications
       set title = 'New comments on ' || coalesce(announcement_title, 'Announcement'),
         message = coalesce(new.commenter_name, 'Someone') || ' and others commented on ' || coalesce(announcement_title, 'Announcement') || '.',
           target_url = '/admin/announcements?announcementId=' || new.announcement_id::text || '&openComments=1',
           actor_name = coalesce(new.commenter_name, 'Someone'),
           created_at = now()
      from latest_unread
     where public.admin_notifications.id = latest_unread.id;

    return new;
  end if;

  insert into public.admin_notifications (
    kind,
    title,
    message,
    target_url,
    source_table,
    source_record_id,
    thread_key,
    actor_name
  ) values (
    'comment',
    'New comment on ' || coalesce(announcement_title, 'Announcement'),
    coalesce(new.commenter_name, 'Someone') || ' commented on ' || coalesce(announcement_title, 'Announcement') || '.',
    '/admin/announcements?announcementId=' || new.announcement_id::text || '&openComments=1',
    'announcement_comments',
    new.id::text,
    new.announcement_id::text,
    coalesce(new.commenter_name, 'Someone')
  )
  on conflict (source_table, source_record_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_announcement_comments_notification on public.announcement_comments;
create trigger trg_announcement_comments_notification
after insert on public.announcement_comments
for each row execute function public.create_comment_notification();

do $$
begin
  begin
    alter publication supabase_realtime add table public.admin_notifications;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end
$$;
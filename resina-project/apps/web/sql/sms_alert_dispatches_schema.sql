create extension if not exists pgcrypto;

create table if not exists public.sms_alert_dispatches (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'unisms',
  source_table text not null,
  source_record_id text not null,
  alert_level text not null,
  status text not null,
  recipient_count integer not null default 0,
  provider_message_id text null,
  error_message text null,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sms_alert_dispatches_source_record_unique unique (source_table, source_record_id)
);

create index if not exists idx_sms_alert_dispatches_created_at
  on public.sms_alert_dispatches(created_at desc);
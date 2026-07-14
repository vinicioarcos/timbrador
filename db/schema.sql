-- PostgreSQL 15+

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  timezone text not null default 'America/Guayaquil',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type activity_type as enum ('CLASS', 'MANAGEMENT');
create type session_status as enum ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
create type punch_kind as enum ('ENTRY', 'EXIT');
create type punch_result as enum ('SUCCESS', 'REJECTED', 'ERROR');

create table if not exists schedule_items (
  id text primary key,
  user_id uuid references users(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 5),
  start_time time not null,
  end_time time not null,
  activity_type activity_type not null,
  title text not null,
  course_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists session_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  schedule_item_id text references schedule_items(id),
  scheduled_date date not null,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  status session_status not null default 'SCHEDULED',
  entry_at timestamptz,
  exit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_active_session_per_user
on session_instances(user_id)
where status = 'ACTIVE';

create table if not exists punch_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references session_instances(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  kind punch_kind not null,
  scheduled_at timestamptz not null,
  attempted_at timestamptz not null default now(),
  source text not null,
  result punch_result not null,
  external_reference text,
  idempotency_key text not null unique,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists reminder_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references session_instances(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  acknowledged_at timestamptz,
  status text not null default 'PENDING',
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  user_id uuid references users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  created_at timestamptz not null default now(),
  detail jsonb not null default '{}'::jsonb
);

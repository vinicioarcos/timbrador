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

-- "create type" no admite "if not exists" (Postgres < 18); se envuelve en un
-- bloque DO para que la migración sea reproducible (rerun seguro).
do $$ begin
  create type activity_type as enum ('CLASS', 'MANAGEMENT');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type session_status as enum ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type punch_kind as enum ('ENTRY', 'EXIT');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type punch_result as enum ('SUCCESS', 'REJECTED', 'ERROR');
exception when duplicate_object then null;
end $$;

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

-- T-015: a lo sumo una instancia por bloque de horario y día. clockIn
-- transiciona la fila SCHEDULED existente a ACTIVE en vez de insertar una
-- fila nueva (ver lib/punch-store.ts createActiveSession), así que nunca
-- debería haber dos filas para el mismo schedule_item_id + scheduled_date.
create unique index if not exists one_session_instance_per_item_per_day
on session_instances(schedule_item_id, scheduled_date);

create table if not exists punch_events (
  id uuid primary key default gen_random_uuid(),
  -- session_id es nullable: BR-010 exige auditar todo intento, incluidos los
  -- rechazados antes de que exista una sesión (actividad inexistente, salida
  -- sin sesión activa, etc.). schedule_item_id se guarda aparte porque en esos
  -- casos no hay session_id del cual derivarlo.
  session_id uuid references session_instances(id) on delete cascade,
  schedule_item_id text references schedule_items(id),
  user_id uuid not null references users(id) on delete cascade,
  kind punch_kind not null,
  scheduled_at timestamptz,
  attempted_at timestamptz not null default now(),
  source text not null,
  result punch_result not null,
  external_reference text,
  idempotency_key text not null unique,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

-- "create table if not exists" no altera una tabla ya creada por una corrida
-- anterior de la migración (p. ej. antes de que existieran estas columnas).
-- Estos ALTER son idempotentes: seguros de correr tanto en una base nueva
-- como en una que ya tenía punch_events con la forma anterior.
alter table punch_events add column if not exists schedule_item_id text references schedule_items(id);
alter table punch_events alter column session_id drop not null;
alter table punch_events alter column scheduled_at drop not null;

-- T-016: corrección manual verificada de una timbrada ya registrada.
-- punch_events sigue siendo append-only (nunca se edita ni se borra una fila
-- suya); una corrección es una fila separada que referencia el evento
-- original y guarda la hora corregida + el motivo. Un evento admite a lo
-- sumo una corrección (unique en punch_event_id): si hace falta corregir de
-- nuevo, es una limitación conocida del MVP, no un intento de mantener un
-- historial de revisiones.
create table if not exists punch_corrections (
  id uuid primary key default gen_random_uuid(),
  punch_event_id uuid not null unique references punch_events(id) on delete cascade,
  corrected_at timestamptz not null,
  reason text not null,
  corrected_by uuid not null references users(id),
  created_at timestamptz not null default now()
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

-- T-005: id del mensaje de QStash que entregará este aviso (para trazabilidad/debug).
alter table reminder_events add column if not exists qstash_message_id text;

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

import { query, type Queryable } from "@/lib/db";
import { guayaquilTimestamp, scheduleItems } from "@/lib/schedule";

export type PunchKind = "ENTRY" | "EXIT";
export type PunchOutcomeResult = "SUCCESS" | "REJECTED" | "ERROR";
export type SessionStatus = "ACTIVE" | "COMPLETED";

export type SessionInstance = {
  id: string;
  userId: string;
  scheduleItemId: string;
  scheduledDate: string;
  status: SessionStatus;
  entryAt: string | null;
  exitAt: string | null;
};

export type PunchAuditEntry = {
  id: string;
  idempotencyKey: string;
  userId: string;
  scheduleItemId: string;
  sessionId: string | null;
  kind: PunchKind;
  scheduledAt: string;
  attemptedAt: string;
  source: string;
  result: PunchOutcomeResult;
  errorMessage?: string;
};

// Postgres error 23505 = unique_violation. Se usa para distinguir una
// condición de carrera real (dos requests concurrentes) de otros errores.
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === UNIQUE_VIOLATION;
}

const userUuidCache = new Map<string, string>();

async function resolveUserUuid(username: string): Promise<string> {
  const cached = userUuidCache.get(username);
  if (cached) return cached;
  const result = await query<{ id: string }>("select id from users where username = $1", [username]);
  if (result.rows.length === 0) {
    throw new Error(`Usuario '${username}' no existe en la base de datos. Corre "npm run db:migrate".`);
  }
  userUuidCache.set(username, result.rows[0].id);
  return result.rows[0].id;
}

type SessionRow = {
  id: string;
  schedule_item_id: string;
  scheduled_date: string;
  status: string;
  entry_at: string | null;
  exit_at: string | null;
};

function mapSession(row: SessionRow, username: string): SessionInstance {
  return {
    id: row.id,
    userId: username,
    scheduleItemId: row.schedule_item_id,
    scheduledDate: row.scheduled_date,
    status: row.status === "ACTIVE" ? "ACTIVE" : "COMPLETED",
    entryAt: row.entry_at,
    exitAt: row.exit_at,
  };
}

type AuditRow = {
  id: string;
  idempotency_key: string;
  schedule_item_id: string | null;
  session_id: string | null;
  kind: PunchKind;
  scheduled_at: string | null;
  attempted_at: string;
  source: string;
  result: PunchOutcomeResult;
  error_message: string | null;
};

function mapAudit(row: AuditRow, username: string): PunchAuditEntry {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    userId: username,
    scheduleItemId: row.schedule_item_id ?? "",
    sessionId: row.session_id,
    kind: row.kind,
    scheduledAt: row.scheduled_at ?? "",
    attemptedAt: row.attempted_at,
    source: row.source,
    result: row.result,
    errorMessage: row.error_message ?? undefined,
  };
}

export async function findActiveSession(userId: string): Promise<SessionInstance | null> {
  const userUuid = await resolveUserUuid(userId);
  const result = await query<SessionRow>(
    `select id, schedule_item_id, scheduled_date::text, status, entry_at, exit_at
     from session_instances where user_id = $1 and status = 'ACTIVE'
     limit 1`,
    [userUuid],
  );
  return result.rows.length ? mapSession(result.rows[0], userId) : null;
}

export async function findSessionById(userId: string, sessionId: string): Promise<SessionInstance | null> {
  const userUuid = await resolveUserUuid(userId);
  const result = await query<SessionRow>(
    `select id, schedule_item_id, scheduled_date::text, status, entry_at, exit_at
     from session_instances where user_id = $1 and id = $2`,
    [userUuid, sessionId],
  );
  return result.rows.length ? mapSession(result.rows[0], userId) : null;
}

export type CreateActiveSessionInput = {
  userId: string;
  scheduleItemId: string;
  scheduledDate: string;
  entryAt: string;
};

// BR-004 a nivel de base de datos: el índice único parcial
// one_active_session_per_user (ver db/schema.sql) es la garantía real bajo
// concurrencia. Si dos requests llegan casi al mismo tiempo, el segundo insert
// viola el índice y se traduce en null (rechazo), no en un error sin manejar.
//
// Si se pasa `client` (dentro de una transacción de lib/punch-commands.ts), el
// insert se envuelve en un SAVEPOINT: así, si viola el índice, se puede volver
// a ese punto y seguir usando la misma transacción para registrar el rechazo
// en la auditoría, sin que el error deje la transacción entera inutilizable
// y sin dejar nunca una sesión activa huérfana (creada pero sin auditoría).
export async function createActiveSession(input: CreateActiveSessionInput, client?: Queryable): Promise<SessionInstance | null> {
  const userUuid = await resolveUserUuid(input.userId);
  const item = scheduleItems.find((candidate) => candidate.id === input.scheduleItemId);
  const scheduledStart = item ? guayaquilTimestamp(input.scheduledDate, item.start) : input.entryAt;
  const scheduledEnd = item ? guayaquilTimestamp(input.scheduledDate, item.end) : input.entryAt;

  if (client) await query("savepoint create_active_session", [], client);
  try {
    const result = await query<SessionRow>(
      `insert into session_instances (user_id, schedule_item_id, scheduled_date, scheduled_start, scheduled_end, status, entry_at)
       values ($1, $2, $3, $4, $5, 'ACTIVE', $6)
       returning id, schedule_item_id, scheduled_date::text, status, entry_at, exit_at`,
      [userUuid, input.scheduleItemId, input.scheduledDate, scheduledStart, scheduledEnd, input.entryAt],
      client,
    );
    if (client) await query("release savepoint create_active_session", [], client);
    return mapSession(result.rows[0], input.userId);
  } catch (error) {
    if (isUniqueViolation(error)) {
      if (client) await query("rollback to savepoint create_active_session", [], client);
      return null;
    }
    throw error;
  }
}

export async function closeSession(session: SessionInstance, exitAt: string, client?: Queryable): Promise<SessionInstance> {
  const userUuid = await resolveUserUuid(session.userId);
  const result = await query<SessionRow>(
    `update session_instances
     set status = 'COMPLETED', exit_at = $3, updated_at = now()
     where id = $1 and user_id = $2
     returning id, schedule_item_id, scheduled_date::text, status, entry_at, exit_at`,
    [session.id, userUuid, exitAt],
    client,
  );
  return mapSession(result.rows[0], session.userId);
}

export async function getAuditByIdempotencyKey(key: string): Promise<PunchAuditEntry | null> {
  const result = await query<AuditRow & { username: string }>(
    `select pe.id, pe.idempotency_key, pe.schedule_item_id, pe.session_id, pe.kind,
            pe.scheduled_at, pe.attempted_at, pe.source, pe.result, pe.error_message,
            u.username
     from punch_events pe
     join users u on u.id = pe.user_id
     where pe.idempotency_key = $1`,
    [key],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return mapAudit(row, row.username);
}

export type RecordAuditInput = Omit<PunchAuditEntry, "id">;

// Idempotencia bajo concurrencia real: si dos requests con la misma
// idempotencyKey llegan casi al mismo tiempo, el segundo insert viola la
// unicidad de idempotency_key; en vez de fallar, se relee y devuelve la fila
// que sí se insertó, para que el llamador reciba un resultado consistente.
// Mismo uso de SAVEPOINT que createActiveSession cuando corre dentro de una
// transacción explícita (ver lib/punch-commands.ts).
export async function recordAudit(entry: RecordAuditInput, client?: Queryable): Promise<PunchAuditEntry> {
  const userUuid = await resolveUserUuid(entry.userId);
  if (client) await query("savepoint record_audit", [], client);
  try {
    const result = await query<AuditRow>(
      `insert into punch_events (idempotency_key, schedule_item_id, session_id, user_id, kind, scheduled_at, attempted_at, source, result, error_message)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning id, idempotency_key, schedule_item_id, session_id, kind, scheduled_at, attempted_at, source, result, error_message`,
      [
        entry.idempotencyKey,
        entry.scheduleItemId || null,
        entry.sessionId,
        userUuid,
        entry.kind,
        entry.scheduledAt || null,
        entry.attemptedAt,
        entry.source,
        entry.result,
        entry.errorMessage ?? null,
      ],
      client,
    );
    if (client) await query("release savepoint record_audit", [], client);
    return mapAudit(result.rows[0], entry.userId);
  } catch (error) {
    if (isUniqueViolation(error)) {
      if (client) await query("rollback to savepoint record_audit", [], client);
      const existing = await getAuditByIdempotencyKey(entry.idempotencyKey);
      if (existing) return existing;
    }
    throw error;
  }
}

export async function listAudit(userId: string, options?: { date?: string }): Promise<PunchAuditEntry[]> {
  const userUuid = await resolveUserUuid(userId);
  const result = options?.date
    ? await query<AuditRow>(
        `select pe.id, pe.idempotency_key, pe.schedule_item_id, pe.session_id, pe.kind,
                pe.scheduled_at, pe.attempted_at, pe.source, pe.result, pe.error_message
         from punch_events pe
         where pe.user_id = $1 and (pe.attempted_at at time zone 'America/Guayaquil')::date = $2::date
         order by pe.attempted_at desc`,
        [userUuid, options.date],
      )
    : await query<AuditRow>(
        `select pe.id, pe.idempotency_key, pe.schedule_item_id, pe.session_id, pe.kind,
                pe.scheduled_at, pe.attempted_at, pe.source, pe.result, pe.error_message
         from punch_events pe
         where pe.user_id = $1
         order by pe.attempted_at desc`,
        [userUuid],
      );
  return result.rows.map((row) => mapAudit(row, userId));
}

// "Historial por fecha" (T-004): sesiones agrupadas por scheduled_date.
export async function listSessionsByDate(userId: string, date: string): Promise<SessionInstance[]> {
  const userUuid = await resolveUserUuid(userId);
  const result = await query<SessionRow>(
    `select id, schedule_item_id, scheduled_date::text, status, entry_at, exit_at
     from session_instances
     where user_id = $1 and scheduled_date = $2::date
     order by scheduled_date, entry_at nulls last`,
    [userUuid, date],
  );
  return result.rows.map((row) => mapSession(row, userId));
}

// "Creación de instancias diarias" (T-004): materializa una fila SCHEDULED por
// cada bloque activo del día de la semana de `date`, si todavía no existe una
// instancia (de cualquier estado) para ese schedule_item_id + scheduled_date.
//
// Nota de diseño (pendiente, no resuelta aquí): `session_instances` no tiene
// una restricción única (schedule_item_id, scheduled_date) porque
// `createActiveSession` (T-006, ya mezclado) siempre inserta una fila nueva en
// ACTIVE en vez de transicionar una fila SCHEDULED existente. Agregar esa
// restricción ahora rompería ese flujo. Reconciliar ambos (transicionar
// SCHEDULED -> ACTIVE en clockIn en vez de insertar una fila nueva) es un
// cambio de comportamiento de T-006 y queda fuera de alcance de T-004; ver
// handoff para la recomendación de un task de seguimiento.
export async function materializeDailySessions(userId: string, date: string, weekday: number): Promise<number> {
  const userUuid = await resolveUserUuid(userId);
  const result = await query(
    `insert into session_instances (user_id, schedule_item_id, scheduled_date, scheduled_start, scheduled_end, status)
     select si.user_id, si.id, $2::date,
            ($2::date::text || 'T' || si.start_time::text || '-05:00')::timestamptz,
            ($2::date::text || 'T' || si.end_time::text || '-05:00')::timestamptz,
            'SCHEDULED'
     from schedule_items si
     where si.user_id = $1 and si.active = true and si.day_of_week = $3
       and not exists (
         select 1 from session_instances existing
         where existing.schedule_item_id = si.id and existing.scheduled_date = $2::date
       )`,
    [userUuid, date, weekday],
  );
  return result.rowCount ?? 0;
}

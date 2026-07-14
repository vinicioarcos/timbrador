import { randomUUID } from "node:crypto";

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

// Almacén en memoria del proceso. Reemplazar por el repositorio PostgreSQL de
// T-004 (ver db/schema.sql: session_instances, punch_events) sin cambiar el
// contrato de lib/punch-commands.ts. Se reinicia con cada reinicio del proceso.
const sessionsByUser = new Map<string, SessionInstance[]>();
const auditByIdempotencyKey = new Map<string, PunchAuditEntry>();
const auditLog: PunchAuditEntry[] = [];

export function findActiveSession(userId: string): SessionInstance | null {
  const sessions = sessionsByUser.get(userId) ?? [];
  return sessions.find((session) => session.status === "ACTIVE") ?? null;
}

export function findSessionById(userId: string, sessionId: string): SessionInstance | null {
  const sessions = sessionsByUser.get(userId) ?? [];
  return sessions.find((session) => session.id === sessionId) ?? null;
}

export function createActiveSession(input: {
  userId: string;
  scheduleItemId: string;
  scheduledDate: string;
  entryAt: string;
}): SessionInstance {
  const session: SessionInstance = {
    id: randomUUID(),
    userId: input.userId,
    scheduleItemId: input.scheduleItemId,
    scheduledDate: input.scheduledDate,
    status: "ACTIVE",
    entryAt: input.entryAt,
    exitAt: null,
  };
  const list = sessionsByUser.get(input.userId) ?? [];
  list.push(session);
  sessionsByUser.set(input.userId, list);
  return session;
}

export function closeSession(session: SessionInstance, exitAt: string): SessionInstance {
  session.status = "COMPLETED";
  session.exitAt = exitAt;
  return session;
}

export function getAuditByIdempotencyKey(key: string): PunchAuditEntry | null {
  return auditByIdempotencyKey.get(key) ?? null;
}

export function recordAudit(entry: Omit<PunchAuditEntry, "id">): PunchAuditEntry {
  const full: PunchAuditEntry = { id: randomUUID(), ...entry };
  auditByIdempotencyKey.set(full.idempotencyKey, full);
  auditLog.unshift(full);
  return full;
}

export function listAudit(userId: string): PunchAuditEntry[] {
  return auditLog.filter((entry) => entry.userId === userId);
}

export function _resetStoreForTests(): void {
  sessionsByUser.clear();
  auditByIdempotencyKey.clear();
  auditLog.length = 0;
}

import { guayaquilDateString, scheduleItems } from "@/lib/schedule";
import {
  closeSession,
  createActiveSession,
  findActiveSession,
  findSessionById,
  getAuditByIdempotencyKey,
  recordAudit,
  type PunchAuditEntry,
  type SessionInstance,
} from "@/lib/punch-store";

export type ClockCommand = {
  userId: string;
  scheduleItemId: string;
  idempotencyKey: string;
  source?: string;
  now?: Date;
};

export type ClockOutcome =
  | { ok: true; session: SessionInstance; audit: PunchAuditEntry }
  | { ok: false; reason: string; audit: PunchAuditEntry };

function toOutcome(audit: PunchAuditEntry): ClockOutcome {
  if (audit.result === "SUCCESS" && audit.sessionId) {
    const session = findSessionById(audit.userId, audit.sessionId);
    if (session) return { ok: true, session, audit };
  }
  return { ok: false, reason: audit.errorMessage ?? "Solicitud rechazada.", audit };
}

// BR-009: repetir una solicitud con la misma idempotencyKey no crea registros
// nuevos; se devuelve el resultado de la primera vez, sin volver a tocar el store.
function replay(idempotencyKey: string): ClockOutcome | null {
  const existing = getAuditByIdempotencyKey(idempotencyKey);
  return existing ? toOutcome(existing) : null;
}

export function clockIn(command: ClockCommand): ClockOutcome {
  const replayed = replay(command.idempotencyKey);
  if (replayed) return replayed;

  const now = command.now ?? new Date();
  const source = command.source ?? "dashboard";
  const item = scheduleItems.find((candidate) => candidate.id === command.scheduleItemId);

  if (!item) {
    const audit = recordAudit({
      idempotencyKey: command.idempotencyKey,
      userId: command.userId,
      scheduleItemId: command.scheduleItemId,
      sessionId: null,
      kind: "ENTRY",
      scheduledAt: "",
      attemptedAt: now.toISOString(),
      source,
      result: "ERROR",
      errorMessage: "La actividad de horario no existe.",
    });
    return { ok: false, reason: audit.errorMessage!, audit };
  }

  // BR-004: máximo una sesión activa por usuario.
  const activeSession = findActiveSession(command.userId);
  if (activeSession) {
    const audit = recordAudit({
      idempotencyKey: command.idempotencyKey,
      userId: command.userId,
      scheduleItemId: item.id,
      sessionId: activeSession.id,
      kind: "ENTRY",
      scheduledAt: item.start,
      attemptedAt: now.toISOString(),
      source,
      result: "REJECTED",
      errorMessage: `Ya existe una sesión activa (${activeSession.scheduleItemId}). Cierra la actividad anterior primero.`,
    });
    return { ok: false, reason: audit.errorMessage!, audit };
  }

  const session = createActiveSession({
    userId: command.userId,
    scheduleItemId: item.id,
    scheduledDate: guayaquilDateString(now),
    entryAt: now.toISOString(),
  });
  const audit = recordAudit({
    idempotencyKey: command.idempotencyKey,
    userId: command.userId,
    scheduleItemId: item.id,
    sessionId: session.id,
    kind: "ENTRY",
    scheduledAt: item.start,
    attemptedAt: now.toISOString(),
    source,
    result: "SUCCESS",
  });
  return { ok: true, session, audit };
}

export function clockOut(command: ClockCommand): ClockOutcome {
  const replayed = replay(command.idempotencyKey);
  if (replayed) return replayed;

  const now = command.now ?? new Date();
  const source = command.source ?? "dashboard";
  const item = scheduleItems.find((candidate) => candidate.id === command.scheduleItemId);
  const activeSession = findActiveSession(command.userId);

  if (!activeSession) {
    const audit = recordAudit({
      idempotencyKey: command.idempotencyKey,
      userId: command.userId,
      scheduleItemId: command.scheduleItemId,
      sessionId: null,
      kind: "EXIT",
      scheduledAt: item?.end ?? "",
      attemptedAt: now.toISOString(),
      source,
      result: "REJECTED",
      errorMessage: "No hay ninguna sesión activa para cerrar.",
    });
    return { ok: false, reason: audit.errorMessage!, audit };
  }

  // "clockOut solo cierra la sesión activa correcta": una salida para otra
  // actividad no puede cerrar la sesión activa real.
  if (activeSession.scheduleItemId !== command.scheduleItemId) {
    const audit = recordAudit({
      idempotencyKey: command.idempotencyKey,
      userId: command.userId,
      scheduleItemId: command.scheduleItemId,
      sessionId: activeSession.id,
      kind: "EXIT",
      scheduledAt: item?.end ?? "",
      attemptedAt: now.toISOString(),
      source,
      result: "REJECTED",
      errorMessage: `La sesión activa corresponde a otra actividad (${activeSession.scheduleItemId}).`,
    });
    return { ok: false, reason: audit.errorMessage!, audit };
  }

  const closed = closeSession(activeSession, now.toISOString());
  const audit = recordAudit({
    idempotencyKey: command.idempotencyKey,
    userId: command.userId,
    scheduleItemId: command.scheduleItemId,
    sessionId: closed.id,
    kind: "EXIT",
    scheduledAt: item?.end ?? "",
    attemptedAt: now.toISOString(),
    source,
    result: "SUCCESS",
  });
  return { ok: true, session: closed, audit };
}

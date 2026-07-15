import { withTransaction } from "@/lib/db";
import { guayaquilDateString, guayaquilTimestamp, scheduleItems } from "@/lib/schedule";
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

async function toOutcome(audit: PunchAuditEntry): Promise<ClockOutcome> {
  if (audit.result === "SUCCESS" && audit.sessionId) {
    const session = await findSessionById(audit.userId, audit.sessionId);
    if (session) return { ok: true, session, audit };
  }
  return { ok: false, reason: audit.errorMessage ?? "Solicitud rechazada.", audit };
}

// BR-009: repetir una solicitud con la misma idempotencyKey no crea registros
// nuevos; se devuelve el resultado de la primera vez, sin volver a tocar el store.
// Si la misma key se reutiliza para el otro tipo de evento (ENTRY vs. EXIT), es
// un error de integración del llamador, no un duplicado legítimo: se rechaza en
// vez de devolver silenciosamente el resultado de la operación original.
async function replay(idempotencyKey: string, expectedKind: PunchAuditEntry["kind"]): Promise<ClockOutcome | null> {
  const existing = await getAuditByIdempotencyKey(idempotencyKey);
  if (!existing) return null;
  if (existing.kind !== expectedKind) {
    const kindLabel = (kind: PunchAuditEntry["kind"]) => (kind === "ENTRY" ? "ingreso" : "salida");
    return {
      ok: false,
      reason: `Esta idempotencyKey ya se usó para un evento de ${kindLabel(existing.kind)}; no puede reutilizarse para ${kindLabel(expectedKind)}.`,
      audit: existing,
    };
  }
  return toOutcome(existing);
}

export async function clockIn(command: ClockCommand): Promise<ClockOutcome> {
  const replayed = await replay(command.idempotencyKey, "ENTRY");
  if (replayed) return replayed;

  const now = command.now ?? new Date();
  const source = command.source ?? "dashboard";
  const scheduledDate = guayaquilDateString(now);
  const item = scheduleItems.find((candidate) => candidate.id === command.scheduleItemId);

  if (!item) {
    const audit = await recordAudit({
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

  // BR-004: máximo una sesión activa por usuario (verificación a nivel de
  // aplicación; el índice único parcial en session_instances es la garantía
  // real bajo concurrencia, ver lib/punch-store.ts createActiveSession).
  const activeSession = await findActiveSession(command.userId);
  if (activeSession) {
    const audit = await recordAudit({
      idempotencyKey: command.idempotencyKey,
      userId: command.userId,
      scheduleItemId: item.id,
      sessionId: activeSession.id,
      kind: "ENTRY",
      scheduledAt: guayaquilTimestamp(scheduledDate, item.start),
      attemptedAt: now.toISOString(),
      source,
      result: "REJECTED",
      errorMessage: `Ya existe una sesión activa (${activeSession.scheduleItemId}). Cierra la actividad anterior primero.`,
    });
    return { ok: false, reason: audit.errorMessage!, audit };
  }

  // createActiveSession + recordAudit corren en una sola transacción: o
  // quedan ambas filas (sesión activa + auditoría SUCCESS), o ninguna. Así
  // nunca puede quedar una sesión activa sin su auditoría correspondiente,
  // incluso si el insert de auditoría falla por una razón inesperada.
  const created = await withTransaction(async (client) => {
    const session = await createActiveSession(
      {
        userId: command.userId,
        scheduleItemId: item.id,
        scheduledDate: guayaquilDateString(now),
        entryAt: now.toISOString(),
      },
      client,
    );
    if (!session) return null;
    const audit = await recordAudit(
      {
        idempotencyKey: command.idempotencyKey,
        userId: command.userId,
        scheduleItemId: item.id,
        sessionId: session.id,
        kind: "ENTRY",
        scheduledAt: guayaquilTimestamp(scheduledDate, item.start),
        attemptedAt: now.toISOString(),
        source,
        result: "SUCCESS",
      },
      client,
    );
    return { session, audit };
  });

  if (!created) {
    // Perdió la carrera contra otro request concurrente: el índice único de
    // Postgres rechazó el insert dentro de la transacción (savepoint). No es
    // un bug, es la invariante BR-004 funcionando bajo concurrencia real.
    const audit = await recordAudit({
      idempotencyKey: command.idempotencyKey,
      userId: command.userId,
      scheduleItemId: item.id,
      sessionId: null,
      kind: "ENTRY",
      scheduledAt: guayaquilTimestamp(scheduledDate, item.start),
      attemptedAt: now.toISOString(),
      source,
      result: "REJECTED",
      errorMessage: "Ya existe una sesión activa (creada por una solicitud concurrente).",
    });
    return { ok: false, reason: audit.errorMessage!, audit };
  }

  return { ok: true, session: created.session, audit: created.audit };
}

export async function clockOut(command: ClockCommand): Promise<ClockOutcome> {
  const replayed = await replay(command.idempotencyKey, "EXIT");
  if (replayed) return replayed;

  const now = command.now ?? new Date();
  const source = command.source ?? "dashboard";
  const scheduledDate = guayaquilDateString(now);
  const item = scheduleItems.find((candidate) => candidate.id === command.scheduleItemId);
  const activeSession = await findActiveSession(command.userId);

  if (!activeSession) {
    const audit = await recordAudit({
      idempotencyKey: command.idempotencyKey,
      userId: command.userId,
      scheduleItemId: command.scheduleItemId,
      sessionId: null,
      kind: "EXIT",
      scheduledAt: item ? guayaquilTimestamp(scheduledDate, item.end) : "",
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
    const audit = await recordAudit({
      idempotencyKey: command.idempotencyKey,
      userId: command.userId,
      scheduleItemId: command.scheduleItemId,
      sessionId: activeSession.id,
      kind: "EXIT",
      scheduledAt: item ? guayaquilTimestamp(scheduledDate, item.end) : "",
      attemptedAt: now.toISOString(),
      source,
      result: "REJECTED",
      errorMessage: `La sesión activa corresponde a otra actividad (${activeSession.scheduleItemId}).`,
    });
    return { ok: false, reason: audit.errorMessage!, audit };
  }

  // closeSession + recordAudit en una sola transacción, por la misma razón
  // que en clockIn: nunca debe quedar una sesión cerrada sin su auditoría.
  const { closed, audit } = await withTransaction(async (client) => {
    const closed = await closeSession(activeSession, now.toISOString(), client);
    const audit = await recordAudit(
      {
        idempotencyKey: command.idempotencyKey,
        userId: command.userId,
        scheduleItemId: command.scheduleItemId,
        sessionId: closed.id,
        kind: "EXIT",
        scheduledAt: item ? guayaquilTimestamp(scheduledDate, item.end) : "",
        attemptedAt: now.toISOString(),
        source,
        result: "SUCCESS",
      },
      client,
    );
    return { closed, audit };
  });
  return { ok: true, session: closed, audit };
}

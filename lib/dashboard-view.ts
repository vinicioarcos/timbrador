import { guayaquilDateString, guayaquilTimeString, minutesOf } from "@/lib/schedule";
import type { ActiveSession, PunchRecord, ScheduleItem } from "@/lib/types";
import type { PunchAuditEntry, SessionInstance } from "@/lib/punch-store";

// Mapea las formas reales de Postgres (SessionInstance/PunchAuditEntry) a los
// tipos que ya usaba la UI del prototipo (ActiveSession/PunchRecord), para no
// reescribir el render existente. Puras, sin "use client"/"use server": las
// usa tanto app/dashboard/page.tsx (servidor) como dashboard-client.tsx.
export function toActiveSessionView(session: SessionInstance, item: ScheduleItem): ActiveSession {
  return {
    scheduleItemId: session.scheduleItemId,
    title: item.title,
    startedAt: session.entryAt ? guayaquilTimeString(session.entryAt) : "",
    scheduledEnd: item.end,
  };
}

// T-016: si el evento tiene una corrección verificada, la puntualidad y la
// hora mostrada como "actual" se calculan contra la hora corregida, no
// contra attemptedAt — pero originalTime siempre conserva la hora real del
// clic, para que la UI pueda mostrar ambas sin ocultar el ajuste.
export function toPunchRecordView(audit: PunchAuditEntry, item: ScheduleItem | undefined): PunchRecord {
  const scheduledTime = audit.scheduledAt ? guayaquilTimeString(audit.scheduledAt) : "";
  const originalTime = guayaquilTimeString(audit.attemptedAt);
  const actualTime = audit.correction ? guayaquilTimeString(audit.correction.correctedAt) : originalTime;
  const status: PunchRecord["status"] = scheduledTime && minutesOf(actualTime) <= minutesOf(scheduledTime) + 1 ? "ON_TIME" : "LATE";
  return {
    id: audit.id,
    scheduleItemId: audit.scheduleItemId,
    title: item?.title ?? audit.scheduleItemId,
    kind: audit.kind,
    scheduledTime,
    actualTime,
    originalTime,
    actualDate: guayaquilDateString(new Date(audit.attemptedAt)),
    status,
    correction: audit.correction
      ? { reason: audit.correction.reason, correctedBy: audit.correction.correctedBy, correctedAt: audit.correction.correctedAt }
      : undefined,
  };
}

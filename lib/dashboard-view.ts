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

export function toPunchRecordView(audit: PunchAuditEntry, item: ScheduleItem | undefined): PunchRecord {
  const scheduledTime = audit.scheduledAt ? guayaquilTimeString(audit.scheduledAt) : "";
  const actualTime = guayaquilTimeString(audit.attemptedAt);
  const status: PunchRecord["status"] = scheduledTime && minutesOf(actualTime) <= minutesOf(scheduledTime) + 1 ? "ON_TIME" : "LATE";
  return {
    id: audit.id,
    scheduleItemId: audit.scheduleItemId,
    title: item?.title ?? audit.scheduleItemId,
    kind: audit.kind,
    scheduledTime,
    actualTime,
    actualDate: guayaquilDateString(new Date(audit.attemptedAt)),
    status,
  };
}

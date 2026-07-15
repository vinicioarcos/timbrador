import { MISSED_REMINDER_MINUTES, PRE_REMINDER_MINUTES, guayaquilTimestamp } from "@/lib/schedule";
import type { ScheduleItem } from "@/lib/types";

export type ReminderKind = "PRE_ENTRY" | "MISSED_ENTRY" | "PRE_EXIT" | "MISSED_EXIT";

export type ReminderPlanItem = {
  kind: ReminderKind;
  scheduledFor: string;
  idempotencyKey: string;
};

function shiftMinutes(isoTimestamp: string, minutes: number): string {
  return new Date(new Date(isoTimestamp).getTime() + minutes * 60_000).toISOString();
}

// BR-002/BR-003: T-3 antes de cada evento de timbrada, T+1 si no se registró.
// Se calculan los 4 avisos de un bloque (entrada y salida) en un solo lugar
// para que el cron (generación) y cualquier prueba usen la misma fuente.
export function reminderPlanForItem(item: ScheduleItem, scheduledDate: string): ReminderPlanItem[] {
  const entryAt = guayaquilTimestamp(scheduledDate, item.start);
  const exitAt = guayaquilTimestamp(scheduledDate, item.end);

  return [
    {
      kind: "PRE_ENTRY",
      scheduledFor: shiftMinutes(entryAt, -PRE_REMINDER_MINUTES),
      idempotencyKey: `${item.id}:${scheduledDate}:PRE_ENTRY`,
    },
    {
      kind: "MISSED_ENTRY",
      scheduledFor: shiftMinutes(entryAt, MISSED_REMINDER_MINUTES),
      idempotencyKey: `${item.id}:${scheduledDate}:MISSED_ENTRY`,
    },
    {
      kind: "PRE_EXIT",
      scheduledFor: shiftMinutes(exitAt, -PRE_REMINDER_MINUTES),
      idempotencyKey: `${item.id}:${scheduledDate}:PRE_EXIT`,
    },
    {
      kind: "MISSED_EXIT",
      scheduledFor: shiftMinutes(exitAt, MISSED_REMINDER_MINUTES),
      idempotencyKey: `${item.id}:${scheduledDate}:MISSED_EXIT`,
    },
  ];
}

export type ReminderPriority = "INFO" | "WARNING" | "URGENT" | "BLOCKING";

const MESSAGES: Record<ReminderKind, (title: string) => { title: string; body: string; priority: ReminderPriority }> = {
  PRE_ENTRY: (title) => ({ title: "Timbra Académica", body: `En 3 minutos inicia: ${title}. Prepárate para timbrar ingreso.`, priority: "WARNING" }),
  MISSED_ENTRY: (title) => ({ title: "Timbra Académica", body: `Falta la timbrada de ingreso de ${title}. Han pasado 1 minuto.`, priority: "URGENT" }),
  PRE_EXIT: (title) => ({ title: "Timbra Académica", body: `En 3 minutos termina: ${title}. Prepárate para timbrar salida.`, priority: "WARNING" }),
  MISSED_EXIT: (title) => ({ title: "Timbra Académica", body: `Falta la timbrada de salida de ${title}. La sesión sigue activa.`, priority: "URGENT" }),
};

export function reminderMessage(kind: ReminderKind, itemTitle: string) {
  return MESSAGES[kind](itemTitle);
}

// BR-005/docs/notification-policy.md: si un PRE_ENTRY llega mientras todavía
// hay otra sesión activa, el mensaje debe pedir cerrarla primero, no invitar
// a timbrar ingreso directamente.
export function reminderMessageBlockedByActiveSession(itemTitle: string, activeItemTitle: string) {
  return {
    title: "Timbra Académica",
    body: `En 3 minutos inicia: ${itemTitle}. Primero debes salir de: ${activeItemTitle}.`,
    priority: "BLOCKING" as const,
  };
}

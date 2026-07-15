import type { NextRequest } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { findActiveSession, findSessionById } from "@/lib/punch-store";
import { getReminderById, markReminderStatus } from "@/lib/reminder-store";
import { reminderMessage, reminderMessageBlockedByActiveSession } from "@/lib/reminders";
import { scheduleItems } from "@/lib/schedule";
import { sendPushToUser } from "@/lib/push";

async function handler(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const reminderId = body?.reminderId;
  if (!reminderId) return Response.json({ ok: false, error: "reminderId requerido." }, { status: 400 });

  const reminder = await getReminderById(reminderId);
  if (!reminder) return Response.json({ ok: true, skipped: "reminder no encontrado." });
  if (reminder.status !== "PENDING") return Response.json({ ok: true, skipped: `ya estaba en estado ${reminder.status}.` });

  const session = await findSessionById(reminder.userId, reminder.sessionId);
  if (!session) {
    await markReminderStatus(reminder.id, "CANCELLED");
    return Response.json({ ok: true, skipped: "la sesión ya no existe." });
  }

  // Antifatiga / BR-002-BR-003: si la timbrada correspondiente ya ocurrió, no se envía.
  const isEntryReminder = reminder.kind === "PRE_ENTRY" || reminder.kind === "MISSED_ENTRY";
  const alreadyPunched = isEntryReminder ? Boolean(session.entryAt) : Boolean(session.exitAt);
  if (alreadyPunched) {
    await markReminderStatus(reminder.id, "SKIPPED");
    return Response.json({ ok: true, skipped: "la timbrada correspondiente ya existe." });
  }

  const item = scheduleItems.find((candidate) => candidate.id === session.scheduleItemId);
  const itemTitle = item?.title ?? "tu actividad";

  // BR-005: si el PRE_ENTRY llega y todavía hay OTRA sesión activa, el aviso
  // debe pedir cerrarla primero, no invitar a timbrar ingreso directamente.
  let message = reminderMessage(reminder.kind, itemTitle);
  if (reminder.kind === "PRE_ENTRY") {
    const activeSession = await findActiveSession(reminder.userId);
    if (activeSession && activeSession.id !== session.id) {
      const activeItem = scheduleItems.find((candidate) => candidate.id === activeSession.scheduleItemId);
      message = reminderMessageBlockedByActiveSession(itemTitle, activeItem?.title ?? "la actividad anterior");
    }
  }

  await sendPushToUser(reminder.userId, {
    title: message.title,
    body: message.body,
    url: "/dashboard",
    priority: message.priority,
  });
  await markReminderStatus(reminder.id, "SENT");

  return Response.json({ ok: true, sent: true });
}

export const POST = verifySignatureAppRouter(handler);

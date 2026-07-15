import type { NextRequest } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { findSessionById } from "@/lib/punch-store";
import { getReminderById, markReminderStatus } from "@/lib/reminder-store";
import { reminderMessage } from "@/lib/reminders";
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
  const message = reminderMessage(reminder.kind, item?.title ?? "tu actividad");
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

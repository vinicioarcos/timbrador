import type { NextRequest } from "next/server";
import { Client } from "@upstash/qstash";
import { verifyBearerSecret } from "@/lib/auth";
import { currentWeekDay, guayaquilDateString, todaySchedule, weekDayToNumber } from "@/lib/schedule";
import { listSessionsByDate, materializeDailySessions } from "@/lib/punch-store";
import { reminderPlanForItem } from "@/lib/reminders";
import { createReminderIfMissing, setQstashMessageId } from "@/lib/reminder-store";

// ADR-0002/ADR-0005: cron diario (plan Hobby de Vercel no permite cron por
// minuto) que materializa las instancias del día y programa un mensaje QStash
// por cada aviso T-3/T+1, con notBefore (timestamp absoluto en Guayaquil) en
// vez de un delay relativo.
export async function GET(request: NextRequest) {
  if (!verifyBearerSecret(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = process.env.APP_USERNAME;
  if (!userId) {
    return Response.json({ ok: false, error: "APP_USERNAME no está configurado." }, { status: 500 });
  }

  const now = new Date();
  const day = currentWeekDay(now);
  if (!day) {
    return Response.json({ ok: true, message: "Fin de semana: sin bloques ni recordatorios que generar.", remindersCreated: 0 });
  }

  const dateStr = guayaquilDateString(now);
  const items = todaySchedule(now);

  await materializeDailySessions(userId, dateStr, weekDayToNumber(day));
  const sessions = await listSessionsByDate(userId, dateStr);

  const client = new Client({ baseUrl: process.env.QSTASH_URL, token: process.env.QSTASH_TOKEN });
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : new URL(request.url).origin;

  let remindersCreated = 0;
  for (const item of items) {
    const session = sessions.find((candidate) => candidate.scheduleItemId === item.id);
    if (!session) continue; // no debería pasar tras materializar; se omite por seguridad

    for (const plan of reminderPlanForItem(item, dateStr)) {
      const reminder = await createReminderIfMissing({
        userId,
        sessionId: session.id,
        kind: plan.kind,
        scheduledFor: plan.scheduledFor,
        idempotencyKey: plan.idempotencyKey,
      });
      if (!reminder) continue; // ya existía: idempotente, no se reprograma

      const notBefore = Math.floor(new Date(plan.scheduledFor).getTime() / 1000);
      const { messageId } = await client.publishJSON({
        url: `${baseUrl}/api/reminders/deliver`,
        body: { reminderId: reminder.id },
        notBefore,
      });
      await setQstashMessageId(reminder.id, messageId);
      remindersCreated += 1;
    }
  }

  return Response.json({ ok: true, date: dateStr, weekday: day, blocks: items.length, remindersCreated });
}

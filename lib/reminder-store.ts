import { query } from "@/lib/db";
import { resolveUserUuid } from "@/lib/users-repository";
import type { ReminderKind } from "@/lib/reminders";

export type ReminderStatus = "PENDING" | "SENT" | "SKIPPED" | "ACKNOWLEDGED" | "CANCELLED";

export type ReminderEvent = {
  id: string;
  userId: string;
  sessionId: string;
  kind: ReminderKind;
  scheduledFor: string;
  status: ReminderStatus;
  qstashMessageId: string | null;
};

type ReminderRow = {
  id: string;
  session_id: string;
  kind: ReminderKind;
  scheduled_for: string;
  status: ReminderStatus;
  qstash_message_id: string | null;
};

function mapReminder(row: ReminderRow, username: string): ReminderEvent {
  return {
    id: row.id,
    userId: username,
    sessionId: row.session_id,
    kind: row.kind,
    scheduledFor: row.scheduled_for,
    status: row.status,
    qstashMessageId: row.qstash_message_id,
  };
}

// Idempotente vía la restricción unique(idempotency_key): volver a correr el
// cron diario (o reintentar tras un fallo parcial) nunca duplica un aviso.
export async function createReminderIfMissing(input: {
  userId: string;
  sessionId: string;
  kind: ReminderKind;
  scheduledFor: string;
  idempotencyKey: string;
}): Promise<ReminderEvent | null> {
  const userUuid = await resolveUserUuid(input.userId);
  const result = await query<ReminderRow>(
    `insert into reminder_events (session_id, user_id, kind, scheduled_for, idempotency_key)
     values ($1, $2, $3, $4, $5)
     on conflict (idempotency_key) do nothing
     returning id, session_id, kind, scheduled_for, status, qstash_message_id`,
    [input.sessionId, userUuid, input.kind, input.scheduledFor, input.idempotencyKey],
  );
  return result.rows.length ? mapReminder(result.rows[0], input.userId) : null;
}

export async function setQstashMessageId(reminderId: string, messageId: string): Promise<void> {
  await query(`update reminder_events set qstash_message_id = $2 where id = $1`, [reminderId, messageId]);
}

export async function getReminderById(reminderId: string): Promise<(ReminderEvent & { userId: string }) | null> {
  const result = await query<ReminderRow & { username: string }>(
    `select re.id, re.session_id, re.kind, re.scheduled_for::text, re.status, re.qstash_message_id, u.username
     from reminder_events re
     join users u on u.id = re.user_id
     where re.id = $1`,
    [reminderId],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return mapReminder(row, row.username);
}

export async function markReminderStatus(reminderId: string, status: Exclude<ReminderStatus, "PENDING">): Promise<void> {
  const column = status === "SENT" ? "sent_at" : status === "ACKNOWLEDGED" ? "acknowledged_at" : null;
  if (column) {
    await query(`update reminder_events set status = $2, ${column} = now() where id = $1`, [reminderId, status]);
  } else {
    await query(`update reminder_events set status = $2 where id = $1`, [reminderId, status]);
  }
}

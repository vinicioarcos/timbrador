import webpush from "web-push";
import { query } from "@/lib/db";
import { resolveUserUuid } from "@/lib/users-repository";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
};

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID_PRIVATE_KEY/NEXT_PUBLIC_VAPID_PUBLIC_KEY/VAPID_SUBJECT no están configurados.");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

// BR-008/seguridad: nunca se registra ni almacena una suscripción sin que el
// propio navegador del usuario la haya creado (pushManager.subscribe), y
// puede revocarse (BR-008 "timbrado asistido"/T-005 "suscripciones revocables").
export async function saveSubscription(userId: string, subscription: PushSubscriptionInput): Promise<void> {
  const userUuid = await resolveUserUuid(userId);
  await query(
    `insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     values ($1, $2, $3, $4, $5)
     on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, last_seen_at = now()`,
    [userUuid, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, subscription.userAgent ?? null],
  );
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await query(`delete from push_subscriptions where endpoint = $1`, [endpoint]);
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  priority?: "INFO" | "WARNING" | "URGENT" | "BLOCKING";
};

// Antifatiga (docs/notification-policy.md): esta función solo envía; la
// decisión de si corresponde enviar (¿ya se timbró?) la toma el llamador
// (ver app/api/reminders/deliver/route.ts) antes de invocarla.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; pruned: number }> {
  ensureConfigured();
  const userUuid = await resolveUserUuid(userId);
  const result = await query<{ endpoint: string; p256dh: string; auth: string }>(
    `select endpoint, p256dh, auth from push_subscriptions where user_id = $1`,
    [userUuid],
  );

  let sent = 0;
  let pruned = 0;
  await Promise.all(
    result.rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify({ title: payload.title, body: payload.body, url: payload.url, priority: payload.priority }),
        );
        sent += 1;
      } catch (error) {
        const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? (error as { statusCode?: number }).statusCode : undefined;
        if (statusCode === 404 || statusCode === 410) {
          // Suscripción revocada/expirada del lado del navegador: se limpia.
          await removeSubscription(row.endpoint);
          pruned += 1;
        } else {
          throw error;
        }
      }
    }),
  );
  return { sent, pruned };
}

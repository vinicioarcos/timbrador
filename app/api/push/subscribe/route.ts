import type { NextRequest } from "next/server";
import { getSessionUsername } from "@/lib/auth";
import { saveSubscription } from "@/lib/push";

export async function POST(request: NextRequest) {
  const username = await getSessionUsername();
  if (!username) return new Response("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return Response.json({ ok: false, error: "Suscripción inválida." }, { status: 400 });
  }

  await saveSubscription(username, {
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  return Response.json({ ok: true });
}

import type { NextRequest } from "next/server";
import { getSessionUsername } from "@/lib/auth";
import { removeSubscriptionForUser } from "@/lib/push";

export async function POST(request: NextRequest) {
  const username = await getSessionUsername();
  if (!username) return new Response("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.endpoint) return Response.json({ ok: false, error: "endpoint requerido." }, { status: 400 });

  await removeSubscriptionForUser(username, body.endpoint);
  return Response.json({ ok: true });
}

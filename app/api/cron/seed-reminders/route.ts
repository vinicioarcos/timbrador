import type { NextRequest } from "next/server";
import { scheduleItems } from "@/lib/schedule";

export function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // T-005 reemplazará esta previsualización por inserciones idempotentes en DB
  // y mensajes diferidos en la cola.
  return Response.json({
    ok: true,
    mode: "preview",
    message: "Scheduler de producción pendiente de T-005.",
    scheduleItems: scheduleItems.length,
  });
}

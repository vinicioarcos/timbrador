"use server";

import { clearSession, getSessionUsername } from "@/lib/auth";
import { redirect } from "next/navigation";
import { clockIn, clockOut, type ClockOutcome } from "@/lib/punch-commands";
import { createPunchCorrection } from "@/lib/punch-store";

export async function logout() {
  await clearSession();
  redirect("/login");
}

async function requireUsername(): Promise<string> {
  const username = await getSessionUsername();
  if (!username) throw new Error("No autenticado.");
  return username;
}

export async function clockInAction(scheduleItemId: string, idempotencyKey: string): Promise<ClockOutcome> {
  const userId = await requireUsername();
  return clockIn({ userId, scheduleItemId, idempotencyKey, source: "dashboard" });
}

export async function clockOutAction(scheduleItemId: string, idempotencyKey: string): Promise<ClockOutcome> {
  const userId = await requireUsername();
  return clockOut({ userId, scheduleItemId, idempotencyKey, source: "dashboard" });
}

export async function correctPunchAction(punchEventId: string, correctedAt: string, reason: string) {
  const userId = await requireUsername();
  const trimmedReason = reason.trim();
  if (!trimmedReason) return { ok: false as const, reason: "El motivo es obligatorio." };
  return createPunchCorrection({ punchEventId, userId, correctedAt, reason: trimmedReason });
}

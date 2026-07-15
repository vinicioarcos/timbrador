"use server";

import { clearSession, getSessionUsername } from "@/lib/auth";
import { redirect } from "next/navigation";
import { clockIn, clockOut, type ClockOutcome } from "@/lib/punch-commands";

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

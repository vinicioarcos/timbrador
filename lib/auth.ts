import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";

const COOKIE = "timbra_session";

function sign(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET no está configurado");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function createSessionToken(username: string) {
  const issuedAt = Date.now().toString();
  const payload = Buffer.from(`${username}|${issuedAt}`).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token?: string): boolean {
  if (!token || !token.includes(".")) return false;
  const [payload, signature] = token.split(".");
  const expected = sign(payload);
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function requireSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!verifySessionToken(token)) redirect("/login");
}

export async function setSession(username: string) {
  const store = await cookies();
  store.set(COOKIE, createSessionToken(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";

const COOKIE = "timbra_session";
// Debe coincidir con el maxAge de la cookie más abajo: el límite real de la
// sesión lo impone el servidor (verificando issuedAt), no solo el navegador
// borrando la cookie. Un token extraído por cualquier medio deja de ser
// válido pasado este tiempo, sin depender del cliente.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

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

function decodePayload(payload: string): { username: string; issuedAt: number } | null {
  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const [username, issuedAtRaw] = decoded.split("|");
  const issuedAt = Number(issuedAtRaw);
  if (!username || !Number.isFinite(issuedAt)) return null;
  return { username, issuedAt };
}

export function verifySessionToken(token?: string): boolean {
  if (!token || !token.includes(".")) return false;
  const [payload, signature] = token.split(".");
  const expected = sign(payload);
  if (signature.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;

  const decoded = decodePayload(payload);
  if (!decoded) return false;
  const ageSeconds = (Date.now() - decoded.issuedAt) / 1000;
  return ageSeconds >= 0 && ageSeconds <= SESSION_MAX_AGE_SECONDS;
}

export async function requireSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!verifySessionToken(token)) redirect("/login");
}

// Para rutas de API (no páginas): no redirige, solo devuelve el usuario
// autenticado o null. requireSession() no sirve aquí porque redirect() está
// pensado para el render de páginas/acciones de servidor, no para JSON APIs.
export async function getSessionUsername(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!verifySessionToken(token)) return null;
  const [payload] = token!.split(".");
  return decodePayload(payload)?.username ?? null;
}

export async function setSession(username: string) {
  const store = await cookies();
  store.set(COOKIE, createSessionToken(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

// Compara el header Authorization de un cron/webhook contra CRON_SECRET en
// tiempo constante (evita timing attacks al comparar secretos).
export function verifyBearerSecret(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret || !authHeader) return false;
  const expected = `Bearer ${secret}`;
  const actual = Buffer.from(authHeader);
  const expectedBuffer = Buffer.from(expected);
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

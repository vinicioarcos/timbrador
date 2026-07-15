import { query } from "@/lib/db";

const userUuidCache = new Map<string, string>();

export async function resolveUserUuid(username: string): Promise<string> {
  const cached = userUuidCache.get(username);
  if (cached) return cached;
  const result = await query<{ id: string }>("select id from users where username = $1", [username]);
  if (result.rows.length === 0) {
    throw new Error(`Usuario '${username}' no existe en la base de datos. Corre "npm run db:migrate".`);
  }
  userUuidCache.set(username, result.rows[0].id);
  return result.rows[0].id;
}

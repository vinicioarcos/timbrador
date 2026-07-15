import { Pool, type PoolClient, type QueryResultRow } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL no está configurado.");
    pool = new Pool({ connectionString });
  }
  return pool;
}

export type Queryable = Pick<Pool | PoolClient, "query">;

export function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[], client?: Queryable) {
  return (client ?? getPool()).query<T>(text, params as unknown[]);
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

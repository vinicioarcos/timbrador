# ADR-0004 — Driver PostgreSQL: `pg` (node-postgres)

**Estado:** Accepted

## Contexto

T-004 requiere un repositorio PostgreSQL real (`db/schema.sql`) para reemplazar el store en memoria de `lib/punch-store.ts` (introducido en T-006) y para el CRUD de horarios.

## Decisión

Usar `pg` (node-postgres) + `@types/pg` como único driver de acceso a PostgreSQL, con un `Pool` singleton en `lib/db.ts` leyendo `DATABASE_URL`.

## Razones

- Es el driver de referencia del ecosistema Node/Postgres: sin ORM, mapea 1:1 al SQL ya escrito en `db/schema.sql` (ADR-0001 ya decidió PostgreSQL sin mencionar un ORM).
- Soporta transacciones explícitas (`BEGIN`/`COMMIT`/`ROLLBACK`) necesarias para las invariantes de concurrencia de `session_instances` (índice único parcial `one_active_session_per_user`).
- Compatible con el proveedor Postgres provisto vía la integración de Vercel Marketplace (Neon), que expone una `DATABASE_URL` estándar de `postgresql://`.
- No se evaluó un ORM (Prisma/Drizzle) porque el esquema ya está escrito a mano en SQL y el volumen de consultas del MVP es pequeño; agregar un ORM sería una dependencia más pesada sin beneficio claro en esta etapa.

## Consecuencias

- `lib/punch-store.ts` (en memoria) se reemplaza por una implementación equivalente respaldada por Postgres, manteniendo las mismas firmas exportadas para que `lib/punch-commands.ts` no cambie (ver `handoffs/T-004-backend.md`).
- Requiere `DATABASE_URL` configurado (local vía `.env.local`, producción/preview vía variables de entorno de Vercel).
- El pool de conexiones (`pg.Pool`) debe reutilizarse entre invocaciones de funciones serverless de Next.js; se expone como singleton de módulo en `lib/db.ts`.

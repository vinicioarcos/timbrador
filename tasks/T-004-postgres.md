# T-004 — Persistencia PostgreSQL

**Estado:** DONE  
**Owner sugerido:** Backend

## Objetivo

Implementar un repositorio PostgreSQL basado en `db/schema.sql`.

## Criterios de aceptación

- [x] Migración reproducible (`scripts/migrate.mjs` + `db/schema.sql` idempotente, incluye `ALTER TABLE` para bases ya existentes).
- [x] CRUD de horarios (`lib/schedule-repository.ts`).
- [x] Creación de instancias diarias (`materializeDailySessions` en `lib/punch-store.ts`).
- [x] Historial por fecha (`listSessionsByDate`, `listAudit({ date })`).
- [x] La base de datos impide dos sesiones activas por usuario (índice único parcial + verificado con concurrencia real).
- [x] Pruebas de concurrencia (dos `clockIn` simultáneos contra Postgres real vía Neon; exactamente uno gana).

Ver `handoffs/T-004-backend.md` para decisiones, hallazgos e inconsistencias corregidas durante la implementación.

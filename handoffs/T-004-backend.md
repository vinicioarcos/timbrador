# Handoff T-004 — Backend

## Resumen

Se reemplazó el store en memoria de `lib/punch-store.ts` (T-006) por un repositorio real respaldado por PostgreSQL (Neon, provisto vía la integración de Vercel Marketplace), manteniendo el mismo contrato de nombres exportados que ya usaba `lib/punch-commands.ts` — aunque, como era inevitable al pasar a un driver real, las funciones ahora son `async`. También se agregó un repositorio de CRUD de horarios (`lib/schedule-repository.ts`) y un script de migración (`scripts/migrate.mjs`) que aplica `db/schema.sql` y siembra el usuario único de la app + el horario desde `data/schedule.seed.json`.

Todo se verificó contra una base Postgres real (Neon), no solo por `typecheck`.

## Infraestructura provisionada (fuera del código, vía CLI de Vercel)

- Proyecto Vercel `9.-timbra-academica-agentic` (team `edwins-projects-f0f5d6e3` / Econolab), conectado al repo `vinicioarcos/timbrador` en GitHub.
- Base de datos Postgres vía integración Neon (`vercel install neon`), conectada al proyecto.
- Variables de entorno configuradas en Vercel (production, preview y development): `DATABASE_URL` y variantes (Neon), `APP_USERNAME=vini`, `APP_PASSWORD_HASH` (scrypt), `SESSION_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_TIMEZONE=America/Guayaquil`, `PUNCH_INTEGRATION_MODE=mock`.
- `.env.local` sincronizado localmente vía `vercel env pull` (gitignorado, no se commitea).

## Archivos modificados/nuevos

- `lib/db.ts` (nuevo): `Pool` singleton + helper `query()` + `withTransaction()`.
- `lib/punch-store.ts` (reescrito): mismo contrato exportado que la versión en memoria, ahora respaldado por Postgres y async. Soporta un `client` opcional para participar en una transacción compartida.
- `lib/punch-commands.ts`: `clockIn`/`clockOut` ahora `async`; las rutas de éxito (crear sesión + auditoría, cerrar sesión + auditoría) corren dentro de una sola transacción (`withTransaction`).
- `lib/schedule-repository.ts` (nuevo): CRUD de `schedule_items` (list/create/update/baja lógica).
- `lib/schedule.ts`: se agregó `guayaquilTimestamp(dateString, time)` (Ecuador no tiene horario de verano, así que el offset `-05:00` es siempre correcto).
- `db/schema.sql`: ver "Inconsistencias corregidas" abajo.
- `scripts/migrate.mjs` (nuevo) + script `db:migrate` en `package.json`.
- `docs/adr/0004-pg-driver.md` (nuevo): justifica agregar `pg`/`@types/pg` como dependencia.
- `package.json`/`package-lock.json`: se agregó `pg` y `@types/pg`.

## Inconsistencias encontradas y corregidas (rol de arquitecto/revisor)

1. **`punch_events.session_id` era `NOT NULL`**, pero BR-010 exige auditar todo intento, incluidos rechazos antes de que exista una sesión (actividad inexistente, `clockOut` sin sesión activa). Se relajó a nullable y se agregó una columna `schedule_item_id` directa (antes no existía) para no perder la trazabilidad de "qué actividad" cuando no hay `session_id`.
2. **`create type ... as enum` no es idempotente** en Postgres (no admite `if not exists`): se envolvió en bloques `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` para que la migración sea reproducible en una base que ya tiene los tipos creados.
3. **`create table if not exists` no altera una tabla ya creada** por una corrida anterior de la migración con una forma distinta. Se agregaron `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` / `ALTER COLUMN ... DROP NOT NULL` idempotentes para `punch_events`, verificados corriendo la migración dos veces sobre la misma base (una con el esquema viejo, otra limpia).
4. **`scheduledAt` en la auditoría se pasaba como `"13:00"` (solo hora)**, no como timestamp — funcionaba con el store en memoria (campo de texto libre) pero `punch_events.scheduled_at` es `timestamptz`. Se corrigió calculando el timestamp completo con `guayaquilTimestamp(scheduledDate, item.start|end)`. Esto se encontró solo al correr contra Postgres real; ni el `typecheck` ni el smoke test de T-006 (en memoria) lo hubieran detectado.
5. **Riesgo de sesión activa huérfana:** al probar contra la base real, un fallo en el segundo de dos inserts secuenciales (crear sesión, luego registrar auditoría) dejó una sesión `ACTIVE` sin ninguna fila de auditoría correspondiente — se reprodujo realmente durante esta sesión de trabajo (por el bug #4, ya corregido). Se resolvió envolviendo "crear sesión + auditoría" y "cerrar sesión + auditoría" en transacciones reales (`withTransaction`), con `SAVEPOINT`/`ROLLBACK TO SAVEPOINT` dentro de `createActiveSession`/`recordAudit` para que una violación del índice único (carrera real entre dos requests) no deje la transacción completa inutilizable.

## Decisión de diseño pendiente, no resuelta (documentada, no silenciada)

`session_instances` no tiene una restricción única `(schedule_item_id, scheduled_date)` porque `createActiveSession` (de T-006, ya mezclado) siempre inserta una fila nueva en `ACTIVE`, sin buscar/transicionar una fila `SCHEDULED` preexistente creada por `materializeDailySessions`. El modelo de datos (y el estado de la máquina en `docs/state-machine.md`: `SCHEDULED -> PRE_ALERTED -> DUE -> ACTIVE`) sugiere que debería ser una sola fila que transiciona de estado, no dos filas independientes. Reconciliar esto —que `clockIn` busque y transicione una fila `SCHEDULED` del día en vez de insertar una nueva— es un cambio de comportamiento sobre la lógica ya aprobada de T-006 y queda fuera de alcance de T-004. Recomiendo abrir T-015 para esto antes de construir T-005 (recordatorios), porque T-005 probablemente necesita materializar las filas `SCHEDULED` con anticipación para poder avisar T-3/T+1, y ese diseño debería nacer ya reconciliado con `clockIn`.

## Comandos ejecutados

- `npm install pg` / `npm install -D @types/pg`.
- `npm run typecheck` → pasa.
- `npm run validate:schedule` → pasa.
- `node --env-file=.env.local scripts/migrate.mjs` → corrido dos veces (idempotencia confirmada), y una tercera vez después de corregir el esquema de `punch_events` (confirmando que la migración evoluciona una base ya existente, no solo una nueva).
- Verificación funcional contra Postgres real: copia temporal de los archivos de `lib/` dentro del repo (carpeta `.tmp-t004check/`, borrada al terminar) con imports reescritos a rutas relativas, ejecutada con `node --env-file=.env.local`. Cubrió: `listScheduleItems` (25/25 bloques), `materializeDailySessions` (idempotente en la segunda corrida), `listSessionsByDate`, `clockIn`/`clockOut` (mismos 4 casos de T-006, ahora contra Postgres), y **concurrencia real**: dos `clockIn` disparados con `Promise.all` para el mismo usuario — exactamente uno gana, verificado contra la base real, no simulado. Se limpiaron los datos de prueba (sesión activa cerrada) al final; se confirmó `0` sesiones activas colgadas después.
- Verificación separada del CRUD completo de horarios (`.tmp-crudcheck/`, también borrada al terminar): `createScheduleItem`, `updateScheduleItem` (confirma que solo cambia los campos incluidos en el patch), `deactivateScheduleItem` (baja lógica) y `listScheduleItems` con y sin `includeInactive`. Los 7 checks pasaron contra Postgres real; el bloque de prueba (`crud-test-item`) se borró al final.

## Riesgos / pendientes

- Ver "Decisión de diseño pendiente" arriba (T-015 sugerido).
- `lib/schedule-repository.ts` es una capacidad CRUD adicional, todavía no conectada a ninguna UI ni a `lib/schedule.ts` (que sigue leyendo del JSON seed para todo lo demás). Igual que T-006 con el dashboard, conectar esto es trabajo futuro, no de esta tarea.
- El script de migración asume un solo usuario de app (vía `APP_USERNAME`/`APP_PASSWORD_HASH`); no hay soporte multiusuario todavía (consistente con el alcance MVP de `PROJECT.md`).
- No se agregó un rollback/`down` migration; para este MVP de un solo desarrollador se consideró suficiente, pero si el equipo crece vale la pena revisarlo.

## Archivos bloqueados temporalmente

Ninguno.

## Recomendación para el siguiente agente

1. Revisar y mover a `DONE` si los 6 criterios se consideran satisfechos.
2. Considerar abrir T-015 (reconciliar `SCHEDULED` materializado vs. `ACTIVE` insertado directamente) antes de empezar T-005.
3. Rama de trabajo: `agent/backend/T-004-postgres`. Falta el merge a `master` cuando se apruebe.

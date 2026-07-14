# Handoff T-006 — Backend

## Resumen

Se implementó la capa de comandos idempotentes de timbrada (`clockIn`/`clockOut`) descrita en `docs/architecture.md` como capa "Aplicación". Hasta ahora esa lógica solo existía en el prototipo de UI (`app/dashboard/dashboard-client.tsx`), como estado de React + `localStorage`, sin ninguna de las invariantes de dominio (BR-004, BR-009, BR-010) aplicadas en servidor.

Se agregaron dos archivos nuevos:

- `lib/punch-store.ts`: repositorio en memoria del proceso. Modela `SessionInstance` (equivalente reducido de `session_instances` en `db/schema.sql`) y `PunchAuditEntry` (equivalente reducido de `punch_events`), con índice único de `idempotencyKey` y helper para encontrar la sesión activa de un usuario.
- `lib/punch-commands.ts`: `clockIn(command)` y `clockOut(command)`, que aplican las reglas de negocio y siempre registran un intento de auditoría (éxito, rechazo o error), antes de devolver el resultado.

También se agregó `guayaquilDateString()` a `lib/schedule.ts` (mismo patrón `Intl.DateTimeFormat` que el helper de T-013), necesaria para poblar `scheduledDate` en `SessionInstance` con la fecha correcta en `America/Guayaquil`, no la del proceso.

## Archivos modificados

- `lib/punch-store.ts` (nuevo)
- `lib/punch-commands.ts` (nuevo)
- `lib/schedule.ts` (se agregó `guayaquilDateString`)
- `tasks/T-006-punch-api.md`
- `TASKS.md`

## Decisiones

- **Store en memoria, no Postgres:** T-004 (persistencia PostgreSQL) sigue `READY` y es una tarea aparte. `lib/punch-store.ts` se escribió como el único punto que T-004 debería reemplazar; `lib/punch-commands.ts` no conoce detalles de almacenamiento. Si T-004 respeta las firmas exportadas por `punch-store.ts` (`findActiveSession`, `createActiveSession`, `closeSession`, `getAuditByIdempotencyKey`, `recordAudit`, `listAudit`), el cambio a Postgres no debería tocar `punch-commands.ts`.
- **Idempotencia por *replay* de resultado, no por rechazo de duplicados:** repetir la misma `idempotencyKey` devuelve exactamente el mismo `ClockOutcome` de la primera vez (éxito o rechazo), sin volver a escribir en el store. Se verificó que la segunda llamada no agrega una entrada nueva a la auditoría y que el resultado es idéntico (`JSON.stringify` igual).
- **`clockOut` valida que la sesión activa sea la de la actividad solicitada**, no solo que exista una sesión activa — un intento de salida de una actividad distinta a la realmente activa se rechaza y queda auditado, no cierra la sesión equivocada.
- **No se tocó la UI del prototipo.** `app/dashboard/dashboard-client.tsx` sigue usando `localStorage` y no llama a estos comandos. Conectarlos es un cambio de UI/estado que excede el objetivo de T-006 ("crear comandos/API"); lo dejo como recomendación explícita abajo en vez de ampliar el alcance en silencio.
- Nombres de tipos: se usó `ClockCommand`/`ClockOutcome` (no `PunchCommand`) para no chocar con `lib/integrations/punch-adapter.ts`, que ya define `PunchCommand`/`PunchResult` para la integración institucional (T-007) — son conceptos distintos (comando de dominio interno vs. comando hacia el adaptador externo).

## Comandos ejecutados

- `npm run typecheck` → pasa, exit code 0.
- `npm run validate:schedule` → pasa.
- Verificación funcional ad hoc de los criterios de aceptación: se copiaron `lib/schedule.ts`, `lib/punch-store.ts`, `lib/punch-commands.ts` y `lib/types.ts` a un directorio temporal fuera del repo (scratchpad de la sesión), con imports reescritos de `@/...` a rutas relativas (Node ESM plano no resuelve el alias de tsconfig), y se corrió un script que ejercita: `clockIn` inicial, `clockIn` rechazado por sesión activa, `clockOut` rechazado por actividad incorrecta, repetición de `clockIn` con la misma `idempotencyKey` (mismo resultado, sin auditoría nueva), `clockOut` correcto, verificación de que la auditoría contiene tanto éxitos como rechazos, y reutilización de la misma key entre `clockIn`/`clockOut` (se rechaza, no repite silenciosamente el resultado original). 10 checks pasaron. El script no se commiteó (es un smoke test ad hoc, no la suite formal de T-008).

## Pruebas

- `npm run typecheck`: pasa.
- `npm run validate:schedule`: pasa.
- Smoke test de los criterios de aceptación de T-006: pasa (ver arriba). No reemplaza T-008 (pruebas de dominio), que debe cubrir además concurrencia real, gestión con solo dos timbradas, etc.

## Hallazgo de autorevisión (corregido antes de mezclar)

Al revisar la rama antes del merge encontré que `replay()` no distinguía el tipo de evento (`ENTRY`/`EXIT`) al buscar una `idempotencyKey` ya usada: si un llamador reutilizaba por error la misma key entre un `clockIn` y un `clockOut`, la función devolvía silenciosamente el resultado de la operación original como si fuera la respuesta de la nueva, sin ninguna señal de error. Esto viola el espíritu de BR-009 (idempotencia), aunque no aparecía explícitamente en los 4 criterios de aceptación literales. Se corrigió agregando el `kind` esperado a `replay()`: si la key ya existe para un `kind` distinto, se rechaza explícitamente en vez de reproducir el resultado ajeno. No se agregó ningún registro de auditoría nuevo en ese rechazo (la key ya está tomada por el intento original). Se agregó un caso al smoke test que cubre este escenario.

## Riesgos / pendientes

- El store es en memoria: se pierde en cada reinicio del proceso de Next.js (incluido cada redeploy en Vercel). Esto es esperado y está documentado en el propio archivo (`lib/punch-store.ts`); no debe usarse así en producción hasta que T-004 lo reemplace.
- No hay endpoint HTTP ni server action expuesta todavía para `clockIn`/`clockOut` — son funciones de dominio puras, listas para ser llamadas desde una server action o ruta de API cuando se conecte la UI real o T-004.
- El prototipo de UI sigue sin usar estos comandos (ver Decisiones). Riesgo de confusión si alguien asume que el dashboard ya aplica estas invariantes: no es así todavía.

## Archivos bloqueados temporalmente

Ninguno.

## Recomendación para el siguiente agente

1. Revisar y mover a `DONE` si los 4 criterios se consideran satisfechos con verificación manual (no hay suite automatizada todavía — eso es T-008).
2. Sugerido como siguiente tarea natural: exponer `clockIn`/`clockOut` como server actions en `app/dashboard/actions.ts` y conectar `dashboard-client.tsx` a ellas en vez de `localStorage`. Esto no está en el alcance de T-006 ni de ningún task existente — si se quiere hacer, registrar una tarea nueva (p. ej. T-014) en vez de ampliar el alcance de T-006 o T-004.
3. Cuando se implemente T-004, migrar `lib/punch-store.ts` a un repositorio Postgres manteniendo las mismas firmas exportadas, para que `lib/punch-commands.ts` no requiera cambios.
4. Rama de trabajo: `agent/backend/T-006-punch-api`. Falta hacer merge a `master` cuando se apruebe.

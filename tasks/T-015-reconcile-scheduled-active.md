# T-015 — Reconciliar instancias SCHEDULED con clockIn (ACTIVE)

**Estado:** REVIEW
**Prioridad:** P0
**Owner sugerido:** Backend

## Contexto

Encontrado durante T-004 (ver `handoffs/T-004-backend.md`, sección "Decisión de diseño pendiente"): `materializeDailySessions` crea filas `session_instances` en estado `SCHEDULED` para cada bloque del día, pero `createActiveSession` (de T-006, ya mezclado) siempre inserta una fila **nueva** en `ACTIVE`, sin buscar ni transicionar la fila `SCHEDULED` que ya existía para ese mismo `schedule_item_id` + `scheduled_date`.

Esto contradice el modelo implícito en `docs/state-machine.md` (`SCHEDULED -> PRE_ALERTED -> DUE -> ACTIVE -> ... -> COMPLETED` como transiciones de **una misma** instancia) y produciría filas duplicadas por bloque/día en cuanto exista un materializador diario real (T-005).

## Objetivo

`clockIn` debe **transicionar** una fila `SCHEDULED` existente a `ACTIVE` cuando ya fue materializada por adelantado, y solo **crear una fila nueva** directamente en `ACTIVE` cuando no exista materialización previa (para no romper el caso ya cubierto por T-006: la app debe seguir funcionando aunque el materializador/scheduler de T-005 no haya corrido).

## Alcance

- Modificar `createActiveSession` en `lib/punch-store.ts`: intentar primero un `UPDATE ... WHERE status = 'SCHEDULED'` para el mismo `schedule_item_id` + `scheduled_date`; si no afecta ninguna fila, hacer el `INSERT` directo en `ACTIVE` (comportamiento actual).
- Agregar una restricción única `(schedule_item_id, scheduled_date)` en `session_instances` ahora que ya no puede haber dos filas para el mismo bloque/día bajo el nuevo flujo.
- Verificar que la invariante de concurrencia (una sola sesión activa por usuario) se mantenga con el nuevo camino de "transicionar fila existente", no solo con el de "insertar fila nueva".
- No tocar `lib/punch-commands.ts` (su contrato con `punch-store.ts` no cambia) ni la UI.

## Fuera de alcance

- Materializar automáticamente en un cron real (eso es T-005).
- Estados intermedios `PRE_ALERTED`/`DUE`/`MISSED_ENTRY` de la máquina de estados (siguen sin modelarse; quedan para T-005/T-008).

## Criterios de aceptación

- [x] Si existe una fila `SCHEDULED` para el bloque/día, `clockIn` la transiciona a `ACTIVE` (mismo `id`, no crea una fila nueva).
- [x] Si no existe una fila `SCHEDULED` previa, `clockIn` sigue funcionando exactamente como antes (crea la fila directo en `ACTIVE`).
- [x] Restricción única `(schedule_item_id, scheduled_date)` agregada y migración sigue siendo reproducible.
- [x] La prueba de concurrencia (dos `clockIn` simultáneos) sigue pasando, ahora también cubriendo el camino de "transicionar fila `SCHEDULED` existente".
- [x] `npm run typecheck` y `npm run validate:schedule` pasan.
- [x] Handoff creado en `handoffs/T-015-backend.md`.

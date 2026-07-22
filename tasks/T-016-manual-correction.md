# T-016 — Corrección manual verificada de timbradas

**Estado:** DONE
**Prioridad:** P1
**Owner sugerido:** Backend/Product

## Contexto

Detectado 2026-07-22: un ingreso a "Políticas Públicas" quedó registrado con
`attemptedAt` 11:43 (Guayaquil), pero el usuario reporta haber intentado
timbrar a las 10:00 (el inicio programado del bloque). La auditoría de ese
día (`punch_events`) solo tiene **un** registro — no existe ningún intento
fallido/rechazado a las 10:00 — lo que indica que el clic real no llegó a
completarse en el servidor a esa hora (no que el sistema lo registró mal).

Hoy no hay forma de corregir esto sin editar la base de datos a mano: no
existe un flujo para marcar una timbrada como "ingreso manual verificado"
con una hora distinta a `attemptedAt`, y editar filas de `punch_events`
directamente rompería la garantía de que es una tabla de auditoría
append-only (nunca se ha modificado una fila después de insertada).

## Objetivo

Permitir corregir el horario efectivo de una timbrada ya registrada (p. ej.
cuando el sistema no capturó el intento real a tiempo, o cuando se autoriza
una excepción), sin alterar ni borrar el registro original — la corrección
debe ser una entrada nueva y auditable, no una edición silenciosa.

## Alcance propuesto (a validar en implementación)

- Nueva tabla o columnas para "correcciones": referencian el `punch_events.id`
  original, guardan la hora corregida, un motivo de texto y quién la
  autorizó (hoy solo hay un usuario, pero el campo debe existir para cuando
  haya roles).
- `lib/dashboard-view.ts` y la UI deben poder mostrar, para una timbrada
  corregida, tanto la hora original como la corregida + el motivo (no
  reemplazar silenciosamente un valor por otro).
- Definir quién puede corregir: ¿solo el propio usuario, con límite de
  tiempo desde el evento original? ¿o requiere un segundo flujo
  administrativo? (Con un solo usuario hoy, probablemente autocorrección
  con motivo obligatorio sea suficiente para el MVP.)
- El estado `LATE`/`ON_TIME` que se muestra en el historial debe recalcularse
  contra la hora corregida cuando exista una corrección, no contra
  `attemptedAt`.

## Fuera de alcance

- Corregir sesiones activas en curso (esto es sobre el registro histórico,
  no sobre `session_instances.status = ACTIVE`).
- Un panel administrativo completo de auditoría — alcance mínimo es poder
  corregir y ver el motivo, no gestionar corrección de terceros.

## Criterios de aceptación

- [x] Existe un mecanismo para corregir la hora efectiva de un `punch_event`
      ya registrado, sin editar ni borrar la fila original (tabla
      `punch_corrections`, `lib/punch-store.ts createPunchCorrection`).
- [x] La corrección queda auditada: quién (`corrected_by`), cuándo
      (`created_at`), motivo (`reason`) y valor nuevo (`corrected_at`); el
      valor anterior no se duplica — se deriva del `punch_events.attempted_at`
      original vía el join.
- [x] El historial del dashboard muestra la corrección de forma explícita:
      hora corregida + "(original HH:MM)" + motivo, nunca oculta el ajuste
      (`app/dashboard/dashboard-client.tsx`).
- [x] El cálculo de puntualidad (`LATE`/`ON_TIME`) usa la hora corregida
      cuando existe (`lib/dashboard-view.ts toPunchRecordView`).
- [x] `npm run typecheck`, `npm run validate:schedule` y `npm run build`
      pasan.
- [x] Documentado en `docs/data-model.md` (sección "`punch_events` es
      append-only").
- [x] Solo el dueño de la timbrada puede corregirla (`createPunchCorrection`
      valida `punch_events.user_id` antes de insertar) y solo una vez por
      evento (índice único en `punch_event_id`).

## Incidente durante el cierre (2026-07-22)

Al aplicar el nuevo esquema en producción, se corrió por error
`npm run db:migrate` con un `.env` descargado vía `vercel env pull`: como
`APP_USERNAME`/`APP_PASSWORD_HASH` están marcadas "Sensitive" en Vercel, el
CLI no pudo traer su valor real y escribió un placeholder (`[SENSITIVE]`).
Migrate lo tomó como username literal, creó un usuario espurio, y el upsert
de `schedule_items` (`on conflict (id) do update set user_id = excluded.user_id`)
le reasignó las 25 filas de horario, quitándoselas al usuario real. Se
detectó de inmediato (0 filas de `session_instances`/`punch_events`
llegaron a depender del usuario espurio), se revirtió a mano
(`schedule_items` reasignado de vuelta, usuario espurio borrado) y se agregó
una guarda en `scripts/migrate.mjs` que aborta si `APP_USERNAME`/
`APP_PASSWORD_HASH` contienen `[`/`]`. El esquema (`punch_corrections`) se
terminó de aplicar con un script que solo corre `db/schema.sql`, sin tocar
la siembra de usuario/horario.

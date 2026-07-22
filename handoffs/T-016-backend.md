# Handoff T-016 — Backend/Product

## Resumen

Corrección manual verificada de timbradas: se puede ajustar la hora
efectiva de una timbrada ya registrada (ej. el clic real no llegó a tiempo
al servidor) sin editar ni borrar el evento original. `punch_events` sigue
siendo append-only; la corrección es una fila separada en
`punch_corrections`.

## Archivos modificados

- `db/schema.sql` — tabla `punch_corrections` (FK a `punch_events`, único
  por `punch_event_id`, `corrected_by` referencia `users`).
- `lib/punch-store.ts` — tipo `PunchCorrection`, `PunchAuditEntry.correction`
  opcional, `listAudit` hace LEFT JOIN a `punch_corrections`/`users`,
  `createPunchCorrection(input)` inserta validando ownership.
- `lib/types.ts` — `PunchRecord.originalTime` y `PunchRecord.correction`.
- `lib/dashboard-view.ts` — `toPunchRecordView` calcula `actualTime`/`status`
  contra la corrección cuando existe, conserva `originalTime` siempre.
- `app/dashboard/actions.ts` — `correctPunchAction(punchEventId, correctedAt, reason)`.
- `app/dashboard/dashboard-client.tsx` — UI: botón "Corregir hora" por fila
  del historial, formulario inline (hora + motivo), muestra la corrección
  ya aplicada sin ocultar el ajuste.
- `app/globals.css` — estilos mínimos para el formulario inline y la nota
  de corrección.
- `docs/data-model.md` — sección nueva explicando que `punch_events` sigue
  append-only y cómo funcionan las correcciones.
- `scripts/migrate.mjs` — guarda contra el incidente de abajo.
- `tasks/T-016-manual-correction.md`, `TASKS.md` — estado DONE.

## Decisiones

- Un evento admite **una sola corrección** (índice único en
  `punch_event_id`): si se intenta corregir dos veces, se rechaza con un
  mensaje claro en vez de sobrescribir la primera corrección o mantener un
  historial de revisiones. Suficiente para el MVP de un solo usuario; si
  hace falta permitir re-corregir, es una tarea aparte.
- Solo el dueño de la timbrada puede corregirla — no hay rol de
  administrador todavía (`createPunchCorrection` verifica
  `punch_events.user_id` antes de insertar).
- La hora corregida se captura como `<input type="time">` + el motivo como
  texto libre obligatorio; se combina con `guayaquilTimestamp(actualDate, hora)`
  (mismo helper que ya usa `lib/schedule.ts`), así que la corrección asume
  la misma fecha del evento original — no se puede "mover" una timbrada a
  otro día. Consistente con el alcance acordado ("fuera de alcance: un
  panel administrativo completo").

## Incidente durante el cierre (y cómo se resolvió)

Al aplicar el esquema nuevo en producción, corrí `npm run db:migrate` con
variables leídas de un `.env` descargado vía `vercel env pull`.
`APP_USERNAME`/`APP_PASSWORD_HASH` están marcadas **"Sensitive"** en
Vercel — ese tipo de variable nunca se puede leer de vuelta, ni por el CLI
ni por el dashboard, así que `vercel env pull` escribió un placeholder
(`[SENSITIVE]`) en vez del valor real. El script de migración lo tomó como
username literal y, por el upsert de `schedule_items`
(`on conflict (id) do update set user_id = excluded.user_id`), le
reasignó las 25 filas del horario a un usuario espurio recién creado,
quitándoselas al usuario real (`vini`).

Se detectó de inmediato revisando qué tablas dependían del usuario espurio
(0 filas en `session_instances`/`punch_events`/`push_subscriptions`/
`audit_log` — solo `schedule_items`, por el upsert). Se corrigió a mano:
`schedule_items` reasignado de vuelta al usuario real, usuario espurio
borrado. El esquema nuevo (`punch_corrections`) se terminó de aplicar con
un script separado que solo corre `db/schema.sql`, sin tocar la siembra de
usuario/horario.

**Guarda agregada en `scripts/migrate.mjs`**: aborta sin tocar la base de
datos si `APP_USERNAME`/`APP_PASSWORD_HASH` contienen `[` o `]` (patrón del
placeholder de Vercel), con un mensaje explicando la causa.

## Comandos ejecutados

```
npm run typecheck        # OK
npm run validate:schedule  # OK
npm run build             # OK
```

Contra producción (Neon, vía `DATABASE_URL` real, no el placeholder):
consultas de verificación de propietario de `schedule_items` antes/después
del fix, `UPDATE schedule_items SET user_id = ...`, `DELETE FROM users
WHERE id = <usuario espurio>`, y aplicación de `db/schema.sql` con un
script standalone.

## Pruebas

- Typecheck, validate:schedule y build pasan.
- Verificado en producción: `schedule_items` tiene sus 25 filas de vuelta
  bajo el usuario real (`vini`), el usuario espurio ya no existe, y la
  tabla `punch_corrections` existe en el esquema.
- **No probado en el navegador todavía**: el flujo de "Corregir hora" en
  el dashboard (formulario inline, guardado, recálculo de estado) no se
  verificó manualmente contra un deploy real.

## Riesgos / pendientes

- Falta verificación manual en navegador del flujo de corrección end-to-end.
- No hay límite de tiempo para corregir un evento (se puede corregir un
  evento de hace meses); si eso es un problema, agregar una ventana
  máxima es un cambio pequeño en `createPunchCorrection`.

## Recomendación para el siguiente agente

Antes de dar por cerrado el flujo de usuario, verificar en el navegador:
entrar al dashboard, corregir la hora de una timbrada del historial, y
confirmar que el estado ON_TIME/LATE se recalcula y que la nota de
corrección se ve tal como se diseñó.

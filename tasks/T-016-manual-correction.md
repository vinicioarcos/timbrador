# T-016 — Corrección manual verificada de timbradas

**Estado:** READY
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

- [ ] Existe un mecanismo para corregir la hora efectiva de un `punch_event`
      ya registrado, sin editar ni borrar la fila original.
- [ ] La corrección queda auditada: quién, cuándo, motivo, valor anterior y
      nuevo.
- [ ] El historial del dashboard muestra la corrección de forma explícita
      (no oculta que hubo un ajuste).
- [ ] El cálculo de puntualidad (`LATE`/`ON_TIME`) usa la hora corregida
      cuando existe.
- [ ] `npm run typecheck` y `npm run validate:schedule` pasan.
- [ ] Documentado en `docs/security.md` o `docs/state-machine.md` (lo que
      aplique) para que quede claro que `punch_events` sigue siendo
      append-only y las correcciones son un mecanismo separado.

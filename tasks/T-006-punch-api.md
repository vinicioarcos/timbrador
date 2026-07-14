# T-006 — API de timbradas

**Estado:** REVIEW  
**Owner sugerido:** Backend

## Objetivo

Crear comandos/API idempotentes de ingreso y salida.

## Criterios de aceptación

- [x] `clockIn` rechaza una nueva sesión si existe otra activa.
- [x] `clockOut` solo cierra la sesión activa correcta.
- [x] Duplicados con la misma idempotency key no crean registros nuevos.
- [x] Todo intento queda en auditoría.

## Notas de implementación

Ver `handoffs/T-006-backend.md`. El store (`lib/punch-store.ts`) es en memoria del
proceso — deliberado, a la espera de T-004 (Postgres). No se conectó la UI del
prototipo (`app/dashboard/dashboard-client.tsx`, que sigue usando `localStorage`)
a estos comandos; eso queda fuera de alcance de T-006 y se deja registrado como
posible tarea de seguimiento.

# T-006 — API de timbradas

**Estado:** READY  
**Owner sugerido:** Backend

## Objetivo

Crear comandos/API idempotentes de ingreso y salida.

## Criterios de aceptación

- [ ] `clockIn` rechaza una nueva sesión si existe otra activa.
- [ ] `clockOut` solo cierra la sesión activa correcta.
- [ ] Duplicados con la misma idempotency key no crean registros nuevos.
- [ ] Todo intento queda en auditoría.

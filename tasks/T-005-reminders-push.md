# T-005 — Recordatorios fiables + Web Push

**Estado:** READY  
**Owner sugerido:** Scheduler

## Objetivo

Programar T-3 y T+1 sin depender de una pestaña abierta.

## Diseño esperado

- Cron diario protegido.
- Generación idempotente de jobs.
- Cola con entrega diferida.
- Consumer que consulta el estado actual antes de enviar.
- Web Push con suscripciones revocables.

## Criterios de aceptación

- [ ] No se envía T+1 si la timbrada ya existe.
- [ ] No se duplican recordatorios tras reintentos.
- [ ] Se respeta `America/Guayaquil`.
- [ ] Prueba con cambio de día y fin de semana.

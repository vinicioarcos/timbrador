# T-005 — Recordatorios fiables + Web Push

**Estado:** REVIEW  
**Owner sugerido:** Scheduler

## Objetivo

Programar T-3 y T+1 sin depender de una pestaña abierta.

## Diseño esperado

- [x] Cron diario protegido (`/api/cron/seed-reminders`, ya existía protegido por `CRON_SECRET`).
- [x] Generación idempotente de jobs (`reminder_events.idempotency_key` único).
- [x] Cola con entrega diferida (Upstash QStash, `notBefore` absoluto — ver ADR-0005).
- [x] Consumer que consulta el estado actual antes de enviar (`/api/reminders/deliver`).
- [x] Web Push con suscripciones revocables (`web-push` + VAPID + `push_subscriptions`).

## Criterios de aceptación

- [x] No se envía T+1 si la timbrada ya existe (verificado en vivo: ver handoff).
- [x] No se duplican recordatorios tras reintentos (cron llamado dos veces contra un deploy real: 20 creados, luego 0).
- [x] Se respeta `America/Guayaquil`.
- [x] Prueba con cambio de día y fin de semana.

Ver `handoffs/T-005-scheduler.md` para el detalle de la verificación end-to-end contra infraestructura real (Postgres, QStash y un deploy de vista previa).

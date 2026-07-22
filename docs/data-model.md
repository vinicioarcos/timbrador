# Modelo de datos

Entidades principales:

- `users`
- `schedule_items`
- `session_instances`
- `punch_events`
- `punch_corrections`
- `reminder_events`
- `push_subscriptions`
- `audit_log`

La restricción crítica es un índice único parcial que impida dos sesiones activas para el mismo usuario.

## `punch_events` es append-only

`punch_events` nunca se edita ni se borra una fila después de insertada — es
el registro de auditoría de lo que realmente ocurrió (cada intento de
timbrar, exitoso o no). Cuando la hora real de un evento no coincide con lo
que pasó de verdad (p. ej. el clic no llegó al servidor a tiempo por un
problema de red), la corrección **no edita esa fila**: se inserta una fila
aparte en `punch_corrections`, que referencia el evento original y guarda la
hora corregida, el motivo y quién la hizo (`lib/punch-store.ts
createPunchCorrection`). Un evento admite a lo sumo una corrección (índice
único en `punch_event_id`). El historial del dashboard muestra ambas horas
(original y corregida) y el motivo — nunca oculta que hubo un ajuste — y el
cálculo de puntualidad (`ON_TIME`/`LATE`) usa la hora corregida cuando
existe (`lib/dashboard-view.ts toPunchRecordView`).

Ver `db/schema.sql`.

# Modelo de datos

Entidades principales:

- `users`
- `schedule_items`
- `session_instances`
- `punch_events`
- `reminder_events`
- `push_subscriptions`
- `audit_log`

La restricción crítica es un índice único parcial que impida dos sesiones activas para el mismo usuario.

Ver `db/schema.sql`.

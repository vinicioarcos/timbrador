# Máquina de estados

```mermaid
stateDiagram-v2
    [*] --> SCHEDULED
    SCHEDULED --> PRE_ALERTED: T-3 min
    PRE_ALERTED --> DUE: hora programada
    DUE --> ACTIVE: ingreso confirmado
    DUE --> MISSED_ENTRY: T+1 sin ingreso
    MISSED_ENTRY --> ACTIVE: ingreso tardío confirmado
    ACTIVE --> EXIT_PRE_ALERTED: T-3 min salida
    EXIT_PRE_ALERTED --> EXIT_DUE: hora de salida
    EXIT_DUE --> COMPLETED: salida confirmada
    EXIT_DUE --> MISSED_EXIT: T+1 sin salida
    MISSED_EXIT --> COMPLETED: salida tardía confirmada
```

## Estado de bloqueo transversal

Una actividad en `DUE` o `MISSED_ENTRY` no puede pasar a `ACTIVE` si existe otra sesión activa. En ese caso la UI muestra `BLOCKED_BY_ACTIVE_SESSION` como estado derivado, pero no se crea una segunda sesión.

## Invariantes

- `count(ACTIVE sessions per user) <= 1`
- `exitAt >= entryAt`
- `actual event` nunca borra el `scheduled event`
- una transición repetida con la misma clave es idempotente

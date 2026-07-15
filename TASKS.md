# TASKS — Tablero maestro

Estados: `BACKLOG`, `READY`, `IN_PROGRESS`, `REVIEW`, `DONE`, `BLOCKED`.

| ID | Estado | Prioridad | Responsable sugerido | Tarea |
|---|---|---:|---|---|
| T-001 | REVIEW | P0 | Product/Domain | Confirmar transcripción del horario base |
| T-002 | DONE | P0 | Architect | Definir reglas, estados y arquitectura |
| T-003 | DONE | P0 | Frontend | Crear dashboard prototipo |
| T-004 | DONE | P0 | Backend | Implementar persistencia PostgreSQL |
| T-005 | READY | P0 | Scheduler | Implementar recordatorios fiables y Web Push |
| T-006 | DONE | P0 | Backend | Implementar API de sesiones/timbradas idempotente |
| T-007 | BLOCKED | P0 | Integration | Integrar timbrado institucional autorizado |
| T-008 | READY | P1 | QA | Pruebas de reglas temporales y concurrencia |
| T-009 | READY | P1 | Security | Revisión de autenticación, secretos y auditoría |
| T-010 | READY | P1 | DevOps | CI/CD GitHub → Vercel |
| T-011 | READY | P1 | Frontend | Convertir prototipo en PWA instalable |
| T-012 | READY | P2 | Analytics | Reportes de puntualidad y omisiones |
| T-013 | DONE | P0 | Backend | Corregir cálculo horario a America/Guayaquil en `lib/schedule.ts` |
| T-015 | DONE | P0 | Backend | Reconciliar instancias SCHEDULED con clockIn (ACTIVE) |

Los detalles y criterios de aceptación están en `tasks/`.

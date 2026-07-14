# ADR-0001 — Stack base

**Estado:** Accepted

## Decisión

Usar Next.js App Router + TypeScript para el dashboard y API; PostgreSQL para persistencia; Vercel para hosting; GitHub para control de versiones y CI.

## Razones

- una sola base de código para UI y backend;
- despliegue directo en Vercel;
- buena compatibilidad con PWA y Web Push;
- PostgreSQL permite restricciones fuertes e historial auditable.

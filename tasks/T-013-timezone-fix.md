# T-013 — Corregir cálculo horario a America/Guayaquil

**Estado:** DONE
**Prioridad:** P0
**Owner sugerido:** Backend

## Contexto

`lib/schedule.ts` calcula `currentWeekDay`, `nowMinutes`, `itemForNow` y `nextItem` usando `Date.getHours()` / `Date.getDay()` nativos de JS, sin conversión a `America/Guayaquil`. Esto depende de la zona horaria del proceso donde corre Next.js: funciona por casualidad en una máquina local ubicada en Guayaquil, pero queda desfasado en Vercel (UTC) o en cualquier entorno con otra zona horaria.

Viola BR-001 (`docs/business-rules.md`) y la regla crítica de `AGENTS.md`: "Todas las horas se calculan en America/Guayaquil".

## Objetivo

Introducir un helper de zona horaria explícito y usarlo en todos los cálculos de hora/día de `lib/schedule.ts`, de modo que el resultado sea correcto sin importar la zona horaria del servidor.

## Alcance

- Crear una función (p. ej. `nowInGuayaquil(date: Date)`) basada en `Intl.DateTimeFormat` con `timeZone: TIMEZONE` (o equivalente) que derive día de semana, hora y minutos locales de Guayaquil a partir de un `Date` UTC.
- Reemplazar los usos de `date.getHours()`, `date.getMinutes()`, `date.getDay()` en `currentWeekDay`, `nowMinutes`, `itemForNow`, `nextItem` por el nuevo helper.
- No modificar la forma de los datos de `data/schedule.seed.json` ni las reglas de negocio.
- No tocar `lib/integrations/*` ni la UI salvo si consumen directamente las funciones afectadas.

## Fuera de alcance

- Persistencia PostgreSQL (T-004).
- API de sesiones/timbradas (T-006).
- Recordatorios/push (T-005).

Si alguna de estas dependencias resulta necesaria para completar T-013, registrar el bloqueo en vez de ampliar el alcance.

## Criterios de aceptación

- [x] Ningún cálculo de hora/día en `lib/schedule.ts` usa métodos de `Date` sensibles a la zona horaria local del proceso sin pasar antes por el helper de `America/Guayaquil`.
- [x] Prueba manual con script que simula ejecución con `TZ=UTC` vs. sin `TZ` (Guayaquil) confirma que `guayaquilParts` (usado por `nowMinutes`/`currentWeekDay`, de los que dependen `itemForNow`/`nextItem`) devuelve el mismo resultado sin importar el `TZ` del proceso.
- [x] `npm run validate:schedule` sigue pasando.
- [x] `npm run typecheck` pasa (exit code 0, sin errores). El bloqueo previo era `package-lock.json` con URLs "resolved" apuntando a un gateway interno inalcanzable desde este entorno (`packages.applied-caas-gateway1.internal.api.openai.org`); se regeneró el lockfile contra el registro público (`registry.npmjs.org`, confirmado alcanzable) y la instalación quedó completa. Ver detalle en el handoff.
- [x] Handoff creado en `handoffs/T-013-backend.md`.

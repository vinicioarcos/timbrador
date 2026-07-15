# Handoff T-014 — Frontend

## Resumen

El dashboard (T-003, prototipo) usaba `localStorage` para la sesión activa y el historial. Se conectó al backend real construido en T-004/T-006/T-015: `app/dashboard/page.tsx` (Server Component) ahora lee la sesión activa y el historial de hoy desde Postgres al cargar, y los botones de timbrar ingreso/salida ejecutan `clockIn`/`clockOut` reales vía Server Actions.

## Archivos modificados/nuevos

- `lib/schedule.ts`: se agregó `guayaquilTimeString(date)` — formatea un instante como "HH:MM" en `America/Guayaquil`, para mostrar horas reales de Postgres sin depender de la zona horaria del dispositivo del usuario (BR-001).
- `lib/dashboard-view.ts` (nuevo): `toActiveSessionView`/`toPunchRecordView` — funciones puras que mapean `SessionInstance`/`PunchAuditEntry` (formas reales de Postgres) a los tipos que ya usaba la UI (`ActiveSession`/`PunchRecord`), para no reescribir el render existente. Se usan tanto en el servidor (`page.tsx`, estado inicial) como en el cliente (`dashboard-client.tsx`, tras cada Server Action), evitando duplicar la lógica de formato.
- `app/dashboard/actions.ts`: se agregaron `clockInAction`/`clockOutAction` — Server Actions que resuelven el usuario autenticado (`getSessionUsername`, de T-005) y llaman a `lib/punch-commands.ts`.
- `app/dashboard/page.tsx`: ahora obtiene `findActiveSession` + `listAudit(username, { date: hoy })` y pasa el estado inicial ya mapeado como props a `DashboardClient`.
- `app/dashboard/dashboard-client.tsx`: se eliminaron los dos `useEffect` de `localStorage` y las constantes `STORAGE_ACTIVE`/`STORAGE_HISTORY`; recibe `initialActive`/`initialHistory` como props; `clockIn`/`clockOut` ahora son `async`, llaman a las Server Actions con una `idempotencyKey` generada en el cliente (`crypto.randomUUID()`), actualizan el estado local con la respuesta real (`ClockOutcome`), y muestran `result.reason` como aviso si el backend rechaza la solicitud. Se agregó un estado `pending` para deshabilitar los botones mientras la Server Action está en vuelo (evita doble clic disparando dos solicitudes). El texto "Hoy" del historial ahora compara con `guayaquilDateString(now)` en vez de `toLocaleDateString` (zona horaria del dispositivo).
- `tasks/T-014-connect-dashboard-ui.md`, `TASKS.md`.

## Decisiones

- La `idempotencyKey` se genera en el **cliente** (no en la Server Action) para que, si el usuario hace doble clic o el navegador reintenta la solicitud, ambos intentos compartan la misma key y la segunda quede naturalmente deduplicada por `clockIn`/`clockOut` (BR-009), en vez de crear dos timbradas.
- Las funciones de mapeo (`lib/dashboard-view.ts`) son puras y sin `"use client"`/`"use server"`, para poder importarlas desde ambos lados sin duplicar código. Solo importan *tipos* de `lib/punch-store.ts` (`import type`), que TypeScript borra en tiempo de compilación, así que no arrastran código de servidor (pg) al bundle del cliente.
- Se mantuvo el alcance acotado a "estado de hoy": navegar historial de días anteriores queda fuera de alcance (ya documentado en la tarea); es un hueco conocido del MVP general, no específico de esta tarea.

## Comandos ejecutados

- `npm run typecheck` → pasa.
- `npm run validate:schedule` → pasa.
- **Verificación en navegador real** (no solo scripts, siguiendo la guía del proyecto para cambios de UI): se lanzó `npm run dev` y se condujo un navegador Chromium real vía Playwright (ya instalado en la máquina, sin agregarlo como dependencia del proyecto — se ejecutó desde la caché de `npx`). Se hizo login real con las credenciales de la app, se confirmó que el dashboard carga sin errores mostrando el estado real de Postgres, y — usando `page.clock.install` para simular la hora del **navegador** dentro de un bloque de hoy (el servidor sigue usando su hora real para `clockIn`, no la del navegador) — se hizo clic en "Timbrar ingreso" y luego "Timbrar salida". Resultado: la sesión pasó a `ACTIVA` con la hora real del servidor, el historial mostró la timbrada real marcada `TARDÍA` (correcto: la hora real del servidor eran las 16:08, muy después de las 14:00 programadas), y no hubo errores de consola. Se verificó directamente en Postgres que ambos eventos (`ENTRY`/`EXIT`, `SUCCESS`) quedaron registrados, y se limpiaron después (datos de prueba, no del usuario).

## Hallazgo (no es un bug, es una nota para el futuro)

Durante la verificación se confirmó que **`DATABASE_URL` es la misma para desarrollo local, preview y producción** (la integración de Neon no creó bases/ramas separadas por entorno). Esto significa que correr `npm run dev` localmente lee y escribe en la misma base que usa la app en producción. Es aceptable para este MVP de un solo desarrollador/usuario, pero vale la pena tenerlo presente: cualquier prueba manual local afecta el mismo Postgres que ve el usuario real. Si el equipo crece, considerar una base de desarrollo separada (Neon soporta "branches" de base de datos para esto).

## Riesgos / pendientes

- Historial de días anteriores no implementado (ver "Fuera de alcance" en la tarea).
- La base de datos compartida entre entornos (ver hallazgo arriba) — no es un defecto de esta tarea, pero condiciona cómo se deben hacer pruebas manuales de aquí en adelante.

## Archivos bloqueados temporalmente

Ninguno.

## Recomendación para el siguiente agente

1. Revisar y mover a `DONE` si los criterios se consideran satisfechos.
2. Con T-014 cerrada, el MVP funcional (horario, sesión activa, timbrado idempotente, recordatorios reales, dashboard conectado) queda completo de punta a punta. Los pendientes P1/P2 restantes (T-008 pruebas, T-009 seguridad, T-010 CI/CD, T-011 PWA, T-012 analytics) son de robustecimiento, no de funcionalidad faltante.
3. Rama de trabajo: `agent/frontend/T-014-connect-dashboard-ui`. Falta el merge a `master` cuando se apruebe.

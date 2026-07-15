# T-014 — Conectar la UI del dashboard al backend real

**Estado:** REVIEW
**Prioridad:** P0
**Owner sugerido:** Frontend

## Contexto

El prototipo de dashboard (T-003) guarda la actividad activa y el historial en `localStorage` del navegador. Desde T-004/T-006/T-015 existe un backend real (Postgres + `clockIn`/`clockOut` idempotentes, con las invariantes de dominio aplicadas), pero la UI nunca se conectó a él — quedó anotado como pendiente explícito en varios handoffs (T-006, T-004, T-005).

## Objetivo

Que el dashboard lea el estado real (sesión activa, historial de hoy) desde Postgres al cargar la página, y que los botones de timbrar ingreso/salida llamen a los comandos reales (`lib/punch-commands.ts`) en vez de mutar `localStorage`.

## Alcance

- `app/dashboard/page.tsx` (Server Component): obtener la sesión activa y el historial de **hoy** del usuario autenticado desde Postgres, pasarlos como props iniciales.
- `app/dashboard/actions.ts`: agregar `clockInAction`/`clockOutAction` (Server Actions) que llaman a `clockIn`/`clockOut` con el usuario de la sesión.
- `app/dashboard/dashboard-client.tsx`: eliminar los `useEffect` de `localStorage`; usar las props iniciales y actualizar el estado local con el resultado real de las Server Actions.
- Agregar helper `guayaquilTimeString` a `lib/schedule.ts` y funciones de mapeo puras en `lib/dashboard-view.ts` (server↔cliente) para no duplicar lógica de formato.

## Fuera de alcance

- Historial de días anteriores (navegar fechas pasadas) — el prototipo y esta tarea solo muestran el historial de hoy. `PROJECT.md` lo menciona como alcance MVP general; si se quiere, registrar como tarea aparte.
- Materializar el día en el propio dashboard — ya lo hace el cron de T-005.

## Criterios de aceptación

- [x] Al cargar el dashboard, la actividad activa y el historial de hoy reflejan lo que hay en Postgres, no `localStorage`.
- [x] Timbrar ingreso/salida desde la UI ejecuta `clockIn`/`clockOut` reales (invariantes de sesión única y auditoría aplicadas).
- [x] Un rechazo del backend (p. ej. sesión ya activa) se muestra como aviso en la UI, no como error sin manejar.
- [x] `npm run typecheck` y `npm run validate:schedule` pasan.
- [x] Verificado en un navegador real (Playwright + Chromium, no solo scripts) contra el servidor de desarrollo con la base real conectada.
- [x] Handoff creado en `handoffs/T-014-frontend.md`.

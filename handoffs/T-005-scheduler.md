# Handoff T-005 — Scheduler

## Resumen

Se implementó el planificador de recordatorios T-3/T+1 completo: generación diaria idempotente, entrega diferida real vía Upstash QStash (`notBefore` absoluto), un consumidor que verifica el estado real antes de enviar, y Web Push real con VAPID (suscripción, envío, poda de suscripciones revocadas).

Antes de implementar, se confirmó con el usuario que el plan de Vercel es **Hobby** (cron solo diario), lo que hace obligatoria una cola de entrega diferida — no es una decisión de sobre-ingeniería, es lo que permite que los avisos disparen a la hora exacta sin un cron por minuto. Se pidió consentimiento explícito antes de instalar Upstash QStash (integración de Vercel Marketplace) y aceptar sus términos.

## Infraestructura provisionada

- Integración **Upstash QStash** vía Vercel Marketplace (`vercel install upstash/upstash-qstash`), conectada al proyecto. Variables `QSTASH_URL`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` gestionadas automáticamente por la integración.
- Llaves **VAPID** generadas con `web-push` (una sola vez, guardadas como secretos): `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (no sensible, expuesta al cliente), `VAPID_PRIVATE_KEY` (sensible), `VAPID_SUBJECT` (`mailto:vinicioarcos123@gmail.com`) — las tres en producción/preview/desarrollo.

## Archivos nuevos/modificados

- `docs/adr/0005-reminders-delivery.md` (nuevo): justifica QStash + web-push.
- `lib/users-repository.ts` (nuevo): `resolveUserUuid` extraído de `lib/punch-store.ts` (lo necesitan también recordatorios y push).
- `lib/reminders.ts` (nuevo): funciones puras — `reminderPlanForItem` (calcula los 4 avisos T-3/T+1 de entrada/salida de un bloque, en `America/Guayaquil`) y `reminderMessage` (textos de `docs/notification-policy.md`).
- `lib/reminder-store.ts` (nuevo): repositorio Postgres de `reminder_events` — `createReminderIfMissing` (idempotente vía `ON CONFLICT (idempotency_key) DO NOTHING`), `setQstashMessageId`, `getReminderById`, `markReminderStatus`.
- `lib/push.ts` (nuevo): `saveSubscription`/`removeSubscription` (CRUD de `push_subscriptions`) y `sendPushToUser` (envía con `web-push`, poda suscripciones que devuelven 404/410).
- `lib/auth.ts`: se agregó `getSessionUsername()` — variante de `requireSession()` que no redirige, para usar en rutas de API JSON.
- `lib/schedule.ts`: se agregó `weekDayToNumber(day)` (mapea `WeekDay` a 1-5, ya lo necesitaban tanto el cron como pruebas anteriores de forma improvisada).
- `app/api/cron/seed-reminders/route.ts` (reescrito): materializa las sesiones del día (`materializeDailySessions`, T-015) y programa los 4 avisos por bloque en QStash.
- `app/api/reminders/deliver/route.ts` (nuevo): verificado con `verifySignatureAppRouter` de QStash; decide enviar u omitir según si la timbrada ya ocurrió, envía Web Push, y marca el estado.
- `app/api/push/subscribe/route.ts`, `app/api/push/unsubscribe/route.ts` (nuevos).
- `app/dashboard/dashboard-client.tsx`: el botón "Activar notificaciones" ahora registra el service worker, se suscribe con `pushManager.subscribe` (llave VAPID pública), y envía la suscripción a `/api/push/subscribe`. Esto sí estaba dentro del alcance de T-005 (a diferencia de conectar `clockIn`/`clockOut`, que sigue pendiente y fuera de alcance).
- `db/schema.sql`: `reminder_events` gana la columna `qstash_message_id` (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, idempotente).
- `package.json`/`package-lock.json`: se agregaron `@upstash/qstash`, `web-push`, `@types/web-push`.

## Decisiones

- `notBefore` (timestamp absoluto) en vez de `delay` relativo: evita que un cron que corre tarde desplace todos los avisos del día.
- El consumidor (`/api/reminders/deliver`) es la única fuente de verdad sobre "¿ya se envió/omitió?" — el cron nunca decide eso, solo programa. Esto es importante porque el estado de la timbrada puede cambiar entre el momento en que se programa el aviso (de madrugada) y el momento en que debería dispararse (horas después).
- No se implementó cancelación proactiva de mensajes QStash ya programados cuando el usuario timbra antes de tiempo (ver ADR-0005): el consumidor igual detecta el estado real al momento de la entrega y omite el envío si ya no corresponde. Cancelar sería una optimización (menos invocaciones de QStash), no una corrección de comportamiento.
- Se reutilizó el mismo patrón de "antifatiga" ya sugerido por `docs/notification-policy.md`, pero no se implementaron los reintentos a T+5/T+10 sugeridos ahí como "por ejemplo" — quedan fuera de alcance literal de los 4 criterios de aceptación de T-005; se puede agregar como refinamiento si se pide explícitamente.

## Comandos ejecutados

- `npm install @upstash/qstash web-push` + `npm install -D @types/web-push`.
- `npm run typecheck` → pasa.
- `npm run validate:schedule` → pasa.
- `node --env-file=.env.local scripts/migrate.mjs` → aplica la columna nueva de `reminder_events`.
- Verificación de lógica pura contra Postgres real (carpeta temporal, borrada al terminar): generación de 4 avisos por bloque, idempotencia (repetir no duplica), corrección de zona horaria (`PRE_ENTRY` exactamente 3 minutos antes del inicio en `America/Guayaquil`), fin de semana (`currentWeekDay`/`todaySchedule` vacíos en sábado), y la decisión de "antifatiga" (omitir tras `clockIn`). Todos los checks pasaron.
- **Verificación end-to-end contra infraestructura real**, no solo simulada:
  1. `npx vercel deploy` (preview, no producción) de esta rama.
  2. Se llamó el cron real (`curl` con `CRON_SECRET`) contra el preview: creó 20 recordatorios (5 bloques × 4 avisos) y programó 20 mensajes reales en QStash (`qstash_message_id` presente en los 20).
  3. Se llamó el cron una segunda vez: `remindersCreated: 0` — idempotencia confirmada contra el sistema real, no solo en memoria.
  4. Varios avisos cuya hora ya había pasado (el cron se corrió a media mañana) fueron entregados de verdad por QStash al preview y quedaron en estado `SENT` — prueba de que QStash llamó de vuelta, la firma se verificó, y el handler corrió.
  5. Se hizo un `clockIn` real (invocando `lib/punch-commands.ts` directamente) para un bloque cuyo aviso `PRE_ENTRY` seguía `PENDING`, y se programó su entrega inmediata (QStash, `notBefore` +3s) apuntando al mismo `reminderId`. A los pocos segundos, el aviso pasó a `SKIPPED` — confirma en vivo que "no se envía T+1 si la timbrada ya existe" (en este caso, tampoco el T-3).
  6. Se limpiaron todos los datos de prueba (`reminder_events`, `punch_events`, `session_instances`) al terminar.

## Riesgos / pendientes

- No hay reintentos escalonados (T+5, T+10) para avisos `URGENT` no reconocidos — `docs/notification-policy.md` los menciona como sugerencia ("por ejemplo"), no como requisito duro; quedaría para una iteración futura si se pide.
- No se implementó cancelación de mensajes QStash ya programados (ver Decisiones) — no es necesaria para la corrección, solo ahorraría invocaciones.
- El dashboard sigue usando `localStorage` para las timbradas del prototipo (T-006/T-004/T-015 ya construyeron el backend real, pero conectar la UI sigue pendiente, fuera de alcance — ver handoffs anteriores). Esto significa que, hasta que se conecte, los recordatorios reales (generados por este cron) pueden no coincidir con lo que el usuario ve/hace en el dashboard, porque el dashboard no llama a `clockIn`/`clockOut` reales todavía.
- El deploy de vista previa usado para verificar (`https://9-timbra-academica-agentic-1qwnhq055-edwins-projects-f0f5d6e3.vercel.app`) queda existente en Vercel; no se borró (los previews de Vercel no afectan producción ni tienen costo relevante en este plan).

## Archivos bloqueados temporalmente

Ninguno.

## Recomendación para el siguiente agente

1. Revisar y mover a `DONE` si los criterios se consideran satisfechos.
2. Conectar la UI del dashboard a `clockIn`/`clockOut`/suscripción real sigue siendo la brecha más grande para que el sistema funcione de extremo a extremo para el usuario final — sugiero registrar esto como tarea explícita (T-014, ya mencionada en handoffs anteriores) antes de dar por cerrado el MVP.
3. Rama de trabajo: `agent/scheduler/T-005-reminders-push`. Falta el merge a `master` cuando se apruebe.

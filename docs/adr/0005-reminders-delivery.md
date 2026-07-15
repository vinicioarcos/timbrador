# ADR-0005 — Entrega de recordatorios: Upstash QStash + web-push

**Estado:** Accepted

## Contexto

ADR-0002 ya decidió no depender de un cron por minuto: un planificador diario genera eventos futuros con entrega diferida a una cola, y un consumidor envía Web Push. Se confirmó que el plan de Vercel de este proyecto es **Hobby**, que solo permite cron diario (coincide con el único cron ya configurado en `vercel.json`, `5 5 * * *`). Sin un mecanismo de entrega diferida real, no hay forma de disparar los avisos T-3/T+1 a la hora exacta durante el día desde una sola invocación diaria.

## Decisión

Usar **Upstash QStash** (`@upstash/qstash`) como la cola con entrega diferida: el cron diario programa un mensaje por cada aviso T-3/T+1 del día, con `notBefore` (timestamp absoluto) en vez de un delay relativo, para evitar desvíos de reloj. QStash llama de vuelta a un endpoint propio (`/api/reminders/deliver`) a la hora programada, verificado con la firma de QStash (`verifySignatureAppRouter`).

Usar **`web-push`** (con llaves VAPID propias, generadas una sola vez y guardadas como secretos de Vercel) para el envío real de Web Push, sin depender de un proveedor de push adicional — el navegador ya expone el endpoint push de su proveedor (FCM, Mozilla, etc.) vía la Push API estándar.

## Razones

- QStash es HTTP puro (sin SDK de infraestructura pesada), tiene tier gratuito suficiente para el volumen de este MVP (un usuario, ~25 bloques/semana, 4 avisos por bloque como máximo), y es la integración recomendada por Vercel para este patrón exacto en planes sin cron frecuente.
- `notBefore` (timestamp absoluto) en vez de `delay` (relativo) evita que un retraso en la ejecución del cron diario desplace todos los avisos del día.
- `web-push` es el estándar de facto para Web Push en Node sin atarse a un proveedor; las llaves VAPID son autogestionadas, no requieren cuenta externa.

## Consecuencias

- Nuevo secreto `VAPID_PRIVATE_KEY` (servidor) y `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (cliente, para `pushManager.subscribe`), configurados en Vercel (producción/preview/desarrollo).
- Nuevas variables `QSTASH_URL`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` (provistas automáticamente por la integración de Vercel Marketplace, no gestionadas a mano).
- El endpoint `/api/reminders/deliver` debe verificar la firma de QStash antes de procesar cualquier request, para que no pueda ser invocado por terceros para disparar pushes arbitrarios.
- Si en el futuro se necesita cancelar un aviso ya programado en QStash (p. ej. el usuario timbra antes de que llegue el T-3), es una mejora posible pero no implementada en T-005: el consumidor ya verifica el estado real antes de enviar, así que un aviso "obsoleto" simplemente se omite al llegar, en vez de cancelarse proactivamente.

# Seguridad

## Credenciales

- Usuario y contraseña de la app se administran mediante secretos de entorno durante el MVP.
- La contraseña se almacena como hash `scrypt`, nunca en texto plano.
- Las credenciales del sistema institucional no se guardan en el repositorio.

## Integración externa

Preferencia:

1. API oficial con token revocable.
2. SSO/OAuth institucional.
3. Automatización aprobada y aislada, solo si no existe API.

No usar scraping de login como solución por defecto.

## Auditoría

Toda acción debe quedar trazada, incluidos errores y duplicados rechazados.

## Riesgos

- reloj del dispositivo incorrecto;
- notificaciones del navegador deshabilitadas;
- latencia del proveedor de push;
- duplicados por reintentos;
- cambios semestrales del horario;
- indisponibilidad del sistema institucional.

## Sesión

- El token de sesión (`lib/auth.ts`) va firmado con HMAC-SHA256 (`SESSION_SECRET`) y **expira del lado del servidor** (no solo por el `maxAge` de la cookie): `verifySessionToken` rechaza cualquier token con más de 12 horas desde su emisión, aunque la firma sea válida.
- La comparación de secretos (firma de sesión, `CRON_SECRET`) siempre usa `timingSafeEqual`, nunca `===`/`!==`, para no exponer un canal de timing.
- Las suscripciones Web Push solo pueden crearse/borrarse por el usuario autenticado dueño de la suscripción (`/api/push/subscribe`, `/api/push/unsubscribe`).

## Cabeceras HTTP

`next.config.ts` agrega `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy` (sin cámara/micrófono/geolocalización, consistente con "fuera del MVP" en `PROJECT.md`).

## Pendiente (T-009, revisado pero no implementado)

- **Sin límite de intentos de login.** No hay rate limiting ni bloqueo tras intentos fallidos repetidos en `/login`. Con un solo usuario y una contraseña fuerte generada aleatoriamente el riesgo es bajo, pero si se expone más ampliamente convendría agregar un limitador (p. ej. vía Upstash Ratelimit, ya que Upstash ya está integrado para QStash).

# Handoff T-009 — Security

## Resumen

Revisión de autenticación, secretos, cabeceras HTTP y exposición de datos.
Se corrigieron 3 hallazgos de riesgo medio/alto y se documentaron 2 de riesgo
bajo como pendientes no bloqueantes. No se tocó el modelo de horario ni la
lógica de negocio de timbradas.

## Archivos modificados

- `lib/auth.ts` — expiración real de sesión del lado del servidor
  (`verifySessionToken` valida `issuedAt` contra `SESSION_MAX_AGE_SECONDS`,
  no solo la firma HMAC) y nueva `verifyBearerSecret` con `timingSafeEqual`.
- `app/api/cron/seed-reminders/route.ts` — usa `verifyBearerSecret` en vez de
  comparar `CRON_SECRET` con `!==`.
- `lib/push.ts` — nueva `removeSubscriptionForUser(userId, endpoint)`, borra
  filtrando por `user_id` además de `endpoint`.
- `app/api/push/unsubscribe/route.ts` — usa `removeSubscriptionForUser` en
  vez de `removeSubscription` (que ya no se llama desde ninguna ruta pública).
- `next.config.ts` (nuevo) — cabeceras `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Permissions-Policy` restrictivo.
- `.env.example` — agrega `DATABASE_URL`, variables QStash y VAPID (T-004/T-005
  las habían introducido sin actualizar este archivo) y comentarios con los
  comandos para generar cada secreto.
- `docs/security.md` — documenta el modelo de sesión, la política de
  comparación de secretos, el alcance de las suscripciones push, las
  cabeceras HTTP y el pendiente de rate limiting en `/login`.
- `tasks/T-009-security.md` — hallazgos y checklist de aceptación.

## Decisiones

- La expiración de sesión se calcula desde `issuedAt` embebido en el propio
  payload firmado (no en una tabla de sesiones), consistente con el diseño
  stateless existente — evita introducir un store de sesiones para un solo
  usuario.
- `removeSubscription` (sin escopar) se deja en `lib/push.ts` porque no hay
  otro llamador; si en el futuro se necesita borrado administrativo sin
  usuario, ya existe la función de base.
- El rate limiting de `/login` (hallazgo #4) se deja pendiente: con un solo
  usuario y contraseña fuerte generada aleatoriamente el riesgo es bajo, y
  ya hay una integración de Upstash en el proyecto (QStash) por si se quiere
  usar Upstash Ratelimit más adelante — evita agregar una dependencia nueva
  solo para esto ahora.

## Comandos ejecutados

```
npm run typecheck        # OK
npm run validate:schedule  # OK — "Horario válido: 25 bloques..."
```

## Pruebas

- `npm run typecheck` y `npm run validate:schedule` pasan (ver arriba).
- Verificado en local (2026-07-22): `curl -I http://localhost:3000/login`
  devuelve las 4 cabeceras de seguridad; script standalone reimplementando
  `verifySessionToken` confirma que un token de 1 min es válido, uno de 13h
  se rechaza y uno con firma alterada se rechaza.
- Login verificado end-to-end tanto en local como en el deploy de Vercel,
  con credenciales rotadas (`APP_USERNAME`/`APP_PASSWORD_HASH`) como parte
  de esta verificación — el usuario no recordaba las credenciales previas.

## Riesgos / pendientes

- Hallazgo #4 (sin límite de intentos en `/login`) — documentado en
  `docs/security.md`, no corregido.

## Archivos bloqueados temporalmente

Ninguno.

## Recomendación para el siguiente agente

Si se decide atacar el hallazgo #4 (rate limiting en `/login`), usar Upstash
Ratelimit ya que Upstash ya está integrado en el proyecto vía QStash — evita
una dependencia nueva.

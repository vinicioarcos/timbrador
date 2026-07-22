# T-009 — Revisión de seguridad

**Estado:** DONE  
**Owner sugerido:** Security

Revisar autenticación, cookies, CSRF, XSS, secretos, logs, dependencia de hora local y exposición de datos de horarios.

## Hallazgos

1. **[Alto] Los tokens de sesión no expiran del lado del servidor.** `verifySessionToken` solo valida la firma HMAC, nunca compara `issuedAt` contra un máximo. La cookie tiene `maxAge` de 12h, pero eso solo controla si el *navegador* sigue enviándola — un token extraído por cualquier medio (log, backup, etc.) sigue siendo válido para siempre.
2. **[Medio] `CRON_SECRET` se compara con `!==`, no en tiempo constante.** Riesgo de timing attack (bajo en la práctica por HTTPS/jitter de red, pero es la práctica incorrecta para comparar secretos).
3. **[Medio] `/api/push/unsubscribe` no valida que la suscripción pertenezca al usuario autenticado** — borra por `endpoint` sin filtrar por `user_id`. Con un solo usuario hoy no es explotable, pero es un hueco de diseño.
4. **[Bajo] Sin protección contra fuerza bruta en `/login`** — no hay límite de intentos ni backoff.
5. **[Bajo] Sin cabeceras de seguridad configuradas** (no existe `next.config.*`) — sin `X-Frame-Options`/`frame-ancestors` (riesgo de clickjacking en `/login`), sin `Referrer-Policy` explícito.
6. **[Bajo/doc] `.env.example` desactualizado** — no menciona `DATABASE_URL`, las llaves VAPID ni las variables de QStash agregadas en T-004/T-005.

Ver `handoffs/T-009-security.md` para qué se corrigió y qué queda como recomendación.

## Criterios de aceptación

- [x] Hallazgo #1 corregido (expiración real de sesión).
- [x] Hallazgo #2 corregido (comparación en tiempo constante).
- [x] Hallazgo #3 corregido (suscripciones push escopadas por usuario).
- [x] Cabeceras de seguridad básicas agregadas.
- [x] `.env.example` actualizado.
- [x] `npm run typecheck` y `npm run validate:schedule` pasan.
- [x] Verificado contra un deploy real (login, expiración de sesión, cabeceras).

Verificado 2026-07-22: cabeceras confirmadas con `curl -I` en local, expiración
de sesión confirmada con script directo (token fresco válido, token de 13h
rechazado, firma alterada rechazada), y login confirmado tanto en local como
en el deploy de Vercel con las credenciales finales (`APP_USERNAME`/
`APP_PASSWORD_HASH` rotados como parte de esta verificación).

Hallazgo #4 (fuerza bruta en `/login`) queda documentado como pendiente en
`docs/security.md`, sin bloquear el cierre de esta tarea (ver handoff).

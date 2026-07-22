# Handoff T-010 — DevOps

## Resumen

CI/CD estaba parcialmente listo pero roto: el workflow de GitHub Actions
nunca se había ejecutado por un mismatch de nombre de rama, y Vercel ya
estaba conectado al repo (auto-deploy en push a `master`) sin que quedara
documentado. Se corrigió el workflow y se documentó el estado real.

## Archivos modificados

- `.github/workflows/ci.yml` — `push.branches` de `[main]` a `[master]`
  (la rama por defecto real de este repo); `node-version` de 22 a 24 para
  igualar el runtime de Vercel.
- `tasks/T-010-cicd.md` — estado a DONE, hallazgo documentado, pendiente de
  lint anotado como no bloqueante.
- `TASKS.md` — T-010 a DONE.

## Decisiones

- No se agregó ESLint/lint al proyecto: Next 16 quitó `next lint` y no
  había configuración previa. Elegir linter/reglas es una decisión de
  tooling que no corresponde improvisar dentro de este cierre; queda
  anotado como pendiente no bloqueante en `tasks/T-010-cicd.md`.
- No se creó un workflow de deploy en GitHub Actions: Vercel ya despliega
  automáticamente vía su integración nativa de Git (confirmado con
  `vercel git connect`, que reportó que el repo ya estaba conectado, y con
  un deploy de producción que apareció en `vercel ls` inmediatamente
  después de un `git push` sin invocar `vercel deploy`). Añadir un paso de
  deploy manual en Actions sería redundante y una segunda fuente de verdad.

## Comandos ejecutados

```
npm run typecheck        # OK
npm run validate:schedule  # OK
npm run build             # OK, sin variables de entorno (rutas con DB son dinámicas)
gh run list                # vacío antes del fix — confirma que CI nunca corrió
vercel git connect         # "ya conectado" — confirma integración existente
vercel ls                  # confirma deploys automáticos en push a master
```

## Pruebas

- `npm run typecheck`, `npm run validate:schedule` y `npm run build` pasan.
- Verificación real pendiente: el próximo push a `master` debe disparar el
  workflow de CI (antes nunca corría) — confirmar en la pestaña Actions de
  GitHub tras este commit.

## Riesgos / pendientes

- No hay lint configurado (ver `tasks/T-010-cicd.md`).
- El workflow de CI valida pero no bloquea el deploy de Vercel (son dos
  sistemas independientes): un build roto en Vercel se detiene solo, pero
  un típo de lógica que pase `tsc`/`build` y aun así esté mal no lo
  detiene ninguno de los dos. Eso es lo que ya cubre T-008 (pruebas).

## Recomendación para el siguiente agente

Si se retoma T-008 (pruebas), correrlas también en este mismo workflow de
CI una vez existan, para que PRs futuros no dependan solo de
typecheck/build.

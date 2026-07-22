# T-010 — CI/CD

**Estado:** DONE
**Owner sugerido:** DevOps

## Hallazgo (2026-07-22)

`.github/workflows/ci.yml` ya existía desde el 2026-07-14, pero **nunca se
había ejecutado**: disparaba en `push: branches: [main]`, y la rama por
defecto de este repo es `master` (confirmado con `gh repo view
--json defaultBranchRef` y `git branch -a`). `gh run list` no mostraba
ningún run histórico. Corregido a `branches: [master]`, y el
`node-version` del job se alineó a 24 (igual que el runtime configurado en
el proyecto de Vercel, antes en 22).

Además se confirmó que **Vercel ya estaba conectado al repo de GitHub**
(`vercel git connect` reportó "ya conectado") y despliega automáticamente
en cada push a `master` — un deploy de producción apareció en `vercel ls`
minutos después de un `git push` sin que se ejecutara `vercel deploy`
manualmente. Eso ya cubría preview deployments, producción-solo-desde-rama-
por-defecto y separación de secretos (todos en Vercel/GitHub, ninguno en el
repo); el único gap real era el CI de GitHub Actions.

## Criterios

- [x] typecheck/build en PR y en push a `master` (`ci.yml`).
- [x] validación de horario en CI (`npm run validate:schedule`, ya estaba).
- [x] preview deployments (automático vía integración Git de Vercel, ya existía).
- [x] producción solo desde `master` (rama de producción configurada en Vercel, ya existía).
- [x] secretos únicamente en GitHub/Vercel (nunca hubo secretos en el repo).

## Pendiente (no bloqueante)

- **No hay lint configurado** (Next 16 removió `next lint`; no hay ESLint
  instalado en el proyecto). Agregar un linter es una decisión de tooling
  aparte — no se improvisó una configuración de ESLint sin que el equipo
  decida reglas/estilo. Si se quiere, es una tarea nueva pequeña, no parte
  de este cierre.

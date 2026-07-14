# T-001 — Confirmar horario

**Estado:** REVIEW  
**Owner sugerido:** Product/Domain

## Objetivo

Comparar `data/schedule.seed.json` con la fuente visual y confirmar cada bloque, especialmente límites de 30 minutos y la duración de Macroeconomía I del viernes.

## Criterios de aceptación

- [ ] 25 bloques confirmados o corregidos.
- [ ] `reviewRequiredBeforeProduction` cambia a `false` después de confirmación humana.
- [ ] `npm run validate:schedule` pasa.

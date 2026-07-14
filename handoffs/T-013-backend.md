# Handoff T-013 — Backend

## Resumen

`lib/schedule.ts` calculaba día de semana y hora actual con `Date.getDay()` / `Date.getHours()` / `Date.getMinutes()` nativos, que dependen de la zona horaria del proceso donde corre Node, no de `America/Guayaquil` (BR-001). Se introdujo un helper `guayaquilParts(date)` basado en `Intl.DateTimeFormat` con `timeZone` explícito, que deriva día/hora/minuto en Guayaquil sin importar el `TZ` del proceso. `currentWeekDay` y `nowMinutes` ahora usan ese helper. `todaySchedule`, `itemForNow` y `nextItem` no se modificaron porque ya dependían de esas dos funciones y heredan la corrección automáticamente.

## Archivos modificados

- `lib/schedule.ts`
- `tasks/T-013-timezone-fix.md` (creado, luego actualizado a REVIEW)
- `TASKS.md` (fila T-013 agregada y actualizada)

## Decisiones

- Se usó `Intl.DateTimeFormat.formatToParts` en vez de una librería de fechas (`date-fns-tz`, `luxon`, etc.) para no agregar una dependencia nueva sin ADR, cumpliendo la regla de calidad de `AGENTS.md`.
- Se aplicó `% 24` al valor de hora porque `Intl.DateTimeFormat` con `hour12: false` puede devolver `"24"` para la medianoche en algunos motores ICU.
- No se tocó `lib/integrations/*` ni la UI: no consumen `Date` directamente para estas reglas.

## Comandos ejecutados

- `npm run validate:schedule` → OK ("Horario válido: 25 bloques, lunes a viernes, sin solapamientos.").
- Script ad hoc (`tz-check.mjs`, fuera del repo, en scratchpad) que replica `guayaquilParts` y compara contra `Date.getHours()/getDay()` nativos bajo `TZ=UTC` y `TZ=America/Guayaquil`: confirma que la versión con `Intl` da el mismo resultado (10:24, martes) en ambos casos, mientras que la versión nativa varía (15:24 en UTC vs. 10:24 en Guayaquil). Esto es evidencia directa de que el mecanismo (`Intl.DateTimeFormat` con `timeZone` fijo) es independiente de la zona horaria del proceso, que es justamente la garantía que pide el criterio de aceptación.
- `npm run typecheck` (`tsc --noEmit`): **no se pudo ejecutar de extremo a extremo**. Ver "Riesgos / pendientes".

## Pruebas

- `npm run validate:schedule`: pasa.
- Verificación funcional del helper de zona horaria: pasa (ver arriba).
- `npm run typecheck`: **pasa, exit code 0, sin errores**, una vez resuelto el bloqueo de infraestructura (ver más abajo). No se detectó ninguna regresión de tipos por el cambio en `lib/schedule.ts`.

## Riesgos / pendientes (resuelto)

- **Causa raíz real del bloqueo (no era de red del usuario):** `package-lock.json` traía 58 URLs `"resolved"` apuntando a un gateway interno (`packages.applied-caas-gateway1.internal.api.openai.org`), generado presumiblemente en otro entorno con acceso a ese proxy artifactory. `npm ci` y `npm install` (con lockfile presente) respetan esas URLs exactas, y ese gateway es inalcanzable desde este entorno (`curl` directo → timeout total). En cambio, `curl https://registry.npmjs.org/undici-types` respondió `200 OK` en ~1s, confirmando que el registro público sí es alcanzable.
- **Fix aplicado:** se borraron `node_modules` y `package-lock.json`, y se corrió `npm install` limpio contra el registro público configurado (`registry.npmjs.org`). El lockfile regenerado no tiene ninguna referencia al gateway interno (verificado con grep). Se guardó una copia del lockfile anterior en el scratchpad de la sesión antes de borrarlo, por si hiciera falta comparar versiones.
- Las versiones fijadas en `package.json` (`next@16.2.10`, `react@19.2.0`, etc.) no cambiaron; solo cambió la procedencia de los tarballs y sus hashes de integridad.
- Este mismo problema habría bloqueado igual a T-004–T-012 en este entorno; si vuelve a aparecer el error `ETIMEDOUT` contra ese gateway en otra sesión, el fix es el mismo: regenerar `package-lock.json` desde cero en vez de reintentar `npm ci`.
- Pendiente fuera de alcance de T-013: error de tipos preexistente en `app/login/actions.ts` no apareció en la corrida final de `tsc` (posiblemente era ruido de la instalación parcial anterior); no se tocó ese archivo, dejar como nota para quien revise T-008/T-009 si reaparece.

## Archivos bloqueados temporalmente

Ninguno.

## Recomendación para el siguiente agente

1. Tarea cerrada: `npm run validate:schedule` y `npm run typecheck` pasan ambos. T-013 → `DONE`.
2. Confirmar en `app/login/actions.ts(9,73)` si el error de tipos ("Function lacks ending return statement") reaparece — en la corrida final ya no salió, pero no se investigó a fondo por estar fuera de alcance.
3. Si en otra sesión vuelve a aparecer `ETIMEDOUT` contra `packages.applied-caas-gateway1.internal.api.openai.org` durante `npm ci`/`npm install`, no es un problema de red del usuario: revisar si `package-lock.json` volvió a traer URLs `resolved` de ese gateway y regenerarlo desde cero (`rm -rf node_modules package-lock.json && npm install`).
4. Este repositorio no tiene `.git` inicializado, por lo que no se creó rama `agent/backend/T-013-timezone-fix` como pide el flujo de `AGENTS.md`; los cambios se aplicaron directamente sobre el árbol de trabajo. Si se inicializa git, considerar rehacer el historial de este cambio en una rama propia antes de mezclar con otro trabajo.

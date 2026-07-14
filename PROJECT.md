# Project Charter

**Nombre:** Timbra Académica  
**Producto:** Dashboard web/PWA de recordatorio y asistencia de timbradas académicas  
**Zona horaria:** `America/Guayaquil`  
**Días operativos:** lunes a viernes

## Problema

Un docente puede tener bloques de clase y de gestión distribuidos durante el día. La omisión de una timbrada de ingreso o salida, o el intento de activar una nueva actividad sin cerrar la anterior, genera errores operativos.

## Resultado esperado

Un sistema que convierta el horario académico en una secuencia temporal de eventos verificables, avise antes de cada evento, detecte omisiones, mantenga una única sesión activa y deje trazabilidad completa.

## Principios

1. El horario es la fuente de verdad operativa.
2. Una sola sesión puede estar activa por usuario.
3. Los recordatorios no son equivalentes a una timbrada realizada.
4. Toda timbrada debe dejar evidencia auditable.
5. Las credenciales institucionales no se almacenan en texto plano.
6. La integración externa debe ser reemplazable mediante un adaptador.
7. La aplicación debe seguir funcionando como dashboard aunque la integración institucional no exista todavía.

## Alcance MVP

- Login con usuario y contraseña propios de la app.
- Dashboard de hoy.
- Vista semanal.
- Actividad activa y próxima actividad.
- Recordatorios T-3 y T+1.
- Bloqueo de solapamientos.
- Timbrado local/simulado para validar el flujo.
- Historial diario y de días anteriores.
- Preparación para PWA y push.
- Preparación para PostgreSQL.
- CI en GitHub y despliegue en Vercel.

## Fuera del MVP

- Automatización de un portal institucional sin API autorizada.
- Suplantación de interacción humana.
- Geolocalización obligatoria.
- Biometría.
- Gestión multiinstitución.

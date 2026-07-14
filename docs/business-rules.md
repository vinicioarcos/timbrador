# Reglas de negocio

## BR-001 — Calendario operativo

El sistema opera de lunes a viernes y usa la zona horaria `America/Guayaquil`.

## BR-002 — Recordatorio previo

Para cada evento de timbrada esperado, generar un recordatorio exactamente 3 minutos antes:

- ingreso de una actividad;
- salida de una actividad.

## BR-003 — Omisión

Si transcurre 1 minuto desde la hora esperada y no existe la timbrada correspondiente, el evento pasa a `MISSED` y se muestra una alerta persistente.

## BR-004 — Exclusión mutua

Un usuario puede tener como máximo una sesión activa. Una nueva actividad no puede iniciar mientras otra esté activa.

## BR-005 — Cierre de actividad anterior

Cuando se aproxima una nueva actividad y existe otra activa, el recordatorio debe indicar primero: **“Cierra la actividad anterior”**. El botón de ingreso de la nueva actividad permanece deshabilitado hasta registrar la salida.

## BR-006 — Horas de gestión

Una actividad de gestión genera solo dos eventos de timbrada:

1. ingreso al inicio del bloque;
2. salida al final del bloque.

No se generan timbradas intermedias por cada hora cronológica contenida dentro del bloque.

## BR-007 — Horas de clase

Una clase genera ingreso y salida por cada bloque configurado en el horario.

## BR-008 — Timbrado asistido

La aplicación puede preparar y accionar una timbrada mediante un adaptador autorizado. La política por defecto requiere confirmación explícita del usuario. La aplicación no debe fingir presencia ni ejecutar automatización opaca.

## BR-009 — Idempotencia

Repetir una solicitud con la misma `idempotencyKey` no puede generar timbradas duplicadas.

## BR-010 — Auditoría

Cada intento debe registrar: usuario, actividad, tipo de evento, hora programada, hora real, origen, resultado y error si existió.

## BR-011 — Horario editable

La transcripción inicial del PDF es un seed. Debe existir un mecanismo futuro para corregir horarios sin modificar código.

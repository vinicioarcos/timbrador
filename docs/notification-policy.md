# Política de notificaciones

## Prioridades

- `INFO`: actividad próxima.
- `WARNING`: T-3 de ingreso o salida.
- `URGENT`: T+1 sin timbrada.
- `BLOCKING`: existe actividad anterior activa.

## Mensajes sugeridos

**T-3 ingreso**  
“En 3 minutos inicia: {actividad}. Prepárate para timbrar ingreso.”

**T-3 con sesión anterior activa**  
“En 3 minutos inicia: {actividad}. Primero debes salir de: {actividad_anterior}.”

**T+1 ingreso omitido**  
“Falta la timbrada de ingreso de {actividad}. Han pasado 1 minuto.”

**T-3 salida**  
“En 3 minutos termina: {actividad}. Prepárate para timbrar salida.”

**T+1 salida omitida**  
“Falta la timbrada de salida de {actividad}. La sesión sigue activa.”

## Antifatiga

No reenviar la misma alerta urgente continuamente. Registrar `acknowledgedAt` y aplicar reintentos configurables, por ejemplo a +5 y +10 minutos.

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

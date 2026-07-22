# T-007 — Integración institucional

**Estado:** BLOCKED  
**Owner sugerido:** Integration

## Bloqueo

Falta contrato técnico autorizado del sistema institucional: API, mecanismo de autenticación o procedimiento aprobado.

## No hacer

No introducir credenciales reales ni construir automatización de login/scraping por intuición.

## Desbloqueo

- documentación de endpoint oficial, o
- autorización explícita para un método alternativo en un entorno de prueba.

## Investigado (2026-07-22)

Se revisó (sin usar credenciales reales ni sesión activa) la URL del sistema
`aplicaciones.utc.edu.ec/sigutc/academic/ss/asistenciaDocenteV2`: sin
autenticación, redirige a un login estándar. No hay endpoint público,
llamada JSON/XHR ni documentación de integración visible desde afuera —
todo vive detrás de autenticación institucional. El bloqueo sigue vigente;
no se encontró una vía técnica para desbloquear esto sin contactar a
sistemas/TI de la UTC para pedir un contrato de API oficial. Construir
login automatizado contra el sistema institucional sin ese permiso expone
la cuenta del usuario a riesgo de sanción por los términos de uso de la
universidad, independientemente de que sea su propia cuenta — no se debe
intentar por intuición.

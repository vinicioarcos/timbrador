# AGENTS.md — Contrato de trabajo multiagente

Este archivo es la fuente de instrucciones compartidas para Codex y cualquier agente que participe en el repositorio.

## Antes de modificar código

Leer, en este orden:

1. `PROJECT.md`
2. `docs/business-rules.md`
3. `docs/state-machine.md`
4. `TASKS.md`
5. el archivo específico dentro de `tasks/`

## Regla de alcance

Trabajar únicamente en una tarea activa. No ampliar el alcance de forma silenciosa. Si aparece una dependencia, registrar un nuevo task o un bloqueo.

## Flujo obligatorio

1. Seleccionar una tarea `READY`.
2. Marcarla `IN_PROGRESS` en una rama `agent/<rol>/<task-id>-slug`.
3. Implementar el cambio mínimo necesario.
4. Ejecutar validaciones y pruebas.
5. Crear `handoffs/<task-id>-<rol>.md` usando la plantilla.
6. Cambiar la tarea a `REVIEW`.
7. Un agente distinto revisa y decide `DONE` o `CHANGES_REQUESTED`.

## Reglas críticas del dominio

- Nunca puede existir más de una sesión `ACTIVE` por usuario.
- Si una actividad anterior sigue activa, la siguiente no puede iniciar.
- El aviso previo ocurre 3 minutos antes del ingreso y de la salida.
- Si al minuto posterior al evento no existe la timbrada esperada, crear una alerta `MISSED`.
- Gestión: solo ingreso al inicio del bloque y salida al final del bloque.
- Clase: ingreso y salida por bloque académico configurado.
- Toda transición debe ser idempotente.
- Todas las horas se calculan en `America/Guayaquil`.

## Seguridad

- No introducir contraseñas, cookies institucionales ni tokens reales en el repositorio.
- No crear automatizaciones de portal mediante scraping/login hasta que exista autorización y especificación técnica.
- Toda integración externa debe implementar `lib/integrations/punch-adapter.ts`.
- Las acciones irreversibles requieren confirmación explícita del usuario en la UI.

## Calidad

Una tarea no está terminada si:

- rompe `npm run validate:schedule`;
- no contempla estado de error;
- cambia una regla del dominio sin actualizar documentación;
- agrega una dependencia sin justificarla en un ADR;
- no deja handoff.

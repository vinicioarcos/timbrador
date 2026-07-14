# Timbra Académica

Proyecto agentico y multiagéntico para construir una aplicación web/PWA que recuerde y gestione las timbradas de un horario académico de lunes a viernes.

## Objetivo

La aplicación debe:

- mostrar el horario semanal, la actividad activa, las próximas actividades y el historial de timbradas;
- avisar **3 minutos antes** de cada ingreso o salida programada;
- detectar a **+1 minuto** una timbrada pendiente y escalar el recordatorio;
- impedir que una nueva actividad se active mientras exista otra en estado activo;
- distinguir entre **clases** y **gestión**;
- para gestión, registrar únicamente **ingreso y salida del bloque**;
- permitir un **timbrado asistido** mediante una integración autorizada, sin almacenar contraseñas institucionales en texto plano ni simular presencia sin confirmación del usuario;
- desplegarse desde GitHub hacia Vercel.

El horario inicial fue transcrito visualmente desde `docs/source/horario.pdf`. Antes de conectar una integración real, revisar `data/schedule.seed.json` y confirmar las horas exactas.

## Inicio rápido

```bash
npm install
cp .env.example .env.local
node scripts/hash-password.mjs "TU_CLAVE"
# Copia el hash resultante a APP_PASSWORD_HASH
npm run validate:schedule
npm run dev
```

Abrir `http://localhost:3000/login`.

## Arquitectura de trabajo con agentes

Los archivos de gobierno están en la raíz:

- `AGENTS.md`: contrato compartido para Codex y otros agentes.
- `CLAUDE.md`: instrucciones específicas para Claude Code.
- `AGY.md`: instrucciones operativas para Agy/Antigravity.
- `TASKS.md`: tablero maestro.
- `agents/`: roles especializados.
- `tasks/`: tareas ejecutables y criterios de aceptación.
- `handoffs/`: traspasos entre agentes.

La regla principal es simple: **ningún agente trabaja directamente sobre una tarea sin leer primero el contrato, la tarea y las reglas del dominio**.

## Estado actual

Este repositorio contiene:

1. especificación funcional y arquitectura;
2. transcripción inicial del horario;
3. prototipo de dashboard ejecutable con datos locales;
4. autenticación básica por usuario/contraseña vía variables de entorno;
5. motor de reglas de agenda y estado;
6. scripts de validación;
7. modelo SQL para PostgreSQL;
8. plan de recordatorios fiables con Vercel Cron + Vercel Queues + Web Push;
9. backlog multiagente para completar persistencia, push e integración institucional autorizada.

## Nota de seguridad y cumplimiento

La aplicación no debe realizar una timbrada institucional automática sin una integración autorizada y una acción inequívoca del usuario. El adaptador real queda deliberadamente desacoplado y bloqueado hasta disponer de documentación oficial o autorización explícita de la institución.

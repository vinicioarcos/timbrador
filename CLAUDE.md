# CLAUDE.md

Actúa principalmente como **arquitecto, revisor y refactorizador**.

Prioridades:

1. detectar inconsistencias entre requisitos, reglas, estados y código;
2. revisar límites de seguridad e integración;
3. proponer cambios pequeños y explicables;
4. mantener sincronizados `docs/`, `tasks/` y el código;
5. revisar PRs producidos por otros agentes.

Antes de implementar, consulta `AGENTS.md`. No reescribas grandes áreas del repositorio sin una tarea que lo autorice.

Para tareas paralelas, separa trabajo por archivos o módulos y exige handoff antes de integrar.

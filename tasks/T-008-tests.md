# T-008 — Pruebas del dominio

**Estado:** READY  
**Owner sugerido:** QA

Casos mínimos:

1. T-3 ingreso.
2. T+1 ingreso omitido.
3. T-3 salida.
4. T+1 salida omitida.
5. siguiente actividad bloqueada por sesión previa.
6. gestión larga con solo dos timbradas.
7. reintento idempotente.
8. concurrencia de dos intentos de ingreso.
9. sábado y domingo sin eventos.
10. historial ordenado por hora real y programada.

# ADR-0002 — Recordatorios programados

**Estado:** Accepted

## Decisión

No depender de un cron cada minuto. Usar un planificador diario que genere eventos futuros y los envíe con entrega diferida a una cola. El consumidor envía Web Push.

## Consecuencia

La precisión de recordatorios no depende de mantener abierta la aplicación. El dashboard mantiene un verificador local como respaldo.

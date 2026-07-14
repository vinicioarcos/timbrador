# Despliegue GitHub → Vercel

## 1. Repositorio

```bash
git init
git add .
git commit -m "feat: bootstrap Timbra Académica"
git branch -M main
git remote add origin <URL_DEL_REPOSITORIO>
git push -u origin main
```

## 2. Variables de entorno

Configurar en Vercel:

- `APP_USERNAME`
- `APP_PASSWORD_HASH`
- `SESSION_SECRET`
- `CRON_SECRET`
- `DATABASE_URL` cuando se implemente PostgreSQL
- variables VAPID cuando se implemente Web Push

## 3. Despliegue

Importar el repositorio desde Vercel. La rama `main` será producción y las ramas/PR generarán previews.

## 4. Cron

`vercel.json` contiene un cron diario. El endpoint valida `CRON_SECRET`.

## 5. Producción

Antes de activar una integración real:

- confirmar `data/schedule.seed.json`;
- ejecutar pruebas E2E;
- validar la zona horaria;
- comprobar Web Push en Android y escritorio;
- revisar el adaptador institucional.

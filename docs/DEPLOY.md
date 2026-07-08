# 🚀 SUBIR AMPHIBIAN OS A HOSTING — paso a paso

## Antes de elegir: entiende el requisito
Amphibian NO es una página estática: es un **proceso vivo** (el bot de Telegram hace polling continuo y el cron sincroniza cada 5 min) con una **base de datos en disco** (SQLite). Por eso:
- ❌ Vercel / Netlify / GitHub Pages NO sirven (serverless, sin proceso persistente).
- ✅ Railway, Fly.io o Render SÍ sirven (proceso persistente + volumen para la DB).

## Paso 0 — Sube el código a GitHub (una vez, 3 min)
```bash
cd amphibian-os
git init
git add .
git commit -m "Amphibian OS v1"
```
Crea un repo **privado** en github.com (ej. `amphibian-os`) y:
```bash
git remote add origin https://github.com/TU-USUARIO/amphibian-os.git
git push -u origin main
```
> El `.gitignore` ya excluye `.env` y la DB — tus keys nunca suben.

---

## OPCIÓN A — Railway (la más fácil, recomendada) · ~$5 USD/mes
1. https://railway.app → login con GitHub.
2. **New Project → Deploy from GitHub repo** → elige `amphibian-os`. Railway detecta el `Dockerfile` solo.
3. En el servicio → pestaña **Variables**, agrega:
   ```
   DATABASE_URL = file:/data/amphibian.db
   AI_PROVIDER = anthropic
   ANTHROPIC_API_KEY = tu-key
   TELEGRAM_BOT_TOKEN = (si ya lo tienes)
   TELEGRAM_CHAT_ID = (si ya lo tienes)
   ```
4. Pestaña **Settings → Volumes → Add Volume** → mount path: `/data` (¡crítico! sin esto la DB se borra en cada deploy).
5. **Settings → Networking → Generate Domain** → te da `amphibian-os-xxxx.up.railway.app`.
6. Abre esa URL: dashboard HOY funcionando. En tu cel: **Agregar a pantalla de inicio** → ya tienes la app instalada con datos en la nube.

## OPCIÓN B — Fly.io · plan hobby
```bash
# instalar CLI: https://fly.io/docs/flyctl/install/
fly auth signup            # o fly auth login
fly launch --copy-config --no-deploy   # usa el fly.toml incluido
fly volumes create amphibian_data --size 1 --region qro
fly secrets set ANTHROPIC_API_KEY=tu-key TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=xxx
fly deploy
```

## OPCIÓN C — Render (Blueprint) · Starter ~$7/mes
1. https://render.com → login con GitHub.
2. **New → Blueprint** → elige el repo. Render lee el `render.yaml` incluido y configura todo (servicio + disco `/data`).
3. Te pedirá los valores de `ANTHROPIC_API_KEY` etc. (están marcados `sync: false`).
> Ojo: el plan free de Render no tiene disco → la DB se borraría en cada deploy. Para producción real usa Starter.

---

## Después del deploy (cualquier opción)
1. **Google OAuth**: en `Variables` agrega
   `GOOGLE_REDIRECT_URI = https://TU-DOMINIO/api/google/callback`
   y registra ESA misma URL en Google Cloud Console → Credenciales → tu OAuth client → URIs de redireccionamiento.
2. **WhatsApp**: ahora ya no necesitas ngrok — apunta el webhook de Twilio directo a
   `https://TU-DOMINIO/api/whatsapp/webhook`.
3. **Seguridad**: la app no tiene login (era para tu laptop). En internet pública, cualquiera con la URL ve tus datos. Mínimo viable: mantén la URL privada y el repo privado. Siguiente paso recomendado (FASE para Sonnet): agregar un token simple —
   ```
   Prompt para Sonnet: "Agrega auth por token a Amphibian OS: variable de entorno
   ACCESS_TOKEN; un middleware en server/src/index.ts que exija header
   x-amphibian-token o cookie 'amphibian' en todas las rutas /api excepto
   /api/whatsapp/webhook y /api/google/callback; una pantalla simple en la PWA
   que pida el token una vez y lo guarde en localStorage y cookie; el cliente
   api.ts lo manda en cada request. Corre bash scripts/smoke.sh ajustando el
   script para pasar el token."
   ```

## ¿Y mientras tanto, sin pagar hosting?
Corre `npm start` en tu laptop y usa la PWA desde el cel **en tu misma red WiFi** con la IP local (ej. `http://192.168.1.50:4000`). Telegram funciona igual desde cualquier lugar del mundo aunque el server esté en tu casa, porque es el server quien sale a preguntar (long polling) — no necesita URL pública.

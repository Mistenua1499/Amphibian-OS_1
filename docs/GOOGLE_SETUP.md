# Conectar Google (Sheets + Calendar + Drive) — 20 minutos, una sola vez

## 1. Crear proyecto y credenciales
1. Ve a https://console.cloud.google.com → crea proyecto "Amphibian OS".
2. **APIs y servicios → Biblioteca**: habilita estas 3 APIs:
   - Google Sheets API
   - Google Calendar API
   - Google Drive API
3. **Pantalla de consentimiento OAuth**: tipo Externo, nombre "Amphibian OS", tu correo. En "Usuarios de prueba" agrega tu propio Gmail (gabo.aviles14@gmail.com). No necesitas publicar la app.
4. **Credenciales → Crear credenciales → ID de cliente OAuth**:
   - Tipo: Aplicación web
   - URI de redireccionamiento autorizado: `http://localhost:4000/api/google/callback`
5. Copia el **Client ID** y **Client Secret**.

## 2. Configurar Amphibian
En `server/.env`:
```
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
```
Reinicia el server.

## 3. Conectar
Abre la app → **Ajustes → Conectar Google** → acepta permisos. Verás "✅ Google conectado".

## Qué hace el sync (automático cada 5 min + botón manual)
- **Sheets**: crea/actualiza spreadsheet "AMPHIBIAN OS - Sync" con pestañas Pipeline y Clientes. Si prefieres usar un sheet tuyo, pon su ID en `GOOGLE_SHEET_ID`.
- **Calendar**: cada oportunidad con próxima acción + fecha se vuelve evento `[Amphibian] ...` en tu calendario (se actualiza, no duplica).
- **Drive**: cada bitácora guardada se sube como markdown a la carpeta "Amphibian Bitacoras".
- El dashboard HOY muestra tus eventos de calendario del día.

## Si cambias de máquina o dominio
Actualiza `GOOGLE_REDIRECT_URI` en `.env` Y agrégalo en Google Cloud Console → Credenciales.

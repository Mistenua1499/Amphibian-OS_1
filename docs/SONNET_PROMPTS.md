# PROMPTS PARA SONNET — Cómo continuar Amphibian OS sin quemar límites

> **Cómo usar esto:** abre Claude Code (o un chat con Sonnet), pega el CONTEXTO BASE + el prompt de la fase que quieras. Una fase por sesión. Después de CADA fase, Sonnet DEBE correr `bash scripts/smoke.sh` y no puede declarar terminado nada si el smoke no pasa.

---

## CONTEXTO BASE (pégalo SIEMPRE al inicio de cada sesión con Sonnet)

```
Trabajas sobre AMPHIBIAN OS, un sistema operativo personal ya construido y funcionando.
Stack REAL del proyecto (no lo cambies):
- Backend: Node 22+, Express, TypeScript ejecutado con tsx. Base de datos: node:sqlite NATIVO (NO Prisma, NO better-sqlite3, NO Postgres). Toda la capa de datos vive en server/src/db.ts.
- IA: capa portable en server/src/ai/ con adaptadores fetch puro (anthropic, openai, gemini, ollama). Niveles: cheap/standard/deep. El orquestador está en server/src/services/captureProcessor.ts.
- Frontend: React 18 + Vite + TypeScript, CSS a mano con variables (NO Tailwind). PWA con manifest + sw.js. Páginas en web/src/pages/, navegación por hash en App.tsx.
- Integraciones: Telegram (long polling), Google Sheets/Calendar/Drive (googleapis + OAuth), Obsidian (markdown a vault), WhatsApp/Twilio (webhook listo).
- Scheduler: node-cron en server/src/jobs/scheduler.ts (NO Redis, NO Bull).

REGLAS ABSOLUTAS:
1. NO cambies el stack ni agregues dependencias sin justificación de una línea.
2. NO modifiques server/src/db.ts salvo para AGREGAR tablas/funciones (nunca borrar ni renombrar columnas existentes).
3. NO toques la interfaz AIProvider en server/src/ai/provider.ts.
4. Después de CUALQUIER cambio al backend: corre `bash scripts/smoke.sh`. Si falla, arréglalo antes de seguir.
5. Después de cambios al frontend: corre `cd web && npx tsc --noEmit && npm run build`. Si falla, arréglalo.
6. Si una tarea es ambigua, elige la opción MÁS SIMPLE y déjalo anotado en un comentario.
7. Todo texto visible al usuario va en español mexicano.
8. Los errores de integraciones externas NUNCA deben tumbar el servidor: try/catch + SyncLogs.add().
```

---

## FASE 1 — Puesta en marcha en la laptop de Gabriel (30 min)

```
Tarea: dejar Amphibian OS corriendo en esta máquina.
1. Verifica Node >= 22.5 (`node --version`). Si no, dile al usuario que instale Node 22 LTS y detente.
2. En la raíz: `npm install`
3. Copia .env.example a server/.env. Pide al usuario su ANTHROPIC_API_KEY (o el provider que prefiera) y ponla en server/.env.
4. `npm run seed`
5. `bash scripts/smoke.sh` — deben pasar las 15 pruebas.
6. `npm run build` (compila la PWA)
7. `npm start` y abre http://localhost:4000
Criterio de éxito: dashboard HOY visible con los datos seed (Villa Verde, Mich, Odontofamily) y smoke 15/15.
```

## FASE 2 — Conectar Telegram (15 min)

```
Tarea: activar el bot de Telegram.
1. Guía al usuario: hablar con @BotFather en Telegram → /newbot → copiar el token.
2. Pon TELEGRAM_BOT_TOKEN en server/.env y reinicia el server.
3. El usuario manda /start al bot → el bot responde con su chat id → ponlo como TELEGRAM_CHAT_ID en server/.env.
4. Prueba: mandar un texto al bot ("Hablé con Andrés de Villa Verde, quiere subir presupuesto de ads") y verificar que:
   - Llega respuesta del bot con resumen y entidades
   - La captura aparece en Ajustes → Capturas recientes
   - Se creó/actualizó la entidad en Personas
NO toques el código salvo que haya un bug real. El servicio ya está en server/src/services/telegram.ts.
```

## FASE 3 — Conectar Google (30 min)

```
Tarea: activar sync con Google Sheets/Calendar/Drive.
Sigue docs/GOOGLE_SETUP.md al pie de la letra con el usuario (crear proyecto en Google Cloud Console, OAuth client, scopes).
Luego: GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en server/.env, reiniciar, ir a Ajustes → Conectar Google.
Prueba: botón "Sincronizar ahora" → debe crear el spreadsheet "AMPHIBIAN OS - Sync" con pestañas Pipeline y Clientes pobladas.
Si algo falla, revisa los logs en Ajustes → Sincronización y /api/sync/status.
```

## FASE 4 — Mejoras al dashboard (cuando Gabriel las pida)

```
Ejemplos de tareas seguras que puedes hacer:
- Agregar página "Ideas" (lista entities type=IDEA): copia el patrón de Personas.tsx.
- Gráfica simple de salud semanal en Bitácora: agrega endpoint GET /api/health que liste últimos 7 días (agrega Health.listRange en db.ts SIN tocar lo existente) y dibuja barras con divs (sin librerías de gráficas).
- Botón "posponer" en recordatorios: agrega columna snoozedUntil a reminders vía ALTER TABLE en db.ts (con try/catch por si ya existe) y filtra en Reminders.list.
Recuerda: smoke.sh después de cada cambio de backend.
```

## FASE 5 — WhatsApp cuando Gabriel tenga Twilio

```
El webhook YA existe en POST /api/whatsapp/webhook. Solo sigue docs/WHATSAPP_SETUP.md:
exponer el server (ngrok o deploy), configurar el webhook en Twilio Sandbox, poner credenciales en .env.
NO reescribas el servicio; está en server/src/services/whatsapp.ts.
```

## FASE 6 — Deploy fuera de la laptop (opcional)

```
Opción recomendada: Railway o Fly.io (el server necesita proceso persistente por el long polling de Telegram y node-cron; NO sirve Vercel serverless).
1. La DB SQLite necesita volumen persistente (Railway: volume en /data, DATABASE_URL="file:/data/amphibian.db").
2. Build: npm install && npm run build. Start: npm start. PORT lo inyecta la plataforma.
3. Actualiza GOOGLE_REDIRECT_URI al dominio público y regístralo en Google Cloud Console.
4. Ahora el webhook de WhatsApp puede apuntar directo sin ngrok.
```

---

## ERRORES QUE SONNET SUELE COMETER EN ESTE PROYECTO (prevención)

1. **Instalar Prisma/Tailwind "porque es lo estándar"** → PROHIBIDO. El proyecto usa node:sqlite y CSS variables a propósito (portabilidad y cero fricción).
2. **Convertir el long polling de Telegram a webhooks** → NO. Long polling funciona sin exponer el server.
3. **Cambiar los modelos default de IA** → los defaults viven en server/src/ai/provider.ts (DEFAULT_MODELS); si un modelo quedó obsoleto, actualiza SOLO ese string.
4. **Romper el contrato JSON del extractor** → el prompt EXTRACT_SYSTEM de captureProcessor.ts define la forma exacta; si agregas campos, hazlos opcionales.
5. **Olvidar el modo sin-IA** → el sistema DEBE funcionar sin ninguna API key (capturas se guardan crudas). No agregues código que asuma que la IA siempre está.

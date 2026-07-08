# 🐸 AMPHIBIAN OS

Tu sistema operativo personal: captura desde cualquier lado, la IA organiza, tú decides.

**Estado: MVP funcional y probado** (smoke test 15/15 · frontend compilado · integraciones listas para conectar).

## Arranque rápido (tu laptop, ~5 min)

Requisito único: **Node.js 22.5 o superior** (https://nodejs.org, versión LTS).

```bash
npm install          # instala server + web
cp .env.example server/.env
# edita server/.env: pon tu ANTHROPIC_API_KEY (o el provider que quieras)
npm run seed         # datos iniciales (Villa Verde, Mich, Odontofamily...)
npm run build        # compila la PWA
npm start            # → http://localhost:4000
```

Verificación en cualquier momento: `npm run smoke` (15 pruebas del backend).

**Instalar como app en el cel:** abre la URL en Chrome/Safari del teléfono (misma red WiFi, usando la IP de tu laptop, ej. `http://192.168.1.50:4000`) → "Agregar a pantalla de inicio". Funciona offline: las capturas se encolan y se envían solas al volver la red.

## Qué hace

- **Captura universal**: texto o audio desde la app, Telegram o WhatsApp. La IA extrae personas, empresas, ideas y oportunidades automáticamente.
- **Dashboard HOY**: dinero por cobrar, seguimientos fríos, pipeline, salud, recordatorios, agenda del día.
- **Pipeline kanban**: LEAD → DIAGNOSTICADO → PROPUESTA → NEGOCIACIÓN → GANADO.
- **Personas con memoria**: narrativa, nivel de confianza, timeline completo de cada relación.
- **Bitácora estructurada**: hechos, hipótesis, promesas, errores, victorias + análisis IA del día.
- **Recordatorios automáticos**: lead frío 5 días, propuesta estancada 7 días, cobros pendientes, oportunidades sin próxima acción. Llegan por Telegram.
- **Sync**: Google Sheets (pipeline+clientes), Calendar (acciones), Drive (bitácoras), Obsidian (notas markdown). Cada 5 minutos.

## Arquitectura (por qué está hecho así)

| Decisión | Razón |
|---|---|
| `node:sqlite` nativo | Cero dependencias de DB, cero config, offline-first real. Un usuario no necesita Postgres. |
| IA por `fetch` puro, sin SDKs | Portabilidad total: anthropic / openai / gemini / ollama / cualquier API OpenAI-compatible cambiando `.env`. Ver `docs/PORTABILIDAD_IA.md`. |
| Niveles cheap/standard/deep | El 90% del trabajo lo hace el modelo barato; el caro solo entra en decisiones críticas. |
| Telegram por long polling | Sin webhooks, sin ngrok, sin exponer tu laptop. |
| node-cron en vez de Redis/Bull | Una pieza menos que instalar y que se puede romper. |
| CSS con variables, sin framework | Identidad Amphibian exacta, build de 1.4 s, nada que actualizar. |
| El sistema funciona SIN IA | Sin API key, las capturas se guardan crudas. Nunca pierdes un pensamiento por falta de crédito. |

## Estructura

```
server/src/
  db.ts                  ← TODA la capa de datos (node:sqlite)
  ai/                    ← provider.ts (interfaz+router) + 4 adaptadores
  services/              ← captureProcessor (orquestador IA), telegram,
                           google, obsidian, whatsapp, reminderRules
  routes/                ← dashboard, entities, opportunities, captures,
                           journal, misc
  jobs/scheduler.ts      ← cron: sync 5min, reglas 1h, digest 9am
web/src/
  pages/                 ← Hoy, Pipeline, Personas, Bitacora, Ajustes
  components/            ← CaptureModal (texto + audio)
  api.ts                 ← cliente + cola offline
docs/
  SONNET_PROMPTS.md      ← ⭐ cómo continuar el desarrollo con Sonnet
  TELEGRAM_SETUP.md · GOOGLE_SETUP.md · WHATSAPP_SETUP.md
  PORTABILIDAD_IA.md · MIGRAR_POSTGRES.md
scripts/smoke.sh         ← 15 pruebas; córrelo tras cualquier cambio
```

## Conectar integraciones (todas opcionales, todas documentadas)

1. **Telegram** (5 min, gratis) → `docs/TELEGRAM_SETUP.md`
2. **Google** (20 min, una vez) → `docs/GOOGLE_SETUP.md`
3. **Obsidian** (30 seg): pon la ruta de tu vault en `OBSIDIAN_VAULT_PATH`
4. **WhatsApp** (cuando tengas Twilio) → `docs/WHATSAPP_SETUP.md` — el webhook ya está programado

## Desarrollo

```bash
npm run dev        # server con hot-reload (tsx watch) en :4000
npm run dev:web    # vite dev server en :5173 (proxy /api → :4000)
npm run smoke      # pruebas del backend
```

Para continuar construyendo con Sonnet/Claude Code: **lee `docs/SONNET_PROMPTS.md` primero.**

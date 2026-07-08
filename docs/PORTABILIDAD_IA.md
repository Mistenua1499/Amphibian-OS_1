# Portabilidad de IA — cambiar de proveedor en 30 segundos

Todo el sistema habla con UNA interfaz (`AIProvider` en `server/src/ai/provider.ts`). El proveedor real se decide por config, no por código.

## Cambiar de proveedor
En `server/.env`:
```
AI_PROVIDER=anthropic   # o: openai | gemini | ollama
```
y la API key correspondiente. Reinicia. Eso es todo.

## Niveles de costo (así se orquesta el gasto)
| Nivel | Se usa para | Default anthropic | Default openai | Default gemini | Default ollama |
|---|---|---|---|---|---|
| cheap | clasificar / transcribir | claude-haiku-4-5 | gpt-4o-mini | gemini-2.0-flash | llama3.2 |
| standard | entidades, hipótesis, bitácora | claude-sonnet-4-6 | gpt-4o | gemini-2.0-flash | llama3.1:8b |
| deep | SOLO decisiones críticas | claude-opus-4-8 | gpt-4o | gemini-2.5-pro | llama3.1:70b |

Sobreescribe cualquiera en `.env`: `MODEL_CHEAP=`, `MODEL_STANDARD=`, `MODEL_DEEP=`.

## Bonus: cualquier API OpenAI-compatible (DeepSeek, Groq, Together, Mistral...)
El adaptador openai usa `OPENAI_BASE_URL`. Ejemplo DeepSeek:
```
AI_PROVIDER=openai
OPENAI_API_KEY=sk-deepseek-xxx
OPENAI_BASE_URL=https://api.deepseek.com/v1
MODEL_CHEAP=deepseek-chat
MODEL_STANDARD=deepseek-chat
MODEL_DEEP=deepseek-reasoner
```

## Ollama local (gratis, privado, sin internet)
```
AI_PROVIDER=ollama
```
Instala https://ollama.com y `ollama pull llama3.2`. Nota: sin transcripción de audio (agrega OPENAI_API_KEY o GEMINI_API_KEY solo para eso si la necesitas).

## Transcripción de audio
`transcribeAudio()` intenta: provider activo → Whisper (si hay OPENAI_API_KEY) → Gemini (si hay GEMINI_API_KEY). Anthropic y Ollama no transcriben; ten una de esas dos keys si capturas por voz.

## Agregar un proveedor nuevo (para Sonnet)
1. Crea `server/src/ai/nuevoprovider.ts` implementando `AIProvider` (mira `openai.ts` como plantilla, ~50 líneas).
2. Agrégalo al switch de `getAI()` y a `DEFAULT_MODELS` en `provider.ts`.
3. Corre `bash scripts/smoke.sh`. Listo.

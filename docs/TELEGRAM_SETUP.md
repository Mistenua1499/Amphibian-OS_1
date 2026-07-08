# Conectar Telegram (5 minutos, gratis)

1. En Telegram, busca **@BotFather** y mándale `/newbot`.
2. Ponle nombre (ej. "Amphibian OS") y username (ej. `amphibian_gabo_bot`).
3. BotFather te da un **token** tipo `123456:ABC-DEF...`. Cópialo.
4. En `server/.env`:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
   ```
5. Reinicia el server (`npm start`). Verás `📱 Telegram bot activo`.
6. Escríbele `/start` a tu bot. Te responde con tu **chat id**.
7. Ponlo en `server/.env`:
   ```
   TELEGRAM_CHAT_ID=987654321
   ```
8. Reinicia otra vez. Listo: mándale texto o **notas de voz** y todo entra al sistema. Los recordatorios críticos te llegan por ahí.

> Nota audio: la transcripción usa el provider de IA activo. Anthropic no transcribe audio; si tu provider es anthropic, agrega también `OPENAI_API_KEY` (usa Whisper como fallback) o `GEMINI_API_KEY`.

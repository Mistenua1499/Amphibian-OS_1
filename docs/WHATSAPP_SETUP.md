# Conectar WhatsApp vía Twilio — el código YA está listo

El webhook vive en `POST /api/whatsapp/webhook` y hace exactamente lo mismo que Telegram: guarda la captura, la procesa con IA y te responde el resumen. Solo falta conectar TU cuenta.

## Costos reales (para que decidas con datos)
- Sandbox de Twilio: **gratis** para probar (con el número compartido de Twilio).
- Producción: número propio ~$1-2 USD/mes + ~$0.005-0.05 USD por mensaje según tipo. Para uso personal de captura: centavos al mes.
- Alternativa: Telegram hace lo mismo gratis. WhatsApp vale la pena cuando quieras que CLIENTES te escriban al sistema.

## Pasos (Sandbox, 15 min)
1. Cuenta en https://www.twilio.com → consola → **Messaging → Try it out → Send a WhatsApp message**.
2. Sigue la instrucción de unirte al sandbox: mandas `join <palabra-clave>` al número que te dan desde tu WhatsApp.
3. El webhook necesita URL pública. Dos opciones:
   - **Prueba local**: `npx ngrok http 4000` → copia la URL https.
   - **Deploy** (Railway/Fly): usa tu dominio directo (ver FASE 6 en SONNET_PROMPTS.md).
4. En Twilio Sandbox settings → **"When a message comes in"**:
   ```
   https://TU-URL/api/whatsapp/webhook   (método POST)
   ```
5. En `server/.env` (para poder ENVIARTE mensajes salientes y descargar audios):
   ```
   TWILIO_ACCOUNT_SID=ACxxxx
   TWILIO_AUTH_TOKEN=xxxx
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
   ```
6. Reinicia y mándate un mensaje. Debe responder "✅ Guardado en Amphibian" con el resumen.

## Notas técnicas
- Texto: entra directo. **Audios**: se descargan de Twilio y se transcriben con tu provider (mismo fallback Whisper/Gemini que Telegram).
- La respuesta usa TwiML (gratis, va en la respuesta HTTP; no consume mensajes salientes).
- Producción real: pide un número WhatsApp Business en Twilio y apunta el mismo webhook. Cero cambios de código.

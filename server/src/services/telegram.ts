// ============================================================
// TELEGRAM BOT - Captura desde el celular via long polling (sin webhooks, sin ngrok).
// Manda texto o nota de voz al bot y se guarda + procesa con IA.
// Solo requiere TELEGRAM_BOT_TOKEN (ver docs/TELEGRAM_SETUP.md).
// ============================================================
import { Captures } from "../db.js";
import { processCapture } from "./captureProcessor.js";
import { transcribeAudio } from "../ai/provider.js";

const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN;
const API = () => `https://api.telegram.org/bot${TOKEN()}`;

let offset = 0;
let polling = false;

export function telegramEnabled(): boolean {
  return !!TOKEN();
}

export async function sendTelegram(text: string, chatId?: string) {
  const cid = chatId || process.env.TELEGRAM_CHAT_ID;
  if (!TOKEN() || !cid) return;
  try {
    await fetch(`${API()}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: cid, text }),
    });
  } catch { /* red caida: no truena */ }
}

export function startTelegramPolling() {
  if (!telegramEnabled() || polling) return;
  polling = true;
  console.log("📱 Telegram bot activo (long polling)");
  void loop();
}

async function loop() {
  while (polling) {
    try {
      const res = await fetch(`${API()}/getUpdates?timeout=30&offset=${offset}`);
      const data: any = await res.json();
      for (const update of data.result ?? []) {
        offset = update.update_id + 1;
        await handleUpdate(update).catch((e) => console.error("telegram update error:", e.message));
      }
    } catch {
      await new Promise((r) => setTimeout(r, 5000)); // sin internet: reintenta
    }
  }
}

async function handleUpdate(update: any) {
  const msg = update.message;
  if (!msg) return;
  const chatId = String(msg.chat.id);

  if (msg.text === "/start") {
    await sendTelegram(
      `🐸 Amphibian OS conectado.\nTu chat id es: ${chatId}\nPonlo en server/.env como TELEGRAM_CHAT_ID para recibir recordatorios.\n\nMándame texto o audio y lo capturo.`,
      chatId
    );
    return;
  }

  let raw = "";
  let kind = "TEXTO";

  if (msg.text) {
    raw = msg.text;
  } else if (msg.voice || msg.audio) {
    kind = "AUDIO";
    const fileId = (msg.voice ?? msg.audio).file_id;
    try {
      const fileInfo: any = await (await fetch(`${API()}/getFile?file_id=${fileId}`)).json();
      const fileRes = await fetch(`https://api.telegram.org/file/bot${TOKEN()}/${fileInfo.result.file_path}`);
      const buf = Buffer.from(await fileRes.arrayBuffer());
      raw = await transcribeAudio(buf, "audio/ogg");
    } catch (e: any) {
      await sendTelegram(`⚠️ No pude transcribir el audio: ${e.message}`, chatId);
      return;
    }
  } else if (msg.photo) {
    kind = "FOTO";
    raw = msg.caption ?? "(foto capturada sin texto)";
  } else if (msg.document) {
    kind = "DOCUMENTO";
    raw = msg.caption ?? `(documento: ${msg.document.file_name})`;
  } else {
    return;
  }

  const capture = Captures.create({ channel: "TELEGRAM", kind, raw });

  try {
    const result = await processCapture(capture.id);
    const parts = [`✅ Guardado.`];
    if (result.summary) parts.push(`📝 ${result.summary}`);
    if (result.entitiesCreated.length) parts.push(`🔗 ${result.entitiesCreated.join(", ")}`);
    if (result.nextAction) parts.push(`⚡ Próxima acción: ${result.nextAction}`);
    if (result.deepAnalysis) parts.push(`🧠 Análisis:\n${result.deepAnalysis}`);
    await sendTelegram(parts.join("\n"), chatId);
  } catch (e: any) {
    await sendTelegram(`✅ Guardado (sin procesar por IA: ${e.message})`, chatId);
  }
}

export function stopTelegramPolling() { polling = false; }

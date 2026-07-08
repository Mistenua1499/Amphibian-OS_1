// ============================================================
// WHATSAPP via TWILIO - LISTO PARA CONECTAR (ver docs/WHATSAPP_SETUP.md)
// Cuando conectes tu cuenta Twilio y apuntes el webhook a
// POST /api/whatsapp/webhook, los mensajes entran al mismo
// pipeline de capturas que Telegram.
// ============================================================
import type { Request, Response } from "express";
import { Captures } from "../db.js";
import { processCapture } from "./captureProcessor.js";
import { transcribeAudio } from "../ai/provider.js";

export function whatsappConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

export async function sendWhatsApp(to: string, body: string) {
  if (!whatsappConfigured()) return;
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const params = new URLSearchParams({
    From: process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886",
    To: to,
    Body: body,
  });
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
}

// Webhook de Twilio (application/x-www-form-urlencoded)
export async function whatsappWebhook(req: Request, res: Response) {
  const body = (req.body.Body as string) ?? "";
  const numMedia = Number(req.body.NumMedia ?? 0);

  let raw = body;
  let kind = "TEXTO";

  // Audio adjunto: descargar de Twilio y transcribir
  if (numMedia > 0 && String(req.body.MediaContentType0 ?? "").startsWith("audio")) {
    kind = "AUDIO";
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
      const mediaRes = await fetch(req.body.MediaUrl0, { headers: { authorization: `Basic ${auth}` } });
      const buf = Buffer.from(await mediaRes.arrayBuffer());
      raw = await transcribeAudio(buf, req.body.MediaContentType0);
    } catch (e: any) {
      raw = body || `(audio no transcrito: ${e.message})`;
    }
  } else if (numMedia > 0) {
    kind = "FOTO";
    raw = body || "(imagen recibida)";
  }

  if (!raw.trim()) { res.type("text/xml").send("<Response/>"); return; }

  const capture = Captures.create({ channel: "WHATSAPP", kind, raw });

  let reply = "✅ Guardado en Amphibian.";
  try {
    const result = await processCapture(capture.id);
    if (result.summary) reply += `\n📝 ${result.summary}`;
    if (result.nextAction) reply += `\n⚡ ${result.nextAction}`;
  } catch { /* guardado crudo */ }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(reply)}</Message></Response>`;
  res.type("text/xml").send(twiml);
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}

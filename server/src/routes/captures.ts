import { Router } from "express";
import { Captures } from "../db.js";
import { processCapture } from "../services/captureProcessor.js";
import { transcribeAudio } from "../ai/provider.js";

export const capturesRouter = Router();

capturesRouter.get("/", (_req, res) => {
  res.json(Captures.list(50));
});

// Captura de texto / link / foto (descripcion)
capturesRouter.post("/", async (req, res) => {
  const { raw, kind = "TEXTO", channel = "APP" } = req.body;
  if (!raw?.trim()) { res.status(400).json({ error: "raw es requerido" }); return; }
  const capture = Captures.create({ raw, kind, channel });
  try {
    const result = await processCapture(capture.id);
    res.status(201).json({ capture: Captures.get(capture.id), result });
  } catch (e: any) {
    // IA fallo o no configurada: la captura queda guardada igual
    res.status(201).json({ capture, result: null, aiError: e.message });
  }
});

// Captura de audio: body binario, header content-type con el mime
capturesRouter.post("/audio", (req, res) => {
  const mime = req.headers["content-type"] || "audio/webm";
  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", async () => {
    try {
      const buf = Buffer.concat(chunks);
      if (!buf.length) { res.status(400).json({ error: "audio vacio" }); return; }
      const text = await transcribeAudio(buf, String(mime));
      const capture = Captures.create({ raw: text, kind: "AUDIO", channel: "APP" });
      try {
        const result = await processCapture(capture.id);
        res.status(201).json({ capture: Captures.get(capture.id), result, transcription: text });
      } catch (e: any) {
        res.status(201).json({ capture, transcription: text, aiError: e.message });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
});

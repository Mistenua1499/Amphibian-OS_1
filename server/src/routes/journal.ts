import { Router } from "express";
import { Journal, Health } from "../db.js";
import { getAI, aiConfigured } from "../ai/provider.js";
import { exportJournalToObsidian } from "../services/obsidian.js";
import { uploadJournalToDrive, googleConnected } from "../services/google.js";

export const journalRouter = Router();

journalRouter.get("/", (_req, res) => {
  res.json(Journal.list(30));
});

journalRouter.get("/:date", (req, res) => {
  res.json({ entry: Journal.get(req.params.date), health: Health.get(req.params.date) });
});

journalRouter.post("/", async (req, res) => {
  const { date, ...fields } = req.body;
  if (!date) { res.status(400).json({ error: "date (YYYY-MM-DD) es requerido" }); return; }

  let entry = Journal.upsert(date, fields);

  // IA procesa la bitacora (standard tier)
  if (aiConfigured()) {
    try {
      const summary = await getAI().chat({
        tier: "standard",
        system: "Eres el motor de reflexion de Amphibian OS. Analiza la bitacora diaria de Gabriel y responde en maximo 6 lineas: patron detectado, hipotesis mas valiosa, y la accion de mayor palanca para mañana.",
        messages: [{ role: "user", content: JSON.stringify(fields) }],
        maxTokens: 500,
      });
      entry = Journal.upsert(date, { aiSummary: summary });
    } catch { /* opcional */ }
  }

  // Export automatico a Obsidian + Drive
  exportJournalToObsidian(entry).catch(() => {});
  if (googleConnected()) {
    const md = `# Bitácora ${date}\n\n${JSON.stringify(fields, null, 2)}`;
    uploadJournalToDrive(date, md).catch(() => {});
  }

  res.status(201).json(entry);
});

import { Router } from "express";
import { Reminders, Health, Finances, Entities, Opps, SyncLogs } from "../db.js";
import { runReminderRules } from "../services/reminderRules.js";
import { runFullGoogleSync, authUrl, handleCallback, googleConfigured, googleConnected } from "../services/google.js";

export const miscRouter = Router();

// ---------- Recordatorios ----------
miscRouter.get("/reminders", (_req, res) => {
  res.json(Reminders.list(true));
});
miscRouter.post("/reminders/:id/done", (req, res) => {
  res.json(Reminders.markDone(req.params.id));
});
miscRouter.post("/reminders/run", async (_req, res) => {
  res.json({ created: await runReminderRules() });
});

// ---------- Salud (manual + hook para Health Connect futuro) ----------
miscRouter.get("/health/:date", (req, res) => {
  res.json(Health.get(req.params.date));
});
miscRouter.post("/health", (req, res) => {
  const { date, ...fields } = req.body;
  if (!date) { res.status(400).json({ error: "date requerido" }); return; }
  const numeric: any = {};
  for (const [k, v] of Object.entries(fields)) numeric[k] = v === null || v === "" ? null : Number(v);
  res.json(Health.upsert(date, numeric));
});

// ---------- Sync ----------
miscRouter.get("/sync/status", (_req, res) => {
  res.json({
    logs: SyncLogs.list(20),
    pending: Entities.countPending() + Opps.countPending(),
  });
});
miscRouter.post("/sync/run", async (_req, res) => {
  try {
    res.json(await runFullGoogleSync());
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Google OAuth ----------
miscRouter.get("/google/auth", (_req, res) => {
  if (!googleConfigured()) {
    res.status(400).send("Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en server/.env (ver docs/GOOGLE_SETUP.md)");
    return;
  }
  res.redirect(authUrl());
});
miscRouter.get("/google/callback", async (req, res) => {
  try {
    await handleCallback(String(req.query.code));
    res.send("<h2>✅ Google conectado. Ya puedes cerrar esta pestaña y volver a Amphibian.</h2>");
  } catch (e: any) {
    res.status(500).send(`Error conectando Google: ${e.message}`);
  }
});
miscRouter.get("/google/status", (_req, res) => {
  res.json({ configured: googleConfigured(), connected: googleConnected() });
});

// ---------- Finanzas ----------
miscRouter.get("/finances", (_req, res) => {
  res.json(Finances.list(100));
});

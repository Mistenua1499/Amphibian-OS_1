// ============================================================
// AMPHIBIAN OS - Server
// ============================================================
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dashboardRouter } from "./routes/dashboard.js";
import { entitiesRouter } from "./routes/entities.js";
import { oppsRouter } from "./routes/opportunities.js";
import { capturesRouter } from "./routes/captures.js";
import { journalRouter } from "./routes/journal.js";
import { miscRouter } from "./routes/misc.js";
import { whatsappWebhook } from "./services/whatsapp.js";
import { startTelegramPolling, telegramEnabled } from "./services/telegram.js";
import { startScheduler } from "./jobs/scheduler.js";

// Cargar server/.env sin dependencia de dotenv
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false })); // Twilio manda form-encoded

app.get("/api/ping", (_req, res) => { res.json({ ok: true, app: "amphibian-os", time: new Date().toISOString() }); });
app.use("/api/dashboard", dashboardRouter);
app.use("/api/entities", entitiesRouter);
app.use("/api/opportunities", oppsRouter);
app.use("/api/captures", capturesRouter);
app.use("/api/journal", journalRouter);
app.use("/api", miscRouter);
app.post("/api/whatsapp/webhook", whatsappWebhook);

// Servir el frontend compilado (npm run -w web build) para produccion local
const webDist = path.join(__dirname, "..", "..", "web", "dist");
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) { next(); return; }
    res.sendFile(path.join(webDist, "index.html"));
  });
}

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`\n🐸 AMPHIBIAN OS corriendo en http://localhost:${PORT}`);
  console.log(`   IA: ${process.env.AI_PROVIDER || "anthropic"} | Telegram: ${telegramEnabled() ? "ON" : "off"} | Obsidian: ${process.env.OBSIDIAN_VAULT_PATH ? "ON" : "off"}`);
  startTelegramPolling();
  startScheduler();
});

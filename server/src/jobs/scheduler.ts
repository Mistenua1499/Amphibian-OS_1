// ============================================================
// SCHEDULER - Reemplaza Redis/Bull con node-cron (menos piezas, cero config)
// - Cada 5 min: sync a Google (si conectado)
// - Cada hora: reglas de recordatorios
// - 9:00 am: digest matutino (si REMINDER_MODE=morning)
// ============================================================
import cron from "node-cron";
import { runFullGoogleSync, googleConnected } from "../services/google.js";
import { runReminderRules, sendMorningDigest } from "../services/reminderRules.js";

export function startScheduler() {
  // Sync a Google cada 5 minutos
  cron.schedule("*/5 * * * *", async () => {
    try {
      if (await googleConnected()) {
        await runFullGoogleSync();
        console.log("☁️  Google sync OK", new Date().toLocaleTimeString());
      }
    } catch (e: any) {
      console.error("Google sync error:", e.message);
    }
  });

  // Reglas de recordatorios cada hora
  cron.schedule("0 * * * *", async () => {
    try {
      const n = await runReminderRules();
      if (n > 0) console.log(`🔔 ${n} recordatorios nuevos`);
    } catch (e: any) {
      console.error("Reminder rules error:", e.message);
    }
  });

  // Digest matutino 9am (hora local del server)
  cron.schedule("0 9 * * *", async () => {
    if ((process.env.REMINDER_MODE || "critical") === "morning") {
      await sendMorningDigest().catch(() => {});
    }
  });

  // Correr reglas una vez al arrancar (para que el dashboard tenga datos frescos)
  setTimeout(() => runReminderRules().catch(() => {}), 3000);

  console.log("⏰ Scheduler activo (sync 5min, reglas 1h, digest 9am)");
}

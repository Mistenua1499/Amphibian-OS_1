// ============================================================
// RECORDATORIOS AUTOMATICOS - Logica simple pero efectiva (NO es IA)
// R1: lead sin contacto en 5 dias
// R2: propuesta sin cerrar en 7 dias
// R3: dinero pendiente -> 1 recordatorio por dia
// R4: oportunidad sin proxima accion
// REMINDER_MODE: critical | all | morning
// ============================================================
import { Opps, Reminders } from "../db.js";
import { sendTelegram, telegramEnabled } from "./telegram.js";

const DAY = 24 * 60 * 60 * 1000;
const daysSince = (d: Date) => Math.floor((Date.now() - d.getTime()) / DAY);

function createOnce(rule: string, refId: string | null, message: string, severity: "CRITICO" | "NORMAL") {
  if (Reminders.existsToday(rule, refId)) return null;
  return Reminders.create({ rule, refId, message, severity });
}

export async function runReminderRules() {
  const mode = process.env.REMINDER_MODE || "critical";
  const created: any[] = [];

  const opps = Opps.withPerson(Opps.list({ stageNotIn: ["GANADO", "PERDIDO"] }));

  for (const o of opps) {
    const who = o.person?.name ?? o.companyName ?? o.name;

    // R1: lead frio
    if (o.stage === "LEAD" && daysSince(o.lastContact) > 5) {
      const r = createOnce("LEAD_FRIO", o.id, `Es hora de contactar a ${who} (${daysSince(o.lastContact)} días sin contacto)`, "NORMAL");
      if (r) created.push(r);
    }
    // R2: propuesta estancada
    if (o.stage === "PROPUESTA" && daysSince(o.createdAt) > 7) {
      const r = createOnce("PROPUESTA_ESTANCADA", o.id, `¿Qué pasó con ${o.name}? Lleva ${daysSince(o.createdAt)} días en propuesta`, "CRITICO");
      if (r) created.push(r);
    }
    // R4: sin proxima accion
    if (!o.nextAction || !o.nextAction.trim()) {
      const r = createOnce("SIN_PROXIMA_ACCION", o.id, `Define próxima acción para ${o.name}`, "NORMAL");
      if (r) created.push(r);
    }
  }

  // R3: cobros pendientes (1x/dia, agregado)
  const total = Opps.totalPendingMoney();
  if (total > 0) {
    const r = createOnce("COBRO_PENDIENTE", null, `Tienes $${total.toLocaleString()} por cobrar`, "CRITICO");
    if (r) created.push(r);
  }

  // Envio inmediato por Telegram segun modo
  if (telegramEnabled() && mode !== "morning") {
    const sent: string[] = [];
    for (const r of created) {
      if (mode === "all" || r.severity === "CRITICO") {
        await sendTelegram(`🔔 ${r.severity === "CRITICO" ? "CRÍTICO: " : ""}${r.message}`);
        sent.push(r.id);
      }
    }
    Reminders.markSent(sent);
  }

  return created.length;
}

// Lista matutina (modo "morning", corre a las 9am)
export async function sendMorningDigest() {
  if (!telegramEnabled()) return;
  const pending = Reminders.list(true, 15);
  if (!pending.length) return;
  const lines = pending.map((r: any) => `${r.severity === "CRITICO" ? "🔴" : "🟡"} ${r.message}`);
  await sendTelegram(`☀️ Buenos días. Pendientes de hoy:\n\n${lines.join("\n")}`);
  Reminders.markSent(pending.map((r: any) => r.id));
}

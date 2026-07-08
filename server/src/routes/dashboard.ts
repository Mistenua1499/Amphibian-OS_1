import { Router } from "express";
import { Opps, Reminders, Health, SyncLogs } from "../db.js";
import { todayEvents, googleConnected, googleConfigured } from "../services/google.js";
import { telegramEnabled } from "../services/telegram.js";
import { obsidianEnabled } from "../services/obsidian.js";
import { whatsappConfigured } from "../services/whatsapp.js";
import { aiConfigured } from "../ai/provider.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const toCollect = Opps.withPerson(Opps.list({ pendingMoney: true }));
  const opps = Opps.withPerson(Opps.list({ stageNotIn: ["PERDIDO"] }));
  const reminders = Reminders.list(true, 10);
  const health = Health.get(today);
  const lastSync = SyncLogs.lastSuccess();

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const active = opps.filter((o: any) => o.stage !== "GANADO");
  const wonThisMonth = opps.filter((o: any) => o.stage === "GANADO" && o.updatedAt >= monthStart);

  const pipeline: Record<string, { count: number; value: number }> = {};
  for (const stage of ["LEAD", "DIAGNOSTICADO", "PROPUESTA", "NEGOCIACION"]) {
    const items = active.filter((o: any) => o.stage === stage);
    pipeline[stage] = { count: items.length, value: items.reduce((s: number, o: any) => s + o.value, 0) };
  }
  pipeline["GANADO_MES"] = { count: wonThisMonth.length, value: wonThisMonth.reduce((s: number, o: any) => s + o.value, 0) };

  const DAY = 86400000;
  const followUps = active
    .map((o: any) => ({
      id: o.id, name: o.name, who: o.person?.name ?? o.companyName ?? "",
      stage: o.stage, daysSinceContact: Math.floor((Date.now() - o.lastContact.getTime()) / DAY),
      nextAction: o.nextAction,
    }))
    .filter((f: any) => f.daysSinceContact >= 3)
    .sort((a: any, b: any) => b.daysSinceContact - a.daysSinceContact)
    .slice(0, 5);

  const nextActions = active
    .filter((o: any) => o.nextAction)
    .sort((a: any, b: any) => (a.nextActionAt?.getTime() ?? Infinity) - (b.nextActionAt?.getTime() ?? Infinity))
    .slice(0, 6)
    .map((o: any) => ({ id: o.id, action: o.nextAction, opp: o.name, at: o.nextActionAt }));

  const calendar = await todayEvents();

  res.json({
    date: today,
    money: {
      items: toCollect.map((o: any) => ({
        id: o.id, who: o.person?.name ?? o.companyName ?? o.name,
        amount: o.amountPending, dueDate: o.dueDate,
      })),
      total: toCollect.reduce((s: number, o: any) => s + o.amountPending, 0),
    },
    followUps,
    pipeline,
    reminders,
    health,
    calendar,
    nextActions,
    sync: { last: lastSync?.createdAt ?? null, target: lastSync?.target ?? null },
    integrations: {
      ai: aiConfigured(),
      aiProvider: process.env.AI_PROVIDER || "anthropic",
      telegram: telegramEnabled(),
      google: googleConfigured(),
      googleConnected: googleConnected(),
      obsidian: obsidianEnabled(),
      whatsapp: whatsappConfigured(),
    },
  });
});

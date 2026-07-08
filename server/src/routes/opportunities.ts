import { Router } from "express";
import { Opps, Finances } from "../db.js";

export const oppsRouter = Router();

oppsRouter.get("/", (_req, res) => {
  res.json(Opps.withPerson(Opps.list()));
});

oppsRouter.post("/", (req, res) => {
  const b = req.body;
  if (!b.name) { res.status(400).json({ error: "name es requerido" }); return; }
  const opp = Opps.create({
    name: b.name, description: b.description, personId: b.personId || null, companyName: b.companyName,
    stage: b.stage ?? "LEAD", value: Number(b.value) || 0, probability: Number(b.probability) || 50,
    expectedClose: b.expectedClose, nextAction: b.nextAction, nextActionAt: b.nextActionAt,
    notes: b.notes, amountPending: Number(b.amountPending) || 0, dueDate: b.dueDate,
  });
  res.status(201).json(opp);
});

oppsRouter.put("/:id", (req, res) => {
  res.json(Opps.update(req.params.id, { ...req.body, syncStatus: "PENDIENTE" }));
});

// Mover de etapa (kanban) — registra contacto
oppsRouter.post("/:id/stage", (req, res) => {
  res.json(Opps.update(req.params.id, { stage: req.body.stage, lastContact: new Date(), syncStatus: "PENDIENTE" }));
});

// Marcar contacto realizado
oppsRouter.post("/:id/contact", (req, res) => {
  res.json(Opps.update(req.params.id, { lastContact: new Date() }));
});

// Registrar cobro
oppsRouter.post("/:id/collect", (req, res) => {
  const opp = Opps.get(req.params.id);
  if (!opp) { res.status(404).json({ error: "No existe" }); return; }
  const collected = Number(req.body.amount) || opp.amountPending;
  Finances.create({ amountIn: collected, category: "COBRO", opportunityId: opp.id, notes: `Cobro ${opp.name}` });
  res.json(Opps.update(opp.id, { amountPending: Math.max(0, opp.amountPending - collected), syncStatus: "PENDIENTE" }));
});

oppsRouter.delete("/:id", (req, res) => {
  Opps.remove(req.params.id);
  res.json({ ok: true });
});

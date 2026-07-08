import { Router } from "express";
import { Entities, Timeline, Opps } from "../db.js";
import { exportEntityToObsidian } from "../services/obsidian.js";

export const entitiesRouter = Router();

// GET /api/entities?type=PERSONA&q=mich
entitiesRouter.get("/", (req, res) => {
  const { type, q } = req.query as { type?: string; q?: string };
  res.json(Entities.list({ type, q }));
});

entitiesRouter.get("/:id", (req, res) => {
  const entity = Entities.get(req.params.id);
  if (!entity) { res.status(404).json({ error: "No existe" }); return; }
  res.json({
    ...entity,
    timeline: Timeline.list(entity.id, 100),
    opportunities: Opps.byPerson(entity.id),
  });
});

entitiesRouter.post("/", (req, res) => {
  const { type = "PERSONA", name, email, phone, company, role, trust, narrative, tags } = req.body;
  if (!name) { res.status(400).json({ error: "name es requerido" }); return; }
  const entity = Entities.create({ type, name, email, phone, company, role, trust: trust ?? 50, narrative, tags: tags ?? "" });
  exportEntityToObsidian(entity).catch(() => {});
  res.status(201).json(entity);
});

entitiesRouter.put("/:id", (req, res) => {
  const { name, email, phone, company, role, trust, narrative, tags } = req.body;
  const entity = Entities.update(req.params.id, { name, email, phone, company, role, trust, narrative, tags, syncStatus: "PENDIENTE" });
  exportEntityToObsidian(entity).catch(() => {});
  res.json(entity);
});

entitiesRouter.delete("/:id", (req, res) => {
  Entities.remove(req.params.id);
  res.json({ ok: true });
});

// Agregar evento al timeline
entitiesRouter.post("/:id/timeline", (req, res) => {
  const { event, type = "CONVERSACION" } = req.body;
  const t = Timeline.add(req.params.id, event, type);
  const ent = Entities.get(req.params.id);
  if (ent) exportEntityToObsidian(ent).catch(() => {});
  res.status(201).json(t);
});

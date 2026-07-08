// ============================================================
// PROCESADOR DE CAPTURAS - Orquestador de IA
// cheap:    transcripcion (via transcribeAudio)
// standard: entidades + hipotesis + proxima accion
// deep:     SOLO si detecta decision critica / cierre de cliente
// ============================================================
import { Captures, Entities, Timeline, Opps } from "../db.js";
import { getAI, aiConfigured, parseModelJSON } from "../ai/provider.js";
import { exportEntityToObsidian } from "./obsidian.js";

const EXTRACT_SYSTEM = `Eres el motor de Amphibian OS, el sistema operativo personal de Gabriel (agencia Amphibian Solutions, CDMX).
Analiza la captura y devuelve JSON con esta forma exacta:
{
  "summary": "resumen en 2 lineas",
  "people": [{"name": "...", "context": "..."}],
  "companies": [{"name": "...", "context": "..."}],
  "ideas": ["..."],
  "opportunity": {"detected": true, "name": "...", "stage": "LEAD", "value": 0, "personName": "..."},
  "hypothesis": "una hipotesis accionable o null",
  "nextAction": "proxima accion concreta o null",
  "critical": false,
  "tags": ["..."]
}
"stage" es uno de: LEAD, DIAGNOSTICADO, PROPUESTA, NEGOCIACION, GANADO.
"critical" es true SOLO si hay cierre de cliente, decision de dinero importante o riesgo de perder una cuenta.`;

export interface ProcessResult {
  summary: string | null;
  entitiesCreated: string[];
  hypothesis: string | null;
  nextAction: string | null;
  deepAnalysis: string | null;
  cost: string;
}

export async function processCapture(captureId: string): Promise<ProcessResult> {
  const capture = Captures.get(captureId);
  if (!capture) throw new Error("Captura no existe");
  const result: ProcessResult = {
    summary: null, entitiesCreated: [], hypothesis: null, nextAction: null, deepAnalysis: null, cost: "",
  };

  if (!aiConfigured()) {
    // Sin IA configurada: guarda crudo, no truena. El sistema funciona sin IA.
    Captures.update(captureId, { processed: true, aiCost: "sin-ia" });
    result.summary = capture.raw.slice(0, 160);
    return result;
  }

  const ai = getAI();
  const used: string[] = [];

  // NIVEL STANDARD: extraccion de entidades + hipotesis + accion
  const raw = await ai.chat({
    tier: "standard",
    system: EXTRACT_SYSTEM,
    messages: [{ role: "user", content: capture.raw }],
    json: true,
    maxTokens: 1200,
  });
  used.push("standard");
  let parsed: any = {};
  try { parsed = parseModelJSON(raw); } catch { parsed = { summary: raw.slice(0, 200) }; }

  result.summary = parsed.summary ?? null;
  result.hypothesis = parsed.hypothesis ?? null;
  result.nextAction = parsed.nextAction ?? null;

  // Crear/actualizar entidades detectadas
  for (const p of parsed.people ?? []) {
    const ent = upsertEntity("PERSONA", p.name, p.context);
    result.entitiesCreated.push(`PERSONA:${ent.name}`);
    Timeline.add(ent.id, parsed.summary ?? capture.raw.slice(0, 200), "CONVERSACION");
  }
  for (const c of parsed.companies ?? []) {
    const ent = upsertEntity("EMPRESA", c.name, c.context);
    result.entitiesCreated.push(`EMPRESA:${ent.name}`);
  }
  for (const idea of parsed.ideas ?? []) {
    const ent = upsertEntity("IDEA", idea, null);
    result.entitiesCreated.push(`IDEA:${ent.name}`);
  }

  // Oportunidad detectada
  if (parsed.opportunity?.detected && parsed.opportunity?.name) {
    const person = parsed.opportunity.personName
      ? Entities.findByName("PERSONA", parsed.opportunity.personName)
      : null;
    const existing = Opps.findByName(parsed.opportunity.name);
    if (!existing) {
      Opps.create({
        name: parsed.opportunity.name,
        stage: parsed.opportunity.stage ?? "LEAD",
        value: Number(parsed.opportunity.value) || 0,
        personId: person?.id,
        nextAction: parsed.nextAction ?? null,
        notes: parsed.summary ?? null,
      });
      result.entitiesCreated.push(`OPORTUNIDAD:${parsed.opportunity.name}`);
    } else {
      Opps.update(existing.id, { lastContact: new Date(), nextAction: parsed.nextAction ?? existing.nextAction });
    }
  }

  // NIVEL DEEP: solo si es critico
  if (parsed.critical) {
    try {
      result.deepAnalysis = await ai.chat({
        tier: "deep",
        system: "Eres el asesor estrategico de Gabriel. Analiza esta situacion critica de negocio en maximo 5 lineas: riesgo principal, palanca principal, y la UNA accion que mueve la aguja.",
        messages: [{ role: "user", content: capture.raw }],
        maxTokens: 600,
      });
      used.push("deep");
    } catch { /* deep es opcional, no truena el flujo */ }
  }

  result.cost = used.join("+");
  Captures.update(captureId, {
    processed: true,
    summary: result.summary,
    entities: JSON.stringify({ people: parsed.people, companies: parsed.companies, ideas: parsed.ideas }),
    hypothesis: result.hypothesis,
    suggestedAction: result.nextAction,
    aiCost: result.cost,
  });

  return result;
}

function upsertEntity(type: string, name: string, context: string | null) {
  const existing = Entities.findByName(type, name);
  if (existing) {
    const ent = Entities.update(existing.id, { syncStatus: "PENDIENTE" });
    exportEntityToObsidian(ent).catch(() => {});
    return ent;
  }
  const ent = Entities.create({ type, name, narrative: context ?? null, syncStatus: "PENDIENTE" });
  exportEntityToObsidian(ent).catch(() => {});
  return ent;
}

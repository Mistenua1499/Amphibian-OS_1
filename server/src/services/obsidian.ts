// ============================================================
// OBSIDIAN EXPORT - Amphibian escribe, TU haces el grafo.
// Estructura: /Journal, /Personas, /Proyectos, /Ideas, /Empresas
// Si OBSIDIAN_VAULT_PATH no esta configurado, no hace nada (no truena).
// ============================================================
import fs from "node:fs/promises";
import path from "node:path";
import { Timeline, Opps, Entities, Journal, SyncLogs } from "../db.js";

function vault(): string | null {
  const p = process.env.OBSIDIAN_VAULT_PATH;
  return p && p.trim() ? p.trim() : null;
}

async function writeNote(relPath: string, content: string) {
  const v = vault();
  if (!v) return false;
  const full = path.join(v, relPath);
  try {
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, "utf8");
    SyncLogs.add("OBSIDIAN", "EXITOSO", relPath);
    return true;
  } catch (e: any) {
    SyncLogs.add("OBSIDIAN", "ERROR", relPath, String(e.message));
    return false;
  }
}

const FOLDER_BY_TYPE: Record<string, string> = {
  PERSONA: "Personas",
  EMPRESA: "Empresas",
  PROYECTO: "Proyectos",
  IDEA: "Ideas",
  MODELO_MENTAL: "Modelos",
};

export async function exportEntityToObsidian(ent: any) {
  const folder = FOLDER_BY_TYPE[ent.type] ?? "Otros";
  const safe = ent.name.replace(/[\\/:*?"<>|]/g, "-");
  const tags = (ent.tags ?? "").split(",").filter(Boolean).map((t: string) => `#${t.trim()}`).join(" ");
  const timeline = Timeline.list(ent.id, 50, "asc");
  const opps = Opps.byPerson(ent.id);

  const md = `---
tipo: ${ent.type}
nombre: ${ent.name}
${ent.email ? `email: ${ent.email}` : ""}
confianza: ${ent.trust ?? 50}
tags: ${tags || "#amphibian"}
última_actualización: ${new Date().toISOString().slice(0, 10)}
---

# ${ent.name}

${ent.narrative ?? ""}

## Timeline
${timeline.map((t: any) => `- **${t.timestamp.toISOString().slice(0, 10)}** (${t.type}): ${t.event}`).join("\n") || "_Sin eventos aún_"}

## Oportunidades
${opps.map((o: any) => `- [[${o.name}]] — ${o.stage} — $${o.value.toLocaleString()}`).join("\n") || "_Sin oportunidades_"}
`;
  const ok = await writeNote(path.join(folder, `${safe}.md`), md);
  if (ok) {
    try { Entities.update(ent.id, { obsidianPath: `${folder}/${safe}.md` }); } catch {}
  }
  return ok;
}

export async function exportJournalToObsidian(entry: any) {
  const md = `---
tipo: BITACORA
fecha: ${entry.date}
tags: #journal #amphibian
---

# Bitácora ${entry.date}

## ¿Qué pasó hoy?
${entry.whatHappened ?? ""}

## ¿Qué aprendí?
${entry.learned ?? ""}

## Hipótesis (confianza ${entry.hypothesisConfidence ?? 50}%)
${entry.hypothesis ?? ""}

## Decisión
${entry.decision ?? ""}

## Promesas
${entry.promises ?? ""}

## Errores
${entry.mistakes ?? ""}

## Victorias (hechos)
${entry.wins ?? ""}

## Próxima acción
${entry.nextAction ?? ""}

## Gratitud
${entry.gratitude ?? ""}

${entry.aiSummary ? `## Análisis IA\n${entry.aiSummary}` : ""}
`;
  const ok = await writeNote(path.join("Journal", `${entry.date}.md`), md);
  if (ok) {
    try { Journal.upsert(entry.date, { exportedToObsidian: true }); } catch {}
  }
  return ok;
}

export function obsidianEnabled(): boolean {
  return !!vault();
}

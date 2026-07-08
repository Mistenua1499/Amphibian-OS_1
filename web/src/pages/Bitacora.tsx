// Bitácora diaria estructurada + registro de salud manual
import { useEffect, useState } from "react";
import { api, today } from "../api";
import { useToast } from "../App";

const FIELDS: [string, string, string][] = [
  ["whatHappened", "¿Qué pasó hoy?", "Los hechos del día..."],
  ["learned", "¿Qué aprendí?", "Un aprendizaje concreto..."],
  ["hypothesis", "Hipótesis", "Si hago X, pasará Y porque Z..."],
  ["decision", "Decisión tomada", ""],
  ["promises", "Promesas hechas", "A quién, qué, para cuándo..."],
  ["mistakes", "Errores", "Sin culpa, con datos..."],
  ["wins", "Victorias (hechos)", ""],
  ["nextAction", "Próxima acción", "La UNA cosa de mañana..."],
  ["gratitude", "Gratitud (3 cosas)", ""],
];

export default function Bitacora() {
  const [date, setDate] = useState(today());
  const [entry, setEntry] = useState<any>({});
  const [health, setHealth] = useState<any>({});
  const [aiSummary, setAiSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api(`/journal/${date}`).then((d) => {
      setEntry(d.entry ?? {});
      setHealth(d.health ?? {});
      setAiSummary(d.entry?.aiSummary ?? "");
    });
  }, [date]);

  const save = async () => {
    setSaving(true);
    try {
      const { aiSummary: _, id, createdAt, updatedAt, exportedToObsidian, ...fields } = entry;
      const saved = await api("/journal", { method: "POST", body: JSON.stringify({ date, ...fields }) });
      setAiSummary(saved.aiSummary ?? "");
      if (health.sleepHours || health.stress || health.energy || health.steps) {
        await api("/health", { method: "POST", body: JSON.stringify({ date, ...health }) });
      }
      toast("✅ Bitácora guardada" + (saved.aiSummary ? " · IA analizó tu día" : ""));
    } catch (e: any) {
      toast(`⚠️ ${e.message.slice(0, 60)}`, true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="field"><label>Fecha</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 200 }} /></div>

      <div className="card">
        <h2>✎ BITÁCORA</h2>
        {FIELDS.map(([key, label, ph]) => (
          <div className="field" key={key}>
            <label>{label}</label>
            <textarea rows={2} placeholder={ph} value={entry[key] ?? ""}
              onChange={(e) => setEntry({ ...entry, [key]: e.target.value })} />
          </div>
        ))}
      </div>

      <div className="card">
        <h2>❤️ SALUD DEL DÍA</h2>
        <div className="grid-2">
          <div className="field"><label>Horas de sueño</label>
            <input type="number" step="0.5" value={health.sleepHours ?? ""} onChange={(e) => setHealth({ ...health, sleepHours: e.target.value })} /></div>
          <div className="field"><label>Estrés (0-100)</label>
            <input type="number" value={health.stress ?? ""} onChange={(e) => setHealth({ ...health, stress: e.target.value })} /></div>
          <div className="field"><label>Energía (1-10)</label>
            <input type="number" value={health.energy ?? ""} onChange={(e) => setHealth({ ...health, energy: e.target.value })} /></div>
          <div className="field"><label>Pasos</label>
            <input type="number" value={health.steps ?? ""} onChange={(e) => setHealth({ ...health, steps: e.target.value })} /></div>
        </div>
      </div>

      {aiSummary && (
        <div className="card" style={{ borderColor: "var(--cyan)" }}>
          <h2>🧠 ANÁLISIS IA</h2>
          <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{aiSummary}</p>
        </div>
      )}

      <button className="btn primary" style={{ width: "100%", padding: 14, marginBottom: 20 }} onClick={save} disabled={saving}>
        {saving ? "Guardando..." : "Guardar bitácora"}
      </button>
    </>
  );
}

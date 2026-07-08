// Lista de personas/empresas con detalle (narrativa + timeline + oportunidades)
import { useEffect, useState } from "react";
import { api, fmt } from "../api";
import { useToast } from "../App";

export default function Personas() {
  const [items, setItems] = useState<any[]>([]);
  const [type, setType] = useState("PERSONA");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<any>(null);
  const [newEvent, setNewEvent] = useState("");
  const toast = useToast();

  const load = () => api(`/entities?type=${type}${q ? `&q=${encodeURIComponent(q)}` : ""}`).then(setItems);
  useEffect(() => { load(); }, [type, q]);

  const open = (id: string) => api(`/entities/${id}`).then(setSel);

  const addEvent = async () => {
    if (!newEvent.trim() || !sel) return;
    await api(`/entities/${sel.id}/timeline`, { method: "POST", body: JSON.stringify({ event: newEvent }) });
    toast("✅ Evento agregado");
    setNewEvent("");
    open(sel.id);
  };

  if (sel) {
    return (
      <>
        <button className="btn ghost" onClick={() => setSel(null)}>← Volver</button>
        <div className="card" style={{ marginTop: 12 }}>
          <h2><span className="big">{sel.name}</span><span style={{ fontFamily: "var(--mono)", fontSize: 13 }}>confianza {sel.trust}%</span></h2>
          {sel.company && <div className="sub" style={{ color: "var(--muted)", marginBottom: 8 }}>{sel.role ? `${sel.role} · ` : ""}{sel.company}</div>}
          {sel.narrative && <p style={{ fontSize: 14.5, lineHeight: 1.5 }}>{sel.narrative}</p>}
        </div>
        {sel.opportunities?.length > 0 && (
          <div className="card">
            <h2>OPORTUNIDADES</h2>
            {sel.opportunities.map((o: any) => (
              <div className="row" key={o.id}>
                <div className="who">{o.name}<div className="sub">{o.stage}</div></div>
                <span className="amount">{fmt(o.value)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="card">
          <h2>TIMELINE</h2>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input placeholder="Registrar conversación, decisión, aprendizaje..." value={newEvent}
              onChange={(e) => setNewEvent(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEvent()} />
            <button className="btn primary" onClick={addEvent}>+</button>
          </div>
          {sel.timeline?.map((t: any) => (
            <div className="timeline-item" key={t.id}>
              <div className="t-date">{new Date(t.timestamp).toLocaleDateString("es-MX")} <span className="t-type">{t.type}</span></div>
              <div style={{ fontSize: 14 }}>{t.event}</div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ maxWidth: 140 }}>
          <option value="PERSONA">Personas</option>
          <option value="EMPRESA">Empresas</option>
          <option value="IDEA">Ideas</option>
          <option value="PROYECTO">Proyectos</option>
        </select>
        <input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card">
        {items.length === 0 && <div className="empty">Nada por aquí todavía. Captura algo y la IA creará las entidades.</div>}
        {items.map((e) => (
          <div className="row" key={e.id} style={{ cursor: "pointer" }} onClick={() => open(e.id)}>
            <div className="who">{e.name}
              <div className="sub">{e.company ?? e.narrative?.slice(0, 60) ?? ""}</div>
            </div>
            <span className="days">{e.trust}%</span>
          </div>
        ))}
      </div>
    </>
  );
}

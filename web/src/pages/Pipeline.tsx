// Kanban de oportunidades con avance de etapa
import { useEffect, useState } from "react";
import { api, fmt } from "../api";
import { useToast } from "../App";

const STAGES = ["LEAD", "DIAGNOSTICADO", "PROPUESTA", "NEGOCIACION", "GANADO"];
const NEXT: Record<string, string> = { LEAD: "DIAGNOSTICADO", DIAGNOSTICADO: "PROPUESTA", PROPUESTA: "NEGOCIACION", NEGOCIACION: "GANADO" };

export default function Pipeline() {
  const [opps, setOpps] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", value: "", companyName: "", nextAction: "" });
  const toast = useToast();

  const load = () => api("/opportunities").then(setOpps);
  useEffect(() => { load(); }, []);

  const move = async (id: string, stage: string) => {
    await api(`/opportunities/${id}/stage`, { method: "POST", body: JSON.stringify({ stage }) });
    toast(stage === "GANADO" ? "🏆 ¡GANADO!" : `→ ${stage}`);
    load();
  };
  const lose = async (id: string) => {
    await api(`/opportunities/${id}/stage`, { method: "POST", body: JSON.stringify({ stage: "PERDIDO" }) });
    load();
  };
  const create = async () => {
    if (!form.name.trim()) return;
    await api("/opportunities", { method: "POST", body: JSON.stringify({ ...form, value: Number(form.value) || 0 }) });
    toast("✅ Oportunidad creada");
    setShowNew(false);
    setForm({ name: "", value: "", companyName: "", nextAction: "" });
    load();
  };

  const days = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn primary" onClick={() => setShowNew(true)}>+ Nueva</button>
      </div>
      <div className="kanban">
        {STAGES.map((stage) => (
          <div className="kcol" key={stage}>
            <h3>{stage} · {opps.filter((o) => o.stage === stage).length}</h3>
            {opps.filter((o) => o.stage === stage).map((o) => (
              <div className="kcard" key={o.id}>
                <div className="name">{o.name}</div>
                <div className="val">{fmt(o.value)} · {o.probability}%</div>
                <div className="meta">
                  {o.person?.name ?? o.companyName ?? ""} · {days(o.lastContact)}d sin contacto
                  {o.nextAction ? <><br />⚡ {o.nextAction}</> : <><br />⚠️ sin próxima acción</>}
                </div>
                <div className="actions">
                  {NEXT[stage] && <button className="btn small" onClick={() => move(o.id, NEXT[stage])}>→ {NEXT[stage].slice(0, 6)}</button>}
                  {stage !== "GANADO" && <button className="btn small ghost danger" onClick={() => lose(o.id)}>✕</button>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {showNew && (
        <div className="modal-bg" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>NUEVA OPORTUNIDAD</h3>
            <div className="field"><label>Nombre</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="CRM para Central de Abastos" /></div>
            <div className="grid-2">
              <div className="field"><label>Valor MXN</label>
                <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
              <div className="field"><label>Empresa</label>
                <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></div>
            </div>
            <div className="field"><label>Próxima acción</label>
              <input value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} /></div>
            <div className="foot">
              <button className="btn" onClick={() => setShowNew(false)}>Cancelar</button>
              <button className="btn primary" onClick={create}>Crear</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

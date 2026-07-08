// Dashboard HOY: dinero, seguimientos, pipeline, salud, recordatorios, agenda
import { useEffect, useState } from "react";
import { api, fmt } from "../api";
import { useToast } from "../App";

export default function Hoy() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const toast = useToast();

  const load = () => api("/dashboard").then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  if (err) return <div className="card"><div className="empty">Sin conexión con el servidor: {err}</div></div>;
  if (!d) return <div className="empty">Cargando...</div>;

  const collect = async (id: string) => {
    await api(`/opportunities/${id}/collect`, { method: "POST", body: JSON.stringify({}) });
    toast("💵 Cobro registrado");
    load();
  };
  const contacted = async (id: string) => {
    await api(`/opportunities/${id}/contact`, { method: "POST", body: JSON.stringify({}) });
    toast("✅ Contacto registrado");
    load();
  };
  const doneReminder = async (id: string) => {
    await api(`/reminders/${id}/done`, { method: "POST", body: JSON.stringify({}) });
    load();
  };

  const i = d.integrations;
  const stageLbl: Record<string, string> = { LEAD: "Leads", DIAGNOSTICADO: "Diagn.", PROPUESTA: "Prop.", NEGOCIACION: "Negoc.", GANADO_MES: "Ganado" };

  return (
    <>
      <div className="statusbar">
        <span className={`pill ${i.ai ? "on" : "off"}`}>IA:{i.aiProvider}</span>
        <span className={`pill ${i.telegram ? "on" : "off"}`}>Telegram</span>
        <span className={`pill ${i.googleConnected ? "on" : i.google ? "warn" : "off"}`}>Google</span>
        <span className={`pill ${i.obsidian ? "on" : "off"}`}>Obsidian</span>
        <span className={`pill ${i.whatsapp ? "on" : "off"}`}>WhatsApp</span>
      </div>

      <div className="card">
        <h2>💰 DINERO HOY <span className="money-total">{fmt(d.money.total)}</span></h2>
        {d.money.items.length === 0 && <div className="empty">Nada por cobrar. 🎉</div>}
        {d.money.items.map((m: any) => (
          <div className="row" key={m.id}>
            <div className="who">{m.who}
              {m.dueDate && <div className="sub">vence {new Date(m.dueDate).toLocaleDateString("es-MX")}</div>}
            </div>
            <span className="amount">{fmt(m.amount)}</span>
            <button className="btn small" onClick={() => collect(m.id)}>Cobrado</button>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>🎯 SEGUIMIENTOS</h2>
        {d.followUps.length === 0 && <div className="empty">Todo al día.</div>}
        {d.followUps.map((f: any) => (
          <div className="row" key={f.id}>
            <div className="who">{f.who || f.name}
              <div className="sub">{f.name} · {f.stage}</div>
            </div>
            <span className={`days ${f.daysSinceContact >= 7 ? "hot" : ""}`}>{f.daysSinceContact}d</span>
            <button className="btn small" onClick={() => contacted(f.id)}>Contacté</button>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>📊 PIPELINE</h2>
        <div className="pipe-grid">
          {["LEAD", "DIAGNOSTICADO", "PROPUESTA", "NEGOCIACION", "GANADO_MES"].map((s) => (
            <div className={`pipe-cell ${s === "GANADO_MES" ? "won" : ""}`} key={s}>
              <div className="n">{d.pipeline[s]?.count ?? 0}</div>
              <div className="v">{fmt(d.pipeline[s]?.value ?? 0)}</div>
              <div className="s">{stageLbl[s]}</div>
            </div>
          ))}
        </div>
      </div>

      {d.reminders.length > 0 && (
        <div className="card">
          <h2>🔔 RECORDATORIOS</h2>
          {d.reminders.map((r: any) => (
            <div className="reminder" key={r.id}>
              <span className={`dot ${r.severity.toLowerCase()}`} />
              <span className="msg">{r.message}</span>
              <button className="btn small ghost" onClick={() => doneReminder(r.id)}>✓</button>
            </div>
          ))}
        </div>
      )}

      {d.health && (
        <div className="card">
          <h2>❤️ SALUD</h2>
          <div className="health-grid">
            <div className="metric"><div className={`val ${(d.health.sleepHours ?? 8) < 7 ? "warn" : "good"}`}>{d.health.sleepHours ?? "—"}h</div><div className="lbl">Sueño</div></div>
            <div className="metric"><div className={`val ${(d.health.stress ?? 0) > 70 ? "bad" : "good"}`}>{d.health.stress ?? "—"}</div><div className="lbl">Estrés</div></div>
            <div className="metric"><div className="val">{d.health.energy ?? "—"}</div><div className="lbl">Energía</div></div>
            <div className="metric"><div className="val">{d.health.steps?.toLocaleString() ?? "—"}</div><div className="lbl">Pasos</div></div>
          </div>
        </div>
      )}

      {(d.calendar.length > 0 || d.nextActions.length > 0) && (
        <div className="card">
          <h2>📅 AGENDA + ACCIONES</h2>
          {d.calendar.map((e: any, idx: number) => (
            <div className="row" key={`c${idx}`}>
              <div className="who">{e.summary}</div>
              <span className="days">{e.start?.slice(11, 16) || ""}</span>
            </div>
          ))}
          {d.nextActions.map((a: any) => (
            <div className="row" key={a.id}>
              <div className="who">{a.action}<div className="sub">{a.opp}</div></div>
              {a.at && <span className="days">{new Date(a.at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

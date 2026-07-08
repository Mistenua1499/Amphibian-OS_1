// Estado del sistema: integraciones, sync, capturas recientes
import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../App";

export default function Ajustes() {
  const [dash, setDash] = useState<any>(null);
  const [sync, setSync] = useState<any>(null);
  const [captures, setCaptures] = useState<any[]>([]);
  const toast = useToast();

  const load = () => {
    api("/dashboard").then(setDash);
    api("/sync/status").then(setSync);
    api("/captures").then(setCaptures);
  };
  useEffect(() => { load(); }, []);

  const runSync = async () => {
    try {
      const r = await api("/sync/run", { method: "POST", body: JSON.stringify({}) });
      toast(r.skipped ? "⚠️ Google no conectado" : "☁️ Sincronizado");
      load();
    } catch (e: any) {
      toast(`⚠️ ${e.message.slice(0, 70)}`, true);
    }
  };

  if (!dash) return <div className="empty">Cargando...</div>;
  const i = dash.integrations;

  const Item = ({ ok, name, hint }: { ok: boolean; name: string; hint: string }) => (
    <div className="row">
      <div className="who">{name}<div className="sub">{hint}</div></div>
      <span className={`pill ${ok ? "on" : "off"}`}>{ok ? "ACTIVO" : "APAGADO"}</span>
    </div>
  );

  return (
    <>
      <div className="card">
        <h2>⚙ INTEGRACIONES</h2>
        <Item ok={i.ai} name={`IA (${i.aiProvider})`} hint="Cambia AI_PROVIDER en server/.env: anthropic, openai, gemini u ollama" />
        <Item ok={i.telegram} name="Telegram" hint="TELEGRAM_BOT_TOKEN en server/.env · docs/TELEGRAM_SETUP.md" />
        <Item ok={i.googleConnected} name="Google (Sheets/Calendar/Drive)" hint={i.google ? "Credenciales listas — conecta abajo" : "docs/GOOGLE_SETUP.md"} />
        <Item ok={i.obsidian} name="Obsidian" hint="OBSIDIAN_VAULT_PATH en server/.env" />
        <Item ok={i.whatsapp} name="WhatsApp (Twilio)" hint="docs/WHATSAPP_SETUP.md — webhook ya listo" />
        {i.google && !i.googleConnected && (
          <a href="/api/google/auth"><button className="btn primary" style={{ width: "100%", marginTop: 10 }}>Conectar Google</button></a>
        )}
      </div>

      <div className="card">
        <h2>☁ SINCRONIZACIÓN <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{sync?.pending ?? 0} pendientes</span></h2>
        <button className="btn" style={{ width: "100%", marginBottom: 10 }} onClick={runSync}>Sincronizar ahora</button>
        {sync?.logs?.slice(0, 5).map((l: any) => (
          <div className="row" key={l.id}>
            <div className="who">{l.target}<div className="sub">{new Date(l.createdAt).toLocaleString("es-MX")}</div></div>
            <span className={`pill ${l.status === "EXITOSO" ? "on" : "warn"}`}>{l.status}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>📥 CAPTURAS RECIENTES</h2>
        {captures.length === 0 && <div className="empty">Aún no hay capturas.</div>}
        {captures.slice(0, 10).map((c) => (
          <div className="row" key={c.id}>
            <div className="who">{c.summary ?? c.raw.slice(0, 70)}
              <div className="sub">{c.channel} · {c.kind} · {new Date(c.createdAt).toLocaleString("es-MX")} {c.aiCost ? `· ${c.aiCost}` : ""}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

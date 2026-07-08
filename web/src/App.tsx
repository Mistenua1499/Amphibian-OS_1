import { useEffect, useState, createContext, useContext } from "react";
import Hoy from "./pages/Hoy";
import Pipeline from "./pages/Pipeline";
import Personas from "./pages/Personas";
import Bitacora from "./pages/Bitacora";
import Ajustes from "./pages/Ajustes";
import CaptureModal from "./components/CaptureModal";
import { queueSize, flushQueue } from "./api";

type Page = "hoy" | "pipeline" | "personas" | "bitacora" | "ajustes";

const ToastCtx = createContext<(msg: string, err?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export default function App() {
  const [page, setPage] = useState<Page>((location.hash.slice(1) as Page) || "hoy");
  const [showCapture, setShowCapture] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err: boolean } | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const onHash = () => setPage((location.hash.slice(1) as Page) || "hoy");
    window.addEventListener("hashchange", onHash);
    const onOnline = async () => {
      setOffline(false);
      const sent = await flushQueue();
      if (sent > 0) showToast(`📤 ${sent} capturas offline enviadas`);
      setRefreshKey((k) => k + 1);
    };
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const showToast = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3000);
  };

  const go = (p: Page) => { location.hash = p; setPage(p); };

  const pages: Record<Page, JSX.Element> = {
    hoy: <Hoy key={`h${refreshKey}`} />,
    pipeline: <Pipeline key={`p${refreshKey}`} />,
    personas: <Personas key={`e${refreshKey}`} />,
    bitacora: <Bitacora key={`b${refreshKey}`} />,
    ajustes: <Ajustes key={`a${refreshKey}`} />,
  };

  return (
    <ToastCtx.Provider value={showToast}>
      <div className="app">
        <div className="topbar">
          <div className="logo">AMPHIBIAN <span>OS</span></div>
          <div className="date-label">
            {new Date().toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}
          </div>
        </div>
        {offline && (
          <div className="offline-banner">
            ⚡ MODO OFFLINE — las capturas se encolan ({queueSize()} pendientes)
          </div>
        )}
        {pages[page]}
      </div>

      <button className="fab" onClick={() => setShowCapture(true)} aria-label="Capturar">+</button>

      <nav className="nav">
        {([
          ["hoy", "◉", "Hoy"],
          ["pipeline", "▤", "Pipeline"],
          ["personas", "◎", "Personas"],
          ["bitacora", "✎", "Bitácora"],
          ["ajustes", "⚙", "Ajustes"],
        ] as [Page, string, string][]).map(([p, ico, lbl]) => (
          <button key={p} className={page === p ? "active" : ""} onClick={() => go(p)}>
            <span className="ico">{ico}</span>{lbl}
          </button>
        ))}
      </nav>

      {showCapture && (
        <CaptureModal
          onClose={() => setShowCapture(false)}
          onDone={(msg) => { showToast(msg); setShowCapture(false); setRefreshKey((k) => k + 1); }}
        />
      )}
      {toast && <div className={`toast ${toast.err ? "err" : ""}`}>{toast.msg}</div>}
    </ToastCtx.Provider>
  );
}

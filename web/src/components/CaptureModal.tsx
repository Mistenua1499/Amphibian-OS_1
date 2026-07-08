// Modal de captura: texto o audio (MediaRecorder -> /api/captures/audio)
import { useRef, useState } from "react";
import { captureText, captureAudio } from "../api";

export default function CaptureModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const sendText = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const { queued, result } = await captureText(text.trim());
    setBusy(false);
    if (queued) onDone("📥 Sin red: captura encolada");
    else {
      const r = result?.result;
      onDone(r?.entitiesCreated?.length ? `✅ Capturado · ${r.entitiesCreated.join(", ")}` : "✅ Capturado");
    }
  };

  const toggleRecord = async () => {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setBusy(true);
        try {
          const blob = new Blob(chunksRef.current, { type: mime });
          const res = await captureAudio(blob);
          onDone(res.transcription ? `🎙️ "${res.transcription.slice(0, 60)}..."` : "✅ Audio capturado");
        } catch (e: any) {
          onDone(`⚠️ ${e.message.slice(0, 80)}`);
        } finally {
          setBusy(false);
        }
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch {
      onDone("⚠️ No hay acceso al micrófono");
    }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>CAPTURAR</h3>
        <textarea
          autoFocus
          placeholder="Escribe lo que traes en la cabeza: una llamada, una idea, un pendiente..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendText(); }}
        />
        <div className="foot">
          <button className={`btn ${recording ? "danger rec" : ""}`} onClick={toggleRecord} disabled={busy}>
            {recording ? "⏹ Detener" : "🎙️ Audio"}
          </button>
          <button className="btn primary" onClick={sendText} disabled={busy || !text.trim()}>
            {busy ? "Procesando..." : "Capturar"}
          </button>
        </div>
      </div>
    </div>
  );
}

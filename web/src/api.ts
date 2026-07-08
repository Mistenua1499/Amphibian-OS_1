// ============================================================
// CLIENTE API + COLA OFFLINE
// Si no hay red, las capturas se encolan en localStorage y se
// mandan solas cuando vuelve la conexion. Nada se pierde.
// ============================================================

const QUEUE_KEY = "amphibian_offline_queue";

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }
  return res.json();
}

// ---- Cola offline para capturas ----
type QueuedCapture = { raw: string; kind: string; ts: number };

function getQueue(): QueuedCapture[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; }
}
function setQueue(q: QueuedCapture[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}
export function queueSize(): number { return getQueue().length; }

export async function captureText(raw: string): Promise<{ queued: boolean; result?: any }> {
  try {
    const result = await api("/captures", { method: "POST", body: JSON.stringify({ raw, kind: "TEXTO" }) });
    return { queued: false, result };
  } catch {
    const q = getQueue();
    q.push({ raw, kind: "TEXTO", ts: Date.now() });
    setQueue(q);
    return { queued: true };
  }
}

export async function flushQueue(): Promise<number> {
  const q = getQueue();
  if (!q.length) return 0;
  let sent = 0;
  const remaining: QueuedCapture[] = [];
  for (const item of q) {
    try {
      await api("/captures", { method: "POST", body: JSON.stringify({ raw: item.raw, kind: item.kind }) });
      sent++;
    } catch {
      remaining.push(item);
    }
  }
  setQueue(remaining);
  return sent;
}

// Auto-flush cuando vuelve la red
if (typeof window !== "undefined") {
  window.addEventListener("online", () => { flushQueue(); });
}

export async function captureAudio(blob: Blob): Promise<any> {
  const res = await fetch("/api/captures/audio", {
    method: "POST",
    headers: { "content-type": blob.type || "audio/webm" },
    body: blob,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const fmt = (n: number) => `$${(n ?? 0).toLocaleString("es-MX")}`;
export const today = () => new Date().toISOString().slice(0, 10);

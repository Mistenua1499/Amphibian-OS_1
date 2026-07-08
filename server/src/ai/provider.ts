// ============================================================
// CAPA DE IA PORTABLE (provider-agnostic)
// Cambia AI_PROVIDER en .env y todo el sistema usa otro backend.
// Niveles: cheap (clasificar/transcribir) | standard (entidades/hipotesis) | deep (analisis critico)
// ============================================================

export type Msg = { role: "user" | "assistant"; content: string };
export type Tier = "cheap" | "standard" | "deep";

export interface ChatOpts {
  tier: Tier;
  system?: string;
  messages: Msg[];
  maxTokens?: number;
  json?: boolean; // pedir respuesta JSON estricta
}

export interface AIProvider {
  name: string;
  chat(opts: ChatOpts): Promise<string>;
  // Transcripcion de audio (no todos los providers la soportan)
  transcribe?(audio: Buffer, mime: string): Promise<string>;
}

// Modelos default por proveedor y nivel. Sobreescribibles via env MODEL_CHEAP/STANDARD/DEEP.
export const DEFAULT_MODELS: Record<string, Record<Tier, string>> = {
  anthropic: {
    cheap: "claude-haiku-4-5-20251001",
    standard: "claude-sonnet-4-6",
    deep: "claude-opus-4-8",
  },
  openai: {
    cheap: "gpt-4o-mini",
    standard: "gpt-4o",
    deep: "gpt-4o", // sube a o1/o3 si tu cuenta lo tiene
  },
  gemini: {
    cheap: "gemini-2.0-flash",
    standard: "gemini-2.0-flash",
    deep: "gemini-2.5-pro",
  },
  ollama: {
    cheap: "llama3.2",
    standard: "llama3.1:8b",
    deep: "llama3.1:70b",
  },
};

export function modelFor(provider: string, tier: Tier): string {
  const envKey = { cheap: "MODEL_CHEAP", standard: "MODEL_STANDARD", deep: "MODEL_DEEP" }[tier];
  return process.env[envKey!] || DEFAULT_MODELS[provider]?.[tier] || DEFAULT_MODELS.anthropic[tier];
}

// ---------- Router ----------
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import { GeminiProvider } from "./gemini.js";
import { OllamaProvider } from "./ollama.js";

let _provider: AIProvider | null = null;

export function getAI(): AIProvider {
  if (_provider) return _provider;
  const name = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
  switch (name) {
    case "openai": _provider = new OpenAIProvider(); break;
    case "gemini": _provider = new GeminiProvider(); break;
    case "ollama": _provider = new OllamaProvider(); break;
    default: _provider = new AnthropicProvider();
  }
  return _provider;
}

export function aiConfigured(): boolean {
  const p = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
  if (p === "anthropic") return !!process.env.ANTHROPIC_API_KEY;
  if (p === "openai") return !!process.env.OPENAI_API_KEY;
  if (p === "gemini") return !!process.env.GEMINI_API_KEY;
  return true; // ollama local no necesita key
}

// Transcripcion con fallback: si el provider activo no transcribe,
// intenta OpenAI Whisper o Gemini si hay keys disponibles.
export async function transcribeAudio(audio: Buffer, mime: string): Promise<string> {
  const ai = getAI();
  if (ai.transcribe) return ai.transcribe(audio, mime);
  if (process.env.OPENAI_API_KEY) return new OpenAIProvider().transcribe!(audio, mime);
  if (process.env.GEMINI_API_KEY) return new GeminiProvider().transcribe!(audio, mime);
  throw new Error(
    `El proveedor "${ai.name}" no soporta transcripcion de audio. Agrega OPENAI_API_KEY (Whisper) o GEMINI_API_KEY como fallback.`
  );
}

// Utilidad: extraer JSON de una respuesta de modelo (tolera ```json fences)
export function parseModelJSON<T = any>(text: string): T {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return JSON.parse(clean.slice(start, end + 1)) as T;
}

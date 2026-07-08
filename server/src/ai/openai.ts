// Adaptador OpenAI. TAMBIEN sirve para cualquier API OpenAI-compatible
// (DeepSeek, Groq, Together, Mistral, etc): solo cambia OPENAI_BASE_URL y los MODEL_*.
import { AIProvider, ChatOpts, modelFor } from "./provider.js";

export class OpenAIProvider implements AIProvider {
  name = "openai";
  base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  async chat(opts: ChatOpts): Promise<string> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("Falta OPENAI_API_KEY en server/.env");
    const messages: any[] = [];
    if (opts.system) messages.push({ role: "system", content: opts.system });
    messages.push(...opts.messages);
    const body: any = {
      model: modelFor("openai", opts.tier),
      max_tokens: opts.maxTokens ?? 1024,
      messages,
    };
    if (opts.json) body.response_format = { type: "json_object" };
    const res = await fetch(`${this.base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  async transcribe(audio: Buffer, mime: string): Promise<string> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("Falta OPENAI_API_KEY para Whisper");
    const form = new FormData();
    const ext = mime.includes("webm") ? "webm" : mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "mp3";
    form.append("file", new Blob([audio], { type: mime }), `audio.${ext}`);
    form.append("model", "whisper-1");
    form.append("language", "es");
    const res = await fetch(`${this.base}/audio/transcriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return data.text ?? "";
  }
}

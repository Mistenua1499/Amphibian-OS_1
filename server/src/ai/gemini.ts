import { AIProvider, ChatOpts, modelFor } from "./provider.js";

export class GeminiProvider implements AIProvider {
  name = "gemini";
  base = "https://generativelanguage.googleapis.com/v1beta";

  private async call(model: string, body: any): Promise<any> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Falta GEMINI_API_KEY en server/.env");
    const res = await fetch(`${this.base}/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async chat(opts: ChatOpts): Promise<string> {
    const model = modelFor("gemini", opts.tier);
    const contents = opts.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const body: any = {
      contents,
      generationConfig: { maxOutputTokens: opts.maxTokens ?? 1024 },
    };
    if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
    if (opts.json) body.generationConfig.responseMimeType = "application/json";
    const data = await this.call(model, body);
    return data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  }

  async transcribe(audio: Buffer, mime: string): Promise<string> {
    const model = modelFor("gemini", "cheap");
    const data = await this.call(model, {
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: mime, data: audio.toString("base64") } },
          { text: "Transcribe este audio en español. Devuelve SOLO la transcripcion." },
        ],
      }],
    });
    return data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  }
}

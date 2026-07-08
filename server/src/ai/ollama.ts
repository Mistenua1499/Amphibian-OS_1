// Ollama local: gratis, privado, sin internet. Instala https://ollama.com y `ollama pull llama3.2`
import { AIProvider, ChatOpts, modelFor } from "./provider.js";

export class OllamaProvider implements AIProvider {
  name = "ollama";
  base = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

  async chat(opts: ChatOpts): Promise<string> {
    const messages: any[] = [];
    if (opts.system) messages.push({ role: "system", content: opts.system });
    messages.push(...opts.messages);
    const body: any = {
      model: modelFor("ollama", opts.tier),
      messages,
      stream: false,
      options: { num_predict: opts.maxTokens ?? 1024 },
    };
    if (opts.json) body.format = "json";
    const res = await fetch(`${this.base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()} — ¿Está corriendo Ollama? (ollama serve)`);
    const data: any = await res.json();
    return data.message?.content ?? "";
  }
}

import { AIProvider, ChatOpts, modelFor } from "./provider.js";

export class AnthropicProvider implements AIProvider {
  name = "anthropic";

  async chat(opts: ChatOpts): Promise<string> {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("Falta ANTHROPIC_API_KEY en server/.env");
    const body: any = {
      model: modelFor("anthropic", opts.tier),
      max_tokens: opts.maxTokens ?? 1024,
      messages: opts.messages,
    };
    if (opts.system) body.system = opts.system + (opts.json ? "\nResponde UNICAMENTE con JSON valido, sin markdown ni texto extra." : "");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
  }
}

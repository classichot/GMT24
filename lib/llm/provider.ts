import "server-only";
import type { ModelConfig } from "./config";

/**
 * Provider adapters. One interface, three wire formats:
 *  - OpenAI chat completions (also OpenRouter, Groq, Azure-style gateways, Ollama /v1)
 *  - Anthropic messages
 * Every call has a timeout, returns token usage, and surfaces tool calls in one shape.
 */

export type ToolDef = { name: string; description: string; parameters: Record<string, unknown> };
export type ToolCall = { id: string; name: string; args: Record<string, unknown> };

export type LlmMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string };

export type LlmRequest = {
  messages: LlmMessage[];
  tools?: ToolDef[];
  /** Ask for a JSON object; the caller validates the shape. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

export type LlmResult = {
  text: string;
  toolCalls: ToolCall[];
  usage: { input: number; output: number };
  finish: "stop" | "tool_calls" | "length" | "other";
  model: string;
  provider: string;
  latencyMs: number;
};

export class LlmError extends Error {
  constructor(public code: "not_configured" | "unreachable" | "timeout" | "http" | "bad_response" | "aborted", message: string, public status?: number) {
    super(message);
  }
}

function withTimeout(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal; clear: () => void } {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(new LlmError("timeout", `Model call exceeded ${ms} ms`)), ms);
  const onAbort = () => ctl.abort(signal?.reason ?? new LlmError("aborted", "Cancelled"));
  signal?.addEventListener("abort", onAbort, { once: true });
  return { signal: ctl.signal, clear: () => { clearTimeout(t); signal?.removeEventListener("abort", onAbort); } };
}

async function post(url: string, headers: Record<string, string>, body: unknown, signal: AbortSignal): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal });
  } catch (e) {
    if (e instanceof LlmError) throw e;
    if (signal.aborted && signal.reason instanceof LlmError) throw signal.reason;
    throw new LlmError("unreachable", `Model endpoint unreachable: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LlmError("http", `Model endpoint returned ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
  return res.json();
}

function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") { try { const v = JSON.parse(raw); return v && typeof v === "object" ? v : {}; } catch { return {}; } }
  return {};
}

/* ---------- OpenAI-compatible ---------- */

type OaMessage = { role: string; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[]; tool_call_id?: string; name?: string };

function toOpenAi(m: LlmMessage): OaMessage {
  switch (m.role) {
    case "system": return { role: "system", content: m.content };
    case "user": return { role: "user", content: m.content };
    case "assistant": return { role: "assistant", content: m.content || null, ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: JSON.stringify(c.args) } })) } : {}) };
    case "tool": return { role: "tool", tool_call_id: m.toolCallId, name: m.name, content: m.content };
  }
}

async function openAiChat(cfg: ModelConfig, req: LlmRequest): Promise<LlmResult> {
  const t0 = Date.now();
  const { signal, clear } = withTimeout(req.signal, cfg.timeoutMs);
  try {
    const body: Record<string, unknown> = {
      model: cfg.model,
      messages: req.messages.map(toOpenAi),
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxTokens ?? cfg.maxTokens,
    };
    if (req.tools?.length && cfg.nativeTools) body.tools = req.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
    if (req.json) body.response_format = { type: "json_object" };
    const headers: Record<string, string> = cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {};
    const data = (await post(`${cfg.baseUrl}/chat/completions`, headers, body, signal)) as {
      choices?: { message?: OaMessage; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };
    const choice = data.choices?.[0];
    if (!choice?.message) throw new LlmError("bad_response", "Model returned no choices");
    const toolCalls: ToolCall[] = (choice.message.tool_calls ?? []).map((c, i) => ({ id: c.id || `call_${i}`, name: c.function.name, args: parseArgs(c.function.arguments) }));
    const finish = toolCalls.length ? "tool_calls" : choice.finish_reason === "length" ? "length" : choice.finish_reason === "stop" ? "stop" : "other";
    return { text: choice.message.content ?? "", toolCalls, usage: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 }, finish, model: data.model ?? cfg.model, provider: cfg.provider, latencyMs: Date.now() - t0 };
  } finally {
    clear();
  }
}

/* ---------- Anthropic ---------- */

type AnBlock = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown } | { type: "tool_result"; tool_use_id: string; content: string };

async function anthropicChat(cfg: ModelConfig, req: LlmRequest): Promise<LlmResult> {
  const t0 = Date.now();
  const { signal, clear } = withTimeout(req.signal, cfg.timeoutMs);
  try {
    const system = req.messages.filter((m) => m.role === "system").map((m) => (m as { content: string }).content).join("\n\n");
    const messages: { role: "user" | "assistant"; content: AnBlock[] | string }[] = [];
    for (const m of req.messages) {
      if (m.role === "system") continue;
      if (m.role === "user") messages.push({ role: "user", content: m.content });
      else if (m.role === "assistant") {
        const blocks: AnBlock[] = [];
        if (m.content) blocks.push({ type: "text", text: m.content });
        for (const c of m.toolCalls ?? []) blocks.push({ type: "tool_use", id: c.id, name: c.name, input: c.args });
        messages.push({ role: "assistant", content: blocks.length ? blocks : "" });
      } else {
        const last = messages[messages.length - 1];
        const block: AnBlock = { type: "tool_result", tool_use_id: m.toolCallId, content: m.content };
        if (last && last.role === "user" && Array.isArray(last.content)) last.content.push(block);
        else messages.push({ role: "user", content: [block] });
      }
    }
    if (req.json) {
      const last = messages[messages.length - 1];
      const hint = "\n\nRespond with a single JSON object and nothing else.";
      if (last && typeof last.content === "string") last.content += hint;
    }
    const body: Record<string, unknown> = { model: cfg.model, max_tokens: req.maxTokens ?? cfg.maxTokens, temperature: req.temperature ?? 0.2, system, messages };
    if (req.tools?.length && cfg.nativeTools) body.tools = req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
    const data = (await post(`${cfg.baseUrl}/messages`, { "x-api-key": cfg.apiKey ?? "", "anthropic-version": "2023-06-01" }, body, signal)) as {
      content?: AnBlock[]; stop_reason?: string; usage?: { input_tokens?: number; output_tokens?: number }; model?: string;
    };
    const text = (data.content ?? []).filter((b): b is { type: "text"; text: string } => b.type === "text").map((b) => b.text).join("\n");
    const toolCalls: ToolCall[] = (data.content ?? []).filter((b): b is { type: "tool_use"; id: string; name: string; input: unknown } => b.type === "tool_use").map((b) => ({ id: b.id, name: b.name, args: parseArgs(b.input) }));
    const finish = toolCalls.length ? "tool_calls" : data.stop_reason === "max_tokens" ? "length" : data.stop_reason === "end_turn" ? "stop" : "other";
    return { text, toolCalls, usage: { input: data.usage?.input_tokens ?? 0, output: data.usage?.output_tokens ?? 0 }, finish, model: data.model ?? cfg.model, provider: cfg.provider, latencyMs: Date.now() - t0 };
  } finally {
    clear();
  }
}

/* ---------- entry ---------- */

export async function chat(cfg: ModelConfig, req: LlmRequest): Promise<LlmResult> {
  if (cfg.provider === "none") throw new LlmError("not_configured", "No language model is configured (set GMT24_LLM_PROVIDER and GMT24_LLM_MODEL).");
  if (cfg.provider === "anthropic") return anthropicChat(cfg, req);
  const base = cfg.provider === "ollama" && !/\/v1$/.test(cfg.baseUrl) ? { ...cfg, baseUrl: `${cfg.baseUrl}/v1` } : cfg;
  return openAiChat(base, req);
}

/** Cheap reachability probe for the status endpoint; never throws. */
export async function probe(cfg: ModelConfig): Promise<{ ok: boolean; detail: string }> {
  if (cfg.provider === "none") return { ok: false, detail: "not configured" };
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    let url = cfg.provider === "anthropic" ? `${cfg.baseUrl}/models` : `${cfg.provider === "ollama" && !/\/v1$/.test(cfg.baseUrl) ? `${cfg.baseUrl}/v1` : cfg.baseUrl}/models`;
    if (cfg.provider === "ollama") url = `${cfg.baseUrl.replace(/\/v1$/, "")}/api/tags`;
    const headers: Record<string, string> = cfg.provider === "anthropic" ? { "x-api-key": cfg.apiKey ?? "", "anthropic-version": "2023-06-01" } : cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {};
    const res = await fetch(url, { headers, signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return { ok: false, detail: `endpoint returned ${res.status}` };
    if (cfg.provider === "ollama") {
      const data = (await res.json()) as { models?: { name: string }[] };
      const have = (data.models ?? []).some((m) => m.name === cfg.model || m.name.split(":")[0] === cfg.model);
      return have ? { ok: true, detail: "model present" } : { ok: false, detail: `model ${cfg.model} not pulled` };
    }
    return { ok: true, detail: "reachable" };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "unreachable" };
  }
}

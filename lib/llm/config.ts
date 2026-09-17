import "server-only";

/**
 * Model configuration lives here and nowhere else. Features never name a
 * provider or model; they ask the orchestrator for a "task profile" and the
 * profile maps to a configured model. Configuration is read from the
 * environment on the server so credentials never reach the browser.
 *
 * Environment:
 *   GMT24_LLM_PROVIDER   openai | anthropic | ollama | openai-compatible | none
 *   GMT24_LLM_MODEL      model id for the default profile (e.g. gpt-4o-mini, claude-3-5-haiku-latest, qwen2.5:3b)
 *   GMT24_LLM_API_KEY    provider key (not needed for ollama)
 *   GMT24_LLM_BASE_URL   override endpoint (OpenAI-compatible gateways, Ollama host)
 *   GMT24_LLM_MODEL_REASONING   optional stronger model for memo/strategy/review and classification (fact→question mapping, change triage)
 *   GMT24_LLM_MODEL_EXTRACTION  optional model for document extraction (long context)
 *   GMT24_LLM_TIMEOUT_MS        per-call timeout (default 60000)
 *   GMT24_LLM_MAX_TOKENS        output cap (default 1800)
 *   GMT24_LLM_PRICE_IN / GMT24_LLM_PRICE_OUT   USD per 1M tokens, for the cost meter
 *
 * Fallbacks: OPENAI_API_KEY → openai/gpt-4o-mini; ANTHROPIC_API_KEY → anthropic/claude-3-5-haiku-latest;
 * OLLAMA_HOST → ollama/qwen2.5:3b.
 */

export type ProviderKind = "openai" | "anthropic" | "ollama" | "openai-compatible" | "none";

/** What the call is for. Drives model choice, temperature and output cap. */
export type TaskProfile = "chat" | "reasoning" | "extraction" | "classify";

export type ModelConfig = {
  provider: ProviderKind;
  model: string;
  apiKey: string | null;
  baseUrl: string;
  timeoutMs: number;
  maxTokens: number;
  /** Native function calling supported and enabled for this model. */
  nativeTools: boolean;
  priceIn: number;
  priceOut: number;
};

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function num(name: string, d: number): number {
  const v = Number(env(name));
  return Number.isFinite(v) && v > 0 ? v : d;
}

function detectProvider(): { provider: ProviderKind; model: string; apiKey: string | null; baseUrl: string } {
  const explicit = env("GMT24_LLM_PROVIDER") as ProviderKind | undefined;
  const model = env("GMT24_LLM_MODEL");
  const key = env("GMT24_LLM_API_KEY");
  const base = env("GMT24_LLM_BASE_URL");
  if (explicit && explicit !== "none") {
    const defaults: Record<Exclude<ProviderKind, "none">, { model: string; base: string }> = {
      openai: { model: "gpt-4o-mini", base: "https://api.openai.com/v1" },
      anthropic: { model: "claude-3-5-haiku-latest", base: "https://api.anthropic.com/v1" },
      ollama: { model: "qwen2.5:3b", base: env("OLLAMA_HOST") ?? "http://127.0.0.1:11434" },
      "openai-compatible": { model: "", base: "" },
    };
    const d = defaults[explicit];
    return { provider: explicit, model: model ?? d.model, apiKey: key ?? (explicit === "openai" ? env("OPENAI_API_KEY") ?? null : explicit === "anthropic" ? env("ANTHROPIC_API_KEY") ?? null : null), baseUrl: base ?? d.base };
  }
  if (explicit === "none") return { provider: "none", model: "", apiKey: null, baseUrl: "" };
  if (env("OPENAI_API_KEY")) return { provider: "openai", model: model ?? "gpt-4o-mini", apiKey: env("OPENAI_API_KEY")!, baseUrl: base ?? "https://api.openai.com/v1" };
  if (env("ANTHROPIC_API_KEY")) return { provider: "anthropic", model: model ?? "claude-3-5-haiku-latest", apiKey: env("ANTHROPIC_API_KEY")!, baseUrl: base ?? "https://api.anthropic.com/v1" };
  if (env("OLLAMA_HOST")) return { provider: "ollama", model: model ?? "qwen2.5:3b", apiKey: null, baseUrl: env("OLLAMA_HOST")! };
  return { provider: "none", model: "", apiKey: null, baseUrl: "" };
}

export function modelFor(profile: TaskProfile): ModelConfig {
  const d = detectProvider();
  let model = d.model;
  // Mapping evidence to answer options and judging regulatory changes are reasoning tasks, not chat.
  if (profile === "reasoning" || profile === "classify") model = env("GMT24_LLM_MODEL_REASONING") ?? model;
  if (profile === "extraction") model = env("GMT24_LLM_MODEL_EXTRACTION") ?? model;
  const toolsEnv = env("GMT24_LLM_TOOL_MODE"); // native | json
  return {
    provider: d.provider,
    model,
    apiKey: d.apiKey,
    baseUrl: d.baseUrl.replace(/\/$/, ""),
    timeoutMs: num("GMT24_LLM_TIMEOUT_MS", profile === "extraction" ? 120_000 : 60_000),
    maxTokens: num("GMT24_LLM_MAX_TOKENS", profile === "extraction" ? 3000 : 1800),
    nativeTools: toolsEnv ? toolsEnv === "native" : d.provider !== "ollama",
    priceIn: num("GMT24_LLM_PRICE_IN", 0),
    priceOut: num("GMT24_LLM_PRICE_OUT", 0),
  };
}

/** Safe-to-share status for the UI: never includes the key or the base URL. */
export function publicModelStatus() {
  const c = modelFor("chat");
  return {
    configured: c.provider !== "none",
    provider: c.provider,
    model: c.model,
    reasoningModel: modelFor("reasoning").model,
    extractionModel: modelFor("extraction").model,
    nativeTools: c.nativeTools,
    priced: c.priceIn > 0 || c.priceOut > 0,
  };
}

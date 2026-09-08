import "server-only";
import type { ModelConfig } from "./config";
import type { LlmResult } from "./provider";
import { serverStore } from "@/lib/server/store";

/**
 * Operating-cost monitor. Every model call is logged with provider, model,
 * tokens, latency, estimated cost and outcome. The ring buffer backs the
 * /api/ai/usage endpoint; the store adapter persists when configured.
 */

export type CallRecord = {
  at: string;
  feature: string;
  profile: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
  outcome: "answer" | "tool_calls" | "invalid_json" | "schema_reject" | "error";
  error?: string;
  /** Number of figures the validator could not tie to evidence. */
  ungrounded?: number;
};

const RING: CallRecord[] = [];
const MAX = 500;

export function costOf(cfg: ModelConfig, usage: { input: number; output: number }): number {
  return (usage.input * cfg.priceIn + usage.output * cfg.priceOut) / 1_000_000;
}

export function logCall(rec: CallRecord) {
  RING.unshift(rec);
  if (RING.length > MAX) RING.length = MAX;
  void serverStore.append("llm-calls", rec).catch(() => undefined);
  const line = `[llm] ${rec.feature}/${rec.profile} ${rec.provider}:${rec.model} ${rec.outcome} in=${rec.inputTokens} out=${rec.outputTokens} ${rec.latencyMs}ms $${rec.costUsd.toFixed(5)}${rec.error ? ` error=${rec.error}` : ""}`;
  if (rec.outcome === "error") console.error(line); else console.log(line);
}

export function recordResult(cfg: ModelConfig, feature: string, profile: string, r: LlmResult, outcome: CallRecord["outcome"], extra?: Partial<CallRecord>) {
  logCall({ at: new Date().toISOString(), feature, profile, provider: r.provider, model: r.model, inputTokens: r.usage.input, outputTokens: r.usage.output, latencyMs: r.latencyMs, costUsd: costOf(cfg, r.usage), outcome, ...extra });
  // Opt-in raw model output for prompt tuning; never on by default because it echoes document text.
  if (process.env.GMT24_LLM_DEBUG === "1") console.log(`[llm:raw] ${feature}/${profile}\n${r.text}`);
}

export function usageSummary() {
  const calls = RING.length;
  const tokens = RING.reduce((a, r) => ({ input: a.input + r.inputTokens, output: a.output + r.outputTokens }), { input: 0, output: 0 });
  const cost = RING.reduce((a, r) => a + r.costUsd, 0);
  const errors = RING.filter((r) => r.outcome === "error").length;
  const rejected = RING.filter((r) => r.outcome === "schema_reject" || r.outcome === "invalid_json").length;
  const lat = RING.map((r) => r.latencyMs).sort((a, b) => a - b);
  const p = (q: number) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(q * lat.length))] : 0);
  const byModel: Record<string, { calls: number; costUsd: number }> = {};
  for (const r of RING) { const k = `${r.provider}:${r.model}`; byModel[k] = { calls: (byModel[k]?.calls ?? 0) + 1, costUsd: (byModel[k]?.costUsd ?? 0) + r.costUsd }; }
  return { calls, tokens, costUsd: cost, errors, rejected, latencyMs: { p50: p(0.5), p95: p(0.95) }, byModel, recent: RING.slice(0, 20) };
}

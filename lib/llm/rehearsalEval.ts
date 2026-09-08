import "server-only";
import { z } from "zod";
import { modelFor } from "./config";
import { chat, LlmError } from "./provider";
import { logCall, recordResult } from "./telemetry";
import { norm } from "./extract";

/**
 * Audit Rehearsal — answer evaluation. The user answers an auditor question in
 * their own words; the model judges it against what GMT24's record supports
 * (the trace-derived answer, the evidence on file, the known gaps), surfaces
 * contradictions and unsupported claims, asks the follow-up an auditor would
 * ask next, and drafts a response that uses only the record.
 *
 * Deterministic guard: every figure in the user's answer and in the drafted
 * response must occur in the record. A figure that does not is reported as
 * "not in the record", never accepted because the model found it plausible.
 * This is an internal readiness exercise; nothing here predicts what a tax
 * authority will accept.
 */

export const RehearsalEvalInputSchema = z.object({
  question: z.object({
    id: z.string(),
    area: z.string(),
    iso: z.string().nullable().optional(),
    question: z.string().max(1000),
    recordAnswer: z.string().max(4000),
    evidence: z.array(z.string().max(300)).max(30),
    gaps: z.array(z.string().max(400)).max(30),
    strength: z.enum(["strong", "partial", "weak"]),
  }),
  /** The question actually being answered — the original or a follow-up from an earlier round. */
  asked: z.string().max(1000),
  answer: z.string().min(1).max(4000),
  history: z.array(z.object({ asked: z.string().max(1000), answer: z.string().max(4000), verdict: z.string().max(40) })).max(8).default([]),
  context: z.object({ groupName: z.string(), fy: z.string(), calcVersion: z.string(), lang: z.enum(["en", "th"]).default("en") }),
});
export type RehearsalEvalInput = z.infer<typeof RehearsalEvalInputSchema>;

const VERDICTS = ["supported", "partly-supported", "contradicts-record", "unsupported"] as const;
export type Verdict = (typeof VERDICTS)[number];

const clipList = (max: number, n = 8) => z.preprocess((v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, n).map((x) => x.trim().slice(0, max)) : []), z.array(z.string()));
const clipStr = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.trim().slice(0, max) : v == null ? "" : String(v).slice(0, max)), z.string());

const RawSchema = z.object({
  verdict: z.preprocess((v) => {
    const s = String(v ?? "").toLowerCase().replace(/[\s_]+/g, "-");
    if (s.startsWith("support") || s === "correct" || s === "consistent") return "supported";
    if (s.includes("partly") || s.includes("partial") || s.includes("incomplete")) return "partly-supported";
    if (s.includes("contradict") || s.includes("conflict") || s.includes("inconsistent") || s.includes("wrong")) return "contradicts-record";
    if (s.includes("unsupported") || s.includes("no-evidence") || s.includes("unverif")) return "unsupported";
    return s;
  }, z.enum(VERDICTS)),
  summary: clipStr(500),
  agreements: clipList(300),
  contradictions: z.preprocess((v) => (Array.isArray(v) ? v.slice(0, 8).map((x) => (typeof x === "string" ? { claim: x, record: "" } : x)) : []), z.array(z.object({ claim: clipStr(300), record: clipStr(400) }))),
  unsupported: clipList(300),
  supportNeeded: clipList(200),
  followUp: clipStr(500),
  draft: clipStr(2500),
});

export type RehearsalEvaluation = {
  verdict: Verdict;
  summary: string;
  agreements: string[];
  contradictions: { claim: string; record: string }[];
  unsupported: string[];
  supportNeeded: string[];
  /** The next auditor question, reacting to this answer. Empty when the record fully supports the answer and nothing is left open. */
  followUp: string;
  /** Evidence-linked response using only the record; empty when the model's draft could not be grounded. */
  draft: string;
  /** Figures the user stated that occur nowhere in the record (trace answer, evidence, gaps). */
  figuresNotInRecord: string[];
  draftGrounded: boolean;
  model: string;
};

const SYSTEM = `You run an internal audit rehearsal for a Pillar Two (OECD GloBE) tax team. You receive an auditor question, THE RECORD (the answer GMT24's calculation trace supports, the evidence on file, and the known gaps), the conversation so far, and the team member's own answer. Judge the answer against THE RECORD only — you have no other knowledge of this group.
Return ONE JSON object:
{"verdict": "supported" | "partly-supported" | "contradicts-record" | "unsupported",
 "summary": two sentences a colleague would say about the answer,
 "agreements": [points in the answer that THE RECORD supports],
 "contradictions": [{"claim": what the answer says, "record": what THE RECORD says instead}],
 "unsupported": [claims in the answer that nothing on file supports — including any figure, date, percentage or document THE RECORD does not contain],
 "supportNeeded": [documents or confirmations an auditor would now ask to see],
 "followUp": the ONE question an auditor would ask next, reacting to what this answer said or left out — probe a contradiction, an unsupported claim or a gap; empty string only if the answer is fully supported and no gaps remain,
 "draft": a response the team could actually give, written from THE RECORD only, that states the conclusion, the figures from the record, the evidence to produce, and openly acknowledges the gaps as items being remediated}
Rules: use only figures that appear in THE RECORD; never invent amounts, rates, dates or documents. Being confident is not evidence — a claim without support on file is unsupported. Do not say or imply the tax authority will accept anything. Answer in the language of the team member's answer (Thai or English).`;

// Thai scale words: พันล้าน = billion, ล้าน = million, พัน = thousand; เปอร์เซ็นต์ = percent.
const NUM_RE = /(?:[A-Z]{3}\s?|[$€£฿])?\d[\d,]*(?:\.\d+)?\s?(?:%|percent|เปอร์เซ็นต์|million|m\b|bn\b|billion|k\b|พันล้าน|ล้าน|พัน)?/gi;

/** Canonical numeric tokens: "1,840,000" → "1840000", "15%" → "15%", "6.12 ล้าน" → "6120000". Years alone are ignored. */
export function figuresIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.match(NUM_RE) ?? []) {
    const raw = m.trim();
    const pctLike = /%|percent|เปอร์เซ็นต์/i.test(raw);
    const num = raw.replace(/[^\d.]/g, "");
    if (!num || num === ".") continue;
    if (/^(19|20)\d{2}$/.test(num) && !pctLike) continue;
    if (num.length < 2 && !pctLike) continue;
    const scale = /billion|\bbn\b|พันล้าน/i.test(raw) ? 1_000_000_000 : /million|\bm\b|ล้าน/i.test(raw) ? 1_000_000 : /\bk\b|พัน/i.test(raw) ? 1_000 : 1;
    const scaled = scale === 1 ? num : String(Math.round(Number(num) * scale));
    out.add(pctLike ? `${num}%` : scaled.replace(/\.0+$/, ""));
  }
  return [...out];
}

/** A stated figure counts as "in the record" when it equals, or is within 1.5% of, a record figure of the same kind (rounding is not a contradiction). */
function figuresOutside(text: string, record: Set<string>) {
  const rec = [...record].map((r) => ({ pct: r.endsWith("%"), v: Number(r.replace(/%$/, "")) })).filter((r) => Number.isFinite(r.v));
  return figuresIn(text).filter((f) => {
    if (record.has(f)) return false;
    const pct = f.endsWith("%");
    const v = Number(f.replace(/%$/, ""));
    if (!Number.isFinite(v)) return true;
    return !rec.some((r) => r.pct === pct && (r.v === v || (r.v !== 0 && Math.abs(r.v - v) / Math.abs(r.v) <= 0.015)));
  });
}

export async function evaluateRehearsalAnswer(i: RehearsalEvalInput, signal?: AbortSignal): Promise<RehearsalEvaluation> {
  const cfg = modelFor("reasoning");
  if (cfg.provider === "none") throw new LlmError("not_configured", "No language model is configured; answers cannot be evaluated.");
  const q = i.question;
  const recordText = `${q.recordAnswer}\n${q.evidence.join("\n")}\n${q.gaps.join("\n")}`;
  const recordFigures = new Set(figuresIn(recordText));
  const figuresNotInRecord = figuresOutside(i.answer, recordFigures);
  const thai = i.context.lang === "th" || /[\u0E00-\u0E7F]/.test(i.answer);

  const user = [
    `GROUP: ${i.context.groupName}, ${i.context.fy}, ${i.context.calcVersion}. AREA: ${q.area}${q.iso ? ` (${q.iso})` : ""}.`,
    `AUDITOR QUESTION (original): ${q.question}`,
    `THE RECORD — answer the trace supports: ${q.recordAnswer}`,
    `THE RECORD — evidence on file: ${q.evidence.length ? q.evidence.map((e) => `• ${e}`).join("\n") : "(none)"}`,
    `THE RECORD — known gaps: ${q.gaps.length ? q.gaps.map((g) => `• ${g}`).join("\n") : "(none)"}`,
    `RECORD SUPPORT STRENGTH: ${q.strength}`,
    i.history.length ? `CONVERSATION SO FAR:\n${i.history.map((h) => `Auditor: ${h.asked}\nTeam: ${h.answer}\n(verdict: ${h.verdict})`).join("\n")}` : "",
    figuresNotInRecord.length ? `FIGURES IN THE ANSWER THAT DO NOT OCCUR IN THE RECORD (treat as unsupported): ${figuresNotInRecord.join(", ")}` : "",
    `QUESTION NOW BEING ANSWERED: ${i.asked}`,
    `TEAM MEMBER'S ANSWER: ${i.answer}`,
    thai ? "ภาษา: เขียน summary, contradictions, unsupported, supportNeeded, followUp และ draft เป็นภาษาไทย (คงตัวเลข ชื่อเอกสาร และการอ้างอิง Article ไว้ตามเดิม)" : "LANGUAGE: write all text fields in English.",
    i.history.length ? "Do not repeat a question already asked unless the answer failed to address it; otherwise move to the next open point." : "",
  ].filter(Boolean).join("\n\n");

  let res;
  try {
    res = await chat(cfg, { messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }], json: true, temperature: 0.1, maxTokens: 1400, signal });
  } catch (e) {
    const err = e instanceof LlmError ? e : new LlmError("bad_response", String(e));
    logCall({ at: new Date().toISOString(), feature: "rehearsal", profile: "reasoning", provider: cfg.provider, model: cfg.model, inputTokens: 0, outputTokens: 0, latencyMs: 0, costUsd: 0, outcome: "error", error: err.message });
    throw err;
  }
  let parsed: unknown = null;
  try { parsed = JSON.parse(res.text.replace(/^```(?:json)?|```$/g, "").trim()); } catch { const m = res.text.match(/\{[\s\S]*\}/); if (m) { try { parsed = JSON.parse(m[0]); } catch { parsed = null; } } }
  const check = RawSchema.safeParse(parsed);
  if (!check.success) {
    recordResult(cfg, "rehearsal", "reasoning", res, parsed ? "schema_reject" : "invalid_json", { error: check.error.issues.slice(0, 3).map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
    throw new LlmError("bad_response", "The model's evaluation could not be structured. Try again or shorten the answer.");
  }
  recordResult(cfg, "rehearsal", "reasoning", res, "answer");
  const d = check.data;

  // Deterministic overrides: figures outside the record are unsupported regardless of the verdict.
  const unsupported = [...d.unsupported];
  for (const f of figuresNotInRecord) {
    const label = `Figure ${f} does not appear in the calculation trace or the evidence register.`;
    if (!unsupported.some((u) => norm(u).includes(norm(f)))) unsupported.push(label);
  }
  // A "contradiction" whose claim and record carry the same figures is agreement misread by the model,
  // and one whose record side quotes a figure the record does not contain is the model misquoting
  // the record. Neither is shown; the record answer is on screen for the reviewer regardless.
  const contradictions = d.contradictions.filter((c) => {
    if (!c.claim) return false;
    const a = figuresIn(c.claim), b = figuresIn(c.record);
    if (a.length && a.length === b.length && a.every((f) => b.includes(f))) return false;
    if (figuresOutside(c.record, recordFigures).length) return false;
    return true;
  });
  let verdict: Verdict = d.verdict;
  if (figuresNotInRecord.length && verdict === "supported") verdict = "partly-supported";
  if (contradictions.length && verdict === "supported") verdict = "partly-supported";
  if (!contradictions.length && verdict === "contradicts-record") verdict = unsupported.length ? "partly-supported" : "supported";

  // The draft may only carry figures from the record.
  const draftStray = figuresOutside(d.draft, recordFigures);
  const draftGrounded = draftStray.length === 0;

  return {
    verdict,
    summary: d.summary,
    agreements: d.agreements,
    contradictions,
    unsupported: [...new Set(unsupported)],
    supportNeeded: d.supportNeeded,
    followUp: d.followUp,
    draft: draftGrounded ? d.draft : "",
    figuresNotInRecord,
    draftGrounded,
    model: res.model,
  };
}

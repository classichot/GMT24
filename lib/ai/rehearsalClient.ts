import type { RehearsalQ } from "./rehearsal";
import type { WorkContext } from "./types";

/**
 * Client side of Audit Rehearsal answer evaluation. Each attempt (the question
 * asked — original or follow-up — the user's answer and the model's judgement)
 * is kept per rehearsal question so the exchange survives navigation and
 * refresh and goes into the rehearsal package.
 */
export type Verdict = "supported" | "partly-supported" | "contradicts-record" | "unsupported";

export type RehearsalEvaluation = {
  verdict: Verdict;
  summary: string;
  agreements: string[];
  contradictions: { claim: string; record: string }[];
  unsupported: string[];
  supportNeeded: string[];
  followUp: string;
  draft: string;
  figuresNotInRecord: string[];
  draftGrounded: boolean;
  model: string;
};

export type RehearsalAttempt = {
  id: string;
  asked: string;
  answer: string;
  by: string;
  at: string;
  evaluation: RehearsalEvaluation;
};

export class RehearsalEvalError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  supported: "Supported by the record",
  "partly-supported": "Partly supported",
  "contradicts-record": "Contradicts the record",
  unsupported: "Unsupported",
};

export async function evaluateAnswer(q: RehearsalQ, asked: string, answer: string, history: RehearsalAttempt[], ctx: WorkContext, signal?: AbortSignal): Promise<RehearsalEvaluation> {
  const body = {
    question: { id: q.id, area: q.area, iso: q.iso ?? null, question: q.question, recordAnswer: q.answer, evidence: q.evidence, gaps: q.gaps, strength: q.strength },
    asked,
    answer,
    history: history.slice(-6).map((h) => ({ asked: h.asked, answer: h.answer, verdict: h.evaluation.verdict })),
    context: { groupName: ctx.groupName, fy: ctx.fy, calcVersion: ctx.calcVersion, lang: ctx.lang },
  };
  const res = await fetch("/api/ai/rehearsal/evaluate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  const j = (await res.json().catch(() => ({}))) as Partial<RehearsalEvaluation> & { error?: string; detail?: string };
  if (!res.ok || j.error) throw new RehearsalEvalError(j.error ?? "http", j.detail ?? `Evaluation failed (${res.status})`, res.status);
  return j as RehearsalEvaluation;
}

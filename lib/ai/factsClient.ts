import type { XrayFinding } from "../xray";
import type { Attachment, Fact, WorkContext } from "./types";

/**
 * Client side of X-Ray document reading. Sends an attached document's pages
 * with one finding's brief to /api/ai/extract-facts and turns the proposals
 * into Fact records (source "document", status "proposed") that carry the page
 * and quote as evidence. Confirmation stays with an accountable person.
 */

export type DocFact = {
  statement: string;
  questionId: string | null;
  optionValue: string | null;
  value: string | null;
  period: string | null;
  page: number;
  quote: string;
  confidence: "high" | "medium" | "low";
  verified: boolean;
  questionValid: boolean;
};

export type DocReading = {
  relevant: boolean;
  facts: DocFact[];
  contradictions: string[];
  followUps: string[];
  notes: string[];
  verification: { checked: number; verified: number };
  pagesRead: number[];
  chunks: number;
  model: string;
  document: string | null;
};

export class DocReadingError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

export type GroupEntityRef = { code: string; name: string; iso: string; type: string };

/** The group's entity register as the reader's ground truth for "is X a Group Entity" — a document cannot establish that. */
export function groupEntityRefs(calcs: { entities: { code: string; name: string; iso: string; type: string }[] }[]): GroupEntityRef[] {
  const seen = new Set<string>();
  return calcs.flatMap((c) => c.entities).filter((e) => (seen.has(e.code) ? false : (seen.add(e.code), true))).map((e) => ({ code: e.code, name: e.name, iso: e.iso, type: e.type }));
}

export function findingBrief(f: XrayFinding, fy: string, groupEntities: GroupEntityRef[] = []) {
  return { id: f.id, title: f.title, engine: f.engine, entityName: f.entityName, entityCode: f.entityCode, iso: f.iso, fy, detected: f.detected, missing: f.missing, proofRequired: f.proofRequired, groupEntities, questions: f.questions.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options.map((o) => ({ value: o.value, label: o.label })) })) };
}

export async function readDocumentForFinding(a: Attachment, f: XrayFinding, fy: string, groupEntities: GroupEntityRef[], signal?: AbortSignal): Promise<DocReading> {
  const pages = a.pages.filter((p) => p.text.trim().length > 0).map((p) => ({ n: p.n, text: p.text }));
  if (!pages.length) throw new DocReadingError("no_text", `${a.name} has no extractable text (quality ${a.quality}%). Attach a text-based PDF or the source spreadsheet.`, 400);
  const res = await fetch("/api/ai/extract-facts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pages, finding: findingBrief(f, fy, groupEntities), document: a.name }), signal });
  const j = (await res.json().catch(() => ({}))) as Partial<DocReading> & { error?: string; detail?: string };
  if (!res.ok || j.error) throw new DocReadingError(j.error ?? "http", j.detail ?? `Document reading failed (${res.status})`, res.status);
  return j as DocReading;
}

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h).toString(36); }

/** Proposed Fact records for the registry — one per extracted fact, evidence = document page + quote. */
export function proposedFacts(r: DocReading, a: Attachment, f: XrayFinding, ctx: WorkContext): Fact[] {
  const at = new Date().toISOString();
  return r.facts.map((d) => {
    const q = f.questions.find((x) => x.id === d.questionId);
    const opt = q?.options.find((o) => o.value === d.optionValue);
    return {
      id: `fact:doc:${f.id}:${hash(`${d.statement}|${d.page}|${d.quote}`)}`,
      topic: f.area,
      engine: f.engine,
      questionId: d.questionId ?? "document",
      entityId: f.entityId,
      entityCode: f.entityCode,
      iso: f.iso,
      fy: ctx.fy,
      statement: d.statement,
      value: opt?.label ?? d.value ?? d.optionValue ?? "",
      status: "proposed",
      owner: f.owner,
      confirmedBy: null,
      reviewedBy: null,
      at,
      evidence: [`${a.name} p.${d.page}: "${d.quote}"${d.verified ? "" : " (quote not verified against the page)"}`],
      source: "document",
      dependents: [],
      findingId: f.id,
      href: f.href,
      reason: `Proposed by ${r.model} from ${a.name} (${d.confidence} confidence${d.period ? `, period ${d.period}` : ""}). Needs an accountable person's confirmation.`,
    };
  });
}

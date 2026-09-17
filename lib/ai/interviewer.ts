import type { JurCalc } from "../engine";
import { eur, pct } from "../format";
import { activeQuestions, amountAtRisk, branchImpact, calcFor, findingStatus, missingEvidence, selectedBranch, STATUS_LABEL, type XrayFinding, type XrayState } from "../xray";
import { propose } from "./actions";
import { findPassages, passageRef } from "./documents";
import { reusableAnswer } from "./facts";
import { byRule } from "./knowledge";
import type { Attachment, Fact, ProposedAction, Reply, Section, WorkContext } from "./types";

/**
 * AI X-Ray Interviewer. Works one finding at a time in plain language: why the
 * question matters (priced from the live calculation), what each answer would do,
 * what evidence is needed, whether a confirmed fact already answers it, and what an
 * attached document says about it. Answers are recorded through the gateway so the
 * same dependency retirement, evidence and signing rules apply.
 */
export type InterviewInput = {
  finding: XrayFinding;
  xray: XrayState;
  calcs: JurCalc[];
  facts: Fact[];
  attachments: Attachment[];
  ctx: WorkContext;
  q?: string;
};

const TERMS: Record<string, string[]> = {
  dividend: ["dividend", "distribution", "shareholding", "ownership", "holding period", "%"],
  payroll: ["payroll", "employee", "contractor", "headcount", "salary", "work location", "secondment"],
  asset: ["property, plant", "carrying", "lease", "right-of-use", "fixed asset", "location", "situs"],
  boi: ["boi", "certificate", "incentive", "exemption", "tax holiday", "cap", "promotion"],
  deferred: ["deferred tax", "temporary difference", "recapture", "reversal", "dtl", "dta"],
  covered: ["income tax", "withholding", "covered tax", "cfc", "tax paid", "current tax"],
  entity: ["subsidiary", "permanent establishment", "branch", "transparent", "partnership", "ownership"],
  election: ["election", "elect", "board", "minutes", "revocation", "annual"],
};

export function priority(findings: XrayFinding[], xray: XrayState, calcs: JurCalc[]) {
  return findings
    .filter((f) => findingStatus(f, xray[f.id]) !== "resolved")
    .map((f) => ({ f, risk: amountAtRisk(f, calcs), status: findingStatus(f, xray[f.id]) }))
    .sort((a, b) => (a.f.severity === b.f.severity ? b.risk - a.risk : a.f.severity === "material" ? -1 : b.f.severity === "material" ? 1 : a.f.severity === "significant" ? -1 : 1));
}

export function interviewReply(i: InterviewInput): Reply {
  const { finding: f, ctx } = i;
  const r = i.xray[f.id];
  const status = findingStatus(f, r);
  const calc = calcFor(f, i.calcs);
  const active = activeQuestions(f, r?.answers ?? {});
  const nextQ = active.find((q) => !r?.answers[q.id]);
  const missing = missingEvidence(f, r);
  const sections: Section[] = [];
  const actions: ProposedAction[] = [];
  const unsupported: string[] = [];
  const cites = [{ label: `${f.ruleId} · ${f.article}`, href: "/rulebook" }, { label: f.sourceDoc, href: "/data" }];
  for (const kb of byRule(f.ruleId).slice(0, 1)) cites.push({ label: kb.provision, href: kb.url ?? kb.href ?? "/rulebook" });

  // Why it matters — priced from the live calculation.
  const risk = amountAtRisk(f, i.calcs);
  sections.push({ kind: "conclusion", text: `${f.title} — ${STATUS_LABEL[status]}. ${f.detected} ${f.missing}${calc ? ` Up to ${eur(risk)} of ${calc.name} top-up depends on the answer.` : ""}` });

  // Reuse: a confirmed fact from a prior interview or the registry.
  if (nextQ) {
    const reuse = reusableAnswer(i.facts, f.engine, nextQ.id, f.entityId, ctx.fy);
    if (reuse) {
      sections.push({ kind: "facts", title: "Already confirmed", items: [`${reuse.statement} → ${reuse.value} (confirmed by ${reuse.confirmedBy}, ${reuse.at.slice(0, 10)}). Reusing it avoids asking ${f.dept} again.`] });
      actions.push(propose("answer-xray", { findingId: f.id, questionId: nextQ.id, value: reuse.value, label: `Reuse: ${reuse.value}` }, ctx));
    }
  }

  // The question, in plain language, with each option priced.
  if (nextQ) {
    const rows: string[][] = [];
    for (const o of nextQ.options) {
      const b = f.branches.find((x) => x.value === o.value);
      if (b && calc) {
        const imp = branchImpact(calc, b);
        rows.push([o.label, b.treatment.slice(0, 110), `${eur(imp.topUp)} (${imp.topUpDelta >= 0 ? "+" : "−"}${eur(Math.abs(imp.topUpDelta))}), ETR ${pct(imp.etr, 2)}`]);
      } else rows.push([o.label, nextQ.id === f.questions[0]?.id ? "—" : "Follow-up detail; treatment fixed by the primary answer.", "—"]);
    }
    sections.push({ kind: "text", title: `Question for ${f.dept}`, text: nextQ.prompt });
    sections.push({ kind: "table", title: "What each answer would mean", head: ["Answer", "Treatment", `${calc?.name ?? f.jurisdiction} top-up if chosen`], rows });
    for (const o of nextQ.options.slice(0, 4)) actions.push(propose("answer-xray", { findingId: f.id, questionId: nextQ.id, value: o.value, label: o.label }, ctx));
  } else if (status === "unsupported") {
    sections.push({ kind: "gaps", title: "Evidence still required", items: missing.map((m) => `${m} — ${f.proofRequired}`) });
    for (const m of missing.slice(0, 3)) actions.push(propose("attach-evidence", { findingId: f.id, kind: m }, ctx));
  } else if (status === "awaiting-review") {
    const b = selectedBranch(f, r?.answers ?? {});
    sections.push({ kind: "facts", title: "Answered and supported", items: [`Treatment: ${b?.treatment ?? "recorded"}.`, `Preparer: ${r?.preparer ?? "— not yet"} · Reviewer: ${r?.reviewer ?? "— not yet"}.`] });
    if (!r?.preparer) actions.push(propose("sign-xray", { findingId: f.id, role: "preparer" }, ctx));
    else actions.push(propose("sign-xray", { findingId: f.id, role: "reviewer" }, ctx));
  } else if (status === "resolved") {
    sections.push({ kind: "facts", items: [`Confirmed by ${r?.preparer} and reviewed by ${r?.reviewer} on ${r?.at.slice(0, 10)}. The fact is on the registry and reusable.`] });
  }

  // Document intelligence — what the attached file says.
  const docs = i.attachments.filter((a) => a.contextKey === ctx.contextKey || a.contextKey === "*");
  if (docs.length) {
    const items: string[] = [];
    for (const a of docs) {
      const ps = findPassages(a, [...(TERMS[f.engine] ?? []), f.entityCode, f.entityName.split(" ")[0]], 2);
      if (!ps.length) items.push(`${a.name}: no passage relates to this finding (extraction quality ${a.quality}%).`);
      for (const p of ps) items.push(`${passageRef(a, p)}: "${p.text.slice(0, 160)}"${a.quality < 60 ? " — low extraction quality, verify against the original." : ""}`);
      if (a.stripped) items.push(`${a.name}: ${a.stripped} instruction-like line${a.stripped === 1 ? "" : "s"} ignored — the document is read as evidence only.`);
    }
    sections.push({ kind: "list", title: "From the attached document", items });
    sections.push({ kind: "warning", text: "Extracted values are proposals. Material facts still need an accountable person to confirm and a reviewer to sign." });
  }

  // Facts the model proposed from documents read against this finding (registry, status proposed/confirmed).
  const docFacts = i.facts.filter((x) => x.source === "document" && x.findingId === f.id);
  if (docFacts.length) {
    sections.push({ kind: "facts", title: "Proposed from documents (model-read; confirmation required)", items: docFacts.slice(0, 6).map((x) => `${x.statement} → ${x.value || "—"} · ${x.status}${x.confirmedBy ? ` by ${x.confirmedBy}` : ""} · ${x.evidence[0] ?? ""}`) });
    for (const x of docFacts.filter((d) => d.status === "proposed").slice(0, 2)) actions.push(propose("confirm-fact", { id: x.id }, ctx, { label: `Confirm: ${x.statement.slice(0, 50)}` }));
    if (nextQ && !r?.answers[nextQ.id]) {
      const match = docFacts.find((d) => d.questionId === nextQ.id && nextQ.options.some((o) => o.label === d.value || o.value === d.value));
      const opt = match ? nextQ.options.find((o) => o.label === match.value || o.value === match.value) : undefined;
      if (match && opt) actions.push(propose("answer-xray", { findingId: f.id, questionId: nextQ.id, value: opt.value, label: `${opt.label} (document: ${match.evidence[0]?.split(":")[0] ?? "attached"})` }, ctx));
    }
  }

  // Missing evidence guidance.
  if (missing.length && nextQ) sections.push({ kind: "gaps", title: "Evidence to attach after answering", items: missing.map((m) => `${m}`) });
  sections.push({ kind: "next", items: [
    nextQ ? `Answer as ${f.dept}, then attach ${missing.join(", ") || "the listed evidence"}, then sign as preparer.` : status === "unsupported" ? "Attach the listed evidence, then sign as preparer." : status === "awaiting-review" ? "Preparer signs; a different person signs as reviewer." : "Nothing outstanding on this finding.",
    `Proof required: ${f.proofRequired}`,
  ] });
  actions.push(propose("navigate", { href: f.href, label: "Open finding" }, ctx));

  return {
    id: `r-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    feature: "interviewer",
    title: `X-Ray Interviewer · ${f.entityCode} · ${f.title}`,
    sections,
    cites,
    actions,
    grounded: true,
    unsupported,
    version: ctx.calcVersion,
    lang: ctx.lang,
    chips: ["Why does this matter?", "What evidence do I need?", "Next finding"],
  };
}

/** Department view: what one team owes, ordered by top-up at risk. */
export function departmentQueue(findings: XrayFinding[], xray: XrayState, calcs: JurCalc[], dept: string) {
  return priority(findings, xray, calcs).filter((p) => p.f.dept === dept);
}

export function interviewOverview(findings: XrayFinding[], xray: XrayState, calcs: JurCalc[], ctx: WorkContext): Reply {
  const p = priority(findings, xray, calcs);
  const byDept = new Map<string, { n: number; risk: number }>();
  for (const x of p) {
    const d = byDept.get(x.f.dept) ?? { n: 0, risk: 0 };
    d.n += 1; d.risk += x.risk;
    byDept.set(x.f.dept, d);
  }
  return {
    id: `r-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    feature: "interviewer",
    title: "X-Ray Interviewer · queue",
    sections: [
      { kind: "conclusion", text: p.length ? `${p.length} finding${p.length === 1 ? "" : "s"} open. Highest value first: ${p[0].f.title} (${p[0].f.entityCode}, ${eur(p[0].risk)} at risk).` : "Every X-Ray finding is confirmed, supported and reviewed." },
      { kind: "table", title: "By department", head: ["Department", "Open", "Top-up at risk"], rows: [...byDept.entries()].map(([d, v]) => [d, String(v.n), eur(v.risk)]) },
      { kind: "steps", title: "Interview order", items: p.slice(0, 6).map((x, i) => `${i + 1}. ${x.f.title} — ${x.f.entityCode} · ${x.f.dept} · ${eur(x.risk)} · ${STATUS_LABEL[x.status]}`) },
    ],
    cites: [{ label: "Pillar Two X-Ray", href: "/xray" }],
    actions: p.slice(0, 3).map((x) => propose("navigate", { href: `/xray/confirm?finding=${x.f.id}`, label: `Interview: ${x.f.title}` }, ctx)),
    grounded: true,
    unsupported: [],
    version: ctx.calcVersion,
    lang: ctx.lang,
    chips: p.slice(0, 3).map((x) => `Interview ${x.f.entityCode} ${x.f.title}`),
  };
}

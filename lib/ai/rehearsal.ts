import type { JurCalc } from "../engine";
import { eur, pct } from "../format";
import { ACCOUNTS, ADJUSTMENTS, INCENTIVES } from "../model";
import { findingStatus, missingEvidence, type XrayFinding, type XrayState } from "../xray";
import { propose } from "./actions";
import { byRule } from "./knowledge";
import type { Reply, Section, WorkContext } from "./types";

/**
 * AI Audit Rehearsal. Internal readiness assessment — not a prediction of what a
 * tax authority will do. Question sets come from the group's actual figures; each
 * answer is assembled from the trace and the evidence register, and every gap is
 * listed with a remediation task.
 */
export type RehearsalQ = {
  id: string;
  area: string;
  iso?: string;
  question: string;
  answer: string;
  evidence: string[];
  gaps: string[];
  strength: "strong" | "partial" | "weak";
};

export type RehearsalInput = {
  calcs: JurCalc[];
  findings: XrayFinding[];
  xray: XrayState;
  approvedMaps: Record<string, boolean>;
  electionsOn: Record<string, boolean>;
  scenario: { boiExtend: boolean; payrollTh: number; tpMargin: number };
  ctx: WorkContext;
};

export function rehearse(i: RehearsalInput): RehearsalQ[] {
  const out: RehearsalQ[] = [];
  const { calcs, findings, xray } = i;
  const openFor = (iso: string) => findings.filter((f) => f.iso === iso && findingStatus(f, xray[f.id]) !== "resolved");

  for (const c of calcs.filter((x) => x.blendKind === "main")) {
    const open = openFor(c.iso);
    const ents = c.entities.map((e) => e.code).join(", ");
    // ETR derivation
    {
      const gaps = open.filter((f) => ["covered", "deferred"].includes(f.engine)).map((f) => `${f.title} (${f.entityCode}) unconfirmed — ${f.missing}`);
      if (c.completeness < 90) gaps.push(`Data completeness ${c.completeness}%.`);
      out.push({ id: `etr-${c.iso}`, area: "ETR", iso: c.iso, question: `How did you derive the ${c.name} GloBE ETR of ${pct(c.etr, 2)}?`, answer: `Adjusted Covered Taxes ${eur(c.coveredTax)} ÷ Net GloBE Income ${eur(c.globeIncome)} across ${c.entities.length} constituent entit${c.entities.length === 1 ? "y" : "ies"} (${ents}). Covered taxes start from current tax expense with Art. 4.1 adjustments; deferred tax is recast at 15% (Art. 4.4).${c.enteOriginated ? ` Negative covered taxes triggered the Art. 5.2.1 ENTE procedure — Top-up % capped at 15%, ${eur(c.enteCarryforward)} carried forward.` : ""}`, evidence: [`Trace: ${c.name} → ETR → Adjusted Covered Taxes / GloBE income`, ...uniq(c.trace.covered.children?.map((n) => n.sourceFile).filter(Boolean) as string[] ?? [])], gaps, strength: gaps.length ? (gaps.length > 1 ? "weak" : "partial") : "strong" });
    }
    // SBIE
    if (c.sbie > 0) {
      const gaps = open.filter((f) => ["payroll", "asset"].includes(f.engine)).map((f) => `${f.title} (${f.entityCode}) — ${f.missing}`);
      if (c.iso === "TH" && i.scenario.payrollTh > 0) gaps.push(`Simulator adds ${eur(i.scenario.payrollTh)} Thai payroll — a scenario assumption, not evidenced payroll.`);
      out.push({ id: `sbie-${c.iso}`, area: "SBIE", iso: c.iso, question: `Support the ${eur(c.sbie)} substance-based income exclusion claimed in ${c.name}.`, answer: `Payroll carve-out ${eur(c.payrollCarve)} plus tangible asset carve-out ${eur(c.assetCarve)} at the ${i.ctx.fy} transition rates (Art. 9.2). Eligible payroll covers Eligible Employees performing activities in ${c.name}; eligible tangible assets are located there.`, evidence: ["Trace: SBIE → payroll → assets", "Payroll register", "Fixed-asset register / lease schedule"], gaps, strength: gaps.length ? "partial" : "strong" });
    }
    // Incentives
    const inc = INCENTIVES.filter((x) => c.entities.some((e) => e.id === x.entityId));
    for (const x of inc) {
      const gaps = open.filter((f) => f.engine === "boi" && f.entityId === x.entityId).map((f) => `${f.title} — ${f.missing}`);
      if (c.iso === "TH" && i.scenario.boiExtend) gaps.push("Simulator assumes BOI extension — no certificate amendment on file.");
      out.push({ id: `inc-${x.id}`, area: "Incentives", iso: c.iso, question: `Is the ${x.name} treated as a Qualified Refundable Tax Credit or as a reduction of covered taxes, and why?`, answer: `${x.type}: ${x.rate} from ${x.start} to ${x.end}. Conditions: ${x.conditions}. SBTISH-eligible: ${x.sbtishEligible ? "yes" : "no"}. Extracted from ${x.extractedFrom}. A rate reduction lowers covered taxes; only a refundable credit payable within four years is a QRTC (Art. 10.1).`, evidence: [x.extractedFrom, "BOI certificate and component schedule"], gaps, strength: gaps.length ? "partial" : "strong" });
    }
    // Collection
    if (c.jurisdictionalTopUp > 0) out.push({ id: `coll-${c.iso}`, area: "Collection", iso: c.iso, question: `Who collects the ${eur(c.jurisdictionalTopUp)} ${c.name} top-up and on what basis?`, answer: `${c.collection.payer}: QDMTT ${eur(c.collection.qdmtt)} · IIR ${eur(c.collection.iir)} · UTPR ${eur(c.collection.utpr)}. Path: ${c.collection.path.join(" → ")}. Pack: ${c.pack ? `IIR ${c.pack.iir} / QDMTT ${c.pack.qdmtt} / UTPR ${c.pack.utpr}` : "no signed pack"}.`, evidence: ["Jurisdiction pack (OECD Central Record)", "Ownership chart"], gaps: c.pack ? [] : [`No jurisdiction pack for ${c.name}.`], strength: c.pack ? "strong" : "weak" });
  }
  // Mapping
  const pending = ACCOUNTS.filter((a) => !a.approved && !i.approvedMaps[a.account]);
  out.push({ id: "map", area: "Mapping", question: "How do you evidence that every trial-balance account is mapped to the right GloBE category?", answer: `${ACCOUNTS.length} accounts on the mapping table; ${ACCOUNTS.length - pending.length} approved. Each approval is a signed event on Evidence history with the confidence score at approval time.`, evidence: ["Account mapping table", "Evidence history (approval events)"], gaps: pending.map((a) => `${a.account} ${a.name} unapproved (${a.confidence}%).`), strength: pending.length ? "partial" : "strong" });
  // Adjustments
  for (const a of ADJUSTMENTS) {
    const kb = byRule(a.ruleId)[0];
    out.push({ id: `adj-${a.id}`, area: "Adjustments", question: `Explain adjustment ${a.id} (${a.category}, ${eur(a.amount)}).`, answer: `${a.reason} Rule ${a.ruleId}${a.article ? ` (${a.article})` : ""}. Original ${eur(a.original)} → adjustment ${eur(a.amount)}. Source ${a.sourceDoc}; preparer ${a.preparer}; reviewer ${a.reviewer ?? "none"}.${kb ? ` Authority: ${kb.provision}.` : ""}`, evidence: [a.sourceDoc, kb?.provision ?? a.ruleId], gaps: a.reviewer ? [] : ["No reviewer signature."], strength: a.reviewer ? "strong" : "partial" });
  }
  // Elections
  const on = Object.keys(i.electionsOn).filter((k) => i.electionsOn[k]);
  out.push({ id: "elections", area: "Elections", question: "Which GloBE elections were made, by whom, and where is the authority to make them?", answer: on.length ? `${on.length} election${on.length === 1 ? "" : "s"} on the working package: ${on.join(", ")}. Each is recorded on Evidence history with actor and time; five-year locks are tracked on the year ledger.` : "No elections on the working package — Core default treatment throughout.", evidence: ["Election register", "Evidence history", "Year record tracks"], gaps: findings.filter((f) => f.engine === "election" && findingStatus(f, xray[f.id]) !== "resolved").map((f) => `${f.title} — ${f.missing}`), strength: "partial" });
  // Contradictions
  const contra: string[] = [];
  const th = calcs.find((c) => c.iso === "TH" && c.blendKind === "main");
  const boi = INCENTIVES.find((x) => x.type.toLowerCase().includes("boi") || x.name.toLowerCase().includes("boi"));
  if (th && boi && i.scenario.boiExtend && boi.end < `${i.ctx.fy.replace("FY", "")}-12-31`) contra.push(`Incentive register ends ${boi.name} on ${boi.end}, but the working package assumes extension through ${i.ctx.fy}.`);
  for (const f of findings) {
    const r = xray[f.id];
    if (r?.reviewer && missingEvidence(f, r).length) contra.push(`${f.title} (${f.entityCode}) is reviewer-signed but evidence ${missingEvidence(f, r).join(", ")} is missing.`);
  }
  for (const a of ADJUSTMENTS) if (a.status === "Validated" && !a.reviewer) contra.push(`${a.id} marked ${a.status} with no reviewer.`);
  if (contra.length) out.push({ id: "contra", area: "Contradictions", question: "Are there internal inconsistencies between the working package, the registers and the evidence?", answer: `${contra.length} contradiction${contra.length === 1 ? "" : "s"} detected.`, evidence: [], gaps: contra, strength: "weak" });
  return out;
}

function uniq<T>(xs: T[]) { return [...new Set(xs)]; }

export function readiness(qs: RehearsalQ[]) {
  const areas = uniq(qs.map((q) => q.area));
  return areas.map((a) => {
    const rows = qs.filter((q) => q.area === a);
    const score = Math.round((rows.reduce((s, q) => s + (q.strength === "strong" ? 1 : q.strength === "partial" ? 0.5 : 0), 0) / rows.length) * 100);
    return { area: a, score, n: rows.length, gaps: rows.reduce((s, q) => s + q.gaps.length, 0) };
  });
}

export function rehearsalReply(qs: RehearsalQ[], ctx: WorkContext, focus?: string): Reply {
  const sections: Section[] = [];
  const r = readiness(qs);
  const overall = Math.round(r.reduce((s, x) => s + x.score, 0) / Math.max(1, r.length));
  const target = focus ? qs.find((q) => q.id === focus || q.question.toLowerCase().includes(focus.toLowerCase()) || q.area.toLowerCase() === focus.toLowerCase()) : undefined;
  const actions = [];
  if (target) {
    sections.push({ kind: "conclusion", text: `Auditor question (${target.area}${target.iso ? ` · ${target.iso}` : ""}): "${target.question}"` });
    sections.push({ kind: "text", title: "Model answer from the record", text: target.answer });
    sections.push({ kind: "facts", title: "Evidence to produce", items: target.evidence });
    if (target.gaps.length) sections.push({ kind: "gaps", title: "Evidence challenge — what would not hold", items: target.gaps });
    sections.push({ kind: "next", items: target.gaps.length ? target.gaps.map((g) => `Remediate: ${g}`) : ["Answer is fully supported. Rehearse the follow-up: 'show me the source document'."] });
    for (const g of target.gaps.slice(0, 2)) actions.push(propose("create-task", { title: `Rehearsal gap · ${target.area}`, detail: g, owner: "Tax manager", severity: "warn", href: "/rehearsal", source: "rehearsal" }, ctx));
  } else {
    sections.push({ kind: "conclusion", text: `Internal readiness ${overall}% across ${r.length} areas, ${qs.length} rehearsal questions. This is a self-assessment against GMT24's own records — not a prediction of audit outcome.` });
    sections.push({ kind: "table", title: "Readiness by area", head: ["Area", "Readiness", "Questions", "Gaps"], rows: r.map((x) => [x.area, `${x.score}%`, String(x.n), String(x.gaps)]) });
    const weak = qs.filter((q) => q.strength !== "strong").slice(0, 6);
    sections.push({ kind: "steps", title: "Questions you would struggle with", items: weak.map((q, i) => `${i + 1}. ${q.question} — ${q.gaps[0] ?? "partial support"}`) });
    const contra = qs.find((q) => q.id === "contra");
    if (contra) sections.push({ kind: "warning", text: contra.gaps.join(" ") });
    sections.push({ kind: "next", items: ["Pick a question to rehearse the full answer and evidence list.", "Create remediation tasks for the gaps; they appear on the shared task list under 'rehearsal'."] });
    actions.push(propose("navigate", { href: "/rehearsal", label: "Open Audit Rehearsal" }, ctx));
    for (const q of weak.slice(0, 2)) if (q.gaps[0]) actions.push(propose("create-task", { title: `Rehearsal gap · ${q.area}`, detail: q.gaps[0], owner: "Tax manager", severity: "warn", href: "/rehearsal", source: "rehearsal" }, ctx));
  }
  return {
    id: `r-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    feature: "rehearsal",
    title: target ? `Audit Rehearsal · ${target.area}` : "Audit Rehearsal",
    sections,
    cites: [{ label: ctx.calcVersion, href: "/audit" }, { label: "Evidence history", href: "/evidence-history" }],
    actions,
    grounded: true,
    unsupported: [],
    version: ctx.calcVersion,
    lang: ctx.lang,
    chips: qs.slice(0, 3).map((q) => `Rehearse: ${q.question.slice(0, 50)}`),
  };
}

import type { Fact, ManualTask } from "../ai/types";
import type { EngagementDraft } from "../onboard";
import type { HistoryDraft } from "../evidenceHistory";
import { applyCorrections, entityName } from "./pipeline";
import type { ScanResult } from "./types";

/**
 * One-click onboarding: turn a Quick Scan into proposed master data, evidence
 * records and tasks. Everything is labelled proposed — a reviewer accepts it into
 * the assessment. Public research never enters an approved calculation directly.
 */
const THB_PER_USD = 34;

export type OnboardingPackage = {
  draft: EngagementDraft;
  entities: { name: string; iso: string; relationship: string; ownership: number | null; activity: string; basis: string; source: string }[];
  facts: Fact[];
  tasks: Omit<ManualTask, "id" | "createdAt">[];
  evidence: HistoryDraft[];
  notes: string[];
};

export function onboardingPackage(r: ScanResult, actor: { name: string; role: string }): OnboardingPackage {
  const upe = r.entities.find((e) => e.relationship === "upe");
  const name = r.resolved?.name ?? upe?.name ?? r.query;
  const y = Number(r.period.replace(/\D/g, "")) || 2025;
  const fy = `FY${y + 1}`;
  const rev = (p: string) => { const row = r.scope?.revenue.find((x) => x.period === p); return row ? String(Math.round(row.amount / THB_PER_USD / 1_000_000)) : ""; };
  const draft: EngagementDraft = {
    name, upe: upe?.name ?? name, upeIso: r.resolved?.upeIso ?? upe?.incorporationIso ?? "TH", upeTin: "", fy, fyStart: `${y + 1}-01-01`, fyEnd: `${y + 1}-12-31`,
    rev23: rev(`FY${y - 2}`), rev24: rev(`FY${y - 1}`), rev25: rev(`FY${y}`), rev26: "",
    partner: actor.name, clientLead: "",
  };
  const ents = applyCorrections(r.entities, r.corrections).filter((e) => !e.outdated);
  const entities = ents.map((e) => ({ name: e.name, iso: e.taxResidenceIso ?? e.incorporationIso, relationship: e.relationship, ownership: e.ownership, activity: e.activity, basis: e.basis, source: e.evidence[0] ? `${e.evidence[0].docId} p.${e.evidence[0].page}` : "user" }));
  const at = new Date().toISOString();
  const facts: Fact[] = [];
  for (const e of ents) {
    for (const i of e.incentives) facts.push({ id: `qs-inc-${e.id}-${i.schemeId}`, topic: "Incentives", engine: "boi", questionId: "incentive-disclosed", entityId: e.id, entityCode: e.name.split(" ")[0].toUpperCase().slice(0, 8), iso: e.incorporationIso, fy, statement: `${e.name} disclosed as benefiting from ${i.schemeId}`, value: `${i.period?.from ?? "?"} → ${i.period?.to ?? "?"}`, status: i.basis === "user-confirmed" ? "proposed" : "proposed", owner: "Tax manager", confirmedBy: null, reviewedBy: null, at, evidence: i.passage ? [`${i.passage.docId} p.${i.passage.page}`] : [], source: "quickscan", dependents: [], findingId: `qs-${r.id}`, href: "/quickscan", reason: `Quick Scan ${r.id}, ${r.period}, basis ${i.basis}.` });
    if (e.taxResidenceIso) facts.push({ id: `qs-res-${e.id}`, topic: "Entity & ownership", engine: "entity", questionId: "tax-residence", entityId: e.id, entityCode: e.name.split(" ")[0].toUpperCase().slice(0, 8), iso: e.taxResidenceIso, fy, statement: `${e.name} tax resident in ${e.taxResidenceIso}`, value: e.taxResidenceIso, status: "proposed", owner: "Tax manager", confirmedBy: null, reviewedBy: null, at, evidence: [], source: "quickscan", dependents: [], findingId: `qs-${r.id}`, href: "/quickscan", reason: `Basis ${e.taxResidenceBasis}.` });
  }
  for (const [qid, a] of Object.entries(r.answers)) {
    const q = r.questions.find((x) => x.id === qid);
    facts.push({ id: `qs-ans-${qid}`, topic: "Quick Scan interview", engine: "entity", questionId: qid, entityId: q?.entityId ?? "group", entityCode: q?.entityId ? entityName(r, q.entityId).split(" ")[0].toUpperCase().slice(0, 8) : "GROUP", iso: q?.iso ?? draft.upeIso, fy, statement: q?.question ?? qid, value: a.value, status: "proposed", owner: a.by, confirmedBy: null, reviewedBy: null, at: a.at, evidence: [], source: "quickscan", dependents: [], findingId: `qs-${r.id}`, href: "/quickscan", reason: "User-confirmed in the Quick Scan follow-up interview; needs an accountable person's confirmation in the workspace." });
  }
  const tasks: OnboardingPackage["tasks"] = r.missing.map((m) => ({ source: "quickscan" as const, title: `${m.kind === "document" ? "Obtain" : "Confirm"}: ${m.item}`, detail: `${m.why} Raised by Quick Scan ${r.id} (${r.period}).`, owner: m.kind === "document" ? "Preparer" : "Tax manager", due: null, status: "open" as const, severity: /High/.test(m.why) ? "warn" as const : "info" as const, href: "/quickscan", iso: m.iso, entityId: m.entityId }));
  for (const f of r.exposure.filter((x) => x.priority === "High")) tasks.push({ source: "quickscan", title: `Start X-Ray for ${f.name}`, detail: `High review priority (${f.evidence} evidence): ${f.reasons[0] ?? ""}`, owner: "Tax manager", due: null, status: "open", severity: "warn", href: "/xray", iso: f.iso });
  const evidence: HistoryDraft[] = r.sources.map((s) => ({ kind: "doc", title: `Public source · ${s.title}`, detail: `${s.kind} · ${s.period} · ${s.accessible ? `retrieved ${s.retrievedAt.slice(0, 10)}` : `inaccessible — ${s.inaccessibleReason}`}${s.url ? ` · ${s.url}` : ""}. Imported from Quick Scan ${r.id} as proposed evidence.`, actor: actor.name, role: actor.role, fy, href: "/quickscan", ref: s.id }));
  const notes = [
    "All entities, facts and evidence arrive as proposed. A reviewer must accept them before they enter an approved assessment.",
    `Revenue history converted at ${THB_PER_USD} THB/USD for the engagement form — replace with audited USD figures.`,
    r.unsupportedIsos.length ? `Jurisdictions outside the tax database (${r.unsupportedIsos.join(", ")}) are carried as entities only.` : "",
  ].filter(Boolean);
  return { draft, entities, facts, tasks, evidence, notes };
}

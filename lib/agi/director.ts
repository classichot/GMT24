/**
 * GMT24 AI Mission Director. Decides what work is required, which specialists
 * are needed, how they cooperate, and what qualifies as completion. It composes
 * specialists from the approved catalogue — it does not invent qualifications
 * or grant itself new permissions.
 */
import { DATA } from "../model";
import { calculateGroup } from "../engine";
import { classifyAll } from "../entityClass";
import { reviewDataset } from "../datasetGuideline";
import { UPDATES } from "../updates";
import { setActiveSeed } from "../seeds";
import type { CaseSnapshot, MissionObjectives, PermittedAction } from "./types";
import {
  SPECIALISTS, specialist, WORK_MODE_LABEL, type AgentCard, type Autonomy, type SpecialistId, type WorkMode,
} from "./specialists";

export type Complexity = {
  entities: number;
  blends: number;
  jurisdictions: number;
  pope: number;
  moce: number;
  jv: number;
  investment: number;
  topUpIsos: string[];
  dataIssues: number;
  incentives: number;
  score: number;
  notes: string[];
};

export type DirectorPlan = {
  mode: WorkMode;
  modeWhy: string;
  autonomy: Autonomy;
  agentCap: number;
  complexity: Complexity;
  cards: AgentCard[];
  parallel: string[][];
  handoffs: { from: string; to: string; why: string }[];
  blockers: string[];
  budget: { steps: number; retries: number; concurrency: number };
  completion: string[];
  briefing: string;
};

function cardId(role: SpecialistId, iso?: string) {
  return iso ? `${role}-${iso}` : role;
}

export function assessComplexity(s: CaseSnapshot): Complexity {
  setActiveSeed(s.groupId);
  const calcs = calculateGroup(s.groupId, { electionsOn: s.electionsOn, packOverlay: s.packOverlay });
  const scoped = calcs.filter((c) => s.jurisdictions.includes(c.iso));
  const classes = classifyAll().filter((c) => s.entityIds.includes(c.id));
  const ds = reviewDataset(s.ingestStatus === "ready" ? DATA.files : null, [], DATA.issues);
  const dataIssues = ds.items.filter((i) => i.status === "missing" || i.status === "incomplete").length;
  const incentives = DATA.entities.filter((e) => s.entityIds.includes(e.id) && e.incentiveIds.length > 0).length;
  const topUpIsos = [...new Set(scoped.filter((c) => c.jurisdictionalTopUp > 0).map((c) => c.iso))];
  const notes: string[] = [];
  if (classes.some((c) => c.pope)) notes.push("POPE on the ownership chain — Inclusion Ratio and IIR order must be reviewed.");
  if (classes.some((c) => c.jv)) notes.push("Joint Venture Group is a separate ETR blend (Art. 6.4).");
  if (classes.some((c) => c.moce)) notes.push("MOCE / MOSG must not blend with majority CEs.");
  if (topUpIsos.length) notes.push(`Top-up posted in ${topUpIsos.join(", ")}.`);
  if (dataIssues) notes.push(`${dataIssues} data-readiness findings.`);
  if (incentives) notes.push(`${incentives} entities carry incentive certificates.`);
  const score = Math.min(100,
    classes.length + scoped.length * 2 + topUpIsos.length * 4 + dataIssues * 3 + incentives * 2
    + (classes.filter((c) => c.pope).length * 3) + (classes.filter((c) => c.jv).length * 3));
  return {
    entities: classes.length,
    blends: scoped.length,
    jurisdictions: s.jurisdictions.length,
    pope: classes.filter((c) => c.pope).length,
    moce: classes.filter((c) => c.moce).length,
    jv: classes.filter((c) => c.jv).length,
    investment: classes.filter((c) => c.investment).length,
    topUpIsos,
    dataIssues,
    incentives,
    score,
    notes,
  };
}

export function recommendMode(cx: Complexity): { mode: WorkMode; why: string; agentCap: number } {
  if (cx.jurisdictions >= 6 && (cx.topUpIsos.length >= 3 || cx.dataIssues >= 4)) {
    return { mode: "swarm", why: "Several jurisdictions carry top-up or data issues that can run concurrently. A group orchestrator plus temporary jurisdiction teams is cheaper than a single queue.", agentCap: Math.min(12, 3 + cx.topUpIsos.length + 2) };
  }
  if (cx.jurisdictions <= 2 && cx.dataIssues <= 1 && cx.topUpIsos.length <= 1) {
    return { mode: "single", why: "Narrow scope — one agent can walk the catalogue sequentially without a coordination tax.", agentCap: 1 };
  }
  return { mode: "team", why: WORK_MODE_LABEL.team.blurb, agentCap: Math.min(8, 4 + cx.topUpIsos.length) };
}

function makeCard(id: SpecialistId, opts: {
  title?: string;
  iso?: string[];
  entityIds: string[];
  fy: string;
  autonomy: Autonomy;
  permitted: PermittedAction[];
  depends: string[];
  why: string;
  reviewer: string;
}): AgentCard {
  const def = specialist(id);
  const jurisdictions = opts.iso ?? [];
  return {
    id: cardId(id, jurisdictions.length === 1 ? jurisdictions[0] : undefined),
    specialistId: id,
    role: def.role,
    title: opts.title ?? (jurisdictions.length === 1 ? `${def.role} · ${jurisdictions[0]}` : def.role),
    scope: { jurisdictions, entityIds: opts.entityIds, fy: opts.fy },
    objective: def.responsibility,
    tools: def.defaultTools,
    permitted: opts.permitted,
    inputs: ["Pinned case version", ...jurisdictions.map((j) => `Jurisdiction ${j}`)],
    output: def.output,
    dependencies: opts.depends,
    reviewer: opts.reviewer,
    budget: { steps: 6, retries: 2 },
    stop: ["Open blocker", "Case hash changed", "Retry budget exhausted", "Human pause"],
    autonomy: opts.autonomy,
    status: "queued",
    why: opts.why,
  };
}

export function designTeam(s: CaseSnapshot, opts?: {
  mode?: WorkMode;
  autonomy?: Autonomy;
  agentCap?: number;
  objectives?: MissionObjectives;
}): DirectorPlan {
  const cx = assessComplexity(s);
  const rec = recommendMode(cx);
  const mode = opts?.mode ?? rec.mode;
  const autonomy = opts?.autonomy ?? "propose";
  const agentCap = opts?.agentCap ?? rec.agentCap;
  const permitted: PermittedAction[] = autonomy === "analyse"
    ? ["read", "compare-elections", "verify", "review-compliance"]
    : autonomy === "draft"
      ? ["read", "compare-elections", "run-scenario", "verify", "review-compliance", "build-pack"]
      : ["read", "compare-elections", "run-scenario", "verify", "review-compliance", "propose-change", "build-pack"];
  const reviewer = "Independent Review Agent";
  const cards: AgentCard[] = [];

  cards.push(makeCard("structure", { entityIds: s.entityIds, fy: s.fy, autonomy, permitted, depends: [], why: "Classification is computed from the ownership chain — every later blend depends on it.", reviewer }));
  cards.push(makeCard("data", { entityIds: s.entityIds, fy: s.fy, autonomy, permitted, depends: [cardId("structure")], why: cx.dataIssues ? `${cx.dataIssues} readiness findings must be listed before elections are ranked.` : "Confirm required datasets before any number is treated as final.", reviewer }));

  const isoForRules = mode === "swarm" ? (cx.topUpIsos.length ? cx.topUpIsos : s.jurisdictions.slice(0, 3)) : s.jurisdictions.slice(0, 1);
  if (mode === "swarm") {
    for (const iso of isoForRules) {
      cards.push(makeCard("rules", { title: `Jurisdiction Rules Agent · ${iso}`, iso: [iso], entityIds: s.entityIds, fy: s.fy, autonomy, permitted, depends: [cardId("data")], why: `Local rules and effective dates for ${iso}.`, reviewer }));
    }
  } else {
    cards.push(makeCard("rules", { iso: s.jurisdictions, entityIds: s.entityIds, fy: s.fy, autonomy, permitted, depends: [cardId("data")], why: "Effective-dated OECD and domestic rules for the scoped jurisdictions.", reviewer }));
  }

  cards.push(makeCard("globe", { iso: s.jurisdictions, entityIds: s.entityIds, fy: s.fy, autonomy, permitted, depends: [cardId("data")], why: "FANIL → GloBE adjustments must be sourced before ETR is trusted.", reviewer }));
  cards.push(makeCard("taxes", { iso: s.jurisdictions, entityIds: s.entityIds, fy: s.fy, autonomy, permitted, depends: [cardId("globe")], why: "Covered-tax bridge and deferred-tax recast are the ETR numerator.", reviewer }));
  cards.push(makeCard("harbours", { iso: s.jurisdictions, entityIds: s.entityIds, fy: s.fy, autonomy, permitted, depends: [cardId("data"), cardId("rules")], why: "Eligible elections and harbours ranked against the approved objectives.", reviewer }));
  cards.push(makeCard("sbie", { iso: s.jurisdictions, entityIds: s.entityIds, fy: s.fy, autonomy, permitted, depends: [cardId("globe")], why: "Payroll and tangible-asset carve-out feeds Excess Profit.", reviewer }));
  cards.push(makeCard("topup", { iso: s.jurisdictions, entityIds: s.entityIds, fy: s.fy, autonomy, permitted, depends: [cardId("harbours"), cardId("taxes"), cardId("sbie")], why: "Art. 5.2.3 amount plus QDMTT / IIR / UTPR collection and CE allocation.", reviewer }));

  if (s.jurisdictions.includes("TH") && cx.incentives > 0) {
    cards.push(makeCard("thai-incentive", { iso: ["TH"], entityIds: s.entityIds, fy: s.fy, autonomy, permitted, depends: [cardId("harbours")], why: "Thai BOI / incentive certificates interact with QDMTT and SBTISH.", reviewer }));
  }

  cards.push(makeCard("review", { entityIds: s.entityIds, fy: s.fy, autonomy: "analyse", permitted: ["read", "verify", "review-compliance"], depends: [cardId("topup")], why: "A separate reviewer challenges the proposed result. A second AI agreeing is not a check.", reviewer: "Group tax lead" }));
  cards.push(makeCard("gir", { entityIds: s.entityIds, fy: s.fy, autonomy, permitted, depends: [cardId("review")], why: "GIR is tracked separately from domestic returns and payment (OECD GIR Sep 2026).", reviewer: "Group tax lead" }));
  cards.push(makeCard("evidence", { entityIds: s.entityIds, fy: s.fy, autonomy, permitted, depends: [cardId("review")], why: "Every material conclusion needs linked evidence before completion.", reviewer: "Group tax lead" }));

  const capped = cards.slice(0, Math.max(agentCap + 4, cards.length)); // never drop review/evidence; cap applies to concurrency
  const parallel: string[][] = mode === "single"
    ? capped.map((c) => [c.id])
    : [
      [cardId("structure")],
      [cardId("data")],
      capped.filter((c) => c.specialistId === "rules" || c.specialistId === "globe").map((c) => c.id),
      [cardId("taxes"), cardId("harbours"), cardId("sbie")],
      [cardId("topup"), ...(capped.some((c) => c.specialistId === "thai-incentive") ? [cardId("thai-incentive")] : [])],
      [cardId("review")],
      [cardId("gir"), cardId("evidence")],
    ].filter((row) => row.some((id) => capped.some((c) => c.id === id)));

  const handoffs = [
    { from: cardId("data"), to: cardId("harbours"), why: "Election ranking uses the reconciled dataset." },
    { from: cardId("harbours"), to: cardId("topup"), why: "Approved package (or baseline) drives the working calculation." },
    { from: cardId("topup"), to: cardId("review"), why: "Independent review starts only after the jurisdictional amount is posted." },
    { from: cardId("review"), to: cardId("evidence"), why: "Findings become the evidence index and the outstanding-issues list." },
  ];

  const readyNow = cx.dataIssues === 0 ? s.jurisdictions : s.jurisdictions.filter((iso) => !cx.topUpIsos.includes(iso) || cx.dataIssues === 0);
  const needsSchedules = cx.dataIssues > 0 ? cx.topUpIsos.slice(0, 2) : [];
  const briefing = [
    `This mission requires ${capped.length} specialist roles`,
    mode === "swarm" ? `run as ${isoForRules.length} jurisdiction team(s) plus cross-group specialists` : mode === "team" ? "run as a planned team with a separate reviewer" : "run sequentially by one agent",
    `(autonomy: ${autonomy}, concurrency cap ${agentCap}).`,
    readyNow.length ? `${readyNow.slice(0, 6).join(", ")} can proceed on the pinned case.` : "",
    needsSchedules.length ? `${needsSchedules.join(", ")} need additional tax schedules before elections are locked.` : "",
    cx.notes.join(" "),
  ].filter(Boolean).join(" ");

  return {
    mode,
    modeWhy: opts?.mode ? `User selected ${WORK_MODE_LABEL[mode].label}.` : rec.why,
    autonomy,
    agentCap,
    complexity: cx,
    cards: capped,
    parallel,
    handoffs,
    blockers: cx.dataIssues ? [`${cx.dataIssues} data findings — Data & Reconciliation must list or accept them.`] : [],
    budget: { steps: mode === "single" ? 8 : mode === "team" ? 12 : 16, retries: 2, concurrency: mode === "swarm" ? agentCap : mode === "team" ? 3 : 1 },
    completion: [
      "Scope and entity classifications completed",
      "Required data reconciled, remaining differences resolved or accepted",
      "Recommended elections supported and approved",
      "Calculations passing the defined numerical and rule checks",
      "Material review findings resolved",
      "Evidence linked to material conclusions",
      "GIR draft validated; local return and payment tracked separately",
      "Designated human sign-off recorded",
    ],
    briefing,
  };
}

export function planOf(m: { plan?: DirectorPlan; workMode?: WorkMode; autonomy?: Autonomy; agentCap?: number; case: { snapshot: CaseSnapshot }; scope: { objectives: MissionObjectives } }): DirectorPlan {
  return m.plan ?? designTeam(m.case.snapshot, { mode: m.workMode, autonomy: m.autonomy, agentCap: m.agentCap, objectives: m.scope.objectives });
}

export function radarHits(s: CaseSnapshot) {
  const isos = new Set(s.jurisdictions);
  return UPDATES.filter((u) => {
    if (u.authority === "OECD" || u.authority === "EU") return true;
    return isos.has(String(u.authority).slice(0, 2));
  }).slice(0, 8);
}

export { SPECIALISTS };

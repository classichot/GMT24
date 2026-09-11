/**
 * Mission service. Pure functions over a MissionRecord: state transitions,
 * ownership leases, checkpoints, blockers, decisions, proposals, idempotency and
 * completion rules. Nothing here talks to the engine — the executor and the
 * tool catalogue do that and hand results back through these functions.
 *
 * Rules enforced here, not by the agent:
 *  - a mission is complete only when every blocking check passed against the
 *    current case version, the pack is built and no blocker is open;
 *  - approvals are tied to a case hash and become void when the case changes;
 *  - repeated proposals with the same key never duplicate;
 *  - only the owner (or a handoff) mutates the mission while the lease is live.
 */
import { describeCaseDiff, shortHash, versionOf } from "./case";
import { appendEvidence } from "./evidence";
import type {
  AgentClientId, Blocker, CaseSnapshot, CaseVersion, Decision, DecisionKind, DecisionOption, MissionObjectives, MissionRecord, MissionScope,
  MissionState, MissionStep, PermittedAction, Proposal, ProposalKind, StepId,
} from "./types";

export const LEASE_MINUTES = 30;
export const RELEASE_TEMPLATE = "review-case-r1" as const;

export const RELEASE_OBJECTIVE =
  "Review this GMT24 case, compare eligible elections, verify the calculations and compliance process, and prepare the audit package.";

export const DEFAULT_OBJECTIVES: MissionObjectives = { taxCash: 4, complianceEffort: 3, evidenceSupport: 4, uncertainty: 3, futureRestriction: 3 };

export const OBJECTIVE_LABEL: Record<keyof MissionObjectives, { label: string; hint: string }> = {
  taxCash: { label: "Tax and cash-flow", hint: "Lower FY top-up and five-year cash cost" },
  complianceEffort: { label: "Compliance effort", hint: "Fewer filings, tests and inner elections to maintain" },
  evidenceSupport: { label: "Evidence support", hint: "Position rests on documents already in the case" },
  uncertainty: { label: "Uncertainty", hint: "Avoid review-status conditions and untested harbours" },
  futureRestriction: { label: "Future restriction", hint: "Avoid five-year locks and irrevocable choices" },
};

export const RELEASE_PERMITTED: PermittedAction[] = ["read", "compare-elections", "run-scenario", "verify", "review-compliance", "propose-change", "build-pack"];

/** Elections the release-1 analyser evaluates. Each is a GMT24 election id at jurisdiction scope. */
export const RELEASE_ELECTION_SET = ["OECD_3.2.2", "OECD_3.2.5", "OECD_5.3.1", "SH_TCSH", "SH_SETR", "SH_SBTI"];

export const RELEASE_COMPLETION = [
  "Data readiness confirmed for the scoped jurisdictions and period",
  "Eligible election alternatives compared against the approved objectives; a package decision recorded",
  "Calculation reproduced from the case version and every blocking check passed",
  "Compliance requirements reviewed with OECD and domestic sources identified separately",
  "Audit package built with an evidence index and outstanding issues listed",
  "Completion approved by a person with approval permission",
];

export function releaseSteps(): MissionStep[] {
  return [
    { id: "context", title: "Read company context", tool: "get_case_context", status: "pending", dependsOn: [] },
    { id: "readiness", title: "Check data readiness", tool: "check_data_readiness", status: "pending", dependsOn: ["context"] },
    { id: "options", title: "Compare eligible elections", tool: "assess_election_options", status: "pending", dependsOn: ["readiness"] },
    { id: "decision", title: "Election package decision", tool: "request_approval", status: "pending", dependsOn: ["options"] },
    { id: "scenario", title: "Run approved package", tool: "run_scenario", status: "pending", dependsOn: ["decision"] },
    { id: "verify", title: "Verify calculation", tool: "verify_calculation", status: "pending", dependsOn: ["scenario"] },
    { id: "compliance", title: "Review compliance", tool: "review_compliance", status: "pending", dependsOn: ["verify"] },
    { id: "pack", title: "Build audit package", tool: "build_audit_pack", status: "pending", dependsOn: ["compliance"] },
  ];
}

let counter = 0;
export function uid(prefix: string) {
  counter = (counter + 1) % 1296;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36).padStart(2, "0")}${Math.random().toString(36).slice(2, 5)}`;
}

export function now() {
  return new Date().toISOString();
}

function leaseUntil(from = Date.now()) {
  return new Date(from + LEASE_MINUTES * 60_000).toISOString();
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

export type CreateMissionInput = {
  snapshot: CaseSnapshot;
  createdBy: AgentClientId;
  actor: string;
  objective?: string;
  jurisdictions?: string[];
  objectives?: Partial<MissionObjectives>;
  electionSet?: string[];
  id?: string;
};

export function createMission(i: CreateMissionInput): MissionRecord {
  const cv: CaseVersion = versionOf(i.snapshot);
  const at = now();
  const scope: MissionScope = {
    groupId: i.snapshot.groupId,
    fy: i.snapshot.fy,
    jurisdictions: (i.jurisdictions?.length ? i.jurisdictions : i.snapshot.jurisdictions).filter((j) => i.snapshot.jurisdictions.includes(j)),
    entityIds: i.snapshot.entityIds,
    permitted: RELEASE_PERMITTED,
    electionSet: i.electionSet?.length ? i.electionSet : RELEASE_ELECTION_SET,
    objectives: { ...DEFAULT_OBJECTIVES, ...(i.objectives ?? {}) },
    completion: RELEASE_COMPLETION,
  };
  let m: MissionRecord = {
    id: i.id ?? uid("msn"),
    version: 1,
    objective: i.objective?.trim() || RELEASE_OBJECTIVE,
    template: RELEASE_TEMPLATE,
    scope,
    case: cv,
    state: "draft",
    owner: { client: i.createdBy, actor: i.actor, since: at, leaseUntil: leaseUntil() },
    createdBy: i.createdBy,
    createdAt: at,
    updatedAt: at,
    steps: releaseSteps(),
    blockers: [],
    decisions: [],
    proposals: [],
    evidence: [],
    runs: [],
    checks: [],
    compliance: [],
    options: null,
    packs: [],
    jobs: [],
    handoffs: [],
    idempotency: {},
  };
  m = appendEvidence(m, {
    kind: "source",
    title: `Case version ${shortHash(cv.hash)} pinned`,
    detail: `${i.snapshot.groupName} · ${i.snapshot.fy} · ${scope.jurisdictions.join(", ")} · origin ${i.snapshot.origin} · ${cv.snapshot.ruleVersions.length} active rule versions. Every run, check and decision in this mission cites this hash.`,
    refs: [cv.hash],
    ruleVersions: cv.snapshot.ruleVersions,
    by: i.createdBy,
    supports: ["context"],
  });
  return m;
}

/* ------------------------------------------------------------------ */
/* Ownership                                                           */
/* ------------------------------------------------------------------ */

export function leaseLive(m: MissionRecord, at = Date.now()) {
  return new Date(m.owner.leaseUntil).getTime() > at;
}

/** Can this client mutate the mission? The workspace always can (people override agents). */
export function canMutate(m: MissionRecord, client: AgentClientId): { ok: true } | { ok: false; reason: string } {
  if (client === "workspace") return { ok: true };
  if (m.owner.client === client) return { ok: true };
  if (!leaseLive(m)) return { ok: true };
  return { ok: false, reason: `Mission is owned by ${m.owner.client} (${m.owner.actor}) until ${m.owner.leaseUntil}. Ask for a handoff or wait for the lease to lapse.` };
}

export function touch(m: MissionRecord, client: AgentClientId, actor?: string): MissionRecord {
  const takeover = m.owner.client !== client;
  const owner = takeover
    ? { client, actor: actor ?? client, since: now(), leaseUntil: leaseUntil() }
    : { ...m.owner, leaseUntil: leaseUntil() };
  let next: MissionRecord = { ...m, owner, updatedAt: now() };
  if (takeover) next = { ...next, handoffs: [...next.handoffs, { from: m.owner.client, to: client, at: now(), by: actor ?? client, note: "Lease lapsed or workspace override" }] };
  return next;
}

export function handoff(m: MissionRecord, to: AgentClientId, by: string, note: string): MissionRecord {
  const at = now();
  let next: MissionRecord = {
    ...m,
    owner: { client: to, actor: by, since: at, leaseUntil: leaseUntil() },
    handoffs: [...m.handoffs, { from: m.owner.client, to, at, by, note }],
    updatedAt: at,
  };
  next = appendEvidence(next, {
    kind: "decision",
    title: `Mission handed to ${to}`,
    detail: `${by} transferred ownership from ${m.owner.client} to ${to}. ${note || "Progress, decisions and evidence carry over unchanged."}`,
    by,
    supports: ["ownership"],
  });
  return next;
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

const TRANSITIONS: Record<MissionState, MissionState[]> = {
  draft: ["running", "cancelled"],
  running: ["paused", "waiting-info", "waiting-approval", "validation-failed", "ready-for-review", "cancelled"],
  paused: ["running", "cancelled"],
  "waiting-info": ["running", "paused", "cancelled"],
  "waiting-approval": ["running", "paused", "cancelled"],
  "validation-failed": ["running", "paused", "cancelled"],
  "ready-for-review": ["running", "completed", "cancelled"],
  completed: ["running"],
  cancelled: [],
};

export function canTransition(from: MissionState, to: MissionState) {
  return TRANSITIONS[from].includes(to);
}

export function setState(m: MissionRecord, to: MissionState, by: AgentClientId | string, note?: string): MissionRecord {
  if (m.state === to) return m;
  if (!canTransition(m.state, to)) throw new Error(`Cannot move mission from ${m.state} to ${to}`);
  const next: MissionRecord = { ...m, state: to, updatedAt: now() };
  return appendEvidence(next, {
    kind: "tool",
    title: `Mission ${m.state} → ${to}`,
    detail: note ?? `State changed by ${by}.`,
    by,
    supports: ["state"],
  });
}

export function pause(m: MissionRecord, by: string) {
  return setState(m, "paused", by, `${by} paused the mission. Completed steps, runs and evidence are preserved; the next step resumes from its checkpoint.`);
}

export function cancel(m: MissionRecord, by: string, reason: string) {
  const next = setState(m, "cancelled", by, `${by} cancelled the mission. ${reason || "No reason given."} Nothing was written to the case; open proposals and decisions are void.`);
  return {
    ...next,
    decisions: next.decisions.map((d) => (d.status === "open" ? { ...d, status: "void" as const, note: "Mission cancelled" } : d)),
    proposals: next.proposals.map((p) => (p.status === "proposed" ? { ...p, status: "void" as const } : p)),
  };
}

/** Resume puts the mission back in `running`; the executor decides which step continues. */
export function resume(m: MissionRecord, by: string) {
  if (m.state === "running") return m;
  return setState(m, "running", by, `${by} resumed the mission from checkpoint ${nextStep(m)?.id ?? "end"}.`);
}

export function stepById(m: MissionRecord, id: StepId) {
  return m.steps.find((s) => s.id === id)!;
}

export function patchStep(m: MissionRecord, id: StepId, patch: Partial<MissionStep>): MissionRecord {
  return { ...m, steps: m.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)), updatedAt: now() };
}

/** First step whose dependencies are done and which is not itself done or skipped. */
export function nextStep(m: MissionRecord): MissionStep | null {
  for (const s of m.steps) {
    if (s.status === "done" || s.status === "skipped") continue;
    if (s.dependsOn.every((d) => ["done", "skipped"].includes(stepById(m, d).status))) return s;
  }
  return null;
}

export function progress(m: MissionRecord) {
  const done = m.steps.filter((s) => s.status === "done" || s.status === "skipped").length;
  return { done, total: m.steps.length, pct: Math.round((done / m.steps.length) * 100) };
}

/* ------------------------------------------------------------------ */
/* Blockers                                                            */
/* ------------------------------------------------------------------ */

export function openBlocker(m: MissionRecord, b: Omit<Blocker, "id" | "openedAt">): MissionRecord {
  const existing = m.blockers.find((x) => !x.resolvedAt && x.kind === b.kind && x.title === b.title);
  if (existing) return m;
  return { ...m, blockers: [...m.blockers, { ...b, id: uid("blk"), openedAt: now() }], updatedAt: now() };
}

export function resolveBlocker(m: MissionRecord, id: string, resolution: string): MissionRecord {
  return { ...m, blockers: m.blockers.map((b) => (b.id === id ? { ...b, resolvedAt: now(), resolution } : b)), updatedAt: now() };
}

export function openBlockers(m: MissionRecord) {
  return m.blockers.filter((b) => !b.resolvedAt);
}

/* ------------------------------------------------------------------ */
/* Decisions                                                           */
/* ------------------------------------------------------------------ */

export function requestDecision(m: MissionRecord, d: {
  kind: DecisionKind; title: string; detail: string; options: DecisionOption[]; evidenceIds?: string[]; requestedBy: AgentClientId; proposalIds?: string[]; key?: string;
}): { mission: MissionRecord; decision: Decision } {
  const key = `decision:${d.key ?? `${d.kind}:${d.title}`}:${m.case.hash}`;
  const dup = m.idempotency[key] ? m.decisions.find((x) => x.id === m.idempotency[key] && x.status === "open") : undefined;
  if (dup) return { mission: m, decision: dup };
  const decision: Decision = {
    id: uid("dec"),
    kind: d.kind,
    title: d.title,
    detail: d.detail,
    options: d.options,
    caseHash: m.case.hash,
    evidenceIds: d.evidenceIds ?? [],
    requestedBy: d.requestedBy,
    requestedAt: now(),
    status: "open",
    proposalIds: d.proposalIds ?? [],
  };
  let next: MissionRecord = { ...m, decisions: [...m.decisions, decision], idempotency: { ...m.idempotency, [key]: decision.id }, updatedAt: now() };
  next = appendEvidence(next, {
    kind: "decision",
    title: `Approval requested: ${d.title}`,
    detail: `${d.requestedBy} asked a person with approval permission to decide. ${d.options.length} option${d.options.length === 1 ? "" : "s"} presented against case ${shortHash(m.case.hash)}. Agents prepare; GMT24 enforces who may approve.`,
    refs: [decision.id, ...(d.evidenceIds ?? [])],
    by: d.requestedBy,
    supports: [decision.id, "decision"],
  });
  return { mission: next, decision };
}

export function decide(m: MissionRecord, id: string, verdict: "approved" | "rejected", by: string, chosen?: string, note?: string): MissionRecord {
  const d = m.decisions.find((x) => x.id === id);
  if (!d) throw new Error("Decision not found");
  if (d.status !== "open") throw new Error(`Decision already ${d.status}`);
  if (d.caseHash !== m.case.hash) throw new Error(`Decision was presented against case ${shortHash(d.caseHash)}; the case is now ${shortHash(m.case.hash)}. Re-run the analysis before approving.`);
  if (verdict === "approved" && d.options.length && !d.options.some((o) => o.id === chosen)) throw new Error("Choose one of the presented options");
  const at = now();
  const updated: Decision = { ...d, status: verdict, chosen, decidedBy: by, decidedAt: at, note };
  let next: MissionRecord = {
    ...m,
    decisions: m.decisions.map((x) => (x.id === id ? updated : x)),
    proposals: m.proposals.map((p) => (d.proposalIds.includes(p.id) && p.status === "proposed" ? { ...p, status: verdict, decisionId: id } : p)),
    updatedAt: at,
  };
  const opt = d.options.find((o) => o.id === chosen);
  next = appendEvidence(next, {
    kind: "decision",
    title: `${verdict === "approved" ? "Approved" : "Rejected"}: ${d.title}`,
    detail: `${by} ${verdict} the request${opt ? ` and chose "${opt.label}"` : ""} against case ${shortHash(d.caseHash)}.${note ? ` Note: ${note}` : ""}`,
    refs: [id],
    by,
    supports: [id, "decision"],
  });
  return next;
}

export function openDecisions(m: MissionRecord) {
  return m.decisions.filter((d) => d.status === "open");
}

/* ------------------------------------------------------------------ */
/* Proposals                                                           */
/* ------------------------------------------------------------------ */

export function propose(m: MissionRecord, p: {
  kind: ProposalKind; title: string; detail: string; target: string; value: string | boolean; before: string; reason: string; proposedBy: AgentClientId; key?: string;
}): { mission: MissionRecord; proposal: Proposal; duplicate: boolean } {
  const key = p.key ?? `${p.kind}:${p.target}:${String(p.value)}`;
  const dup = m.proposals.find((x) => x.key === key && x.caseHash === m.case.hash && x.status !== "void" && x.status !== "rejected");
  if (dup) return { mission: m, proposal: dup, duplicate: true };
  const proposal: Proposal = {
    id: uid("prp"),
    kind: p.kind,
    key,
    title: p.title,
    detail: p.detail,
    target: p.target,
    value: p.value,
    before: p.before,
    reason: p.reason,
    caseHash: m.case.hash,
    proposedBy: p.proposedBy,
    proposedAt: now(),
    status: "proposed",
  };
  let next: MissionRecord = { ...m, proposals: [...m.proposals, proposal], updatedAt: now() };
  next = appendEvidence(next, {
    kind: "alternative",
    title: `Proposed: ${p.title}`,
    detail: `${p.proposedBy} proposed ${p.target} → ${String(p.value)} (was ${p.before}). Reason: ${p.reason} Nothing changes in normal mode until a person approves and applies it.`,
    refs: [proposal.id],
    by: p.proposedBy,
    supports: [proposal.id],
  });
  return { mission: next, proposal, duplicate: false };
}

export function markApplied(m: MissionRecord, ids: string[], by: string): MissionRecord {
  const at = now();
  let next: MissionRecord = { ...m, proposals: m.proposals.map((p) => (ids.includes(p.id) && p.status === "approved" ? { ...p, status: "applied", appliedAt: at } : p)), updatedAt: at };
  const applied = next.proposals.filter((p) => ids.includes(p.id) && p.status === "applied");
  if (applied.length) {
    next = appendEvidence(next, {
      kind: "transformation",
      title: `${applied.length} approved change${applied.length === 1 ? "" : "s"} applied to the case`,
      detail: `${by} applied: ${applied.map((p) => `${p.target} → ${String(p.value)}`).join("; ")}. The change is visible in normal mode with history.`,
      refs: ids,
      by,
      supports: ids,
    });
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* Case change and completion                                          */
/* ------------------------------------------------------------------ */

/**
 * Recheck what changed. Pins the new case version, voids approvals tied to the
 * old one, invalidates the verification and re-opens the engine-dependent
 * steps. The previous approved package is preserved (packs stay in the record).
 */
export function rebase(m: MissionRecord, snapshot: CaseSnapshot, by: string): { mission: MissionRecord; changes: string[] } {
  const cv = versionOf(snapshot);
  if (cv.hash === m.case.hash) return { mission: m, changes: [] };
  const changes = describeCaseDiff(m.case.snapshot, snapshot);
  const at = now();
  const reopen: StepId[] = ["options", "decision", "scenario", "verify", "compliance", "pack"];
  let next: MissionRecord = {
    ...m,
    version: m.version + 1,
    case: cv,
    verifiedAgainst: undefined,
    decisions: m.decisions.map((d) => (d.status === "open" ? { ...d, status: "void" as const, note: `Case changed to ${shortHash(cv.hash)}` } : d)),
    proposals: m.proposals.map((p) => (p.status === "proposed" ? { ...p, status: "void" as const } : p)),
    steps: m.steps.map((s) => (reopen.includes(s.id) && s.status !== "pending" ? { ...s, status: "pending", summary: undefined, jobId: undefined, startedAt: undefined, finishedAt: undefined, blocker: undefined } : s)),
    packs: m.packs.map((p) => (p.status === "draft" ? { ...p, status: "superseded" as const } : p)),
    checks: [],
    compliance: [],
    blockers: m.blockers.map((b) => (!b.resolvedAt && b.kind === "validation" ? { ...b, resolvedAt: at, resolution: `Case changed to ${shortHash(cv.hash)}; verification re-runs on the new version` } : b)),
    completedAt: undefined,
    completionNote: undefined,
    updatedAt: at,
  };
  if (["completed", "ready-for-review", "validation-failed", "waiting-approval"].includes(next.state)) next = { ...next, state: "running" };
  next = appendEvidence(next, {
    kind: "source",
    title: `Case changed · version ${m.version} → ${next.version} (${shortHash(m.case.hash)} → ${shortHash(cv.hash)})`,
    detail: `${by} pinned the changed case. ${changes.length ? changes.join(" · ") : "Inputs changed without a describable difference."} Prior verification and approvals no longer apply to this version — the election package must be re-approved; earlier approved packages are preserved for comparison.`,
    refs: [m.case.hash, cv.hash],
    ruleVersions: snapshot.ruleVersions,
    by,
    supports: ["context", "recheck"],
    caseHash: cv.hash,
  });
  return { mission: next, changes };
}

/**
 * Company objectives changed. Weights are part of the recommendation, so the
 * options step re-opens; an open election-package decision is void because it
 * was presented on the old weights. Runs, checks and evidence are kept.
 */
export function setObjectives(m: MissionRecord, objectives: MissionObjectives, by: string): MissionRecord {
  const same = (Object.keys(objectives) as (keyof MissionObjectives)[]).every((k) => m.scope.objectives[k] === objectives[k]);
  if (same) return m;
  const at = now();
  let next: MissionRecord = {
    ...m,
    scope: { ...m.scope, objectives },
    steps: m.steps.map((s) => (s.id === "options" || s.id === "decision" ? (s.status === "done" || s.status === "blocked" ? { ...s, status: "pending", summary: "Re-assess on new objective weights", blocker: undefined } : s) : s)),
    decisions: m.decisions.map((d) => (d.status === "open" && d.kind === "election-package" ? { ...d, status: "void" as const, note: "Objective weights changed" } : d)),
    updatedAt: at,
  };
  if (next.state === "waiting-approval" && !openDecisions(next).length) next = { ...next, state: "running" };
  next = appendEvidence(next, {
    kind: "decision",
    title: "Company objectives updated",
    detail: `${by} set weights ${(Object.keys(objectives) as (keyof MissionObjectives)[]).map((k) => `${k} ${objectives[k]}`).join(", ")} (was ${(Object.keys(m.scope.objectives) as (keyof MissionObjectives)[]).map((k) => `${k} ${m.scope.objectives[k]}`).join(", ")}). Election ranking re-runs on these weights; the engine figures do not change.`,
    by,
    supports: ["options", "objectives"],
  });
  return next;
}

export type CompletionGate = { ok: boolean; reasons: string[] };

/** Completion depends on passed checks and evidence — never on an agent saying it is done. */
export function completionGate(m: MissionRecord): CompletionGate {
  const reasons: string[] = [];
  if (m.verifiedAgainst !== m.case.hash) reasons.push("Verification has not passed against the current case version.");
  if (m.checks.some((c) => c.status === "fail" && c.severity === "block")) reasons.push(`${m.checks.filter((c) => c.status === "fail" && c.severity === "block").length} blocking check(s) failed.`);
  if (!m.packs.some((p) => p.caseHash === m.case.hash && p.status !== "superseded")) reasons.push("No audit package built for the current case version.");
  if (openBlockers(m).length) reasons.push(`${openBlockers(m).length} blocker(s) still open.`);
  if (openDecisions(m).length) reasons.push(`${openDecisions(m).length} decision(s) waiting for approval.`);
  if (!m.compliance.length) reasons.push("Compliance review has not run.");
  if (!m.decisions.some((d) => d.kind === "election-package" && d.status === "approved" && d.caseHash === m.case.hash)) reasons.push("Election package decision not approved on this case version.");
  return { ok: reasons.length === 0, reasons };
}

export function complete(m: MissionRecord, by: string, note?: string): MissionRecord {
  const gate = completionGate(m);
  if (!gate.ok) throw new Error(`Mission cannot complete: ${gate.reasons.join(" ")}`);
  const at = now();
  let next = setState(m, "completed", by, `${by} approved completion. Gate: ${m.scope.completion.length} completion rules satisfied against case ${shortHash(m.case.hash)}.`);
  next = { ...next, completedAt: at, completionNote: note, packs: next.packs.map((p) => (p.caseHash === m.case.hash && p.status === "draft" ? { ...p, status: "approved" as const } : p)) };
  return next;
}

export function stateTag(s: MissionState): string {
  switch (s) {
    case "running": return "tag-accent";
    case "completed": return "tag-ok";
    case "ready-for-review": return "tag-ok";
    case "waiting-approval": return "tag-warn";
    case "waiting-info": return "tag-warn";
    case "validation-failed": return "tag-hot";
    case "cancelled": return "tag-hot";
    case "paused": return "tag-neutral";
    default: return "tag-outline";
  }
}

/**
 * Tool catalogue. One implementation serves the AGI workspace, the REST
 * gateway and the MCP endpoint. Tools are pure functions over a case snapshot
 * and a mission record; the caller supplies how missions are loaded and saved.
 *
 * Responses always carry: structured result, calculation ids, source refs,
 * rule versions and unresolved issues. Repeated calls with the same inputs on
 * the same case version return the same job and never duplicate changes.
 */
import { z } from "zod";
import { setActiveSeed } from "../seeds";
import { DATA } from "../model";
import { totals } from "../engine";
import { sourcesIn } from "../ai/calc";
import { reviewDataset } from "../datasetGuideline";
import { eur, etrPct } from "../format";
import type { XrayState } from "../xray";
import { hashOf, shortHash, ruleVersionRefs } from "./case";
import { appendEvidence } from "./evidence";
import {
  canMutate, createMission, completionGate, nextStep, openBlocker, openBlockers, openDecisions, patchStep, progress, propose, requestDecision,
  resolveBlocker, setState, touch, RELEASE_OBJECTIVE,
} from "./mission";
import { runCase } from "./run";
import { assessOptions, optionToChanges } from "./elections";
import { verifyCase, checkSummary } from "./verify";
import { reviewComplianceFor, complianceSummary } from "./compliance";
import { buildAuditPack, latestRun } from "./auditPack";
import {
  MISSION_STATE_LABEL, type AgentClientId, type AgentScope, type CaseSnapshot, type Job, type MissionRecord, type StepId, type ToolName, type ToolResult,
} from "./types";

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

const Objectives = z.object({
  taxCash: z.number().min(0).max(5).optional(),
  complianceEffort: z.number().min(0).max(5).optional(),
  evidenceSupport: z.number().min(0).max(5).optional(),
  uncertainty: z.number().min(0).max(5).optional(),
  futureRestriction: z.number().min(0).max(5).optional(),
});

export const TOOL_SCHEMAS = {
  get_case_context: z.object({ groupId: z.string().min(1).max(40).optional(), missionId: z.string().optional() }),
  create_mission: z.object({
    groupId: z.string().min(1).max(40),
    objective: z.string().max(400).optional(),
    jurisdictions: z.array(z.string().length(2)).max(20).optional(),
    objectives: Objectives.optional(),
  }),
  check_data_readiness: z.object({ missionId: z.string() }),
  assess_election_options: z.object({ missionId: z.string() }),
  run_scenario: z.object({ missionId: z.string(), optionId: z.string().optional(), electionsOn: z.record(z.boolean()).optional(), label: z.string().max(120).optional() }),
  verify_calculation: z.object({ missionId: z.string(), runId: z.string().optional(), nonce: z.string().max(40).optional() }),
  review_compliance: z.object({ missionId: z.string() }),
  propose_change: z.object({
    missionId: z.string(),
    kind: z.enum(["election", "sbie", "mapping", "exception", "note"]),
    target: z.string().min(1).max(120),
    value: z.union([z.string().max(200), z.boolean()]),
    reason: z.string().min(3).max(1000),
    title: z.string().max(160).optional(),
  }),
  request_approval: z.object({
    missionId: z.string(),
    kind: z.enum(["election-package", "correction", "technical-judgment", "accept-exception", "completion"]).default("election-package"),
    title: z.string().max(160).optional(),
    detail: z.string().max(2000).optional(),
    optionIds: z.array(z.string()).max(10).optional(),
    proposalIds: z.array(z.string()).max(50).optional(),
  }),
  build_audit_pack: z.object({ missionId: z.string() }),
  get_mission_status: z.object({ missionId: z.string() }),
} satisfies Record<ToolName, z.ZodTypeAny>;

export type ToolArgs<N extends ToolName> = z.infer<(typeof TOOL_SCHEMAS)[N]>;

export const TOOL_CATALOGUE: { name: ToolName; title: string; description: string; scope: AgentScope; step?: StepId; longRunning: boolean; inputSchema: Record<string, unknown> }[] = [
  { name: "get_case_context", title: "Company context", scope: "case:read", step: "context", longRunning: false, description: "Read the pinned case: group, period, jurisdictions, entities, elections in force, rule versions, data status and the engine's current totals. Read-only.", inputSchema: obj({ groupId: str("Group id (default: the caller's granted group)"), missionId: str("Mission id — read the mission's pinned case version instead of the live case") }) },
  { name: "create_mission", title: "Create mission", scope: "mission:write", longRunning: false, description: "Create the release-1 mission (review case, compare eligible elections, verify calculation and compliance, prepare audit package) against the current case version. Idempotent per objective, scope and case version.", inputSchema: obj({ groupId: str("Group id"), objective: str("Objective text (default: the release-1 mission)"), jurisdictions: { type: "array", items: { type: "string" }, description: "ISO codes to limit the scope" }, objectives: { type: "object", description: "Weights 0–5: taxCash, complianceEffort, evidenceSupport, uncertainty, futureRestriction" } }, ["groupId"]) },
  { name: "check_data_readiness", title: "Data readiness", scope: "case:read", step: "readiness", longRunning: false, description: "Check the required and recommended datasets, data-pack status and completeness for the mission scope. Missing information stays unresolved and blocks the mission in Waiting for Information.", inputSchema: obj({ missionId: str("Mission id") }, ["missionId"]) },
  { name: "assess_election_options", title: "Election options", scope: "scenario:run", step: "options", longRunning: true, description: "Restate every eligible election package with the shared Election Engine and rank them by the mission's approved objectives. Returns recommended and rejected alternatives with reasons.", inputSchema: obj({ missionId: str("Mission id") }, ["missionId"]) },
  { name: "run_scenario", title: "Run scenario", scope: "scenario:run", step: "scenario", longRunning: true, description: "Run the GloBE engine for the mission's case version with an option id or explicit election switches. Drafts never touch the approved case. Returns a calculation id.", inputSchema: obj({ missionId: str("Mission id"), optionId: str("Option id from assess_election_options"), electionsOn: { type: "object", additionalProperties: { type: "boolean" }, description: "Election switch keys such as OECD_3.2.2@TH" }, label: str("Run label") }, ["missionId"]) },
  { name: "verify_calculation", title: "Verify calculation", scope: "scenario:run", step: "verify", longRunning: true, description: "Reproduce the run from the case version and check the arithmetic, inputs, allocation, elections and evidence rule by rule. Blocking failures put the mission in Validation Failed with concrete corrections proposed.", inputSchema: obj({ missionId: str("Mission id"), runId: str("Calculation id (default: latest run on the case version)"), nonce: str("Optional token to force a fresh verification after evidence was confirmed") }, ["missionId"]) },
  { name: "review_compliance", title: "Review compliance", scope: "scenario:run", step: "compliance", longRunning: true, description: "Walk the requirement register for the scoped jurisdictions and period. OECD and domestic requirements are reported separately with effective dates.", inputSchema: obj({ missionId: str("Mission id") }, ["missionId"]) },
  { name: "propose_change", title: "Propose change", scope: "change:propose", longRunning: false, description: "Propose a change to the case (election, SBIE claim, mapping, exception, note). Proposals are drafts until a person approves; repeated proposals with the same target and value do not duplicate.", inputSchema: obj({ missionId: str("Mission id"), kind: { type: "string", enum: ["election", "sbie", "mapping", "exception", "note"] }, target: str("Election key, ISO code, account number or finding id"), value: { type: ["string", "boolean"], description: "New value" }, reason: str("Why, citing the source or rule"), title: str("Short title") }, ["missionId", "kind", "target", "value", "reason"]) },
  { name: "request_approval", title: "Request approval", scope: "approval:request", step: "decision", longRunning: false, description: "Ask a person with approval permission to decide. For election-package requests, present option ids; the mission moves to Waiting for Approval. Agents never approve.", inputSchema: obj({ missionId: str("Mission id"), kind: { type: "string", enum: ["election-package", "correction", "technical-judgment", "accept-exception", "completion"] }, title: str("Title"), detail: str("What is being decided and why"), optionIds: { type: "array", items: { type: "string" } }, proposalIds: { type: "array", items: { type: "string" } } }, ["missionId"]) },
  { name: "build_audit_pack", title: "Build audit package", scope: "pack:build", step: "pack", longRunning: true, description: "Assemble the audit package: executive summary, election register, calculation summary, checks, compliance findings, decisions, evidence index and outstanding issues. Moves a fully checked mission to Ready for Review.", inputSchema: obj({ missionId: str("Mission id") }, ["missionId"]) },
  { name: "get_mission_status", title: "Mission status", scope: "case:read", longRunning: false, description: "Current state, step checkpoints, blockers, open decisions, latest calculation, checks and completion gate for a mission.", inputSchema: obj({ missionId: str("Mission id") }, ["missionId"]) },
];

function obj(props: Record<string, unknown>, required: string[] = []) {
  return { type: "object", properties: props, required, additionalProperties: false };
}
function str(description: string) {
  return { type: "string", description };
}

export function toolByName(name: string) {
  return TOOL_CATALOGUE.find((t) => t.name === name);
}

/* ------------------------------------------------------------------ */
/* Execution context                                                   */
/* ------------------------------------------------------------------ */

export type ToolCtx = {
  client: AgentClientId;
  actor: string;
  /** Live case for a group (workspace state or gateway-pinned snapshot). */
  snapshotFor: (groupId: string) => CaseSnapshot;
  getMission: (id: string) => MissionRecord | null;
  saveMission: (m: MissionRecord) => void;
  listMissions: (groupId: string) => MissionRecord[];
  /** X-Ray confirmations when the caller has them (workspace). */
  xray?: XrayState;
  /** Group the caller's grant is limited to (gateway). */
  grantGroupId?: string;
};

export class ToolError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function envelope<T>(tool: ToolName, jobId: string, caseHash: string, result: T, extra: Partial<ToolResult<T>> = {}): ToolResult<T> {
  return {
    ok: true,
    tool,
    jobId,
    caseHash,
    calculationIds: [],
    ruleVersions: [],
    sources: [],
    unresolved: [],
    result,
    at: new Date().toISOString(),
    ...extra,
  };
}

function requireMission(ctx: ToolCtx, id: string) {
  const m = ctx.getMission(id);
  if (!m) throw new ToolError(`Mission ${id} not found`, 404);
  if (ctx.grantGroupId && m.scope.groupId !== ctx.grantGroupId) throw new ToolError("Mission is outside the granted group", 403);
  return m;
}

function requireWritable(ctx: ToolCtx, m: MissionRecord) {
  const c = canMutate(m, ctx.client);
  if (!c.ok) throw new ToolError(c.reason, 409);
  if (m.state === "cancelled") throw new ToolError("Mission is cancelled", 409);
  if (m.state === "paused") throw new ToolError("Mission is paused — resume it first", 409);
  return touch(m, ctx.client, ctx.actor);
}

function stepFor(tool: ToolName) {
  return toolByName(tool)?.step;
}

function beginStep(m: MissionRecord, tool: ToolName, jobId: string): MissionRecord {
  const id = stepFor(tool);
  if (!id) return m;
  const next = patchStep(m, id, { status: "running", startedAt: new Date().toISOString(), jobId, blocker: undefined });
  return next.state === "draft" ? setState(next, "running", "GMT24", "First tool call started the mission.") : next;
}

function endStep(m: MissionRecord, tool: ToolName, status: "done" | "blocked" | "failed", summary: string, blocker?: string): MissionRecord {
  const id = stepFor(tool);
  if (!id) return m;
  return patchStep(m, id, { status, finishedAt: new Date().toISOString(), summary, blocker });
}

function jobIdFor(tool: ToolName, args: unknown, caseHash: string) {
  return `job_${hashOf({ tool, args, caseHash }).slice(0, 12)}`;
}

function recordJob(m: MissionRecord, job: Job): MissionRecord {
  const jobs = [...m.jobs.filter((j) => j.id !== job.id), job].slice(-60);
  return { ...m, jobs };
}

/* ------------------------------------------------------------------ */
/* Tool implementations                                                */
/* ------------------------------------------------------------------ */

export function callTool(name: ToolName, rawArgs: unknown, ctx: ToolCtx): ToolResult {
  const schema = TOOL_SCHEMAS[name];
  if (!schema) throw new ToolError(`Unknown tool ${name}`, 404);
  const parsed = schema.safeParse(rawArgs ?? {});
  if (!parsed.success) throw new ToolError(`Invalid arguments for ${name}: ${parsed.error.issues.map((i) => `${i.path.join(".") || "body"} ${i.message}`).join("; ")}`, 400);
  const args = parsed.data as Record<string, unknown>;

  switch (name) {
    case "get_case_context": return getCaseContext(args as ToolArgs<"get_case_context">, ctx);
    case "create_mission": return createMissionTool(args as ToolArgs<"create_mission">, ctx);
    case "get_mission_status": return getMissionStatus(args as ToolArgs<"get_mission_status">, ctx);
    default: return missionTool(name, args, ctx);
  }
}

function getCaseContext(a: ToolArgs<"get_case_context">, ctx: ToolCtx): ToolResult {
  let s: CaseSnapshot;
  let caseHash: string;
  let mission: MissionRecord | null = null;
  if (a.missionId) {
    mission = requireMission(ctx, a.missionId);
    s = mission.case.snapshot;
    caseHash = mission.case.hash;
  } else {
    const groupId = a.groupId ?? ctx.grantGroupId;
    if (!groupId) throw new ToolError("groupId is required", 400);
    if (ctx.grantGroupId && groupId !== ctx.grantGroupId) throw new ToolError("Group is outside the grant", 403);
    s = ctx.snapshotFor(groupId);
    caseHash = hashOf({ live: true, g: groupId, at: s.takenAt });
  }
  setActiveSeed(s.groupId);
  const { run, calcs } = runCase(s, caseHash, "Context read", ctx.client);
  const t = totals(calcs);
  const jobId = jobIdFor("get_case_context", a, caseHash);
  const result = {
    group: { id: s.groupId, name: s.groupName, upeIso: s.upeIso, fy: s.fy },
    caseHash,
    origin: s.origin,
    takenAt: s.takenAt,
    jurisdictions: calcs.map((c) => ({ iso: c.iso, name: c.name, blendKey: c.blendKey, entities: c.entities.map((e) => e.code), etr: etrPct(c), etrComputed: c.etrComputed, topUp: c.jurisdictionalTopUp, exposure: c.exposure, completeness: c.completeness })),
    entities: DATA.entities.map((e) => ({ id: e.id, code: e.code, name: e.name, iso: e.iso, type: e.type, excluded: e.excludedReason ?? null })),
    electionsOn: Object.entries(s.electionsOn).filter(([, v]) => v).map(([k]) => k),
    sbieClaim: s.sbieClaim,
    approvedMappings: Object.keys(s.approvedMaps).filter((k) => s.approvedMaps[k]).length,
    dataStatus: s.ingestStatus,
    totals: { topUp: t.topUp, qdmtt: t.qdmtt, iir: t.iir, utpr: t.utpr },
    ruleVersions: s.ruleVersions,
    openIssues: DATA.issues.map((i) => ({ id: i.id, severity: i.severity, title: i.title, jurisdiction: i.jurisdiction ?? null })),
    missions: ctx.listMissions(s.groupId).map((m) => ({ id: m.id, state: m.state, objective: m.objective, caseHash: m.case.hash })),
    engine: run.engine,
  };
  if (mission) {
    let next = mission;
    if (next.steps.find((x) => x.id === "context")?.status !== "done") {
      next = beginStep(next, "get_case_context", jobId);
      next = endStep(next, "get_case_context", "done", `${s.groupName} · ${s.fy} · ${calcs.length} blends · top-up ${eur(t.topUp)} · ${s.ruleVersions.length} rule versions.`);
      next = appendEvidence(next, { kind: "source", title: "Company context read", detail: `Case ${shortHash(caseHash)}: ${calcs.length} jurisdictional blends, ${DATA.entities.length} entities, ${DATA.files.length} source files, data pack ${s.ingestStatus}. Group top-up ${eur(t.topUp)} from ${run.engine}.`, refs: [run.id, ...DATA.files.map((f) => f.name)], ruleVersions: s.ruleVersions, by: ctx.client, supports: ["context"] });
      next = recordJob(next, { id: jobId, tool: "get_case_context", missionId: mission.id, status: "done", startedAt: run.ranAt, finishedAt: new Date().toISOString() });
      ctx.saveMission(next);
    }
  }
  return envelope("get_case_context", jobId, caseHash, result, { missionId: mission?.id, calculationIds: [run.id], ruleVersions: s.ruleVersions, sources: [...new Set(calcs.flatMap((c) => sourcesIn(c.audit)))], unresolved: DATA.issues.filter((i) => i.severity === "block").map((i) => `${i.id} ${i.title}`) });
}

function createMissionTool(a: ToolArgs<"create_mission">, ctx: ToolCtx): ToolResult {
  if (ctx.grantGroupId && a.groupId !== ctx.grantGroupId) throw new ToolError("Group is outside the grant", 403);
  const s = ctx.snapshotFor(a.groupId);
  setActiveSeed(s.groupId);
  const objective = a.objective?.trim() || RELEASE_OBJECTIVE;
  const jurisdictions = a.jurisdictions?.length ? a.jurisdictions.filter((j) => s.jurisdictions.includes(j)) : s.jurisdictions;
  const fresh = createMission({ snapshot: s, createdBy: ctx.client, actor: ctx.actor, objective, jurisdictions, objectives: a.objectives });
  const idemKey = hashOf({ objective, jurisdictions: [...jurisdictions].sort(), caseHash: fresh.case.hash, groupId: a.groupId });
  const existing = ctx.listMissions(a.groupId).find((m) => m.idempotency.create === idemKey && !["cancelled", "completed"].includes(m.state));
  const jobId = `job_${idemKey.slice(0, 12)}`;
  if (existing) return envelope("create_mission", jobId, existing.case.hash, summarise(existing), { missionId: existing.id, ruleVersions: existing.case.snapshot.ruleVersions, unresolved: ["Mission already exists for this objective, scope and case version — returned the existing record."] });
  const m: MissionRecord = { ...fresh, idempotency: { ...fresh.idempotency, create: idemKey }, jobs: [{ id: jobId, tool: "create_mission", missionId: fresh.id, status: "done", startedAt: fresh.createdAt, finishedAt: fresh.createdAt }] };
  ctx.saveMission(m);
  return envelope("create_mission", jobId, m.case.hash, summarise(m), { missionId: m.id, ruleVersions: s.ruleVersions });
}

function getMissionStatus(a: ToolArgs<"get_mission_status">, ctx: ToolCtx): ToolResult {
  const m = requireMission(ctx, a.missionId);
  const jobId = jobIdFor("get_mission_status", { id: m.id, v: m.updatedAt }, m.case.hash);
  const run = latestRun(m);
  return envelope("get_mission_status", jobId, m.case.hash, summarise(m), { missionId: m.id, calculationIds: run ? [run.id] : [], ruleVersions: m.case.snapshot.ruleVersions, unresolved: [...openBlockers(m).map((b) => b.title), ...openDecisions(m).map((d) => `approval: ${d.title}`), ...completionGate(m).reasons] });
}

export function summarise(m: MissionRecord) {
  const run = latestRun(m);
  const cs = checkSummary(m.checks);
  return {
    id: m.id,
    version: m.version,
    objective: m.objective,
    state: m.state,
    stateLabel: MISSION_STATE_LABEL[m.state],
    owner: m.owner,
    scope: { groupId: m.scope.groupId, fy: m.scope.fy, jurisdictions: m.scope.jurisdictions, permitted: m.scope.permitted, objectives: m.scope.objectives },
    caseHash: m.case.hash,
    progress: progress(m),
    nextStep: nextStep(m)?.id ?? null,
    steps: m.steps.map((s) => ({ id: s.id, title: s.title, tool: s.tool, status: s.status, summary: s.summary ?? null, blocker: s.blocker ?? null, jobId: s.jobId ?? null })),
    blockers: openBlockers(m).map((b) => ({ id: b.id, kind: b.kind, title: b.title, detail: b.detail })),
    decisions: m.decisions.map((d) => ({ id: d.id, kind: d.kind, title: d.title, status: d.status, chosen: d.chosen ?? null, options: d.options.map((o) => ({ id: o.id, label: o.label })) })),
    proposals: m.proposals.map((p) => ({ id: p.id, kind: p.kind, target: p.target, value: p.value, status: p.status })),
    latestRun: run ? { id: run.id, caseHash: run.caseHash, totals: run.totals, ranAt: run.ranAt } : null,
    checks: cs,
    verifiedAgainst: m.verifiedAgainst ?? null,
    compliance: complianceSummary(m.compliance),
    options: m.options ? { recommendedId: m.options.recommendedId, count: m.options.options.length } : null,
    packs: m.packs.map((p) => ({ id: p.id, version: p.version, status: p.status, caseHash: p.caseHash, outstanding: p.outstanding.length })),
    completion: completionGate(m),
    evidenceCount: m.evidence.length,
    updatedAt: m.updatedAt,
  };
}

function missionTool(name: ToolName, a: Record<string, unknown>, ctx: ToolCtx): ToolResult {
  const missionId = String(a.missionId);
  const loaded = requireMission(ctx, missionId);
  // Same inputs on the same case version → same job. The approved package and the
  // objective weights are inputs too, so a new decision or new weights re-run.
  const jobId = jobIdFor(name, { ...a, _pkg: approvedElections(loaded).electionsOn, _obj: name === "assess_election_options" ? loaded.scope.objectives : undefined }, loaded.case.hash);
  const prior = loaded.jobs.find((j) => j.id === jobId && j.status === "done" && j.result);
  if (prior?.result) return { ...prior.result, unresolved: [...prior.result.unresolved, "Identical call already executed on this case version — returned the recorded result; nothing was duplicated."] };

  let m = requireWritable(ctx, loaded);
  setActiveSeed(m.scope.groupId);
  const s = m.case.snapshot;
  const startedAt = new Date().toISOString();
  m = beginStep(m, name, jobId);
  let result: ToolResult;
  try {
    switch (name) {
      case "check_data_readiness": ({ m, result } = readiness(m, jobId, ctx)); break;
      case "assess_election_options": ({ m, result } = options(m, jobId, ctx)); break;
      case "run_scenario": ({ m, result } = scenario(m, a as ToolArgs<"run_scenario">, jobId, ctx)); break;
      case "verify_calculation": ({ m, result } = verify(m, a as ToolArgs<"verify_calculation">, jobId, ctx)); break;
      case "review_compliance": ({ m, result } = compliance(m, jobId, ctx)); break;
      case "propose_change": ({ m, result } = proposeTool(m, a as ToolArgs<"propose_change">, jobId, ctx)); break;
      case "request_approval": ({ m, result } = approval(m, a as ToolArgs<"request_approval">, jobId, ctx)); break;
      case "build_audit_pack": ({ m, result } = pack(m, jobId, ctx)); break;
      default: throw new ToolError(`Tool ${name} is not mission-scoped`, 400);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    m = endStep(m, name, "failed", msg);
    m = recordJob(m, { id: jobId, tool: name, missionId, status: "failed", startedAt, finishedAt: new Date().toISOString(), error: msg });
    ctx.saveMission(m);
    throw e instanceof ToolError ? e : new ToolError(msg, 500);
  }
  void s;
  m = recordJob(m, { id: jobId, tool: name, missionId, status: "done", startedAt, finishedAt: new Date().toISOString(), result });
  ctx.saveMission(m);
  return result;
}

function readiness(m: MissionRecord, jobId: string, ctx: ToolCtx) {
  const s = m.case.snapshot;
  const review = reviewDataset(s.ingestStatus === "ready" ? DATA.files : null, [], DATA.issues);
  const { calcs } = runCase(s, m.case.hash, "Readiness", ctx.client);
  const scoped = calcs.filter((c) => m.scope.jurisdictions.includes(c.iso));
  const lowCompleteness = scoped.filter((c) => c.completeness < 90).map((c) => `${c.name} ${c.completeness}%`);
  const blockers = DATA.issues.filter((i) => i.severity === "block" && (!i.jurisdiction || scoped.some((c) => c.name === i.jurisdiction)));
  const missingRequired = review.items.filter((r) => r.slot.need === "required" && r.status === "missing").map((r) => r.slot.title);
  const ready = review.canCalculate && s.ingestStatus === "ready";
  const summary = `${review.headline} Completion ${review.completion}%. ${missingRequired.length ? `Missing required: ${missingRequired.join(", ")}. ` : ""}${lowCompleteness.length ? `Estimates in ${lowCompleteness.join(", ")}.` : ""}`;
  m = appendEvidence(m, { kind: "review", title: "Data readiness checked", detail: summary, refs: review.items.flatMap((r) => r.files), by: ctx.client, supports: ["readiness"], href: "/data" });
  if (!ready) {
    m = endStep(m, "check_data_readiness", "blocked", summary, "Required datasets missing");
    m = openBlocker(m, { kind: "information", title: "Required datasets not posted", detail: `${missingRequired.join(", ") || "Data pack not ready"}. ${review.suggestion}`, href: "/data" });
    if (m.state === "running") m = setState(m, "waiting-info", ctx.client, "Data readiness failed — the mission waits for the missing information rather than estimating it.");
  } else {
    m = endStep(m, "check_data_readiness", "done", summary);
    for (const b of openBlockers(m).filter((b) => b.kind === "information")) m = resolveBlocker(m, b.id, "Required datasets now posted");
    if (m.state === "waiting-info") m = setState(m, "running", ctx.client, "Information received; mission resumed.");
  }
  const result = {
    ready,
    completion: review.completion,
    headline: review.headline,
    suggestion: review.suggestion,
    dataStatus: s.ingestStatus,
    required: review.required,
    recommended: review.recommended,
    slots: review.items.map((r) => ({ id: r.slot.id, title: r.slot.title, need: r.slot.need, status: r.status, files: r.files, note: r.note })),
    jurisdictionCompleteness: scoped.map((c) => ({ iso: c.iso, name: c.name, completeness: c.completeness })),
    blockingIssues: blockers.map((i) => ({ id: i.id, title: i.title, owner: i.owner, jurisdiction: i.jurisdiction ?? null })),
  };
  return { m, result: envelope("check_data_readiness", jobId, m.case.hash, result, { missionId: m.id, ruleVersions: [], sources: review.items.flatMap((r) => r.files), unresolved: [...missingRequired.map((t) => `missing: ${t}`), ...blockers.map((i) => `${i.id} ${i.title}`), ...lowCompleteness.map((l) => `estimates: ${l}`)] }) };
}

function options(m: MissionRecord, jobId: string, ctx: ToolCtx) {
  const s = m.case.snapshot;
  const { calcs } = runCase(s, m.case.hash, "Options baseline", ctx.client);
  const { assessment } = assessOptions(calcs, s, m.scope, m.case.hash);
  const rec = assessment.options.find((o) => o.id === assessment.recommendedId)!;
  m = { ...m, options: assessment };
  m = appendEvidence(m, { kind: "alternative", title: `${assessment.options.length} election packages compared`, detail: `${assessment.method} Recommended: ${rec.title} (score ${(rec.score.total * 100).toFixed(0)}, FY top-up ${eur(rec.fyTopUp)}). Rejected: ${assessment.options.filter((o) => o.rejectedBecause).map((o) => `${o.title} — ${o.rejectedBecause}`).join("; ") || "none"}.`, refs: assessment.options.map((o) => `option:${o.id}`), ruleVersions: s.ruleVersions.filter((r) => r.id.includes("ELEC") || r.id.includes("SBIE") || r.id.includes("TCSH")), by: ctx.client, supports: ["options"], href: "/agi/options" });
  m = endStep(m, "assess_election_options", "done", `${assessment.options.filter((o) => o.bookable).length} bookable of ${assessment.options.length}; recommended ${rec.title}.`);
  const result = { ...assessment, recommended: rec };
  return { m, result: envelope("assess_election_options", jobId, m.case.hash, result, { missionId: m.id, calculationIds: assessment.options.map((o) => `option:${o.id}`), ruleVersions: s.ruleVersions, unresolved: assessment.options.filter((o) => !o.eligible).map((o) => `${o.title}: ${o.rejectedBecause}`) }) };
}

/** Election switches the mission should run: approved package if decided, else the case's own. */
export function approvedElections(m: MissionRecord): { electionsOn: Record<string, boolean>; label: string; optionId?: string } {
  const d = m.decisions.find((x) => x.kind === "election-package" && x.status === "approved" && x.caseHash === m.case.hash);
  const opt = d && m.options?.options.find((o) => o.id === d.chosen);
  if (opt) return { electionsOn: { ...m.case.snapshot.electionsOn, ...optionToChanges(opt).electionsOn }, label: `Approved package · ${opt.title}`, optionId: opt.id };
  return { electionsOn: m.case.snapshot.electionsOn, label: "Working package (case as pinned)" };
}

function scenario(m: MissionRecord, a: ToolArgs<"run_scenario">, jobId: string, ctx: ToolCtx) {
  const s = m.case.snapshot;
  let electionsOn = s.electionsOn;
  let label = a.label ?? "Working package";
  if (a.optionId) {
    const opt = m.options?.options.find((o) => o.id === a.optionId);
    if (!opt) throw new ToolError(`Option ${a.optionId} not found — run assess_election_options first`, 404);
    electionsOn = { ...s.electionsOn, ...optionToChanges(opt).electionsOn };
    label = a.label ?? `Option ${opt.id} · ${opt.title}`;
  } else if (a.electionsOn) {
    electionsOn = { ...s.electionsOn, ...a.electionsOn };
    label = a.label ?? "Explicit election switches";
  } else {
    const ap = approvedElections(m);
    electionsOn = ap.electionsOn;
    label = a.label ?? ap.label;
  }
  const { run, calcs } = runCase(s, m.case.hash, label, ctx.client, { electionsOn });
  const exists = m.runs.find((r) => r.id === run.id);
  if (!exists) m = { ...m, runs: [...m.runs, run].slice(-40) };
  m = appendEvidence(m, { kind: "calculation", title: `Calculation ${run.id} · ${label}`, detail: `${run.engine} posted group top-up ${eur(run.totals.topUp)} (QDMTT ${eur(run.totals.qdmtt)} · IIR ${eur(run.totals.iir)} · UTPR ${eur(run.totals.utpr)}) on case ${shortHash(m.case.hash)} with ${Object.values(electionsOn).filter(Boolean).length} elections on. Draft run — the approved case is untouched.`, refs: [run.id, ...new Set(calcs.flatMap((c) => sourcesIn(c.audit)))], ruleVersions: s.ruleVersions, by: ctx.client, supports: ["scenario", run.id], href: "/agi/calculation" });
  m = endStep(m, "run_scenario", "done", `${label}: top-up ${eur(run.totals.topUp)} (${run.id}).`);
  const result = { run: { ...run, rows: run.rows.filter((r) => m.scope.jurisdictions.includes(r.iso)) }, allRows: run.rows.length };
  return { m, result: envelope("run_scenario", jobId, m.case.hash, result, { missionId: m.id, calculationIds: [run.id], ruleVersions: s.ruleVersions, sources: [...new Set(calcs.flatMap((c) => sourcesIn(c.audit)))], unresolved: calcs.filter((c) => m.scope.jurisdictions.includes(c.iso) && c.completeness < 90).map((c) => `${c.name}: completeness ${c.completeness}%`) }) };
}

function verify(m: MissionRecord, a: ToolArgs<"verify_calculation">, jobId: string, ctx: ToolCtx) {
  const s = m.case.snapshot;
  const run = a.runId ? m.runs.find((r) => r.id === a.runId) : latestRun(m);
  if (!run) throw new ToolError("No calculation run on this case version — call run_scenario first", 409);
  if (run.caseHash !== m.case.hash) throw new ToolError(`Run ${run.id} belongs to case ${shortHash(run.caseHash)}; the mission is on ${shortHash(m.case.hash)}. Re-run the scenario.`, 409);
  const { calcs } = runCase(s, m.case.hash, "verify", ctx.client, { electionsOn: run.inputs.electionsOn });
  const checks = verifyCase({ snapshot: s, caseHash: m.case.hash, run, calcs, jurisdictions: m.scope.jurisdictions, xray: ctx.xray, by: ctx.client });
  const cs = checkSummary(checks);
  m = { ...m, checks };
  const failed = checks.filter((c) => c.status === "fail");
  m = appendEvidence(m, { kind: "review", title: `Verification of ${run.id}: ${cs.passes} passed · ${cs.fails} failed · ${cs.warns} warnings`, detail: cs.passed ? `All blocking checks passed against case ${shortHash(m.case.hash)}. ${failed.length ? `Non-blocking failures: ${failed.map((f) => f.title).join("; ")}.` : ""}` : `${cs.blocking} blocking failure(s): ${failed.filter((f) => f.severity === "block").map((f) => `${f.title} (expected ${f.expected}, found ${f.actual})`).join("; ")}.`, refs: [run.id, ...checks.map((c) => c.id)], ruleVersions: s.ruleVersions, by: ctx.client, supports: ["verify", ...checks.map((c) => c.id)], href: "/agi/calculation" });
  if (cs.passed) {
    m = { ...m, verifiedAgainst: m.case.hash };
    m = endStep(m, "verify_calculation", "done", `${cs.passes}/${cs.total} passed, ${cs.warns} warnings; no blocking failures.`);
    for (const b of openBlockers(m).filter((b) => b.kind === "validation")) m = resolveBlocker(m, b.id, "Verification passed");
    if (m.state === "validation-failed") m = setState(m, "running", ctx.client, "Verification now passes.");
  } else {
    m = { ...m, verifiedAgainst: undefined };
    m = endStep(m, "verify_calculation", "blocked", `${cs.blocking} blocking failure(s).`, failed.filter((f) => f.severity === "block").map((f) => f.title).join("; "));
    for (const f of failed.filter((f) => f.severity === "block" && f.correction)) {
      const r = propose(m, { kind: f.group === "inputs" ? "mapping" : "exception", title: `Correction: ${f.title}`, detail: `Expected ${f.expected}; found ${f.actual}.`, target: f.id, value: f.correction!, before: f.actual, reason: f.correction!, proposedBy: ctx.client, key: `correction:${f.id}` });
      m = r.mission;
    }
    m = openBlocker(m, { kind: "validation", title: `${cs.blocking} blocking verification failure(s)`, detail: failed.filter((f) => f.severity === "block").map((f) => f.title).join("; "), href: "/agi/calculation" });
    if (m.state === "running") m = setState(m, "validation-failed", ctx.client, "Blocking checks failed. Corrections are proposed, not applied.");
  }
  const result = { runId: run.id, summary: cs, passed: cs.passed, checks, verifiedAgainst: m.verifiedAgainst ?? null };
  return { m, result: envelope("verify_calculation", jobId, m.case.hash, result, { missionId: m.id, calculationIds: [run.id], ruleVersions: s.ruleVersions, unresolved: failed.map((f) => `${f.title}: ${f.correction ?? f.actual}`) }) };
}

function compliance(m: MissionRecord, jobId: string, ctx: ToolCtx) {
  const s = m.case.snapshot;
  const ap = approvedElections(m);
  const { calcs } = runCase(s, m.case.hash, "compliance", ctx.client, { electionsOn: ap.electionsOn });
  const rows = reviewComplianceFor({ ...s, electionsOn: ap.electionsOn }, calcs, m.checks, m.scope.jurisdictions);
  const sum = complianceSummary(rows);
  m = { ...m, compliance: rows };
  m = appendEvidence(m, { kind: "authority", title: `Compliance review: ${sum.met} met · ${sum.gap} gaps · ${sum.judgment} judgments`, detail: `${sum.oecd} OECD requirements and ${sum.domestic} domestic requirements (${[...new Set(rows.filter((r) => r.authority !== "OECD").map((r) => r.authority))].join(", ") || "none"}) reviewed for ${s.fy}. Gaps: ${rows.filter((r) => r.applies && r.status === "gap").map((r) => r.title).join("; ") || "none"}.`, refs: rows.flatMap((r) => r.evidence), ruleVersions: s.ruleVersions, by: ctx.client, supports: ["compliance", ...rows.map((r) => r.id)], href: "/agi/compliance" });
  m = endStep(m, "review_compliance", "done", `${sum.met} met, ${sum.gap} gaps, ${sum.judgment} judgments.`);
  const result = { summary: sum, findings: rows };
  return { m, result: envelope("review_compliance", jobId, m.case.hash, result, { missionId: m.id, ruleVersions: s.ruleVersions, sources: [...new Set(rows.map((r) => r.instrument))], unresolved: rows.filter((r) => r.applies && r.status !== "met" && r.status !== "n/a").map((r) => `${r.authority} ${r.title}: ${r.status}`) }) };
}

function proposeTool(m: MissionRecord, a: ToolArgs<"propose_change">, jobId: string, ctx: ToolCtx) {
  const s = m.case.snapshot;
  let before = "—";
  if (a.kind === "election") before = s.electionsOn[a.target] ? "on" : "off";
  if (a.kind === "sbie") before = s.sbieClaim[a.target] ?? "max";
  if (a.kind === "mapping") before = s.approvedMaps[a.target] ? "approved" : "not approved";
  const r = propose(m, { kind: a.kind, title: a.title ?? `${a.kind}: ${a.target} → ${String(a.value)}`, detail: a.reason, target: a.target, value: a.value, before, reason: a.reason, proposedBy: ctx.client });
  m = r.mission;
  return { m, result: envelope("propose_change", jobId, m.case.hash, { proposal: r.proposal, duplicate: r.duplicate }, { missionId: m.id, ruleVersions: [], unresolved: r.duplicate ? ["Identical proposal already exists on this case version — not duplicated."] : ["Awaiting decision by a person with approval permission."] }) };
}

function approval(m: MissionRecord, a: ToolArgs<"request_approval">, jobId: string, ctx: ToolCtx) {
  let options: { id: string; label: string; detail: string; effect?: string }[] = [];
  let title = a.title ?? "";
  let detail = a.detail ?? "";
  if (a.kind === "election-package") {
    if (!m.options) throw new ToolError("Run assess_election_options before requesting an election-package decision", 409);
    const ids = a.optionIds?.length ? a.optionIds : [m.options.recommendedId, ...m.options.options.filter((o) => o.bookable && o.id !== m.options!.recommendedId).slice(0, 3).map((o) => o.id)];
    options = ids.map((id) => m.options!.options.find((o) => o.id === id)).filter(Boolean).map((o) => ({ id: o!.id, label: o!.title, detail: `FY top-up ${eur(o!.fyTopUp)} · five-year ${eur(o!.fy5)} · lock ${o!.lockYears}y · score ${(o!.score.total * 100).toFixed(0)}${o!.rejectedBecause ? ` · ${o!.rejectedBecause}` : ""}`, effect: o!.elections.join(", ") || "Core default" }));
    if (!options.length) throw new ToolError("No valid option ids", 400);
    title = title || "Election package for the period";
    detail = detail || `Choose the election package the mission runs, verifies and files. Recommended: ${m.options.options.find((o) => o.id === m.options!.recommendedId)?.title}. Objectives weighted: ${Object.entries(m.scope.objectives).map(([k, v]) => `${k} ${v}`).join(", ")}.`;
  } else if (a.kind === "completion") {
    const gate = completionGate(m);
    if (!gate.ok) throw new ToolError(`Completion cannot be requested: ${gate.reasons.join(" ")}`, 409);
    title = title || "Confirm mission completion";
    detail = detail || "All checks passed against the current case version, the audit package is built and no blocker is open.";
    options = [{ id: "complete", label: "Complete mission", detail: "Marks the package approved and the mission completed." }];
  } else {
    title = title || `${a.kind} decision`;
    detail = detail || "Decide on the proposals listed.";
    options = [{ id: "approve", label: "Approve", detail: "Apply the listed proposals." }, { id: "reject", label: "Reject", detail: "Keep the case unchanged." }];
  }
  const r = requestDecision(m, { kind: a.kind, title, detail, options, requestedBy: ctx.client, proposalIds: a.proposalIds ?? [], key: a.kind === "election-package" ? "election-package" : undefined });
  m = r.mission;
  if (a.kind === "election-package") m = endStep(m, "request_approval", "blocked", `Waiting for a decision: ${title}`, "Approval by a person required");
  if (m.state === "running") m = setState(m, "waiting-approval", ctx.client, `${ctx.client} requested a decision: ${title}.`);
  return { m, result: envelope("request_approval", jobId, m.case.hash, { decision: r.decision }, { missionId: m.id, ruleVersions: [], unresolved: [`Decision ${r.decision.id} awaits a person with approval permission; agents cannot approve.`] }) };
}

function pack(m: MissionRecord, jobId: string, ctx: ToolCtx) {
  const p = buildAuditPack(m);
  m = { ...m, packs: [...m.packs.map((x) => (x.caseHash === m.case.hash && x.status === "draft" ? { ...x, status: "superseded" as const } : x)), p] };
  m = appendEvidence(m, { kind: "decision", title: `Audit package v${p.version} built`, detail: `${p.sections.length} sections, ${p.evidenceIndex.length} evidence items indexed, ${p.outstanding.length} outstanding issue(s). Built on case ${shortHash(m.case.hash)}. Audit readiness describes the file, not the auditor's conclusion.`, refs: [p.id], by: ctx.client, supports: ["pack", p.id], href: "/agi/audit-file" });
  const gate = completionGate(m);
  const ready = m.verifiedAgainst === m.case.hash && !openBlockers(m).length && !openDecisions(m).length;
  m = endStep(m, "build_audit_pack", ready ? "done" : "blocked", `Pack v${p.version}: ${p.outstanding.length} outstanding.`, ready ? undefined : gate.reasons.join(" "));
  if (ready && m.state === "running") m = setState(m, "ready-for-review", ctx.client, "Audit package built and every check passed; a person now reviews and approves completion.");
  return { m, result: envelope("build_audit_pack", jobId, m.case.hash, { pack: p, completion: gate }, { missionId: m.id, ruleVersions: m.case.snapshot.ruleVersions, unresolved: p.outstanding }) };
}

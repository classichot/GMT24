/**
 * GMT24 AGI Mode — shared types.
 *
 * AGI mode is a mission-execution layer above the normal platform. Agents plan
 * and execute missions, compare alternatives, verify work and assemble
 * deliverables. Normal mode keeps managing the case directly. Both use the same
 * engines, rule versions, permissions and evidence records.
 *
 * Every mission references a versioned case snapshot. Nothing an agent does
 * overwrites approved data: changes are proposals until a person with the right
 * permission records a decision, and the decision is tied to the exact case
 * version it was taken on.
 */
import type { SbieMode } from "../electionEngine";
import type { YearRecord } from "../yearLedger";
import type { PackOverlay } from "../packAmendments";
import type { ScenarioInput } from "../engine";
import type { IngestStatus } from "../ingestSim";

/* ------------------------------------------------------------------ */
/* Clients and access                                                  */
/* ------------------------------------------------------------------ */

/** Who is driving the mission. `workspace` is the AGI workspace inside GMT24. */
export type AgentClientId = "workspace" | "grok-bot" | "claude-cowork" | "gpt-work";

export const AGENT_CLIENTS: Record<Exclude<AgentClientId, "workspace">, {
  id: Exclude<AgentClientId, "workspace">;
  name: string;
  vendor: string;
  integration: string;
  docs: string;
  verify: string[];
  transport: "mcp" | "plugin";
}> = {
  "grok-bot": {
    id: "grok-bot",
    name: "Grok Bot",
    vendor: "xAI",
    integration: "GMT24 connector / MCP access plus mission instructions",
    docs: "https://docs.x.ai/grok-bot/overview",
    verify: ["Authentication", "Available connector capabilities", "Tool execution", "Interruption recovery", "Result retrieval"],
    transport: "mcp",
  },
  "claude-cowork": {
    id: "claude-cowork",
    name: "Claude Cowork",
    vendor: "Anthropic",
    integration: "Remote MCP connector plus workflow instructions",
    docs: "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp",
    verify: ["Organisation setup", "Network reachability", "Permissions", "Tool execution", "Review handoff"],
    transport: "mcp",
  },
  "gpt-work": {
    id: "gpt-work",
    name: "GPT Work",
    vendor: "OpenAI",
    integration: "GMT24 plugin containing an MCP connection and mission instructions",
    docs: "https://developers.openai.com/plugins/concepts/plugins",
    verify: ["Installation", "Authentication", "Tool availability", "Structured results", "Approval handoff"],
    transport: "plugin",
  },
};

/** Access scopes a gateway key can carry. Approval scopes are never granted to agents. */
export type AgentScope = "case:read" | "mission:write" | "scenario:run" | "change:propose" | "approval:request" | "pack:build";
export const ALL_AGENT_SCOPES: AgentScope[] = ["case:read", "mission:write", "scenario:run", "change:propose", "approval:request", "pack:build"];

export type AgentGrant = {
  client: AgentClientId;
  groupId: string;
  scopes: AgentScope[];
  issuedAt: number;
  exp: number;
  epoch: number;
  label: string;
};

/* ------------------------------------------------------------------ */
/* Case versions                                                       */
/* ------------------------------------------------------------------ */

export type RuleVersionRef = { id: string; version: string; jurisdiction: string };

/** Everything the engine needs to reproduce a calculation, plus provenance. */
export type CaseSnapshot = {
  groupId: string;
  groupName: string;
  fy: string;
  upeIso: string;
  jurisdictions: string[];
  entityIds: string[];
  electionsOn: Record<string, boolean>;
  approvedMaps: Record<string, boolean>;
  sbieClaim: Record<string, SbieMode>;
  scenario: ScenarioInput;
  yearRecords: YearRecord[];
  packOverlay: PackOverlay;
  ingestStatus: IngestStatus;
  ruleVersions: RuleVersionRef[];
  /** Where the snapshot came from. Seed-default means no workspace state was pinned. */
  origin: "workspace" | "seed-default" | "gateway";
  takenAt: string;
};

export type CaseVersion = {
  /** Content hash of the snapshot — the identifier a mission, run or approval refers to. */
  hash: string;
  snapshot: CaseSnapshot;
};

/* ------------------------------------------------------------------ */
/* Missions                                                            */
/* ------------------------------------------------------------------ */

export type MissionState =
  | "draft"
  | "running"
  | "paused"
  | "waiting-info"
  | "waiting-approval"
  | "validation-failed"
  | "ready-for-review"
  | "completed"
  | "cancelled";

export const MISSION_STATE_LABEL: Record<MissionState, string> = {
  draft: "Draft",
  running: "Running",
  paused: "Paused",
  "waiting-info": "Waiting for Information",
  "waiting-approval": "Waiting for Approval",
  "validation-failed": "Validation Failed",
  "ready-for-review": "Ready for Review",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type PermittedAction = "read" | "compare-elections" | "run-scenario" | "verify" | "review-compliance" | "propose-change" | "build-pack";

export type MissionObjectives = {
  /** Weights 0–5 the company approved for ranking election alternatives. */
  taxCash: number;
  complianceEffort: number;
  evidenceSupport: number;
  uncertainty: number;
  futureRestriction: number;
};

export type MissionScope = {
  groupId: string;
  fy: string;
  jurisdictions: string[];
  entityIds: string[];
  permitted: PermittedAction[];
  /** Election ids the analyser may evaluate in this release. */
  electionSet: string[];
  objectives: MissionObjectives;
  completion: string[];
};

export type StepId =
  | "context"
  | "readiness"
  | "options"
  | "decision"
  | "scenario"
  | "verify"
  | "compliance"
  | "pack";

export type StepStatus = "pending" | "running" | "done" | "blocked" | "skipped" | "failed";

export type MissionStep = {
  id: StepId;
  title: string;
  tool: ToolName;
  status: StepStatus;
  startedAt?: string;
  finishedAt?: string;
  /** Job id for the tool execution behind this step. */
  jobId?: string;
  summary?: string;
  blocker?: string;
  dependsOn: StepId[];
};

export type Blocker = {
  id: string;
  kind: "information" | "approval" | "validation" | "ownership";
  title: string;
  detail: string;
  href?: string;
  openedAt: string;
  resolvedAt?: string;
  resolution?: string;
};

export type DecisionKind = "election-package" | "correction" | "technical-judgment" | "accept-exception" | "completion";

export type DecisionOption = { id: string; label: string; detail: string; effect?: string };

export type Decision = {
  id: string;
  kind: DecisionKind;
  title: string;
  detail: string;
  options: DecisionOption[];
  /** Case version the decision is presented against. Approval is void if the case changes. */
  caseHash: string;
  evidenceIds: string[];
  requestedBy: AgentClientId;
  requestedAt: string;
  status: "open" | "approved" | "rejected" | "void";
  chosen?: string;
  decidedBy?: string;
  decidedAt?: string;
  note?: string;
  /** Proposal ids this decision authorises. */
  proposalIds: string[];
};

export type ProposalKind = "election" | "sbie" | "mapping" | "exception" | "note";

export type Proposal = {
  id: string;
  kind: ProposalKind;
  /** Deterministic key so a repeated propose_change call cannot create a duplicate. */
  key: string;
  title: string;
  detail: string;
  /** Target in normal mode, e.g. election switch key "OECD_3.2.2@TH" or account "830010". */
  target: string;
  value: string | boolean;
  before: string;
  reason: string;
  caseHash: string;
  proposedBy: AgentClientId;
  proposedAt: string;
  status: "proposed" | "approved" | "rejected" | "applied" | "void";
  appliedAt?: string;
  decisionId?: string;
};

export type EvidenceKind = "source" | "transformation" | "calculation" | "alternative" | "decision" | "review" | "authority" | "tool";

export type EvidenceItem = {
  id: string;
  seq: number;
  kind: EvidenceKind;
  title: string;
  detail: string;
  /** Where in normal mode the record lives. */
  href?: string;
  /** Source documents / rule ids / calculation ids this item cites. */
  refs: string[];
  ruleVersions?: RuleVersionRef[];
  caseHash: string;
  by: AgentClientId | string;
  at: string;
  prevHash: string;
  hash: string;
  /** Finding ids or step ids this evidence supports. */
  supports: string[];
};

export type CalcRunRow = {
  iso: string;
  name: string;
  blendKey: string;
  globeIncome: number;
  coveredTax: number;
  etr: number;
  etrComputed: boolean;
  sbie: number;
  excess: number;
  topUpRate: number;
  additionalCurrentTopUp: number;
  jurisdictionalTopUp: number;
  qdmtt: number;
  iir: number;
  utpr: number;
  exposure: string;
  completeness: number;
};

export type CalcRun = {
  id: string;
  label: string;
  caseHash: string;
  /** Hash of the inputs that drive the engine, for idempotent re-runs. */
  inputsHash: string;
  inputs: {
    electionsOn: Record<string, boolean>;
    approvedMaps: Record<string, boolean>;
    sbieClaim: Record<string, SbieMode>;
    scenario: ScenarioInput;
    ruleVersions: RuleVersionRef[];
    dataVersion: string;
  };
  engine: string;
  rows: CalcRunRow[];
  /** Working-package totals (engine plus election overlay) — what Elections / Year Ledger show. */
  totals: { topUp: number; qdmtt: number; iir: number; utpr: number; globe: number; covered: number };
  /** Engine Core top-up before any elective overlay — what Overview posts. */
  coreTopUp: number;
  ranAt: string;
  by: AgentClientId;
};

export type CheckStatus = "pass" | "fail" | "warn" | "n/a";

export type CheckResult = {
  id: string;
  group: "reproduce" | "inputs" | "adjustments" | "allocation" | "reconciliation" | "treatment" | "elections" | "evidence";
  title: string;
  status: CheckStatus;
  expected: string;
  actual: string;
  rule?: string;
  iso?: string;
  href?: string;
  /** Concrete correction if the check failed. */
  correction?: string;
  severity: "block" | "warn" | "info";
};

export type ComplianceFinding = {
  id: string;
  requirementId: string;
  authority: "OECD" | string;
  instrument: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  applies: boolean;
  status: "met" | "gap" | "judgment" | "n/a";
  title: string;
  finding: string;
  evidence: string[];
  href?: string;
  iso?: string;
  /** Legal-corpus passage ids (lib/legal) the requirement is read from. */
  passages?: string[];
};

export type OptionScore = {
  taxCash: number;
  complianceEffort: number;
  evidenceSupport: number;
  uncertainty: number;
  futureRestriction: number;
  total: number;
};

export type ElectionOption = {
  id: string;
  title: string;
  elections: string[];
  fyTopUp: number;
  fy5: number;
  deltaVsBaseline: number;
  compliance: string;
  audit: string;
  lockYears: number;
  eligible: boolean;
  bookable: boolean;
  score: OptionScore;
  rank: number;
  assumptions: string[];
  dependencies: string[];
  approvals: string[];
  rejectedBecause?: string;
  why: string;
  rows: { iso: string; name: string; etr: number; topUp: number; globeIncome: number }[];
};

export type OptionsAssessment = {
  baselineId: string;
  recommendedId: string;
  options: ElectionOption[];
  objectives: MissionObjectives;
  method: string;
  caseHash: string;
};

export type Attribution = {
  driver: "data" | "mappings" | "adjustments" | "elections" | "assumptions" | "rules" | "unexplained";
  label: string;
  delta: number;
  detail: string;
};

export type RunDiff = {
  fromId: string;
  toId: string;
  totalDelta: number;
  byJurisdiction: { iso: string; name: string; from: number; to: number; delta: number }[];
  attribution: Attribution[];
};

export type PackSection = { id: string; title: string; body: string[]; table?: { head: string[]; rows: string[][] } };

export type AuditPack = {
  id: string;
  missionId: string;
  caseHash: string;
  builtAt: string;
  version: number;
  status: "draft" | "approved" | "superseded";
  sections: PackSection[];
  evidenceIndex: { id: string; kind: EvidenceKind; title: string; hash: string; refs: string[] }[];
  outstanding: string[];
};

export type Job = {
  id: string;
  tool: ToolName;
  missionId?: string;
  status: "queued" | "running" | "done" | "failed";
  startedAt: string;
  finishedAt?: string;
  result?: ToolResult;
  error?: string;
};

export type MissionOwner = {
  client: AgentClientId;
  actor: string;
  since: string;
  /** Lease expiry — another client may take over after it lapses or via handoff. */
  leaseUntil: string;
};

export type HandoffRecord = { from: AgentClientId; to: AgentClientId; at: string; by: string; note: string };

export type MissionRecord = {
  id: string;
  version: number;
  objective: string;
  template: "review-case-r1";
  scope: MissionScope;
  case: CaseVersion;
  state: MissionState;
  owner: MissionOwner;
  createdBy: AgentClientId;
  createdAt: string;
  updatedAt: string;
  steps: MissionStep[];
  blockers: Blocker[];
  decisions: Decision[];
  proposals: Proposal[];
  evidence: EvidenceItem[];
  runs: CalcRun[];
  checks: CheckResult[];
  compliance: ComplianceFinding[];
  options: OptionsAssessment | null;
  packs: AuditPack[];
  jobs: Job[];
  handoffs: HandoffRecord[];
  idempotency: Record<string, string>;
  /** Case hash the last verification passed against; a changed case invalidates it. */
  verifiedAgainst?: string;
  completedAt?: string;
  completionNote?: string;
};

/* ------------------------------------------------------------------ */
/* Tool envelope                                                       */
/* ------------------------------------------------------------------ */

export type ToolName =
  | "get_case_context"
  | "create_mission"
  | "check_data_readiness"
  | "assess_election_options"
  | "run_scenario"
  | "verify_calculation"
  | "review_compliance"
  | "propose_change"
  | "request_approval"
  | "build_audit_pack"
  | "get_mission_status"
  | "search_legal_corpus";

export type ToolResult<T = unknown> = {
  ok: boolean;
  tool: ToolName;
  /** Job id for the execution. Repeated calls with the same inputs return the same job. */
  jobId: string;
  missionId?: string;
  caseHash: string;
  calculationIds: string[];
  ruleVersions: RuleVersionRef[];
  sources: string[];
  unresolved: string[];
  result: T;
  error?: string;
  at: string;
};

export type ActivityEvent = {
  id: string;
  at: string;
  client: AgentClientId;
  actor: string;
  tool?: ToolName;
  missionId?: string;
  action: string;
  ok: boolean;
  detail: string;
};

import type { ProductMode } from "../model";

/**
 * GMT24 AI Co-Pilot — shared intelligence layer.
 *
 * Every feature reads the same context, the same fact registry, the same
 * calculation traces and the same task list, and writes back through the same
 * action gateway and audit log. Nothing here computes a tax number: the engine
 * posts every amount; the Co-Pilot explains, asks, proposes and records.
 */

export type Lang = "en" | "th";

export type FeatureId =
  | "trainer"
  | "specialist"
  | "feedback"
  | "explain"
  | "interviewer"
  | "reviewer"
  | "strategy"
  | "rehearsal"
  | "regwatch"
  | "briefing"
  | "quickscan";

export type UserRole = "preparer" | "reviewer" | "tax-manager" | "admin";

export type Permission =
  | "read"
  | "draft"
  | "save-working"
  | "approve-treatment"
  | "adopt-scenario"
  | "sign"
  | "admin";

export type InteractionMode = "explain" | "show" | "complete";

export type ScreenMeta = {
  key: string;
  module: string;
  title: string;
  purpose: string;
  fields: { term: string; meaning: string }[];
  actions: string[];
  href: string;
};

export type OutstandingWork = {
  xrayOpen: number;
  xrayMaterial: number;
  xrayExposure: number;
  issuesBlock: number;
  issuesWarn: number;
  mapsPending: string[];
  adjUnsigned: string[];
  packPending: number;
  packUnreviewed: number;
  reviewerRan: boolean;
  girValidated: boolean;
  snapshotApproved: boolean;
  yearLocked: boolean;
  ingestReady: boolean;
};

export type WorkContext = {
  groupId: string;
  groupName: string;
  upe: string;
  fy: string;
  mode: ProductMode;
  role: UserRole;
  user: { name: string; title: string };
  permissions: Permission[];
  path: string;
  screen: ScreenMeta | null;
  iso: string | null;
  jurisdiction: string | null;
  entityId: string | null;
  blendKey: string | null;
  calcVersion: string;
  datasetVersion: string;
  rulePack: string;
  appVersion: string;
  outstanding: OutstandingWork;
  lang: Lang;
  /** Key that scopes threads, facts and generated documents. */
  contextKey: string;
};

export type Cite = { label: string; href?: string; authority?: Authority };

export type SectionKind =
  | "conclusion"
  | "authority"
  | "facts"
  | "gaps"
  | "impact"
  | "next"
  | "text"
  | "steps"
  | "list"
  | "table"
  | "warning";

export type Section = {
  kind: SectionKind;
  title?: string;
  text?: string;
  items?: string[];
  rows?: string[][];
  head?: string[];
};

export type ActionKind = "explain" | "navigate" | "draft" | "save" | "approve" | "external";

export type ActionId =
  | "navigate"
  | "open-audit"
  | "approve-map"
  | "set-election"
  | "set-sbie"
  | "set-scenario"
  | "run-reviewer"
  | "validate-gir"
  | "approve-snapshot"
  | "answer-xray"
  | "attach-evidence"
  | "sign-xray"
  | "decide-pack"
  | "admin-review-pack"
  | "create-task"
  | "resolve-task"
  | "dismiss-task"
  | "reopen-task"
  | "assign-task"
  | "save-scenario"
  | "adopt-scenario"
  | "create-ticket"
  | "approve-reg"
  | "reject-reg"
  | "confirm-fact"
  | "download"
  | "onboard-scan"
  | "submit-filing";

export type ProposedAction = {
  id: string;
  actionId: ActionId;
  label: string;
  kind: ActionKind;
  params: Record<string, string | number | boolean>;
  preview: string;
  requires: Permission;
  draft?: boolean;
};

export type Reply = {
  id: string;
  at: string;
  feature: FeatureId;
  title: string;
  sections: Section[];
  cites: Cite[];
  actions: ProposedAction[];
  /** True when every figure in the reply came from the engine trace or the knowledge base. */
  grounded: boolean;
  /** Statements the Co-Pilot could not tie to a source. Shown, never hidden. */
  unsupported: string[];
  /** Calculation version the reply was produced against. */
  version: string;
  lang: Lang;
  chips?: string[];
  latencyMs?: number;
  /** "llm": composed by the configured language model from tool evidence; "rules": deterministic module, no model. */
  engine?: "llm" | "rules";
  model?: string;
  steps?: number;
  toolsUsed?: string[];
  confidence?: "high" | "medium" | "low";
  tokens?: { input: number; output: number };
  /** Set when the model was unavailable; the reply carries the question so it can be retried. */
  failed?: { code: string; detail: string; question: string; feature: FeatureId; attachmentIds?: string[] };
};

export type ThreadMessage =
  | { role: "user"; at: string; text: string; attachments?: string[] }
  | { role: "assistant"; at: string; reply: Reply };

export type Thread = {
  id: string;
  contextKey: string;
  title: string;
  groupId: string;
  fy: string;
  screen: string;
  calcVersion: string;
  createdAt: string;
  updatedAt: string;
  messages: ThreadMessage[];
};

export type Authority = "thai-law" | "oecd-model" | "oecd-commentary" | "oecd-ag" | "internal";

export type KbStatus = "final" | "guidance" | "draft" | "pending-review" | "superseded";

export type KbVersion = { version: string; publishedAt: string; note: string };

export type KbEntry = {
  id: string;
  title: string;
  authority: Authority;
  provision: string;
  passage: string;
  status: KbStatus;
  publishedAt: string;
  effectiveFrom: string;
  applicableFrom: number;
  applicableTo: number | null;
  jurisdictions: string[];
  topics: string[];
  ruleIds: string[];
  version: string;
  versions: KbVersion[];
  url?: string;
  href?: string;
  supersedes?: string;
};

export type FactStatus = "confirmed" | "proposed" | "open" | "expired" | "reassess";

export type Fact = {
  id: string;
  topic: string;
  engine: string;
  questionId: string;
  entityId: string;
  entityCode: string;
  iso: string;
  fy: string;
  statement: string;
  value: string;
  status: FactStatus;
  owner: string;
  confirmedBy: string | null;
  reviewedBy: string | null;
  at: string;
  evidence: string[];
  source: "xray" | "document" | "manual" | "quickscan";
  dependents: string[];
  findingId: string;
  href: string;
  reason?: string;
};

export type TaskSource = "issue" | "xray" | "reviewer" | "regwatch" | "rehearsal" | "manual" | "feedback" | "quickscan";

export type TaskStatus = "open" | "assigned" | "resolved" | "dismissed";

export type Task = {
  id: string;
  source: TaskSource;
  title: string;
  detail: string;
  owner: string;
  due: string | null;
  status: TaskStatus;
  severity: "block" | "warn" | "info";
  href: string;
  iso?: string;
  entityId?: string;
  resolution?: { by: string; at: string; reason: string };
  createdAt: string;
};

export type TaskOverride = {
  status?: TaskStatus;
  owner?: string;
  due?: string | null;
  resolution?: Task["resolution"];
};

export type ManualTask = Omit<Task, "status" | "resolution"> & { status: TaskStatus; resolution?: Task["resolution"] };

export type TicketCategory = "bug" | "usability" | "feature" | "data" | "question";

export type Ticket = {
  id: string;
  ref: string;
  title: string;
  description: string;
  steps: string[];
  category: TicketCategory;
  severity: "low" | "medium" | "high" | "critical";
  status: "new" | "triaged" | "in-progress" | "resolved";
  screen: string;
  appVersion: string;
  calcVersion: string;
  lang: Lang;
  reporter: string;
  createdAt: string;
  contextIncluded: string[];
  contextExcluded: string[];
  duplicateOf: string | null;
  updates: { at: string; note: string }[];
};

export type ScenarioSpec = {
  boiExtend?: boolean;
  payrollTh?: number;
  tpMargin?: number;
  elections?: { key: string; on: boolean }[];
  sbie?: { iso: string; mode: "max" | "partial" | "none" }[];
};

export type ScenarioJurRow = {
  iso: string;
  name: string;
  blendKey: string;
  baseTopUp: number;
  topUp: number;
  baseEtr: number;
  etr: number;
  payer: string;
};

export type SavedScenario = {
  id: string;
  title: string;
  question: string;
  spec: ScenarioSpec;
  assumptions: string[];
  eligibility: { key: string; status: string; reason: string }[];
  ruleVersion: string;
  calcVersion: string;
  fy: string;
  createdAt: string;
  createdBy: string;
  status: "draft" | "proposed" | "adopted" | "rejected";
  baseTopUp: number;
  topUp: number;
  rows: ScenarioJurRow[];
  multiYear: { fy: string; base: number; scenario: number; note: string }[];
  sensitivity: { label: string; topUp: number; delta: number }[];
  compliance: string[];
  adoptedBy?: string;
  adoptedAt?: string;
};

export type RegReviewStatus = "pending" | "approved" | "rejected";

export type AiAuditKind = "answer" | "action" | "draft" | "approval" | "refused";

export type AiAuditRecord = {
  id: string;
  at: string;
  kind: AiAuditKind;
  feature: FeatureId | "gateway";
  actor: string;
  role: UserRole;
  contextKey: string;
  calcVersion: string;
  summary: string;
  sources: string[];
  actionId?: ActionId;
  ok?: boolean;
};

export type QualityRecord = {
  at: string;
  feature: FeatureId;
  grounded: boolean;
  unsupported: number;
  cites: number;
  latencyMs: number;
  tokensEst: number;
  lang: Lang;
};

export type AttachmentPage = { n: number; text: string; rows?: string[][] };

export type Attachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  pages: AttachmentPage[];
  quality: number;
  qualityNote: string;
  extractedAt: string;
  /** Lines that looked like instructions to the assistant — kept out of evidence, listed for transparency. */
  stripped: number;
  contextKey: string;
};

export type ThreadsByKey = Record<string, Thread>;

export type AiState = {
  role: UserRole | null;
  threads: Thread[];
  tickets: Ticket[];
  taskOverrides: Record<string, TaskOverride>;
  manualTasks: ManualTask[];
  scenarios: SavedScenario[];
  manualFacts: Fact[];
  regReview: Record<string, { status: RegReviewStatus; by: string; at: string; note: string }>;
  audit: AiAuditRecord[];
  quality: QualityRecord[];
  attachments: Attachment[];
  guide: { steps: { href: string; target: string; text: string }[]; index: number } | null;
  /** Quick Scan results kept for comparison and onboarding. Shape owned by lib/scan. */
  scans: unknown[];
};

export function emptyAiState(): AiState {
  return {
    role: null,
    threads: [],
    tickets: [],
    taskOverrides: {},
    manualTasks: [],
    scenarios: [],
    manualFacts: [],
    regReview: {},
    audit: [],
    quality: [],
    attachments: [],
    guide: null,
    scans: [],
  };
}

export const FEATURE_META: Record<FeatureId, { name: string; nameTh: string; purpose: string; href: string; release: 1 | 2 | 3 }> = {
  trainer: { name: "AI App Trainer", nameTh: "ผู้ฝึกสอนการใช้งาน", purpose: "Learn GMT24 and complete work correctly — explain the screen, show the path, help finish the step.", href: "/trainer", release: 1 },
  specialist: { name: "AI Pillar Two Specialist", nameTh: "ผู้เชี่ยวชาญ Pillar Two", purpose: "Explain OECD and Thai requirements and apply them to the group's confirmed facts.", href: "/copilot", release: 1 },
  feedback: { name: "AI Feedback Collector", nameTh: "รับข้อเสนอแนะ", purpose: "Turn comments into reproducible tickets with a reference number and visible status.", href: "/feedback", release: 1 },
  explain: { name: "Explain Any Number", nameTh: "อธิบายตัวเลข", purpose: "Formula, inputs, adjustments, rule version and source lineage for every posted amount.", href: "/audit", release: 1 },
  interviewer: { name: "AI X-Ray Interviewer", nameTh: "ผู้สัมภาษณ์ X-Ray", purpose: "Ask for the facts a trial balance cannot establish, record them once, reuse them everywhere.", href: "/xray/confirm", release: 2 },
  reviewer: { name: "AI Calculation Reviewer", nameTh: "ผู้ตรวจสอบการคำนวณ", purpose: "Deterministic checks plus investigation: mapping, reconciliation, treatment, elections, movement, evidence.", href: "/reviewer", release: 2 },
  strategy: { name: "AI Strategy Simulator", nameTh: "จำลองกลยุทธ์", purpose: "Translate a question into explicit assumptions, run the engine, compare, and adopt only through review.", href: "/strategy", release: 3 },
  rehearsal: { name: "AI Audit Rehearsal", nameTh: "ซ้อมรับการตรวจสอบ", purpose: "Internal readiness assessment: questions, evidence challenge, contradictions, remediation.", href: "/rehearsal", release: 3 },
  regwatch: { name: "AI Regulatory Impact Watch", nameTh: "ติดตามกฎเกณฑ์", purpose: "Monitor approved OECD and Thai sources; nothing reaches production rules without expert review.", href: "/regwatch", release: 3 },
  briefing: { name: "AI CFO Briefing", nameTh: "สรุปสำหรับ CFO", purpose: "Exposure, movement, decisions and uncertainty for CFO, tax committee or board.", href: "/briefing", release: 3 },
  quickscan: { name: "AI Pillar Two Quick Scan", nameTh: "สแกนเบื้องต้น Pillar Two", purpose: "Preliminary exposure assessment from public evidence — structure, jurisdictions, incentives, disclosures — with a path into X-Ray and a full assessment.", href: "/quickscan", release: 1 },
};

export const ROLE_LABEL: Record<UserRole, string> = {
  preparer: "Preparer",
  reviewer: "Reviewer",
  "tax-manager": "Tax manager",
  admin: "Administrator",
};

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  preparer: ["read", "draft", "save-working"],
  reviewer: ["read", "draft", "save-working", "approve-treatment", "sign"],
  "tax-manager": ["read", "draft", "save-working", "approve-treatment", "adopt-scenario", "sign"],
  admin: ["read", "draft", "save-working", "approve-treatment", "adopt-scenario", "sign", "admin"],
};

export const APP_VERSION = "GMT24 0.1.0 · rule pack 2026.2";

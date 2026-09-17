/**
 * Pillar Two specialist catalogue. Reusable roles the Mission Director
 * activates for a mission. One role is not one always-on bot: a small mission
 * runs several roles sequentially; a large one creates jurisdiction instances.
 *
 * The director can tailor assignment, tools and reviewer. It cannot invent a
 * role outside this catalogue or grant a permission the catalogue does not list.
 */
import type { AgentScope, PermittedAction, ToolName } from "./types";

export type SpecialistId =
  | "structure"
  | "data"
  | "rules"
  | "globe"
  | "taxes"
  | "harbours"
  | "sbie"
  | "topup"
  | "review"
  | "gir"
  | "evidence"
  | "thai-incentive";

export type WorkMode = "single" | "team" | "swarm";
export type Autonomy = "analyse" | "draft" | "propose";

export const WORK_MODE_LABEL: Record<WorkMode, { label: string; blurb: string }> = {
  single: { label: "Single Bot", blurb: "One agent plans and performs tasks sequentially. Best for one entity, one variance, one workpaper." },
  team: { label: "Team Bot", blurb: "An orchestrator assigns work to a planned specialist team with explicit handoffs and a separate reviewer. Default for substantial tax missions." },
  swarm: { label: "Cooperative Swarm", blurb: "Temporary jurisdiction and issue teams run concurrently. Use when the work divides usefully; not automatically more accurate." },
};

export const AUTONOMY_LABEL: Record<Autonomy, { label: string; blurb: string }> = {
  analyse: { label: "Analyse only", blurb: "Read, compare and report. No drafts, no proposals." },
  draft: { label: "Draft workpapers", blurb: "Prepare workpapers and memos. Changes stay drafts until a person accepts them." },
  propose: { label: "Propose changes", blurb: "May submit mappings, elections and adjustments for review. Approval, filing and payment stay with a person." },
};

export type SpecialistDef = {
  id: SpecialistId;
  role: string;
  family: "group" | "jurisdiction" | "cross" | "review" | "output";
  responsibility: string;
  output: string;
  defaultTools: ToolName[];
  scopes: AgentScope[];
  href: string;
};

export const SPECIALISTS: SpecialistDef[] = [
  { id: "structure", role: "Group Structure & Scope Agent", family: "group", responsibility: "Review ownership, entity classification, group scope and special structures (POPE, MOCE, JV, Investment, Stateless).", output: "Entity map, classification decisions, scope exceptions.", defaultTools: ["get_case_context"], scopes: ["case:read"], href: "/entities" },
  { id: "data", role: "Data & Reconciliation Agent", family: "group", responsibility: "Map and reconcile trial balances, consolidation, tax provisions, CbCR and supporting schedules.", output: "Reconciled dataset and unresolved differences.", defaultTools: ["check_data_readiness"], scopes: ["case:read"], href: "/quality" },
  { id: "rules", role: "Jurisdiction Rules Agent", family: "jurisdiction", responsibility: "Identify applicable local rules, effective dates, guidance and filing requirements.", output: "Sourced jurisdiction rule assessment.", defaultTools: ["review_compliance", "search_legal_corpus"], scopes: ["case:read"], href: "/jurisdictions" },
  { id: "globe", role: "GloBE Income Agent", family: "jurisdiction", responsibility: "Prepare and explain adjustments from financial accounting income to GloBE income.", output: "Adjustment workpapers with source links.", defaultTools: ["get_case_context", "verify_calculation"], scopes: ["case:read"], href: "/globe-income" },
  { id: "taxes", role: "Covered Taxes & Deferred Tax Agent", family: "jurisdiction", responsibility: "Review covered taxes, allocations, deferred-tax treatment and tracking schedules.", output: "Tax bridge and exception report.", defaultTools: ["verify_calculation", "search_legal_corpus"], scopes: ["case:read"], href: "/covered-taxes" },
  { id: "harbours", role: "Safe Harbour & Elections Agent", family: "cross", responsibility: "Test eligibility, compare permitted options, track election history and constraints.", output: "Eligibility matrix and recommendation memo.", defaultTools: ["assess_election_options"], scopes: ["case:read", "scenario:run"], href: "/elections" },
  { id: "sbie", role: "SBIE Agent", family: "jurisdiction", responsibility: "Review eligible payroll and tangible-asset information for the substance-based income exclusion.", output: "Supported SBIE calculation inputs.", defaultTools: ["verify_calculation"], scopes: ["case:read"], href: "/sbie" },
  { id: "topup", role: "Top-up Tax & Allocation Agent", family: "cross", responsibility: "Coordinate jurisdictional calculations and QDMTT, IIR and UTPR treatment.", output: "Calculation and allocation workpapers.", defaultTools: ["run_scenario", "verify_calculation"], scopes: ["case:read", "scenario:run"], href: "/top-up" },
  { id: "review", role: "Independent Review Agent", family: "review", responsibility: "Challenge classifications, assumptions, mappings, calculations and supporting evidence.", output: "Findings with severity and closure status.", defaultTools: ["audit_challenge", "verify_calculation"], scopes: ["case:read"], href: "/agi/calculation" },
  { id: "gir", role: "GIR & Local Reporting Agent", family: "output", responsibility: "Map approved results into required reporting outputs and validate consistency. GIR is tracked separately from domestic returns and payment.", output: "Draft returns, validation results, filing checklist.", defaultTools: ["build_audit_pack", "get_mission_status"], scopes: ["case:read", "pack:build"], href: "/gir" },
  { id: "evidence", role: "Audit Evidence Agent", family: "output", responsibility: "Assemble supporting records and draft responses to review questions. Distinguishes verified, candidate, assumed and missing evidence.", output: "Indexed evidence package and response drafts.", defaultTools: ["build_audit_pack", "recover_evidence"], scopes: ["case:read", "pack:build"], href: "/agi/audit-file" },
  { id: "thai-incentive", role: "Thai tax incentive specialist", family: "jurisdiction", responsibility: "BOI / other Thai incentive certificates: eligibility, remaining cap, interaction with QDMTT and SBTISH.", output: "Incentive memo with certificate links.", defaultTools: ["search_legal_corpus", "assess_election_options"], scopes: ["case:read"], href: "/incentives" },
];

export function specialist(id: SpecialistId): SpecialistDef {
  const s = SPECIALISTS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown specialist ${id}`);
  return s;
}

export type AgentCard = {
  id: string;
  specialistId: SpecialistId;
  role: string;
  /** Instance label, e.g. "Thailand deferred-tax reviewer". */
  title: string;
  scope: { jurisdictions: string[]; entityIds: string[]; fy: string };
  objective: string;
  tools: ToolName[];
  permitted: PermittedAction[];
  inputs: string[];
  output: string;
  dependencies: string[];
  reviewer: string;
  budget: { steps: number; retries: number };
  stop: string[];
  autonomy: Autonomy;
  status: "queued" | "running" | "done" | "blocked" | "retired";
  why: string;
};

export function autonomyAllows(autonomy: Autonomy, action: "draft" | "propose") {
  if (action === "draft") return autonomy === "draft" || autonomy === "propose";
  return autonomy === "propose";
}

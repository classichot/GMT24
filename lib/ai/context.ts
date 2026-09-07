import { ACCOUNTS, ADJUSTMENTS, ADVISOR_USER, ENTITIES, INHOUSE_USER, ISSUES, type ProductMode } from "../model";
import type { PackAmendment, PackChangeRecord } from "../packAmendments";
import type { HardStop } from "../xray";
import { ROLE_PERMISSIONS, APP_VERSION, type Lang, type OutstandingWork, type ScreenMeta, type UserRole, type WorkContext } from "./types";

/**
 * Screen registry — the identifiers the Trainer, Feedback Collector and
 * conversation history key on. Field definitions are the terms a first-time
 * user meets on that screen.
 */
export const SCREENS: ScreenMeta[] = [
  { key: "overview", module: "Overview", title: "Global dashboard", href: "/overview", purpose: "Group jurisdictional top-up, ETR by jurisdiction and where collection lands. The headline is engine-posted; click any amount for the trail.", fields: [
    { term: "Jurisdictional top-up", meaning: "Art. 5.2.3: (15% − ETR) × Excess Profit + Additional Current Top-up Tax − QDMTT credit." },
    { term: "Low-ETR jurisdiction", meaning: "Jurisdictional ETR below the 15% Minimum Rate." },
    { term: "48 jurisdictions vs 20 blends", meaning: "48 is the group perimeter. 20 is the number of jurisdictional blends that carry financial data and are calculated." },
  ], actions: ["Open ETR map", "Open Top-up", "Ask GMT24 about any number"] },
  { key: "data", module: "Data", title: "Data Hub", href: "/data", purpose: "Ingest the close pack. Classification runs before mapping; the engine does not calculate until mappings are approved.", fields: [
    { term: "Close pack", meaning: "Entity list, trial balances, consolidation, tax provision, CbCR, payroll, fixed assets, certificates, prior GIR." },
    { term: "Classified", meaning: "The classifier has typed the file (TB, CbCR, payroll…) and queued it for mapping." },
  ], actions: ["Load demo pack", "Drop files", "Reset ingest"] },
  { key: "mapping", module: "Data", title: "Account mapping", href: "/mapping", purpose: "Account → financial category → GloBE rule → posting. Anything under 80% confidence is held for a reviewer.", fields: [
    { term: "Confidence", meaning: "Classifier certainty for the GloBE category. Below 80% requires human approval before lock." },
    { term: "Adjustment", meaning: "The Art. 3.2 delta the mapping will post to GloBE Income." },
  ], actions: ["Approve mapping", "Hold mapping"] },
  { key: "quality", module: "Data", title: "Data quality", href: "/quality", purpose: "Readiness and validation: blocks, warnings and estimates by jurisdiction.", fields: [{ term: "Block", meaning: "The year cannot be locked while this issue is open." }], actions: ["Open issue", "Send data request"] },
  { key: "requests", module: "Data", title: "Data requests", href: "/requests", purpose: "AI Data Gap Hunter drafts requests to the owner of each missing source.", fields: [], actions: ["Send request"] },
  { key: "xray", module: "Assurance", title: "Pillar Two X-Ray", href: "/xray", purpose: "Blind-spot detection between ingestion and the engine. Material items hard-stop final approval until confirmed, supported and reviewed.", fields: [
    { term: "Material / Significant / Observation", meaning: "Only Material findings block approval." },
    { term: "Top-up at risk", meaning: "Widest swing in top-up across the answers the finding could receive." },
    { term: "Confidence", meaning: "100 minus the weighted penalty of open findings in that area." },
  ], actions: ["Open confirmation", "Answer question", "Attach evidence", "Sign as preparer / reviewer"] },
  { key: "xray-confirm", module: "Assurance", title: "Confirmations", href: "/xray/confirm", purpose: "Routed confirmations: answer the conditional questions, attach the required evidence, sign as preparer then reviewer.", fields: [{ term: "Branch", meaning: "The treatment and priced impact of each possible answer." }], actions: ["Answer", "Attach evidence", "Sign"] },
  { key: "scope", module: "Pillar Two", title: "Scope", href: "/scope", purpose: "Art. 1.1 EUR 750m two-of-four test in group presentation currency.", fields: [{ term: "Two-of-four", meaning: "Consolidated revenue ≥ EUR 750m in at least two of the four preceding Fiscal Years." }], actions: [] },
  { key: "safe-harbours", module: "Pillar Two", title: "Safe harbours", href: "/safe-harbours", purpose: "Transitional CbCR, QDMTT, SBTISH and Side-by-Side tests per jurisdiction. Once out, always out for TCSH.", fields: [{ term: "Simplified ETR", meaning: "CbCR tax ÷ CbCR profit; 17% threshold for FY2026 and FY2027." }], actions: ["Elect on the GIR"] },
  { key: "globe-income", module: "Pillar Two", title: "GloBE income", href: "/globe-income", purpose: "FANIL → Art. 3.2 adjustments → GloBE Income or Loss per entity.", fields: [{ term: "FANIL", meaning: "Financial Accounting Net Income or Loss before consolidation adjustments." }], actions: ["Open adjustment", "Sign adjustment"] },
  { key: "covered-taxes", module: "Pillar Two", title: "Covered taxes", href: "/covered-taxes", purpose: "Current + deferred (recast at 15%) + other covered − non-covered → Adjusted Covered Taxes.", fields: [{ term: "Recast", meaning: "Art. 4.4.1: deferred tax counted at the lower of the applicable rate and 15%." }], actions: [] },
  { key: "deferred-tax", module: "Pillar Two", title: "Deferred tax", href: "/deferred-tax", purpose: "Attribute-level ledger, 15% recast and the five-year DTL recapture clock.", fields: [{ term: "Recapture", meaning: "Art. 4.4.4: a non-excepted DTL not reversed by the fifth subsequent year reopens the origin-year ETR." }], actions: [] },
  { key: "etr", module: "Pillar Two", title: "ETR", href: "/etr", purpose: "Adjusted Covered Taxes ÷ Net GloBE Income by jurisdictional blend.", fields: [{ term: "ENTE", meaning: "Excess Negative Tax Expense: negative covered taxes on positive income are excluded and carried forward; Top-up % stays at 15%." }], actions: [] },
  { key: "sbie", module: "Pillar Two", title: "SBIE", href: "/sbie", purpose: "Payroll 9.4% and tangible-asset 7.4% carve-outs for FY2026; claim maximum, partial or none.", fields: [{ term: "Eligible payroll", meaning: "Cost of employees and independent contractors working in the jurisdiction." }], actions: ["Set SBIE claim"] },
  { key: "top-up", module: "Pillar Two", title: "Top-up tax", href: "/top-up", purpose: "Top-up % × Excess Profit + ACTTT − QDMTT, by blend.", fields: [{ term: "ACTTT", meaning: "Additional Current Top-up Tax — Art. 4.1.5 negative tax in a loss year, recapture and ETR recalculations." }], actions: [] },
  { key: "allocation", module: "Pillar Two", title: "QDMTT / IIR / UTPR", href: "/allocation", purpose: "Charging order: QDMTT first, then IIR at the POPE or UPE, then UTPR by employees and assets.", fields: [], actions: [] },
  { key: "elections", module: "Elections", title: "Election engine", href: "/elections", purpose: "GloBE elections and safe harbours at their legal scope, with five-year locks and GIR section D.", fields: [{ term: "Five-year lock", meaning: "Cannot be revoked until the fifth year after the election year." }], actions: ["Toggle election", "Reset to Core"] },
  { key: "optimize", module: "Elections", title: "Optimize GloBE", href: "/optimize", purpose: "Ranks election packages by FY top-up, five-year cost, compliance and audit profile.", fields: [], actions: [] },
  { key: "years", module: "Elections", title: "Year record", href: "/years", purpose: "Lock the Fiscal Year, open the next, compare prior lock vs working package.", fields: [], actions: ["Lock year", "Open next year"] },
  { key: "gir", module: "Compliance", title: "GIR", href: "/gir", purpose: "GloBE Information Return sections A–E, XML preflight and export.", fields: [{ term: "Preflight", meaning: "GMT24 population and reconciliation checks. Official XSD validation is a filing-gate step." }], actions: ["Validate XML", "Export"] },
  { key: "issues", module: "Review", title: "Issues", href: "/issues", purpose: "Open issues and second-level reviewer findings.", fields: [], actions: ["Re-run reviewer"] },
  { key: "approvals", module: "Review", title: "Approvals", href: "/approvals", purpose: "Preparer / reviewer gates and the snapshot lock. Blocked while X-Ray has unresolved material items.", fields: [{ term: "Snapshot", meaning: "The calculation version being signed — not the GIR XML." }], actions: ["Approve snapshot", "Return to preparer"] },
  { key: "jurisdictions", module: "Intelligence", title: "Jurisdiction packs", href: "/jurisdictions", purpose: "OECD Central Record scan → AI proposals → reviewer decision → administrator review of the change record.", fields: [], actions: ["Scan OECD Record", "Accept / reject amendment", "Administrator review"] },
  { key: "copilot", module: "AI Co-Pilot", title: "Co-Pilot hub", href: "/copilot", purpose: "Ten connected features on one context, one fact registry and one audit log.", fields: [], actions: [] },
  { key: "trainer", module: "AI Co-Pilot", title: "App Trainer", href: "/trainer", purpose: "Role-specific onboarding, walkthroughs, error diagnosis and next-step guidance.", fields: [], actions: [] },
  { key: "reviewer", module: "AI Co-Pilot", title: "Calculation Reviewer", href: "/reviewer", purpose: "Deterministic checks and suspected issues with a resolution workflow.", fields: [], actions: ["Assign", "Resolve", "Dismiss with reason", "Reopen"] },
  { key: "strategy", module: "AI Co-Pilot", title: "Strategy Simulator", href: "/strategy", purpose: "Natural-language scenarios run through the engine without touching the approved calculation.", fields: [], actions: ["Save scenario", "Adopt through review"] },
  { key: "rehearsal", module: "AI Co-Pilot", title: "Audit Rehearsal", href: "/rehearsal", purpose: "Internal readiness assessment — not a prediction of RD acceptance.", fields: [], actions: ["Create remediation task", "Download package"] },
  { key: "regwatch", module: "AI Co-Pilot", title: "Regulatory Impact Watch", href: "/regwatch", purpose: "Monitored sources, expert review queue, applicability mapping, reassessment tasks.", fields: [], actions: ["Approve guidance", "Reject", "Create reassessment tasks"] },
  { key: "briefing", module: "AI Co-Pilot", title: "CFO Briefing", href: "/briefing", purpose: "Exposure, movement, decisions and uncertainty for management.", fields: [], actions: ["Download memo", "Download slides"] },
  { key: "feedback", module: "AI Co-Pilot", title: "Feedback", href: "/feedback", purpose: "Tickets with reference numbers, status and the aggregated product report.", fields: [], actions: [] },
  { key: "tasks", module: "AI Co-Pilot", title: "Tasks", href: "/tasks", purpose: "One list from every source: issues, X-Ray, reviewer, regulatory, rehearsal, Quick Scan and manual tasks.", fields: [], actions: ["Assign", "Resolve", "Dismiss with reason"] },
  { key: "quickscan", module: "AI Co-Pilot", title: "Quick Scan", href: "/quickscan", purpose: "Preliminary Pillar Two exposure assessment from public evidence: structure, jurisdictions, incentives, disclosures — with review priority, evidence strength and coverage shown separately.", fields: [{ term: "Review priority", meaning: "High / Medium / Low / Undetermined — how urgently the jurisdiction needs investigation. Undetermined means the sources do not support a rating." }, { term: "Evidence strength", meaning: "Strong / Moderate / Limited — how much the disclosures actually support the finding." }], actions: ["Explain this flag", "What would change this assessment?", "Answer follow-up", "Correct structure", "Compare periods", "Create workspace"] },
  { key: "thailand", module: "Thailand", title: "Jurisdiction pack", href: "/thailand", purpose: "TH-PACK-2567 overlay: situs, SBIE No. 4, BOT FX, liability ordering, filing clocks.", fields: [], actions: [] },
  { key: "thailand-boi", module: "Thailand", title: "BOI Optimizer", href: "/thailand/boi", purpose: "Keep holiday vs convert to 10% vs QRTC vs 20% baseline on a 10-year NPV.", fields: [], actions: [] },
  { key: "evidence-history", module: "Review", title: "Evidence history", href: "/evidence-history", purpose: "Hash-chained chronicle: docs, changes, calcs, actions, comments.", fields: [], actions: [] },
  { key: "audit", module: "Review", title: "Audit trail", href: "/audit", purpose: "Amount → rule → entity → account → source file.", fields: [], actions: ["Explain this number"] },
];

export function screenFor(path: string): ScreenMeta | null {
  const clean = path.split("?")[0].replace(/\/$/, "") || "/";
  const exact = SCREENS.find((s) => s.href === clean);
  if (exact) return exact;
  return SCREENS.filter((s) => clean.startsWith(s.href + "/")).sort((a, b) => b.href.length - a.href.length)[0] ?? null;
}

export function defaultRole(mode: ProductMode): UserRole {
  return mode === "advisor" ? "reviewer" : "tax-manager";
}

export type ContextInput = {
  groupId: string;
  groupName: string;
  upe: string;
  fy: string;
  mode: ProductMode;
  role: UserRole | null;
  path: string;
  search: URLSearchParams | null;
  lang: Lang;
  workflow: { girValidated: boolean; girExported: boolean; snapshotApproved: boolean; reviewerRan: boolean };
  approvedMaps: Record<string, boolean>;
  yearLocked: boolean;
  ingestReady: boolean;
  stop: HardStop;
  packAmendments: PackAmendment[];
  packChanges: PackChangeRecord[];
  snapshot: string;
};

/**
 * Context service. One object, rebuilt on every interaction, supplied to every
 * feature: who is asking, in which group and year, on which screen, against
 * which calculation version, with what still outstanding.
 */
export function buildContext(i: ContextInput): WorkContext {
  const role = i.role ?? defaultRole(i.mode);
  const user = i.mode === "advisor" ? ADVISOR_USER : INHOUSE_USER;
  const screen = screenFor(i.path);
  const iso = i.search?.get("iso") ?? null;
  const entityId = i.search?.get("entity") ?? null;
  const blendKey = i.search?.get("blend") ?? null;
  const ent = entityId ? ENTITIES.find((e) => e.id === entityId) : null;
  const jur = ent?.jurisdiction ?? (iso ? ENTITIES.find((e) => e.iso === iso)?.jurisdiction ?? iso : null);
  const mapsPending = ACCOUNTS.filter((a) => !a.approved && !i.approvedMaps[a.account]).map((a) => a.account);
  const adjUnsigned = ADJUSTMENTS.filter((a) => !a.reviewer).map((a) => a.id);
  const outstanding: OutstandingWork = {
    xrayOpen: i.stop.open,
    xrayMaterial: i.stop.reasons.length,
    xrayExposure: i.stop.exposure,
    issuesBlock: ISSUES.filter((x) => x.severity === "block").length,
    issuesWarn: ISSUES.filter((x) => x.severity === "warn").length,
    mapsPending,
    adjUnsigned,
    packPending: i.packAmendments.filter((a) => a.status === "proposed" && !a.guard).length,
    packUnreviewed: i.packChanges.filter((c) => !c.adminReviewed).length,
    reviewerRan: i.workflow.reviewerRan,
    girValidated: i.workflow.girValidated,
    snapshotApproved: i.workflow.snapshotApproved,
    yearLocked: i.yearLocked,
    ingestReady: i.ingestReady,
  };
  const overlayN = i.packAmendments.filter((a) => a.status === "accepted").length;
  const calcVersion = `GMT24-CALC 2026.2 · ${i.snapshot}${overlayN ? ` · +${overlayN} pack amendment${overlayN === 1 ? "" : "s"}` : ""}`;
  return {
    groupId: i.groupId,
    groupName: i.groupName,
    upe: i.upe,
    fy: i.fy,
    mode: i.mode,
    role,
    user: { name: user.name, title: user.role },
    permissions: ROLE_PERMISSIONS[role],
    path: i.path,
    screen,
    iso: iso ?? ent?.iso ?? null,
    jurisdiction: jur,
    entityId: ent?.id ?? null,
    blendKey,
    calcVersion,
    datasetVersion: i.ingestReady ? `${i.fy} close pack · map v6` : "No close pack posted",
    rulePack: "Rulebook 2026.2",
    appVersion: APP_VERSION,
    outstanding,
    lang: i.lang,
    contextKey: `${i.groupId}|${i.fy}|${screen?.key ?? "general"}`,
  };
}

export function can(ctx: WorkContext, p: import("./types").Permission) {
  return ctx.permissions.includes(p);
}

export function contextLine(ctx: WorkContext) {
  const parts = [ctx.groupName, ctx.fy, ctx.screen?.title ?? "General"];
  if (ctx.jurisdiction) parts.push(ctx.jurisdiction);
  if (ctx.entityId) parts.push(ctx.entityId);
  return parts.join(" · ");
}

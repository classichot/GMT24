/**
 * GMT24 AGI Mission Catalog.
 *
 * GMT24's AGI mode organises work as missions around four outcomes:
 *   1. Find the best Pillar Two options and elections
 *   2. Calculate accurately
 *   3. Complete compliance and filing
 *   4. Maintain audit readiness and evidence
 *
 * Master Outcome Missions are what users see first; the AGI orchestrates the
 * underlying specialist missions automatically. No mission lets an LLM post a
 * Pillar Two number — the deterministic engine calculates, the AGI plans,
 * extracts, explains and drafts. Every mission records the rulebook,
 * jurisdiction-law and GIR-schema versions it ran against, because OECD guidance
 * and the GIR structure keep changing (2026 Consolidated Commentary, Sept 2026
 * GIR update).
 *
 * This module is pure data + selectors (no "use client") so it can be imported
 * from both server and client components.
 */

export type AgiMode = "single" | "team" | "swarm";

/** The four outcomes the whole catalog is organised around. */
export type OutcomeId = "options" | "calculate" | "comply" | "assure";

export type Outcome = {
  id: OutcomeId;
  n: number;
  title: string;
  short: string;
  blurb: string;
};

export const OUTCOMES: Outcome[] = [
  {
    id: "options",
    n: 1,
    title: "Find the best options and elections",
    short: "Best options",
    blurb:
      "Detect every legally available election, safe harbour and treatment at the correct OECD scope, then rank the most defensible combination on tax, compliance and audit risk.",
  },
  {
    id: "calculate",
    n: 2,
    title: "Calculate accurately",
    short: "Calculate",
    blurb:
      "From source data to a reproducible GloBE, ETR and top-up tax calculation — deterministic, rule-versioned and traceable to the ledger.",
  },
  {
    id: "comply",
    n: 3,
    title: "Complete compliance and filing",
    short: "Comply & file",
    blurb:
      "Prepare the GIR dataset and XML, local returns, notifications and approvals — external submission always requires an authorised signatory.",
  },
  {
    id: "assure",
    n: 4,
    title: "Maintain audit readiness and evidence",
    short: "Audit-ready",
    blurb:
      "Keep an evidence room, position papers and a calculation-to-source trail so any number can be explained and any inquiry answered.",
  },
];

export const OUTCOME_BY_ID: Record<OutcomeId, Outcome> = Object.fromEntries(
  OUTCOMES.map((o) => [o.id, o]),
) as Record<OutcomeId, Outcome>;

/** Governance versions stamped on every mission card. */
export const MISSION_GOVERNANCE = {
  rulebook: "Rulebook 2026.2 · OECD Consolidated Commentary 2026",
  localLaw: "Jurisdiction packs 2026.2",
  girSchema: "GIR XML v1.0 · September 2026 update",
} as const;

export const AGI_MODE_META: Record<AgiMode, { label: string; blurb: string }> = {
  single: {
    label: "Single",
    blurb: "One focused agent runs the mission end to end.",
  },
  team: {
    label: "Team",
    blurb: "A small team of specialist agents collaborates under one lead agent.",
  },
  swarm: {
    label: "Swarm",
    blurb:
      "Many specialist agents run in parallel across entities and jurisdictions, reconciled into one result.",
  },
};

/** Final-status lifecycle every mission card moves through. */
export const MISSION_LIFECYCLE = [
  "Draft",
  "Reviewed",
  "Approved",
  "Filed",
  "Locked",
] as const;
export type MissionStatus = (typeof MISSION_LIFECYCLE)[number];

export type MissionCategory = {
  id: string;
  section: number;
  code: string;
  title: string;
  outcome: OutcomeId;
  /** Default AGI mode for specialist missions in this category. */
  defaultMode: AgiMode;
  blurb: string;
  /** True for the sixteen Master Outcome Missions users see first. */
  master?: boolean;
};

export const CATEGORIES: MissionCategory[] = [
  { id: "master", section: 1, code: "OUT", title: "Master Outcome Missions", outcome: "calculate", defaultMode: "team", master: true, blurb: "The missions users see first. GMT24 orchestrates the underlying specialist missions automatically." },
  { id: "quickscan", section: 2, code: "QS", title: "Quick Scan & Onboarding", outcome: "calculate", defaultMode: "team", blurb: "Scan a group, test preliminary scope and build the first exposure heatmap. Results separate confirmed facts, AI-extracted facts, assumptions, missing information and preliminary indicators." },
  { id: "data", section: 3, code: "DATA", title: "Data Intake & Readiness", outcome: "calculate", defaultMode: "team", blurb: "Import, map, reconcile and quality-check every source into an evidence-linked, year-end data snapshot." },
  { id: "scope", section: 4, code: "SCOPE", title: "Scope & Group Perimeter", outcome: "calculate", defaultMode: "team", blurb: "Test the threshold, identify the UPE, classify entities and build the entity-by-entity obligation matrix." },
  { id: "income", section: 5, code: "INC", title: "GloBE Income or Loss", outcome: "calculate", defaultMode: "team", blurb: "Build the book-to-GloBE adjustment bridge, entity by entity, to a jurisdictional GloBE income figure." },
  { id: "tax", section: 6, code: "TAX", title: "Covered Tax & Deferred Tax", outcome: "calculate", defaultMode: "team", blurb: "Identify covered taxes, recast deferred tax, monitor five-year recapture and build the Adjusted Covered Taxes bridge." },
  { id: "etr", section: 7, code: "ETR", title: "ETR, SBIE & Top-Up Tax", outcome: "calculate", defaultMode: "swarm", blurb: "Blend jurisdictions, compute ETR and SBIE, and run the QDMTT–IIR–UTPR charging framework." },
  { id: "harbour", section: 8, code: "SH/ELEC", title: "Safe Harbour & Elections", outcome: "options", defaultMode: "team", blurb: "Test every safe harbour, identify and simulate every election, and rank the most defensible combination." },
  { id: "forecast", section: 9, code: "STR", title: "Forecasting & Strategy", outcome: "options", defaultMode: "team", blurb: "Forecast ETR, top-up and cash tax, simulate substance and transactions, and convert the best scenario into an action plan. Optimise compliant choices — do not auto-implement a tax position." },
  { id: "filing", section: 10, code: "FILE", title: "Filing & Compliance", outcome: "comply", defaultMode: "swarm", blurb: "Determine obligations, prepare the GIR and local returns, validate schema, coordinate approvals and lock filed versions. External filing always requires authorised-signatory approval." },
  { id: "audit", section: 11, code: "AUD", title: "Calculation Review & Audit Readiness", outcome: "assure", defaultMode: "swarm", blurb: "Review the calculation, explain any number, rehearse an audit and build the jurisdiction audit-defence pack." },
  { id: "advisor", section: 12, code: "ADV", title: "Advisor Mode", outcome: "comply", defaultMode: "team", blurb: "Onboard clients, standardise data, screen a portfolio, review junior work and deliver branded engagement packages." },
  { id: "rd", section: 13, code: "RD", title: "RD / Tax Administration", outcome: "assure", defaultMode: "swarm", blurb: "Build the national registry, validate filings, reconstruct taxpayers, shadow-calculate, risk-score and run a risk-based audit plan." },
  { id: "reg", section: 14, code: "REG", title: "Regulatory Intelligence", outcome: "assure", defaultMode: "team", blurb: "Monitor rule changes, compare versions, migrate GIR schema, regression-test and recalculate affected scenarios without overwriting filed versions." },
];

export const CATEGORY_BY_ID: Record<string, MissionCategory> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<string, MissionCategory>;

export type Mission = {
  id: string;
  title: string;
  categoryId: string;
  outcome: OutcomeId;
  /** Overrides the category default when set (mainly the master missions). */
  mode?: AgiMode;
  /** Main output for master missions. */
  output?: string;
  /** True for the recommended MVP launch set. */
  mvp?: boolean;
  /** Label when this mission is a headline "wow" mission. */
  wow?: string;
  /** Related GMT24 screen, when one already exists. */
  appHref?: string;
  /** Specialist mission ids a master mission orchestrates. */
  orchestrates?: string[];
  note?: string;
};

const MASTER: Mission[] = [
  { id: "OUT-01", title: "Run Pillar Two Quick Scan", categoryId: "master", outcome: "calculate", mode: "team", mvp: true, appHref: "/quickscan", output: "Preliminary scope, exposure map and missing-data list", orchestrates: ["QS-01", "QS-02", "QS-06", "QS-08"] },
  { id: "OUT-02", title: "Build Group Pillar Two Digital Twin", categoryId: "master", outcome: "calculate", mode: "team", mvp: true, appHref: "/graph", output: "Entity tree, ownership, jurisdictions and tax attributes", orchestrates: ["SCOPE-02", "SCOPE-03", "SCOPE-06", "DATA-05"] },
  { id: "OUT-03", title: "Complete Annual Pillar Two Calculation", categoryId: "master", outcome: "calculate", mode: "swarm", mvp: true, appHref: "/overview", output: "Approved GloBE, ETR and top-up tax calculation", orchestrates: ["INC-12", "TAX-12", "ETR-06", "ETR-11"] },
  { id: "OUT-04", title: "Find My Best Elections", categoryId: "master", outcome: "options", mode: "team", mvp: true, appHref: "/optimize", output: "Ranked elections with tax, compliance and risk impact", orchestrates: ["ELEC-01", "ELEC-02", "ELEC-04", "ELEC-05"] },
  { id: "OUT-05", title: "Run Pre-Close Mistake Prevention", categoryId: "master", outcome: "assure", mode: "team", mvp: true, appHref: "/xray", output: "Potential errors and corrective actions before year-end", orchestrates: ["AUD-01", "AUD-05", "INC-11", "DATA-10"] },
  { id: "OUT-06", title: "Complete Thailand QDMTT", categoryId: "master", outcome: "calculate", mode: "team", mvp: true, appHref: "/thailand", output: "Thai calculation, return data and evidence package", orchestrates: ["ETR-08", "FILE-05", "AUD-11"] },
  { id: "OUT-07", title: "Complete Global GIR Filing", categoryId: "master", outcome: "comply", mode: "swarm", mvp: true, appHref: "/gir", output: "GIR dataset, XML, local filing matrix and approvals", orchestrates: ["FILE-03", "FILE-04", "FILE-07", "FILE-09"] },
  { id: "OUT-08", title: "Forecast Pillar Two Exposure", categoryId: "master", outcome: "options", mode: "team", appHref: "/forecast", output: "Forecast ETR, top-up tax and cash-tax impact", orchestrates: ["STR-01", "STR-02", "STR-09", "STR-10"] },
  { id: "OUT-09", title: "Make the Group Audit-Ready", categoryId: "master", outcome: "assure", mode: "swarm", mvp: true, appHref: "/rehearsal", output: "Evidence room, position papers and audit defence pack", orchestrates: ["AUD-05", "AUD-07", "AUD-08", "AUD-11"] },
  { id: "OUT-10", title: "Respond to Tax Authority Inquiry", categoryId: "master", outcome: "assure", mode: "swarm", appHref: "/audit", output: "Issue analysis, supporting evidence and draft response", orchestrates: ["AUD-02", "AUD-09", "AUD-10"] },
  { id: "OUT-11", title: "Assess M&A or Restructuring Impact", categoryId: "master", outcome: "options", mode: "team", appHref: "/simulator", output: "Before-and-after Pillar Two impact analysis", orchestrates: ["SCOPE-08", "STR-07", "STR-08"] },
  { id: "OUT-12", title: "Reperform Existing Adviser Calculation", categoryId: "master", outcome: "calculate", mode: "swarm", appHref: "/reviewer", output: "Independent shadow calculation and variance report", orchestrates: ["AUD-03", "AUD-01", "TAX-12"] },
  { id: "OUT-13", title: "Roll Forward to the New Fiscal Year", categoryId: "master", outcome: "options", mode: "team", appHref: "/years", output: "Prior-year facts, elections, recaptures and open items", orchestrates: ["ELEC-07", "TAX-09", "REG-05"] },
  { id: "OUT-14", title: "Prepare CFO and Board Briefing", categoryId: "master", outcome: "comply", mode: "team", appHref: "/briefing", output: "Executive exposure, decisions, deadlines and actions", orchestrates: ["STR-10", "FILE-02"], note: "Runs Single for a quick summary, Team for the full committee pack." },
  { id: "OUT-15", title: "Deliver Pillar Two Engagement", categoryId: "master", outcome: "comply", mode: "swarm", appHref: "/clients", output: "End-to-end adviser-mode engagement and client pack", orchestrates: ["ADV-01", "ADV-08", "ADV-10"] },
  { id: "OUT-16", title: "Perform RD Shadow Audit", categoryId: "master", outcome: "assure", mode: "swarm", appHref: "/reviewer", output: "Filed-versus-reperformed assessment and tax-at-risk", orchestrates: ["RD-05", "RD-06", "RD-08"] },
];

/** Specialist missions grouped by category. Codes match the catalog exactly. */
const SPECIALIST: Mission[] = [
  // 2 — Quick Scan & Onboarding
  { id: "QS-01", categoryId: "quickscan", outcome: "calculate", title: "Scan a group using company name or annual report", appHref: "/quickscan" },
  { id: "QS-02", categoryId: "quickscan", outcome: "calculate", title: "Perform preliminary Pillar Two scope test" },
  { id: "QS-03", categoryId: "quickscan", outcome: "calculate", title: "Extract subsidiaries, ownership and jurisdictions" },
  { id: "QS-04", categoryId: "quickscan", outcome: "calculate", title: "Identify Pillar Two disclosures and reported exposure" },
  { id: "QS-05", categoryId: "quickscan", outcome: "calculate", title: "Detect low-tax, BOI and incentive jurisdictions" },
  { id: "QS-06", categoryId: "quickscan", outcome: "calculate", title: "Produce an initial jurisdiction exposure heatmap", appHref: "/etr-map" },
  { id: "QS-07", categoryId: "quickscan", outcome: "assure", title: "Assess evidence coverage and confidence level" },
  { id: "QS-08", categoryId: "quickscan", outcome: "calculate", title: "Generate the onboarding data-request list", appHref: "/requests" },

  // 3 — Data Intake & Readiness
  { id: "DATA-01", categoryId: "data", outcome: "calculate", title: "Import and map trial balances", appHref: "/mapping" },
  { id: "DATA-02", categoryId: "data", outcome: "calculate", title: "Import consolidation and elimination data" },
  { id: "DATA-03", categoryId: "data", outcome: "calculate", title: "Import current and deferred tax provisions" },
  { id: "DATA-04", categoryId: "data", outcome: "calculate", title: "Import CbCR and GIR data" },
  { id: "DATA-05", categoryId: "data", outcome: "calculate", title: "Import legal entity and ownership records" },
  { id: "DATA-06", categoryId: "data", outcome: "calculate", title: "Import payroll and tangible-asset registers" },
  { id: "DATA-07", categoryId: "data", outcome: "calculate", title: "Import BOI and other tax-incentive information", appHref: "/incentives" },
  { id: "DATA-08", categoryId: "data", outcome: "calculate", title: "Map source fields to the GMT24 canonical data model", appHref: "/mapping" },
  { id: "DATA-09", categoryId: "data", outcome: "calculate", title: "Reconcile TB, consolidation, tax provision and CbCR" },
  { id: "DATA-10", categoryId: "data", outcome: "calculate", title: "Run data completeness and quality diagnostics", mvp: true, appHref: "/quality" },
  { id: "DATA-11", categoryId: "data", outcome: "assure", title: "Identify duplicate, inconsistent or stale records" },
  { id: "DATA-12", categoryId: "data", outcome: "assure", title: "Build an evidence-linked year-end data snapshot", appHref: "/evidence" },

  // 4 — Scope & Group Perimeter
  { id: "SCOPE-01", categoryId: "scope", outcome: "calculate", title: "Test the consolidated revenue threshold", mvp: true, appHref: "/scope" },
  { id: "SCOPE-02", categoryId: "scope", outcome: "calculate", title: "Identify the UPE and group structure", appHref: "/group" },
  { id: "SCOPE-03", categoryId: "scope", outcome: "calculate", title: "Classify Constituent Entities and Excluded Entities", appHref: "/entities" },
  { id: "SCOPE-04", categoryId: "scope", outcome: "calculate", title: "Classify PEs, JVs, JV subsidiaries and stateless entities", appHref: "/entities" },
  { id: "SCOPE-05", categoryId: "scope", outcome: "calculate", title: "Determine jurisdiction and tax residence" },
  { id: "SCOPE-06", categoryId: "scope", outcome: "calculate", title: "Calculate ownership and allocable interests", appHref: "/graph" },
  { id: "SCOPE-07", categoryId: "scope", outcome: "calculate", title: "Assess POPE, MME and Investment Entity treatment" },
  { id: "SCOPE-08", categoryId: "scope", outcome: "options", title: "Analyze acquisitions, disposals and reorganizations" },
  { id: "SCOPE-09", categoryId: "scope", outcome: "assure", title: "Run Perimeter Ghost Hunter for missing entities" },
  { id: "SCOPE-10", categoryId: "scope", outcome: "comply", title: "Generate the entity-by-entity obligation matrix", appHref: "/filings" },

  // 5 — GloBE Income or Loss
  { id: "INC-01", categoryId: "income", outcome: "calculate", title: "Determine Financial Accounting Net Income or Loss", appHref: "/fx" },
  { id: "INC-02", categoryId: "income", outcome: "calculate", title: "Build the book-to-GloBE adjustment bridge", appHref: "/globe-income" },
  { id: "INC-03", categoryId: "income", outcome: "calculate", title: "Analyze dividends and equity gains or losses" },
  { id: "INC-04", categoryId: "income", outcome: "calculate", title: "Allocate income and expenses to PEs" },
  { id: "INC-05", categoryId: "income", outcome: "calculate", title: "Review intragroup transactions and transfer-pricing adjustments" },
  { id: "INC-06", categoryId: "income", outcome: "calculate", title: "Analyze stock-based compensation and pension adjustments" },
  { id: "INC-07", categoryId: "income", outcome: "calculate", title: "Analyze foreign-exchange and asymmetric currency items" },
  { id: "INC-08", categoryId: "income", outcome: "calculate", title: "Process prior-period errors and accounting-policy changes" },
  { id: "INC-09", categoryId: "income", outcome: "calculate", title: "Analyze restructurings and intragroup asset transfers" },
  { id: "INC-10", categoryId: "income", outcome: "calculate", title: "Determine GloBE loss and carry-forward attributes" },
  { id: "INC-11", categoryId: "income", outcome: "assure", title: "Detect unsupported or high-risk manual adjustments" },
  { id: "INC-12", categoryId: "income", outcome: "calculate", title: "Produce an entity-to-jurisdiction GloBE income bridge", appHref: "/globe-income" },

  // 6 — Covered Tax & Deferred Tax
  { id: "TAX-01", categoryId: "tax", outcome: "calculate", title: "Identify Covered and Non-Covered Taxes", appHref: "/covered-taxes" },
  { id: "TAX-02", categoryId: "tax", outcome: "calculate", title: "Reconcile tax expense to tax returns and provision" },
  { id: "TAX-03", categoryId: "tax", outcome: "calculate", title: "Allocate CFC, PE, hybrid and withholding taxes" },
  { id: "TAX-04", categoryId: "tax", outcome: "calculate", title: "Analyze distribution taxes and tax credits" },
  { id: "TAX-05", categoryId: "tax", outcome: "calculate", title: "Classify refundable and non-refundable tax credits" },
  { id: "TAX-06", categoryId: "tax", outcome: "assure", title: "Review uncertain tax positions" },
  { id: "TAX-07", categoryId: "tax", outcome: "calculate", title: "Recast deferred tax items to the applicable GloBE rate", appHref: "/deferred-tax" },
  { id: "TAX-08", categoryId: "tax", outcome: "calculate", title: "Build the DTA and DTL movement ledger", appHref: "/deferred-tax" },
  { id: "TAX-09", categoryId: "tax", outcome: "assure", title: "Run the five-year Deferred Tax Recapture monitor", appHref: "/deferred-tax" },
  { id: "TAX-10", categoryId: "tax", outcome: "assure", title: "Analyze deferred-tax reversals and expiry risk" },
  { id: "TAX-11", categoryId: "tax", outcome: "calculate", title: "Process prior-year and post-filing adjustments" },
  { id: "TAX-12", categoryId: "tax", outcome: "calculate", title: "Produce the Adjusted Covered Taxes bridge", appHref: "/covered-taxes" },
  { id: "TAX-TM", categoryId: "tax", outcome: "assure", mode: "swarm", wow: "Deferred Tax Time Machine", title: "Deferred Tax Time Machine", appHref: "/deferred-tax", note: "Trace every deferred-tax item from origination through utilization, reversal, recapture or expiry." },

  // 7 — ETR, SBIE & Top-Up Tax
  { id: "ETR-01", categoryId: "etr", outcome: "calculate", title: "Perform jurisdictional blending", appHref: "/etr" },
  { id: "ETR-02", categoryId: "etr", outcome: "calculate", title: "Calculate jurisdictional GloBE ETR", appHref: "/etr" },
  { id: "ETR-03", categoryId: "etr", outcome: "calculate", title: "Calculate payroll-based SBIE", appHref: "/sbie" },
  { id: "ETR-04", categoryId: "etr", outcome: "calculate", title: "Calculate tangible-asset SBIE", appHref: "/sbie" },
  { id: "ETR-05", categoryId: "etr", outcome: "calculate", title: "Calculate the top-up tax percentage", appHref: "/top-up" },
  { id: "ETR-06", categoryId: "etr", outcome: "calculate", title: "Calculate jurisdictional top-up tax", appHref: "/top-up" },
  { id: "ETR-07", categoryId: "etr", outcome: "calculate", title: "Allocate top-up tax to Constituent Entities" },
  { id: "ETR-08", categoryId: "etr", outcome: "calculate", title: "Calculate QDMTT exposure", appHref: "/allocation" },
  { id: "ETR-09", categoryId: "etr", outcome: "calculate", title: "Calculate IIR exposure and ownership allocation", appHref: "/allocation" },
  { id: "ETR-10", categoryId: "etr", outcome: "calculate", title: "Calculate UTPR exposure and allocation", appHref: "/allocation" },
  { id: "ETR-11", categoryId: "etr", outcome: "calculate", title: "Apply the QDMTT–IIR–UTPR charging framework", appHref: "/allocation" },
  { id: "ETR-12", categoryId: "etr", outcome: "assure", title: "Reconcile entity, jurisdiction and group totals" },

  // 8 — Safe Harbour & Elections
  { id: "SH-01", categoryId: "harbour", outcome: "options", title: "Test Transitional CbCR Safe Harbour eligibility", appHref: "/safe-harbours" },
  { id: "SH-02", categoryId: "harbour", outcome: "options", title: "Test the de minimis test", appHref: "/safe-harbours" },
  { id: "SH-03", categoryId: "harbour", outcome: "options", title: "Test the simplified ETR test", appHref: "/safe-harbours" },
  { id: "SH-04", categoryId: "harbour", outcome: "options", title: "Test the routine-profits test", appHref: "/safe-harbours" },
  { id: "SH-05", categoryId: "harbour", outcome: "options", title: "Test QDMTT Safe Harbour eligibility", appHref: "/safe-harbours" },
  { id: "SH-06", categoryId: "harbour", outcome: "options", title: "Test UTPR transitional relief" },
  { id: "SH-07", categoryId: "harbour", outcome: "options", title: "Test Side-by-Side and UPE Safe Harbour treatment" },
  { id: "SH-08", categoryId: "harbour", outcome: "assure", title: "Verify qualified status by jurisdiction and fiscal year", appHref: "/jurisdictions" },
  { id: "ELEC-01", categoryId: "harbour", outcome: "options", title: "Identify all available elections", appHref: "/elections" },
  { id: "ELEC-02", categoryId: "harbour", outcome: "options", title: "Simulate each election's multi-year impact", appHref: "/optimize" },
  { id: "ELEC-03", categoryId: "harbour", outcome: "options", title: "Check election validity, scope and continuity" },
  { id: "ELEC-04", categoryId: "harbour", outcome: "options", title: "Rank elections by tax, compliance and audit risk", appHref: "/optimize" },
  { id: "ELEC-05", categoryId: "harbour", outcome: "options", title: "Prepare election recommendation papers" },
  { id: "ELEC-06", categoryId: "harbour", outcome: "options", title: "Obtain reviewer approval and lock the election", appHref: "/approvals" },
  { id: "ELEC-07", categoryId: "harbour", outcome: "options", title: "Maintain the multi-year Election Memory", appHref: "/years" },
  { id: "ELEC-08", categoryId: "harbour", outcome: "options", title: "Alert users before election deadlines", appHref: "/notifications" },
  { id: "ELEC-BON", categoryId: "harbour", outcome: "options", mode: "team", wow: "Best Option Navigator", title: "Best Option Navigator", appHref: "/optimize", note: "Recommend the best defensible combination of elections and treatments, while showing why rejected options are weaker." },

  // 9 — Forecasting & Strategy
  { id: "STR-01", categoryId: "forecast", outcome: "options", title: "Forecast current-year jurisdictional ETR", appHref: "/forecast" },
  { id: "STR-02", categoryId: "forecast", outcome: "options", title: "Forecast top-up tax and cash-tax requirements", appHref: "/forecast" },
  { id: "STR-03", categoryId: "forecast", outcome: "options", title: "Analyze BOI and tax-holiday interaction", appHref: "/thailand/boi" },
  { id: "STR-04", categoryId: "forecast", outcome: "options", title: "Simulate payroll and tangible-asset substance", appHref: "/simulator" },
  { id: "STR-05", categoryId: "forecast", outcome: "options", title: "Simulate dividend and capital transactions" },
  { id: "STR-06", categoryId: "forecast", outcome: "options", title: "Simulate deferred-tax reversals" },
  { id: "STR-07", categoryId: "forecast", outcome: "options", title: "Analyze acquisition or disposal scenarios" },
  { id: "STR-08", categoryId: "forecast", outcome: "options", title: "Compare restructuring alternatives" },
  { id: "STR-09", categoryId: "forecast", outcome: "options", title: "Run sensitivity analysis on assumptions", appHref: "/simulator" },
  { id: "STR-10", categoryId: "forecast", outcome: "options", title: "Convert the selected scenario into an action plan", appHref: "/strategy" },

  // 10 — Filing & Compliance
  { id: "FILE-01", categoryId: "filing", outcome: "comply", title: "Determine filing obligations by jurisdiction", appHref: "/filings" },
  { id: "FILE-02", categoryId: "filing", outcome: "comply", title: "Build the global compliance calendar", appHref: "/filings" },
  { id: "FILE-03", categoryId: "filing", outcome: "comply", title: "Prepare the GloBE Information Return dataset", mvp: true, appHref: "/gir" },
  { id: "FILE-04", categoryId: "filing", outcome: "comply", title: "Generate and validate GIR XML", appHref: "/gir" },
  { id: "FILE-05", categoryId: "filing", outcome: "comply", title: "Prepare Thailand QDMTT data and return package", appHref: "/thailand/filing" },
  { id: "FILE-06", categoryId: "filing", outcome: "comply", title: "Prepare IIR, UTPR and local notifications", appHref: "/notifications" },
  { id: "FILE-07", categoryId: "filing", outcome: "comply", title: "Reconcile GIR, QDMTT and local returns" },
  { id: "FILE-08", categoryId: "filing", outcome: "comply", title: "Run filing-schema and business-rule validation", appHref: "/gir" },
  { id: "FILE-09", categoryId: "filing", outcome: "comply", title: "Coordinate preparer, reviewer and signatory approval", appHref: "/approvals" },
  { id: "FILE-10", categoryId: "filing", outcome: "assure", title: "Generate jurisdiction-specific evidence packs", appHref: "/evidence" },
  { id: "FILE-11", categoryId: "filing", outcome: "comply", title: "Record submission receipts and authority responses", appHref: "/archive" },
  { id: "FILE-12", categoryId: "filing", outcome: "comply", title: "Lock filed versions and manage amendments", appHref: "/archive" },

  // 11 — Calculation Review & Audit Readiness
  { id: "AUD-01", categoryId: "audit", outcome: "assure", title: "Run AI Calculation Reviewer", appHref: "/reviewer" },
  { id: "AUD-02", categoryId: "audit", outcome: "assure", wow: "Explain My Number", mvp: true, title: "Explain any number from source to return", appHref: "/audit" },
  { id: "AUD-03", categoryId: "audit", outcome: "assure", wow: "Reported-vs-Shadow Delta Navigator", title: "Run reported-versus-shadow variance analysis", appHref: "/reviewer" },
  { id: "AUD-04", categoryId: "audit", outcome: "assure", title: "Analyze year-on-year calculation movements", appHref: "/years" },
  { id: "AUD-05", categoryId: "audit", outcome: "assure", title: "Detect missing or contradictory evidence", appHref: "/quality" },
  { id: "AUD-06", categoryId: "audit", outcome: "assure", title: "Review assumptions and unresolved facts", appHref: "/issues" },
  { id: "AUD-07", categoryId: "audit", outcome: "assure", title: "Draft technical position papers" },
  { id: "AUD-08", categoryId: "audit", outcome: "assure", title: "Run an audit rehearsal", appHref: "/rehearsal" },
  { id: "AUD-09", categoryId: "audit", outcome: "assure", title: "Generate likely tax-authority questions", appHref: "/rehearsal" },
  { id: "AUD-10", categoryId: "audit", outcome: "assure", title: "Prepare responses to information requests" },
  { id: "AUD-11", categoryId: "audit", outcome: "assure", wow: "One-Click Audit Defence Pack", title: "Build the jurisdiction audit-defence pack", appHref: "/thailand/audit" },
  { id: "AUD-12", categoryId: "audit", outcome: "assure", title: "Reproduce any historical calculation version", appHref: "/evidence-history" },
  { id: "AUD-EG", categoryId: "audit", outcome: "assure", wow: "Evidence Graph", title: "Evidence Graph", appHref: "/evidence-history", note: "Every calculation node linked to its supporting evidence and source file." },
  { id: "AUD-CH", categoryId: "audit", outcome: "assure", wow: "Audit Coverage Heatmap", title: "Audit Coverage Heatmap", appHref: "/quality", note: "Where evidence is strong, thin or missing across jurisdictions and entities." },

  // 12 — Advisor Mode
  { id: "ADV-01", categoryId: "advisor", outcome: "comply", title: "Onboard a new Pillar Two client", appHref: "/onboard" },
  { id: "ADV-02", categoryId: "advisor", outcome: "comply", title: "Standardize data across multiple clients" },
  { id: "ADV-03", categoryId: "advisor", outcome: "options", title: "Run portfolio-wide exposure screening", appHref: "/clients" },
  { id: "ADV-04", categoryId: "advisor", outcome: "comply", title: "Monitor client filing deadlines", appHref: "/filings" },
  { id: "ADV-05", categoryId: "advisor", outcome: "comply", title: "Allocate work to adviser specialist teams" },
  { id: "ADV-06", categoryId: "advisor", outcome: "assure", title: "Review junior-preparer calculations", appHref: "/reviewer" },
  { id: "ADV-07", categoryId: "advisor", outcome: "comply", title: "Generate client data-request letters", appHref: "/requests" },
  { id: "ADV-08", categoryId: "advisor", outcome: "comply", title: "Prepare adviser-branded calculation reports", appHref: "/briefing" },
  { id: "ADV-09", categoryId: "advisor", outcome: "comply", title: "Manage client questions and open items", appHref: "/tasks" },
  { id: "ADV-10", categoryId: "advisor", outcome: "comply", title: "Deliver and archive the final engagement package", appHref: "/archive" },

  // 13 — RD / Tax Administration
  { id: "RD-01", categoryId: "rd", outcome: "assure", title: "Build and maintain the national MNE registry" },
  { id: "RD-02", categoryId: "rd", outcome: "comply", title: "Receive and validate GIR/XML filings" },
  { id: "RD-03", categoryId: "rd", outcome: "assure", title: "Detect non-filers and missing entities" },
  { id: "RD-04", categoryId: "rd", outcome: "calculate", title: "Reconstruct the taxpayer's group digital twin" },
  { id: "RD-05", categoryId: "rd", outcome: "calculate", title: "Perform One-Click Shadow Calculation" },
  { id: "RD-06", categoryId: "rd", outcome: "assure", title: "Compare reported and independently calculated results" },
  { id: "RD-07", categoryId: "rd", outcome: "assure", title: "Risk-score entities and jurisdictions" },
  { id: "RD-08", categoryId: "rd", outcome: "assure", title: "Estimate potential tax at risk" },
  { id: "RD-09", categoryId: "rd", outcome: "assure", title: "Cross-check BOI and other incentive information" },
  { id: "RD-10", categoryId: "rd", outcome: "assure", title: "Generate targeted information requests" },
  { id: "RD-11", categoryId: "rd", outcome: "assure", title: "Create a risk-based audit plan" },
  { id: "RD-12", categoryId: "rd", outcome: "assure", title: "Analyze taxpayer evidence and explanations" },
  { id: "RD-13", categoryId: "rd", outcome: "assure", title: "Draft findings and assessment calculations" },
  { id: "RD-14", categoryId: "rd", outcome: "assure", title: "Manage objections and appeals" },
  { id: "RD-15", categoryId: "rd", outcome: "comply", title: "Support competent-authority information exchange" },
  { id: "RD-16", categoryId: "rd", outcome: "assure", title: "Produce the national Pillar Two command dashboard" },

  // 14 — Regulatory Intelligence
  { id: "REG-01", categoryId: "reg", outcome: "assure", title: "Monitor OECD and jurisdictional rule changes", appHref: "/regwatch" },
  { id: "REG-02", categoryId: "reg", outcome: "assure", title: "Compare a new rule version against the current rulebook", appHref: "/rulebook" },
  { id: "REG-03", categoryId: "reg", outcome: "assure", title: "Identify entities and calculations affected by a change" },
  { id: "REG-04", categoryId: "reg", outcome: "comply", title: "Migrate GIR data to a new schema", appHref: "/gir" },
  { id: "REG-05", categoryId: "reg", outcome: "assure", title: "Update qualified-status records by jurisdiction and year", appHref: "/jurisdictions" },
  { id: "REG-06", categoryId: "reg", outcome: "assure", title: "Run regression tests before deploying a rule update" },
  { id: "REG-07", categoryId: "reg", outcome: "assure", title: "Recalculate affected scenarios without overwriting filed versions" },
  { id: "REG-08", categoryId: "reg", outcome: "assure", title: "Notify responsible users and assign remediation missions", appHref: "/tasks" },
];

export const MISSIONS: Mission[] = [...MASTER, ...SPECIALIST];

export const MASTER_MISSIONS: Mission[] = MASTER;

export function missionMode(m: Mission): AgiMode {
  return m.mode ?? CATEGORY_BY_ID[m.categoryId]?.defaultMode ?? "team";
}

export function missionById(id: string): Mission | null {
  return MISSIONS.find((m) => m.id === id) ?? null;
}

export function missionsByCategory(categoryId: string): Mission[] {
  return MISSIONS.filter((m) => m.categoryId === categoryId);
}

export function missionsByOutcome(outcome: OutcomeId): Mission[] {
  return MISSIONS.filter((m) => m.outcome === outcome);
}

export const MVP_MISSIONS: Mission[] = MISSIONS.filter((m) => m.mvp);
export const WOW_MISSIONS: Mission[] = MISSIONS.filter((m) => m.wow);

export function outcomeCount(outcome: OutcomeId): number {
  return MISSIONS.filter((m) => m.outcome === outcome).length;
}

/**
 * Deterministic demo governance for a mission card. No randomness — the same
 * mission always renders the same card, so the prototype is reproducible.
 */
export type MissionGovernance = {
  status: MissionStatus;
  risk: "Low" | "Medium" | "High";
  taxImpact: string;
  approver: string;
  agent: string;
  evidenceCoverage: number;
  credits: number;
};

const RISK_BY_OUTCOME: Record<OutcomeId, MissionGovernance["risk"]> = {
  options: "Medium",
  calculate: "Medium",
  comply: "High",
  assure: "Low",
};

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function missionGovernance(m: Mission): MissionGovernance {
  const h = hash(m.id);
  const statuses: MissionStatus[] = m.mvp
    ? ["Approved", "Reviewed", "Filed"]
    : ["Draft", "Reviewed", "Approved"];
  const mode = missionMode(m);
  const agentLead =
    mode === "swarm"
      ? "Swarm orchestrator + specialist agents"
      : mode === "team"
        ? "Lead agent + specialist team"
        : "Specialist agent";
  return {
    status: statuses[h % statuses.length],
    risk: RISK_BY_OUTCOME[m.outcome],
    taxImpact: `$${((h % 900) / 100 + 0.5).toFixed(2)}M est.`,
    approver: m.outcome === "comply" ? "Authorised signatory" : "Reviewer",
    agent: agentLead,
    evidenceCoverage: 60 + (h % 40),
    credits: 3 + (h % 18),
  };
}

/** The governance card fields required for every mission (spec §"Mission Governance"). */
export const MISSION_CARD_FIELDS: string[] = [
  "Group, entity, jurisdiction and fiscal year",
  "Rulebook and local-law version",
  "GIR or filing-schema version",
  "Input sources and evidence coverage",
  "Assigned AI agent or specialist team",
  "Assumptions and unresolved questions",
  "Calculation and validation results",
  "Risk level and estimated tax impact",
  "Human approver",
  "AI usage, mission credits and execution log",
  "Final status: Draft → Reviewed → Approved → Filed → Locked",
];

export const APPROVAL_MODEL: string[] = [
  "AI may automatically extract, reconcile, validate, explain and draft.",
  "A reviewer must approve mappings, treatments, elections, adjustments and issue closure.",
  "An authorised signatory must approve filings, amendments and tax-authority communications.",
];

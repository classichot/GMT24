import { SEEDS, activeSeed } from "./seeds";
import type { GroupSeed, JurisdictionPack } from "./seeds/types";

export type ProductMode = "inhouse" | "advisor";
export type ScopeStatus = "IN SCOPE" | "OUT OF SCOPE" | "REVIEW REQUIRED";
export type EntityType =
  | "UPE"
  | "HoldCo"
  | "CE"
  | "PE"
  | "JV"
  | "JV Sub"
  | "MOCE"
  | "Investment"
  | "Tax-transparent"
  | "Stateless"
  | "Excluded";
export type ShResult = "Pass" | "Fail" | "Review" | "N/A" | "Not tested";
export type Exposure = "Top-up" | "Safe harbour" | "No top-up" | "Review" | "Data gap";
export type Workflow =
  | "Imported"
  | "Mapped"
  | "Validated"
  | "Calculated"
  | "Prepared"
  | "Reviewed"
  | "Approved"
  | "Filed"
  | "Locked";

export type Rule = {
  id: string;
  jurisdiction: string | "OECD";
  ruleType: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  source: string;
  version: string;
  formula: string;
  parameters: Record<string, number | string | boolean>;
  status: "active" | "superseded";
};

export type Entity = {
  id: string;
  code: string;
  name: string;
  jurisdiction: string;
  iso: string;
  type: EntityType;
  parentId: string | null;
  ownership: number;
  gaap: string;
  fx: string;
  acquired: string;
  /** Art. 10.1 — results reported under the equity method in the UPE CFS. With UPE ownership ≥ 50% this is a Joint Venture. */
  equityMethod?: boolean;
  /** FANIL source: UPE consolidation GAAP vs acceptable local standard (Art. 3.1.2 / 3.1.3). */
  gaapBasis?: "upe" | "local";
  /** Local-GAAP FANIL in USD. Used only if Art. 3.1.3 is elected and the EUR 75m / 1m screens pass. */
  fanilLocal?: number;
  excludedReason?: string;
  incentiveIds: string[];
  completeness: number;
  review: Workflow;
  graph: { x: number; y: number };
};

export type Financials = {
  entityId: string;
  revenue: number;
  fanil: number;
  /** FANIL in functional currency. Engine translates at the locked FX table (`lib/fx.ts`). */
  fanilFc?: number;
  currentTax: number;
  deferredTax: number;
  otherCovered: number;
  nonCovered: number;
  payrollEligible: number;
  employees: number;
  tangibleEligible: number;
  cbcrRevenue: number;
  cbcrProfit: number;
  cbcrTax: number;
  priorDta: number;
  priorDtl: number;
};

export type Adjustment = {
  id: string;
  entityId: string;
  category: string;
  original: number;
  amount: number;
  reason: string;
  ruleId: string;
  sourceDoc: string;
  account?: string;
  preparer: string;
  reviewer: string | null;
  status: Workflow;
  article?: string;
};

export type AccountMap = {
  account: string;
  name: string;
  entityId: string;
  financial: string;
  globe: string;
  adjustment?: string;
  coveredTax?: string;
  sbie?: string;
  confidence: number;
  approved: boolean;
  amount: number;
};

export type SourceFile = {
  id: string;
  name: string;
  kind: string;
  entity?: string;
  size: string;
  uploaded: string;
  by: string;
  status: Workflow;
  rows?: number;
};

export type Issue = {
  id: string;
  severity: "block" | "warn" | "info";
  area: string;
  entity?: string;
  jurisdiction?: string;
  title: string;
  detail: string;
  owner: string;
};

export type Incentive = {
  id: string;
  entityId: string;
  name: string;
  type: string;
  start: string;
  end: string;
  rate: string;
  conditions: string;
  sbtishEligible: boolean;
  extractedFrom: string;
};

export type Filing = {
  id: string;
  jurisdiction: string;
  requirement: string;
  deadline: string;
  status: string;
  preparer: string;
  reviewer: string;
  central?: boolean;
  filed?: string;
};

export type Group = {
  id: string;
  name: string;
  upe: string;
  upeIso: string;
  fy: string;
  fyStart: string;
  fyEnd: string;
  currency: "USD";
  revenueHistory: { fy: string; amount: number }[];
  entities: number;
  jurisdictions: number;
  workflow: Workflow;
  advisor?: string;
  custom?: boolean;
  upeTin?: string;
};

export const FIRM = "7-L Advisory";
export const ADVISOR_USER = {
  name: "Alex Rivera",
  role: "Pillar Two Partner",
  initials: "AR",
  email: "a.rivera@7l-advisory.com",
  org: FIRM,
};

export const RULES: Rule[] = [
  {
    id: "OECD-GloBE-15",
    jurisdiction: "OECD",
    ruleType: "minimum-rate",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "GloBE Model Rules Art. 5.1 / Consolidated Commentary 2026",
    version: "2026.1",
    formula: "top_up_rate = max(0, 0.15 - jurisdictional_etr); ENTE floors ETR at 0% when ACT is negative",
    parameters: { minimumRate: 0.15 },
    status: "active",
  },
  {
    id: "OECD-ENTE-521",
    jurisdiction: "OECD",
    ruleType: "covered-tax",
    effectiveFrom: "2023-02-02",
    effectiveTo: null,
    source: "OECD Administrative Guidance Feb 2023 — Excess Negative Tax Expense (Arts. 4.1.5 and 5.2.1)",
    version: "2023.2",
    formula: "if GloBE > 0 and ACT < 0: exclude ACT from ETR (ETR = 0%), Top-up % = 15%, carry |ACT| forward",
    parameters: { minimumRate: 0.15, mandatory: true },
    status: "active",
  },
  {
    id: "OECD-DT-441",
    jurisdiction: "OECD",
    ruleType: "covered-tax",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "GloBE Model Rules Art. 4.4.1 — Total Deferred Tax Adjustment Amount",
    version: "2026.1",
    formula: "recast deferred tax at min(applicableRate, 0.15) when applicableRate > 0.15",
    parameters: { minimumRate: 0.15 },
    status: "active",
  },
  {
    id: "OECD-DT-442",
    jurisdiction: "OECD",
    ruleType: "covered-tax",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "GloBE Model Rules Art. 4.4.2 — adjustments to the Total Deferred Tax Adjustment Amount",
    version: "2026.1",
    formula: "increase TDTA for paid disallowed/unclaimed accruals and for recaptured DTL paid this year",
    parameters: {},
    status: "active",
  },
  {
    id: "OECD-DT-443",
    jurisdiction: "OECD",
    ruleType: "covered-tax",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "GloBE Model Rules Art. 4.4.3 — recast of a DTA recorded below the Minimum Rate if attributable to a GloBE Loss",
    version: "2026.1",
    formula: "DTA recorded below 15% may be recast at 15% where attributable to a GloBE Loss",
    parameters: { minimumRate: 0.15 },
    status: "active",
  },
  {
    id: "OECD-DT-444",
    jurisdiction: "OECD",
    ruleType: "covered-tax",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "GloBE Model Rules Art. 4.4.4 — five-year recapture of non-excepted DTLs",
    version: "2026.1",
    formula: "if non-excepted DTL not reversed by end of 5th subsequent FY, recapture and recompute origin-year ETR",
    parameters: { subsequentYears: 5 },
    status: "active",
  },
  {
    id: "OECD-DT-445",
    jurisdiction: "OECD",
    ruleType: "covered-tax",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "GloBE Model Rules Art. 4.4.5 — Recapture Exception Accruals",
    version: "2026.1",
    formula: "tangible cost recovery, government licence, R&D, decommissioning, FV gains, FX, insurance, reinvested tangible gains, related accounting-principle changes",
    parameters: {},
    status: "active",
  },
  {
    id: "OECD-SCOPE-750",
    jurisdiction: "OECD",
    ruleType: "scope",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "GloBE Model Rules Art. 1.1",
    version: "2026.1",
    formula: "in_scope if 2 of last 4 FYs consolidated revenue >= 750m USD (presentation)",
    parameters: { thresholdEur: 750_000_000, window: 4, hits: 2 },
    status: "active",
  },
  {
    id: "OECD-SBIE-2026",
    jurisdiction: "OECD",
    ruleType: "sbie",
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-12-31",
    source: "GloBE Model Rules Art. 5.3 — transitional rates",
    version: "2026.1",
    formula: "sbie = payrollRate * eligiblePayroll + assetRate * carryingValueTangible",
    parameters: { payrollRate: 0.094, assetRate: 0.074 },
    status: "active",
  },
  {
    id: "OECD-TCSH-2026",
    jurisdiction: "OECD",
    ruleType: "safe-harbour",
    effectiveFrom: "2024-01-01",
    effectiveTo: "2027-12-31",
    source: "Transitional CbCR Safe Harbour — 2026 package extension to FY beginning on or before 31 Dec 2027",
    version: "2026.2",
    formula: "pass if de_minimis OR simplified_etr OR routine_profits",
    parameters: { etr2026: 0.17, etr2027: 0.17, deMinimisRevenue: 10_000_000, deMinimisProfit: 1_000_000 },
    status: "active",
  },
  {
    id: "OECD-SETR-SH",
    jurisdiction: "OECD",
    ruleType: "safe-harbour",
    effectiveFrom: "2028-01-01",
    effectiveTo: null,
    source: "Simplified ETR Safe Harbour — 2026 Side-by-Side package",
    version: "2026.2",
    formula: "simplified_etr test for post-transitional years",
    parameters: {},
    status: "active",
  },
  {
    id: "OECD-SBTISH",
    jurisdiction: "OECD",
    ruleType: "safe-harbour",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    source: "Substance-based Tax Incentive Safe Harbour — 2026 package",
    version: "2026.2",
    formula: "qualifying substance-based incentives may be treated under SBTISH",
    parameters: {},
    status: "active",
  },
  {
    id: "OECD-ELEC-2026",
    jurisdiction: "OECD",
    ruleType: "election",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "GloBE Model Rules Arts. 1.5.3–9.1.3 · Consolidated Commentary 2026 · GIR Jan 2025 / XML · Side-by-Side Package January 2026 · Central Record",
    version: "2026.2",
    formula: "baseline Core GloBE; eligibility by OECD scope; scenario overlay restates GloBE income / SBIE / harbour zero; rank bookable packages; do not elect at one CE where the Rules require all CEs in the jurisdiction",
    parameters: { minimumRate: 0.15, lockYears: 5 },
    status: "active",
  },
  {
    id: "TH-QDMTT-2025",
    jurisdiction: "TH",
    ruleType: "qdmtt",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    source: "Thailand Emergency Decree on Top-up Tax B.E. 2567 · Central Record (transitional qualified)",
    version: "2025.1",
    formula: "qualified QDMTT collects jurisdictional top-up locally",
    parameters: { qualified: true, qdmttSafeHarbour: true, localCurrency: "THB" },
    status: "active",
  },
  {
    id: "TH-PACK-2567",
    jurisdiction: "TH",
    ruleType: "qdmtt",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    source: "Thailand Jurisdiction Pack — Emergency Decree B.E. 2567 + DG Notifications 1–8 + MOF Notification 1. Inherits OECD 2026 Commentary; Thai law overrides where provided.",
    version: "2567.2",
    formula: "Thai QDMTT / IIR / UTPR orchestrator on top of GloBE Core. Not a translation of the OECD engine.",
    parameters: { filingSchema: "pending", calculation: "available" },
    status: "active",
  },
  {
    id: "TH-SBIE-MOF-1",
    jurisdiction: "TH",
    ruleType: "sbie",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    source: "MOF Notification No. 1 — transitional SBIE rates by fiscal-year start date",
    version: "2567.2",
    formula: "payroll and tangible-asset carve-out rates step down to 5%/5% from FY beginning 2033",
    parameters: { fy2026Payroll: 0.094, fy2026Assets: 0.074 },
    status: "active",
  },
  {
    id: "TH-BOI-OPT-2566",
    jurisdiction: "TH",
    ruleType: "incentive",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    source: "BOI Announcement No. 1/2566 · Emergency Decree on Top-up Tax B.E. 2567 · OECD SBTISH 2026. QRTC not enacted.",
    version: "2567.2",
    formula: "net retained = 20% CIT not paid on promoted GloBE − Thai QDMTT − foreign IIR/UTPR; rank bookable scenarios on 10-year cash-tax NPV; do not book QRTC",
    parameters: { cit: 0.2, minRate: 0.15, reducedRate: 0.1, conversionMultiple: 2, conversionCapYears: 10 },
    status: "active",
  },
  {
    id: "IE-QDMTT-2024",
    jurisdiction: "IE",
    ruleType: "qdmtt",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "Ireland Finance (No.2) Act 2023 · Central Record",
    version: "2024.2",
    formula: "qualified QDMTT",
    parameters: { qualified: true, qdmttSafeHarbour: true, localCurrency: "EUR" },
    status: "active",
  },
  {
    id: "JP-IIR-2024",
    jurisdiction: "JP",
    ruleType: "iir",
    effectiveFrom: "2024-04-01",
    effectiveTo: null,
    source: "Japan 2023 tax reform · IIR · Central Record",
    version: "2024.1",
    formula: "UPE IIR on remaining top-up after QDMTT",
    parameters: { qualified: true },
    status: "active",
  },
  {
    id: "US-SBS-2026",
    jurisdiction: "US",
    ruleType: "side-by-side",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    source: "OECD Side-by-Side package 2026 · Qualified SbS / UTPR SH as applicable",
    version: "2026.2",
    formula: "UPE jurisdiction Side-by-Side / Transitional UTPR Safe Harbour path",
    parameters: { qualifiedSbs: true, utprSafeHarbour: true },
    status: "active",
  },
  {
    id: "OECD-DIV-EXCL",
    jurisdiction: "OECD",
    ruleType: "globe-adjustment",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "GloBE Model Rules Art. 3.2.1(b) excluded dividends",
    version: "2026.1",
    formula: "subtract excluded dividends from FANIL",
    parameters: {},
    status: "active",
  },
  {
    id: "OECD-SHIP-34",
    jurisdiction: "OECD",
    ruleType: "globe-adjustment",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "GloBE Model Rules Art. 3.4 International Shipping Income exclusion · Art. 4.1.3 related Covered Taxes · Art. 5.3 payroll/assets used in excluded shipping",
    version: "2026.1",
    formula: "exclude ISI + min(ancillary, 50% of ISI) from GloBE if Art. 3.4.5 management test passes; strip related Covered Taxes; strip SBIE payroll and tangible assets used in the excluded activity",
    parameters: { ancillaryCap: 0.5 },
    status: "active",
  },
  {
    id: "OECD-UTPR-26",
    jurisdiction: "OECD",
    ruleType: "charging-allocation",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "GloBE Model Rules Art. 2.6 — allocation of Total UTPR Top-up Tax",
    version: "2026.1",
    formula: "UTPR % = 50% × employees share + 50% × tangible-assets share; Investment Entities excluded",
    parameters: { employeeWeight: 0.5, assetWeight: 0.5 },
    status: "active",
  },
  {
    id: "OECD-CT-43",
    jurisdiction: "OECD",
    ruleType: "covered-tax-allocation",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "GloBE Model Rules Arts. 4.3.2–4.3.3 — PE, transparent, CFC, hybrid and distribution tax allocation",
    version: "2026.1",
    formula: "move tax from source CE to income CE; passive CFC/hybrid allocation = lesser of actual tax and minimum-rate top-up on passive income",
    parameters: { minimumRate: 0.15 },
    status: "active",
  },
  {
    id: "OECD-TR-91",
    jurisdiction: "OECD",
    ruleType: "covered-tax",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "GloBE Model Rules Art. 9.1 — Tax Attributes Upon Transition · AG Jan 2025",
    version: "2026.2",
    formula: "9.1.1 take opening DT attributes (≤15%); 9.1.2 strip post-2021-11-30 excluded-item DTAs; 9.1.3 non-inventory transfers use transferor carrying value",
    parameters: { cutoff: "2021-11-30", minRate: 0.15 },
    status: "active",
  },
  {
    id: "OECD-C6-61",
    jurisdiction: "OECD",
    ruleType: "group-change",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "GloBE Model Rules Art. 6.1–6.3 — joining, leaving, reorganisation, Art. 6.3.4 FV alignment",
    version: "2026.2",
    formula: "join: opening CV; leave: exit gain; reorg: no gain if qualifying; 6.3.4 elect FV/tax-basis",
    parameters: {},
    status: "active",
  },
  {
    id: "OECD-IE-75",
    jurisdiction: "OECD",
    ruleType: "special-entity",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "GloBE Model Rules Art. 7.5 / 7.6 — Investment Entity transparency and taxable-distribution",
    version: "2026.2",
    formula: "7.5 move IE FANIL to owners; 7.6 exclude retained IE income from IE ETR",
    parameters: {},
    status: "active",
  },
  {
    id: "OECD-GIR-XML",
    jurisdiction: "OECD",
    ruleType: "filing-schema",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    source: "OECD GIR XML Schema v1.0, urn:oecd:ties:globe:v2; June 2026 first-filing guidance",
    version: "1.0",
    formula: "live snapshot → FilingInfo + GeneralSection + Summary + JurisdictionSection + UTPRAttribution",
    parameters: { namespaceVersion: 2, schemaVersion: "1.0" },
    status: "active",
  },
  {
    id: "OECD-MOCE-513",
    jurisdiction: "OECD",
    ruleType: "entity-test",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "GloBE Model Rules Art. 5.1.3 / 10.1 — Minority-Owned Constituent Entity",
    version: "2026.1",
    formula: "if UPE ownership ≤ 30%: separate ETR (standalone MOCE or MOSG); do not blend with majority CEs in the same jurisdiction",
    parameters: { upeOwnershipMax: 0.3 },
    status: "active",
  },
  {
    id: "OECD-POPE-214",
    jurisdiction: "OECD",
    ruleType: "entity-test",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "GloBE Model Rules Art. 2.1.4 / 2.1.5 / 10.1 — Partially-Owned Parent Entity",
    version: "2026.1",
    formula: "if Parent is not UPE and outsiders hold > 20%: IIR at POPE × Inclusion Ratio, then UPE residual, then UTPR",
    parameters: { outsiderMin: 0.2 },
    status: "active",
  },
  {
    id: "OECD-IR-222",
    jurisdiction: "OECD",
    ruleType: "allocation",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "GloBE Model Rules Art. 2.2.2 — Inclusion Ratio",
    version: "2026.1",
    formula: "parent_iir = ltce_top_up × (GloBE income attributable to Parent Ownership Interests ÷ GloBE income of the LTCE)",
    parameters: {},
    status: "active",
  },
  {
    id: "OECD-JV-64",
    jurisdiction: "OECD",
    ruleType: "entity-test",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    source: "GloBE Model Rules Art. 6.4 — Joint Venture Group",
    version: "2026.1",
    formula: "JV Group treated as a separate MNE for ETR; not blended with majority CEs in the JV jurisdiction",
    parameters: {},
    status: "active",
  },
];

export type { GroupSeed, JurisdictionPack };

/**
 * Portfolio shown in advisor mode. Seeded groups carry a full dataset; the
 * others are illustrative clients whose figures are scaled from the active seed.
 */
export const PLACEHOLDER_GROUPS: Group[] = [
  {
    id: "meridian",
    name: "Meridian Pacific",
    upe: "Meridian Pacific Ltd.",
    upeIso: "SG",
    fy: "FY2026",
    fyStart: "2026-01-01",
    fyEnd: "2026-12-31",
    currency: "USD",
    revenueHistory: [
      { fy: "FY2023", amount: 880_000_000 },
      { fy: "FY2024", amount: 910_000_000 },
      { fy: "FY2025", amount: 940_000_000 },
      { fy: "FY2026", amount: 972_000_000 },
    ],
    entities: 64,
    jurisdictions: 18,
    workflow: "Validated",
    advisor: "7-L Advisory",
  },
  {
    id: "helios",
    name: "Helios Industrials",
    upe: "Helios AG",
    upeIso: "DE",
    fy: "FY2026",
    fyStart: "2026-01-01",
    fyEnd: "2026-12-31",
    currency: "USD",
    revenueHistory: [
      { fy: "FY2023", amount: 2_100_000_000 },
      { fy: "FY2024", amount: 2_240_000_000 },
      { fy: "FY2025", amount: 2_180_000_000 },
      { fy: "FY2026", amount: 2_310_000_000 },
    ],
    entities: 140,
    jurisdictions: 31,
    workflow: "Prepared",
    advisor: "7-L Advisory",
  },
  {
    id: "siam",
    name: "Siam Agro Holdings",
    upe: "Siam Agro PCL",
    upeIso: "TH",
    fy: "FY2026",
    fyStart: "2026-01-01",
    fyEnd: "2026-12-31",
    currency: "USD",
    revenueHistory: [
      { fy: "FY2023", amount: 610_000_000 },
      { fy: "FY2024", amount: 690_000_000 },
      { fy: "FY2025", amount: 740_000_000 },
      { fy: "FY2026", amount: 768_000_000 },
    ],
    entities: 28,
    jurisdictions: 7,
    workflow: "Mapped",
    advisor: "7-L Advisory",
  },
];

export const GROUPS: Group[] = [...Object.values(SEEDS).map((s) => s.group), ...PLACEHOLDER_GROUPS];

/**
 * Live view of the active group's dataset. Reads follow the group selected in
 * the store (`setActiveSeed`), so every module sees the same seed without
 * threading a group id through each call.
 */
export const DATA = {
  get seedId() { return activeSeed().id; },
  get group() { return activeSeed().group; },
  get inhouseUser() { return activeSeed().inhouseUser; },
  get entities(): Entity[] { return activeSeed().entities; },
  get financials(): Financials[] { return activeSeed().financials; },
  get adjustments(): Adjustment[] { return activeSeed().adjustments; },
  get accounts(): AccountMap[] { return activeSeed().accounts; },
  get files(): SourceFile[] { return activeSeed().files; },
  get issues(): Issue[] { return activeSeed().issues; },
  get incentives(): Incentive[] { return activeSeed().incentives; },
  get filings(): Filing[] { return activeSeed().filings; },
  get packs(): JurisdictionPack[] { return activeSeed().packs; },
  get girSections() { return activeSeed().girSections; },
  get activity() { return activeSeed().activity; },
  get forecast() { return activeSeed().forecast; },
  get demo() { return activeSeed().demo; },
};

export const MAP_COORDS: Record<string, { x: number; y: number }> = {
  JP: { x: 88.4, y: 29.9 },
  SG: { x: 78.8, y: 49.3 },
  TH: { x: 77.9, y: 41.2 },
  VN: { x: 80.1, y: 42.2 },
  MY: { x: 78.3, y: 47.7 },
  ID: { x: 81.6, y: 50.4 },
  AE: { x: 65.0, y: 37.0 },
  GB: { x: 49.0, y: 19.2 },
  DE: { x: 52.9, y: 21.6 },
  FR: { x: 50.6, y: 24.3 },
  NL: { x: 51.5, y: 21.0 },
  HU: { x: 55.4, y: 23.8 },
  US: { x: 23.4, y: 29.4 },
  IE: { x: 47.7, y: 20.3 },
  LU: { x: 51.8, y: 22.4 },
  HK: { x: 81.7, y: 38.8 },
  XX: { x: 50, y: 50 },
};

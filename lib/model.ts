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
export const INHOUSE_USER = {
  name: "Mika Sato",
  role: "Group Tax Director",
  initials: "MS",
  email: "m.sato@aetherion.com",
  org: "Aetherion Group",
};
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
    formula: "top_up_rate = max(0, 0.15 - jurisdictional_etr)",
    parameters: { minimumRate: 0.15 },
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

export const GROUPS: Group[] = [
  {
    id: "aetherion",
    name: "Aetherion Group",
    upe: "Nippon Aether Holdings K.K.",
    upeIso: "JP",
    fy: "FY2026",
    fyStart: "2026-04-01",
    fyEnd: "2027-03-31",
    currency: "USD",
    revenueHistory: [
      { fy: "FY2023", amount: 1_420_000_000 },
      { fy: "FY2024", amount: 1_610_000_000 },
      { fy: "FY2025", amount: 1_740_000_000 },
      { fy: "FY2026", amount: 1_820_000_000 },
    ],
    entities: 212,
    jurisdictions: 48,
    workflow: "Calculated",
    advisor: "7-L Advisory",
  },
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

export const ENTITIES: Entity[] = [
  { id: "JP-UPE", code: "JP001", name: "Nippon Aether Holdings K.K.", jurisdiction: "Japan", iso: "JP", type: "UPE", parentId: null, ownership: 100, gaap: "IFRS", fx: "JPY", acquired: "1998-04-01", incentiveIds: [], completeness: 98, review: "Reviewed", graph: { x: 480, y: 36 } },
  { id: "SG-HC", code: "SG010", name: "Aetherion Singapore Pte. Ltd.", jurisdiction: "Singapore", iso: "SG", type: "HoldCo", parentId: "JP-UPE", ownership: 100, gaap: "SFRS(I)", fx: "SGD", acquired: "2009-07-01", incentiveIds: ["SG-DE"], completeness: 94, review: "Calculated", graph: { x: 220, y: 140 } },
  { id: "TH-CE", code: "TH001", name: "Aetherion (Thailand) Ltd.", jurisdiction: "Thailand", iso: "TH", type: "CE", parentId: "SG-HC", ownership: 100, gaap: "TFRS", fx: "THB", acquired: "2012-03-15", gaapBasis: "upe", fanilLocal: 44_410_000, incentiveIds: ["TH-BOI", "TH-BOI-AUTO"], completeness: 96, review: "Prepared", graph: { x: 110, y: 250 } },
  { id: "VN-CE", code: "VN001", name: "Aetherion Vietnam Co., Ltd.", jurisdiction: "Vietnam", iso: "VN", type: "CE", parentId: "SG-HC", ownership: 100, gaap: "VAS/IFRS", fx: "VND", acquired: "2016-09-01", incentiveIds: ["VN-EIT"], completeness: 81, review: "Validated", graph: { x: 250, y: 250 } },
  { id: "MY-CE", code: "MY001", name: "Aetherion Malaysia Sdn. Bhd.", jurisdiction: "Malaysia", iso: "MY", type: "CE", parentId: "SG-HC", ownership: 100, gaap: "MFRS", fx: "MYR", acquired: "2014-01-12", incentiveIds: [], completeness: 91, review: "Calculated", graph: { x: 180, y: 340 } },
  { id: "ID-CE", code: "ID001", name: "PT Aetherion Indonesia", jurisdiction: "Indonesia", iso: "ID", type: "CE", parentId: "SG-HC", ownership: 99, gaap: "PSAK", fx: "IDR", acquired: "2015-06-20", incentiveIds: [], completeness: 88, review: "Calculated", graph: { x: 320, y: 340 } },
  { id: "AE-CE", code: "AE001", name: "Aetherion MENA FZ-LLC", jurisdiction: "United Arab Emirates", iso: "AE", type: "CE", parentId: "SG-HC", ownership: 100, gaap: "IFRS", fx: "AED", acquired: "2021-04-01", incentiveIds: ["AE-FZ"], completeness: 79, review: "Mapped", graph: { x: 360, y: 250 } },
  { id: "UK-HC", code: "UK010", name: "Aetherion UK Ltd.", jurisdiction: "United Kingdom", iso: "GB", type: "HoldCo", parentId: "JP-UPE", ownership: 78, gaap: "UK IFRS", fx: "GBP", acquired: "2004-11-01", incentiveIds: [], completeness: 97, review: "Reviewed", graph: { x: 620, y: 140 } },
  { id: "DE-CE", code: "DE001", name: "Aetherion Germany GmbH", jurisdiction: "Germany", iso: "DE", type: "CE", parentId: "UK-HC", ownership: 100, gaap: "HGB/IFRS", fx: "EUR", acquired: "2006-02-01", incentiveIds: [], completeness: 99, review: "Approved", graph: { x: 540, y: 250 } },
  { id: "FR-CE", code: "FR001", name: "Aetherion France SAS", jurisdiction: "France", iso: "FR", type: "CE", parentId: "UK-HC", ownership: 100, gaap: "ANC/IFRS", fx: "EUR", acquired: "2008-05-01", incentiveIds: [], completeness: 95, review: "Reviewed", graph: { x: 680, y: 250 } },
  { id: "NL-CE", code: "NL001", name: "Aetherion Netherlands B.V.", jurisdiction: "Netherlands", iso: "NL", type: "CE", parentId: "UK-HC", ownership: 100, gaap: "NL IFRS", fx: "EUR", acquired: "2011-08-01", incentiveIds: ["NL-IP"], completeness: 93, review: "Calculated", graph: { x: 610, y: 340 } },
  { id: "HU-CE", code: "HU001", name: "Aetherion Hungary Kft.", jurisdiction: "Hungary", iso: "HU", type: "CE", parentId: "UK-HC", ownership: 100, gaap: "HAS/IFRS", fx: "HUF", acquired: "2018-01-15", incentiveIds: ["HU-DEV"], completeness: 86, review: "Validated", graph: { x: 740, y: 340 } },
  { id: "US-CE", code: "US001", name: "Aetherion Americas Inc.", jurisdiction: "United States", iso: "US", type: "CE", parentId: "JP-UPE", ownership: 100, gaap: "US GAAP", fx: "USD", acquired: "2001-09-01", incentiveIds: [], completeness: 97, review: "Reviewed", graph: { x: 860, y: 140 } },
  { id: "IE-CE", code: "IE001", name: "Aetherion Ireland Ltd.", jurisdiction: "Ireland", iso: "IE", type: "CE", parentId: "JP-UPE", ownership: 100, gaap: "IFRS", fx: "EUR", acquired: "2013-04-01", incentiveIds: ["IE-IP"], completeness: 92, review: "Prepared", graph: { x: 860, y: 250 } },
  { id: "TH-PE", code: "TH-PE1", name: "Aetherion (Thailand) Ltd. — Rayong PE", jurisdiction: "Thailand", iso: "TH", type: "PE", parentId: "TH-CE", ownership: 100, gaap: "TFRS", fx: "THB", acquired: "2019-02-01", incentiveIds: ["TH-BOI"], completeness: 84, review: "Mapped", graph: { x: 40, y: 340 } },
  { id: "SG-JV", code: "SG-JV1", name: "Aetherion-Keppel Logistics JV", jurisdiction: "Singapore", iso: "SG", type: "CE", parentId: "SG-HC", ownership: 50, gaap: "SFRS(I)", fx: "SGD", acquired: "2022-01-01", equityMethod: true, incentiveIds: [], completeness: 72, review: "Imported", graph: { x: 40, y: 180 } },
  { id: "MY-MOCE", code: "MY028", name: "Aetherion Penang Components Sdn. Bhd.", jurisdiction: "Malaysia", iso: "MY", type: "MOCE", parentId: "SG-HC", ownership: 28, gaap: "MFRS", fx: "MYR", acquired: "2023-05-01", incentiveIds: [], completeness: 84, review: "Validated", graph: { x: 80, y: 380 } },
  { id: "MY-MOS-A", code: "MY029", name: "Aetherion Penang Tooling Sdn. Bhd.", jurisdiction: "Malaysia", iso: "MY", type: "CE", parentId: "MY-MOCE", ownership: 100, gaap: "MFRS", fx: "MYR", acquired: "2024-01-01", incentiveIds: [], completeness: 82, review: "Validated", graph: { x: 20, y: 440 } },
  { id: "MY-MOS-B", code: "MY030", name: "Aetherion Penang Services Sdn. Bhd.", jurisdiction: "Malaysia", iso: "MY", type: "CE", parentId: "MY-MOCE", ownership: 80, gaap: "MFRS", fx: "MYR", acquired: "2024-01-01", incentiveIds: [], completeness: 80, review: "Mapped", graph: { x: 120, y: 440 } },
  { id: "SG-IE", code: "SG-IE1", name: "Aetherion Capital Fund Pte. Ltd.", jurisdiction: "Singapore", iso: "SG", type: "Investment", parentId: "SG-HC", ownership: 100, gaap: "SFRS(I)", fx: "SGD", acquired: "2024-06-01", incentiveIds: [], completeness: 88, review: "Mapped", graph: { x: 40, y: 80 } },
  { id: "SG-FT", code: "SG-FT1", name: "Aetherion Asia Flow-Through LP", jurisdiction: "Singapore", iso: "SG", type: "Tax-transparent", parentId: "SG-HC", ownership: 100, gaap: "SFRS(I)", fx: "SGD", acquired: "2025-06-01", incentiveIds: [], completeness: 78, review: "Mapped", graph: { x: 100, y: 40 } },
  { id: "XX-ST", code: "XX-ST1", name: "Aetherion Regional Sales (stateless CE)", jurisdiction: "Stateless", iso: "XX", type: "Stateless", parentId: "JP-UPE", ownership: 100, gaap: "IFRS", fx: "USD", acquired: "2025-01-01", incentiveIds: [], completeness: 70, review: "Imported", graph: { x: 400, y: 90 } },
  { id: "LU-CE", code: "LU001", name: "Aetherion Luxembourg S.à r.l.", jurisdiction: "Luxembourg", iso: "LU", type: "CE", parentId: "UK-HC", ownership: 100, gaap: "Lux GAAP/IFRS", fx: "EUR", acquired: "2020-03-01", incentiveIds: [], completeness: 90, review: "Prepared", graph: { x: 860, y: 340 } },
  { id: "HK-CE", code: "HK001", name: "Aetherion Hong Kong Ltd.", jurisdiction: "Hong Kong", iso: "HK", type: "CE", parentId: "SG-HC", ownership: 100, gaap: "HKFRS", fx: "HKD", acquired: "2017-08-01", incentiveIds: [], completeness: 87, review: "Validated", graph: { x: 140, y: 80 } },
  { id: "SG-SHIP", code: "SG020", name: "Aetherion Marine Pte. Ltd.", jurisdiction: "Singapore", iso: "SG", type: "CE", parentId: "SG-HC", ownership: 100, gaap: "SFRS(I)", fx: "SGD", acquired: "2019-11-01", incentiveIds: [], completeness: 91, review: "Prepared", graph: { x: 300, y: 80 } },
];

export const FINANCIALS: Financials[] = [
  { entityId: "JP-UPE", revenue: 210_000_000, fanil: 148_200_000, fanilFc: 23_297_040_000, currentTax: 36_100_000, deferredTax: 1_400_000, otherCovered: 0, nonCovered: 420_000, payrollEligible: 62_000_000, employees: 1840, tangibleEligible: 84_000_000, cbcrRevenue: 210_400_000, cbcrProfit: 149_000_000, cbcrTax: 36_800_000, priorDta: 4_200_000, priorDtl: 6_100_000 },
  { entityId: "SG-HC", revenue: 18_000_000, fanil: 71_400_000, fanilFc: 96_461_400, currentTax: 10_900_000, deferredTax: 380_000, otherCovered: 0, nonCovered: 90_000, payrollEligible: 9_400_000, employees: 62, tangibleEligible: 2_100_000, cbcrRevenue: 74_000_000, cbcrProfit: 63_800_000, cbcrTax: 10_560_000, priorDta: 210_000, priorDtl: 640_000 },
  { entityId: "TH-CE", revenue: 96_400_000, fanil: 44_820_000, fanilFc: 1_723_329_000, currentTax: 4_120_000, deferredTax: 610_000, otherCovered: 0, nonCovered: 80_000, payrollEligible: 31_800_000, employees: 1240, tangibleEligible: 42_600_000, cbcrRevenue: 97_100_000, cbcrProfit: 45_200_000, cbcrTax: 4_280_000, priorDta: 1_120_000, priorDtl: 880_000 },
  { entityId: "VN-CE", revenue: 54_000_000, fanil: 31_250_000, fanilFc: 795_312_500_000, currentTax: 3_620_000, deferredTax: 410_000, otherCovered: 0, nonCovered: 40_000, payrollEligible: 22_400_000, employees: 980, tangibleEligible: 28_900_000, cbcrRevenue: 54_600_000, cbcrProfit: 31_800_000, cbcrTax: 3_710_000, priorDta: 0, priorDtl: 310_000 },
  { entityId: "MY-CE", revenue: 41_000_000, fanil: 17_800_000, fanilFc: 79_566_000, currentTax: 4_180_000, deferredTax: 210_000, otherCovered: 0, nonCovered: 20_000, payrollEligible: 11_200_000, employees: 410, tangibleEligible: 14_400_000, cbcrRevenue: 41_200_000, cbcrProfit: 18_000_000, cbcrTax: 4_250_000, priorDta: 180_000, priorDtl: 240_000 },
  { entityId: "ID-CE", revenue: 33_000_000, fanil: 14_900_000, fanilFc: 241_380_000_000, currentTax: 3_180_000, deferredTax: 160_000, otherCovered: 0, nonCovered: 15_000, payrollEligible: 9_800_000, employees: 520, tangibleEligible: 12_200_000, cbcrRevenue: 33_400_000, cbcrProfit: 15_100_000, cbcrTax: 3_220_000, priorDta: 90_000, priorDtl: 140_000 },
  { entityId: "AE-CE", revenue: 28_000_000, fanil: 22_400_000, fanilFc: 82_264_000, currentTax: 1_980_000, deferredTax: 40_000, otherCovered: 0, nonCovered: 0, payrollEligible: 6_100_000, employees: 48, tangibleEligible: 8_400_000, cbcrRevenue: 28_100_000, cbcrProfit: 22_500_000, cbcrTax: 1_990_000, priorDta: 0, priorDtl: 0 },
  { entityId: "UK-HC", revenue: 12_000_000, fanil: 8_400_000, fanilFc: 6_610_800, currentTax: 1_596_000, deferredTax: 80_000, otherCovered: 0, nonCovered: 12_000, payrollEligible: 4_200_000, employees: 38, tangibleEligible: 1_100_000, cbcrRevenue: 12_200_000, cbcrProfit: 8_500_000, cbcrTax: 1_620_000, priorDta: 60_000, priorDtl: 90_000 },
  { entityId: "DE-CE", revenue: 188_000_000, fanil: 84_100_000, fanilFc: 80_736_000, currentTax: 20_640_000, deferredTax: 720_000, otherCovered: 0, nonCovered: 110_000, payrollEligible: 48_000_000, employees: 760, tangibleEligible: 52_000_000, cbcrRevenue: 188_400_000, cbcrProfit: 84_600_000, cbcrTax: 21_100_000, priorDta: 2_400_000, priorDtl: 3_100_000 },
  { entityId: "FR-CE", revenue: 142_000_000, fanil: 61_200_000, fanilFc: 58_752_000, currentTax: 15_180_000, deferredTax: 410_000, otherCovered: 0, nonCovered: 70_000, payrollEligible: 32_400_000, employees: 510, tangibleEligible: 29_800_000, cbcrRevenue: 142_200_000, cbcrProfit: 61_500_000, cbcrTax: 15_400_000, priorDta: 1_100_000, priorDtl: 1_800_000 },
  { entityId: "NL-CE", revenue: 67_000_000, fanil: 40_400_000, fanilFc: 38_784_000, currentTax: 9_920_000, deferredTax: 380_000, otherCovered: 0, nonCovered: 40_000, payrollEligible: 14_800_000, employees: 190, tangibleEligible: 18_200_000, cbcrRevenue: 67_100_000, cbcrProfit: 40_600_000, cbcrTax: 10_050_000, priorDta: 420_000, priorDtl: 710_000 },
  { entityId: "HU-CE", revenue: 36_000_000, fanil: 27_800_000, fanilFc: 10_981_000_000, currentTax: 2_480_000, deferredTax: 80_000, otherCovered: 0, nonCovered: 10_000, payrollEligible: 8_200_000, employees: 210, tangibleEligible: 11_400_000, cbcrRevenue: 36_200_000, cbcrProfit: 28_000_000, cbcrTax: 2_510_000, priorDta: 40_000, priorDtl: 60_000 },
  { entityId: "US-CE", revenue: 310_000_000, fanil: 94_200_000, fanilFc: 94_200_000, currentTax: 19_410_000, deferredTax: 620_000, otherCovered: 0, nonCovered: 1_200_000, payrollEligible: 58_000_000, employees: 640, tangibleEligible: 71_000_000, cbcrRevenue: 311_000_000, cbcrProfit: 95_000_000, cbcrTax: 20_100_000, priorDta: 3_400_000, priorDtl: 5_200_000 },
  { entityId: "IE-CE", revenue: 204_000_000, fanil: 168_400_000, fanilFc: 161_664_000, currentTax: 10_920_000, deferredTax: 740_000, otherCovered: 0, nonCovered: 60_000, payrollEligible: 18_600_000, employees: 86, tangibleEligible: 54_800_000, cbcrRevenue: 204_800_000, cbcrProfit: 169_100_000, cbcrTax: 11_200_000, priorDta: 210_000, priorDtl: 1_840_000 },
  { entityId: "TH-PE", revenue: 8_200_000, fanil: 1_140_000, fanilFc: 43_833_000, currentTax: 90_000, deferredTax: 10_000, otherCovered: 0, nonCovered: 0, payrollEligible: 3_400_000, employees: 140, tangibleEligible: 6_800_000, cbcrRevenue: 8_200_000, cbcrProfit: 1_140_000, cbcrTax: 90_000, priorDta: 0, priorDtl: 0 },
  { entityId: "SG-JV", revenue: 14_000_000, fanil: 2_200_000, fanilFc: 2_972_200, currentTax: 260_000, deferredTax: 20_000, otherCovered: 0, nonCovered: 0, payrollEligible: 1_800_000, employees: 22, tangibleEligible: 4_100_000, cbcrRevenue: 14_000_000, cbcrProfit: 2_200_000, cbcrTax: 260_000, priorDta: 0, priorDtl: 0 },
  { entityId: "MY-MOCE", revenue: 12_400_000, fanil: 4_200_000, fanilFc: 18_774_000, currentTax: 280_000, deferredTax: 20_000, otherCovered: 0, nonCovered: 8_000, payrollEligible: 2_800_000, employees: 96, tangibleEligible: 3_600_000, cbcrRevenue: 12_400_000, cbcrProfit: 4_200_000, cbcrTax: 300_000, priorDta: 40_000, priorDtl: 20_000 },
  { entityId: "MY-MOS-A", revenue: 8_000_000, fanil: 2_600_000, fanilFc: 11_622_000, currentTax: 130_000, deferredTax: 20_000, otherCovered: 0, nonCovered: 2_000, payrollEligible: 1_600_000, employees: 54, tangibleEligible: 2_200_000, cbcrRevenue: 8_000_000, cbcrProfit: 2_600_000, cbcrTax: 150_000, priorDta: 20_000, priorDtl: 10_000 },
  { entityId: "MY-MOS-B", revenue: 6_400_000, fanil: 1_900_000, fanilFc: 8_493_000, currentTax: 95_000, deferredTax: 10_000, otherCovered: 0, nonCovered: 1_000, payrollEligible: 1_100_000, employees: 38, tangibleEligible: 1_500_000, cbcrRevenue: 6_400_000, cbcrProfit: 1_900_000, cbcrTax: 105_000, priorDta: 10_000, priorDtl: 5_000 },
  { entityId: "SG-IE", revenue: 2_400_000, fanil: 1_800_000, fanilFc: 2_431_800, currentTax: 270_000, deferredTax: 0, otherCovered: 0, nonCovered: 0, payrollEligible: 420_000, employees: 6, tangibleEligible: 80_000, cbcrRevenue: 2_400_000, cbcrProfit: 1_800_000, cbcrTax: 270_000, priorDta: 0, priorDtl: 0 },
  { entityId: "SG-FT", revenue: 600_000, fanil: 480_000, fanilFc: 648_480, currentTax: 0, deferredTax: 0, otherCovered: 0, nonCovered: 0, payrollEligible: 0, employees: 0, tangibleEligible: 0, cbcrRevenue: 600_000, cbcrProfit: 480_000, cbcrTax: 0, priorDta: 0, priorDtl: 0 },
  { entityId: "XX-ST", revenue: 900_000, fanil: 180_000, fanilFc: 180_000, currentTax: 0, deferredTax: 0, otherCovered: 0, nonCovered: 0, payrollEligible: 0, employees: 2, tangibleEligible: 0, cbcrRevenue: 900_000, cbcrProfit: 180_000, cbcrTax: 0, priorDta: 0, priorDtl: 0 },
  { entityId: "LU-CE", revenue: 1_100_000, fanil: -4_200_000, fanilFc: -4_032_000, currentTax: -840_000, deferredTax: 0, otherCovered: 0, nonCovered: 0, payrollEligible: 0, employees: 8, tangibleEligible: 120_000, cbcrRevenue: 1_100_000, cbcrProfit: -4_200_000, cbcrTax: -840_000, priorDta: 210_000, priorDtl: 0 },
  { entityId: "HK-CE", revenue: 3_200_000, fanil: 800_000, fanilFc: 6_224_000, currentTax: -120_000, deferredTax: 0, otherCovered: 0, nonCovered: 0, payrollEligible: 180_000, employees: 14, tangibleEligible: 90_000, cbcrRevenue: 3_200_000, cbcrProfit: 800_000, cbcrTax: -120_000, priorDta: 0, priorDtl: 0 },
  { entityId: "SG-SHIP", revenue: 14_000_000, fanil: 8_400_000, fanilFc: 11_348_400, currentTax: 840_000, deferredTax: 20_000, otherCovered: 0, nonCovered: 0, payrollEligible: 2_800_000, employees: 38, tangibleEligible: 16_400_000, cbcrRevenue: 14_000_000, cbcrProfit: 8_400_000, cbcrTax: 840_000, priorDta: 0, priorDtl: 40_000 },
];

export const ADJUSTMENTS: Adjustment[] = [
  { id: "ADJ-TH-01", entityId: "TH-CE", category: "Excluded dividends", original: 1_840_000, amount: -1_840_000, reason: "Intra-group dividend from MY-CE, ownership ≥ 10%, excluded under Art. 3.2.1(b)", ruleId: "OECD-DIV-EXCL", sourceDoc: "TH001 Trial Balance FY2026.xlsx", account: "810020", preparer: "N. Chai", reviewer: "M. Sato", status: "Reviewed" },
  { id: "ADJ-TH-02", entityId: "TH-CE", category: "Net tax expense", original: 4_730_000, amount: -280_000, reason: "Remove non-covered local business tax included in tax expense", ruleId: "OECD-GloBE-15", sourceDoc: "TH tax provision FY2026.xlsx", account: "720050", preparer: "N. Chai", reviewer: "M. Sato", status: "Reviewed" },
  { id: "ADJ-TH-03", entityId: "TH-CE", category: "FX / as-if", original: 410_000, amount: 0, reason: "Unrealised FX on intra-group EUR loan — reviewed, no GloBE adjustment for FY2026", ruleId: "OECD-GloBE-15", sourceDoc: "TH001 Trial Balance FY2026.xlsx", account: "830010", preparer: "N. Chai", reviewer: null, status: "Prepared" },
  { id: "ADJ-IE-01", entityId: "IE-CE", category: "Excluded dividends", original: 4_200_000, amount: -4_200_000, reason: "Dividend from NL-CE excluded", ruleId: "OECD-DIV-EXCL", sourceDoc: "IE001 TB FY2026.xlsx", account: "810020", preparer: "C. Walsh", reviewer: "A. Rivera", status: "Reviewed" },
  { id: "ADJ-IE-02", entityId: "IE-CE", category: "Stock-based compensation", original: 1_100_000, amount: 800_000, reason: "Replace accounting SBC with amount allowed as tax deduction", ruleId: "OECD-GloBE-15", sourceDoc: "IE payroll & SBC FY2026.xlsx", account: "610020", preparer: "C. Walsh", reviewer: "A. Rivera", status: "Reviewed" },
  { id: "ADJ-VN-01", entityId: "VN-CE", category: "Policy disallowed", original: 420_000, amount: 420_000, reason: "Illegal payment / fines add-back", ruleId: "OECD-GloBE-15", sourceDoc: "VN001 TB FY2026.xlsx", account: "650400", preparer: "Local Tax VN", reviewer: null, status: "Validated" },
  { id: "ADJ-SG-01", entityId: "SG-HC", category: "Excluded dividends", original: 2_100_000, amount: -2_100_000, reason: "Dividends from TH-CE / VN-CE", ruleId: "OECD-DIV-EXCL", sourceDoc: "SG consolidation pack FY2026.xlsx", account: "810020", preparer: "L. Tan", reviewer: "M. Sato", status: "Reviewed" },
];

export const ACCOUNTS: AccountMap[] = [
  { account: "610001", name: "Staff Cost", entityId: "TH-CE", financial: "Payroll", globe: "FANIL — opex", adjustment: "None", sbie: "Eligible payroll", confidence: 98, approved: true, amount: 24_600_000 },
  { account: "610020", name: "Bonus", entityId: "TH-CE", financial: "Payroll", globe: "FANIL — opex", adjustment: "None", sbie: "Eligible payroll", confidence: 96, approved: true, amount: 4_200_000 },
  { account: "720050", name: "Income Tax", entityId: "TH-CE", financial: "Current tax", globe: "Covered tax — current", coveredTax: "Covered", confidence: 99, approved: true, amount: 4_120_000 },
  { account: "720060", name: "Deferred Income Tax", entityId: "TH-CE", financial: "Deferred tax", globe: "Covered tax — deferred", coveredTax: "Covered — recast 15%", confidence: 91, approved: true, amount: 610_000 },
  { account: "810020", name: "Dividend Income", entityId: "TH-CE", financial: "Other income", globe: "Excluded dividends", adjustment: "Art. 3.2.1(b)", confidence: 97, approved: true, amount: 1_840_000 },
  { account: "830010", name: "FX Gain", entityId: "TH-CE", financial: "FX", globe: "FANIL — other", adjustment: "Review FX policy", confidence: 62, approved: false, amount: 410_000 },
  { account: "150100", name: "Plant & machinery", entityId: "TH-CE", financial: "PPE", globe: "SBIE tangible", sbie: "Eligible tangible assets", confidence: 94, approved: true, amount: 38_400_000 },
  { account: "720080", name: "Local business tax", entityId: "TH-CE", financial: "Other tax", globe: "Non-covered tax", coveredTax: "Non-covered", confidence: 88, approved: true, amount: 80_000 },
  { account: "410000", name: "Revenue — domestic", entityId: "TH-CE", financial: "Revenue", globe: "FANIL — revenue", confidence: 99, approved: true, amount: 71_200_000 },
  { account: "420000", name: "Revenue — export", entityId: "TH-CE", financial: "Revenue", globe: "FANIL — revenue", confidence: 99, approved: true, amount: 25_200_000 },
  { account: "610030", name: "Accrued pension expense", entityId: "TH-CE", financial: "Payroll / pension", globe: "Art. 3.2.3 pension adjustment", adjustment: "Book expense → contributions paid (+$0.25M)", confidence: 76, approved: false, amount: 900_000 },
  { account: "390100", name: "Rayong PE result allocation", entityId: "TH-CE", financial: "PE allocation", globe: "Art. 3.5 PE FANIL", adjustment: "Main Entity −$0.30M / PE +$0.30M", confidence: 95, approved: true, amount: 300_000 },
  { account: "640500", name: "Cross-border management services", entityId: "SG-HC", financial: "Operating expense", globe: "Art. 3.2.4 arm's-length principle", adjustment: "Arm's-length true-up +$0.18M", confidence: 93, approved: true, amount: 540_000 },
  { account: "715500", name: "Policyholder tax recharge", entityId: "JP-UPE", financial: "Insurance tax recharge", globe: "Art. 3.2.9 policyholder taxes", adjustment: "Exclude from GloBE income (−$0.12M)", confidence: 91, approved: true, amount: 120_000 },
  { account: "410100", name: "Revenue — international freight", entityId: "SG-SHIP", financial: "Revenue", globe: "Art. 3.4.2 International Shipping Income", adjustment: "Art. 3.4.1 exclusion", confidence: 96, approved: true, amount: 11_200_000 },
  { account: "410200", name: "Revenue — ancillary port / agency", entityId: "SG-SHIP", financial: "Revenue", globe: "Art. 3.4.3 ancillary shipping", adjustment: "QAISI 50% cap", confidence: 91, approved: true, amount: 2_800_000 },
  { account: "610100", name: "Crew / marine payroll", entityId: "SG-SHIP", financial: "Payroll", globe: "FANIL — opex (excluded shipping)", adjustment: "Art. 3.4.4 costs", sbie: "Stripped — used in excluded shipping", confidence: 94, approved: true, amount: 2_100_000 },
  { account: "150200", name: "Vessels & marine ROU", entityId: "SG-SHIP", financial: "PPE", globe: "Eligible tangible — shipping", sbie: "Stripped — used in excluded shipping", confidence: 95, approved: true, amount: 14_000_000 },
  { account: "720150", name: "Singapore CIT on shipping", entityId: "SG-SHIP", financial: "Current tax", globe: "Covered tax — Art. 4.1.3 shipping", coveredTax: "Reduced (excluded shipping)", confidence: 93, approved: true, amount: 750_000 },
];

export const FILES: SourceFile[] = [
  { id: "F01", name: "Aetherion_Legal_Entity_List_FY2026.xlsx", kind: "Legal entity list", size: "1.2 MB", uploaded: "12 Aug 2026", by: "M. Sato", status: "Mapped", rows: 212 },
  { id: "F02", name: "TH001 Trial Balance FY2026.xlsx", kind: "Trial balance", entity: "TH-CE", size: "840 KB", uploaded: "12 Aug 2026", by: "N. Chai", status: "Mapped", rows: 1842 },
  { id: "F03", name: "FY2026 Consolidation pack.xlsx", kind: "Consolidation", size: "6.4 MB", uploaded: "11 Aug 2026", by: "Group Finance", status: "Validated", rows: 12840 },
  { id: "F04", name: "TH tax provision FY2026.xlsx", kind: "Tax provision", entity: "TH-CE", size: "420 KB", uploaded: "12 Aug 2026", by: "N. Chai", status: "Mapped" },
  { id: "F05", name: "CbCR_FY2026.xlsx", kind: "CbCR", size: "2.1 MB", uploaded: "10 Aug 2026", by: "M. Sato", status: "Validated", rows: 48 },
  { id: "F06", name: "BOI_Certificate_TH001.pdf", kind: "BOI certificate", entity: "TH-CE", size: "1.8 MB", uploaded: "09 Aug 2026", by: "N. Chai", status: "Mapped" },
  { id: "F13", name: "BOI_Certificate_TH001_annex_automation.pdf", kind: "BOI certificate", entity: "TH-CE", size: "640 KB", uploaded: "09 Aug 2026", by: "N. Chai", status: "Mapped" },
  { id: "F07", name: "IE001 TB FY2026.xlsx", kind: "Trial balance", entity: "IE-CE", size: "1.1 MB", uploaded: "11 Aug 2026", by: "C. Walsh", status: "Mapped", rows: 960 },
  { id: "F08", name: "Fixed_asset_register_TH.xlsx", kind: "Fixed-asset register", entity: "TH-CE", size: "3.2 MB", uploaded: "08 Aug 2026", by: "TH Finance", status: "Imported", rows: 4200 },
  { id: "F09", name: "Payroll_TH_FY2026.csv", kind: "Payroll", entity: "TH-CE", size: "640 KB", uploaded: "08 Aug 2026", by: "TH Finance", status: "Mapped", rows: 1240 },
  { id: "F10", name: "Deferred_tax_rollforward.xlsx", kind: "Deferred tax", size: "980 KB", uploaded: "11 Aug 2026", by: "Group Tax", status: "Validated" },
  { id: "F11", name: "TP_Master_File_2026.pdf", kind: "TP report", size: "12 MB", uploaded: "07 Aug 2026", by: "A. Rivera", status: "Imported" },
  { id: "F12", name: "Prior_GIR_FY2025.xml", kind: "Previous GIR", size: "420 KB", uploaded: "06 Aug 2026", by: "M. Sato", status: "Imported" },
  { id: "F14", name: "SG020 Trial Balance FY2026.xlsx", kind: "Trial balance", entity: "SG-SHIP", size: "510 KB", uploaded: "11 Aug 2026", by: "L. Tan", status: "Mapped", rows: 420 },
  { id: "F15", name: "HK001 TB FY2026.xlsx", kind: "Trial balance", entity: "HK-CE", size: "280 KB", uploaded: "11 Aug 2026", by: "Group Finance", status: "Mapped", rows: 186 },
  { id: "F16", name: "TH001 PE allocation workbook FY2026.xlsx", kind: "PE allocation", entity: "TH-PE", size: "360 KB", uploaded: "12 Aug 2026", by: "N. Chai", status: "Reviewed", rows: 42 },
  { id: "F17", name: "JP captive insurance reconciliation FY2026.xlsx", kind: "GloBE adjustment", entity: "JP-UPE", size: "240 KB", uploaded: "10 Aug 2026", by: "Group Tax", status: "Reviewed", rows: 18 },
  { id: "F18", name: "JP CFC inclusion schedule FY2026.xlsx", kind: "Covered-tax allocation", entity: "JP-UPE", size: "610 KB", uploaded: "11 Aug 2026", by: "Group Tax", status: "Reviewed", rows: 64 },
  { id: "F19", name: "UK010 distribution tax schedule FY2026.xlsx", kind: "Covered-tax allocation", entity: "UK-HC", size: "190 KB", uploaded: "11 Aug 2026", by: "UK Tax", status: "Reviewed", rows: 12 },
];

export const ISSUES: Issue[] = [
  { id: "IQ-01", severity: "block", area: "Covered tax", entity: "VN-CE", jurisdiction: "Vietnam", title: "Prior-year DTA/DTL missing", detail: "Vietnam deferred-tax opening balances are blank. Recapture and recast cannot be completed.", owner: "Local Tax VN" },
  { id: "IQ-02", severity: "block", area: "SBIE", entity: "VN-CE", jurisdiction: "Vietnam", title: "Payroll file incomplete", detail: "Eligible employee listing covers 11 of 12 months. SBIE payroll carve-out is estimated.", owner: "VN Finance" },
  { id: "IQ-03", severity: "warn", area: "Mapping", entity: "TH-CE", jurisdiction: "Thailand", title: "FX gain mapping at 62% confidence", detail: "Account 830010 — FX Gain needs tax-team approval before lock.", owner: "N. Chai" },
  { id: "IQ-04", severity: "warn", area: "CbCR", jurisdiction: "Singapore", title: "CbCR revenue vs consolidation", detail: "Singapore CbCR revenue $88.0M vs consolidation $86.4M (HoldCo + JV). $1.6M unexplained.", owner: "L. Tan" },
  { id: "IQ-05", severity: "info", area: "Ownership", entity: "ID-CE", jurisdiction: "Indonesia", title: "1% minority — not MOCE", detail: "Entity test: UPE look-through ownership of PT Aetherion Indonesia is 99% (> 30%). Art. 5.1.3 MOCE does not apply. The entity blends with any other majority CEs in Indonesia.", owner: "Group Tax" },
  { id: "IQ-08", severity: "info", area: "Ownership", entity: "UK-HC", jurisdiction: "United Kingdom", title: "POPE — 22% outside the group", detail: "Aetherion UK Ltd. is a Parent Entity and persons that are not Group Entities hold 22% (> 20%). Entity test: POPE (Art. 2.1.4). IIR would apply here first on any LTCE it owns; European QDMTT still collects first on this snapshot.", owner: "Group Tax" },
  { id: "IQ-09", severity: "info", area: "Ownership", entity: "MY-MOCE", jurisdiction: "Malaysia", title: "MOSG — Malaysian Minority-Owned Subgroup", detail: "MY028 (28% UPE) is a Minority-Owned Parent with MY029 and MY030 under it. The three CEs blend as one Malaysian MOSG ETR and stay separate from majority MY CEs. Malaysian QDMTT still collects any top-up on that blend.", owner: "Group Tax" },
  { id: "IQ-06", severity: "warn", area: "Deferred tax", entity: "AE-CE", jurisdiction: "UAE", title: "Deferred tax movement unexplained", detail: "UAE CIT commencement created a DTL with no roll-forward narrative.", owner: "MENA Tax" },
  { id: "IQ-07", severity: "warn", area: "Deferred tax", entity: "TH-CE", jurisdiction: "Thailand", title: "FY2022 DTL approaching five-year recapture", detail: "GloBE DTL origin FY2022 is not a Recapture Exception Accrual and has not reversed. Article 4.4.4 deadline is the end of FY2027. Origin-year ETR must be recomputed if still outstanding.", owner: "N. Chai" },
  { id: "IQ-10", severity: "info", area: "Ownership", entity: "SG-JV", jurisdiction: "Singapore", title: "JV Group from Art. 10.1 facts", detail: "Keppel Logistics is equity-accounted in the UPE CFS and UPE ownership is 50% (≥ 50%). Entity test: Joint Venture (Art. 6.4 / 10.1) — separate ETR from Singapore HoldCo. The legal-entity type label is not the test.", owner: "Group Tax" },
  { id: "IQ-11", severity: "info", area: "Covered tax", entity: "LU-CE", jurisdiction: "Luxembourg", title: "Art. 4.1.5 — Net GloBE Loss and negative Covered Taxes", detail: "Luxembourg has a Net GloBE Loss and negative Adjusted Covered Taxes. Default: Additional Current Top-up Tax equal to the negative tax. Elect OECD_4.1.5 to carry the amount forward instead.", owner: "Group Tax" },
  { id: "IQ-12", severity: "info", area: "ETR", entity: "HK-CE", jurisdiction: "Hong Kong", title: "Art. 5.1.2 — positive Net GloBE Income, negative Covered Taxes", detail: "Hong Kong Net GloBE Income is positive and Adjusted Covered Taxes are negative. ETR is negative; Top-up Tax Percentage exceeds 15% (Art. 5.2.1). No ETR is computed when Net GloBE Income is zero or negative.", owner: "Group Tax" },
  { id: "IQ-13", severity: "info", area: "GloBE income", entity: "SG-SHIP", jurisdiction: "Singapore", title: "Art. 3.4 — International Shipping Income excluded", detail: "SG020 posts Art. 3.4.2 ISI $5.0M and Art. 3.4.3 ancillary $3.2M. QAISI is capped at 50% of ISI ($2.5M); $0.7M excess ancillary stays in GloBE. Related Covered Taxes $0.75M and shipping payroll/assets come out of SBIE. Management test (Art. 3.4.5) is met in Singapore.", owner: "L. Tan" },
  { id: "IQ-14", severity: "info", area: "GloBE income", entity: "HK-CE", jurisdiction: "Hong Kong", title: "Art. 3.4.5 — shipping not excluded", detail: "HK001 has feeder shipping income in FANIL. Strategic and commercial management of the ships is in Singapore, not Hong Kong. Art. 3.4.5 fails; ISI and ancillary stay in GloBE. Hong Kong Art. 5.1.2 teaching numbers are unchanged.", owner: "Group Tax" },
];

export const INCENTIVES: Incentive[] = [
  { id: "TH-BOI", entityId: "TH-CE", name: "BOI — Electronics manufacturing (Rayong)", type: "Tax holiday / reduced CIT", start: "2019-02-01", end: "2028-01-31", rate: "0% CIT years 1–8; 50% reduction years 9–13", conditions: "Qualifying production at Rayong; eligible capex maintained; BOI reporting", sbtishEligible: true, extractedFrom: "BOI_Certificate_TH001.pdf" },
  { id: "TH-BOI-AUTO", entityId: "TH-CE", name: "BOI — Productivity / automation (Rayong)", type: "Tax holiday", start: "2024-03-01", end: "2032-02-28", rate: "0% CIT years 1–8", conditions: "Eligible automation capex; separate project accounts; BOI reporting", sbtishEligible: true, extractedFrom: "BOI_Certificate_TH001_annex_automation.pdf" },
  { id: "VN-EIT", entityId: "VN-CE", name: "EIT incentive — high-tech", type: "Reduced CIT", start: "2016-09-01", end: "2026-12-31", rate: "10% CIT (standard 20%)", conditions: "High-tech certificate; headcount in Hanoi", sbtishEligible: true, extractedFrom: "VN_EIT_certificate.pdf" },
  { id: "IE-IP", entityId: "IE-CE", name: "Knowledge Development Box", type: "IP box", start: "2013-04-01", end: "2030-12-31", rate: "6.25% on qualifying IP profits", conditions: "Nexus ratio; qualifying assets", sbtishEligible: false, extractedFrom: "IE_KDB_election.pdf" },
  { id: "SG-DE", entityId: "SG-HC", name: "Development & Expansion Incentive", type: "Reduced CIT", start: "2022-01-01", end: "2027-12-31", rate: "5–10% on qualifying income", conditions: "Headcount and spending commitments", sbtishEligible: true, extractedFrom: "EDB_DEI_SG.pdf" },
  { id: "HU-DEV", entityId: "HU-CE", name: "Development tax allowance", type: "Tax credit / allowance", start: "2018-01-15", end: "2028-12-31", rate: "Up to 80% of CIT for 13 years", conditions: "Eligible capex; job creation", sbtishEligible: true, extractedFrom: "HU_dev_allowance.pdf" },
  { id: "AE-FZ", entityId: "AE-CE", name: "Free zone 0% (legacy)", type: "Free zone", start: "2021-04-01", end: "2026-05-31", rate: "0% on qualifying FZ income; 9% CIT otherwise", conditions: "Qualifying activities; substance", sbtishEligible: false, extractedFrom: "DMCC_license.pdf" },
  { id: "NL-IP", entityId: "NL-CE", name: "Innovation box", type: "IP box", start: "2011-08-01", end: "2030-12-31", rate: "9% effective on qualifying profits", conditions: "WBSO / nexus", sbtishEligible: false, extractedFrom: "NL_innovation_box.pdf" },
];

export const FILINGS: Filing[] = [
  { id: "FL-TH-54", jurisdiction: "Thailand", requirement: "s 54 UPE / GIR-filer notification", deadline: "2028-03-31", status: "Preparing", preparer: "N. Chai", reviewer: "M. Sato" },
  { id: "FL-TH-Q", jurisdiction: "Thailand", requirement: "s 57 Thai return and QDMTT payment", deadline: "2028-03-31", status: "Preparing", preparer: "N. Chai", reviewer: "M. Sato" },
  { id: "FL-SG-N", jurisdiction: "Singapore", requirement: "GIR notification", deadline: "31 Dec 2027", status: "Completed", preparer: "L. Tan", reviewer: "M. Sato", filed: "04 Aug 2026" },
  { id: "FL-DE-G", jurisdiction: "Germany", requirement: "GIR", deadline: "30 Jun 2028", status: "Covered — central filing", preparer: "—", reviewer: "—", central: true },
  { id: "FL-JP-I", jurisdiction: "Japan", requirement: "IIR return", deadline: "31 Dec 2027", status: "Pending", preparer: "M. Sato", reviewer: "A. Rivera" },
  { id: "FL-IE-Q", jurisdiction: "Ireland", requirement: "QDMTT return", deadline: "31 Dec 2027", status: "Preparing", preparer: "C. Walsh", reviewer: "A. Rivera" },
  { id: "FL-JP-G", jurisdiction: "Japan", requirement: "Central GIR", deadline: "30 Jun 2028", status: "Draft XML", preparer: "M. Sato", reviewer: "A. Rivera", central: true },
  { id: "FL-VN-N", jurisdiction: "Vietnam", requirement: "Local notification", deadline: "31 Mar 2028", status: "Not started", preparer: "Local Tax VN", reviewer: "M. Sato" },
  { id: "FL-US-S", jurisdiction: "United States", requirement: "SbS / UTPR SH memo", deadline: "15 Apr 2027", status: "In review", preparer: "US Tax", reviewer: "A. Rivera" },
];

export const JURISDICTION_PACKS = [
  { iso: "JP", name: "Japan", iir: true, qdmtt: false, qdmttSH: false, utpr: true, from: "2024-04-01", qualified: "Transitional qualified IIR", filing: "IIR return + central GIR", fx: "JPY", notes: "UPE jurisdiction. IIR collects residual after foreign QDMTT." },
  { iso: "TH", name: "Thailand", iir: false, qdmtt: true, qdmttSH: true, utpr: false, from: "2025-01-01", qualified: "Transitional qualified QDMTT", filing: "QDMTT return · pack TH-PACK-2567", fx: "THB", notes: "Thai Jurisdiction Pack overlays GloBE Core (situs, SBIE No. 4, BOT FX, liability ordering). Filing schema pending. Open /thailand." },
  { iso: "SG", name: "Singapore", iir: true, qdmtt: true, qdmttSH: true, utpr: true, from: "2025-01-01", qualified: "Transitional qualified", filing: "GIR notification + MTT", fx: "SGD", notes: "HoldCo jurisdiction. DEI incentive in force. Art. 3.4 teaching CE: Aetherion Marine (SG020) — ISI + ancillary cap + management test." },
  { iso: "VN", name: "Vietnam", iir: false, qdmtt: false, qdmttSH: false, utpr: false, from: "—", qualified: "Not on Central Record (demo)", filing: "Notification only", fx: "VND", notes: "No QDMTT in demo pack — residual to JP IIR." },
  { iso: "IE", name: "Ireland", iir: true, qdmtt: true, qdmttSH: true, utpr: true, from: "2024-01-01", qualified: "Transitional qualified QDMTT/IIR", filing: "QDMTT + GIR", fx: "EUR", notes: "KDB is not SBTISH-eligible in this pack." },
  { iso: "US", name: "United States", iir: false, qdmtt: false, qdmttSH: false, utpr: false, from: "2026-01-01", qualified: "Qualified SbS (demo pack)", filing: "SbS / UTPR SH", fx: "USD", notes: "Side-by-Side / Transitional UTPR Safe Harbour path." },
  { iso: "DE", name: "Germany", iir: true, qdmtt: true, qdmttSH: true, utpr: true, from: "2024-01-01", qualified: "Transitional qualified", filing: "Covered by central GIR", fx: "EUR", notes: "MinBestSteuerG QDMTT." },
  { iso: "FR", name: "France", iir: true, qdmtt: true, qdmttSH: true, utpr: true, from: "2024-01-01", qualified: "Transitional qualified", filing: "Covered by central GIR", fx: "EUR", notes: "" },
  { iso: "GB", name: "United Kingdom", iir: true, qdmtt: true, qdmttSH: true, utpr: true, from: "2024-01-01", qualified: "Transitional qualified", filing: "DTT / MTT", fx: "GBP", notes: "Multinational Top-up Tax + DTT." },
  { iso: "NL", name: "Netherlands", iir: true, qdmtt: true, qdmttSH: true, utpr: true, from: "2024-01-01", qualified: "Transitional qualified", filing: "Covered by central GIR", fx: "EUR", notes: "" },
  { iso: "HU", name: "Hungary", iir: true, qdmtt: true, qdmttSH: true, utpr: true, from: "2024-01-01", qualified: "Transitional qualified", filing: "QDMTT", fx: "HUF", notes: "Development tax allowance — SBTISH candidate." },
  { iso: "AE", name: "United Arab Emirates", iir: false, qdmtt: true, qdmttSH: false, utpr: false, from: "2025-01-01", qualified: "Review", filing: "Domestic MTT", fx: "AED", notes: "CIT 9% + DMTT path under review." },
  { iso: "MY", name: "Malaysia", iir: true, qdmtt: true, qdmttSH: true, utpr: true, from: "2025-01-01", qualified: "Transitional qualified", filing: "QDMTT", fx: "MYR", notes: "" },
  { iso: "ID", name: "Indonesia", iir: false, qdmtt: true, qdmttSH: true, utpr: false, from: "2025-01-01", qualified: "Transitional qualified QDMTT", filing: "QDMTT", fx: "IDR", notes: "" },
  { iso: "LU", name: "Luxembourg", iir: true, qdmtt: true, qdmttSH: true, utpr: true, from: "2024-01-01", qualified: "Transitional qualified", filing: "QDMTT + GIR", fx: "EUR", notes: "Art. 4.1.5 teaching case — Net GloBE Loss and negative Covered Taxes." },
  { iso: "HK", name: "Hong Kong", iir: false, qdmtt: false, qdmttSH: false, utpr: false, from: "—", qualified: "Not on Central Record (demo)", filing: "Notification only", fx: "HKD", notes: "Art. 5.1.2 teaching case — positive Net GloBE Income and negative Covered Taxes. Residual to JP IIR. Art. 3.4.5 fail: feeder shipping in FANIL is not excluded (ships managed from Singapore)." },
  { iso: "XX", name: "Stateless", iir: false, qdmtt: false, qdmttSH: false, utpr: false, from: "—", qualified: "n/a", filing: "Allocated with UPE IIR / UTPR", fx: "USD", notes: "Each Stateless CE is its own jurisdiction (Art. 10.3.4)." },
];

/** Equirectangular: x = (lon+180)/360*100, y = (90−lat)/180*100 */
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

export const GIR_SECTIONS = [
  { id: "A", title: "Filing obligation & MNE group", status: "Complete", fields: 24, missing: 0 },
  { id: "B", title: "Corporate structure", status: "Complete", fields: 212, missing: 0 },
  { id: "C", title: "ETR / Top-up tax by jurisdiction", status: "In review", fields: 48, missing: 2 },
  { id: "D", title: "Safe harbours & elections", status: "In review", fields: 48, missing: 1 },
  { id: "E", title: "QDMTT / IIR / UTPR allocation", status: "Draft", fields: 14, missing: 0 },
];

export const ACTIVITY = [
  { text: "Thailand QDMTT calculation locked for review — $1.55M", who: "N. Chai", when: "13 Aug, 16:40" },
  { text: "AI mapping approved for TH001 accounts 610001–720050", who: "M. Sato", when: "13 Aug, 14:12" },
  { text: "Data request sent to Vietnam finance: DTA/DTL + payroll", who: "GMT24 Gap Hunter", when: "13 Aug, 11:05" },
  { text: "Ireland KDB treatment flagged by AI Reviewer (SBTISH: no)", who: "AI Reviewer", when: "12 Aug, 18:22" },
  { text: "Central GIR XML draft generated — schema 2026.1", who: "GIR Autopilot", when: "12 Aug, 09:14" },
];

export const FORECAST = [
  { period: "Q1 actual", topUp: 2_100_000 },
  { period: "Q2 actual", topUp: 3_400_000 },
  { period: "Q3 forecast", topUp: 4_200_000 },
  { period: "Q4 forecast", topUp: 5_100_000 },
];

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
  { id: "TH-CE", code: "TH001", name: "Aetherion (Thailand) Ltd.", jurisdiction: "Thailand", iso: "TH", type: "CE", parentId: "SG-HC", ownership: 100, gaap: "TFRS", fx: "THB", acquired: "2012-03-15", incentiveIds: ["TH-BOI"], completeness: 96, review: "Prepared", graph: { x: 110, y: 250 } },
  { id: "VN-CE", code: "VN001", name: "Aetherion Vietnam Co., Ltd.", jurisdiction: "Vietnam", iso: "VN", type: "CE", parentId: "SG-HC", ownership: 100, gaap: "VAS/IFRS", fx: "VND", acquired: "2016-09-01", incentiveIds: ["VN-EIT"], completeness: 81, review: "Validated", graph: { x: 250, y: 250 } },
  { id: "MY-CE", code: "MY001", name: "Aetherion Malaysia Sdn. Bhd.", jurisdiction: "Malaysia", iso: "MY", type: "CE", parentId: "SG-HC", ownership: 100, gaap: "MFRS", fx: "MYR", acquired: "2014-01-12", incentiveIds: [], completeness: 91, review: "Calculated", graph: { x: 180, y: 340 } },
  { id: "ID-CE", code: "ID001", name: "PT Aetherion Indonesia", jurisdiction: "Indonesia", iso: "ID", type: "CE", parentId: "SG-HC", ownership: 99, gaap: "PSAK", fx: "IDR", acquired: "2015-06-20", incentiveIds: [], completeness: 88, review: "Calculated", graph: { x: 320, y: 340 } },
  { id: "AE-CE", code: "AE001", name: "Aetherion MENA FZ-LLC", jurisdiction: "United Arab Emirates", iso: "AE", type: "CE", parentId: "SG-HC", ownership: 100, gaap: "IFRS", fx: "AED", acquired: "2021-04-01", incentiveIds: ["AE-FZ"], completeness: 79, review: "Mapped", graph: { x: 360, y: 250 } },
  { id: "UK-HC", code: "UK010", name: "Aetherion UK Ltd.", jurisdiction: "United Kingdom", iso: "GB", type: "HoldCo", parentId: "JP-UPE", ownership: 100, gaap: "UK IFRS", fx: "GBP", acquired: "2004-11-01", incentiveIds: [], completeness: 97, review: "Reviewed", graph: { x: 620, y: 140 } },
  { id: "DE-CE", code: "DE001", name: "Aetherion Germany GmbH", jurisdiction: "Germany", iso: "DE", type: "CE", parentId: "UK-HC", ownership: 100, gaap: "HGB/IFRS", fx: "EUR", acquired: "2006-02-01", incentiveIds: [], completeness: 99, review: "Approved", graph: { x: 540, y: 250 } },
  { id: "FR-CE", code: "FR001", name: "Aetherion France SAS", jurisdiction: "France", iso: "FR", type: "CE", parentId: "UK-HC", ownership: 100, gaap: "ANC/IFRS", fx: "EUR", acquired: "2008-05-01", incentiveIds: [], completeness: 95, review: "Reviewed", graph: { x: 680, y: 250 } },
  { id: "NL-CE", code: "NL001", name: "Aetherion Netherlands B.V.", jurisdiction: "Netherlands", iso: "NL", type: "CE", parentId: "UK-HC", ownership: 100, gaap: "NL IFRS", fx: "EUR", acquired: "2011-08-01", incentiveIds: ["NL-IP"], completeness: 93, review: "Calculated", graph: { x: 610, y: 340 } },
  { id: "HU-CE", code: "HU001", name: "Aetherion Hungary Kft.", jurisdiction: "Hungary", iso: "HU", type: "CE", parentId: "UK-HC", ownership: 100, gaap: "HAS/IFRS", fx: "HUF", acquired: "2018-01-15", incentiveIds: ["HU-DEV"], completeness: 86, review: "Validated", graph: { x: 740, y: 340 } },
  { id: "US-CE", code: "US001", name: "Aetherion Americas Inc.", jurisdiction: "United States", iso: "US", type: "CE", parentId: "JP-UPE", ownership: 100, gaap: "US GAAP", fx: "USD", acquired: "2001-09-01", incentiveIds: [], completeness: 97, review: "Reviewed", graph: { x: 860, y: 140 } },
  { id: "IE-CE", code: "IE001", name: "Aetherion Ireland Ltd.", jurisdiction: "Ireland", iso: "IE", type: "CE", parentId: "JP-UPE", ownership: 100, gaap: "IFRS", fx: "EUR", acquired: "2013-04-01", incentiveIds: ["IE-IP"], completeness: 92, review: "Prepared", graph: { x: 860, y: 250 } },
  { id: "TH-PE", code: "TH-PE1", name: "Aetherion (Thailand) Ltd. — Rayong PE", jurisdiction: "Thailand", iso: "TH", type: "PE", parentId: "TH-CE", ownership: 100, gaap: "TFRS", fx: "THB", acquired: "2019-02-01", incentiveIds: ["TH-BOI"], completeness: 84, review: "Mapped", graph: { x: 40, y: 340 } },
  { id: "SG-JV", code: "SG-JV1", name: "Aetherion-Keppel Logistics JV", jurisdiction: "Singapore", iso: "SG", type: "JV", parentId: "SG-HC", ownership: 50, gaap: "SFRS(I)", fx: "SGD", acquired: "2022-01-01", incentiveIds: [], completeness: 72, review: "Imported", graph: { x: 40, y: 180 } },
];

export const FINANCIALS: Financials[] = [
  { entityId: "JP-UPE", revenue: 210_000_000, fanil: 148_200_000, currentTax: 36_100_000, deferredTax: 1_400_000, otherCovered: 0, nonCovered: 420_000, payrollEligible: 62_000_000, employees: 1840, tangibleEligible: 84_000_000, cbcrRevenue: 210_400_000, cbcrProfit: 149_000_000, cbcrTax: 36_800_000, priorDta: 4_200_000, priorDtl: 6_100_000 },
  { entityId: "SG-HC", revenue: 18_000_000, fanil: 71_400_000, currentTax: 10_900_000, deferredTax: 380_000, otherCovered: 0, nonCovered: 90_000, payrollEligible: 9_400_000, employees: 62, tangibleEligible: 2_100_000, cbcrRevenue: 88_000_000, cbcrProfit: 72_200_000, cbcrTax: 11_400_000, priorDta: 210_000, priorDtl: 640_000 },
  { entityId: "TH-CE", revenue: 96_400_000, fanil: 44_820_000, currentTax: 4_120_000, deferredTax: 610_000, otherCovered: 0, nonCovered: 80_000, payrollEligible: 31_800_000, employees: 1240, tangibleEligible: 42_600_000, cbcrRevenue: 97_100_000, cbcrProfit: 45_200_000, cbcrTax: 4_280_000, priorDta: 1_120_000, priorDtl: 880_000 },
  { entityId: "VN-CE", revenue: 54_000_000, fanil: 31_250_000, currentTax: 3_620_000, deferredTax: 410_000, otherCovered: 0, nonCovered: 40_000, payrollEligible: 22_400_000, employees: 980, tangibleEligible: 28_900_000, cbcrRevenue: 54_600_000, cbcrProfit: 31_800_000, cbcrTax: 3_710_000, priorDta: 0, priorDtl: 310_000 },
  { entityId: "MY-CE", revenue: 41_000_000, fanil: 17_800_000, currentTax: 4_180_000, deferredTax: 210_000, otherCovered: 0, nonCovered: 20_000, payrollEligible: 11_200_000, employees: 410, tangibleEligible: 14_400_000, cbcrRevenue: 41_200_000, cbcrProfit: 18_000_000, cbcrTax: 4_250_000, priorDta: 180_000, priorDtl: 240_000 },
  { entityId: "ID-CE", revenue: 33_000_000, fanil: 14_900_000, currentTax: 3_180_000, deferredTax: 160_000, otherCovered: 0, nonCovered: 15_000, payrollEligible: 9_800_000, employees: 520, tangibleEligible: 12_200_000, cbcrRevenue: 33_400_000, cbcrProfit: 15_100_000, cbcrTax: 3_220_000, priorDta: 90_000, priorDtl: 140_000 },
  { entityId: "AE-CE", revenue: 28_000_000, fanil: 22_400_000, currentTax: 1_980_000, deferredTax: 40_000, otherCovered: 0, nonCovered: 0, payrollEligible: 6_100_000, employees: 48, tangibleEligible: 8_400_000, cbcrRevenue: 28_100_000, cbcrProfit: 22_500_000, cbcrTax: 1_990_000, priorDta: 0, priorDtl: 0 },
  { entityId: "UK-HC", revenue: 12_000_000, fanil: 8_400_000, currentTax: 1_596_000, deferredTax: 80_000, otherCovered: 0, nonCovered: 12_000, payrollEligible: 4_200_000, employees: 38, tangibleEligible: 1_100_000, cbcrRevenue: 12_200_000, cbcrProfit: 8_500_000, cbcrTax: 1_620_000, priorDta: 60_000, priorDtl: 90_000 },
  { entityId: "DE-CE", revenue: 188_000_000, fanil: 84_100_000, currentTax: 20_640_000, deferredTax: 720_000, otherCovered: 0, nonCovered: 110_000, payrollEligible: 48_000_000, employees: 760, tangibleEligible: 52_000_000, cbcrRevenue: 188_400_000, cbcrProfit: 84_600_000, cbcrTax: 21_100_000, priorDta: 2_400_000, priorDtl: 3_100_000 },
  { entityId: "FR-CE", revenue: 142_000_000, fanil: 61_200_000, currentTax: 15_180_000, deferredTax: 410_000, otherCovered: 0, nonCovered: 70_000, payrollEligible: 32_400_000, employees: 510, tangibleEligible: 29_800_000, cbcrRevenue: 142_200_000, cbcrProfit: 61_500_000, cbcrTax: 15_400_000, priorDta: 1_100_000, priorDtl: 1_800_000 },
  { entityId: "NL-CE", revenue: 67_000_000, fanil: 40_400_000, currentTax: 9_920_000, deferredTax: 380_000, otherCovered: 0, nonCovered: 40_000, payrollEligible: 14_800_000, employees: 190, tangibleEligible: 18_200_000, cbcrRevenue: 67_100_000, cbcrProfit: 40_600_000, cbcrTax: 10_050_000, priorDta: 420_000, priorDtl: 710_000 },
  { entityId: "HU-CE", revenue: 36_000_000, fanil: 27_800_000, currentTax: 2_480_000, deferredTax: 80_000, otherCovered: 0, nonCovered: 10_000, payrollEligible: 8_200_000, employees: 210, tangibleEligible: 11_400_000, cbcrRevenue: 36_200_000, cbcrProfit: 28_000_000, cbcrTax: 2_510_000, priorDta: 40_000, priorDtl: 60_000 },
  { entityId: "US-CE", revenue: 310_000_000, fanil: 94_200_000, currentTax: 19_410_000, deferredTax: 620_000, otherCovered: 0, nonCovered: 1_200_000, payrollEligible: 58_000_000, employees: 640, tangibleEligible: 71_000_000, cbcrRevenue: 311_000_000, cbcrProfit: 95_000_000, cbcrTax: 20_100_000, priorDta: 3_400_000, priorDtl: 5_200_000 },
  { entityId: "IE-CE", revenue: 204_000_000, fanil: 168_400_000, currentTax: 10_920_000, deferredTax: 740_000, otherCovered: 0, nonCovered: 60_000, payrollEligible: 18_600_000, employees: 86, tangibleEligible: 54_800_000, cbcrRevenue: 204_800_000, cbcrProfit: 169_100_000, cbcrTax: 11_200_000, priorDta: 210_000, priorDtl: 1_840_000 },
  { entityId: "TH-PE", revenue: 8_200_000, fanil: 1_140_000, currentTax: 90_000, deferredTax: 10_000, otherCovered: 0, nonCovered: 0, payrollEligible: 3_400_000, employees: 140, tangibleEligible: 6_800_000, cbcrRevenue: 8_200_000, cbcrProfit: 1_140_000, cbcrTax: 90_000, priorDta: 0, priorDtl: 0 },
  { entityId: "SG-JV", revenue: 14_000_000, fanil: 2_200_000, currentTax: 260_000, deferredTax: 20_000, otherCovered: 0, nonCovered: 0, payrollEligible: 1_800_000, employees: 22, tangibleEligible: 4_100_000, cbcrRevenue: 14_000_000, cbcrProfit: 2_200_000, cbcrTax: 260_000, priorDta: 0, priorDtl: 0 },
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
];

export const FILES: SourceFile[] = [
  { id: "F01", name: "Aetherion_Legal_Entity_List_FY2026.xlsx", kind: "Legal entity list", size: "1.2 MB", uploaded: "12 Aug 2026", by: "M. Sato", status: "Mapped", rows: 212 },
  { id: "F02", name: "TH001 Trial Balance FY2026.xlsx", kind: "Trial balance", entity: "TH-CE", size: "840 KB", uploaded: "12 Aug 2026", by: "N. Chai", status: "Mapped", rows: 1842 },
  { id: "F03", name: "FY2026 Consolidation pack.xlsx", kind: "Consolidation", size: "6.4 MB", uploaded: "11 Aug 2026", by: "Group Finance", status: "Validated", rows: 12840 },
  { id: "F04", name: "TH tax provision FY2026.xlsx", kind: "Tax provision", entity: "TH-CE", size: "420 KB", uploaded: "12 Aug 2026", by: "N. Chai", status: "Mapped" },
  { id: "F05", name: "CbCR_FY2026.xlsx", kind: "CbCR", size: "2.1 MB", uploaded: "10 Aug 2026", by: "M. Sato", status: "Validated", rows: 48 },
  { id: "F06", name: "BOI_Certificate_TH001.pdf", kind: "BOI certificate", entity: "TH-CE", size: "1.8 MB", uploaded: "09 Aug 2026", by: "N. Chai", status: "Mapped" },
  { id: "F07", name: "IE001 TB FY2026.xlsx", kind: "Trial balance", entity: "IE-CE", size: "1.1 MB", uploaded: "11 Aug 2026", by: "C. Walsh", status: "Mapped", rows: 960 },
  { id: "F08", name: "Fixed_asset_register_TH.xlsx", kind: "Fixed-asset register", entity: "TH-CE", size: "3.2 MB", uploaded: "08 Aug 2026", by: "TH Finance", status: "Imported", rows: 4200 },
  { id: "F09", name: "Payroll_TH_FY2026.csv", kind: "Payroll", entity: "TH-CE", size: "640 KB", uploaded: "08 Aug 2026", by: "TH Finance", status: "Mapped", rows: 1240 },
  { id: "F10", name: "Deferred_tax_rollforward.xlsx", kind: "Deferred tax", size: "980 KB", uploaded: "11 Aug 2026", by: "Group Tax", status: "Validated" },
  { id: "F11", name: "TP_Master_File_2026.pdf", kind: "TP report", size: "12 MB", uploaded: "07 Aug 2026", by: "A. Rivera", status: "Imported" },
  { id: "F12", name: "Prior_GIR_FY2025.xml", kind: "Previous GIR", size: "420 KB", uploaded: "06 Aug 2026", by: "M. Sato", status: "Imported" },
];

export const ISSUES: Issue[] = [
  { id: "IQ-01", severity: "block", area: "Covered tax", entity: "VN-CE", jurisdiction: "Vietnam", title: "Prior-year DTA/DTL missing", detail: "Vietnam deferred-tax opening balances are blank. Recapture and recast cannot be completed.", owner: "Local Tax VN" },
  { id: "IQ-02", severity: "block", area: "SBIE", entity: "VN-CE", jurisdiction: "Vietnam", title: "Payroll file incomplete", detail: "Eligible employee listing covers 11 of 12 months. SBIE payroll carve-out is estimated.", owner: "VN Finance" },
  { id: "IQ-03", severity: "warn", area: "Mapping", entity: "TH-CE", jurisdiction: "Thailand", title: "FX gain mapping at 62% confidence", detail: "Account 830010 — FX Gain needs tax-team approval before lock.", owner: "N. Chai" },
  { id: "IQ-04", severity: "warn", area: "CbCR", jurisdiction: "Singapore", title: "CbCR revenue vs consolidation", detail: "Singapore CbCR revenue $88.0M vs consolidation $86.4M (HoldCo + JV). $1.6M unexplained.", owner: "L. Tan" },
  { id: "IQ-05", severity: "info", area: "Ownership", entity: "ID-CE", jurisdiction: "Indonesia", title: "1% minority", detail: "PT Aetherion Indonesia is 99% owned. Confirm MOCE treatment is not required.", owner: "Group Tax" },
  { id: "IQ-06", severity: "warn", area: "Deferred tax", entity: "AE-CE", jurisdiction: "UAE", title: "Deferred tax movement unexplained", detail: "UAE CIT commencement created a DTL with no roll-forward narrative.", owner: "MENA Tax" },
];

export const INCENTIVES: Incentive[] = [
  { id: "TH-BOI", entityId: "TH-CE", name: "BOI — Electronics manufacturing (Rayong)", type: "Tax holiday / reduced CIT", start: "2019-02-01", end: "2028-01-31", rate: "0% CIT years 1–8; 50% reduction years 9–13", conditions: "Qualifying production at Rayong; eligible capex maintained; BOI reporting", sbtishEligible: true, extractedFrom: "BOI_Certificate_TH001.pdf" },
  { id: "VN-EIT", entityId: "VN-CE", name: "EIT incentive — high-tech", type: "Reduced CIT", start: "2016-09-01", end: "2026-12-31", rate: "10% CIT (standard 20%)", conditions: "High-tech certificate; headcount in Hanoi", sbtishEligible: true, extractedFrom: "VN_EIT_certificate.pdf" },
  { id: "IE-IP", entityId: "IE-CE", name: "Knowledge Development Box", type: "IP box", start: "2013-04-01", end: "2030-12-31", rate: "6.25% on qualifying IP profits", conditions: "Nexus ratio; qualifying assets", sbtishEligible: false, extractedFrom: "IE_KDB_election.pdf" },
  { id: "SG-DE", entityId: "SG-HC", name: "Development & Expansion Incentive", type: "Reduced CIT", start: "2022-01-01", end: "2027-12-31", rate: "5–10% on qualifying income", conditions: "Headcount and spending commitments", sbtishEligible: true, extractedFrom: "EDB_DEI_SG.pdf" },
  { id: "HU-DEV", entityId: "HU-CE", name: "Development tax allowance", type: "Tax credit / allowance", start: "2018-01-15", end: "2028-12-31", rate: "Up to 80% of CIT for 13 years", conditions: "Eligible capex; job creation", sbtishEligible: true, extractedFrom: "HU_dev_allowance.pdf" },
  { id: "AE-FZ", entityId: "AE-CE", name: "Free zone 0% (legacy)", type: "Free zone", start: "2021-04-01", end: "2026-05-31", rate: "0% on qualifying FZ income; 9% CIT otherwise", conditions: "Qualifying activities; substance", sbtishEligible: false, extractedFrom: "DMCC_license.pdf" },
  { id: "NL-IP", entityId: "NL-CE", name: "Innovation box", type: "IP box", start: "2011-08-01", end: "2030-12-31", rate: "9% effective on qualifying profits", conditions: "WBSO / nexus", sbtishEligible: false, extractedFrom: "NL_innovation_box.pdf" },
];

export const FILINGS: Filing[] = [
  { id: "FL-TH-Q", jurisdiction: "Thailand", requirement: "QDMTT return", deadline: "30 Jun 2028", status: "Preparing", preparer: "N. Chai", reviewer: "M. Sato" },
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
  { iso: "TH", name: "Thailand", iir: false, qdmtt: true, qdmttSH: true, utpr: false, from: "2025-01-01", qualified: "Transitional qualified QDMTT", filing: "QDMTT return", fx: "THB", notes: "QDMTT Safe Harbour available once qualified status holds." },
  { iso: "SG", name: "Singapore", iir: true, qdmtt: true, qdmttSH: true, utpr: true, from: "2025-01-01", qualified: "Transitional qualified", filing: "GIR notification + MTT", fx: "SGD", notes: "HoldCo jurisdiction. DEI incentive in force." },
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

import type { AccountMap, Adjustment, Entity, Filing, Financials, Group, Incentive, Issue, SourceFile } from "../model";
import type { GroupSeed, JurisdictionPack } from "./types";

/**
 * Aetherion Group — the original GMT24 teaching dataset. Japanese UPE (Nippon
 * Aether Holdings K.K.), Singapore HoldCo, Thai BOI manufacturer with a Rayong
 * PE, Irish IP, European QDMTT jurisdictions, a UK POPE, Malaysian MOSG,
 * Singapore JV and shipping CE. FY April 2026 – March 2027, USD presentation.
 * Every figure is fictional.
 */
const group: Group = {
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
};

const inhouseUser = {
  name: "Mika Sato",
  role: "Group Tax Director",
  initials: "MS",
  email: "m.sato@aetherion.com",
  org: "Aetherion Group",
};

const entities: Entity[] = [
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

const financials: Financials[] = [
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

const adjustments: Adjustment[] = [
  { id: "ADJ-TH-01", entityId: "TH-CE", category: "Excluded dividends", original: 1_840_000, amount: -1_840_000, reason: "Intra-group dividend from MY-CE, ownership ≥ 10%, excluded under Art. 3.2.1(b)", ruleId: "OECD-DIV-EXCL", sourceDoc: "TH001 Trial Balance FY2026.xlsx", account: "810020", preparer: "N. Chai", reviewer: "M. Sato", status: "Reviewed" },
  { id: "ADJ-TH-02", entityId: "TH-CE", category: "Net tax expense", original: 4_730_000, amount: -280_000, reason: "Remove non-covered local business tax included in tax expense", ruleId: "OECD-GloBE-15", sourceDoc: "TH tax provision FY2026.xlsx", account: "720050", preparer: "N. Chai", reviewer: "M. Sato", status: "Reviewed" },
  { id: "ADJ-TH-03", entityId: "TH-CE", category: "FX / as-if", original: 410_000, amount: 0, reason: "Unrealised FX on intra-group EUR loan — reviewed, no GloBE adjustment for FY2026", ruleId: "OECD-GloBE-15", sourceDoc: "TH001 Trial Balance FY2026.xlsx", account: "830010", preparer: "N. Chai", reviewer: null, status: "Prepared" },
  { id: "ADJ-IE-01", entityId: "IE-CE", category: "Excluded dividends", original: 4_200_000, amount: -4_200_000, reason: "Dividend from NL-CE excluded", ruleId: "OECD-DIV-EXCL", sourceDoc: "IE001 TB FY2026.xlsx", account: "810020", preparer: "C. Walsh", reviewer: "A. Rivera", status: "Reviewed" },
  { id: "ADJ-IE-02", entityId: "IE-CE", category: "Stock-based compensation", original: 1_100_000, amount: 800_000, reason: "Replace accounting SBC with amount allowed as tax deduction", ruleId: "OECD-GloBE-15", sourceDoc: "IE payroll & SBC FY2026.xlsx", account: "610020", preparer: "C. Walsh", reviewer: "A. Rivera", status: "Reviewed" },
  { id: "ADJ-VN-01", entityId: "VN-CE", category: "Policy disallowed", original: 420_000, amount: 420_000, reason: "Illegal payment / fines add-back", ruleId: "OECD-GloBE-15", sourceDoc: "VN001 TB FY2026.xlsx", account: "650400", preparer: "Local Tax VN", reviewer: null, status: "Validated" },
  { id: "ADJ-SG-01", entityId: "SG-HC", category: "Excluded dividends", original: 2_100_000, amount: -2_100_000, reason: "Dividends from TH-CE / VN-CE", ruleId: "OECD-DIV-EXCL", sourceDoc: "SG consolidation pack FY2026.xlsx", account: "810020", preparer: "L. Tan", reviewer: "M. Sato", status: "Reviewed" },
];

const accounts: AccountMap[] = [
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

const files: SourceFile[] = [
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

const issues: Issue[] = [
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
  { id: "IQ-12", severity: "info", area: "ETR", entity: "HK-CE", jurisdiction: "Hong Kong", title: "Art. 5.2.1 — Excess Negative Tax Expense (mandatory)", detail: "Hong Kong Net GloBE Income is positive and Adjusted Covered Taxes are negative. Bare Art. 5.2.1 would show a negative ETR and Top-up % above 15% (15% − (−15%) = 30%). OECD Feb 2023 AG makes Excess Negative Tax Expense mandatory: exclude the negative tax from this year’s ETR (floor 0%), Top-up % = 15%, and carry the amount forward. Not Art. 4.1.5 — that needs a GloBE Loss.", owner: "Group Tax" },
  { id: "IQ-13", severity: "info", area: "GloBE income", entity: "SG-SHIP", jurisdiction: "Singapore", title: "Art. 3.4 — International Shipping Income excluded", detail: "SG020 posts Art. 3.4.2 ISI $5.0M and Art. 3.4.3 ancillary $3.2M. QAISI is capped at 50% of ISI ($2.5M); $0.7M excess ancillary stays in GloBE. Related Covered Taxes $0.75M and shipping payroll/assets come out of SBIE. Management test (Art. 3.4.5) is met in Singapore.", owner: "L. Tan" },
  { id: "IQ-14", severity: "info", area: "GloBE income", entity: "HK-CE", jurisdiction: "Hong Kong", title: "Art. 3.4.5 — shipping not excluded", detail: "HK001 has feeder shipping income in FANIL. Strategic and commercial management of the ships is in Singapore, not Hong Kong. Art. 3.4.5 fails; ISI and ancillary stay in GloBE. Negative Covered Taxes still go through the mandatory Art. 5.2.1 ENTE path.", owner: "Group Tax" },
];

const incentives: Incentive[] = [
  { id: "TH-BOI", entityId: "TH-CE", name: "BOI — Electronics manufacturing (Rayong)", type: "Tax holiday / reduced CIT", start: "2019-02-01", end: "2028-01-31", rate: "0% CIT years 1–8; 50% reduction years 9–13", conditions: "Qualifying production at Rayong; eligible capex maintained; BOI reporting", sbtishEligible: true, extractedFrom: "BOI_Certificate_TH001.pdf" },
  { id: "TH-BOI-AUTO", entityId: "TH-CE", name: "BOI — Productivity / automation (Rayong)", type: "Tax holiday", start: "2024-03-01", end: "2032-02-28", rate: "0% CIT years 1–8", conditions: "Eligible automation capex; separate project accounts; BOI reporting", sbtishEligible: true, extractedFrom: "BOI_Certificate_TH001_annex_automation.pdf" },
  { id: "VN-EIT", entityId: "VN-CE", name: "EIT incentive — high-tech", type: "Reduced CIT", start: "2016-09-01", end: "2026-12-31", rate: "10% CIT (standard 20%)", conditions: "High-tech certificate; headcount in Hanoi", sbtishEligible: true, extractedFrom: "VN_EIT_certificate.pdf" },
  { id: "IE-IP", entityId: "IE-CE", name: "Knowledge Development Box", type: "IP box", start: "2013-04-01", end: "2030-12-31", rate: "6.25% on qualifying IP profits", conditions: "Nexus ratio; qualifying assets", sbtishEligible: false, extractedFrom: "IE_KDB_election.pdf" },
  { id: "SG-DE", entityId: "SG-HC", name: "Development & Expansion Incentive", type: "Reduced CIT", start: "2022-01-01", end: "2027-12-31", rate: "5–10% on qualifying income", conditions: "Headcount and spending commitments", sbtishEligible: true, extractedFrom: "EDB_DEI_SG.pdf" },
  { id: "HU-DEV", entityId: "HU-CE", name: "Development tax allowance", type: "Tax credit / allowance", start: "2018-01-15", end: "2028-12-31", rate: "Up to 80% of CIT for 13 years", conditions: "Eligible capex; job creation", sbtishEligible: true, extractedFrom: "HU_dev_allowance.pdf" },
  { id: "AE-FZ", entityId: "AE-CE", name: "Free zone 0% (legacy)", type: "Free zone", start: "2021-04-01", end: "2026-05-31", rate: "0% on qualifying FZ income; 9% CIT otherwise", conditions: "Qualifying activities; substance", sbtishEligible: false, extractedFrom: "DMCC_license.pdf" },
  { id: "NL-IP", entityId: "NL-CE", name: "Innovation box", type: "IP box", start: "2011-08-01", end: "2030-12-31", rate: "9% effective on qualifying profits", conditions: "WBSO / nexus", sbtishEligible: false, extractedFrom: "NL_innovation_box.pdf" },
];

const filings: Filing[] = [
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

const packs: JurisdictionPack[] = [
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
  { iso: "HK", name: "Hong Kong", iir: false, qdmtt: false, qdmttSH: false, utpr: false, from: "—", qualified: "Not on Central Record (demo)", filing: "Notification only", fx: "HKD", notes: "Art. 5.2.1 ENTE teaching case — positive Net GloBE Income and negative Covered Taxes. Mandatory Excess Negative Tax Expense floors ETR at 0% so Top-up % is 15%. Residual to JP IIR. Art. 3.4.5 fail: feeder shipping in FANIL is not excluded (ships managed from Singapore)." },
  { iso: "XX", name: "Stateless", iir: false, qdmtt: false, qdmttSH: false, utpr: false, from: "—", qualified: "n/a", filing: "Allocated with UPE IIR / UTPR", fx: "USD", notes: "Each Stateless CE is its own jurisdiction (Art. 10.3.4)." },
];

const girSections: GroupSeed["girSections"] = [
  { id: "A", title: "Filing obligation & MNE group", status: "Complete", fields: 24, missing: 0 },
  { id: "B", title: "Corporate structure", status: "Complete", fields: 212, missing: 0 },
  { id: "C", title: "ETR / Top-up tax by jurisdiction", status: "In review", fields: 48, missing: 2 },
  { id: "D", title: "Safe harbours & elections", status: "In review", fields: 48, missing: 1 },
  { id: "E", title: "QDMTT / IIR / UTPR allocation", status: "Draft", fields: 14, missing: 0 },
];

const activity: GroupSeed["activity"] = [
  { text: "Thailand QDMTT calculation locked for review — $1.55M", who: "N. Chai", when: "13 Aug, 16:40" },
  { text: "AI mapping approved for TH001 accounts 610001–720050", who: "M. Sato", when: "13 Aug, 14:12" },
  { text: "Data request sent to Vietnam finance: DTA/DTL + payroll", who: "GMT24 Gap Hunter", when: "13 Aug, 11:05" },
  { text: "Ireland KDB treatment flagged by AI Reviewer (SBTISH: no)", who: "AI Reviewer", when: "12 Aug, 18:22" },
  { text: "Central GIR XML draft generated — schema 2026.1", who: "GIR Autopilot", when: "12 Aug, 09:14" },
];

const forecast: GroupSeed["forecast"] = [
  { period: "Q1 actual", topUp: 2_100_000 },
  { period: "Q2 actual", topUp: 3_400_000 },
  { period: "Q3 forecast", topUp: 4_200_000 },
  { period: "Q4 forecast", topUp: 5_100_000 },
];

const populationPool = [
  ["JP", "Japan"], ["SG", "Singapore"], ["TH", "Thailand"], ["VN", "Vietnam"],
  ["MY", "Malaysia"], ["ID", "Indonesia"], ["AE", "United Arab Emirates"], ["GB", "United Kingdom"],
  ["DE", "Germany"], ["FR", "France"], ["NL", "Netherlands"], ["HU", "Hungary"],
  ["US", "United States"], ["IE", "Ireland"], ["LU", "Luxembourg"], ["HK", "Hong Kong"],
  ["AU", "Australia"], ["AT", "Austria"], ["BE", "Belgium"], ["BR", "Brazil"],
  ["CA", "Canada"], ["CH", "Switzerland"], ["CN", "China"], ["CZ", "Czech Republic"],
  ["DK", "Denmark"], ["ES", "Spain"], ["FI", "Finland"], ["GR", "Greece"],
  ["IN", "India"], ["IT", "Italy"], ["KR", "Korea"], ["MX", "Mexico"],
  ["NO", "Norway"], ["NZ", "New Zealand"], ["PH", "Philippines"], ["PL", "Poland"],
  ["PT", "Portugal"], ["RO", "Romania"], ["SA", "Saudi Arabia"], ["SE", "Sweden"],
  ["SK", "Slovakia"], ["TR", "Türkiye"], ["TW", "Chinese Taipei"], ["ZA", "South Africa"],
  ["KH", "Cambodia"], ["LA", "Lao PDR"], ["BD", "Bangladesh"], ["LK", "Sri Lanka"],
] as const;

export const AETHERION: GroupSeed = {
  id: "aetherion",
  group,
  inhouseUser,
  entities,
  financials,
  adjustments,
  accounts,
  files,
  issues,
  incentives,
  filings,
  packs,
  girSections,
  activity,
  forecast,
  populationPool,
  demo: {
    label: "Aetherion Group demo",
    story: "Japanese-parent manufacturer with a Thai BOI subsidiary — the Thai-CE-of-a-foreign-UPE case.",
    loginEmail: "m.sato@aetherion.com",
    entityListFile: "Aetherion_Legal_Entity_List_FY2026.csv",
    packName: "Aetherion FY2026 demo pack",
    samples: [
      { name: "TH001 Trial Balance FY2026.csv", href: "/demo/TH001_Trial_Balance_FY2026.csv", kind: "Trial balance", note: "12 accounts · TH-CE · maps to Art. 3.2 adjustments" },
      { name: "Aetherion Legal Entity List FY2026.csv", href: "/demo/Aetherion_Legal_Entity_List_FY2026.csv", kind: "Legal entity list", note: "Sample CE rows · ownership and GAAP" },
      { name: "Payroll TH FY2026.csv", href: "/demo/Payroll_TH_FY2026.csv", kind: "Payroll", note: "Eligible payroll for SBIE carve-out" },
    ],
  },
};

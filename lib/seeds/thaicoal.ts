import type { AccountMap, Adjustment, Entity, Filing, Financials, Group, Incentive, Issue, SourceFile } from "../model";
import type { GroupSeed, JurisdictionPack } from "./types";

/**
 * ThaiCoal PCL — second GMT24 teaching dataset. A Thai-listed energy group
 * with a Thai UPE: coal trading and mining at the parent, a listed power
 * subsidiary (78% — a POPE), a Singapore trading hub on a 10% incentive, a
 * listed Indonesian miner (65% — a POPE inside a QDMTT country), Australian
 * mines in loss, US shale gas and power under Side-by-Side, Japanese and
 * Chinese power plants under the POPE, a 40% Lao lignite associate outside
 * the perimeter, a 50/50 Vietnamese wind JV and a de-minimis Mongolian
 * explorer. Calendar FY2026, USD presentation, with FY2026 a strong
 * coal-price year: revenue about $6.2bn and GloBE income just over $1bn.
 * Every name and figure is fictional; the shape is modelled on a Thai
 * energy conglomerate.
 */
const group: Group = {
  id: "thaicoal",
  name: "ThaiCoal PCL",
  upe: "ThaiCoal Public Company Limited",
  upeIso: "TH",
  fy: "FY2026",
  fyStart: "2026-01-01",
  fyEnd: "2026-12-31",
  currency: "USD",
  revenueHistory: [
    { fy: "FY2023", amount: 5_160_000_000 },
    { fy: "FY2024", amount: 5_430_000_000 },
    { fy: "FY2025", amount: 4_880_000_000 },
    { fy: "FY2026", amount: 6_240_000_000 },
  ],
  entities: 96,
  jurisdictions: 11,
  workflow: "Calculated",
  advisor: "7-L Advisory",
  upeTin: "0107536000781",
};

const inhouseUser = {
  name: "Kanya Suksawat",
  role: "Head of Group Tax",
  initials: "KS",
  email: "k.suksawat@thaicoal.co.th",
  org: "ThaiCoal PCL",
};

const entities: Entity[] = [
  { id: "TC-UPE", code: "TC001", name: "ThaiCoal Public Company Limited", jurisdiction: "Thailand", iso: "TH", type: "UPE", parentId: null, ownership: 100, gaap: "TFRS", fx: "THB", acquired: "1983-05-16", incentiveIds: [], completeness: 97, review: "Reviewed", graph: { x: 450, y: 36 } },
  { id: "TC-TH-PWR", code: "TC010", name: "ThaiCoal Power Public Company Limited", jurisdiction: "Thailand", iso: "TH", type: "HoldCo", parentId: "TC-UPE", ownership: 78, gaap: "TFRS", fx: "THB", acquired: "1996-12-01", incentiveIds: [], completeness: 95, review: "Reviewed", graph: { x: 260, y: 140 } },
  { id: "TC-TH-NRG", code: "TC031", name: "ThaiCoal NextGen Energy Co., Ltd.", jurisdiction: "Thailand", iso: "TH", type: "CE", parentId: "TC-TH-PWR", ownership: 100, gaap: "TFRS", fx: "THB", acquired: "2017-06-01", incentiveIds: ["TC-BOI-SOLAR"], completeness: 90, review: "Prepared", graph: { x: 150, y: 250 } },
  { id: "TC-TH-MIN", code: "TC020", name: "ThaiCoal Minerals & Logistics Co., Ltd.", jurisdiction: "Thailand", iso: "TH", type: "CE", parentId: "TC-UPE", ownership: 100, gaap: "TFRS", fx: "THB", acquired: "2001-03-01", incentiveIds: [], completeness: 93, review: "Calculated", graph: { x: 380, y: 250 } },
  { id: "TC-SG-HC", code: "TC040", name: "ThaiCoal Singapore Pte. Ltd.", jurisdiction: "Singapore", iso: "SG", type: "HoldCo", parentId: "TC-UPE", ownership: 100, gaap: "SFRS(I)", fx: "SGD", acquired: "2011-08-01", incentiveIds: ["TC-SG-GTP"], completeness: 92, review: "Calculated", graph: { x: 560, y: 140 } },
  { id: "TC-SG-REN", code: "TC041", name: "ThaiCoal Renewables Asia Pte. Ltd.", jurisdiction: "Singapore", iso: "SG", type: "HoldCo", parentId: "TC-TH-PWR", ownership: 100, gaap: "SFRS(I)", fx: "SGD", acquired: "2020-02-01", incentiveIds: [], completeness: 86, review: "Mapped", graph: { x: 60, y: 140 } },
  { id: "TC-ID-COAL", code: "TC050", name: "PT ThaiCoal Indo Tbk", jurisdiction: "Indonesia", iso: "ID", type: "CE", parentId: "TC-SG-HC", ownership: 65, gaap: "PSAK", fx: "IDR", acquired: "2001-04-01", incentiveIds: [], completeness: 94, review: "Reviewed", graph: { x: 640, y: 250 } },
  { id: "TC-ID-MINE", code: "TC051", name: "PT ThaiCoal Kalimantan Mining", jurisdiction: "Indonesia", iso: "ID", type: "CE", parentId: "TC-ID-COAL", ownership: 99, gaap: "PSAK", fx: "IDR", acquired: "2003-01-01", incentiveIds: [], completeness: 91, review: "Calculated", graph: { x: 700, y: 340 } },
  { id: "TC-AU-COAL", code: "TC060", name: "ThaiCoal Australia Pty Ltd", jurisdiction: "Australia", iso: "AU", type: "CE", parentId: "TC-UPE", ownership: 100, gaap: "AASB / IFRS", fx: "AUD", acquired: "2010-10-01", incentiveIds: [], completeness: 89, review: "Validated", graph: { x: 820, y: 140 } },
  { id: "TC-US-GAS", code: "TC070", name: "ThaiCoal Energy US Corp.", jurisdiction: "United States", iso: "US", type: "CE", parentId: "TC-UPE", ownership: 75, gaap: "US GAAP", fx: "USD", acquired: "2016-03-01", incentiveIds: [], completeness: 90, review: "Reviewed", graph: { x: 820, y: 250 } },
  { id: "TC-US-PWR", code: "TC071", name: "ThaiCoal Power US LLC", jurisdiction: "United States", iso: "US", type: "CE", parentId: "TC-US-GAS", ownership: 100, gaap: "US GAAP", fx: "USD", acquired: "2021-11-01", incentiveIds: [], completeness: 88, review: "Calculated", graph: { x: 880, y: 340 } },
  { id: "TC-JP-PWR", code: "TC080", name: "ThaiCoal Power Japan K.K.", jurisdiction: "Japan", iso: "JP", type: "CE", parentId: "TC-TH-PWR", ownership: 100, gaap: "J-GAAP / IFRS", fx: "JPY", acquired: "2018-09-01", incentiveIds: [], completeness: 92, review: "Reviewed", graph: { x: 200, y: 340 } },
  { id: "TC-CN-PWR", code: "TC090", name: "ThaiCoal Power (Shanxi) Co., Ltd.", jurisdiction: "China", iso: "CN", type: "CE", parentId: "TC-TH-PWR", ownership: 100, gaap: "CAS / IFRS", fx: "CNY", acquired: "2009-05-01", incentiveIds: ["TC-CN-HNTE"], completeness: 85, review: "Validated", graph: { x: 300, y: 340 } },
  { id: "TC-LA-ASSOC", code: "TC095", name: "ThaiCoal-Lao Lignite Power Co., Ltd.", jurisdiction: "Lao PDR", iso: "LA", type: "Excluded", parentId: "TC-TH-PWR", ownership: 40, gaap: "LFRS / IFRS", fx: "LAK", acquired: "2010-01-01", equityMethod: true, excludedReason: "Equity-accounted associate (40%). Not consolidated line by line, and UPE look-through 31.2% is below the 50% Art. 10.1 Joint Venture test — outside the GloBE perimeter. Dividends received are excluded income upstream (Art. 3.2.1(b)).", incentiveIds: [], completeness: 100, review: "Reviewed", graph: { x: 40, y: 340 } },
  { id: "TC-VN-JV", code: "TC-JV1", name: "ThaiCoal-Trang Wind Power JV", jurisdiction: "Vietnam", iso: "VN", type: "JV", parentId: "TC-UPE", ownership: 50, gaap: "VAS / IFRS", fx: "VND", acquired: "2022-04-01", equityMethod: true, incentiveIds: ["TC-VN-EIT"], completeness: 80, review: "Validated", graph: { x: 480, y: 250 } },
  { id: "TC-MN-MINE", code: "TC098", name: "ThaiCoal Mongolia LLC", jurisdiction: "Mongolia", iso: "MN", type: "CE", parentId: "TC-UPE", ownership: 100, gaap: "IFRS", fx: "MNT", acquired: "2012-07-01", incentiveIds: [], completeness: 74, review: "Imported", graph: { x: 560, y: 340 } },
];

const financials: Financials[] = [
  { entityId: "TC-UPE", revenue: 2_592_000_000, fanil: 321_000_000, currentTax: 14_250_000, deferredTax: -1_800_000, otherCovered: 0, nonCovered: 930_000, payrollEligible: 48_000_000, employees: 640, tangibleEligible: 212_000_000, cbcrRevenue: 2_592_000_000, cbcrProfit: 321_000_000, cbcrTax: 12_450_000, priorDta: 6_400_000, priorDtl: 3_100_000 },
  { entityId: "TC-TH-PWR", revenue: 428_000_000, fanil: 145_500_000, currentTax: 10_350_000, deferredTax: 600_000, otherCovered: 0, nonCovered: 270_000, payrollEligible: 22_000_000, employees: 310, tangibleEligible: 124_000_000, cbcrRevenue: 428_000_000, cbcrProfit: 145_500_000, cbcrTax: 10_950_000, priorDta: 1_200_000, priorDtl: 2_400_000 },
  { entityId: "TC-TH-NRG", revenue: 162_000_000, fanil: 61_500_000, currentTax: 1_350_000, deferredTax: 300_000, otherCovered: 0, nonCovered: 135_000, payrollEligible: 9_000_000, employees: 240, tangibleEligible: 262_000_000, cbcrRevenue: 162_000_000, cbcrProfit: 61_500_000, cbcrTax: 1_650_000, priorDta: 400_000, priorDtl: 5_800_000 },
  { entityId: "TC-TH-MIN", revenue: 116_100_000, fanil: 16_500_000, currentTax: 3_300_000, deferredTax: 150_000, otherCovered: 0, nonCovered: 60_000, payrollEligible: 12_000_000, employees: 380, tangibleEligible: 41_000_000, cbcrRevenue: 116_100_000, cbcrProfit: 16_500_000, cbcrTax: 3_450_000, priorDta: 300_000, priorDtl: 600_000 },
  { entityId: "TC-SG-HC", revenue: 2_214_000_000, fanil: 93_000_000, currentTax: 8_700_000, deferredTax: 450_000, otherCovered: 0, nonCovered: 0, payrollEligible: 14_000_000, employees: 95, tangibleEligible: 6_000_000, cbcrRevenue: 2_216_600_000, cbcrProfit: 93_000_000, cbcrTax: 9_150_000, priorDta: 200_000, priorDtl: 900_000 },
  { entityId: "TC-SG-REN", revenue: 3_000_000, fanil: 13_800_000, currentTax: 150_000, deferredTax: 0, otherCovered: 0, nonCovered: 0, payrollEligible: 1_100_000, employees: 8, tangibleEligible: 400_000, cbcrRevenue: 3_000_000, cbcrProfit: 13_800_000, cbcrTax: 150_000, priorDta: 0, priorDtl: 0 },
  { entityId: "TC-ID-COAL", revenue: 2_808_000_000, fanil: 444_000_000, currentTax: 106_500_000, deferredTax: 3_150_000, otherCovered: 0, nonCovered: 7_200_000, payrollEligible: 62_000_000, employees: 2_900, tangibleEligible: 380_000_000, cbcrRevenue: 2_808_000_000, cbcrProfit: 444_000_000, cbcrTax: 109_650_000, priorDta: 3_200_000, priorDtl: 18_400_000 },
  { entityId: "TC-ID-MINE", revenue: 324_000_000, fanil: 46_500_000, currentTax: 11_100_000, deferredTax: 450_000, otherCovered: 0, nonCovered: 0, payrollEligible: 18_000_000, employees: 1_100, tangibleEligible: 96_000_000, cbcrRevenue: 324_000_000, cbcrProfit: 46_500_000, cbcrTax: 11_550_000, priorDta: 400_000, priorDtl: 2_900_000 },
  { entityId: "TC-AU-COAL", revenue: 923_400_000, fanil: -63_000_000, currentTax: 0, deferredTax: -7_500_000, otherCovered: 0, nonCovered: 0, payrollEligible: 138_000_000, employees: 1_450, tangibleEligible: 410_000_000, cbcrRevenue: 923_400_000, cbcrProfit: -63_000_000, cbcrTax: -7_500_000, priorDta: 21_000_000, priorDtl: 9_000_000 },
  { entityId: "TC-US-GAS", revenue: 972_000_000, fanil: 144_000_000, currentTax: 6_300_000, deferredTax: 25_200_000, otherCovered: 0, nonCovered: 0, payrollEligible: 41_000_000, employees: 380, tangibleEligible: 620_000_000, cbcrRevenue: 972_000_000, cbcrProfit: 144_000_000, cbcrTax: 31_500_000, priorDta: 2_000_000, priorDtl: 58_000_000 },
  { entityId: "TC-US-PWR", revenue: 190_000_000, fanil: 36_000_000, currentTax: 2_700_000, deferredTax: 4_950_000, otherCovered: 0, nonCovered: 0, payrollEligible: 6_000_000, employees: 60, tangibleEligible: 310_000_000, cbcrRevenue: 190_000_000, cbcrProfit: 36_000_000, cbcrTax: 7_650_000, priorDta: 300_000, priorDtl: 14_000_000 },
  { entityId: "TC-JP-PWR", revenue: 48_000_000, fanil: 13_500_000, currentTax: 3_900_000, deferredTax: 300_000, otherCovered: 0, nonCovered: 0, payrollEligible: 2_400_000, employees: 22, tangibleEligible: 84_000_000, cbcrRevenue: 48_000_000, cbcrProfit: 13_500_000, cbcrTax: 4_200_000, priorDta: 100_000, priorDtl: 1_900_000 },
  { entityId: "TC-CN-PWR", revenue: 212_000_000, fanil: 54_000_000, currentTax: 6_900_000, deferredTax: 450_000, otherCovered: 0, nonCovered: 390_000, payrollEligible: 9_000_000, employees: 520, tangibleEligible: 150_000_000, cbcrRevenue: 212_000_000, cbcrProfit: 54_000_000, cbcrTax: 7_350_000, priorDta: 800_000, priorDtl: 2_100_000 },
  { entityId: "TC-LA-ASSOC", revenue: 0, fanil: 0, currentTax: 0, deferredTax: 0, otherCovered: 0, nonCovered: 0, payrollEligible: 0, employees: 0, tangibleEligible: 0, cbcrRevenue: 0, cbcrProfit: 0, cbcrTax: 0, priorDta: 0, priorDtl: 0 },
  { entityId: "TC-VN-JV", revenue: 96_000_000, fanil: 33_000_000, currentTax: 600_000, deferredTax: 0, otherCovered: 0, nonCovered: 0, payrollEligible: 3_000_000, employees: 45, tangibleEligible: 182_000_000, cbcrRevenue: 96_000_000, cbcrProfit: 33_000_000, cbcrTax: 600_000, priorDta: 100_000, priorDtl: 0 },
  { entityId: "TC-MN-MINE", revenue: 6_200_000, fanil: 420_000, currentTax: 60_000, deferredTax: 0, otherCovered: 0, nonCovered: 0, payrollEligible: 1_900_000, employees: 85, tangibleEligible: 3_400_000, cbcrRevenue: 6_200_000, cbcrProfit: 420_000, cbcrTax: 60_000, priorDta: 0, priorDtl: 0 },
];

const adjustments: Adjustment[] = [
  { id: "ADJ-TC-01", entityId: "TC-UPE", category: "Excluded dividends", original: 186_000_000, amount: -186_000_000, reason: "Dividends from PT ThaiCoal Indo Tbk, ThaiCoal Singapore and ThaiCoal Power PCL — ownership ≥ 10%, excluded under Art. 3.2.1(b)", ruleId: "OECD-DIV-EXCL", sourceDoc: "TC001 Trial Balance FY2026.xlsx", account: "810020", preparer: "P. Wongchai", reviewer: "K. Suksawat", status: "Reviewed" },
  { id: "ADJ-TC-02", entityId: "TC-UPE", category: "Net tax expense", original: 15_180_000, amount: -930_000, reason: "Remove signboard tax and local development levies booked in tax expense — not Covered Taxes", ruleId: "OECD-GloBE-15", sourceDoc: "TC tax provision FY2026.xlsx", account: "720050", preparer: "P. Wongchai", reviewer: "K. Suksawat", status: "Reviewed" },
  { id: "ADJ-TC-03", entityId: "TC-TH-PWR", category: "Excluded dividends", original: 88_000_000, amount: -88_000_000, reason: "Dividends from the Japan and China power CEs and the Lao associate — Art. 3.2.1(b); the associate sits outside the GloBE perimeter", ruleId: "OECD-DIV-EXCL", sourceDoc: "TC010 Trial Balance FY2026.xlsx", account: "810020", preparer: "S. Thongdee", reviewer: "K. Suksawat", status: "Reviewed" },
  { id: "ADJ-TC-04", entityId: "TC-SG-REN", category: "Excluded dividends", original: 12_300_000, amount: -12_300_000, reason: "Dividends from Asian solar portfolio companies, ownership ≥ 10%", ruleId: "OECD-DIV-EXCL", sourceDoc: "TC041 TB FY2026.xlsx", account: "810020", preparer: "J. Lim", reviewer: null, status: "Prepared" },
  { id: "ADJ-TC-05", entityId: "TC-CN-PWR", category: "Policy disallowed", original: 600_000, amount: 600_000, reason: "Environmental fines and late-payment penalties add-back — Art. 3.2.1(g)", ruleId: "OECD-GloBE-15", sourceDoc: "TC090 TB FY2026.xlsx", account: "650400", preparer: "Local Tax CN", reviewer: null, status: "Validated" },
  { id: "ADJ-TC-06", entityId: "TC-AU-COAL", category: "FX / as-if", original: 3_400_000, amount: 0, reason: "Rehabilitation provision unwinding and USD debt FX reviewed — no GloBE adjustment; tax functional currency matches", ruleId: "OECD-GloBE-15", sourceDoc: "TC060 TB FY2026.xlsx", account: "830010", preparer: "R. Hughes", reviewer: null, status: "Prepared" },
];

const accounts: AccountMap[] = [
  { account: "410000", name: "Revenue — coal sales (domestic)", entityId: "TC-UPE", financial: "Revenue", globe: "FANIL — revenue", confidence: 99, approved: true, amount: 1_120_000_000 },
  { account: "420000", name: "Revenue — coal export & trading", entityId: "TC-UPE", financial: "Revenue", globe: "FANIL — revenue", confidence: 99, approved: true, amount: 800_000_000 },
  { account: "610001", name: "Staff cost", entityId: "TC-UPE", financial: "Payroll", globe: "FANIL — opex", adjustment: "None", sbie: "Eligible payroll", confidence: 98, approved: true, amount: 39_000_000 },
  { account: "610020", name: "Bonus & provident fund", entityId: "TC-UPE", financial: "Payroll", globe: "FANIL — opex", adjustment: "None", sbie: "Eligible payroll", confidence: 96, approved: true, amount: 9_000_000 },
  { account: "610030", name: "Retirement benefit accrual (TFRS)", entityId: "TC-UPE", financial: "Payroll / pension", globe: "Art. 3.2.3 pension adjustment", adjustment: "Book expense → contributions paid (+$0.40M)", confidence: 78, approved: false, amount: 1_600_000 },
  { account: "720050", name: "Income tax", entityId: "TC-UPE", financial: "Current tax", globe: "Covered tax — current", coveredTax: "Covered", confidence: 99, approved: true, amount: 9_500_000 },
  { account: "720060", name: "Deferred income tax", entityId: "TC-UPE", financial: "Deferred tax", globe: "Covered tax — deferred", coveredTax: "Covered — recast 15%", confidence: 90, approved: true, amount: -1_200_000 },
  { account: "720080", name: "Signboard tax & local levies", entityId: "TC-UPE", financial: "Other tax", globe: "Non-covered tax", coveredTax: "Non-covered", confidence: 88, approved: true, amount: 620_000 },
  { account: "810020", name: "Dividend income", entityId: "TC-UPE", financial: "Other income", globe: "Excluded dividends", adjustment: "Art. 3.2.1(b)", confidence: 97, approved: true, amount: 186_000_000 },
  { account: "830010", name: "FX on USD coal receivables", entityId: "TC-UPE", financial: "FX", globe: "FANIL — other", adjustment: "Review FX policy", confidence: 64, approved: false, amount: 2_300_000 },
  { account: "150100", name: "Mine plant, port & barge infrastructure", entityId: "TC-UPE", financial: "PPE", globe: "SBIE tangible", sbie: "Eligible tangible assets", confidence: 94, approved: true, amount: 212_000_000 },
  { account: "150300", name: "Solar farms & battery storage (PPE)", entityId: "TC-TH-NRG", financial: "PPE", globe: "SBIE tangible", sbie: "Eligible tangible assets", confidence: 95, approved: true, amount: 262_000_000 },
  { account: "720050", name: "Income tax — non-promoted activities", entityId: "TC-TH-NRG", financial: "Current tax", globe: "Covered tax — current", coveredTax: "Covered", confidence: 97, approved: true, amount: 900_000 },
  { account: "640500", name: "Intra-group trading & marketing service fee", entityId: "TC-SG-HC", financial: "Operating expense", globe: "Art. 3.2.4 arm's-length principle", adjustment: "Arm's-length true-up +$0.42M", confidence: 92, approved: true, amount: 1_900_000 },
  { account: "720050", name: "Income tax (GTP 10%)", entityId: "TC-SG-HC", financial: "Current tax", globe: "Covered tax — current", coveredTax: "Covered", confidence: 98, approved: true, amount: 5_800_000 },
];

const files: SourceFile[] = [
  { id: "F01", name: "ThaiCoal_Legal_Entity_List_FY2026.xlsx", kind: "Legal entity list", size: "1.4 MB", uploaded: "14 Aug 2026", by: "K. Suksawat", status: "Mapped", rows: 96 },
  { id: "F02", name: "TC001 Trial Balance FY2026.xlsx", kind: "Trial balance", entity: "TC-UPE", size: "1.9 MB", uploaded: "14 Aug 2026", by: "P. Wongchai", status: "Mapped", rows: 2410 },
  { id: "F03", name: "FY2026 Consolidation pack.xlsx", kind: "Consolidation", size: "7.8 MB", uploaded: "13 Aug 2026", by: "Group Finance", status: "Validated", rows: 15200 },
  { id: "F04", name: "TC tax provision FY2026.xlsx", kind: "Tax provision", entity: "TC-UPE", size: "560 KB", uploaded: "14 Aug 2026", by: "P. Wongchai", status: "Mapped" },
  { id: "F05", name: "CbCR_FY2026.xlsx", kind: "CbCR", size: "2.4 MB", uploaded: "12 Aug 2026", by: "K. Suksawat", status: "Validated", rows: 11 },
  { id: "F06", name: "BOI_Certificate_TC031_solar.pdf", kind: "BOI certificate", entity: "TC-TH-NRG", size: "2.1 MB", uploaded: "11 Aug 2026", by: "S. Thongdee", status: "Mapped" },
  { id: "F07", name: "TC010 Trial Balance FY2026.xlsx", kind: "Trial balance", entity: "TC-TH-PWR", size: "1.1 MB", uploaded: "13 Aug 2026", by: "S. Thongdee", status: "Mapped", rows: 1180 },
  { id: "F08", name: "Fixed_asset_register_TH.xlsx", kind: "Fixed-asset register", entity: "TC-UPE", size: "4.6 MB", uploaded: "10 Aug 2026", by: "TH Finance", status: "Imported", rows: 6800 },
  { id: "F09", name: "Payroll_TH_FY2026.csv", kind: "Payroll", entity: "TC-UPE", size: "720 KB", uploaded: "10 Aug 2026", by: "TH Finance", status: "Mapped", rows: 1640 },
  { id: "F10", name: "Deferred_tax_rollforward.xlsx", kind: "Deferred tax", size: "1.2 MB", uploaded: "13 Aug 2026", by: "Group Tax", status: "Validated" },
  { id: "F11", name: "TP_Master_File_2026.pdf", kind: "TP report", size: "14 MB", uploaded: "09 Aug 2026", by: "Group Tax", status: "Imported" },
  { id: "F12", name: "Prior_GIR_FY2025.xml", kind: "Previous GIR", size: "380 KB", uploaded: "08 Aug 2026", by: "K. Suksawat", status: "Imported" },
  { id: "F13", name: "TC040 Trial Balance FY2026.xlsx", kind: "Trial balance", entity: "TC-SG-HC", size: "640 KB", uploaded: "13 Aug 2026", by: "J. Lim", status: "Mapped", rows: 520 },
  { id: "F14", name: "TC050 consolidated TB FY2026.xlsx", kind: "Trial balance", entity: "TC-ID-COAL", size: "2.2 MB", uploaded: "13 Aug 2026", by: "Indo Finance", status: "Mapped", rows: 3100 },
  { id: "F15", name: "TC060 TB FY2026.xlsx", kind: "Trial balance", entity: "TC-AU-COAL", size: "1.3 MB", uploaded: "12 Aug 2026", by: "R. Hughes", status: "Mapped", rows: 1420 },
  { id: "F16", name: "TC090 TB FY2026.xlsx", kind: "Trial balance", entity: "TC-CN-PWR", size: "410 KB", uploaded: "12 Aug 2026", by: "Local Tax CN", status: "Validated", rows: 620 },
  { id: "F17", name: "Dividend WHT schedule FY2026.xlsx", kind: "Covered-tax allocation", entity: "TC-UPE", size: "220 KB", uploaded: "13 Aug 2026", by: "Group Tax", status: "Reviewed", rows: 14 },
  { id: "F18", name: "GTP_incentive_letter_TC040.pdf", kind: "Incentive certificate", entity: "TC-SG-HC", size: "480 KB", uploaded: "11 Aug 2026", by: "J. Lim", status: "Mapped" },
  { id: "F19", name: "Lao associate equity pick-up FY2026.xlsx", kind: "GloBE adjustment", entity: "TC-LA-ASSOC", size: "180 KB", uploaded: "12 Aug 2026", by: "S. Thongdee", status: "Reviewed", rows: 9 },
];

const issues: Issue[] = [
  { id: "IQ-01", severity: "block", area: "Covered tax", entity: "TC-MN-MINE", jurisdiction: "Mongolia", title: "Prior-year DTA/DTL missing", detail: "Mongolian deferred-tax opening balances are blank. The de minimis test may make this moot, but the register cannot be signed until the source is filed.", owner: "Local Finance MN" },
  { id: "IQ-02", severity: "block", area: "SBIE", entity: "TC-AU-COAL", jurisdiction: "Australia", title: "Payroll file split by mine site incomplete", detail: "Eligible employee listing covers the Mandalong site only. Airly and Clarence sites are estimated. SBIE payroll carve-out is provisional.", owner: "AU Finance" },
  { id: "IQ-03", severity: "warn", area: "Mapping", entity: "TC-UPE", jurisdiction: "Thailand", title: "FX on USD receivables mapping at 64% confidence", detail: "Account 830010 — FX on USD coal receivables needs tax-team approval before lock.", owner: "P. Wongchai" },
  { id: "IQ-04", severity: "warn", area: "CbCR", jurisdiction: "Singapore", title: "CbCR revenue vs consolidation", detail: "Singapore CbCR revenue $2,216.6M vs consolidation $2,214.0M. $2.6M unexplained — intra-group trading eliminations.", owner: "J. Lim" },
  { id: "IQ-05", severity: "info", area: "Ownership", entity: "TC-TH-PWR", jurisdiction: "Thailand", title: "POPE — 22% outside the group", detail: "ThaiCoal Power PCL is a listed Parent Entity and persons that are not Group Entities hold 22% (> 20%). Entity test: POPE (Art. 2.1.4). Thai IIR attaches at the POPE for its low-taxed CEs abroad — the China residual is collected here at Inclusion Ratio 100%.", owner: "Group Tax" },
  { id: "IQ-06", severity: "info", area: "Ownership", entity: "TC-ID-COAL", jurisdiction: "Indonesia", title: "POPE — 35% outside the group", detail: "PT ThaiCoal Indo Tbk is a listed Parent (65% group-owned). POPE under Art. 2.1.4. Indonesian QDMTT collects first and the Indonesian ETR is above 15%, so no IIR flows from this chain.", owner: "Group Tax" },
  { id: "IQ-07", severity: "info", area: "Ownership", entity: "TC-LA-ASSOC", jurisdiction: "Lao PDR", title: "Equity-accounted associate — not a CE", detail: "40% Lao lignite power associate. UPE look-through 31.2% is below the 50% Art. 10.1 Joint Venture test and the entity is not consolidated line by line — outside the GloBE perimeter. Dividends are excluded upstream (Art. 3.2.1(b)).", owner: "Group Tax" },
  { id: "IQ-08", severity: "info", area: "Ownership", entity: "TC-VN-JV", jurisdiction: "Vietnam", title: "JV Group from Art. 10.1 facts", detail: "Equity-accounted in the UPE CFS and UPE ownership is 50% (≥ 50%). Entity test: Joint Venture (Art. 6.4 / 10.1) — separate ETR. Vietnamese QDMTT collects the JV's top-up.", owner: "Group Tax" },
  { id: "IQ-09", severity: "warn", area: "Deferred tax", entity: "TC-US-GAS", jurisdiction: "United States", title: "IDC deferred-tax roll-forward narrative", detail: "Intangible drilling cost DTL movement $25.2M lacks Art. 4.4.5(a) recapture-exception tagging in the register.", owner: "US Tax" },
  { id: "IQ-10", severity: "warn", area: "Deferred tax", entity: "TC-UPE", jurisdiction: "Thailand", title: "Unrecognised loss carry-forward", detail: "FY2024–25 tax losses shelter FY2026 taxable profit but no DTA was recognised. Art. 4.4.1 / 4.4.4 — test whether a GloBE Loss Election (Art. 4.5) or DTA recognition changes the Thai ETR before locking.", owner: "P. Wongchai" },
  { id: "IQ-11", severity: "info", area: "Safe harbour", entity: "TC-MN-MINE", jurisdiction: "Mongolia", title: "De minimis test met", detail: "Revenue $6.2M < €10M and profit $0.4M < €1M. Elect SH_TCSH on the GIR — not electing this year bars TCSH next year (once out, always out).", owner: "Group Tax" },
  { id: "IQ-12", severity: "info", area: "GloBE income", entity: "TC-AU-COAL", jurisdiction: "Australia", title: "Net GloBE Loss — no ETR", detail: "Australian coal CE is loss-making. Art. 5.1.2: no ETR is computed. Adjusted Covered Taxes −$5.0M against Expected −$6.3M — no Art. 4.1.5 Additional Current Top-up Tax.", owner: "Group Tax" },
];

const incentives: Incentive[] = [
  { id: "TC-BOI-SOLAR", entityId: "TC-TH-NRG", name: "BOI — Solar farm & battery storage (Category 7.1)", type: "Tax holiday / reduced CIT", start: "2019-01-01", end: "2031-12-31", rate: "0% CIT years 1–8; 50% reduction years 9–13", conditions: "Renewable generation; eligible capex maintained; BOI reporting", sbtishEligible: true, extractedFrom: "BOI_Certificate_TC031_solar.pdf" },
  { id: "TC-SG-GTP", entityId: "TC-SG-HC", name: "Global Trader Programme", type: "Reduced CIT", start: "2019-07-01", end: "2029-06-30", rate: "10% on qualifying trading income (standard 17%)", conditions: "Trading volume, headcount and local business-spending commitments", sbtishEligible: false, extractedFrom: "GTP_incentive_letter_TC040.pdf" },
  { id: "TC-CN-HNTE", entityId: "TC-CN-PWR", name: "High and New Technology Enterprise", type: "Reduced CIT", start: "2023-01-01", end: "2025-12-31", rate: "15% CIT (standard 25%) · renewal pending", conditions: "HNTE certificate renewal; R&D ratio", sbtishEligible: false, extractedFrom: "HNTE_certificate_TC090.pdf" },
  { id: "TC-VN-EIT", entityId: "TC-VN-JV", name: "EIT incentive — renewable power", type: "Tax holiday / reduced CIT", start: "2023-01-01", end: "2037-12-31", rate: "4-year exemption; 50% reduction for 9 years; 10% rate for 15 years", conditions: "Investment licence; Trang province wind capacity", sbtishEligible: true, extractedFrom: "VN_EIT_licence_TCJV1.pdf" },
];

const filings: Filing[] = [
  { id: "FL-TH-54", jurisdiction: "Thailand", requirement: "s 54 UPE / GIR-filer notification", deadline: "2028-03-31", status: "Preparing", preparer: "P. Wongchai", reviewer: "K. Suksawat" },
  { id: "FL-TH-Q", jurisdiction: "Thailand", requirement: "s 57 Thai return — QDMTT and IIR (UPE + POPE)", deadline: "2028-03-31", status: "Preparing", preparer: "P. Wongchai", reviewer: "K. Suksawat" },
  { id: "FL-TH-G", jurisdiction: "Thailand", requirement: "Central GIR filed by the Thai UPE", deadline: "2028-06-30", status: "Draft XML", preparer: "K. Suksawat", reviewer: "7-L Advisory", central: true },
  { id: "FL-SG-M", jurisdiction: "Singapore", requirement: "MTT return + GIR notification", deadline: "2027-12-31", status: "Preparing", preparer: "J. Lim", reviewer: "K. Suksawat" },
  { id: "FL-ID-Q", jurisdiction: "Indonesia", requirement: "PMK 136 DMTT return + notification", deadline: "2028-03-31", status: "Preparing", preparer: "Indo Tax", reviewer: "K. Suksawat" },
  { id: "FL-AU-N", jurisdiction: "Australia", requirement: "DMT / IIR return notification", deadline: "2028-06-30", status: "Not started", preparer: "R. Hughes", reviewer: "K. Suksawat" },
  { id: "FL-VN-Q", jurisdiction: "Vietnam", requirement: "Resolution 107 QDMTT return (JV)", deadline: "2027-12-31", status: "Not started", preparer: "JV Finance", reviewer: "K. Suksawat" },
  { id: "FL-US-S", jurisdiction: "United States", requirement: "SbS / UTPR SH memo", deadline: "2027-04-15", status: "In review", preparer: "US Tax", reviewer: "K. Suksawat" },
  { id: "FL-JP-N", jurisdiction: "Japan", requirement: "IIR notification (non-UPE CE)", deadline: "2027-12-31", status: "Completed", preparer: "JP Tax", reviewer: "K. Suksawat", filed: "02 Aug 2026" },
];

const packs: JurisdictionPack[] = [
  { iso: "TH", name: "Thailand", iir: true, qdmtt: true, qdmttSH: true, utpr: false, from: "2025-01-01", qualified: "Transitional qualified QDMTT · IIR", filing: "Thai return ss 54–57 + central GIR · pack TH-PACK-2567", fx: "THB", notes: "UPE jurisdiction. Thai QDMTT collects on Thai profits; Thai IIR collects the residual from non-QDMTT countries (China, via the listed POPE ThaiCoal Power PCL). Open /thailand." },
  { iso: "SG", name: "Singapore", iir: true, qdmtt: true, qdmttSH: true, utpr: true, from: "2025-01-01", qualified: "Transitional qualified", filing: "MTT return + GIR notification", fx: "SGD", notes: "Trading hub. Global Trader Programme 10% is clawed back by Singapore MTT — the money stays in Singapore, not Thailand." },
  { iso: "ID", name: "Indonesia", iir: true, qdmtt: true, qdmttSH: true, utpr: false, from: "2025-01-01", qualified: "Transitional qualified QDMTT (PMK 136)", filing: "DMTT return + notification", fx: "IDR", notes: "Listed miner is a POPE (35% outside). ETR above 15% — QDMTT SH candidate." },
  { iso: "AU", name: "Australia", iir: true, qdmtt: true, qdmttSH: true, utpr: true, from: "2024-01-01", qualified: "Transitional qualified", filing: "DMT / IIR return", fx: "AUD", notes: "Loss-making coal CE. Net GloBE Loss — Art. 5.1.2, no ETR." },
  { iso: "US", name: "United States", iir: false, qdmtt: false, qdmttSH: false, utpr: false, from: "2026-01-01", qualified: "Qualified SbS (demo pack)", filing: "SbS / UTPR SH", fx: "USD", notes: "Side-by-Side path for shale gas and the Temple-style CCGT. Listed gas CE is a POPE in a jurisdiction without IIR — collection skips to the UPE." },
  { iso: "JP", name: "Japan", iir: true, qdmtt: false, qdmttSH: false, utpr: true, from: "2024-04-01", qualified: "Transitional qualified IIR", filing: "IIR notification (non-UPE)", fx: "JPY", notes: "Solar CE under the Thai POPE. ETR 31% — no exposure. Japanese QDMTT starts for fiscal years from 1 April 2026, after this calendar year." },
  { iso: "CN", name: "China", iir: false, qdmtt: false, qdmttSH: false, utpr: false, from: "—", qualified: "Not on Central Record", filing: "Notification only", fx: "CNY", notes: "No IIR or QDMTT. HNTE 15% profit is low-taxed after Art. 3.2 add-backs — the residual flows to Thai IIR at the POPE." },
  { iso: "VN", name: "Vietnam", iir: true, qdmtt: true, qdmttSH: true, utpr: false, from: "2024-01-01", qualified: "Transitional qualified QDMTT (Resolution 107)", filing: "QDMTT return", fx: "VND", notes: "Wind JV on an EIT holiday. Art. 6.4 JV Group — Vietnamese QDMTT collects the JV top-up." },
  { iso: "LA", name: "Lao PDR", iir: false, qdmtt: false, qdmttSH: false, utpr: false, from: "—", qualified: "n/a", filing: "None — associate outside perimeter", fx: "LAK", notes: "40% equity-accounted associate. Not a Constituent Entity; nothing to compute." },
  { iso: "MN", name: "Mongolia", iir: false, qdmtt: false, qdmttSH: false, utpr: false, from: "—", qualified: "Not on Central Record", filing: "Notification only", fx: "MNT", notes: "De minimis candidate (Art. 5.5) — elect SH_TCSH." },
  { iso: "HK", name: "Hong Kong", iir: true, qdmtt: true, qdmttSH: true, utpr: false, from: "2025-01-01", qualified: "Transitional qualified", filing: "Notification only", fx: "HKD", notes: "Non-material treasury CE only — no detailed calculation on this snapshot." },
];

const girSections: GroupSeed["girSections"] = [
  { id: "A", title: "Filing obligation & MNE group", status: "Complete", fields: 24, missing: 0 },
  { id: "B", title: "Corporate structure", status: "Complete", fields: 96, missing: 0 },
  { id: "C", title: "ETR / Top-up tax by jurisdiction", status: "In review", fields: 40, missing: 2 },
  { id: "D", title: "Safe harbours & elections", status: "In review", fields: 40, missing: 2 },
  { id: "E", title: "QDMTT / IIR / UTPR allocation", status: "Draft", fields: 12, missing: 0 },
];

const activity: GroupSeed["activity"] = [
  { text: "Thailand QDMTT + POPE IIR calculation locked for review — $5.9M", who: "K. Suksawat", when: "14 Aug, 16:10" },
  { text: "Singapore MTT exposure on GTP income confirmed with J. Lim", who: "K. Suksawat", when: "14 Aug, 11:30" },
  { text: "Data request sent to Mongolia finance: DTA/DTL opening balances", who: "GMT24 Gap Hunter", when: "13 Aug, 10:05" },
  { text: "Lao associate confirmed outside the GloBE perimeter (Art. 10.1 JV test)", who: "AI Reviewer", when: "12 Aug, 17:40" },
  { text: "Central GIR XML draft generated — schema 2026.1", who: "GIR Autopilot", when: "12 Aug, 09:20" },
];

const forecast: GroupSeed["forecast"] = [
  { period: "Q1 actual", topUp: 4_100_000 },
  { period: "Q2 actual", topUp: 4_600_000 },
  { period: "Q3 forecast", topUp: 4_900_000 },
  { period: "Q4 forecast", topUp: 5_000_000 },
];

export const THAICOAL: GroupSeed = {
  id: "thaicoal",
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
  populationPool: [
    ["TH", "Thailand"], ["SG", "Singapore"], ["ID", "Indonesia"], ["AU", "Australia"], ["US", "United States"],
    ["JP", "Japan"], ["CN", "China"], ["LA", "Lao PDR"], ["VN", "Vietnam"], ["MN", "Mongolia"], ["HK", "Hong Kong"],
  ],
  demo: {
    label: "ThaiCoal PCL demo",
    story: "Thai-listed energy group with a Thai UPE — Thai QDMTT on a BOI solar CE, Thai IIR through a listed POPE, a Singapore trading hub, Indonesian and Australian mines.",
    loginEmail: "k.suksawat@thaicoal.co.th",
    entityListFile: "ThaiCoal_Legal_Entity_List_FY2026.csv",
    packName: "ThaiCoal FY2026 demo pack",
    samples: [
      { name: "TC001 Trial Balance FY2026.csv", href: "/demo/TC001_Trial_Balance_FY2026.csv", kind: "Trial balance", note: "11 accounts · TC-UPE · dividends, levies and FX mapping" },
      { name: "ThaiCoal Legal Entity List FY2026.csv", href: "/demo/ThaiCoal_Legal_Entity_List_FY2026.csv", kind: "Legal entity list", note: "16 detailed CEs · ownership, GAAP, equity-method flags" },
      { name: "Payroll ThaiCoal TH FY2026.csv", href: "/demo/Payroll_ThaiCoal_TH_FY2026.csv", kind: "Payroll", note: "Eligible payroll by Thai CE for SBIE" },
    ],
  },
};

import { ENTITIES, FINANCIALS, GROUPS, INCENTIVES } from "./model";
import { money } from "./format";
import type { AuditNode, JurCalc } from "./engine";
import { entityCalc } from "./engine";

/** Version-controlled Thailand Jurisdiction Pack. Inherits OECD GloBE; Thai law overrides where the Decree so provides. */
export const THAI_PACK = {
  id: "TH-PACK-2567",
  version: "2567.2",
  engine: "GMT24-TH 2026.2",
  inherits: "OECD 2026 Consolidated Commentary to the GloBE Model Rules",
  override: "Thai domestic law prevails where the Emergency Decree or a notification specifically provides",
  fy: "FY2026",
  fyStart: "2026-01-01",
  fyEnd: "2026-12-31",
  firstInScopeFy: "FY2025",
  cit: 0.2,
  minRate: 0.15,
  rdPage: "https://www.rd.go.th/68005.html",
  rdDecree: "https://www.rd.go.th/67365.html",
  rdMappingPdf:
    "https://www.rd.go.th/fileadmin/user_upload/porsor/topuptaxreference_170269.pdf",
  rdDecreeNews:
    "https://www.rd.go.th/fileadmin/user_upload/news/2567eng/englishnews_6_2025.pdf",
  rdSecondaryNews:
    "https://www.rd.go.th/fileadmin/user_upload/news/2568eng/englishnews_5_2026.pdf",
  oecdModelRules:
    "https://www.oecd.org/en/topics/sub-issues/global-minimum-tax/global-anti-base-erosion-model-rules-pillar-two.html",
  oecdCommentary:
    "https://www.oecd.org/en/publications/tax-challenges-arising-from-the-digitalisation-of-the-economy-consolidated-commentary-to-the-global-anti-base-erosion-model-rules-2026_4377e89f-en.html",
  oecdCentralRecord:
    "https://www.oecd.org/en/topics/sub-issues/global-minimum-tax/central-record-of-legislation-with-transitional-qualified-status.html",
  coverage: {
    calculation: "available" as const,
    filingSchema: "pending" as const,
    section31: "pending" as const,
    section33: "pending" as const,
    restructuring: "pending" as const,
    headline: "Thai legal coverage: calculation rules available / filing schema pending",
    note: "Do not treat GMT24 as fully ready for Thai filing until Sections 31, 33 and 53–57 forms and electronic schemas are in the pack.",
  },
};

export const THAI_INSTRUMENTS = [
  { id: "prk2567", cite: "Emergency Decree on Top-up Tax B.E. 2567", loc: "Scope, 15%, QDMTT/IIR/UTPR, filing, payment, audit, appeal, penalties", module: "Thai master rules", href: "/thailand/liability", url: "https://www.rd.go.th/67365.html", status: "in-pack" as const },
  { id: "dgtopuptax1", cite: "DG Notification No. 1", loc: "Accepted accounting standards and jurisdictions", module: "Accounting Standard Validator", href: "/thailand/scope", url: "https://www.rd.go.th/68005.html", status: "in-pack" as const },
  { id: "dgtopuptax2", cite: "DG Notification No. 2", loc: "Qualified / disqualified refundable imputation taxes", module: "Covered Tax Classification", href: "/thailand/scope", url: "https://www.rd.go.th/68005.html", status: "in-pack" as const },
  { id: "dgtopuptax3", cite: "DG Notification No. 3", loc: "Dual residence, flow-through and entity location", module: "Thai Entity Situs", href: "/thailand/entities", url: "https://www.rd.go.th/68005.html", status: "in-pack" as const },
  { id: "dgtopuptax4", cite: "DG Notification No. 4", loc: "Payroll and tangible-asset SBIE", module: "Thai SBIE Engine", href: "/thailand/sbie", url: "https://www.rd.go.th/68005.html", status: "in-pack" as const },
  { id: "dgtopuptax5", cite: "DG Notification No. 5", loc: "Employees and assets for Thai UTPR allocation", module: "Thai UTPR Allocation", href: "/thailand/liability", url: "https://www.rd.go.th/68005.html", status: "in-pack" as const },
  { id: "dgtopuptax6", cite: "DG Notification No. 6", loc: "Three BOT foreign-exchange conversion rules", module: "BOT FX Engine", href: "/thailand/fx", url: "https://www.rd.go.th/68005.html", status: "in-pack" as const },
  { id: "dgtopuptax7", cite: "DG Notification No. 7", loc: "Government, non-profit, pension and investment exclusions", module: "Excluded Entity Decision Tree", href: "/thailand/entities", url: "https://www.rd.go.th/68005.html", status: "in-pack" as const },
  { id: "dgtopuptax8", cite: "DG Notification No. 8", loc: "Minority-owned, investment and stateless entities", module: "Special Entity Calculation", href: "/thailand/entities", url: "https://www.rd.go.th/68005.html", status: "in-pack" as const },
  { id: "moftopuptax1", cite: "MOF Notification No. 1", loc: "Transitional SBIE rates by fiscal-year start", module: "Time-versioned SBIE Rate Table", href: "/thailand/sbie", url: "https://www.rd.go.th/67365.html", status: "in-pack" as const },
  { id: "s31", cite: "Section 31 (delegated)", loc: "Detailed GloBE income adjustments", module: "Pending instrument", href: "/thailand", url: "https://www.rd.go.th/fileadmin/user_upload/news/2568eng/englishnews_5_2026.pdf", status: "pending" as const },
  { id: "s33", cite: "Section 33 (delegated)", loc: "Adjusted Covered Tax rules", module: "Pending instrument", href: "/thailand", url: "https://www.rd.go.th/fileadmin/user_upload/news/2568eng/englishnews_5_2026.pdf", status: "pending" as const },
  { id: "s53-57", cite: "Sections 53–57 (delegated)", loc: "Filing forms and electronic submission", module: "Pending filing schema", href: "/thailand/filing", url: "https://www.rd.go.th/67365.html", status: "pending" as const },
];

export const THAI_MODULES = [
  { href: "/thailand", title: "Jurisdiction pack", body: "Version, coverage status, instruments. OECD core is inherited, not translated." },
  { href: "/thailand/liability", title: "Liability dashboard", body: "QDMTT → IIR → UTPR waterfall, UTPR allocation, designated taxpayer." },
  { href: "/thailand/scope", title: "Scope memorandum", body: "EUR 750m / BOT THB test, GAAP whitelist, covered-tax questionnaire." },
  { href: "/thailand/entities", title: "Entity situs", body: "CE / PE / dual-resident / flow-through / excluded / MOCE decision tree." },
  { href: "/thailand/sbie", title: "Thai SBIE", body: "Notification No. 4 payroll and assets · MOF transitional rates by FY start." },
  { href: "/thailand/fx", title: "BOT FX", body: "Three locked conversion methods. Manual year-end rates raise a validation warning." },
  { href: "/thailand/filing", title: "Filing command", body: "ss 54–58 clocks, designated filer, CAA check. Schema pending." },
  { href: "/thailand/boi", title: "BOI Optimizer", body: "Four scenarios, blending, SBIE, 0% vs 10% conversion, QRTC/SBTISH (unbookable), 10-year NPV. Pillar Two claws back part of BOI — it does not cancel it." },
  { href: "/thailand/gap", title: "OECD vs RD gap", body: "Review where pure OECD rules and the GloBE Core calc differ from Thai RD Pillar Two requirements." },
  { href: "/thailand/audit", title: "Audit defence", body: "Defence book, 10-year window, penalties, RD risk review." },
];

export const SBIE_RATES = [
  { from: "2025-01-01", to: "2025-12-31", payroll: 0.096, assets: 0.076 },
  { from: "2026-01-01", to: "2026-12-31", payroll: 0.094, assets: 0.074 },
  { from: "2027-01-01", to: "2027-12-31", payroll: 0.092, assets: 0.072 },
  { from: "2028-01-01", to: "2028-12-31", payroll: 0.09, assets: 0.07 },
  { from: "2029-01-01", to: "2029-12-31", payroll: 0.082, assets: 0.066 },
  { from: "2030-01-01", to: "2030-12-31", payroll: 0.074, assets: 0.062 },
  { from: "2031-01-01", to: "2031-12-31", payroll: 0.066, assets: 0.058 },
  { from: "2032-01-01", to: "2032-12-31", payroll: 0.058, assets: 0.054 },
  { from: "2033-01-01", to: null, payroll: 0.05, assets: 0.05 },
];

export function sbieRatesForFyStart(isoDate: string) {
  const row = [...SBIE_RATES].reverse().find((r) => isoDate >= r.from && (!r.to || isoDate <= r.to));
  return row ?? SBIE_RATES[SBIE_RATES.length - 1];
}

export const BOT_RATES = [
  { id: "BOT-EUR-THB-202512", pair: "EUR/THB", asOf: "2025-12", method: "threshold" as const, rate: 36.8247, source: "BOT average midpoint · December preceding FY2026", locked: true, warningIfOverride: true },
  { id: "BOT-USD-THB-202512", pair: "USD/THB", asOf: "2025-12", method: "financials" as const, rate: 38.45, source: "BOT average midpoint · December preceding FY2026 · CFS → THB", locked: true, warningIfOverride: true },
  { id: "BOT-EUR-THB-202412", pair: "EUR/THB", asOf: "2024-12", method: "threshold" as const, rate: 36.5112, source: "BOT average midpoint · December preceding FY2025", locked: true, warningIfOverride: true },
  { id: "BOT-USD-THB-202412", pair: "USD/THB", asOf: "2024-12", method: "financials" as const, rate: 38.12, source: "BOT average midpoint · December preceding FY2025", locked: true, warningIfOverride: true },
  { id: "BOT-EUR-THB-202312", pair: "EUR/THB", asOf: "2023-12", method: "threshold" as const, rate: 37.0408, source: "BOT average midpoint · December preceding FY2024", locked: true, warningIfOverride: true },
  { id: "BOT-USD-THB-202312", pair: "USD/THB", asOf: "2023-12", method: "financials" as const, rate: 35.04, source: "BOT average midpoint · December preceding FY2024", locked: true, warningIfOverride: true },
  { id: "BOT-EUR-THB-202212", pair: "EUR/THB", asOf: "2022-12", method: "threshold" as const, rate: 36.782, source: "BOT average midpoint · December preceding FY2023", locked: true, warningIfOverride: true },
  { id: "BOT-USD-THB-202212", pair: "USD/THB", asOf: "2022-12", method: "financials" as const, rate: 34.62, source: "BOT average midpoint · December preceding FY2023", locked: true, warningIfOverride: true },
  { id: "BOT-PAY-20280629", pair: "USD/THB", asOf: "2028-06-29", method: "payment" as const, rate: 36.4102, source: "BOT commercial-bank average buy/sell · last business day before payment approval", locked: true, warningIfOverride: true },
];

export const EUR_THRESHOLD = 750_000_000;
export const EUR_MATERIAL_PRESENTATION = 75_000_000;
export const EUR_PERMANENT_DIFF = 1_000_000;
export const FILING_PENALTY_CAP_THB = 200_000;

export function botRate(id: string) {
  return BOT_RATES.find((r) => r.id === id)!;
}

export const GAAP_WHITELIST = [
  { standard: "IFRS", jurisdictions: "IASB / EU / EEA and other IFRS adopters", accepted: true },
  { standard: "TFRS", jurisdictions: "Thailand", accepted: true },
  { standard: "US GAAP", jurisdictions: "United States", accepted: true },
  { standard: "Japanese GAAP", jurisdictions: "Japan (acceptable accounting standard)", accepted: true },
  { standard: "Local GAAP with material differences", jurisdictions: "Requires EUR 75m / EUR 1m tests", accepted: false },
];

export const PAYROLL_LINES = [
  { id: "TH-PAY-FT", entityId: "TH-CE", label: "Full-time employees · Rayong / BKK", amount: 21_400_000, include: 1, note: "Employer control and direction · work location Thailand 100%", source: "Payroll_TH_FY2026.csv" },
  { id: "TH-PAY-TEMP", entityId: "TH-CE", label: "Temporary employees", amount: 2_100_000, include: 1, note: "Ordinary activities of the CE", source: "Payroll_TH_FY2026.csv" },
  { id: "TH-PAY-IC", entityId: "TH-CE", label: "Independent contractors (ordinary activities)", amount: 1_300_000, include: 1, note: "Notification No. 4 · treated as eligible payroll", source: "Payroll_TH_FY2026.csv" },
  { id: "TH-PAY-BONUS", entityId: "TH-CE", label: "Bonus / SBC / health / employer SSC", amount: 4_200_000, include: 1, note: "Share-based compensation + employer-paid taxes", source: "Payroll_TH_FY2026.csv" },
  { id: "TH-PAY-SPLIT", entityId: "TH-CE", label: "Regional engineers (≤50% time in TH)", amount: 2_800_000, include: 0.45, note: "Proportional inclusion · 45% of days in Thailand", source: "Payroll_TH_FY2026.csv" },
  { id: "TH-PAY-CAP", entityId: "TH-CE", label: "Payroll capitalised into PPE", amount: 1_100_000, include: 0, note: "Excluded here · taken in tangible-asset carve-out", source: "Fixed_asset_register_TH.xlsx" },
  { id: "TH-PAY-PE", entityId: "TH-PE", label: "Rayong PE payroll", amount: 3_400_000, include: 1, note: "Allocated to the PE", source: "Payroll_TH_FY2026.csv" },
];

export const ASSET_LINES = [
  { id: "TH-PPE", entityId: "TH-CE", label: "PPE · average carrying value", opening: 36_800_000, closing: 40_000_000, include: 1, note: "Revaluation uplift stripped", source: "Fixed_asset_register_TH.xlsx" },
  { id: "TH-ROU", entityId: "TH-CE", label: "Lessee right-of-use assets", opening: 2_400_000, closing: 2_200_000, include: 1, note: "Related-party operating lease · located in TH", source: "Fixed_asset_register_TH.xlsx" },
  { id: "TH-LIC", entityId: "TH-CE", label: "BOI / government licence (tangible-linked)", opening: 1_200_000, closing: 1_200_000, include: 1, note: "Connected to material tangible investment at Rayong", source: "BOI_Certificate_TH001.pdf" },
  { id: "TH-REV", entityId: "TH-CE", label: "Revaluation surplus (excluded)", opening: 3_100_000, closing: 3_100_000, include: 0, note: "Notification No. 4 · revaluation uplift out", source: "Fixed_asset_register_TH.xlsx" },
  { id: "TH-PE-PPE", entityId: "TH-PE", label: "Rayong PE plant", opening: 6_400_000, closing: 7_200_000, include: 1, note: "Allocated to the PE", source: "Fixed_asset_register_TH.xlsx" },
];

export function thaiSbie() {
  const rates = sbieRatesForFyStart(THAI_PACK.fyStart);
  const payrollEligible = money(PAYROLL_LINES.reduce((a, r) => a + r.amount * r.include, 0));
  const assetsEligible = money(ASSET_LINES.reduce((a, r) => a + ((r.opening + r.closing) / 2) * r.include, 0));
  const payrollCarve = money(payrollEligible * rates.payroll);
  const assetCarve = money(assetsEligible * rates.assets);
  return {
    rates,
    payrollEligible,
    assetsEligible,
    payrollCarve,
    assetCarve,
    sbie: money(payrollCarve + assetCarve),
    ruleId: "TH-SBIE-MOF-1",
    ruleVersion: "2567.2",
    detail: `MOF Notification No. 1 · FY beginning ${THAI_PACK.fyStart} · payroll ${(rates.payroll * 100).toFixed(1)}% / assets ${(rates.assets * 100).toFixed(1)}%. Rate follows fiscal-year start, not filing date.`,
  };
}

export const THAI_CLASSIFICATIONS = [
  {
    id: "TH-CE",
    result: "Thai Constituent Entity",
    period: "FY2012–FY2026",
    facts: "Incorporated in Thailand. TFRS. 100% owned by SG-HC. Not dual-resident. Not an Excluded Entity. Not MOCE (UPE ownership 100%). BOI-promoted manufacturing at Rayong.",
    evidence: "Aetherion_Legal_Entity_List_FY2026.xlsx · BOI_Certificate_TH001.pdf",
    thai: "Emergency Decree ss 6–8 · DG Notification No. 3",
    oecd: "Art. 1.3 / 10.1 Constituent Entity",
    reviewer: "M. Sato",
    status: "Reviewed" as const,
  },
  {
    id: "TH-PE",
    result: "Permanent establishment in Thailand (fixed place / manufacturing)",
    period: "FY2019–FY2026",
    facts: "Rayong plant of TH-CE. Separate GloBE blending unit. Four PE categories reviewed; this is a fixed-place PE. Treaty tie-breaker not required (Thai incorporation + Thai PE).",
    evidence: "TH-PE1 trial balance · BOI promoted-project annex",
    thai: "DG Notification No. 3 · PE categories 1–4",
    oecd: "Art. 10.1 Permanent Establishment",
    reviewer: "N. Chai",
    status: "Prepared" as const,
  },
  {
    id: "SG-JV",
    result: "Joint venture — not a Thai CE",
    period: "FY2022–FY2026",
    facts: "50% JV in Singapore. Not located in Thailand. No Thai PE. Not in Thai QDMTT blending.",
    evidence: "JV shareholders' agreement",
    thai: "DG Notification No. 3 / No. 8",
    oecd: "Art. 1.1 / JV definition",
    reviewer: "L. Tan",
    status: "Reviewed" as const,
  },
  {
    id: "EXCL-NONE",
    result: "No Excluded Entity in Thailand",
    period: "FY2026",
    facts: "Neither TH-CE nor TH-PE is a governmental entity, international organisation, non-profit, pension fund, or investment entity under Notification No. 7.",
    evidence: "Legal entity list · articles of association",
    thai: "DG Notification No. 7",
    oecd: "Art. 1.5 Excluded Entity",
    reviewer: "M. Sato",
    status: "Reviewed" as const,
  },
];

export const COVERED_TAX_Q = [
  { q: "Who receives the refund or credit?", a: "No dividend-related refund in FY2026. Thai CIT is a Covered Tax. Local business tax is not.", include: true },
  { q: "In which jurisdiction?", a: "Thailand.", include: true },
  { q: "Is the recipient taxed on the dividend at at least 15%?", a: "N/A — no imputation credit on outbound dividends this year.", include: null },
  { q: "Is the recipient an individual taxed as ordinary income?", a: "N/A.", include: null },
  { q: "Government, pension, non-profit, regulated IE or life insurer?", a: "No.", include: null },
  { q: "Is withholding tax refunded to the dividend recipient?", a: "No refundable WHT on intra-group dividends in FY2026.", include: false },
  { q: "Qualified or disqualified imputation tax?", a: "None identified. Account 720080 local business tax already stripped as non-covered.", include: false },
];

export function thaiScopeMemo() {
  const g = GROUPS.find((x) => x.id === "aetherion")!;
  const eurThb = botRate("BOT-EUR-THB-202512").rate;
  const thresholdThb = money(EUR_THRESHOLD * eurThb);
  const years = [
    { fy: "FY2023", usd: 610_000_000, usdThb: botRate("BOT-USD-THB-202212").rate, eurThb: botRate("BOT-EUR-THB-202212").rate },
    { fy: "FY2024", usd: 690_000_000, usdThb: botRate("BOT-USD-THB-202312").rate, eurThb: botRate("BOT-EUR-THB-202312").rate },
    { fy: "FY2025", usd: 740_000_000, usdThb: botRate("BOT-USD-THB-202412").rate, eurThb: botRate("BOT-EUR-THB-202412").rate },
    { fy: "FY2026", usd: 768_000_000, usdThb: botRate("BOT-USD-THB-202512").rate, eurThb: botRate("BOT-EUR-THB-202512").rate },
  ].map((y) => {
    const thbRev = money(y.usd * y.usdThb);
    const thbThr = money(EUR_THRESHOLD * y.eurThb);
    return { ...y, thbRev, thbThr, hit: thbRev >= thbThr };
  });
  const hits = years.filter((y) => y.hit).length;
  return {
    group: g.name,
    thresholdEur: EUR_THRESHOLD,
    thresholdThb,
    years,
    hits,
    required: 2,
    window: 4,
    status: hits >= 2 ? "IN SCOPE" : "OUT OF SCOPE",
    gaap: "UPE consolidates under IFRS (JP). Thai CEs keep TFRS. Notification No. 1 whitelist — accepted. Material presentation difference vs IFRS: below EUR 75m. Permanent difference: below EUR 1m.",
    proration: "FY2026 is a 12-month year. No merger / demerger in the window.",
    evidence: "FY2026 Consolidation pack.xlsx · BOT FX archive",
  };
}

export function thaiLiability(th: JurCalc) {
  const foreignQdmtt = 0;
  const iirAlready = 0;
  const residualUtpr = money(Math.max(0, th.jurisdictionalTopUp - foreignQdmtt - iirAlready));
  const thaiQdmtt = th.pack?.qdmtt ? th.jurisdictionalTopUp : 0;
  const thaiIir = 0;
  const thaiUtprCollect = th.pack?.utpr ? residualUtpr : 0;
  const payable = money(thaiQdmtt + thaiIir + thaiUtprCollect);

  const ce = entityCalc("TH-CE")!;
  const pe = entityCalc("TH-PE")!;
  const globe = ce.globe + pe.globe;
  const statutory = [
    { id: "TH-CE", name: ce.entity.name, globe: ce.globe, share: globe > 0 ? ce.globe / globe : 0 },
    { id: "TH-PE", name: pe.entity.name, globe: pe.globe, share: globe > 0 ? pe.globe / globe : 0 },
  ].map((r) => ({ ...r, statutory: money(payable * r.share) }));

  const audit: AuditNode = {
    id: "TH-liability",
    label: "Thai amount ultimately payable",
    amount: payable,
    kind: "result",
    ruleId: "TH-QDMTT-2025",
    ruleVersion: "2567.2",
    detail: "Thai Liability Orchestrator · Jurisdictional top-up − foreign QDMTT − IIR already imposed = residual UTPR. Thai QDMTT collects the Thai jurisdictional amount. Engine posted, not the LLM.",
    children: [
      { id: "TH-jt", label: "Jurisdictional Top-up Tax", amount: th.jurisdictionalTopUp, kind: "formula", ruleId: "OECD-GloBE-15", ruleVersion: "2026.1", detail: "From GMT24 Global GloBE Core · Art. 5.2.3", children: [th.audit] },
      { id: "TH-fqdmtt", label: "− Foreign QDMTT", amount: foreignQdmtt, kind: "formula", ruleId: "TH-QDMTT-2025", ruleVersion: "2567.2", detail: "This is the Thai QDMTT jurisdiction — no foreign QDMTT reduction on the Thai amount." },
      { id: "TH-iir", label: "− IIR already imposed", amount: iirAlready, kind: "formula", ruleId: "prk2567", ruleVersion: "2567.2", detail: "UPE is Japan. Thai IIR does not attach. Japan IIR is residual on non-QDMTT countries, not on Thailand." },
      { id: "TH-utpr", label: "Residual UTPR", amount: residualUtpr, kind: "formula", ruleId: "dgtopuptax5", ruleVersion: "2567.2", detail: "Thai UTPR not in force for FY2026 in the signed pack. Residual on Thai profits is $0 after QDMTT." },
    ],
  };

  return {
    jurisdictionalTopUp: th.jurisdictionalTopUp,
    foreignQdmtt,
    iirAlready,
    residualUtpr,
    thaiQdmtt,
    thaiIir,
    thaiUtprCollect,
    payable,
    payer: "Aetherion (Thailand) Ltd. — designated taxpayer (draft election)",
    path: [
      "Jurisdictional Top-up Tax (GloBE Core)",
      "− Foreign QDMTT $0",
      "− IIR already imposed $0",
      "Residual UTPR $0",
      "Thailand QDMTT collects",
      "Thai liable entity (election / statutory)",
    ],
    statutory,
    audit,
    iirNote: "Thai IIR applies to a Thai UPE, intermediate parent or POPE. Nippon Aether Holdings K.K. is the UPE — Thai IIR is N/A for this group.",
    utprNote: "Thai UTPR allocation dataset (Notification No. 5) is maintained. Collection flag is off for FY2026 pending Central Record UTPR status.",
  };
}

export function thaiUtprAllocation() {
  const thFte = 1240 + 140;
  const thAssets = 42_600_000 + 6_800_000;
  const qualifying = [
    { iso: "TH", name: "Thailand", fte: thFte, assets: thAssets, qualifies: false, note: "UTPR not collecting FY2026 · dataset still locked" },
    { iso: "DE", name: "Germany", fte: 760, assets: 52_000_000, qualifies: true, note: "Central Record transitional qualified UTPR" },
    { iso: "FR", name: "France", fte: 510, assets: 29_800_000, qualifies: true, note: "Central Record transitional qualified UTPR" },
    { iso: "NL", name: "Netherlands", fte: 190, assets: 18_200_000, qualifies: true, note: "Central Record transitional qualified UTPR" },
  ];
  const q = qualifying.filter((r) => r.qualifies);
  const fteAll = q.reduce((a, r) => a + r.fte, 0);
  const assetsAll = q.reduce((a, r) => a + r.assets, 0);
  return {
    method: "50% FTE + 50% tangible assets · Notification No. 5",
    counting: "Year-end headcount · PE employees de-duplicated against the main entity",
    investmentExcluded: true,
    residualDemo: 0,
    qualifying,
    fteAll,
    assetsAll,
  };
}

export const FILING_OBLIGATIONS = [
  { id: "s54", section: "Section 54", title: "UPE and GIR-filer notification", months: 15, firstYear: false, deadline: "2028-03-31", status: "Preparing", filer: "TH001", taxId: "0107558000121" },
  { id: "s55", section: "Sections 55–56", title: "Local GIR filing or exchange exemption", months: 15, firstYear: false, deadline: "2028-03-31", status: "Review CAA", filer: "Japan central GIR (draft)", taxId: "—" },
  { id: "s57", section: "Section 57", title: "Thai return and tax payment", months: 15, firstYear: false, deadline: "2028-03-31", status: "Preparing", filer: "TH001 (designated)", taxId: "0107558000121" },
  { id: "s58", section: "Section 58", title: "First in-scope fiscal year (FY2025)", months: 18, firstYear: true, deadline: "2027-06-30", status: "Filed", filer: "TH001", taxId: "0107558000121" },
];

export function filingDeadline(fyEnd: string, months: number) {
  const d = new Date(fyEnd);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function boiValue(th: JurCalc, holidayRemain = true) {
  const inc = INCENTIVES.find((i) => i.id === "TH-BOI")!;
  const ce = entityCalc("TH-CE")!;
  const promotedGlobe = 28_400_000;
  const nonPromotedGlobe = money(ce.globe - promotedGlobe);
  const citIfNoHoliday = money(promotedGlobe * THAI_PACK.cit);
  const citPaidOnPromoted = 0;
  const nominal = money(citIfNoHoliday - citPaidOnPromoted);
  const thaiTopUp = holidayRemain ? th.jurisdictionalTopUp : money(th.jurisdictionalTopUp * 0.12);
  const foreignIir = 0;
  const foreignUtpr = 0;
  const net = money(nominal - thaiTopUp - foreignIir - foreignUtpr);
  return {
    inc,
    promotedGlobe,
    nonPromotedGlobe,
    citIfNoHoliday,
    citPaidOnPromoted,
    nominal,
    thaiTopUp,
    foreignIir,
    foreignUtpr,
    net,
    qrcAlt: money(nominal * 0.55),
    note: holidayRemain
      ? "BOI 0% years still running. Thai QDMTT recaptures the undertaxation on Excess Profit. The holiday is not worthless — SBIE and blending preserve part of the benefit. Rank keep vs 10% vs QRTC pending vs 20% in the Optimizer."
      : "Holiday expired in this scenario. Current tax rises toward 20% CIT; Thai top-up falls; net retained incentive is the residual reduced-rate years only.",
  };
}

export function penaltyPreview(taxUsd: number, monthsLate: number, kind: "incorrect" | "non-filing", extension: boolean) {
  const rate = extension ? 0.0075 : 0.015;
  const surcharge = money(Math.min(taxUsd, taxUsd * rate * Math.ceil(monthsLate)));
  const multiplier = kind === "non-filing" ? 2 : 1;
  const taxPenalty = money(taxUsd * multiplier);
  const filingThb = FILING_PENALTY_CAP_THB;
  return { rate, surcharge, taxPenalty, filingThb, cap: "Surcharge cannot exceed the underlying tax. Filing penalty cap THB 200,000.", appealDays: 30, refundYears: 3 };
}

export const RD_RISK = [
  { id: "R1", flag: "Low ETR driven by BOI", severity: "review", detail: "Thai ETR is below 15% because of the Rayong holiday. Expected. Attach certificates, promoted/non-promoted split, and the BOI Optimizer (keep vs 10% vs QRTC pending vs 20% baseline)." },
  { id: "R9", flag: "QRTC not enacted", severity: "warn", detail: "Do not book a Thai qualified refundable tax credit. Cabinet reportedly withdrew the draft in December 2025. Hold as a coverage exception in the optimizer." },
  { id: "R2", flag: "Large deferred-tax recast", severity: "review", detail: "Art. 4.4 recast haircut and FY2022 DTL recapture clock (IQ-07) will be asked for." },
  { id: "R3", flag: "PE allocation", severity: "info", detail: "Rayong PE is blended in Thailand. Keep PE TB and FAR distinct from the main entity." },
  { id: "R4", flag: "CbCR vs GloBE", severity: "warn", detail: "Thai CbCR profit $46.3M vs GloBE ~$43.8M after Art. 3.2. Bridge must be in the defence book." },
  { id: "R5", flag: "BOT rates locked", severity: "ok", detail: "December-preceding BOT midpoint archived. No manual year-end override on this snapshot." },
  { id: "R6", flag: "GIR vs Thai return", severity: "warn", detail: "Filing schema pending (ss 53–57). Do not assert identity between GIR XML and the Thai return until the form pack is in." },
  { id: "R7", flag: "FX mapping 62%", severity: "warn", detail: "Account 830010 still unapproved (IQ-03)." },
  { id: "R8", flag: "Negative covered taxes", severity: "ok", detail: "None in FY2026." },
];

export const DEFENCE_CHAPTERS = [
  { n: "00", title: "OECD vs RD gap review", href: "/thailand/gap" },
  { n: "02", title: "Group structure & situs", href: "/thailand/entities" },
  { n: "03", title: "Elections", href: "/thailand/liability" },
  { n: "04", title: "Source data", href: "/data" },
  { n: "05", title: "FANIL & Art. 3.2", href: "/globe-income" },
  { n: "06", title: "Covered taxes & DT", href: "/deferred-tax" },
  { n: "07", title: "ETR", href: "/etr" },
  { n: "08", title: "Thai SBIE", href: "/thailand/sbie" },
  { n: "09", title: "QDMTT / IIR / UTPR", href: "/thailand/liability" },
  { n: "10", title: "BOI–Pillar Two optimizer", href: "/thailand/boi" },
  { n: "11", title: "Filings & payment", href: "/thailand/filing" },
  { n: "12", title: "Evidence locker", href: "/evidence" },
];

export function thaiEntities() {
  return ENTITIES.filter((e) => e.iso === "TH");
}

export function thaiFinancials() {
  return FINANCIALS.filter((f) => thaiEntities().some((e) => e.id === f.entityId));
}

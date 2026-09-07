import type { JurisdictionDb, JurisdictionRecord, RuleStatus, Scheme } from "./types";

/**
 * Maintained jurisdiction database for Quick Scan screening. Versioned: every scan
 * records the version it used. Statutory rates and schemes are screening indicators
 * only — they never establish a GloBE ETR. Pillar Two implementation status is
 * dated and sourced; the OECD Central Record listing is recorded as a fact with its
 * own date, and absence from the Record is not treated as non-qualification.
 */
export const CENTRAL_RECORD_URL = "https://www.oecd.org/en/topics/sub-issues/global-minimum-tax/central-record-of-legislation-with-transitional-qualified-status.html";
const CR_ASOF = "2026-06-30";

const inForce = (from: string, note?: string): RuleStatus => ({ status: "in-force", from, note });
const enacted = (from: string, note?: string): RuleStatus => ({ status: "enacted", from, note });
const none = (note?: string): RuleStatus => ({ status: "none", from: null, note });
const draft = (note?: string): RuleStatus => ({ status: "draft", from: null, note });

const S = (iso: string, id: string, name: string, kind: Scheme["kind"], effect: string, activities: string[], source: string, asOf = "2026-01-01", sourceUrl?: string): Scheme => ({ id: `${iso}-${id}`, iso, name, kind, effect, activities, source, asOf, sourceUrl });

const RECORDS: JurisdictionRecord[] = [
  {
    iso: "TH", name: "Thailand", nameTh: "ประเทศไทย", statutoryRate: 0.20, rateSource: "Revenue Code s.67; Royal Decree No. 530", rateAsOf: "2026-01-01",
    schemes: [
      S("TH", "boi-holiday", "BOI corporate income tax exemption", "holiday", "CIT exemption 3–13 years (Investment Promotion Act s.31); cap on exempt profit tied to investment for many categories.", ["manufacturing", "electronics", "automotive", "digital", "biotech", "logistics"], "Investment Promotion Act B.E. 2520 s.31; BOI Announcement 2/2557"),
      S("TH", "boi-50", "BOI 50% CIT reduction", "reduced-rate", "50% CIT reduction for up to 5 years after exemption period (s.35(1)).", ["manufacturing", "technology"], "Investment Promotion Act s.35(1)"),
      S("TH", "ibc", "International Business Centre (IBC)", "reduced-rate", "CIT 8% / 5% / 3% on qualifying service income by Thai spend tier; withholding relief on dividends.", ["headquarters", "treasury", "shared services"], "Royal Decree No. 674 (B.E. 2561)"),
      S("TH", "eec", "Eastern Economic Corridor enhanced incentives", "zone", "Additional exemption/reduction years for targeted industries in EEC provinces.", ["manufacturing", "aviation", "digital", "medical"], "EEC Act B.E. 2561; BOI Announcement 3/2560"),
    ],
    iir: inForce("2025-01-01", "Emergency Decree on Top-up Tax B.E. 2567: IIR for fiscal years beginning on/after 1 Jan 2025."),
    qdmtt: inForce("2025-01-01", "Domestic minimum top-up tax under the same Decree."),
    utpr: inForce("2025-01-01"),
    centralRecord: { listed: "pending", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "VN", name: "Vietnam", statutoryRate: 0.20, rateSource: "Law on Corporate Income Tax 14/2008 as amended", rateAsOf: "2026-01-01",
    schemes: [
      S("VN", "high-tech", "Preferential 10% for 15 years + 4-year exemption + 9-year 50% reduction", "holiday", "Applies to high-tech, large manufacturing, economic zones and disadvantaged areas.", ["manufacturing", "electronics", "high-tech", "software"], "Decree 218/2013/ND-CP arts. 15–16"),
      S("VN", "ez", "Economic zone / industrial park incentives", "zone", "Exemption and reduction periods tied to location.", ["manufacturing", "logistics"], "Decree 218/2013/ND-CP; Decree 35/2022/ND-CP"),
    ],
    iir: inForce("2024-01-01", "Resolution 107/2023/QH15."), qdmtt: inForce("2024-01-01", "QDMTT under Resolution 107/2023/QH15."), utpr: none("Not enacted."),
    centralRecord: { listed: "yes", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "MY", name: "Malaysia", statutoryRate: 0.24, rateSource: "Income Tax Act 1967 Sch 1", rateAsOf: "2026-01-01",
    schemes: [
      S("MY", "pioneer", "Pioneer Status", "holiday", "70%–100% exemption of statutory income for 5–10 years.", ["manufacturing", "high-tech"], "Promotion of Investments Act 1986"),
      S("MY", "ita", "Investment Tax Allowance", "credit", "60%–100% allowance on qualifying capex set against statutory income.", ["manufacturing"], "Promotion of Investments Act 1986"),
      S("MY", "labuan", "Labuan business activity 3%", "reduced-rate", "3% on audited net profit for Labuan trading activity.", ["holding", "trading", "leasing"], "Labuan Business Activity Tax Act 1990"),
      S("MY", "phub", "Principal Hub / Global Services Hub", "reduced-rate", "0%/5%/10% concessionary rates on qualifying income.", ["headquarters", "shared services"], "MIDA Principal Hub guidelines"),
    ],
    iir: inForce("2025-01-01", "Finance (No. 2) Act 2023 Part XI."), qdmtt: inForce("2025-01-01"), utpr: none("Deferred."),
    centralRecord: { listed: "yes", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "SG", name: "Singapore", statutoryRate: 0.17, rateNote: "Partial exemption on first SGD 200k.", rateSource: "Income Tax Act 1947 s.43", rateAsOf: "2026-01-01",
    schemes: [
      S("SG", "pci", "Pioneer Certificate Incentive", "holiday", "Exemption on qualifying income for 5–15 years.", ["manufacturing", "high-tech"], "Economic Expansion Incentives (Relief from Income Tax) Act"),
      S("SG", "dei", "Development and Expansion Incentive", "reduced-rate", "5% or 10% concessionary rate on incremental qualifying income.", ["headquarters", "manufacturing", "services"], "EEIA Part IIIB"),
      S("SG", "fti", "Finance and Treasury Centre", "reduced-rate", "8% on qualifying treasury income.", ["treasury"], "Income Tax Act s.43G"),
      S("SG", "gtp", "Global Trader Programme", "reduced-rate", "5% or 10% on qualifying trading income.", ["trading"], "Income Tax Act s.43P"),
    ],
    iir: inForce("2025-01-01", "Multinational Enterprise (Minimum Tax) Act 2024."), qdmtt: inForce("2025-01-01", "Domestic Top-up Tax."), utpr: none("Not yet enacted."),
    centralRecord: { listed: "yes", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "ID", name: "Indonesia", statutoryRate: 0.22, rateSource: "Law 7/2021 (HPP)", rateAsOf: "2026-01-01",
    schemes: [
      S("ID", "holiday", "Tax holiday (pioneer industries)", "holiday", "50%–100% CIT reduction for 5–20 years by investment size.", ["manufacturing", "refining", "infrastructure"], "MoF Regulation 130/PMK.010/2020"),
      S("ID", "allowance", "Tax allowance", "credit", "30% investment allowance over 6 years; accelerated depreciation.", ["manufacturing"], "GR 78/2019"),
      S("ID", "sez", "Special Economic Zone", "zone", "Holiday and allowance combinations in KEK zones.", ["manufacturing", "logistics"], "GR 40/2021"),
    ],
    iir: inForce("2025-01-01", "PMK 136/2024."), qdmtt: inForce("2025-01-01"), utpr: enacted("2026-01-01"),
    centralRecord: { listed: "pending", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "PH", name: "Philippines", statutoryRate: 0.25, rateNote: "20% for small domestic corporations.", rateSource: "NIRC s.27 as amended by CREATE / CREATE MORE", rateAsOf: "2026-01-01",
    schemes: [
      S("PH", "ith", "Income Tax Holiday (CREATE)", "holiday", "4–7 years ITH followed by 5% SCIT or enhanced deductions.", ["manufacturing", "BPO", "export"], "RA 11534 (CREATE); RA 12066 (CREATE MORE)"),
      S("PH", "scit", "Special Corporate Income Tax 5%", "reduced-rate", "5% on gross income earned in lieu of all national and local taxes.", ["export", "BPO"], "RA 11534 s.294"),
    ],
    iir: none("Not enacted."), qdmtt: none("Not enacted."), utpr: none(),
    centralRecord: { listed: "no", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "KH", name: "Cambodia", statutoryRate: 0.20, rateSource: "Law on Taxation art. 20", rateAsOf: "2026-01-01",
    schemes: [S("KH", "qip", "Qualified Investment Project", "holiday", "Tax on income exemption 3–9 years, then phased rates.", ["manufacturing", "agriculture", "tourism"], "Law on Investment 2021")],
    iir: none(), qdmtt: none(), utpr: none(), centralRecord: { listed: "no", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "LA", name: "Laos", statutoryRate: 0.20, rateSource: "Income Tax Law No. 67/NA (2019)", rateAsOf: "2026-01-01",
    schemes: [S("LA", "promo", "Investment promotion holiday", "holiday", "Profit tax exemption 4–15 years by zone and sector.", ["hydropower", "manufacturing", "agriculture"], "Law on Investment Promotion 2016")],
    iir: none(), qdmtt: none(), utpr: none(), centralRecord: { listed: "no", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "MM", name: "Myanmar", statutoryRate: 0.22, rateSource: "Union Tax Law 2023", rateAsOf: "2026-01-01",
    schemes: [S("MM", "mic", "MIC investment holiday", "holiday", "3–7 years exemption by zone.", ["manufacturing", "energy"], "Myanmar Investment Law 2016 s.75")],
    iir: none(), qdmtt: none(), utpr: none(), centralRecord: { listed: "no", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "HK", name: "Hong Kong SAR", statutoryRate: 0.165, rateNote: "8.25% on first HKD 2m.", rateSource: "Inland Revenue Ordinance Sch 8", rateAsOf: "2026-01-01",
    schemes: [
      S("HK", "offshore", "Offshore / territorial source", "exemption", "Profits not arising in or derived from Hong Kong are outside the charge; FSIE regime narrows this for passive income.", ["holding", "trading", "treasury"], "IRO s.14; FSIE 2023"),
      S("HK", "ctc", "Corporate Treasury Centre 8.25%", "reduced-rate", "Half-rate on qualifying treasury profits.", ["treasury"], "IRO s.14D"),
    ],
    iir: inForce("2025-01-01", "Inland Revenue (Amendment) (Minimum Tax for Multinational Enterprise Groups) Ordinance 2025."), qdmtt: inForce("2025-01-01", "Hong Kong Minimum Top-up Tax."), utpr: none("Deferred."),
    centralRecord: { listed: "pending", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "CN", name: "China", statutoryRate: 0.25, rateSource: "Enterprise Income Tax Law art. 4", rateAsOf: "2026-01-01",
    schemes: [
      S("CN", "hnte", "High and New Technology Enterprise 15%", "reduced-rate", "15% for certified HNTEs.", ["technology", "manufacturing"], "EIT Law art. 28"),
      S("CN", "west", "Western region 15%", "zone", "15% for encouraged industries in western provinces to 2030.", ["manufacturing", "energy"], "MoF Announcement 2020 No. 23"),
      S("CN", "hainan", "Hainan Free Trade Port 15%", "zone", "15% on qualifying income.", ["services", "manufacturing"], "Caishui 2020 No. 31"),
    ],
    iir: none("No legislation."), qdmtt: none(), utpr: none(), centralRecord: { listed: "no", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "IN", name: "India", statutoryRate: 0.2517, rateNote: "22% + surcharge/cess under s.115BAA; 15% for new manufacturing (s.115BAB).", rateSource: "Income-tax Act 1961 s.115BAA / 115BAB", rateAsOf: "2026-01-01",
    schemes: [S("IN", "newmfg", "New manufacturing 15% (s.115BAB)", "reduced-rate", "17.16% effective for qualifying new manufacturing companies.", ["manufacturing"], "Income-tax Act s.115BAB"), S("IN", "sez", "SEZ unit deduction", "zone", "Phased deduction of export profits (s.10AA) for older units.", ["export", "IT"], "Income-tax Act s.10AA")],
    iir: none("Not enacted."), qdmtt: none(), utpr: none(), centralRecord: { listed: "no", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "JP", name: "Japan", statutoryRate: 0.297, rateNote: "Effective combined national/local ≈ 29.7%.", rateSource: "Corporation Tax Act; local tax acts", rateAsOf: "2026-01-01",
    schemes: [], iir: inForce("2024-04-01", "FY beginning on/after 1 Apr 2024."), qdmtt: enacted("2026-04-01"), utpr: enacted("2026-04-01"),
    centralRecord: { listed: "yes", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "KR", name: "Korea", statutoryRate: 0.24, rateNote: "Plus local income tax ≈ 26.4%.", rateSource: "Corporate Tax Act art. 55", rateAsOf: "2026-01-01",
    schemes: [S("KR", "fez", "Free economic zone / foreign investment reduction", "zone", "Reductions for qualifying foreign-invested high-tech companies.", ["manufacturing", "high-tech"], "Special Tax Treatment Control Act art. 121-2")],
    iir: inForce("2024-01-01", "International Tax Adjustment Act ch. 5."), qdmtt: none("Not enacted."), utpr: inForce("2025-01-01"),
    centralRecord: { listed: "yes", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "AU", name: "Australia", statutoryRate: 0.30, rateSource: "Income Tax Rates Act 1986", rateAsOf: "2026-01-01",
    schemes: [], iir: inForce("2024-01-01"), qdmtt: inForce("2024-01-01"), utpr: inForce("2025-01-01"),
    centralRecord: { listed: "yes", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "IE", name: "Ireland", statutoryRate: 0.125, rateNote: "12.5% trading; 25% passive.", rateSource: "Taxes Consolidation Act 1997 s.21", rateAsOf: "2026-01-01",
    schemes: [S("IE", "kdb", "Knowledge Development Box 10%", "ip-box", "10% (previously 6.25%) on qualifying IP profits.", ["IP", "software", "pharma"], "TCA 1997 Part 29 Ch 5"), S("IE", "rdc", "R&D tax credit 30%", "credit", "Refundable credit; QRTC analysis needed.", ["R&D"], "TCA 1997 s.766")],
    iir: inForce("2024-01-01", "Finance (No. 2) Act 2023 Part 4A."), qdmtt: inForce("2024-01-01"), utpr: inForce("2025-01-01"),
    centralRecord: { listed: "yes", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "NL", name: "Netherlands", statutoryRate: 0.258, rateSource: "Wet Vpb 1969 art. 22", rateAsOf: "2026-01-01",
    schemes: [S("NL", "innobox", "Innovation box 9%", "ip-box", "9% effective on qualifying innovation profits.", ["IP", "R&D"], "Wet Vpb art. 12b")],
    iir: inForce("2024-01-01", "Wet minimumbelasting 2024."), qdmtt: inForce("2024-01-01"), utpr: inForce("2025-01-01"),
    centralRecord: { listed: "yes", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "GB", name: "United Kingdom", statutoryRate: 0.25, rateSource: "Finance Act 2021 s.6", rateAsOf: "2026-01-01",
    schemes: [S("GB", "patent", "Patent Box 10%", "ip-box", "10% on qualifying patent profits.", ["IP", "manufacturing"], "CTA 2010 Part 8A")],
    iir: inForce("2024-01-01", "Finance (No. 2) Act 2023 Part 3."), qdmtt: inForce("2024-01-01"), utpr: inForce("2025-01-01"),
    centralRecord: { listed: "yes", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "US", name: "United States", statutoryRate: 0.21, rateNote: "Plus state taxes; GILTI/CAMT are not GloBE-qualified rules.", rateSource: "IRC s.11", rateAsOf: "2026-01-01",
    schemes: [S("US", "fdii", "FDII deduction", "reduced-rate", "Reduced effective rate on foreign-derived intangible income.", ["export", "IP"], "IRC s.250")],
    iir: none("No GloBE legislation."), qdmtt: none(), utpr: none(), centralRecord: { listed: "no", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "AE", name: "United Arab Emirates", statutoryRate: 0.09, rateNote: "0% on first AED 375k; 0% for Qualifying Free Zone Persons.", rateSource: "Federal Decree-Law 47/2022", rateAsOf: "2026-01-01",
    schemes: [S("AE", "qfzp", "Qualifying Free Zone Person 0%", "zone", "0% on qualifying income for free-zone entities meeting substance and activity tests.", ["trading", "holding", "logistics", "services"], "Cabinet Decision 100/2023")],
    iir: none(), qdmtt: inForce("2025-01-01", "Domestic Minimum Top-up Tax, Cabinet Decision 142/2024."), utpr: none(),
    centralRecord: { listed: "pending", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "KY", name: "Cayman Islands", statutoryRate: 0, rateSource: "No corporate income tax", rateAsOf: "2026-01-01",
    schemes: [], iir: none(), qdmtt: none(), utpr: none(), centralRecord: { listed: "no", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "VG", name: "British Virgin Islands", statutoryRate: 0, rateSource: "No corporate income tax", rateAsOf: "2026-01-01",
    schemes: [], iir: none(), qdmtt: none(), utpr: none(), centralRecord: { listed: "no", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "MU", name: "Mauritius", statutoryRate: 0.15, rateNote: "80% partial exemption on certain foreign income → 3% effective.", rateSource: "Income Tax Act 1995", rateAsOf: "2026-01-01",
    schemes: [S("MU", "pe", "Partial exemption regime", "exemption", "80% exemption on qualifying foreign-source dividends, interest and GBC income.", ["holding", "treasury"], "Income Tax Act Second Schedule Part II")],
    iir: none(), qdmtt: none(), utpr: none(), centralRecord: { listed: "no", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "TW", name: "Taiwan", statutoryRate: 0.20, rateSource: "Income Tax Act art. 5", rateAsOf: "2026-01-01",
    schemes: [], iir: none("Not enacted; AMT raised to 15% for large groups."), qdmtt: none(), utpr: none(), centralRecord: { listed: "no", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
  {
    iso: "DE", name: "Germany", statutoryRate: 0.30, rateNote: "≈ 30% incl. trade tax.", rateSource: "KStG s.23; GewStG", rateAsOf: "2026-01-01",
    schemes: [], iir: inForce("2024-01-01", "Mindeststeuergesetz."), qdmtt: inForce("2024-01-01"), utpr: inForce("2025-01-01"),
    centralRecord: { listed: "yes", asOf: CR_ASOF, url: CENTRAL_RECORD_URL }, supported: true,
  },
];

export const JURISDICTION_DB: JurisdictionDb = {
  version: "GMT24-JDB 2026.09",
  asOf: "2026-09-01",
  records: RECORDS,
  sources: [
    { label: "OECD Central Record of legislation with transitional qualified status", url: CENTRAL_RECORD_URL },
    { label: "OECD Pillar Two GloBE rules fact sheets", url: "https://www.oecd.org/content/dam/oecd/en/topics/policy-sub-issues/global-minimum-tax/pillar-two-globe-rules-fact-sheets.pdf" },
    { label: "Thai Revenue Department — Emergency Decree on Top-up Tax B.E. 2567", url: "https://www.rd.go.th" },
    { label: "Thailand Board of Investment — incentive announcements", url: "https://www.boi.go.th" },
  ],
};

export function jur(iso: string): JurisdictionRecord | undefined {
  return JURISDICTION_DB.records.find((r) => r.iso === iso);
}

export function schemeById(id: string): Scheme | undefined {
  for (const r of JURISDICTION_DB.records) { const s = r.schemes.find((x) => x.id === id); if (s) return s; }
  return undefined;
}

export const SUPPORTED_ISOS = JURISDICTION_DB.records.filter((r) => r.supported).map((r) => r.iso);

export const ISO_BY_NAME: Record<string, string> = Object.fromEntries([
  ...JURISDICTION_DB.records.flatMap((r) => [[r.name.toLowerCase(), r.iso], ...(r.nameTh ? [[r.nameTh, r.iso]] : [])]),
  ["thai", "TH"], ["ไทย", "TH"], ["viet nam", "VN"], ["เวียดนาม", "VN"], ["hong kong", "HK"], ["ฮ่องกง", "HK"], ["singapore", "SG"], ["สิงคโปร์", "SG"], ["malaysia", "MY"], ["มาเลเซีย", "MY"], ["indonesia", "ID"], ["อินโดนีเซีย", "ID"], ["cambodia", "KH"], ["กัมพูชา", "KH"], ["lao", "LA"], ["ลาว", "LA"], ["myanmar", "MM"], ["เมียนมา", "MM"], ["พม่า", "MM"], ["philippines", "PH"], ["ฟิลิปปินส์", "PH"], ["prc", "CN"], ["people's republic of china", "CN"], ["จีน", "CN"], ["india", "IN"], ["อินเดีย", "IN"], ["japan", "JP"], ["ญี่ปุ่น", "JP"], ["korea", "KR"], ["republic of korea", "KR"], ["เกาหลี", "KR"], ["australia", "AU"], ["ออสเตรเลีย", "AU"], ["ireland", "IE"], ["netherlands", "NL"], ["the netherlands", "NL"], ["united kingdom", "GB"], ["uk", "GB"], ["england", "GB"], ["united states", "US"], ["usa", "US"], ["u.s.a.", "US"], ["america", "US"], ["สหรัฐ", "US"], ["uae", "AE"], ["dubai", "AE"], ["united arab emirates", "AE"], ["cayman", "KY"], ["cayman islands", "KY"], ["bvi", "VG"], ["british virgin islands", "VG"], ["mauritius", "MU"], ["taiwan", "TW"], ["ไต้หวัน", "TW"], ["germany", "DE"], ["เยอรมนี", "DE"],
] as [string, string][]);

/** Jurisdictions the scan cannot screen with a controlled dataset; reported explicitly. */
export const UNSUPPORTED_HINTS: Record<string, string> = { BR: "Brazil", MX: "Mexico", ZA: "South Africa", SA: "Saudi Arabia", TR: "Türkiye", FR: "France", IT: "Italy", ES: "Spain", CH: "Switzerland", LU: "Luxembourg", BE: "Belgium", CA: "Canada", NZ: "New Zealand", BD: "Bangladesh", LK: "Sri Lanka", PK: "Pakistan", EG: "Egypt", NG: "Nigeria", KE: "Kenya" };

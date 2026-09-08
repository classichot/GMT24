import type { Passage, Relationship, ResolvedEntity, SourceDoc } from "./types";

/**
 * Disclosure corpus and entity registry for Quick Scan.
 *
 * The registry resolves a typed name (Thai or English, former names, tickers,
 * subsidiaries entered instead of the parent) to an ultimate parent. The corpus
 * holds page-referenced passages from official disclosures, per reporting period.
 *
 * This build ships the GMT24 demonstration corpus: illustrative Thai-listed groups
 * whose disclosures follow the pattern of SET annual reports and Form 56-1 One
 * Report (subsidiary tables, BOI notes, tax reconciliation, Pillar Two statements).
 * They are labelled as demonstration data throughout the UI. Real groups are scanned
 * from uploaded reports through the same pipeline; a live IR/exchange adapter plugs
 * into `SourceAdapter` without changing the assessment logic.
 */
export const CORPUS_VERSION = "GMT24 demo corpus 2026.09";

export type RegistryEntry = {
  id: string;
  name: string;
  nameTh?: string;
  aliases: string[];
  formerNames?: string[];
  ticker?: string;
  exchange?: string;
  upeIso: string;
  /** Names of subsidiaries a user might type instead of the parent. */
  subsidiaryNames: string[];
  demo: boolean;
};

export type CorpusEntity = {
  id: string;
  name: string;
  nameTh?: string;
  formerNames?: string[];
  iso: string;
  relationship: Relationship;
  ownerId: string | null;
  ownership: number | null;
  activity: string;
  taxResidenceIso?: string;
  incentives?: { schemeId: string; page: number; text: string; from?: string; to?: string }[];
  page: number;
  text: string;
  /** Missing in a period → treated as newly disclosed / dropped in comparison. */
};

export type CorpusPeriod = {
  period: string;
  docs: Omit<SourceDoc, "retrievedAt">[];
  revenue: { period: string; amountThbMillion: number; page: number; docId: string }[];
  entities: CorpusEntity[];
  disclosures: { topic: "pillar-two-statement" | "top-up-recognised" | "expected-impact" | "uncertainty" | "incentive" | "tax-reconciliation" | "safe-harbour"; docId: string; page: number; text: string; isos: string[]; section?: string }[];
  /** Jurisdiction-level financial disclosure (segment or CbCR-style) when the report gives it. */
  jurisdictionData?: { iso: string; docId: string; page: number; text: string; profitBeforeTaxThbM?: number; incomeTaxThbM?: number }[];
  disclosedAmounts?: { iso: string; label: string; amount: string; docId: string; page: number; text: string }[];
};

export type CorpusGroup = { registryId: string; periods: CorpusPeriod[] };

export const REGISTRY: RegistryEntry[] = [
  { id: "siamverdant", name: "Siam Verdant Foods PCL", nameTh: "บริษัท สยามเวอร์แดนท์ ฟู้ดส์ จำกัด (มหาชน)", aliases: ["siam verdant", "svf", "siamverdant", "สยามเวอร์แดนท์"], formerNames: ["Verdant Agro Industries PCL"], ticker: "SVF", exchange: "SET", upeIso: "TH", subsidiaryNames: ["Verdant Vietnam Co., Ltd.", "SVF Europe B.V.", "Verdant Foods (Cambodia) Co., Ltd."], demo: true },
  { id: "chaophraya", name: "Chao Phraya Industrial Holdings PCL", nameTh: "บริษัท เจ้าพระยา อินดัสเตรียล โฮลดิ้งส์ จำกัด (มหาชน)", aliases: ["chao phraya industrial", "cpih", "chao phraya holdings", "เจ้าพระยา อินดัสเตรียล"], ticker: "CPIH", exchange: "SET", upeIso: "TH", subsidiaryNames: ["CPI Precision (Malaysia) Sdn. Bhd.", "Chao Phraya Electronics Vietnam", "CPIH Singapore Pte. Ltd."], demo: true },
  { id: "lannadigital", name: "Lanna Digital Group PCL", nameTh: "บริษัท ล้านนา ดิจิทัล กรุ๊ป จำกัด (มหาชน)", aliases: ["lanna digital", "ldg", "ล้านนา ดิจิทัล"], formerNames: ["Lanna Software Co., Ltd."], ticker: "LDG", exchange: "SET (mai)", upeIso: "TH", subsidiaryNames: ["Lanna Labs Singapore Pte. Ltd.", "LDG Technologies Ireland Ltd"], demo: true },
  { id: "aetherion", name: "Aetherion Holdings PCL", nameTh: "บริษัท เอเทอเรียน โฮลดิ้งส์ จำกัด (มหาชน)", aliases: ["aetherion", "aetherion holdings", "เอเทอเรียน"], ticker: "AETH", exchange: "SET", upeIso: "TH", subsidiaryNames: ["Aetherion Technologies Ireland", "Aetherion Manufacturing Vietnam", "Aetherion Asia Hong Kong"], demo: true },
  { id: "thaicoal", name: "ThaiCoal PCL", nameTh: "บริษัท ไทยโคล จำกัด (มหาชน)", aliases: ["thaicoal", "thai coal", "thaicoal pcl", "thaicoal public company", "ไทยโคล"], ticker: "TCOAL", exchange: "SET", upeIso: "TH", subsidiaryNames: ["ThaiCoal Power", "ThaiCoal Singapore", "PT ThaiCoal Indo", "ThaiCoal Australia", "ThaiCoal NextGen Energy"], demo: true },
];

const THB_TO_EUR = 1 / 38.5;

/** FX assumption used only for the €750m screen; stated on every scope assessment. */
export const FX_NOTE = "THB→EUR at the ECB annual average for each period (≈ 38.5 THB/EUR used for screening; replace with the actual average when confirmed). Art. 1.1 tests consolidated revenue of the UPE's financial statements.";

export function thbMillionToEur(m: number) { return Math.round(m * 1_000_000 * THB_TO_EUR); }

const D = (id: string, title: string, kind: SourceDoc["kind"], period: string, issuer: string, pages: number | null, language: SourceDoc["language"] = "en", accessible = true, inaccessibleReason?: string): Omit<SourceDoc, "retrievedAt"> => ({ id, title, kind, period, issuer, url: `https://ir.example-set.th/${id}.pdf`, accessible, inaccessibleReason, pages, language });

export const CORPUS: CorpusGroup[] = [
  {
    registryId: "siamverdant",
    periods: [
      {
        period: "FY2025",
        docs: [D("svf-ar-2025", "Siam Verdant Foods — Form 56-1 One Report 2025", "form-56-1", "FY2025", "Siam Verdant Foods PCL", 312), D("svf-fs-2025", "Consolidated financial statements 31 Dec 2025 (audited)", "financial-statements", "FY2025", "Siam Verdant Foods PCL", 118), D("svf-ir-2025", "Investor relations — subsidiaries page", "ir-website", "FY2025", "Siam Verdant Foods PCL", null, "mixed", false, "IR page returned HTTP 403 to automated retrieval; the structure was taken from the One Report instead.")],
        revenue: [{ period: "FY2022", amountThbMillion: 27_450, page: 96, docId: "svf-ar-2025" }, { period: "FY2023", amountThbMillion: 29_880, page: 96, docId: "svf-ar-2025" }, { period: "FY2024", amountThbMillion: 31_240, page: 96, docId: "svf-ar-2025" }, { period: "FY2025", amountThbMillion: 33_105, page: 96, docId: "svf-ar-2025" }],
        entities: [
          { id: "svf", name: "Siam Verdant Foods PCL", nameTh: "บริษัท สยามเวอร์แดนท์ ฟู้ดส์ จำกัด (มหาชน)", formerNames: ["Verdant Agro Industries PCL"], iso: "TH", relationship: "upe", ownerId: null, ownership: null, activity: "Food processing; holding", page: 12, text: "Siam Verdant Foods Public Company Limited (formerly Verdant Agro Industries PCL) is the ultimate parent of the Group, listed on the Stock Exchange of Thailand.", incentives: [{ schemeId: "TH-boi-holiday", page: 214, text: "The Company has been granted promotional privileges by the Board of Investment for the production of ready-to-eat food products, including exemption from corporate income tax for eight years from the date income is first derived (March 2021).", from: "2021-03", to: "2029-03" }] },
          { id: "svf-vn", name: "Verdant Vietnam Co., Ltd.", iso: "VN", relationship: "subsidiary", ownerId: "svf", ownership: 100, activity: "Seafood processing (Long An)", page: 118, text: "Verdant Vietnam Co., Ltd. — Vietnam — seafood processing — 100.00% (direct).", incentives: [{ schemeId: "VN-high-tech", page: 216, text: "Verdant Vietnam Co., Ltd. is entitled to a preferential corporate income tax rate of 10% for 15 years, with exemption for 4 years and a 50% reduction for the following 9 years, under its investment certificate.", from: "2019-01", to: "2033-12" }] },
          { id: "svf-kh", name: "Verdant Foods (Cambodia) Co., Ltd.", iso: "KH", relationship: "subsidiary", ownerId: "svf", ownership: 100, activity: "Rice processing", page: 118, text: "Verdant Foods (Cambodia) Co., Ltd. — Cambodia — rice processing — 100.00% (direct).", incentives: [{ schemeId: "KH-qip", page: 216, text: "The Cambodian subsidiary holds Qualified Investment Project status with a tax on income exemption through 2027.", to: "2027-12" }] },
          { id: "svf-nl", name: "SVF Europe B.V.", iso: "NL", relationship: "subsidiary", ownerId: "svf", ownership: 100, activity: "European distribution", page: 118, text: "SVF Europe B.V. — the Netherlands — distribution — 100.00% (direct)." },
          { id: "svf-sg", name: "Verdant Trading Pte. Ltd.", iso: "SG", relationship: "subsidiary", ownerId: "svf", ownership: 100, activity: "Regional trading and procurement", page: 118, text: "Verdant Trading Pte. Ltd. — Singapore — trading — 100.00% (direct).", incentives: [{ schemeId: "SG-gtp", page: 216, text: "Verdant Trading Pte. Ltd. has been awarded Global Trader Programme status with a concessionary tax rate on qualifying trading income for five years from 2023.", from: "2023-01", to: "2027-12" }] },
          { id: "svf-jv", name: "Mekong Verdant Aqua JV Co., Ltd.", iso: "VN", relationship: "joint-venture", ownerId: "svf", ownership: 50, activity: "Shrimp farming", page: 119, text: "Mekong Verdant Aqua JV Co., Ltd. — Vietnam — 50.00% — jointly controlled, accounted for under the equity method." },
          { id: "svf-mm", name: "Ayeyarwady Foods Ltd.", iso: "MM", relationship: "associate", ownerId: "svf", ownership: 30, activity: "Distribution", page: 119, text: "Ayeyarwady Foods Ltd. — Myanmar — 30.00% — associate." },
          { id: "svf-hk", name: "Verdant Asia Holdings Ltd.", iso: "HK", relationship: "subsidiary", ownerId: "svf", ownership: 100, activity: "Intermediate holding", page: 118, text: "Verdant Asia Holdings Ltd. — Hong Kong — investment holding — 100.00% (direct)." },
          { id: "svf-cn", name: "Verdant (Shanghai) Trading Co., Ltd.", iso: "CN", relationship: "subsidiary", ownerId: "svf-hk", ownership: 100, activity: "Import and distribution", page: 118, text: "Verdant (Shanghai) Trading Co., Ltd. — PRC — distribution — 100.00% (held through Verdant Asia Holdings Ltd.)." },
        ],
        disclosures: [
          { topic: "pillar-two-statement", docId: "svf-fs-2025", page: 87, section: "Note 31 Income tax", text: "The Group is within the scope of the OECD Pillar Two model rules. Thailand enacted the Emergency Decree on Top-up Tax effective for accounting periods beginning on or after 1 January 2025. The Group has applied the mandatory temporary exception to recognising and disclosing deferred taxes arising from Pillar Two (TAS 12 amendment).", isos: ["TH"] },
          { topic: "expected-impact", docId: "svf-fs-2025", page: 87, section: "Note 31 Income tax", text: "Based on the Group's assessment of the most recent financial information, the Group's exposure to Pillar Two top-up tax for the year is expected to relate principally to its operations in Vietnam and Thailand, where subsidiaries benefit from tax incentives. Management estimates a current top-up tax expense of THB 186 million for the year, of which THB 142 million relates to the domestic minimum top-up tax in Vietnam.", isos: ["VN", "TH"] },
          { topic: "uncertainty", docId: "svf-fs-2025", page: 88, section: "Note 31 Income tax", text: "The assessment is subject to uncertainty, in particular regarding the qualified status of the Vietnamese and Thai domestic minimum top-up taxes and the availability of the transitional safe harbour for certain jurisdictions.", isos: ["VN", "TH"] },
          { topic: "tax-reconciliation", docId: "svf-fs-2025", page: 86, section: "Note 31 Income tax", text: "Reconciliation of effective tax rate: profit before tax THB 3,412m; tax at Thai statutory rate 20% THB 682m; effect of tax-exempt promoted income (BOI) THB (318)m; effect of different tax rates in foreign jurisdictions THB (97)m; non-deductible expenses THB 41m; income tax expense THB 308m (effective rate 9.0%).", isos: ["TH", "VN", "KH"] },
          { topic: "incentive", docId: "svf-ar-2025", page: 214, section: "Note 29 Promotional privileges", text: "Promoted operations generated revenue of THB 9,870m in 2025 (2024: THB 8,940m); non-promoted operations THB 23,235m.", isos: ["TH"] },
        ],
        jurisdictionData: [{ iso: "VN", docId: "svf-fs-2025", page: 89, text: "Vietnam segment: profit before tax THB 1,186m; income tax expense THB 46m.", profitBeforeTaxThbM: 1_186, incomeTaxThbM: 46 }],
        disclosedAmounts: [{ iso: "VN", label: "Management estimate — Vietnam QDMTT current top-up tax FY2025", amount: "THB 142 million", docId: "svf-fs-2025", page: 87, text: "...of which THB 142 million relates to the domestic minimum top-up tax in Vietnam." }, { iso: "TH", label: "Management estimate — Group current top-up tax FY2025 (total)", amount: "THB 186 million", docId: "svf-fs-2025", page: 87, text: "Management estimates a current top-up tax expense of THB 186 million for the year." }],
      },
      {
        period: "FY2024",
        docs: [D("svf-ar-2024", "Siam Verdant Foods — Form 56-1 One Report 2024", "form-56-1", "FY2024", "Siam Verdant Foods PCL", 298), D("svf-fs-2024", "Consolidated financial statements 31 Dec 2024 (audited)", "financial-statements", "FY2024", "Siam Verdant Foods PCL", 112)],
        revenue: [{ period: "FY2021", amountThbMillion: 25_100, page: 92, docId: "svf-ar-2024" }, { period: "FY2022", amountThbMillion: 27_450, page: 92, docId: "svf-ar-2024" }, { period: "FY2023", amountThbMillion: 29_880, page: 92, docId: "svf-ar-2024" }, { period: "FY2024", amountThbMillion: 31_240, page: 92, docId: "svf-ar-2024" }],
        entities: [
          { id: "svf", name: "Siam Verdant Foods PCL", iso: "TH", relationship: "upe", ownerId: null, ownership: null, activity: "Food processing; holding", page: 12, text: "Siam Verdant Foods Public Company Limited is the ultimate parent of the Group.", incentives: [{ schemeId: "TH-boi-holiday", page: 206, text: "Exemption from corporate income tax for eight years from March 2021 under BOI certificate.", from: "2021-03", to: "2029-03" }] },
          { id: "svf-vn", name: "Verdant Vietnam Co., Ltd.", iso: "VN", relationship: "subsidiary", ownerId: "svf", ownership: 100, activity: "Seafood processing (Long An)", page: 114, text: "Verdant Vietnam Co., Ltd. — Vietnam — 100.00%.", incentives: [{ schemeId: "VN-high-tech", page: 208, text: "Preferential rate of 10% for 15 years with exemption and reduction periods.", from: "2019-01", to: "2033-12" }] },
          { id: "svf-kh", name: "Verdant Foods (Cambodia) Co., Ltd.", iso: "KH", relationship: "subsidiary", ownerId: "svf", ownership: 100, activity: "Rice processing", page: 114, text: "Verdant Foods (Cambodia) Co., Ltd. — Cambodia — 100.00%." },
          { id: "svf-nl", name: "SVF Europe B.V.", iso: "NL", relationship: "subsidiary", ownerId: "svf", ownership: 100, activity: "European distribution", page: 114, text: "SVF Europe B.V. — the Netherlands — 100.00%." },
          { id: "svf-jv", name: "Mekong Verdant Aqua JV Co., Ltd.", iso: "VN", relationship: "joint-venture", ownerId: "svf", ownership: 50, activity: "Shrimp farming", page: 115, text: "Mekong Verdant Aqua JV Co., Ltd. — Vietnam — 50.00% — joint venture." },
          { id: "svf-mm", name: "Ayeyarwady Foods Ltd.", iso: "MM", relationship: "associate", ownerId: "svf", ownership: 30, activity: "Distribution", page: 115, text: "Ayeyarwady Foods Ltd. — Myanmar — 30.00% — associate." },
          { id: "svf-hk", name: "Verdant Asia Holdings Ltd.", iso: "HK", relationship: "subsidiary", ownerId: "svf", ownership: 100, activity: "Intermediate holding", page: 114, text: "Verdant Asia Holdings Ltd. — Hong Kong — 100.00%." },
          { id: "svf-cn", name: "Verdant (Shanghai) Trading Co., Ltd.", iso: "CN", relationship: "subsidiary", ownerId: "svf-hk", ownership: 100, activity: "Import and distribution", page: 114, text: "Verdant (Shanghai) Trading Co., Ltd. — PRC — 100.00% (indirect)." },
        ],
        disclosures: [
          { topic: "pillar-two-statement", docId: "svf-fs-2024", page: 84, section: "Note 30 Income tax", text: "The Group is monitoring the implementation of the OECD Pillar Two model rules in the jurisdictions in which it operates. Thailand has announced that legislation will apply from 2025. The Group is assessing the potential impact and has applied the temporary exception under TAS 12.", isos: ["TH"] },
          { topic: "tax-reconciliation", docId: "svf-fs-2024", page: 83, section: "Note 30 Income tax", text: "Profit before tax THB 3,105m; tax at 20% THB 621m; effect of BOI-exempt income THB (291)m; foreign rate differences THB (84)m; income tax expense THB 279m (effective rate 9.0%).", isos: ["TH", "VN"] },
        ],
      },
    ],
  },
  {
    registryId: "chaophraya",
    periods: [
      {
        period: "FY2025",
        docs: [D("cpih-ar-2025", "Chao Phraya Industrial Holdings — Annual Report 2025 (Form 56-1 One Report)", "form-56-1", "FY2025", "Chao Phraya Industrial Holdings PCL", 268, "mixed"), D("cpih-fs-2025", "Consolidated financial statements 31 Dec 2025", "financial-statements", "FY2025", "Chao Phraya Industrial Holdings PCL", 104), D("cpih-set-2025", "SET disclosure — acquisition of CPI Precision (Malaysia) Sdn. Bhd.", "exchange-filing", "FY2025", "Chao Phraya Industrial Holdings PCL", 4)],
        revenue: [{ period: "FY2022", amountThbMillion: 26_900, page: 74, docId: "cpih-ar-2025" }, { period: "FY2023", amountThbMillion: 29_800, page: 74, docId: "cpih-ar-2025" }, { period: "FY2024", amountThbMillion: 31_200, page: 74, docId: "cpih-ar-2025" }, { period: "FY2025", amountThbMillion: 34_600, page: 74, docId: "cpih-ar-2025" }],
        entities: [
          { id: "cpih", name: "Chao Phraya Industrial Holdings PCL", nameTh: "บริษัท เจ้าพระยา อินดัสเตรียล โฮลดิ้งส์ จำกัด (มหาชน)", iso: "TH", relationship: "upe", ownerId: null, ownership: null, activity: "Holding; electronics manufacturing services", page: 8, text: "Chao Phraya Industrial Holdings Public Company Limited is the parent company of the Group." },
          { id: "cpih-th1", name: "Chao Phraya Electronics Co., Ltd.", iso: "TH", relationship: "subsidiary", ownerId: "cpih", ownership: 99.99, activity: "EMS manufacturing (Rayong, EEC)", page: 96, text: "Chao Phraya Electronics Co., Ltd. — Thailand — electronics manufacturing — 99.99%.", incentives: [{ schemeId: "TH-boi-holiday", page: 188, text: "Chao Phraya Electronics Co., Ltd. holds three BOI certificates for the manufacture of printed circuit board assemblies and automotive electronics, with corporate income tax exemption for eight years (certificates dated 2019, 2022 and 2024) and additional EEC privileges.", from: "2019-06", to: "2032-12" }, { schemeId: "TH-eec", page: 188, text: "Additional 50% reduction of corporate income tax for five years after the exemption period under the EEC promotion measure.", from: "2027-06" }] },
          { id: "cpih-vn", name: "Chao Phraya Electronics Vietnam Co., Ltd.", iso: "VN", relationship: "subsidiary", ownerId: "cpih", ownership: 100, activity: "EMS manufacturing (Bac Ninh)", page: 96, text: "Chao Phraya Electronics Vietnam Co., Ltd. — Vietnam — manufacturing — 100.00%.", incentives: [{ schemeId: "VN-high-tech", page: 189, text: "The Vietnamese subsidiary is entitled to a 10% preferential rate for 15 years as a high-technology enterprise, with a four-year exemption from 2021 and a 50% reduction for nine years thereafter.", from: "2021-01", to: "2035-12" }] },
          { id: "cpih-my", name: "CPI Precision (Malaysia) Sdn. Bhd.", iso: "MY", relationship: "subsidiary", ownerId: "cpih", ownership: 70, activity: "Precision components (Penang)", page: 96, text: "CPI Precision (Malaysia) Sdn. Bhd. — Malaysia — precision components — 70.00% (acquired May 2025).", incentives: [{ schemeId: "MY-pioneer", page: 189, text: "CPI Precision (Malaysia) Sdn. Bhd. was granted Pioneer Status with 100% exemption of statutory income for a period of ten years ending 2031.", to: "2031-12" }] },
          { id: "cpih-sg", name: "CPIH Singapore Pte. Ltd.", iso: "SG", relationship: "subsidiary", ownerId: "cpih", ownership: 100, activity: "Regional headquarters and procurement", page: 96, text: "CPIH Singapore Pte. Ltd. — Singapore — regional headquarters — 100.00%." },
          { id: "cpih-hk", name: "CPIH (Hong Kong) Limited", iso: "HK", relationship: "subsidiary", ownerId: "cpih-sg", ownership: 100, activity: "Trading", page: 96, text: "CPIH (Hong Kong) Limited — Hong Kong — trading — 100.00% (indirect through CPIH Singapore Pte. Ltd.)." },
          { id: "cpih-us", name: "CPI Americas Inc.", iso: "US", relationship: "subsidiary", ownerId: "cpih", ownership: 100, activity: "Sales and customer support", page: 97, text: "CPI Americas Inc. — United States — sales — 100.00%." },
          { id: "cpih-de", name: "CPIH Europe GmbH", iso: "DE", relationship: "subsidiary", ownerId: "cpih", ownership: 100, activity: "Sales and engineering", page: 97, text: "CPIH Europe GmbH — Germany — 100.00%." },
          { id: "cpih-in", name: "Chao Phraya Components India Pvt. Ltd.", iso: "IN", relationship: "subsidiary", ownerId: "cpih", ownership: 100, activity: "New manufacturing (Tamil Nadu) — pre-operating", page: 97, text: "Chao Phraya Components India Private Limited — India — manufacturing (commenced construction 2025) — 100.00%.", incentives: [{ schemeId: "IN-newmfg", page: 189, text: "The Indian subsidiary intends to opt for the concessional 15% rate for new manufacturing companies under section 115BAB.", from: "2026-04" }] },
          { id: "cpih-ky", name: "CPIH Capital Ltd.", iso: "KY", relationship: "subsidiary", ownerId: "cpih", ownership: 100, activity: "Financing vehicle", page: 97, text: "CPIH Capital Ltd. — Cayman Islands — group financing — 100.00%." },
          { id: "cpih-assoc", name: "Siam Precision Tooling Co., Ltd.", iso: "TH", relationship: "associate", ownerId: "cpih", ownership: 35, activity: "Tooling", page: 98, text: "Siam Precision Tooling Co., Ltd. — Thailand — 35.00% — associate." },
        ],
        disclosures: [
          { topic: "pillar-two-statement", docId: "cpih-fs-2025", page: 78, section: "Note 27 Income tax", text: "The Group falls within the scope of the Pillar Two legislation enacted in Thailand (effective 1 January 2025), Vietnam, Malaysia and Singapore. The Group has performed an assessment of its potential exposure to Pillar Two income taxes.", isos: ["TH", "VN", "MY", "SG"] },
          { topic: "top-up-recognised", docId: "cpih-fs-2025", page: 78, section: "Note 27 Income tax", text: "The Group recognised current tax expense of THB 412 million related to Pillar Two top-up taxes for the year ended 31 December 2025, comprising domestic minimum top-up tax in Vietnam (THB 231 million) and Thailand (THB 181 million).", isos: ["VN", "TH"] },
          { topic: "uncertainty", docId: "cpih-fs-2025", page: 79, section: "Note 27 Income tax", text: "The Group's Malaysian subsidiary was acquired in May 2025 and is expected to qualify for the transitional CbCR safe harbour for the year; this has not been confirmed and the recognised amount excludes Malaysia.", isos: ["MY"] },
          { topic: "tax-reconciliation", docId: "cpih-fs-2025", page: 77, section: "Note 27 Income tax", text: "Profit before tax THB 4,980m; tax at 20% THB 996m; effect of promoted income THB (611)m; foreign rate differences THB (128)m; Pillar Two top-up taxes THB 412m; income tax expense THB 702m (effective rate 14.1%).", isos: ["TH", "VN", "MY"] },
        ],
        jurisdictionData: [{ iso: "TH", docId: "cpih-fs-2025", page: 80, text: "Thailand: profit before tax THB 2,940m; income tax expense (excluding top-up) THB 118m.", profitBeforeTaxThbM: 2_940, incomeTaxThbM: 118 }, { iso: "VN", docId: "cpih-fs-2025", page: 80, text: "Vietnam: profit before tax THB 1,540m; income tax expense (excluding top-up) THB 0m.", profitBeforeTaxThbM: 1_540, incomeTaxThbM: 0 }],
        disclosedAmounts: [{ iso: "VN", label: "Recognised — Vietnam QDMTT FY2025", amount: "THB 231 million", docId: "cpih-fs-2025", page: 78, text: "...domestic minimum top-up tax in Vietnam (THB 231 million)..." }, { iso: "TH", label: "Recognised — Thailand DMTT FY2025", amount: "THB 181 million", docId: "cpih-fs-2025", page: 78, text: "...and Thailand (THB 181 million)." }],
      },
      {
        period: "FY2024",
        docs: [D("cpih-ar-2024", "Chao Phraya Industrial Holdings — Annual Report 2024", "form-56-1", "FY2024", "Chao Phraya Industrial Holdings PCL", 251, "mixed"), D("cpih-fs-2024", "Consolidated financial statements 31 Dec 2024", "financial-statements", "FY2024", "Chao Phraya Industrial Holdings PCL", 98)],
        revenue: [{ period: "FY2021", amountThbMillion: 24_100, page: 70, docId: "cpih-ar-2024" }, { period: "FY2022", amountThbMillion: 26_900, page: 70, docId: "cpih-ar-2024" }, { period: "FY2023", amountThbMillion: 29_800, page: 70, docId: "cpih-ar-2024" }, { period: "FY2024", amountThbMillion: 31_200, page: 70, docId: "cpih-ar-2024" }],
        entities: [
          { id: "cpih", name: "Chao Phraya Industrial Holdings PCL", iso: "TH", relationship: "upe", ownerId: null, ownership: null, activity: "Holding; EMS", page: 8, text: "Parent company of the Group." },
          { id: "cpih-th1", name: "Chao Phraya Electronics Co., Ltd.", iso: "TH", relationship: "subsidiary", ownerId: "cpih", ownership: 99.99, activity: "EMS manufacturing (Rayong)", page: 90, text: "Chao Phraya Electronics Co., Ltd. — Thailand — 99.99%.", incentives: [{ schemeId: "TH-boi-holiday", page: 176, text: "Two BOI certificates with CIT exemption for eight years (2019, 2022).", from: "2019-06", to: "2030-12" }] },
          { id: "cpih-vn", name: "Chao Phraya Electronics Vietnam Co., Ltd.", iso: "VN", relationship: "subsidiary", ownerId: "cpih", ownership: 100, activity: "EMS manufacturing (Bac Ninh)", page: 90, text: "Chao Phraya Electronics Vietnam Co., Ltd. — Vietnam — 100.00%.", incentives: [{ schemeId: "VN-high-tech", page: 177, text: "10% preferential rate for 15 years; four-year exemption from 2021.", from: "2021-01", to: "2035-12" }] },
          { id: "cpih-sg", name: "CPIH Singapore Pte. Ltd.", iso: "SG", relationship: "subsidiary", ownerId: "cpih", ownership: 100, activity: "Regional headquarters", page: 90, text: "CPIH Singapore Pte. Ltd. — Singapore — 100.00%." },
          { id: "cpih-hk", name: "CPIH (Hong Kong) Limited", iso: "HK", relationship: "subsidiary", ownerId: "cpih-sg", ownership: 100, activity: "Trading", page: 90, text: "CPIH (Hong Kong) Limited — Hong Kong — 100.00% (indirect)." },
          { id: "cpih-us", name: "CPI Americas Inc.", iso: "US", relationship: "subsidiary", ownerId: "cpih", ownership: 100, activity: "Sales", page: 91, text: "CPI Americas Inc. — United States — 100.00%." },
          { id: "cpih-de", name: "CPIH Europe GmbH", iso: "DE", relationship: "subsidiary", ownerId: "cpih", ownership: 100, activity: "Sales and engineering", page: 91, text: "CPIH Europe GmbH — Germany — 100.00%." },
          { id: "cpih-ky", name: "CPIH Capital Ltd.", iso: "KY", relationship: "subsidiary", ownerId: "cpih", ownership: 100, activity: "Financing vehicle", page: 91, text: "CPIH Capital Ltd. — Cayman Islands — 100.00%." },
          { id: "cpih-assoc", name: "Siam Precision Tooling Co., Ltd.", iso: "TH", relationship: "associate", ownerId: "cpih", ownership: 35, activity: "Tooling", page: 92, text: "Siam Precision Tooling Co., Ltd. — 35.00% — associate." },
        ],
        disclosures: [
          { topic: "pillar-two-statement", docId: "cpih-fs-2024", page: 74, section: "Note 26 Income tax", text: "Thailand is expected to implement Pillar Two from 2025. The Group is assessing the impact; based on preliminary analysis, top-up tax may arise in respect of promoted operations in Thailand and Vietnam.", isos: ["TH", "VN"] },
          { topic: "tax-reconciliation", docId: "cpih-fs-2024", page: 73, section: "Note 26 Income tax", text: "Profit before tax THB 4,210m; tax at 20% THB 842m; effect of promoted income THB (566)m; foreign rate differences THB (109)m; income tax expense THB 201m (effective rate 4.8%).", isos: ["TH", "VN"] },
        ],
      },
    ],
  },
  {
    registryId: "lannadigital",
    periods: [
      {
        period: "FY2025",
        docs: [D("ldg-ar-2025", "Lanna Digital Group — Annual Report 2025", "annual-report", "FY2025", "Lanna Digital Group PCL", 164), D("ldg-fs-2025", "Consolidated financial statements 31 Dec 2025", "financial-statements", "FY2025", "Lanna Digital Group PCL", 72)],
        revenue: [{ period: "FY2024", amountThbMillion: 27_950, page: 40, docId: "ldg-ar-2025" }, { period: "FY2025", amountThbMillion: 33_300, page: 40, docId: "ldg-ar-2025" }],
        entities: [
          { id: "ldg", name: "Lanna Digital Group PCL", nameTh: "บริษัท ล้านนา ดิจิทัล กรุ๊ป จำกัด (มหาชน)", formerNames: ["Lanna Software Co., Ltd."], iso: "TH", relationship: "upe", ownerId: null, ownership: null, activity: "Software platforms; holding", page: 6, text: "Lanna Digital Group Public Company Limited (formerly Lanna Software Co., Ltd.) is the parent company.", incentives: [{ schemeId: "TH-boi-holiday", page: 128, text: "The Company holds BOI promotion for software development with corporate income tax exemption for eight years from 2022.", from: "2022-01", to: "2029-12" }] },
          { id: "ldg-sg", name: "Lanna Labs Singapore Pte. Ltd.", iso: "SG", relationship: "subsidiary", ownerId: "ldg", ownership: 100, activity: "R&D and regional sales", page: 58, text: "Lanna Labs Singapore Pte. Ltd. — Singapore — 100.00%." },
          { id: "ldg-ie", name: "LDG Technologies Ireland Ltd", iso: "IE", relationship: "subsidiary", ownerId: "ldg-sg", ownership: 100, activity: "IP holding and European licensing", page: 58, text: "LDG Technologies Ireland Limited — Ireland — IP holding — 100.00% (indirect).", incentives: [{ schemeId: "IE-kdb", page: 129, text: "LDG Technologies Ireland Limited has claimed relief under the Knowledge Development Box in respect of qualifying assets.", from: "2024-01" }] },
          { id: "ldg-vn", name: "Lanna Digital Vietnam Co., Ltd.", iso: "VN", relationship: "subsidiary", ownerId: "ldg", ownership: 100, activity: "Software development centre", page: 58, text: "Lanna Digital Vietnam Co., Ltd. — Vietnam — software development — 100.00%.", incentives: [{ schemeId: "VN-high-tech", page: 129, text: "Entitled to software-production incentives: 10% for 15 years with exemption and reduction periods.", from: "2023-01" }] },
          { id: "ldg-unres", name: "LDG Ventures", iso: "VG", relationship: "unresolved", ownerId: null, ownership: null, activity: "Investment (disclosed as related party)", page: 61, text: "LDG Ventures — British Virgin Islands — disclosed in related-party transactions; ownership and control relationship not stated." },
        ],
        disclosures: [
          { topic: "pillar-two-statement", docId: "ldg-fs-2025", page: 60, section: "Note 22 Income tax", text: "Consolidated revenue exceeded the equivalent of EUR 750 million for the first time in 2025. Management has assessed that the Group may fall within the scope of Pillar Two from 2027 depending on the revenue test in subsequent years, and is preparing for compliance. Revenue for 2022 and 2023 was restated following the business combination and is presented in the 2023 annual report.", isos: ["TH"] },
          { topic: "tax-reconciliation", docId: "ldg-fs-2025", page: 59, section: "Note 22 Income tax", text: "Profit before tax THB 1,820m; tax at 20% THB 364m; BOI-exempt income THB (210)m; Knowledge Development Box relief THB (38)m; income tax expense THB 131m (effective rate 7.2%).", isos: ["TH", "IE"] },
        ],
      },
    ],
  },
  {
    registryId: "aetherion",
    periods: [
      {
        period: "FY2025",
        docs: [D("aeth-ar-2025", "Aetherion Holdings — Form 56-1 One Report 2025", "form-56-1", "FY2025", "Aetherion Holdings PCL", 288), D("aeth-fs-2025", "Consolidated financial statements 31 Dec 2025", "financial-statements", "FY2025", "Aetherion Holdings PCL", 121)],
        revenue: [{ period: "FY2022", amountThbMillion: 128_000, page: 88, docId: "aeth-ar-2025" }, { period: "FY2023", amountThbMillion: 141_500, page: 88, docId: "aeth-ar-2025" }, { period: "FY2024", amountThbMillion: 156_200, page: 88, docId: "aeth-ar-2025" }, { period: "FY2025", amountThbMillion: 169_900, page: 88, docId: "aeth-ar-2025" }],
        entities: [
          { id: "aeth", name: "Aetherion Holdings PCL", nameTh: "บริษัท เอเทอเรียน โฮลดิ้งส์ จำกัด (มหาชน)", iso: "TH", relationship: "upe", ownerId: null, ownership: null, activity: "Holding; advanced manufacturing", page: 10, text: "Aetherion Holdings Public Company Limited is the ultimate parent entity.", incentives: [{ schemeId: "TH-boi-holiday", page: 201, text: "BOI promotion for advanced electronics with CIT exemption to 2027.", to: "2027-12" }] },
          { id: "aeth-ie", name: "Aetherion Technologies Ireland Ltd", iso: "IE", relationship: "subsidiary", ownerId: "aeth", ownership: 100, activity: "IP and licensing", page: 112, text: "Aetherion Technologies Ireland Limited — Ireland — 100.00%.", incentives: [{ schemeId: "IE-kdb", page: 203, text: "Knowledge Development Box relief claimed on qualifying IP.", from: "2023-01" }] },
          { id: "aeth-vn", name: "Aetherion Manufacturing Vietnam Co., Ltd.", iso: "VN", relationship: "subsidiary", ownerId: "aeth", ownership: 100, activity: "Manufacturing", page: 112, text: "Aetherion Manufacturing Vietnam Co., Ltd. — Vietnam — 100.00%.", incentives: [{ schemeId: "VN-high-tech", page: 203, text: "High-tech preferential rate and exemption periods.", from: "2020-01", to: "2034-12" }] },
          { id: "aeth-hk", name: "Aetherion Asia (Hong Kong) Ltd", iso: "HK", relationship: "subsidiary", ownerId: "aeth", ownership: 100, activity: "Regional trading", page: 112, text: "Aetherion Asia (Hong Kong) Limited — Hong Kong — 100.00%." },
          { id: "aeth-sg", name: "Aetherion Treasury Pte. Ltd.", iso: "SG", relationship: "subsidiary", ownerId: "aeth", ownership: 100, activity: "Treasury centre", page: 112, text: "Aetherion Treasury Pte. Ltd. — Singapore — 100.00%.", incentives: [{ schemeId: "SG-fti", page: 203, text: "Finance and Treasury Centre incentive awarded 2024.", from: "2024-01" }] },
          { id: "aeth-us", name: "Aetherion Inc.", iso: "US", relationship: "subsidiary", ownerId: "aeth", ownership: 100, activity: "Sales", page: 113, text: "Aetherion Inc. — United States — 100.00%." },
          { id: "aeth-my", name: "Aetherion Components Sdn. Bhd.", iso: "MY", relationship: "subsidiary", ownerId: "aeth", ownership: 100, activity: "Components", page: 113, text: "Aetherion Components Sdn. Bhd. — Malaysia — 100.00%." },
        ],
        disclosures: [
          { topic: "pillar-two-statement", docId: "aeth-fs-2025", page: 90, section: "Note 33 Income tax", text: "The Group is within the scope of Pillar Two. Thailand's top-up tax legislation applies from 1 January 2025. The Group has assessed exposure in Ireland, Vietnam, Thailand and Hong Kong.", isos: ["IE", "VN", "TH", "HK"] },
          { topic: "expected-impact", docId: "aeth-fs-2025", page: 90, section: "Note 33 Income tax", text: "Management expects the most significant top-up tax to arise in Ireland in respect of income benefiting from the Knowledge Development Box, collected through the Irish qualified domestic minimum top-up tax.", isos: ["IE"] },
        ],
      },
    ],
  },
  {
    registryId: "thaicoal",
    periods: [
      {
        period: "FY2025",
        docs: [D("tc-ar-2025", "ThaiCoal PCL — Form 56-1 One Report 2025", "form-56-1", "FY2025", "ThaiCoal PCL", 312), D("tc-fs-2025", "Consolidated financial statements 31 Dec 2025", "financial-statements", "FY2025", "ThaiCoal PCL", 138)],
        revenue: [{ period: "FY2022", amountThbMillion: 214_000, page: 92, docId: "tc-ar-2025" }, { period: "FY2023", amountThbMillion: 178_600, page: 92, docId: "tc-ar-2025" }, { period: "FY2024", amountThbMillion: 187_300, page: 92, docId: "tc-ar-2025" }, { period: "FY2025", amountThbMillion: 168_400, page: 92, docId: "tc-ar-2025" }],
        entities: [
          { id: "tc", name: "ThaiCoal PCL", nameTh: "บริษัท ไทยโคล จำกัด (มหาชน)", iso: "TH", relationship: "upe", ownerId: null, ownership: null, activity: "Coal trading and mining; energy holding", page: 12, text: "ThaiCoal Public Company Limited is the ultimate parent entity, listed on the Stock Exchange of Thailand." },
          { id: "tc-pwr", name: "ThaiCoal Power PCL", iso: "TH", relationship: "subsidiary", ownerId: "tc", ownership: 78, activity: "Power generation (listed)", page: 118, text: "ThaiCoal Power Public Company Limited — Thailand — 78.00% (listed; 22% held by the public)." },
          { id: "tc-nrg", name: "ThaiCoal NextGen Energy Co., Ltd.", iso: "TH", relationship: "subsidiary", ownerId: "tc-pwr", ownership: 100, activity: "Solar and battery storage", page: 118, text: "ThaiCoal NextGen Energy Co., Ltd. — Thailand — 100.00% (held through ThaiCoal Power PCL).", incentives: [{ schemeId: "TH-boi-holiday", page: 214, text: "BOI Category 7.1 promotion for solar farm and battery storage at Lopburi with CIT exemption to 31 December 2026, then 50% reduction to 2031.", to: "2031-12" }] },
          { id: "tc-sg", name: "ThaiCoal Singapore Pte. Ltd.", iso: "SG", relationship: "subsidiary", ownerId: "tc", ownership: 100, activity: "Coal trading hub", page: 119, text: "ThaiCoal Singapore Pte. Ltd. — Singapore — 100.00%.", incentives: [{ schemeId: "SG-gtp", page: 215, text: "Global Trader Programme award at 10% on qualifying coal trading income to June 2029.", from: "2019-07", to: "2029-06" }] },
          { id: "tc-id", name: "PT ThaiCoal Indo Tbk", iso: "ID", relationship: "subsidiary", ownerId: "tc-sg", ownership: 65, activity: "Coal mining (listed on IDX)", page: 119, text: "PT ThaiCoal Indo Tbk — Indonesia — 65.00% (listed; 35% held by the public)." },
          { id: "tc-au", name: "ThaiCoal Australia Pty Ltd", iso: "AU", relationship: "subsidiary", ownerId: "tc", ownership: 100, activity: "Underground coal mining", page: 120, text: "ThaiCoal Australia Pty Ltd — Australia — 100.00%." },
          { id: "tc-us", name: "ThaiCoal Energy US Corp.", iso: "US", relationship: "subsidiary", ownerId: "tc", ownership: 75, activity: "Shale gas and power", page: 120, text: "ThaiCoal Energy US Corp. — United States — 75.00%." },
          { id: "tc-jp", name: "ThaiCoal Power Japan K.K.", iso: "JP", relationship: "subsidiary", ownerId: "tc-pwr", ownership: 100, activity: "Solar power", page: 121, text: "ThaiCoal Power Japan K.K. — Japan — 100.00% (held through ThaiCoal Power PCL)." },
          { id: "tc-cn", name: "ThaiCoal Power (Shanxi) Co., Ltd.", iso: "CN", relationship: "subsidiary", ownerId: "tc-pwr", ownership: 100, activity: "Combined heat and power", page: 121, text: "ThaiCoal Power (Shanxi) Co., Ltd. — China — 100.00% (held through ThaiCoal Power PCL).", incentives: [{ schemeId: "CN-hnte", page: 216, text: "High and New Technology Enterprise certification at 15% EIT to 31 December 2025; renewal pending.", from: "2023-01", to: "2025-12" }] },
          { id: "tc-la", name: "ThaiCoal-Lao Lignite Power Co., Ltd.", iso: "LA", relationship: "associate", ownerId: "tc-pwr", ownership: 40, activity: "Lignite power (equity-accounted)", page: 122, text: "ThaiCoal-Lao Lignite Power Co., Ltd. — Lao PDR — 40.00% associate, equity method." },
          { id: "tc-vn", name: "ThaiCoal-Trang Wind Power JV", iso: "VN", relationship: "joint-venture", ownerId: "tc", ownership: 50, activity: "Wind power (joint venture)", page: 122, text: "ThaiCoal-Trang Wind Power Joint Venture — Vietnam — 50.00%, equity method.", incentives: [{ schemeId: "VN-high-tech", page: 216, text: "Renewable power EIT incentive: 4-year exemption, 50% reduction for 9 years, 10% preferential rate to 2037.", from: "2023-01", to: "2037-12" }] },
        ],
        disclosures: [
          { topic: "pillar-two-statement", docId: "tc-fs-2025", page: 104, section: "Note 36 Income tax", text: "The Group is within the scope of the OECD Pillar Two model rules. Thailand's Emergency Decree on Top-up Tax B.E. 2567 applies to fiscal years beginning on or after 1 January 2025. As the ultimate parent entity is in Thailand, the Group is subject to the Thai income inclusion rule and the Thai domestic minimum top-up tax.", isos: ["TH"] },
          { topic: "expected-impact", docId: "tc-fs-2025", page: 104, section: "Note 36 Income tax", text: "Management expects top-up tax to arise principally in Thailand, in respect of BOI-promoted solar income, and in Singapore, in respect of trading income under the Global Trader Programme, collected through the respective domestic minimum top-up taxes. A Thai income inclusion rule charge is expected on the Group's Chinese power operations.", isos: ["TH", "SG", "CN"] },
          { topic: "top-up-recognised", docId: "tc-fs-2025", page: 105, section: "Note 36 Income tax", text: "Current tax expense includes THB 168 million of Pillar Two top-up tax for the year ended 31 December 2025.", isos: ["TH", "SG"] },
          { topic: "uncertainty", docId: "tc-fs-2025", page: 105, section: "Note 36 Income tax", text: "The Group has applied the transitional country-by-country reporting safe harbour where available. Australian operations recorded a loss for the year and no effective tax rate is computed for that jurisdiction.", isos: ["AU", "JP", "ID"] },
          { topic: "incentive", docId: "tc-ar-2025", page: 214, section: "Investment promotion", text: "ThaiCoal NextGen Energy holds a BOI promotion certificate (Category 7.1) for its 480 MW solar and battery storage project at Lopburi, with corporate income tax exemption to 31 December 2026.", isos: ["TH"] },
          { topic: "tax-reconciliation", docId: "tc-fs-2025", page: 103, section: "Note 36 Income tax", text: "Profit before tax THB 22,410m; tax at 20% THB 4,482m; effect of different rates in foreign jurisdictions THB 610m; BOI-exempt income THB (1,240)m; non-taxable dividend income THB (3,660)m; income tax expense THB 3,228m (effective rate 14.4%).", isos: ["TH", "SG", "AU", "US"] },
        ],
      },
    ],
  },
];

export function corpusFor(registryId: string): CorpusGroup | undefined {
  return CORPUS.find((c) => c.registryId === registryId);
}

export function resolvedFromRegistry(r: RegistryEntry, matchedOn: string, enteredWasSubsidiary?: string): ResolvedEntity {
  return { registryId: r.id, name: r.name, nameTh: r.nameTh, exchange: r.exchange, ticker: r.ticker, upeName: r.name, upeIso: r.upeIso, matchedOn, isUpe: true, enteredWasSubsidiary };
}

export function passage(docId: string, page: number, text: string, period: string, section?: string): Passage {
  return { docId, page, text, period, section };
}

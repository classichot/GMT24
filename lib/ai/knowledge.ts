import { RULES } from "../model";
import { citationsIn } from "../legal";
import { legalKbEntries } from "../legal/kb";
import type { Authority, KbEntry, WorkContext } from "./types";

const OECD_COMMENTARY_URL = "https://www.oecd.org/en/publications/tax-challenges-arising-from-the-digitalisation-of-the-economy-consolidated-commentary-to-the-global-anti-base-erosion-model-rules-2026_4377e89f-en.html";
const RD_DECREE_URL = "https://www.rd.go.th/67365.html";
const RD_MAP_URL = "https://www.rd.go.th/fileadmin/user_upload/porsor/topuptaxreference_170269.pdf";

export const AUTHORITY_LABEL: Record<Authority, string> = {
  "thai-law": "Thai law",
  "domestic-law": "Domestic law",
  "oecd-model": "OECD Model Rules",
  "oecd-commentary": "OECD Commentary",
  "oecd-ag": "OECD Administrative Guidance",
  internal: "GMT24 internal interpretation",
};

/** Authority rank used when two sources conflict: domestic instrument first, then OECD, then internal. */
export const AUTHORITY_RANK: Record<Authority, number> = {
  "thai-law": 0,
  "domestic-law": 0,
  "oecd-model": 1,
  "oecd-commentary": 2,
  "oecd-ag": 2,
  internal: 3,
};

function entry(e: Omit<KbEntry, "versions" | "applicableFrom" | "applicableTo"> & { applicableFrom?: number; applicableTo?: number | null; versions?: KbEntry["versions"] }): KbEntry {
  return {
    applicableFrom: 2024,
    applicableTo: null,
    versions: [{ version: e.version, publishedAt: e.publishedAt, note: "Loaded into the approved knowledge base." }],
    ...e,
  };
}

/**
 * Legal knowledge service. Each entry carries provision, authority tier,
 * publication status, applicability window and version history. Retrieval is
 * filtered by the fiscal year and jurisdiction in the work context so a
 * superseded or not-yet-effective passage cannot be cited as current law.
 */
export const KNOWLEDGE: KbEntry[] = [
  entry({ id: "KB-OECD-1.1", title: "Scope — EUR 750m two-of-four test", authority: "oecd-model", provision: "GloBE Model Rules Art. 1.1", passage: "An MNE Group is in scope for a Fiscal Year if consolidated revenue is EUR 750 million or more in at least two of the four Fiscal Years immediately preceding the tested year.", status: "final", publishedAt: "2021-12-20", effectiveFrom: "2024-01-01", jurisdictions: ["*"], topics: ["scope", "750m", "revenue threshold"], ruleIds: ["OECD-SCOPE-750"], version: "2021.12", url: OECD_COMMENTARY_URL, href: "/scope" }),
  entry({ id: "KB-OECD-2.1.4", title: "POPE — IIR applies at the Partially-Owned Parent first", authority: "oecd-model", provision: "GloBE Model Rules Art. 2.1.4 / 2.3", passage: "A Partially-Owned Parent Entity — more than 20% of its Ownership Interests held by persons that are not Group Entities — applies the IIR to its Allocable Share before the UPE, which takes the residual.", status: "final", publishedAt: "2021-12-20", effectiveFrom: "2024-01-01", jurisdictions: ["*"], topics: ["pope", "iir", "partially-owned", "inclusion ratio", "entity test"], ruleIds: ["OECD-POPE-214", "OECD-IR-222"], version: "2021.12", href: "/entities" }),
  entry({ id: "KB-OECD-2.6", title: "UTPR allocation key", authority: "oecd-model", provision: "GloBE Model Rules Art. 2.6", passage: "UTPR Top-up Tax is allocated 50% by number of employees and 50% by net book value of tangible assets among UTPR jurisdictions.", status: "final", publishedAt: "2021-12-20", effectiveFrom: "2025-01-01", jurisdictions: ["*"], topics: ["utpr", "allocation", "employees", "tangible assets"], ruleIds: ["OECD-UTPR-26"], version: "2021.12", href: "/allocation" }),
  entry({ id: "KB-OECD-3.2.1b", title: "Excluded Dividends", authority: "oecd-model", provision: "GloBE Model Rules Art. 3.2.1(b) / Art. 10.1", passage: "Dividends received in respect of an Ownership Interest are excluded from GloBE Income except for a Short-term Portfolio Shareholding (less than 10% held for under one year). The holding must be an Ownership Interest — an instrument carrying rights to profits, capital or reserves.", status: "final", publishedAt: "2021-12-20", effectiveFrom: "2024-01-01", jurisdictions: ["*"], topics: ["dividend", "excluded dividend", "portfolio", "ownership interest", "10%"], ruleIds: ["OECD-DIV-EXCL"], version: "2021.12", href: "/globe-income" }),
  entry({ id: "KB-OECD-3.2.2", title: "Stock-Based Compensation Election", authority: "oecd-model", provision: "GloBE Model Rules Art. 3.2.2", passage: "A Five-Year Election to substitute the amount allowed as a deduction for stock-based compensation in the local tax return for the financial accounting expense. Made per jurisdiction and binds every Constituent Entity located there.", status: "final", publishedAt: "2021-12-20", effectiveFrom: "2024-01-01", jurisdictions: ["*"], topics: ["stock compensation", "3.2.2", "election", "five-year"], ruleIds: ["OECD-ELEC-2026"], version: "2021.12", href: "/elections" }),
  entry({ id: "KB-OECD-3.4", title: "International Shipping Income exclusion", authority: "oecd-model", provision: "GloBE Model Rules Art. 3.4.1–3.4.5", passage: "International Shipping Income and Qualified Ancillary International Shipping Income (capped at 50% of ISI) are excluded from GloBE Income if strategic or commercial management of all ships is effectively carried on from the CE's jurisdiction. Related Covered Taxes and SBIE inputs come out too.", status: "final", publishedAt: "2021-12-20", effectiveFrom: "2024-01-01", jurisdictions: ["*"], topics: ["shipping", "3.4", "qaisi", "management test"], ruleIds: ["OECD-SHIP-34"], version: "2021.12", href: "/globe-income" }),
  entry({ id: "KB-OECD-4.1.5", title: "Negative Adjusted Covered Taxes in a GloBE Loss year", authority: "oecd-model", provision: "GloBE Model Rules Art. 4.1.5", passage: "Where there is no Net GloBE Income and Adjusted Covered Taxes are below zero and below the Expected Adjusted Covered Taxes Amount, the difference is Additional Current Top-up Tax — unless the carry-forward election is made.", status: "final", publishedAt: "2021-12-20", effectiveFrom: "2024-01-01", jurisdictions: ["*"], topics: ["4.1.5", "acttt", "negative tax", "loss year"], ruleIds: ["OECD-GloBE-15"], version: "2021.12", href: "/covered-taxes" }),
  entry({ id: "KB-OECD-4.4.1", title: "Deferred tax recast at the Minimum Rate", authority: "oecd-model", provision: "GloBE Model Rules Art. 4.4.1", passage: "The Total Deferred Tax Adjustment Amount is recast at the Minimum Rate where the applicable domestic rate exceeds 15%. Uncertain tax positions and distributions are excluded.", status: "final", publishedAt: "2021-12-20", effectiveFrom: "2024-01-01", jurisdictions: ["*"], topics: ["deferred tax", "recast", "4.4.1"], ruleIds: ["OECD-DT-441"], version: "2021.12", href: "/deferred-tax" }),
  entry({ id: "KB-OECD-4.4.4", title: "Five-year DTL recapture", authority: "oecd-model", provision: "GloBE Model Rules Art. 4.4.4", passage: "A deferred tax liability that is not a Recapture Exception Accrual and is not paid or reversed within the five subsequent Fiscal Years is recaptured: the origin-year ETR and Top-up Tax are recomputed.", status: "final", publishedAt: "2021-12-20", effectiveFrom: "2024-01-01", jurisdictions: ["*"], topics: ["recapture", "dtl", "4.4.4", "five-year"], ruleIds: ["OECD-DT-444"], version: "2021.12", href: "/deferred-tax" }),
  entry({ id: "KB-OECD-5.1", title: "Jurisdictional ETR", authority: "oecd-model", provision: "GloBE Model Rules Art. 5.1.1", passage: "ETR = sum of Adjusted Covered Taxes of each CE located in the jurisdiction ÷ Net GloBE Income of the jurisdiction. Investment Entities, JV Groups and Minority-Owned Constituent Entities are computed separately.", status: "final", publishedAt: "2021-12-20", effectiveFrom: "2024-01-01", jurisdictions: ["*"], topics: ["etr", "effective tax rate", "blending", "5.1"], ruleIds: ["OECD-GloBE-15"], version: "2021.12", href: "/etr" }),
  entry({ id: "KB-OECD-5.2", title: "Top-up Tax Percentage and Excess Profit", authority: "oecd-model", provision: "GloBE Model Rules Art. 5.2.1–5.2.3", passage: "Top-up Tax Percentage = Minimum Rate − ETR. Excess Profit = Net GloBE Income − Substance-based Income Exclusion. Jurisdictional Top-up Tax = Top-up % × Excess Profit + Additional Current Top-up Tax − Qualified Domestic Minimum Top-up Tax.", status: "final", publishedAt: "2021-12-20", effectiveFrom: "2024-01-01", jurisdictions: ["*"], topics: ["top-up", "excess profit", "5.2", "minimum rate", "15%"], ruleIds: ["OECD-GloBE-15"], version: "2021.12", href: "/top-up" }),
  entry({ id: "KB-OECD-5.1.3", title: "Minority-Owned Constituent Entities", authority: "oecd-model", provision: "GloBE Model Rules Art. 5.6 / 10.1 (MOCE)", passage: "Where the UPE's Ownership Interest in a Constituent Entity is 30% or less, its ETR and Top-up Tax are computed separately from other CEs in the jurisdiction.", status: "final", publishedAt: "2021-12-20", effectiveFrom: "2024-01-01", jurisdictions: ["*"], topics: ["moce", "minority-owned", "mosg", "entity test"], ruleIds: ["OECD-MOCE-513"], version: "2021.12", href: "/entities" }),
  entry({ id: "KB-OECD-5.3", title: "Substance-based Income Exclusion", authority: "oecd-model", provision: "GloBE Model Rules Art. 5.3 / Art. 9.2 transition", passage: "SBIE = payroll carve-out % × Eligible Payroll Costs + tangible asset carve-out % × Eligible Tangible Assets. Transition rates for a Fiscal Year beginning in 2026: 9.4% payroll, 7.4% tangible assets, stepping down to 5% / 5% by 2033.", status: "final", publishedAt: "2021-12-20", effectiveFrom: "2024-01-01", jurisdictions: ["*"], topics: ["sbie", "substance", "payroll", "tangible", "carve-out", "9.4%", "7.4%"], ruleIds: ["OECD-SBIE-2026"], version: "2021.12", href: "/sbie" }),
  entry({ id: "KB-OECD-6.4", title: "Joint Venture Group — separate ETR", authority: "oecd-model", provision: "GloBE Model Rules Art. 6.4 / Art. 10.1", passage: "A Joint Venture (equity-accounted, UPE holds 50% or more) and its subsidiaries are treated as a separate MNE Group for ETR and Top-up purposes; the top-up is allocated to the Parent Entities' Allocable Share.", status: "final", publishedAt: "2021-12-20", effectiveFrom: "2024-01-01", jurisdictions: ["*"], topics: ["joint venture", "jv", "6.4", "equity method"], ruleIds: ["OECD-JV-64"], version: "2021.12", href: "/entities" }),
  entry({ id: "KB-OECD-8.1", title: "GloBE Information Return", authority: "oecd-model", provision: "GloBE Model Rules Art. 8.1", passage: "Each CE files a GIR, or is covered by a Designated Filing Entity in a jurisdiction with a Qualifying Competent Authority Agreement, within 15 months after the last day of the Reporting Fiscal Year (18 months in the transition year).", status: "final", publishedAt: "2021-12-20", effectiveFrom: "2024-01-01", jurisdictions: ["*"], topics: ["gir", "filing", "15 months", "designated filing entity"], ruleIds: [], version: "2021.12", href: "/gir" }),
  entry({ id: "KB-AG-2023-02-ENTE", title: "Excess Negative Tax Expense — mandatory administrative procedure", authority: "oecd-ag", provision: "OECD Administrative Guidance, February 2023, §2.7", passage: "Where Net GloBE Income is positive and Adjusted Covered Taxes are negative, the MNE Group must exclude the negative amount from the ETR computation for the year and carry it forward as Excess Negative Tax Expense, reducing Adjusted Covered Taxes in later years. Top-up Tax Percentage therefore cannot exceed the Minimum Rate.", status: "final", publishedAt: "2023-02-02", effectiveFrom: "2023-02-02", jurisdictions: ["*"], topics: ["ente", "excess negative tax", "negative covered tax", "30%", "hong kong"], ruleIds: ["OECD-ENTE-521"], version: "2023.2", url: OECD_COMMENTARY_URL, href: "/etr?iso=HK" }),
  entry({ id: "KB-AG-TCSH", title: "Transitional CbCR Safe Harbour — extended", authority: "oecd-ag", provision: "Safe Harbours and Penalty Relief (Dec 2022) as amended by 2026 Administrative Guidance", passage: "Transitional CbCR Safe Harbour applies to Fiscal Years beginning on or before 31 December 2027 (Simplified ETR 17% for 2026 and 2027 years). Once a jurisdiction fails or does not elect the harbour, it cannot re-enter — once out, always out.", status: "final", publishedAt: "2026-01-15", effectiveFrom: "2026-01-01", applicableFrom: 2026, applicableTo: 2027, jurisdictions: ["*"], topics: ["safe harbour", "tcsh", "transitional cbcr", "17%", "once out"], ruleIds: ["OECD-TCSH-2026"], version: "2026.2", versions: [
    { version: "2022.12", publishedAt: "2022-12-20", note: "Original: FY beginning on or before 31 Dec 2026; 16% for 2025, 17% for 2026." },
    { version: "2026.2", publishedAt: "2026-01-15", note: "Extended one year; 17% Simplified ETR retained for 2026–2027." },
  ], href: "/safe-harbours" }),
  entry({ id: "KB-AG-SBTISH", title: "Substance-based Tax Incentive Safe Harbour", authority: "oecd-ag", provision: "2026 Administrative Guidance — SBTISH", passage: "A jurisdiction with a Qualified Substance-based Tax Incentive may be treated as having no Top-up Tax if the incentive is tied to eligible payroll or tangible-asset expenditure and qualifying expenditure is traced. IP boxes are not substance-based incentives.", status: "final", publishedAt: "2026-01-15", effectiveFrom: "2026-01-01", applicableFrom: 2026, jurisdictions: ["*"], topics: ["sbtish", "substance-based incentive", "boi", "ip box", "kdb"], ruleIds: ["OECD-SBTISH"], version: "2026.2", href: "/safe-harbours" }),
  entry({ id: "KB-AG-SBS", title: "Side-by-Side and Transitional UTPR Safe Harbour", authority: "oecd-ag", provision: "Inclusive Framework statement January 2026 — Side-by-Side", passage: "UPE jurisdictions with a qualifying domestic minimum tax system may be treated side-by-side with GloBE; the Transitional UTPR Safe Harbour treats UTPR Top-up as zero for the UPE jurisdiction with a nominal CIT rate of at least 20%.", status: "final", publishedAt: "2026-01-15", effectiveFrom: "2026-01-01", applicableFrom: 2026, jurisdictions: ["US"], topics: ["side-by-side", "sbs", "utpr safe harbour", "united states"], ruleIds: ["OECD-SBS"], version: "2026.1", href: "/safe-harbours" }),
  entry({ id: "KB-TH-DECREE", title: "Emergency Decree on Top-up Tax B.E. 2567 — scope and charge", authority: "thai-law", provision: "Emergency Decree B.E. 2567 ss 9–12", passage: "Thailand imposes a Qualified Domestic Minimum Top-up Tax on Constituent Entities located in Thailand of an in-scope MNE Group for accounting periods beginning on or after 1 January 2025. The IIR and UTPR provisions are enacted with later commencement.", status: "final", publishedAt: "2024-12-26", effectiveFrom: "2025-01-01", applicableFrom: 2025, jurisdictions: ["TH"], topics: ["thailand", "qdmtt", "decree", "thai law", "scope"], ruleIds: ["TH-QDMTT-2025"], version: "2567.1", url: RD_DECREE_URL, href: "/thailand" }),
  entry({ id: "KB-TH-S54-58", title: "Thai notification, return and payment clocks", authority: "thai-law", provision: "Emergency Decree B.E. 2567 ss 54–58", passage: "s 54 UPE / GIR-filer notification and ss 55–57 GIR, return and payment fall 15 months after the end of the accounting period; s 58 grants 18 months for the first in-scope year.", status: "final", publishedAt: "2024-12-26", effectiveFrom: "2025-01-01", applicableFrom: 2025, jurisdictions: ["TH"], topics: ["thai filing", "section 57", "section 54", "deadline", "15 months"], ruleIds: [], version: "2567.1", url: RD_DECREE_URL, href: "/thailand/filing" }),
  entry({ id: "KB-TH-NOTIF-4", title: "Thai SBIE — DG Notification No. 4 and MOF Notification No. 1", authority: "thai-law", provision: "DG Notification No. 4; MOF Notification No. 1", passage: "Eligible payroll includes full-time, temporary and ordinary-activity contractors, bonuses, share-based pay and social security, apportioned where work in Thailand is 50% or less; capitalised payroll in PPE is excluded. Eligible tangible assets use the average of opening and closing carrying value and exclude revaluation uplift.", status: "final", publishedAt: "2025-06-30", effectiveFrom: "2025-01-01", applicableFrom: 2025, jurisdictions: ["TH"], topics: ["thai sbie", "notification 4", "payroll", "tangible", "50%"], ruleIds: ["TH-SBIE-MOF-1"], version: "2567.2", href: "/thailand/sbie" }),
  entry({ id: "KB-TH-NOTIF-6", title: "Thai FX — DG Notification No. 6 (BOT rates)", authority: "thai-law", provision: "DG Notification No. 6", passage: "EUR thresholds convert at the Bank of Thailand December average midpoint preceding the accounting period; foreign-currency statements convert at the same prescribed rate; payments use the commercial-bank average on the last business day before approval.", status: "final", publishedAt: "2025-06-30", effectiveFrom: "2025-01-01", applicableFrom: 2025, jurisdictions: ["TH"], topics: ["bot", "fx", "exchange rate", "notification 6"], ruleIds: ["TH-FX-BOT"], version: "2567.2", href: "/thailand/fx" }),
  entry({ id: "KB-TH-PENDING", title: "Pending Thai instruments — ss 31, 33, 53–57 forms and schema", authority: "thai-law", provision: "Emergency Decree B.E. 2567 ss 31, 33, 53–57 (subordinate instruments pending)", passage: "The electronic return form, GIR local schema and QRTC/MTTC mechanics are not yet prescribed. GMT24 documents these as coverage exceptions; do not treat the platform as ready for Thai filing until the instruments are issued.", status: "draft", publishedAt: "2026-05-01", effectiveFrom: "—", applicableFrom: 2025, jurisdictions: ["TH"], topics: ["pending", "thai filing", "schema", "qrtc", "rd news"], ruleIds: [], version: "RD news 5/2026", url: RD_MAP_URL, href: "/thailand/gap" }),
  entry({ id: "KB-INT-KDB", title: "Ireland KDB is not SBTISH-eligible", authority: "internal", provision: "GMT24 interpretation · Rulebook 2026.2", passage: "The Knowledge Development Box is an IP-box regime keyed to qualifying IP profits, not to payroll or tangible-asset expenditure. GMT24 does not offer SBTISH for Ireland on this basis; the position was accepted by the engagement reviewer.", status: "guidance", publishedAt: "2026-08-12", effectiveFrom: "2026-08-12", applicableFrom: 2026, jurisdictions: ["IE"], topics: ["kdb", "ireland", "sbtish", "ip box"], ruleIds: ["OECD-SBTISH"], version: "2026.2", href: "/issues" }),
  entry({ id: "KB-INT-ABSENCE", title: "Absence from the Central Record is not a finding", authority: "internal", provision: "GMT24 interpretation · jurisdiction packs", passage: "If a jurisdiction does not appear in the OECD Central Record of qualified legislation, GMT24 will not downgrade a signed pack on that fact alone. Vietnam and Hong Kong in the demo are marked 'Not on Central Record' rather than 'unqualified'.", status: "guidance", publishedAt: "2026-09-03", effectiveFrom: "2026-09-03", applicableFrom: 2026, jurisdictions: ["VN", "HK"], topics: ["central record", "jurisdiction pack", "qualified status"], ruleIds: [], version: "2026.2", href: "/jurisdictions" }),
  // Monitored items — not approved production guidance until an expert reviews them on Regulatory Impact Watch.
  entry({ id: "KB-WATCH-AG-2026-06", title: "OECD Administrative Guidance June 2026 — deferred tax on incentives (public consultation)", authority: "oecd-ag", provision: "Inclusive Framework consultation document, June 2026", passage: "Proposes clarifications on deferred tax attributes arising under tax-holiday regimes and the interaction of Recapture Exception Accruals with reduced-rate periods. Consultation closed; final text not yet adopted.", status: "pending-review", publishedAt: "2026-06-18", effectiveFrom: "—", applicableFrom: 2027, jurisdictions: ["*"], topics: ["deferred tax", "incentive", "recapture", "boi", "consultation"], ruleIds: ["OECD-DT-444", "OECD-DT-441"], version: "draft-2026-06", href: "/regwatch" }),
  entry({ id: "KB-WATCH-TH-RD-FORM", title: "Thai RD — draft electronic Top-up Tax return form (P.N.D. Top-up)", authority: "thai-law", provision: "RD public hearing draft, August 2026", passage: "Draft return layout for s 57 payment and s 54 notification. Introduces a designated-taxpayer election field and a QDMTT-vs-GIR reconciliation schedule. Not yet issued as a DG Notification.", status: "pending-review", publishedAt: "2026-08-20", effectiveFrom: "—", applicableFrom: 2025, jurisdictions: ["TH"], topics: ["thai filing", "form", "section 57", "designated taxpayer", "schema"], ruleIds: [], version: "hearing-2026-08", href: "/regwatch" }),
  entry({ id: "KB-WATCH-CR-2026-08", title: "OECD Central Record — August 2026 update", authority: "oecd-ag", provision: "Central Record of legislation with transitional qualified status", passage: "Periodic update of jurisdictions with qualified IIR, QDMTT and QDMTT Safe Harbour status. GMT24 scans this source and proposes field-level pack amendments for reviewer decision.", status: "final", publishedAt: "2026-08-15", effectiveFrom: "2026-08-15", applicableFrom: 2024, jurisdictions: ["*"], topics: ["central record", "qualified", "jurisdiction pack"], ruleIds: [], version: "2026-08", href: "/jurisdictions" }),
];

function fyYear(fy: string) {
  const m = fy.match(/\d{4}/);
  return m ? Number(m[0]) : 2026;
}

export function applicable(e: KbEntry, ctx: Pick<WorkContext, "fy" | "iso">) {
  const y = fyYear(ctx.fy);
  if (e.status === "superseded") return false;
  if (e.applicableFrom > y) return false;
  if (e.applicableTo != null && e.applicableTo < y) return false;
  if (ctx.iso && !e.jurisdictions.includes("*") && !e.jurisdictions.includes(ctx.iso)) return false;
  return true;
}

const STOP = new Set(["the", "a", "an", "is", "are", "of", "to", "for", "in", "on", "and", "or", "what", "why", "how", "does", "do", "we", "our", "this", "that", "it", "be", "can", "should", "with", "from", "at", "by"]);

export function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9%.\u0E00-\u0E7F\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w) && w.length > 1);
}

export type Retrieved = { entry: KbEntry; score: number; current: boolean };

/**
 * Rank knowledge entries against a question. Entries outside the fiscal year or
 * jurisdiction are returned with `current = false` so the caller can say "this
 * is superseded / not yet effective" instead of citing it silently.
 */
/** Words every Pillar Two passage contains; they never make a passage relevant on their own. */
const GENERIC = new Set(["tax", "taxes", "rate", "rates", "income", "group", "entity", "entities", "rule", "rules", "pillar", "two", "oecd", "globe", "year", "fiscal", "jurisdiction", "jurisdictions", "amount", "percentage", "apply", "applies"]);

/** Article pins in a provision string, used to collapse a curated entry and a corpus passage on the same article. */
function articleKey(e: KbEntry) {
  const pins = citationsIn(e.provision).filter((c) => c.startsWith("art ") || c.startsWith("s "));
  return pins.length ? `${e.authority}|${pins.sort().join(",")}` : null;
}

/**
 * Searches the curated knowledge base and the legal corpus together. Corpus
 * passages carry a small penalty so a curated entry wins a tie, and an entry
 * whose article pins are already covered by a higher-ranked hit is dropped.
 */
export function retrieve(q: string, ctx: Pick<WorkContext, "fy" | "iso">, limit = 4): Retrieved[] {
  const toks = tokens(q);
  const pins = citationsIn(q);
  const out: Retrieved[] = [];
  const corpus = new Set(legalKbEntries().map((e) => e.id));
  for (const e of [...KNOWLEDGE, ...legalKbEntries()]) {
    let score = 0;
    let hit = 0;
    let topicHit = false;
    const hay = `${e.title} ${e.provision} ${e.passage} ${e.topics.join(" ")}`.toLowerCase();
    for (const t of toks) {
      if (e.topics.some((x) => x === t)) { score += 3; hit += 1; topicHit = true; }
      else if (!GENERIC.has(t) && t.length >= 4 && e.topics.some((x) => x.includes(t) || t.includes(x))) { score += 2; hit += 1; topicHit = true; }
      else if (hay.includes(t)) { score += 1; hit += 1; }
    }
    if (pins.length && citationsIn(e.provision).some((own) => pins.some((pin) => pin === own || (pin.startsWith("art ") && own.startsWith("art ") && (own.startsWith(`${pin}.`) || pin.startsWith(`${own}.`)))))) { score += 4; topicHit = true; }
    if (ctx.iso && e.jurisdictions.includes(ctx.iso)) score += 1;
    if (corpus.has(e.id)) score -= 0.5;
    // Relevance floor: a passage that merely shares generic words ("tax", "rate") with the question
    // is not authority for it. Require a topic match or most of the question's terms to land.
    const relevant = toks.length > 0 && score >= 3 && (topicHit || hit / toks.length >= 0.5);
    if (relevant) out.push({ entry: e, score, current: applicable(e, ctx) && e.status !== "pending-review" && e.status !== "draft" });
  }
  out.sort((a, b) => b.score - a.score || AUTHORITY_RANK[a.entry.authority] - AUTHORITY_RANK[b.entry.authority]);
  const picked: Retrieved[] = [];
  const keys = new Set<string>();
  for (const r of out) {
    const k = articleKey(r.entry);
    if (k && keys.has(k)) continue;
    if (k) keys.add(k);
    picked.push(r);
    if (picked.length >= limit) break;
  }
  return picked;
}

/** Curated entries first, then legal-corpus passages keyed to the rule — so a rule with no curated note still cites its provision. */
export function byRule(ruleId: string): KbEntry[] {
  return [...KNOWLEDGE, ...legalKbEntries()].filter((e) => e.ruleIds.includes(ruleId));
}

export function ruleVersion(ruleId: string) {
  const r = RULES.find((x) => x.id === ruleId);
  return r ? `${r.id} ${r.version}` : ruleId;
}

export function pendingReview(): KbEntry[] {
  return KNOWLEDGE.filter((e) => e.status === "pending-review" || e.status === "draft");
}

export function cite(e: KbEntry) {
  return { label: `${e.provision}`, href: e.url ?? e.href, authority: e.authority };
}

import { money } from "./format";
import { type AuditNode, type JurCalc } from "./engine";
import { botRate, sbieRatesForFyStart, THAI_PACK } from "./thailand";

export type BoiScenarioId = "keep" | "convert10" | "qrtc" | "none";

export type BoiCertificate = {
  id: string;
  certNo: string;
  name: string;
  entityId: string;
  project: string;
  start: string;
  holidayEnd: string;
  reducedEnd: string | null;
  remainingFullExemptionYears: number;
  remainingReducedYears: number;
  remainingCapUsd: number;
  promotedGlobe: number;
  sbtishCandidate: boolean;
  extractedFrom: string;
  note: string;
};

/** Project-level BOI register. Sum of promoted GloBE must equal the jurisdictional split used in the Core waterfall. */
export const BOI_CERTS: BoiCertificate[] = [
  {
    id: "TH-BOI",
    certNo: "60-1234-1-00-1-0",
    name: "Electronics manufacturing",
    entityId: "TH-CE",
    project: "Rayong plant — promoted production (original certificate)",
    start: "2019-02-01",
    holidayEnd: "2027-01-31",
    reducedEnd: "2032-01-31",
    remainingFullExemptionYears: 1,
    remainingReducedYears: 5,
    remainingCapUsd: 48_600_000,
    promotedGlobe: 24_300_000,
    sbtishCandidate: true,
    extractedFrom: "BOI_Certificate_TH001.pdf",
    note: "Years 1–8 at 0% CIT (year 8 ends 31 Jan 2027). Years 9–13 at 50% of the 20% rate. Manufacturing SBIE is the main reason net value survives QDMTT.",
  },
  {
    id: "TH-BOI-AUTO",
    certNo: "67-0881-2-00-1-0",
    name: "Productivity / automation",
    entityId: "TH-CE",
    project: "Rayong — eligible capex upgrade (2024 promotion)",
    start: "2024-03-01",
    holidayEnd: "2032-02-28",
    reducedEnd: null,
    remainingFullExemptionYears: 6,
    remainingReducedYears: 0,
    remainingCapUsd: 14_200_000,
    promotedGlobe: 4_100_000,
    sbtishCandidate: true,
    extractedFrom: "BOI_Certificate_TH001_annex_automation.pdf",
    note: "Separate BOI project accounts. Pillar Two still blends this income with all other Thai CEs — do not compute a project ETR.",
  },
];

export const BOI_OPT = {
  id: "TH-BOI-OPT-2566",
  version: "2567.2",
  cit: THAI_PACK.cit,
  minRate: THAI_PACK.minRate,
  reducedRate: 0.1,
  horizon: 10,
  startFy: 2026,
  growth: 0.03,
  substanceGrowth: 0.02,
  discountRate: 0.08,
  qrtcCreditRate: 0.5,
  qrtcQualifyingSpend: 6_200_000,
  qrtcStatus: "pending" as const,
  qrtcNote:
    "BOI proposed cash-refundable credits (R&D, skills, productivity, standards, sustainable investment). Cabinet reportedly withdrew the draft amendment in December 2025. Do not book Thai QRTC until the final law and the individual entitlement exist.",
  conversionCite: "BOI Announcement No. 1/2566 — 50% CIT reduction for twice the remaining full-year exemption period, capped at 10 years",
  decreeFrom: "Accounting periods beginning on or after 1 January 2025",
};

export const NON_TAX_PRIVILEGES = [
  { id: "customs", title: "Customs / machinery", body: "Duty exemption or reduction on imported machinery and raw materials is outside GloBE covered taxes. It still has cash value." },
  { id: "ownership", title: "Foreign ownership", body: "Permission to hold a majority of a promoted company is not clawed back by QDMTT." },
  { id: "land", title: "Land holding", body: "Right to own land for the promoted activity remains a BOI privilege, not a GloBE income item." },
  { id: "visa", title: "Visa / work permit", body: "Expatriate quotas and facilitation survive even if the CIT holiday is recaptured." },
  { id: "fx", title: "FX remittance", body: "BOI foreign-currency and remittance facilitation is independent of the 15% ETR test." },
];

export const BOI_PLAY = [
  { n: "01", title: "Inventory every certificate", body: "Import each BOI certificate: remaining exemption years, reduced-rate years, unused cap, promoted vs non-promoted accounts. Keep a project ledger and a jurisdictional GloBE ledger — they are not the same artefact.", href: "/incentives", hrefLabel: "Certificates" },
  { n: "02", title: "Run the four scenarios", body: "Keep 0% holiday. Convert under Announcement 1/2566 (10% for twice remaining full years, cap 10). Future QRTC / SBTISH — do not book. 20% CIT baseline plus non-tax privileges. Engine posts cash tax, ETR, SBIE and QDMTT.", href: "/thailand/boi", hrefLabel: "Optimizer" },
  { n: "03", title: "Stress blending, SBIE and harbours", body: "A high-tax Thai CE can shelter a BOI entity. Selling it, or running an asset-light project with thin SBIE, changes the answer. Transitional CbCR, de minimis and routine-profits must be failed before you tell the board there is a top-up.", href: "/safe-harbours", hrefLabel: "Harbours" },
  { n: "04", title: "Decide on 5–10 year NPV", body: "Rank only bookable scenarios. 10% is not automatically cheaper. Report net retained incentive, not the 0% printed on the certificate. Hold QRTC as a coverage exception.", href: "/thailand/boi", hrefLabel: "NPV" },
];

export function conversionYears(remainingFullExemptionYears: number) {
  return Math.min(10, Math.max(0, remainingFullExemptionYears) * 2);
}

function grow(base: number, rate: number, t: number) {
  return money(base * Math.pow(1 + rate, t));
}

function npv(flows: number[], rate: number) {
  return money(flows.reduce((a, c, t) => a + c / Math.pow(1 + rate, t), 0));
}

function keepRate(cert: BoiCertificate, fy: number) {
  const y = fy;
  const hEnd = Number(cert.holidayEnd.slice(0, 4));
  const rEnd = cert.reducedEnd ? Number(cert.reducedEnd.slice(0, 4)) : hEnd;
  if (y < hEnd) return 0;
  if (cert.reducedEnd && y < rEnd) return BOI_OPT.reducedRate;
  return BOI_OPT.cit;
}

function convertRate(cert: BoiCertificate, fy: number) {
  const years = conversionYears(cert.remainingFullExemptionYears);
  const last = BOI_OPT.startFy + years - 1;
  if (fy <= last) return BOI_OPT.reducedRate;
  return BOI_OPT.cit;
}

function noneRate() {
  return BOI_OPT.cit;
}

function qrtcRate() {
  return BOI_OPT.cit;
}

function promotedRate(id: BoiScenarioId, cert: BoiCertificate, fy: number) {
  if (id === "keep") return keepRate(cert, fy);
  if (id === "convert10") return convertRate(cert, fy);
  if (id === "qrtc") return qrtcRate();
  return noneRate();
}

function citOnPromoted(id: BoiScenarioId, fy: number, scale: number) {
  return money(BOI_CERTS.reduce((a, c) => a + grow(c.promotedGlobe, BOI_OPT.growth, fy - BOI_OPT.startFy) * scale * promotedRate(id, c, fy), 0));
}

export type BoiYear = {
  fy: string;
  year: number;
  globe: number;
  promoted: number;
  nonPromoted: number;
  covered: number;
  citPromoted: number;
  etr: number;
  sbie: number;
  excess: number;
  topUp: number;
  cashTax: number;
  nominalBoi: number;
  clawback: number;
  netBenefit: number;
  qrtcCash: number;
  harbourZero: boolean;
};

export type BoiScenarioRun = {
  id: BoiScenarioId;
  title: string;
  subtitle: string;
  bookable: boolean;
  legal: string;
  years: BoiYear[];
  fy0: BoiYear;
  npvCash: number;
  npvNet: number;
  npvNominal: number;
  totalCash: number;
  totalClawback: number;
  totalNet: number;
  totalQrtc: number;
};

export type BoiOptimizer = {
  pack: string;
  version: string;
  discountRate: number;
  blend: boolean;
  promotedGlobe: number;
  nonPromotedGlobe: number;
  citIfNoHoliday: number;
  scenarios: BoiScenarioRun[];
  recommended: BoiScenarioId;
  recommendation: string;
  headline: string;
  clawbackRatio: number;
  strandedUsd: number;
  certificates: BoiCertificate[];
  blending: { boiGlobe: number; boiCovered: number; otherGlobe: number; otherCovered: number; blendedEtr: number; note: string };
  harbours: { test: string; result: string; note: string }[];
  qrtc: { spend: number; cash: number; status: string; note: string };
  audit: { net: AuditNode; clawback: AuditNode; npv: AuditNode };
};

function sbieForYear(th: JurCalc, t: number) {
  const fyStart = `${BOI_OPT.startFy + t}-01-01`;
  const rates = sbieRatesForFyStart(fyStart);
  const payrollBase = PAYROLL_RATE_BASE(th);
  const assetBase = ASSET_RATE_BASE(th);
  const payroll = grow(payrollBase, BOI_OPT.substanceGrowth, t) * rates.payroll;
  const assets = grow(assetBase, BOI_OPT.substanceGrowth, t) * rates.assets;
  return money(payroll + assets);
}

function PAYROLL_RATE_BASE(th: JurCalc) {
  return th.payrollCarve / 0.094;
}

function ASSET_RATE_BASE(th: JurCalc) {
  return th.assetCarve / 0.074;
}

function runScenario(th: JurCalc, id: BoiScenarioId, blend: boolean, discountRate: number): BoiScenarioRun {
  const meta: Record<BoiScenarioId, Pick<BoiScenarioRun, "title" | "subtitle" | "bookable" | "legal">> = {
    keep: {
      title: "Keep 0% holiday",
      subtitle: "Current certificates through remaining exemption and reduced-rate years",
      bookable: true,
      legal: "Existing BOI certificates · Thai QDMTT still applies to excess profit",
    },
    convert10: {
      title: "Convert to 10% CIT",
      subtitle: "Announcement 1/2566 — 50% reduction for twice remaining full exemption years, cap 10",
      bookable: true,
      legal: BOI_OPT.conversionCite,
    },
    qrtc: {
      title: "Future QRTC / SBTISH",
      subtitle: "Replace the holiday with a refundable credit / substance-based incentive",
      bookable: false,
      legal: "Not enacted. Do not book. OECD SBTISH (2026) is a design route, not a Thai election on this snapshot.",
    },
    none: {
      title: "No tax incentive",
      subtitle: "20% CIT baseline. Non-tax BOI privileges still counted as qualitative value",
      bookable: true,
      legal: "Ordinary Thai CIT 20% · BOI non-tax privileges remain",
    },
  };

  const promoted0 = money(BOI_CERTS.reduce((a, c) => a + c.promotedGlobe, 0));
  const thaiGlobe0 = blend ? th.globeIncome : promoted0;
  const nonPromoted0 = blend ? money(Math.max(0, thaiGlobe0 - promoted0)) : 0;
  const otherCovered0 = blend ? th.coveredTax : 0;

  const years: BoiYear[] = [];
  for (let t = 0; t < BOI_OPT.horizon; t++) {
    const year = BOI_OPT.startFy + t;
    const promoted = grow(promoted0, BOI_OPT.growth, t);
    const nonPromoted = blend ? grow(nonPromoted0, BOI_OPT.growth, t) : 0;
    const citPromoted = citOnPromoted(id, year, 1);
    const qrtcCash = id === "qrtc" ? grow(money(BOI_OPT.qrtcQualifyingSpend * BOI_OPT.qrtcCreditRate), BOI_OPT.growth, t) : 0;
    const globe = money(promoted + nonPromoted + qrtcCash);
    let covered: number;
    if (t === 0 && id === "keep" && blend) {
      covered = th.coveredTax;
    } else if (t === 0 && blend) {
      covered = money(otherCovered0 + citPromoted);
    } else {
      const otherCit = money(nonPromoted * BOI_OPT.cit);
      covered = money(citPromoted + otherCit);
    }
    const etr = globe > 0 ? covered / globe : 0;
    let sbie = t === 0 && blend ? th.sbie : sbieForYear(th, t);
    if (!blend) sbie = money(sbie * 0.82);
    const excess = money(Math.max(0, globe - sbie));
    const harbourZero = false;
    const topUp = harbourZero || etr >= BOI_OPT.minRate ? 0 : money((BOI_OPT.minRate - etr) * excess);
    const cashTax = money(covered + topUp - (id === "qrtc" ? qrtcCash : 0));
    const nominalBoi = money(promoted * BOI_OPT.cit - citPromoted);
    const clawback = topUp;
    const netBenefit = money(nominalBoi - clawback + qrtcCash);
    years.push({
      fy: `FY${year}`,
      year,
      globe,
      promoted,
      nonPromoted,
      covered,
      citPromoted,
      etr,
      sbie,
      excess,
      topUp,
      cashTax,
      nominalBoi,
      clawback,
      netBenefit,
      qrtcCash,
      harbourZero,
    });
  }

  const fy0 = years[0];
  return {
    id,
    ...meta[id],
    years,
    fy0,
    npvCash: npv(years.map((y) => y.cashTax), discountRate),
    npvNet: npv(years.map((y) => y.netBenefit), discountRate),
    npvNominal: npv(years.map((y) => y.nominalBoi), discountRate),
    totalCash: money(years.reduce((a, y) => a + y.cashTax, 0)),
    totalClawback: money(years.reduce((a, y) => a + y.clawback, 0)),
    totalNet: money(years.reduce((a, y) => a + y.netBenefit, 0)),
    totalQrtc: money(years.reduce((a, y) => a + y.qrtcCash, 0)),
  };
}

export function optimizeBoi(th: JurCalc, opts?: { blend?: boolean; discountRate?: number }): BoiOptimizer {
  const blend = opts?.blend ?? true;
  const discountRate = opts?.discountRate ?? BOI_OPT.discountRate;
  const ids: BoiScenarioId[] = ["keep", "convert10", "qrtc", "none"];
  const scenarios = ids.map((id) => runScenario(th, id, blend, discountRate));
  const keep = scenarios.find((s) => s.id === "keep")!;
  const bookable = scenarios.filter((s) => s.bookable);
  const recommended = bookable.reduce((a, s) => (s.npvCash < a.npvCash ? s : a)).id;

  const promotedGlobe = money(BOI_CERTS.reduce((a, c) => a + c.promotedGlobe, 0));
  const nonPromotedGlobe = money(Math.max(0, th.globeIncome - promotedGlobe));
  const citIfNoHoliday = money(promotedGlobe * BOI_OPT.cit);
  const clawbackRatio = keep.fy0.nominalBoi > 0 ? keep.fy0.clawback / keep.fy0.nominalBoi : 0;
  const strandedUsd = money(BOI_CERTS.reduce((a, c) => a + c.remainingCapUsd, 0) * clawbackRatio);

  const rec = scenarios.find((s) => s.id === recommended)!;
  const convert = scenarios.find((s) => s.id === "convert10")!;
  const recommendation =
    recommended === "keep"
      ? `Keep the running holiday. FY2026 net retained ${keep.fy0.netBenefit.toLocaleString("en-GB")} after Thai QDMTT. Converting to 10% is not cheaper on a ${BOI_OPT.horizon}-year NPV of cash tax (keep ${keep.npvCash.toLocaleString("en-GB")} vs convert ${convert.npvCash.toLocaleString("en-GB")}). QRTC is not law — do not book it.`
      : `Bookable ranking on ${BOI_OPT.horizon}-year cash-tax NPV selects ${rec.title}. QRTC remains unbookable.`;

  const headline = `Pillar Two does not cancel BOI. It claws back ${money(clawbackRatio * 100)}% of the advertised FY2026 CIT saving. Net retained ${keep.fy0.netBenefit.toLocaleString("en-GB")}.`;

  const blending = {
    boiGlobe: promotedGlobe,
    boiCovered: keep.fy0.citPromoted,
    otherGlobe: nonPromotedGlobe,
    otherCovered: money(th.coveredTax - keep.fy0.citPromoted),
    blendedEtr: th.etr,
    note: "Thailand is tested as one jurisdiction. The BOI factory is not a separate ETR unit. A 20%-taxed Thai CE can shelter promoted income; disposing of it can create top-up overnight.",
  };

  const harbours = [
    { test: "Transitional CbCR Safe Harbour", result: th.sh.outcome, note: th.sh.navigator },
    { test: "De minimis", result: th.sh.deMinimis, note: "Thai revenue and profit are above the Art. 8.1.1 thresholds." },
    { test: "Routine profits", result: th.sh.routineProfits, note: "GloBE income exceeds SBIE — excess profit exists." },
    { test: "QDMTT Safe Harbour (foreign)", result: th.sh.qdmttSH, note: "Thai QDMTT collects locally. This is not a foreign-parent harbour that zeros Thai tax." },
    { test: "SBTISH", result: th.sh.sbtish, note: "BOI is substance-conditioned, but qualifying expenditure is not fully traced. Do not elect on this snapshot." },
  ];

  const qrtcCash = money(BOI_OPT.qrtcQualifyingSpend * BOI_OPT.qrtcCreditRate);
  const audit: BoiOptimizer["audit"] = {
    net: {
      id: "TH-boi-opt-net",
      label: "FY2026 net retained BOI incentive",
      amount: keep.fy0.netBenefit,
      kind: "result",
      ruleId: BOI_OPT.id,
      ruleVersion: BOI_OPT.version,
      detail: "Nominal 20% CIT not paid on promoted GloBE − Thai QDMTT clawback. Engine posted from GloBE Core top-up. LLM does not post the net.",
      children: [th.audit],
    },
    clawback: {
      id: "TH-boi-opt-claw",
      label: "FY2026 Pillar Two clawback of BOI",
      amount: keep.fy0.clawback,
      kind: "result",
      ruleId: "TH-QDMTT-2025",
      ruleVersion: "2567.2",
      detail: "Thai QDMTT on jurisdictional excess profit. Foreign IIR/UTPR $0 because Thai QDMTT collects.",
      children: [th.audit],
    },
    npv: {
      id: "TH-boi-opt-npv",
      label: `${BOI_OPT.horizon}-year NPV of Thai cash tax · keep holiday`,
      amount: keep.npvCash,
      kind: "result",
      ruleId: BOI_OPT.id,
      ruleVersion: BOI_OPT.version,
      detail: `Discount ${(discountRate * 100).toFixed(0)}% · GloBE growth ${(BOI_OPT.growth * 100).toFixed(0)}% · SBIE rates from MOF Notification No. 1 by FY start. QRTC years excluded from the bookable rank.`,
      children: [th.audit],
    },
  };

  return {
    pack: THAI_PACK.id,
    version: BOI_OPT.version,
    discountRate,
    blend,
    promotedGlobe,
    nonPromotedGlobe,
    citIfNoHoliday,
    scenarios,
    recommended,
    recommendation,
    headline,
    clawbackRatio,
    strandedUsd,
    certificates: BOI_CERTS,
    blending,
    harbours,
    qrtc: { spend: BOI_OPT.qrtcQualifyingSpend, cash: qrtcCash, status: BOI_OPT.qrtcStatus, note: BOI_OPT.qrtcNote },
    audit,
  };
}

/** Teaching illustration from the BOI–Pillar Two note (THB millions). Not the Aetherion snapshot. */
export function workedBoiExample() {
  const boiGlobe = 1_000;
  const otherGlobe = 500;
  const otherTax = 100;
  const globe = boiGlobe + otherGlobe;
  const covered = 0 + otherTax;
  const etr = covered / globe;
  const sbie = 300;
  const excess = globe - sbie;
  const topUp = money((BOI_OPT.minRate - etr) * excess);
  const citOrdinary = otherTax;
  const totalWithBoi = citOrdinary + topUp;
  const citIfNoBoi = money(boiGlobe * BOI_OPT.cit) + otherTax;
  const advertised = money(boiGlobe * BOI_OPT.cit);
  const remaining = advertised - topUp;
  const usdThb = botRate("BOT-USD-THB-202512").rate;
  const toUsd = (thbM: number) => money((thbM * 1_000_000) / usdThb);
  return {
    unit: "THB million",
    boiGlobe,
    otherGlobe,
    globe,
    covered,
    etr,
    sbie,
    excess,
    topUp,
    citOrdinary,
    totalWithBoi,
    citIfNoBoi,
    advertised,
    remaining,
    clawbackRatio: advertised > 0 ? topUp / advertised : 0,
    usdThb,
    usd: {
      advertised: toUsd(advertised),
      clawback: toUsd(topUp),
      remaining: toUsd(remaining),
      totalWithBoi: toUsd(totalWithBoi),
      citIfNoBoi: toUsd(citIfNoBoi),
    },
    note: "Jurisdictional blending + SBIE. Without the BOI holiday the factory would have paid ~THB 200m CIT and group Thai CIT would be ~THB 300m. With BOI, ordinary CIT THB 100m + top-up THB 100m = THB 200m. Half the advertised saving is clawed back; BOI is not negative versus 20% CIT.",
  };
}

export const BOI_KIND_LABEL: Record<BoiScenarioId, string> = {
  keep: "Keep holiday",
  convert10: "Convert 10%",
  qrtc: "QRTC pending",
  none: "No CIT incentive",
};

/**
 * Latest update — the change register users track GMT24 against.
 *
 * Two layers:
 *  1. `UPDATES`: dated regulatory events (OECD releases and per-country Pillar
 *     Two law), each matched to what GMT24 built for it and how far that goes.
 *  2. `countryStatus()`: the latest Pillar Two regulation per jurisdiction the
 *     active group operates in, read from the signed jurisdiction pack, the
 *     effective-dated rule pack and the legal corpus, against the GMT24 build.
 *
 * Nothing here is computed from the engine; it is the register that says
 * "the OECD / a country changed X on this date, GMT24 does Y about it".
 */
import { DATA, RULES } from "./model";
import { LEGAL_SOURCES, passagesForJurisdiction, passagesForSource } from "./legal";
import type { LegalAuthority } from "./legal/types";
import { OECD_PUBLICATIONS } from "./publications";
import { effectivePack, type PackOverlay } from "./packAmendments";
import { GIR_EDITIONS } from "./gir2026";

export type UpdateAuthority = LegalAuthority | "EU" | "SG" | "DE" | "GB" | "VN" | "AU" | "MY" | "ID" | "HK" | "AE" | "CN" | "LU" | "NL" | "HU" | "FR";

export type UpdateKind = "template" | "schema" | "safe-harbour" | "commentary" | "law" | "secondary" | "central-record" | "guidance";

export type BuildStatus = "implemented" | "partial" | "planned" | "monitoring" | "not-applicable";

export type UpdateItem = {
  id: string;
  /** Publication / enactment date of the regulatory event. */
  date: string;
  authority: UpdateAuthority;
  title: string;
  kind: UpdateKind;
  /** What the regulator changed or introduced. */
  summary: string;
  /** Where the text lives: legal-corpus source, publication on file, or external URL. */
  source: { sourceId?: string; publicationId?: string; url?: string; label: string };
  /** How far GMT24 covers it. */
  status: BuildStatus;
  /** Effective for Fiscal Years starting on/after (regulatory), where meaningful. */
  effectiveFrom?: string;
  /** What GMT24 changed, with the screens that carry the change. */
  built: { text: string; href: string }[];
  /** Modules affected. */
  modules: string[];
  /** Open point for the user / next build step, if any. */
  open?: string;
  /** Date GMT24 recorded the change. */
  recordedAt: string;
};

const GIR26 = GIR_EDITIONS.find((e) => e.id === "GIR-2026-09")!;

export const UPDATES: UpdateItem[] = [
  {
    id: "UPD-OECD-GIR-2026-09",
    date: "2026-09-11",
    authority: "OECD",
    title: "GloBE Information Return (September 2026) — revised template",
    kind: "template",
    summary: "Revised standard GIR for Reporting Fiscal Years commencing on or after 31 December 2025 (§36.1). Adds the Side-by-Side Safe Harbour election (1.3.1.6), rule options (v) Qualified SbS Regime and (vi) Qualified UPE Regime, safe-harbour options (a)–(k) with the Transitional UTPR SH window, Simplified ETR data points [A]–[N], STISH caps and per-incentive breakdown, a banded summary table with the 1.4.10 QTI band, the 2.1.5 reportable-differences flag, the dissemination approach, Annex B notification and Annex C penalty relief. A revised XML schema with a cut-off date is to follow.",
    source: { sourceId: "OECD-GIR-2026-09", publicationId: "PUB-OECD-GIR-2026-09", label: "GIR Sep 2026 · PDF on file · DOI 10.1787/a05ec99a-en" },
    status: "implemented",
    effectiveFrom: "2025-12-31",
    built: [
      { text: "GIR builder selects the template by FY start and emits the September 2026 data points in a provisional namespace beside the v1.0 exchange elements", href: "/gir" },
      { text: "Side-by-Side election 1.3.1.6 with suppression of 1.4 and 1.3.1.7–9; regime codes for Qualified SbS / UPE Regimes", href: "/gir" },
      { text: "Safe-harbour option letters (a)–(k) per jurisdiction, UTPR SH dating check, TCSH single-test rule, (d) combination rule, once-out rule", href: "/gir" },
      { text: "Simplified ETR [A]–[N] block with Section 3 cross-fill; STISH caps (5.5% payroll / depreciation, 1% carrying value election STISH_CV) and incentive breakdown", href: "/gir" },
      { text: "Banded summary 1.4 (ETR 2.5-point bands, top-up bands, SBIE > NGI, QTI band 1.4.10); reportable differences 2.1.5 from the Thai OECD-vs-RD gap register", href: "/thailand/gap" },
      { text: "Dissemination register, Annex B notifications (download), Annex C penalty-relief test in the compliance review", href: "/agi/compliance" },
      { text: "Eleven legal-corpus passages for §36.1, 1.3.1, 1.3.1.6, 1.4, 2.1.5, 2.2.1.1.1, 2.2.1.2(b)/(c), dissemination, Annex B and Annex C", href: "/legal?source=OECD-GIR-2026-09" },
    ],
    modules: ["GIR", "Safe harbours", "Elections", "Compliance review", "Legal corpus", "Thailand gap"],
    open: "STISH depreciation base needs the fixed-asset register; QTI amounts are a 15% proxy on traced expenditure until the incentive ledger is loaded. Revised XML schema and cut-off date not yet published by the OECD.",
    recordedAt: "2026-09-12",
  },
  {
    id: "UPD-OECD-GIR-XML-PENDING",
    date: "2026-09-11",
    authority: "OECD",
    title: "GIR XML Schema — revision announced, cut-off date to be set",
    kind: "schema",
    summary: "The September 2026 return announces a revised XML Schema and User Guide with a cut-off date after which exchanges must use the new schema. Until then Schema v1.0 (namespace urn:oecd:ties:globe:v2) remains the exchange format.",
    source: { sourceId: "OECD-GIR-XML", label: "GIR XML Schema v1.0 · User Guide" },
    status: "monitoring",
    built: [
      { text: "Preflight flags the schema as pending and counts the provisional elements that will move into the revised schema", href: "/gir" },
      { text: "Regulatory Watch reads the OECD GloBE page for the schema release", href: "/regwatch" },
    ],
    modules: ["GIR", "Regulatory Watch"],
    open: "When the OECD publishes the revised schema: map gir26 provisional elements to the new element names and set the cut-off date in GIR_EDITIONS.",
    recordedAt: "2026-09-12",
  },
  {
    id: "UPD-OECD-COMM-2026",
    date: "2026-05-27",
    authority: "OECD",
    title: "Consolidated Commentary to the GloBE Model Rules (2026)",
    kind: "commentary",
    summary: "Article-by-article Commentary consolidating Administrative Guidance up to May 2026, including the January 2026 Side-by-Side package. Supersedes the 2025 consolidation as the interpretive text.",
    source: { sourceId: "OECD-COMM-2026", publicationId: "PUB-OECD-COMM-2026", label: "Commentary 2026 · PDF on file" },
    status: "implemented",
    effectiveFrom: "2024-01-01",
    built: [
      { text: "Legal corpus source in force; 2025 edition kept as superseded for prior-year positions", href: "/legal?source=OECD-COMM-2026" },
      { text: "Rule pack version 2026.2 cites the 2026 Commentary", href: "/rulebook" },
    ],
    modules: ["Legal corpus", "OECD rulebook", "Compliance review"],
    recordedAt: "2026-09-12",
  },
  {
    id: "UPD-OECD-SBS-2026",
    date: "2026-01-15",
    authority: "OECD",
    title: "Inclusive Framework Side-by-Side package",
    kind: "safe-harbour",
    summary: "Side-by-Side Safe Harbour for groups parented in a Qualified SbS Regime, extension of the Transitional UTPR Safe Harbour, Simplified ETR Safe Harbour, Substance-based Tax Incentive Safe Harbour and TCSH extension. Each element takes legal effect through domestic law or a Central Record listing.",
    source: { sourceId: "OECD-SBS-2026", label: "Side-by-Side package 2026" },
    status: "implemented",
    effectiveFrom: "2026-01-01",
    built: [
      { text: "Engine applies SbS relief and the UTPR SH to the US blend (rule US-SBS-2026); SH_SBS, SH_UTPR, SH_SETR, SH_SBTI, SH_UPE in the election matrix", href: "/safe-harbours" },
      { text: "SETR and SBTISH tests in the 2026 harbour runner; SETR inner elections S0–S12", href: "/elections" },
      { text: "GIR Sep 2026 coding of the package as options (d), (f), (j), (k) and the 1.3.1.6 election", href: "/gir" },
    ],
    modules: ["Engine", "Safe harbours", "Elections", "GIR"],
    recordedAt: "2026-09-12",
  },
  {
    id: "UPD-OECD-GIR-2025-01",
    date: "2025-01-15",
    authority: "OECD",
    title: "GloBE Information Return (January 2025) and XML Schema v1.0",
    kind: "template",
    summary: "First standard GIR template with the transitional simplified jurisdictional reporting framework and the central-filing dissemination approach; XML Schema and User Guide v1.0 for exchange.",
    source: { sourceId: "OECD-GIR-2025", label: "GIR Jan 2025 (superseded for FYs from 31 Dec 2025)" },
    status: "implemented",
    effectiveFrom: "2024-01-01",
    built: [
      { text: "v1.0 exchange structure (MessageSpec, FilingInfo, GeneralSection, Summary, JurisdictionSection, Elections, UTPRAttribution) — still the emitted envelope", href: "/gir" },
      { text: "Template still selected for groups whose FY started before 31 Dec 2025", href: "/years" },
    ],
    modules: ["GIR"],
    recordedAt: "2026-09-12",
  },
  {
    id: "UPD-OECD-CR",
    date: "2026-01-15",
    authority: "OECD",
    title: "Central Record of legislation with transitional qualified status — rolling",
    kind: "central-record",
    summary: "Listing confers transitional qualified status for IIR, QDMTT and QDMTT Safe Harbour; the September 2026 GIR adds Qualified Side-by-Side Regime and Qualified UPE Regime entries.",
    source: { sourceId: "OECD-CR", label: "Central Record" },
    status: "partial",
    built: [
      { text: "Jurisdiction packs carry the qualified status the engine and GIR read; Regulatory Watch proposes pack amendments when the record changes", href: "/jurisdictions" },
      { text: "GIR reads Qualified SbS / UPE Regime from the pack's qualified text", href: "/gir" },
    ],
    modules: ["Jurisdiction packs", "Regulatory Watch", "GIR"],
    open: "No jurisdiction is yet recorded as a Qualified UPE Regime in the demo packs; option (k) stays unavailable until one is listed.",
    recordedAt: "2026-09-12",
  },
  {
    id: "UPD-TH-DECREE-2567",
    date: "2024-12-26",
    authority: "TH",
    title: "Thailand — Emergency Decree on Top-up Tax B.E. 2567",
    kind: "law",
    summary: "Thai master rules: scope, 15% minimum rate, QDMTT / IIR / UTPR charging provisions, filing, payment, audit, appeal and penalties, for fiscal years from 1 January 2025.",
    source: { sourceId: "TH-DECREE-2567", label: "Decree B.E. 2567" },
    status: "implemented",
    effectiveFrom: "2025-01-01",
    built: [
      { text: "Thailand Jurisdiction Pack TH-PACK-2567 overlays GloBE Core (situs, SBIE, BOT FX, liability ordering)", href: "/thailand" },
      { text: "OECD vs RD gap register feeds the GIR 2.1.5 reportable-differences flag", href: "/thailand/gap" },
    ],
    modules: ["Thailand", "Engine", "GIR"],
    recordedAt: "2026-09-12",
  },
  {
    id: "UPD-TH-DG-1-8",
    date: "2025-06-30",
    authority: "TH",
    title: "Thailand — Director-General Notifications Nos. 1–8 and MOF Notification No. 1",
    kind: "secondary",
    summary: "Acceptable accounting standards, refundable imputation taxes, entity location, eligible payroll and tangible assets, UTPR allocation factors, FX conversion, excluded entities, minority-owned / investment / stateless entities; transitional SBIE rates.",
    source: { sourceId: "TH-DG-4", label: "DG Notifications 1–8 · MOF No. 1" },
    status: "implemented",
    effectiveFrom: "2025-01-01",
    built: [
      { text: "Thai SBIE engine (Notification No. 4 line items, MOF No. 1 rates), BOT FX engine (No. 6), situs (No. 3), excluded entities (No. 7)", href: "/thailand/sbie" },
    ],
    modules: ["Thailand"],
    recordedAt: "2026-09-12",
  },
  {
    id: "UPD-TH-RD-NEWS-5-2026",
    date: "2026-05-01",
    authority: "TH",
    title: "Thailand — RD news release 5/2026: status of Top-up Tax secondary legislation and return schema",
    kind: "guidance",
    summary: "Announces the delegated instruments still to be issued under ss 31, 33 and 53–57, including the Thai top-up tax return schema.",
    source: { sourceId: "TH-RD-NEWS-5-2026", label: "RD news 5/2026" },
    status: "monitoring",
    built: [
      { text: "Filing command centre marks the Thai return schema pending; the OECD GIR XML can be drafted meanwhile", href: "/thailand/filing" },
    ],
    modules: ["Thailand", "Filings"],
    open: "Load the Thai return schema when the RD publishes it; map GIR Sections 2–3 for Thailand onto it.",
    recordedAt: "2026-09-12",
  },
  {
    id: "UPD-JP-2025-REFORM",
    date: "2025-03-31",
    authority: "JP",
    title: "Japan — 2025 tax reform: QDMTT and UTPR for fiscal years from 1 April 2026",
    kind: "law",
    summary: "IIR in force since fiscal years beginning 1 April 2024 (2023 reform); the 2025 reform enacts a QDMTT and the UTPR for fiscal years beginning on or after 1 April 2026.",
    source: { sourceId: "JP-TR-2023", label: "Japan 2023 / 2025 Tax Reform" },
    status: "partial",
    effectiveFrom: "2026-04-01",
    built: [
      { text: "Japan pack: IIR + UTPR, Transitional qualified IIR; IIR collects the residual after foreign QDMTT", href: "/jurisdictions" },
    ],
    modules: ["Jurisdiction packs", "Allocation"],
    open: "Japanese QDMTT starts for fiscal years from 1 April 2026 — after the calendar FY2026 snapshot; switch the pack when the group's FY crosses that date.",
    recordedAt: "2026-09-12",
  },
  {
    id: "UPD-IE-FA2-2023",
    date: "2023-12-18",
    authority: "IE",
    title: "Ireland — Finance (No. 2) Act 2023, Part 4A TCA 1997",
    kind: "law",
    summary: "Implements Council Directive (EU) 2022/2523: IIR, UTPR and QDMTT from fiscal years beginning 31 December 2023.",
    source: { sourceId: "IE-FA2-2023", label: "Ireland Finance (No. 2) Act 2023" },
    status: "implemented",
    effectiveFrom: "2024-01-01",
    built: [
      { text: "Ireland pack: IIR + QDMTT (safe harbour) + UTPR; KDB not STISH-eligible", href: "/jurisdictions" },
    ],
    modules: ["Jurisdiction packs"],
    recordedAt: "2026-09-12",
  },
  {
    id: "UPD-US-SBS-2026",
    date: "2026-01-15",
    authority: "US",
    title: "United States — Side-by-Side treatment (no IIR, UTPR or QDMTT enacted)",
    kind: "safe-harbour",
    summary: "US treatment flows from the Inclusive Framework Side-by-Side package: the US is treated as a Qualified Side-by-Side Regime; IIR / UTPR relief applies to US-parented groups and, transitionally, the UTPR Safe Harbour to the US as a UPE jurisdiction.",
    source: { sourceId: "US-SBS-2026", label: "US Side-by-Side 2026" },
    status: "partial",
    effectiveFrom: "2026-01-01",
    built: [
      { text: "Rule US-SBS-2026: US blend passes UTPR SH / SbS, top-up 0", href: "/allocation" },
      { text: "GIR: Qualified SbS Regime code on US entities; 1.3.1.6 election available only where the UPE is US-parented", href: "/gir" },
    ],
    modules: ["Engine", "GIR"],
    open: "For non-US-parented groups the GIR has no jurisdiction-level SbS option — the preflight asks to report the US blend under option (j) or full GloBE.",
    recordedAt: "2026-09-12",
  },
];

export const STATUS_LABEL: Record<BuildStatus, string> = {
  implemented: "Implemented",
  partial: "Partly implemented",
  planned: "Planned",
  monitoring: "Monitoring",
  "not-applicable": "Not applicable",
};

export const KIND_LABEL: Record<UpdateKind, string> = {
  template: "Return template",
  schema: "XML schema",
  "safe-harbour": "Safe harbour",
  commentary: "Commentary",
  law: "Domestic law",
  secondary: "Secondary legislation",
  "central-record": "Central Record",
  guidance: "Guidance",
};

/** Newest first. */
export function updatesByDate(): UpdateItem[] {
  return [...UPDATES].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

export function latestUpdate(): UpdateItem {
  return updatesByDate()[0];
}

export function updateHref(u: UpdateItem): string {
  if (u.source.publicationId) return `/publications#${u.source.publicationId}`;
  if (u.source.sourceId) return `/legal?source=${encodeURIComponent(u.source.sourceId)}`;
  return u.source.url ?? "/updates";
}

/* -------------------------------------------- per-country regulation view */

export type CountryStatus = {
  iso: string;
  name: string;
  /** Latest domestic Pillar Two instrument GMT24 knows about. */
  latestRegulation: { label: string; date: string; status: string; href: string } | null;
  /** Charging provisions the pack says are in force. */
  rules: { iir: boolean; qdmtt: boolean; qdmttSH: boolean; utpr: boolean; from: string; qualified: string };
  /** Effective-dated engine rules for this jurisdiction. */
  engineRules: { id: string; version: string; effectiveFrom: string; ruleType: string }[];
  /** Legal-corpus passages keyed to the jurisdiction. */
  passages: number;
  /** GIR Sep 2026 rule option codes the pack produces. */
  girRules: string;
  /** How GMT24 stands against the latest regulation. */
  build: BuildStatus;
  note: string;
  /** Dated updates in the register for this authority. */
  updates: UpdateItem[];
  /** A pack amendment overlay is pending review. */
  overlaid: boolean;
};

const AUTHORITY_ISO: Partial<Record<UpdateAuthority, string>> = { TH: "TH", IE: "IE", JP: "JP", US: "US", SG: "SG", DE: "DE", GB: "GB", VN: "VN", AU: "AU", MY: "MY", ID: "ID", HK: "HK", AE: "AE", CN: "CN", LU: "LU", NL: "NL", HU: "HU", FR: "FR" };

export function countryStatus(overlay?: PackOverlay): CountryStatus[] {
  const isos = [...new Set(DATA.packs.map((p) => p.iso))].filter((iso) => iso !== "XX");
  return isos.map((iso) => {
    const pack = effectivePack(iso, overlay) ?? DATA.packs.find((p) => p.iso === iso)!;
    const kindRank = (k: string) => (k === "law" || k === "decree" ? 0 : k === "notification" ? 1 : 2);
    const sources = LEGAL_SOURCES.filter((s) => s.authority === iso && s.status !== "superseded").sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || kindRank(a.kind) - kindRank(b.kind) || a.id.localeCompare(b.id));
    const latest = sources.find((s) => s.status === "in-force") ?? sources[0];
    const engineRules = RULES.filter((r) => r.jurisdiction === iso && r.status === "active").map((r) => ({ id: r.id, version: r.version, effectiveFrom: r.effectiveFrom, ruleType: r.ruleType }));
    const passages = new Set([...passagesForJurisdiction(iso), ...sources.flatMap((s) => passagesForSource(s.id))].map((p) => p.id)).size;
    const codes = [pack.iir ? "GIR201" : null, pack.utpr ? "GIR203" : null, pack.qdmtt ? "GIR204" : null, /sbs|side-by-side/i.test(pack.qualified) ? "GIR206" : null, /upe regime/i.test(pack.qualified) ? "GIR207" : null].filter(Boolean);
    const updates = UPDATES.filter((u) => AUTHORITY_ISO[u.authority] === iso).sort((a, b) => b.date.localeCompare(a.date));
    const sbsRegime = /sbs|side-by-side/i.test(pack.qualified);
    const implementing = pack.iir || pack.qdmtt || pack.utpr || sbsRegime;
    let build: BuildStatus;
    let note: string;
    if (!implementing) { build = "not-applicable"; note = `${pack.qualified}. No domestic Pillar Two charge; residual flows to the parent IIR. Notification only.`; }
    else if (latest && engineRules.length) { build = updates.some((u) => u.status === "partial" || u.status === "monitoring") ? "partial" : "implemented"; note = `${latest.short} (${latest.publishedAt}) is the latest instrument on file; ${engineRules.length} effective-dated engine rule${engineRules.length === 1 ? "" : "s"} and ${passages} corpus passage${passages === 1 ? "" : "s"}. ${pack.notes}`.trim(); }
    else if (latest) { build = "partial"; note = `${latest.short} on file in the corpus; the engine applies the pack's charging provisions without a jurisdiction-specific rule.`; }
    else { build = "monitoring"; note = `Pack status ${pack.qualified} from ${pack.from}; no domestic instrument in the corpus yet — engine applies the OECD Model Rules with the pack's charging provisions. ${pack.notes}`.trim(); }
    return {
      iso,
      name: pack.name,
      latestRegulation: latest ? { label: latest.short, date: latest.publishedAt, status: latest.status, href: `/legal?source=${encodeURIComponent(latest.id)}` } : null,
      rules: { iir: pack.iir, qdmtt: pack.qdmtt, qdmttSH: pack.qdmttSH, utpr: pack.utpr, from: pack.from, qualified: pack.qualified },
      engineRules,
      passages,
      girRules: codes.length ? codes.join(" · ") : "GIR205",
      build,
      note,
      updates,
      overlaid: Boolean(overlay?.[iso]),
    };
  }).sort((a, b) => (a.build === "not-applicable" ? 1 : 0) - (b.build === "not-applicable" ? 1 : 0) || a.name.localeCompare(b.name));
}

/** The OECD documents on file, oldest to newest, for the timeline header. */
export function oecdTimeline() {
  return [...OECD_PUBLICATIONS].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt)).map((p) => ({ id: p.id, date: p.publishedAt, label: p.short, href: `/publications#${p.id}` }));
}

export function updateSummary() {
  const list = UPDATES;
  return {
    total: list.length,
    implemented: list.filter((u) => u.status === "implemented").length,
    partial: list.filter((u) => u.status === "partial").length,
    monitoring: list.filter((u) => u.status === "monitoring" || u.status === "planned").length,
    latest: latestUpdate(),
    girEdition: GIR26,
  };
}

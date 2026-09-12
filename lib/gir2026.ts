/**
 * GloBE Information Return — September 2026 edition engine.
 *
 * Everything the revised template (OECD, 11 Sep 2026, DOI 10.1787/a05ec99a-en)
 * adds on top of the January 2025 return and the XML Schema v1.0 lives here:
 * which edition governs a Reporting Fiscal Year (§36.1), the Side-by-Side
 * Safe Harbour election in the general section (1.3.1.6) and what it
 * suppresses, the applicable-rules regime codes, the safe-harbour option
 * letters (a)–(k) with their dating rules, the Simplified ETR data points
 * (2.2.1.2(b)), the STISH caps and elections (2.2.1.2(c)–(d)), the banded
 * summary table (1.4 / 1.4.10), the reportable-differences flag (2.1.5), the
 * dissemination categories, the CE-by-CE Section 3 path and the Annex B
 * notification. `lib/gir.ts` consumes these to populate and preflight the
 * package; nothing here posts a GloBE amount.
 */
import type { JurCalc } from "./engine";
import { money } from "./format";
import { sbtishTrace } from "./harbours2026";
import { DATA, type Entity, type Group } from "./model";
import { effectivePack, type PackOverlay } from "./packAmendments";
import type { JurisdictionPack } from "./seeds/types";
import { reviewOecdRdGap } from "./thaiGap";

/* -------------------------------------------------------------- editions */

export type GirSchema = {
  id: string;
  version: string;
  namespace: string;
  xsd: string;
  status: "published" | "pending";
  /** Date from which the new schema must be used for exchanges; null while the OECD has not set one. */
  cutOff: string | null;
  note: string;
};

export type GirEdition = {
  id: string;
  short: string;
  title: string;
  publishedAt: string;
  /** First Fiscal Year start date this template governs (inclusive). */
  appliesFrom: string;
  /** Fiscal Year start date from which the next edition governs (exclusive), null for the current edition. */
  appliesUntil: string | null;
  publicationId?: string;
  sourceId: string;
  passageId: string;
  schema: GirSchema;
  summary: string;
};

export const GIR_XML_NAMESPACE = "urn:oecd:ties:globe:v2";

export const GIR_EDITIONS: GirEdition[] = [
  {
    id: "GIR-2025-01",
    short: "GIR Jan 2025",
    title: "GloBE Information Return (January 2025)",
    publishedAt: "2025-01-15",
    appliesFrom: "2024-01-01",
    appliesUntil: "2025-12-31",
    sourceId: "OECD-GIR-2025",
    passageId: "LP-GIR25-1",
    schema: { id: "GIR-XML-1.0", version: "1.0", namespace: GIR_XML_NAMESPACE, xsd: "GLOBEXML_v1.0.xsd", status: "published", cutOff: null, note: "Schema and User Guide v1.0 published with the January 2025 return." },
    summary: "Original standard template. Continues to govern Reporting Fiscal Years that commenced before 31 December 2025 (GIR Sep 2026 §36.1).",
  },
  {
    id: "GIR-2026-09",
    short: "GIR Sep 2026",
    title: "GloBE Information Return (September 2026)",
    publishedAt: "2026-09-11",
    appliesFrom: "2025-12-31",
    appliesUntil: null,
    publicationId: "PUB-OECD-GIR-2026-09",
    sourceId: "OECD-GIR-2026-09",
    passageId: "LP-GIR26-1",
    schema: { id: "GIR-XML-1.0+2026", version: "1.0 (interim)", namespace: GIR_XML_NAMESPACE, xsd: "GLOBEXML_v1.0.xsd", status: "pending", cutOff: null, note: "The OECD announced a revised XML Schema and User Guide to follow the September 2026 template, with a cut-off date after which the new schema must be used. Until it is published GMT24 emits the v1.0 exchange structure and carries the new data points as provisional elements flagged in preflight." },
    summary: "Revised template used only for Reporting Fiscal Years commencing on or after 31 December 2025. Adds the Side-by-Side Safe Harbour election, the Qualified SbS / Qualified UPE Regime rule options, safe-harbour options (d)–(k), Simplified ETR and STISH data points, a banded summary table with the QTI band, the reportable-differences flag, Annex B notification and Annex C penalty relief. Guidance notes not specific to Side-by-Side apply to every filing.",
  },
];

/** §36.1 — the September 2026 template applies to Fiscal Years commencing on or after 31 December 2025. */
export function girEditionFor(fyStart: string): GirEdition {
  return [...GIR_EDITIONS].reverse().find((e) => fyStart >= e.appliesFrom) ?? GIR_EDITIONS[0];
}

/* -------------------------------------------------------- regime coding */

export type RuleCode = { code: string; label: string; provisional: boolean };

export const RULE_CODES: Record<string, RuleCode> = {
  GIR201: { code: "GIR201", label: "Qualified IIR", provisional: false },
  GIR203: { code: "GIR203", label: "Qualified UTPR", provisional: false },
  GIR204: { code: "GIR204", label: "QDMTT", provisional: false },
  GIR205: { code: "GIR205", label: "No GloBE rules in force", provisional: false },
  GIR206: { code: "GIR206", label: "Qualified Side-by-Side Regime (option v)", provisional: true },
  GIR207: { code: "GIR207", label: "Qualified UPE Regime (option vi)", provisional: true },
};

export function isSbsRegime(pack?: JurisdictionPack) {
  return Boolean(pack && /\bsbs\b|side-by-side/i.test(pack.qualified));
}

export function isUpeRegime(pack?: JurisdictionPack) {
  return Boolean(pack && /upe regime/i.test(pack.qualified));
}

/** 1.3.1 applicable rules for one entity's jurisdiction — schema codes plus the two September 2026 options. */
export function applicableRules(iso: string, overlay?: PackOverlay): RuleCode[] {
  const pack = effectivePack(iso, overlay);
  const out: RuleCode[] = [];
  if (pack?.iir) out.push(RULE_CODES.GIR201);
  if (pack?.utpr) out.push(RULE_CODES.GIR203);
  if (pack?.qdmtt) out.push(RULE_CODES.GIR204);
  if (isSbsRegime(pack)) out.push(RULE_CODES.GIR206);
  if (isUpeRegime(pack)) out.push(RULE_CODES.GIR207);
  return out.length ? out : [RULE_CODES.GIR205];
}

/* ------------------------------------------------- SbS election 1.3.1.6 */

export type SbsElection = {
  /** UPE jurisdiction is listed as a Qualified Side-by-Side Regime. */
  eligible: boolean;
  /** SH_SBS switched on at group level or for the UPE jurisdiction. */
  elected: boolean;
  /** Election is both eligible and elected: suppression rules bite. */
  applies: boolean;
  upeIso: string;
  upeRegime: string;
  /** Data points the Filing CE does not complete where the election applies. */
  suppressed: string[];
  /** Jurisdictions still needing Sections 2 and 3 (QDMTT jurisdictions only). */
  jurisdictionSectionsFor: string[];
  /** Blocking inconsistencies (election switched on without eligibility). */
  issues: string[];
  /** Advisory points that do not stop the return. */
  notes: string[];
};

export function sbsElection(group: Group, electionsOn: Record<string, boolean>, calcs: JurCalc[], overlay?: PackOverlay): SbsElection {
  const upePack = effectivePack(group.upeIso, overlay);
  const eligible = isSbsRegime(upePack);
  const elected = Boolean(electionsOn[`SH_SBS@${group.upeIso}`] || electionsOn["SH_SBS@GROUP"] || electionsOn["SH_SBS"]);
  const applies = eligible && elected;
  const issues: string[] = [];
  const notes: string[] = [];
  if (elected && !eligible) issues.push(`SH_SBS is switched on but ${upePack?.name ?? group.upeIso} is not recorded as a Qualified Side-by-Side Regime in the Central Record — the 1.3.1.6 election cannot be made.`);
  if (eligible && !elected) notes.push(`${upePack?.name ?? group.upeIso} is a Qualified Side-by-Side Regime; the 1.3.1.6 election is available but not switched on, so the full return (summary table, all jurisdictional sections) is populated.`);
  for (const c of calcs) {
    if (c.iso !== group.upeIso && c.sh.sbs === "Pass") {
      notes.push(`${c.name}: the engine applies Side-by-Side relief to a non-UPE jurisdiction. The GIR carries Side-by-Side only as the group election in 1.3.1.6 (UPE regime) — there is no jurisdiction-level SbS option in 2.2.1.1.1, so ${c.name} is reported with its full computation (ETR ${(c.etr * 100).toFixed(1)}%, top-up ${c.jurisdictionalTopUp.toLocaleString("en-GB")}); elect SH_TCSH@${c.iso} to report a TCSH test instead.`);
    }
  }
  return {
    eligible,
    elected,
    applies,
    upeIso: group.upeIso,
    upeRegime: upePack?.qualified ?? "—",
    suppressed: applies
      ? ["1.4 Summary table", "1.3.1.7 · 1.3.1.8 · 1.3.1.9 (ownership / status detail per CE)", "1.3.2 and 1.3.3 (changes in structure) except identification items", "Sections 2 and 3 for non-QDMTT jurisdictions"]
      : [],
    jurisdictionSectionsFor: applies ? calcs.filter((c) => effectivePack(c.iso, overlay)?.qdmtt).map((c) => c.iso) : calcs.map((c) => c.iso),
    issues,
    notes,
  };
}

/* ------------------------------------------- safe-harbour options (a)–(k) */

export type ShOptionCode = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k";

export type ShOption = {
  code: ShOptionCode;
  label: string;
  /** Election switch(es) that turn this option on. */
  switches: string[];
  /** Result the engine produced for the underlying test. */
  result: string;
  available: boolean;
  elected: boolean;
  note?: string;
};

export const SH_OPTION_LABEL: Record<ShOptionCode, string> = {
  a: "Transitional CbCR Safe Harbour — de minimis test",
  b: "Transitional CbCR Safe Harbour — simplified ETR test",
  c: "Transitional CbCR Safe Harbour — routine profits test",
  d: "Simplified ETR Safe Harbour (2026 package)",
  e: "QDMTT Safe Harbour",
  f: "Substance-based Tax Incentive Safe Harbour (STISH)",
  g: "Simplified Calculations Safe Harbour — routine profits test",
  h: "Simplified Calculations Safe Harbour — de minimis test",
  i: "Simplified Calculations Safe Harbour — ETR test",
  j: "Transitional UTPR Safe Harbour (UPE jurisdiction)",
  k: "UPE Safe Harbour — Qualified UPE Regime",
};

export type UtprShWindow = { open: boolean; reason: string };

/** Option (j): Fiscal Years of ≤ 12 months beginning on or before 31 Dec 2025 and ending on or before 3 Jan 2027. */
export function utprShWindow(group: Pick<Group, "fyStart" | "fyEnd">): UtprShWindow {
  const start = new Date(`${group.fyStart}T00:00:00Z`);
  const end = new Date(`${group.fyEnd}T00:00:00Z`);
  const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + (end.getUTCDate() >= start.getUTCDate() ? 1 : 0);
  if (group.fyStart > "2025-12-31") return { open: false, reason: `FY begins ${group.fyStart}, after 31 Dec 2025 — the Transitional UTPR Safe Harbour is closed for this year.` };
  if (group.fyEnd > "2027-01-03") return { open: false, reason: `FY ends ${group.fyEnd}, after 3 Jan 2027.` };
  if (months > 12) return { open: false, reason: `FY runs ${months} months; the relief is limited to Fiscal Years of 12 months or less.` };
  return { open: true, reason: `FY ${group.fyStart} – ${group.fyEnd} sits inside the transitional window (begins ≤ 31 Dec 2025, ends ≤ 3 Jan 2027, ≤ 12 months).` };
}

export type ShCoding = {
  iso: string;
  options: ShOption[];
  /** Option letter reported as the primary safe harbour, null for full GloBE. */
  primary: ShOptionCode | null;
  /** Option letters reported (2.2.1.1.1 allows (d) alongside (a)–(c) and (f)). */
  reported: ShOptionCode[];
  /** Blocking coding errors. */
  issues: string[];
  /** Advisory points. */
  notes: string[];
};

const on = (electionsOn: Record<string, boolean>, ids: string[], iso: string) =>
  ids.some((id) => electionsOn[`${id}@${iso}`] || electionsOn[`${id}@GROUP`] || electionsOn[id]);

/** 2.2.1.1.1 — code each jurisdiction's safe-harbour position with the September 2026 option letters. */
export function safeHarbourCoding(calc: JurCalc, group: Group, electionsOn: Record<string, boolean>, overlay?: PackOverlay): ShCoding {
  const iso = calc.iso;
  const pack = effectivePack(iso, overlay);
  const isUpe = iso === group.upeIso;
  const window = utprShWindow(group);
  const tcshOn = on(electionsOn, ["SH_TCSH"], iso) || calc.sh.tcshUsed;
  const options: ShOption[] = [
    { code: "a", label: SH_OPTION_LABEL.a, switches: ["SH_TCSH", "SH_TCSH_DM"], result: calc.sh.deMinimis, available: calc.sh.deMinimis === "Pass", elected: tcshOn && calc.sh.deMinimis === "Pass" },
    { code: "b", label: SH_OPTION_LABEL.b, switches: ["SH_TCSH", "SH_TCSH_ETR"], result: calc.sh.simplifiedEtr, available: calc.sh.simplifiedEtr === "Pass", elected: tcshOn && calc.sh.simplifiedEtr === "Pass" && calc.sh.deMinimis !== "Pass" },
    { code: "c", label: SH_OPTION_LABEL.c, switches: ["SH_TCSH", "SH_TCSH_RP"], result: calc.sh.routineProfits, available: calc.sh.routineProfits === "Pass", elected: tcshOn && calc.sh.routineProfits === "Pass" && calc.sh.deMinimis !== "Pass" && calc.sh.simplifiedEtr !== "Pass" },
    { code: "d", label: SH_OPTION_LABEL.d, switches: ["SH_SETR", "SETR_APPLY"], result: on(electionsOn, ["SH_SETR", "SETR_APPLY"], iso) ? "Elected" : "Not elected", available: true, elected: on(electionsOn, ["SH_SETR", "SETR_APPLY"], iso), note: "Combinable with (a)–(c) and (f). Completes the 2.2.1.2(b) data points and cross-fills 3.2.1.1 / 3.2.1.2 / 3.2.2.1." },
    { code: "e", label: SH_OPTION_LABEL.e, switches: ["SH_QDMTT"], result: calc.sh.qdmttSH, available: Boolean(pack?.qdmttSH), elected: calc.sh.qdmttSH === "Pass" || (Boolean(pack?.qdmttSH) && on(electionsOn, ["SH_QDMTT"], iso)), note: pack?.qdmttSH ? `${pack.qualified} on the Central Record.` : "Jurisdiction has no QDMTT Safe Harbour listing." },
    { code: "f", label: SH_OPTION_LABEL.f, switches: ["SH_SBTI"], result: calc.sh.sbtish, available: calc.entities.some((e) => e.incentiveIds.length > 0), elected: on(electionsOn, ["SH_SBTI"], iso) || calc.sh.sbtish === "Pass", note: "Requires the 2.2.1.2(c) caps and the (d) breakdown by incentive." },
    { code: "g", label: SH_OPTION_LABEL.g, switches: ["SH_SCSH", "SH_NMCE"], result: on(electionsOn, ["SH_SCSH", "SH_NMCE"], iso) ? "Elected" : "Not elected", available: true, elected: on(electionsOn, ["SH_SCSH"], iso), note: "Once-out-always-out: a jurisdiction that fails or leaves (g)–(i) cannot return." },
    { code: "h", label: SH_OPTION_LABEL.h, switches: ["SH_SCSH", "SH_NMCE"], result: on(electionsOn, ["SH_NMCE"], iso) ? "Elected (NMCE)" : "Not elected", available: true, elected: on(electionsOn, ["SH_NMCE"], iso), note: "Once-out-always-out." },
    { code: "i", label: SH_OPTION_LABEL.i, switches: ["SH_SCSH"], result: "Not elected", available: true, elected: false, note: "Once-out-always-out." },
    { code: "j", label: SH_OPTION_LABEL.j, switches: ["SH_UTPR"], result: calc.sh.utprSH, available: isUpe && window.open, elected: isUpe && window.open && (on(electionsOn, ["SH_UTPR"], iso) || calc.sh.utprSH === "Pass"), note: isUpe ? window.reason : "Only the UPE jurisdiction can report option (j)." },
    { code: "k", label: SH_OPTION_LABEL.k, switches: ["SH_UPE"], result: isUpeRegime(pack) ? "Qualified UPE Regime" : "Not a Qualified UPE Regime", available: isUpe && isUpeRegime(pack), elected: isUpe && isUpeRegime(pack) && on(electionsOn, ["SH_UPE"], iso), note: isUpe ? (isUpeRegime(pack) ? "UPE jurisdiction listed as a Qualified UPE Regime." : `${pack?.name ?? iso} is not listed as a Qualified UPE Regime; (k) is unavailable.`) : "UPE jurisdiction only." },
  ];
  const issues: string[] = [];
  const notes: string[] = [];
  const elected = options.filter((o) => o.elected);
  const primaryOrder: ShOptionCode[] = ["e", "a", "b", "c", "j", "k", "g", "h", "i", "f", "d"];
  const primary = primaryOrder.find((code) => elected.some((o) => o.code === code)) ?? null;
  const reported = elected.map((o) => o.code);
  const tcshCodes = reported.filter((c) => c === "a" || c === "b" || c === "c");
  if (tcshCodes.length > 1) issues.push(`${calc.name}: more than one TCSH test passes — the GIR requires the MNE to identify the single test relied on (reporting ${tcshCodes[0]}).`);
  const scsh = reported.filter((c) => c === "g" || c === "h" || c === "i");
  if (scsh.length && (tcshCodes.length || reported.includes("e"))) issues.push(`${calc.name}: Simplified Calculations options (g)–(i) cannot be combined with TCSH or the QDMTT Safe Harbour.`);
  if (reported.includes("d") && reported.some((c) => !["a", "b", "c", "f", "d"].includes(c))) issues.push(`${calc.name}: option (d) may only be combined with (a)–(c) or (f).`);
  if (!isUpe && on(electionsOn, ["SH_UTPR"], iso)) issues.push(`${calc.name}: Transitional UTPR Safe Harbour is reported for the UPE jurisdiction only; ${iso} is not the UPE jurisdiction (${group.upeIso}).`);
  else if (!isUpe && calc.sh.utprSH === "Pass") notes.push(`${calc.name}: engine relies on the UTPR / Side-by-Side path, which the GIR reports only for the UPE jurisdiction; the blend is reported with its full computation.`);
  if (isUpe && !window.open && on(electionsOn, ["SH_UTPR"], iso)) issues.push(`${calc.name}: ${window.reason}`);
  else if (isUpe && !window.open && calc.sh.utprSH === "Pass") notes.push(`${calc.name}: ${window.reason}`);
  if (on(electionsOn, ["SH_UPE"], iso) && !isUpeRegime(pack)) issues.push(`${calc.name}: SH_UPE switched on but the jurisdiction is not a Qualified UPE Regime — option (k) cannot be reported.`);
  if (calc.exposure === "Safe harbour" && !primary) {
    const text = `${calc.name}: engine outcome is Safe harbour but no 2.2.1.1.1 option letter is elected — ${calc.jurisdictionalTopUp > 0 ? "identify the harbour relied on before filing" : "full computation is reported (top-up nil); elect the harbour to report a letter"}.`;
    if (calc.jurisdictionalTopUp > 0) issues.push(text); else notes.push(text);
  }
  return { iso, options, primary, reported, issues, notes };
}

/* ------------------------------------------ Simplified ETR 2.2.1.2(b) */

export type DataPoint = { key: string; label: string; value: number | null; source: string; gap?: boolean };

export type SimplifiedEtrBlock = {
  iso: string;
  points: DataPoint[];
  setr: number | null;
  passes15: boolean | null;
  /** Section 3 fields the (b) data points cross-fill so Section 3 is not keyed twice. */
  crossFill: { from: string; to: string; label: string }[];
  gaps: string[];
};

const POLICY_DISALLOWED_FLOOR = 250_000;

function fin(entityId: string) {
  return DATA.financials.find((f) => f.entityId === entityId);
}

function adjustmentsFor(calc: JurCalc, test: (category: string) => boolean) {
  const ids = new Set(calc.entities.map((e) => e.id));
  return DATA.adjustments.filter((a) => ids.has(a.entityId) && test(a.category));
}

export function simplifiedEtrBlock(calc: JurCalc): SimplifiedEtrBlock {
  const fins = calc.entities.map((e) => fin(e.id)).filter((f): f is NonNullable<typeof f> => Boolean(f));
  const A = money(fins.reduce((s, f) => s + f.cbcrProfit, 0));
  const C = money(adjustmentsFor(calc, (c) => /excluded dividend/i.test(c)).reduce((s, a) => s + a.amount, 0));
  const D = money(adjustmentsFor(calc, (c) => /excluded equity/i.test(c)).reduce((s, a) => s + a.amount, 0));
  const policy = adjustmentsFor(calc, (c) => /policy disallowed/i.test(c));
  const E = money(policy.filter((a) => Math.abs(a.amount) >= POLICY_DISALLOWED_FLOOR).reduce((s, a) => s + a.amount, 0));
  const F = money(adjustmentsFor(calc, (c) => /stock-based|fx \/ as-if/i.test(c)).reduce((s, a) => s + a.amount, 0));
  const B = 0;
  const G = money(B + C + D + E + F);
  const H = money(A + G);
  const I = money(fins.reduce((s, f) => s + f.currentTax + f.deferredTax, 0));
  const J = 0;
  const K = money(adjustmentsFor(calc, (c) => /net tax expense/i.test(c)).reduce((s, a) => s + a.amount, 0));
  const L = 0;
  const M = money(I + J + K + L);
  const setr = H > 0 ? M / H : null;
  const gaps: string[] = [];
  if (!fins.length) gaps.push("No CbCR profit before tax on file for this jurisdiction.");
  if (policy.some((a) => Math.abs(a.amount) < POLICY_DISALLOWED_FLOOR)) gaps.push(`Policy-disallowed items below the EUR ${POLICY_DISALLOWED_FLOOR.toLocaleString("en-GB")} fines floor are excluded from [E].`);
  gaps.push("[B] integrity adjustments and [J] tax integrity adjustments default to zero — confirm no hybrid-arbitrage or PPA items apply.");
  gaps.push("[L] deferred tax adjustments are taken at nil — the Simplified ETR uses income tax expense as accrued in the Qualified Financial Statements.");
  return {
    iso: calc.iso,
    points: [
      { key: "A", label: "Profit (loss) before income tax (Qualified Financial Statements / CbCR PBT)", value: A, source: "Financials.cbcrProfit" },
      { key: "B", label: "Integrity adjustments to PBT", value: B, source: "None recorded" },
      { key: "C", label: "Excluded dividends", value: C, source: "Adjustments · Excluded dividends" },
      { key: "D", label: "Excluded equity gain or loss", value: D, source: "Adjustments · Excluded equity" },
      { key: "E", label: `Policy disallowed expenses (fines and penalties ≥ EUR ${POLICY_DISALLOWED_FLOOR.toLocaleString("en-GB")})`, value: E, source: "Adjustments · Policy disallowed" },
      { key: "F", label: "Other adjustments (SBC, asymmetric FX)", value: F, source: "Adjustments · Stock-based compensation · FX / as-if" },
      { key: "G", label: "Total adjustments [B]+[C]+[D]+[E]+[F]", value: G, source: "Computed" },
      { key: "H", label: "Simplified Income [A]+[G]", value: H, source: "Computed" },
      { key: "I", label: "Income tax expense (current + deferred) in the jurisdiction", value: I, source: "Financials.currentTax + deferredTax" },
      { key: "J", label: "Integrity adjustments to tax expense", value: J, source: "None recorded" },
      { key: "K", label: "Current tax adjustments (non-Covered Taxes removed)", value: K, source: "Adjustments · Net tax expense" },
      { key: "L", label: "Deferred tax adjustments", value: L, source: "Nil", gap: true },
      { key: "M", label: "Simplified Covered Taxes [I]+[J]+[K]+[L]", value: M, source: "Computed" },
      { key: "N", label: "Simplified ETR [M] ÷ [H]", value: setr, source: "Computed" },
    ],
    setr,
    passes15: setr === null ? null : setr >= 0.15,
    crossFill: [
      { from: "2.2.1.2(b)[H]", to: "3.2.1.1", label: "Net GloBE Income proxy" },
      { from: "2.2.1.2(b)[M]", to: "3.2.1.2", label: "Adjusted Covered Taxes proxy" },
      { from: "2.2.1.2(b)[N]", to: "3.2.2.1", label: "Effective Tax Rate" },
    ],
    gaps,
  };
}

/* -------------------------------------------------- STISH 2.2.1.2(c)–(d) */

export type StishIncentiveRow = { incentiveId: string; name: string; type: string; entityId: string; entityName: string; qualifyingExpenditure: number; qtiProxy: number; sbtishEligible: boolean; traced: boolean };

export type StishBlock = {
  iso: string;
  payrollBase: number;
  payrollCap: number;
  depreciationBase: number | null;
  depreciationCap: number | null;
  carryingValueBase: number;
  carryingValueCap: number;
  /** STISH_CV five-year election to use 1% of carrying value instead of the payroll / depreciation test. */
  carryingValueElected: boolean;
  applicableCap: number;
  capBasis: "payroll" | "depreciation" | "carrying-value";
  qrtcMttc: number;
  otherQti: number;
  totalQti: number;
  withinCap: boolean;
  rows: StishIncentiveRow[];
  gaps: string[];
};

export const STISH_CV_ELECTION = "STISH_CV";
const QTI_PROXY_RATE = 0.15;

export function stishBlock(calc: JurCalc, electionsOn: Record<string, boolean>): StishBlock {
  const fins = calc.entities.map((e) => fin(e.id)).filter((f): f is NonNullable<typeof f> => Boolean(f));
  const payrollBase = money(fins.reduce((s, f) => s + f.payrollEligible, 0));
  const carryingValueBase = money(fins.reduce((s, f) => s + f.tangibleEligible, 0));
  const payrollCap = money(payrollBase * 0.055);
  const carryingValueCap = money(carryingValueBase * 0.01);
  const carryingValueElected = on(electionsOn, [STISH_CV_ELECTION], calc.iso);
  const rows: StishIncentiveRow[] = [];
  for (const e of calc.entities) {
    for (const id of e.incentiveIds) {
      const inc = DATA.incentives.find((i) => i.id === id);
      if (!inc) continue;
      const trace = sbtishTrace(e.id);
      const qualifying = money(trace.lines.filter((l) => l.incentiveId === id && l.qualified).reduce((s, l) => s + l.amount, 0));
      rows.push({ incentiveId: id, name: inc.name, type: inc.type, entityId: e.id, entityName: e.name, qualifyingExpenditure: qualifying, qtiProxy: inc.sbtishEligible ? money(qualifying * QTI_PROXY_RATE) : 0, sbtishEligible: inc.sbtishEligible, traced: qualifying > 0 });
    }
  }
  const qrtcMttc = money(rows.filter((r) => /refundable|transferable|QRTC|MTTC/i.test(r.type)).reduce((s, r) => s + r.qtiProxy, 0));
  const otherQti = money(rows.filter((r) => !/refundable|transferable|QRTC|MTTC/i.test(r.type)).reduce((s, r) => s + r.qtiProxy, 0));
  const totalQti = money(qrtcMttc + otherQti);
  const capBasis: StishBlock["capBasis"] = carryingValueElected ? "carrying-value" : "payroll";
  const applicableCap = carryingValueElected ? carryingValueCap : payrollCap;
  const gaps: string[] = [];
  gaps.push("Depreciation of eligible tangible assets is not on the dataset — the 5.5% depreciation base cannot be tested; the payroll base is used as the larger-base proxy until the fixed-asset register is loaded.");
  if (rows.some((r) => r.sbtishEligible && !r.traced)) gaps.push("An STISH-eligible incentive has no traced qualifying expenditure — the (d) breakdown cannot be completed for it.");
  gaps.push(`Qualified Tax Incentive amounts are a ${QTI_PROXY_RATE * 100}% proxy on traced qualifying expenditure, not the statutory credit value — replace with the incentive ledger before filing.`);
  return { iso: calc.iso, payrollBase, payrollCap, depreciationBase: null, depreciationCap: null, carryingValueBase, carryingValueCap, carryingValueElected, applicableCap, capBasis, qrtcMttc, otherQti, totalQti, withinCap: totalQti <= applicableCap, rows, gaps };
}

/* ------------------------------------------------- banded summary 1.4 */

export const QTI_BANDS = ["< 1m", "1m – 5m", "5m – 25m", "25m – 50m", "50m – 75m", "75m – 100m", "100m – 250m", "≥ 250m"] as const;

export function amountBand(value: number): string {
  const m = Math.abs(value) / 1_000_000;
  if (m < 1) return QTI_BANDS[0];
  if (m < 5) return QTI_BANDS[1];
  if (m < 25) return QTI_BANDS[2];
  if (m < 50) return QTI_BANDS[3];
  if (m < 75) return QTI_BANDS[4];
  if (m < 100) return QTI_BANDS[5];
  if (m < 250) return QTI_BANDS[6];
  return QTI_BANDS[7];
}

/** 1.4 ETR band — 2.5-point bands from 0% to 30%, one open band above. */
export function etrBand(etr: number, computed: boolean): string {
  if (!computed) return "No ETR (Net GloBE Loss)";
  const pct = Math.max(0, etr * 100);
  if (pct >= 30) return "≥ 30%";
  const lo = Math.floor(pct / 2.5) * 2.5;
  return `${lo.toFixed(1)}% – ${(lo + 2.5).toFixed(1)}%`;
}

export type SummaryRow = {
  iso: string;
  name: string;
  rules: RuleCode[];
  safeHarbour: ShOptionCode | null;
  etrBand: string;
  topUpBand: string;
  sbieExceedsNgi: boolean;
  qtiBand: string;
  qdmttPayable: boolean;
  reportableDifferences: boolean;
};

export function summaryRow(calc: JurCalc, coding: ShCoding, stish: StishBlock, reportable: ReportableDifferences, overlay?: PackOverlay): SummaryRow {
  return {
    iso: calc.iso,
    name: calc.name,
    rules: applicableRules(calc.iso, overlay),
    safeHarbour: coding.primary,
    etrBand: etrBand(calc.etr, calc.etrComputed),
    topUpBand: calc.jurisdictionalTopUp <= 0 ? "Nil" : amountBand(calc.jurisdictionalTopUp),
    sbieExceedsNgi: calc.sbie > calc.globeIncome,
    qtiBand: stish.totalQti <= 0 ? "None" : amountBand(stish.totalQti),
    qdmttPayable: calc.collection.qdmtt > 0,
    reportableDifferences: reportable.answer === "Yes",
  };
}

/* -------------------------------------- reportable differences 2.1.5 */

export type ReportableDifferences = {
  iso: string;
  answer: "Yes" | "No" | "Not assessed";
  taxingRights: { iso: string; name: string; basis: string }[];
  items: { id: string; area: string; kind: string; finding: string; href: string }[];
  consequence: string;
};

export function taxingRightsJurisdictions(calc: JurCalc, group: Group, overlay?: PackOverlay): ReportableDifferences["taxingRights"] {
  const out: ReportableDifferences["taxingRights"] = [];
  const own = effectivePack(calc.iso, overlay);
  if (own?.qdmtt) out.push({ iso: calc.iso, name: own.name, basis: "QDMTT" });
  const upe = effectivePack(group.upeIso, overlay);
  if (upe?.iir && calc.iso !== group.upeIso) out.push({ iso: group.upeIso, name: upe.name, basis: "IIR (UPE)" });
  if (calc.collection.utpr > 0) {
    for (const p of DATA.packs) {
      const eff = effectivePack(p.iso, overlay);
      if (eff?.utpr && !out.some((o) => o.iso === p.iso)) out.push({ iso: p.iso, name: eff.name, basis: "UTPR" });
    }
  }
  return out;
}

export function reportableDifferences(calc: JurCalc, group: Group, overlay?: PackOverlay): ReportableDifferences {
  const taxingRights = taxingRightsJurisdictions(calc, group, overlay);
  if (calc.iso === "TH") {
    const gap = reviewOecdRdGap(calc);
    const items = gap.items
      .filter((g) => (g.kind === "diverge" || g.kind === "calc-gap") && ["G-SBIE", "G-SCOPE", "G-ETR", "G-FANIL", "G-CT"].includes(g.id))
      .map((g) => ({ id: g.id, area: g.area, kind: g.kind, finding: g.finding ?? g.core, href: g.href }));
    const yes = items.length > 0;
    return {
      iso: calc.iso,
      answer: yes ? "Yes" : "No",
      taxingRights,
      items,
      consequence: yes
        ? "Reportable differences exist between the GloBE computation and the Thai QDMTT computation — Section 2 and Section 3 must be completed in full for Thailand (no transitional simplified jurisdictional reporting), and the Thai figures are reported separately in the Thai return."
        : "No reportable difference between the GloBE computation and the domestic computation; simplified jurisdictional reporting remains available if no Top-up Tax arises.",
    };
  }
  return {
    iso: calc.iso,
    answer: taxingRights.length ? "No" : "Not assessed",
    taxingRights,
    items: [],
    consequence: taxingRights.length
      ? "No domestic divergence register is loaded for this jurisdiction; GMT24 answers No on the basis that the domestic rule follows the GloBE computation. Confirm against the local QDMTT law before filing."
      : "No jurisdiction holds taxing rights over this blend on the current packs; the 2.1.5 question is not asked.",
  };
}

/* ---------------------------------------------- CE-by-CE Section 3 path */

export type CeRow = { id: string; code: string; name: string; type: string; fanil: number; revenue: number; currentTax: number; deferredTax: number; payroll: number; tangible: number; adjustments: number; adjustmentCount: number };

export type CeByCe = {
  iso: string;
  required: boolean;
  reason: string;
  rows: CeRow[];
};

/** Transitional simplified jurisdictional reporting is unavailable where Top-up Tax must be allocated CE-by-CE (Art. 5.2.4). */
export function ceByCe(calc: JurCalc, group: Group): CeByCe {
  const required = calc.jurisdictionalTopUp > 0 && calc.entities.length > 1;
  const transitionalOpen = group.fyStart <= "2028-12-31" && group.fyEnd <= "2030-06-30";
  const reason = required
    ? `Top-up Tax of ${calc.jurisdictionalTopUp.toLocaleString("en-GB")} is allocated across ${calc.entities.length} Constituent Entities — Section 3 must be reported entity by entity.`
    : !transitionalOpen
      ? "The Transitional Simplified Jurisdictional Reporting Framework has closed (FYs beginning after 31 Dec 2028 or ending after 30 Jun 2030) — full CE-level reporting applies."
      : calc.jurisdictionalTopUp > 0
        ? "Single Constituent Entity carries the whole Top-up Tax; jurisdictional aggregate reporting satisfies Section 3."
        : "No Top-up Tax — jurisdictional aggregate reporting under the Transitional Simplified Jurisdictional Reporting Framework.";
  const rows: CeRow[] = (required || !transitionalOpen) ? calc.entities.map((e) => {
    const f = fin(e.id);
    const adj = DATA.adjustments.filter((a) => a.entityId === e.id);
    return { id: e.id, code: e.code, name: e.name, type: e.type, fanil: f?.fanil ?? 0, revenue: f?.revenue ?? 0, currentTax: f?.currentTax ?? 0, deferredTax: f?.deferredTax ?? 0, payroll: f?.payrollEligible ?? 0, tangible: f?.tangibleEligible ?? 0, adjustments: money(adj.reduce((s, a) => s + a.amount, 0)), adjustmentCount: adj.length };
  }) : [];
  return { iso: calc.iso, required: required || !transitionalOpen, reason, rows };
}

/* ----------------------------------------------------- dissemination */

export type DisseminationCategory = "upe" | "taxing-rights" | "qdmtt-only" | "utpr-zero" | "non-implementing";

export type Dissemination = {
  iso: string;
  name: string;
  category: DisseminationCategory;
  receives: string[];
  basis: string;
};

export const DISSEMINATION_LABEL: Record<DisseminationCategory, string> = {
  upe: "UPE jurisdiction — whole GIR",
  "taxing-rights": "Taxing-rights jurisdiction (IIR / UTPR) — general section + own jurisdictional sections + sections of jurisdictions it taxes",
  "qdmtt-only": "QDMTT-only jurisdiction — Section 1 without 1.4, plus its own Sections 2–3",
  "utpr-zero": "UTPR jurisdiction with 0% allocation — 3.4.3 excerpt only",
  "non-implementing": "No GloBE rules in force — nothing exchanged",
};

export function dissemination(group: Group, calcs: JurCalc[], overlay?: PackOverlay): Dissemination[] {
  const out: Dissemination[] = [];
  const isos = [...new Set([group.upeIso, ...calcs.map((c) => c.iso)])].filter((iso) => iso !== "XX");
  for (const iso of isos) {
    const pack = effectivePack(iso, overlay);
    const name = pack?.name ?? calcs.find((c) => c.iso === iso)?.name ?? iso;
    const calc = calcs.find((c) => c.iso === iso);
    if (iso === group.upeIso) { out.push({ iso, name, category: "upe", receives: ["Section 1", "Section 2 (all)", "Section 3 (all)"], basis: "UPE jurisdiction: files or receives the whole return under the central-filing approach." }); continue; }
    if (!pack || (!pack.iir && !pack.qdmtt && !pack.utpr)) { out.push({ iso, name, category: "non-implementing", receives: [], basis: "Not an implementing jurisdiction on the Central Record." }); continue; }
    if (pack.iir || (pack.utpr && (calc?.collection.utpr ?? 0) > 0)) { out.push({ iso, name, category: "taxing-rights", receives: ["Section 1", `Section 2 / 3 — ${name}`, "Sections 2 / 3 of jurisdictions whose Top-up Tax it collects"], basis: `${pack.iir ? "IIR" : "UTPR"} taxing rights.` }); continue; }
    if (pack.utpr) { out.push({ iso, name, category: "utpr-zero", receives: ["3.4.3 — UTPR allocation excerpt"], basis: "UTPR jurisdiction with a 0% UTPR percentage this year." }); continue; }
    out.push({ iso, name, category: "qdmtt-only", receives: ["Section 1 (excluding 1.4)", `Section 2 / 3 — ${name}`], basis: "QDMTT only — no IIR or UTPR taxing rights." });
  }
  return out;
}

/* ------------------------------------------------ Annex B notification */

export type Notification = {
  iso: string;
  name: string;
  partA: { groupName: string; reportingFy: string };
  partB: { entities: { code: string; name: string; type: string }[]; designatedLocalEntity: { code: string; name: string } | null };
  partC: { name: string; role: string; email: string; org: string };
  partD: { code: string; name: string; jurisdiction: string; tin: string };
  partE: { code: string; name: string; jurisdiction: string; sameAsUpe: boolean };
  partF: { start: string; end: string };
  exchangeBy: string;
};

function addMonths(date: string, months: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Art. 8.1.3 notification (Annex B) for every implementing jurisdiction where the group has a CE and does not file the GIR locally. */
export function annexBNotifications(group: Group, entities: Entity[], calcs: JurCalc[], overlay?: PackOverlay, firstYear = true): Notification[] {
  const upe = entities.find((e) => e.type === "UPE") ?? entities[0];
  const filingDeadline = addMonths(group.fyEnd, firstYear ? 18 : 15);
  const exchangeBy = addMonths(filingDeadline, 3);
  const isos = [...new Set(calcs.map((c) => c.iso))].filter((iso) => iso !== group.upeIso && iso !== "XX");
  const user = DATA.inhouseUser;
  return isos.flatMap((iso) => {
    const pack = effectivePack(iso, overlay);
    if (!pack || (!pack.iir && !pack.qdmtt && !pack.utpr)) return [];
    const local = entities.filter((e) => e.iso === iso);
    const dle = local.find((e) => e.type === "CE" || e.type === "HoldCo") ?? local[0] ?? null;
    return [{
      iso,
      name: pack.name,
      partA: { groupName: group.name, reportingFy: group.fy },
      partB: { entities: local.map((e) => ({ code: e.code, name: e.name, type: e.type })), designatedLocalEntity: dle ? { code: dle.code, name: dle.name } : null },
      partC: { name: user.name, role: user.role, email: user.email, org: user.org },
      partD: { code: upe.code, name: upe.name, jurisdiction: upe.jurisdiction, tin: group.upeTin ?? upe.code },
      partE: { code: upe.code, name: upe.name, jurisdiction: upe.jurisdiction, sameAsUpe: true },
      partF: { start: group.fyStart, end: group.fyEnd },
      exchangeBy,
    }];
  });
}

export function notificationText(n: Notification): string {
  return [
    `GLOBE INFORMATION RETURN — NOTIFICATION UNDER ARTICLE 8.1.3 (GIR September 2026, Annex B)`,
    `Jurisdiction notified: ${n.name} (${n.iso})`,
    ``,
    `A. MNE Group`,
    `   Name: ${n.partA.groupName}`,
    `   Reporting Fiscal Year: ${n.partA.reportingFy}`,
    ``,
    `B. Constituent Entities located in ${n.name}`,
    ...n.partB.entities.map((e) => `   ${e.code} · ${e.name} (${e.type})`),
    `   Designated Local Entity: ${n.partB.designatedLocalEntity ? `${n.partB.designatedLocalEntity.code} · ${n.partB.designatedLocalEntity.name}` : "—"}`,
    ``,
    `C. Contact`,
    `   ${n.partC.name}, ${n.partC.role}, ${n.partC.org} · ${n.partC.email}`,
    ``,
    `D. Ultimate Parent Entity`,
    `   ${n.partD.code} · ${n.partD.name} · ${n.partD.jurisdiction} · TIN ${n.partD.tin}`,
    ``,
    `E. Designated Filing Entity`,
    `   ${n.partE.sameAsUpe ? "Same as the UPE" : `${n.partE.code} · ${n.partE.name} · ${n.partE.jurisdiction}`}`,
    ``,
    `F. Reporting Fiscal Year period`,
    `   ${n.partF.start} to ${n.partF.end}`,
    ``,
    `The GIR will be filed centrally by the entity in Part E and received by ${n.name} under a Qualifying Competent Authority Agreement; exchange is expected by ${n.exchangeBy} (three months after the filing deadline).`,
    `Generated by GMT24 from the live snapshot — confirm the domestic notification form before submission.`,
  ].join("\n");
}

/* ------------------------------------------------- Annex C penalty relief */

export type PenaltyRelief = {
  transitionYear: boolean;
  window: string;
  conditions: { label: string; met: boolean; detail: string }[];
  status: "met" | "judgment" | "gap";
};

/** Annex C — transitional penalty relief where the group has taken reasonable measures; GMT24 tests the documentation it can see. */
export function penaltyRelief(group: Group, calcs: JurCalc[], hasAuditTrail: boolean, evidenceCount: number): PenaltyRelief {
  const transitionYear = group.fyStart <= "2026-12-31" && group.fyEnd <= "2028-06-30";
  const traced = calcs.every((c) => c.trace.globe && c.trace.covered && c.trace.etr);
  const conditions = [
    { label: "Transition period", met: transitionYear, detail: transitionYear ? `FY ${group.fyStart} – ${group.fyEnd} begins on or before 31 Dec 2026 and ends on or before 30 Jun 2028.` : "Outside the transition period — ordinary penalty regime." },
    { label: "Calculation-to-ledger audit trail retained", met: hasAuditTrail && traced, detail: hasAuditTrail && traced ? "Every jurisdictional amount traces to FANIL, adjustments and covered taxes." : "Audit trail incomplete for at least one jurisdiction." },
    { label: "Reasonable measures documented", met: evidenceCount > 0, detail: evidenceCount > 0 ? `${evidenceCount} evidence events sealed for the Reporting Fiscal Year.` : "No evidence sealed — document the allocation process, data sources and reviews." },
    { label: "Allocation process for GIR sections documented", met: true, detail: "GMT24 records which jurisdictions receive which sections (dissemination register) and who prepared each." },
  ];
  const failed = conditions.filter((c) => !c.met).length;
  return { transitionYear, window: "FYs beginning on or before 31 Dec 2026 and ending on or before 30 Jun 2028", conditions, status: !transitionYear ? "judgment" : failed === 0 ? "met" : "gap" };
}

/* ------------------------------------------------ TIN functional equivalent */

/** September 2026 guidance: a Government Verification Service identifier is an acceptable functional equivalent of a TIN. */
export function tinType(entity: Entity, group: Group): { code: "GIR3001" | "GIR3002"; value: string; label: string } {
  if (entity.type === "UPE" && group.upeTin) return { code: "GIR3001", value: group.upeTin, label: "TIN issued by the UPE jurisdiction" };
  return { code: "GIR3002", value: entity.code, label: "Functional equivalent — group entity identifier (a Government Verification Service identifier also qualifies)" };
}

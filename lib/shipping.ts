/**
 * OECD GloBE Model Rules — Article 3.3 International Shipping Income.
 *
 * Legal anchors (Model Rules + Commentary / Illustrative Examples):
 * - Art. 3.3.1 — ISI and QAISI **shall** be excluded (mandatory). Losses likewise
 *   (Example 3.3.1-3).
 * - Art. 3.3.2(a) — transport in international traffic (¶152: not solely domestic places).
 * - Art. 3.3.2(b) — slot-chartering (¶155).
 * - Art. 3.3.2(c) — lease out fully equipped/crewed/supplied (time/voyage charter) for
 *   international traffic (¶156).
 * - Art. 3.3.2(d) — bareboat-out QISI only if lessee is a group CE **and** has ISI (¶157).
 * - Art. 3.3.2 last sentence — inland waterways within same jurisdiction not ISI (¶160).
 * - Art. 3.3.3(a) — third-party bareboat QAISI only if lessee is non-CE shipping enterprise
 *   and charter ≤ 3 years including renewals (¶163–164).
 * - Art. 3.3.4 — jurisdictional QAISI ≤ 50% of jurisdiction ISI (¶172–173; Examples 3.3.1-2).
 * - Art. 3.3.6 — strategic **or** commercial management in CE jurisdiction (¶180–182).
 * - Art. 4.1.3(a) / Commentary ¶148 · ¶9 — Covered Taxes on excluded Ch. 3 income leave
 *   Adjusted Covered Taxes; tax on Art. 3.3.4 spill stays in (proportional method Example 4.1.3-1).
 *
 * Hooked from entityGlobe / entityCovered. Coverage only where tests assert it.
 */

import { money } from "./format";

/** Art. 3.3.2 — International Shipping Income categories. */
export type QisiCategory =
  | "international_transport" // 3.3.2(a)
  | "slot_charter" // 3.3.2(b)
  | "time_voyage_charter" // 3.3.2(c) crewed / fully equipped charter-out
  | "bareboat_charter_intragroup" // 3.3.2(d)
  | "pool_joint_agency" // 3.3.2(e)
  | "ship_sale"; // 3.3.2(f)

/** Art. 3.3.3 — Qualified Ancillary categories (inland haulage intentionally absent — ¶171). */
export type QaisiCategory =
  | "bareboat_charter_third_party" // 3.3.3(a)
  | "ticket_domestic_leg" // 3.3.3(b)
  | "container_leasing" // 3.3.3(c)
  | "engineering_services" // 3.3.3(d)
  | "ancillary_investment"; // 3.3.3(e)

export type NonQualifyingShippingCategory =
  | "inland_transport" // ¶171 — not QAISI
  | "other_non_qualifying";

export type ShippingLineKind = "qisi" | "qaisi" | "non_qualifying";

/** Art. 3.3.2(d) / 3.3.3(a) bareboat fact pack. */
export type BareboatFacts = {
  /** Lessee is a Constituent Entity of the same MNE Group (required for 3.3.2(d) QISI). */
  lesseeIsGroupCe?: boolean;
  /** Lessee has International Shipping Income (required for 3.3.2(d); Commentary ¶157). */
  lesseeHasInternationalShippingIncome?: boolean;
  /** Lessee is a shipping enterprise that is not a CE (required for 3.3.3(a) QAISI). */
  lesseeIsNonCeShippingEnterprise?: boolean;
  /** Contracted charter term in years for this arrangement. */
  charterYears?: number;
  /**
   * Prior/subsequent related bareboat periods of the same ship that ¶164 requires
   * aggregating (renewals). Total = charterYears + relatedCharterYears must be ≤ 3
   * for Art. 3.3.3(a).
   */
  relatedCharterYears?: number;
};

/** Commentary ¶152 / ¶156 / ¶160 — traffic and voyage facts. */
export type VoyageFacts = {
  /** Ship operated solely between places within a single jurisdiction → not international traffic (¶152). */
  solelyDomesticPlaces?: boolean;
  /** Transport via inland waterways within the same jurisdiction → not ISI (Art. 3.3.2 last sentence; ¶160). */
  inlandWaterwaysSameJurisdiction?: boolean;
  /** Art. 3.3.2(c) — ship expected to be used for international traffic (¶156). */
  expectedInternationalTraffic?: boolean;
};

export type ShippingLine = {
  id: string;
  /** Declared kind; engine re-classifies from category + facts. */
  kind: ShippingLineKind;
  category: QisiCategory | QaisiCategory | NonQualifyingShippingCategory;
  amount: number;
  flagJurisdiction?: string;
  bareboat?: BareboatFacts;
  voyage?: VoyageFacts;
  /** Art. 3.3.2(f) — minimum one-year holding (¶159). */
  heldYears?: number;
  /** Legacy override — prefer structured facts. When false, force non-qualifying. */
  qualifies?: boolean;
  notes?: string;
};

export type ShippingFacts = {
  entityId: string;
  ceJurisdiction: string;
  strategicManagementInCeJur: boolean;
  commercialManagementInCeJur: boolean;
  lines: ShippingLine[];
  /**
   * Art. 4.1.3(a) inputs (Example 4.1.3-1 method):
   * reduction = incomeExcluded / taxableIncome × currentTaxExpense.
   * Tax on Art. 3.3.4 spill is not in incomeExcluded, so it stays in Covered Taxes.
   */
  currentTaxExpense: number;
  taxableIncome: number;
  sourceDoc: string;
};

export type ShippingLineTreatment =
  | "excluded_qisi"
  | "excluded_qaisi"
  | "capped_out"
  | "non_qualifying"
  | "kept_management_fail";

export type ShippingResult = {
  entityId: string;
  managementPass: boolean;
  disqualified: boolean;
  disqualifyReason: string;
  qisiGross: number;
  qaisiGross: number;
  qaisiCap: number;
  qaisiExcluded: number;
  qaisiCappedOut: number;
  qisiExcluded: number;
  incomeExcluded: number;
  globeDelta: number;
  /** Art. 4.1.3(a) reduction to Adjusted Covered Taxes. */
  coveredTaxExcluded: number;
  nonQualifyingKept: number;
  lines: Array<ShippingLine & { treatedAs: ShippingLineTreatment; classifiedAs: ShippingLineKind }>;
  detail: string;
  ruleId: "OECD-SHIP-33";
};

const QISI_CATS: ReadonlySet<string> = new Set([
  "international_transport",
  "slot_charter",
  "time_voyage_charter",
  "bareboat_charter_intragroup",
  "pool_joint_agency",
  "ship_sale",
]);

const QAISI_CATS: ReadonlySet<string> = new Set([
  "bareboat_charter_third_party",
  "ticket_domestic_leg",
  "container_leasing",
  "engineering_services",
  "ancillary_investment",
]);

/** Art. 3.3.3(a) — total bareboat period including renewals (Commentary ¶164). */
export function bareboatTotalYears(b: BareboatFacts | undefined): number | null {
  if (!b || b.charterYears == null) return null;
  return money((b.charterYears + (b.relatedCharterYears ?? 0)) * 1000) / 1000;
}

export function bareboatWithinThreeYears(b: BareboatFacts | undefined): boolean {
  const total = bareboatTotalYears(b);
  return total != null && total <= 3;
}

/**
 * Classify a line under Art. 3.3.2 / 3.3.3 with fact gates.
 * Returns non_qualifying when required facts fail (B2 auditor-grade).
 */
export function classifyShippingLine(line: ShippingLine): {
  kind: ShippingLineKind;
  reason: string;
} {
  if (line.qualifies === false || line.category === "inland_transport" || line.category === "other_non_qualifying") {
    return {
      kind: "non_qualifying",
      reason: line.category === "inland_transport"
        ? "Commentary ¶171 — inland transportation is not QAISI"
        : "Line marked non-qualifying",
    };
  }

  const v = line.voyage;

  // Traffic / voyage screens for transport-like QISI (¶152 / ¶160)
  if (
    line.category === "international_transport" ||
    line.category === "slot_charter" ||
    line.category === "pool_joint_agency"
  ) {
    if (v?.solelyDomesticPlaces) {
      return { kind: "non_qualifying", reason: "Commentary ¶152 — ship operated solely between places in a single jurisdiction (not international traffic)" };
    }
    if (v?.inlandWaterwaysSameJurisdiction) {
      return { kind: "non_qualifying", reason: "Art. 3.3.2 last sentence / ¶160 — inland waterways within the same jurisdiction" };
    }
  }

  // Art. 3.3.2(c) — crewed time/voyage charter-out
  if (line.category === "time_voyage_charter") {
    if (v?.expectedInternationalTraffic !== true) {
      return { kind: "non_qualifying", reason: "Art. 3.3.2(c) / ¶156 — lessor must show ship expected to be used in international traffic" };
    }
    if (v.solelyDomesticPlaces || v.inlandWaterwaysSameJurisdiction) {
      return { kind: "non_qualifying", reason: "Art. 3.3.2(c) — voyage facts fail international traffic" };
    }
    return { kind: "qisi", reason: "Art. 3.3.2(c) time/voyage charter-out for international traffic" };
  }

  // Art. 3.3.2(d) — intragroup bareboat → QISI only with lessee CE + lessee ISI
  if (line.category === "bareboat_charter_intragroup") {
    const b = line.bareboat;
    if (!b?.lesseeIsGroupCe) {
      return { kind: "non_qualifying", reason: "Art. 3.3.2(d) / ¶157 — lessee must be a Constituent Entity of the same MNE Group" };
    }
    if (!b.lesseeHasInternationalShippingIncome) {
      return { kind: "non_qualifying", reason: "Art. 3.3.2(d) / ¶157 — lessee must have International Shipping Income" };
    }
    return { kind: "qisi", reason: "Art. 3.3.2(d) intragroup bareboat-out to CE with ISI" };
  }

  // Art. 3.3.3(a) — third-party bareboat → QAISI only with non-CE shipping enterprise + ≤3 years
  if (line.category === "bareboat_charter_third_party") {
    const b = line.bareboat;
    if (!b?.lesseeIsNonCeShippingEnterprise) {
      return { kind: "non_qualifying", reason: "Art. 3.3.3(a) / ¶163 — lessee must be a shipping enterprise that is not a Constituent Entity" };
    }
    if (b.lesseeIsGroupCe) {
      return { kind: "non_qualifying", reason: "Art. 3.3.3(a) — group-CE lessee belongs under Art. 3.3.2(d), not 3.3.3(a)" };
    }
    if (!bareboatWithinThreeYears(b)) {
      return {
        kind: "non_qualifying",
        reason: "Art. 3.3.3(a) / ¶164 — bareboat charter exceeds three years including renewals (or duration facts missing)",
      };
    }
    return { kind: "qaisi", reason: "Art. 3.3.3(a) third-party bareboat-out ≤ 3 years" };
  }

  // Art. 3.3.2(f) ship sale — 1-year holding
  if (line.category === "ship_sale") {
    if ((line.heldYears ?? 0) < 1) {
      return { kind: "non_qualifying", reason: "Art. 3.3.2(f) / ¶159 — ship must be held ≥ 1 year" };
    }
    return { kind: "qisi", reason: "Art. 3.3.2(f) sale of qualifying ship" };
  }

  if (QISI_CATS.has(line.category)) {
    return { kind: "qisi", reason: `Art. 3.3.2 — ${line.category}` };
  }
  if (QAISI_CATS.has(line.category)) {
    return { kind: "qaisi", reason: `Art. 3.3.3 — ${line.category}` };
  }
  return { kind: "non_qualifying", reason: "Unrecognised shipping category" };
}

/** Art. 4.1.3(a) — Example 4.1.3-1 proportional method. */
export function art413aReduction(incomeExcluded: number, taxableIncome: number, currentTaxExpense: number): number {
  if (incomeExcluded === 0 || taxableIncome === 0) return 0;
  // excluded / taxable × current tax (sign follows excluded income for loss cases)
  return money((incomeExcluded / taxableIncome) * currentTaxExpense);
}

export function qaisiCapOf(qisi: number): number {
  if (qisi <= 0) return 0;
  return money(qisi * 0.5);
}

export function managementTestPass(facts: Pick<ShippingFacts, "strategicManagementInCeJur" | "commercialManagementInCeJur">): boolean {
  return facts.strategicManagementInCeJur || facts.commercialManagementInCeJur;
}

function classifiedSums(pack: ShippingFacts) {
  let qisi = 0;
  let qaisi = 0;
  let nonQ = 0;
  const rows: Array<{ line: ShippingLine; kind: ShippingLineKind; reason: string }> = [];
  for (const line of pack.lines) {
    const c = classifyShippingLine(line);
    rows.push({ line, kind: c.kind, reason: c.reason });
    if (c.kind === "qisi") qisi = money(qisi + line.amount);
    else if (c.kind === "qaisi") qaisi = money(qaisi + line.amount);
    else nonQ = money(nonQ + line.amount);
  }
  return { qisi, qaisi, nonQ, rows };
}

export function jurisdictionalQaisiCap(
  ceJurisdiction: string,
  allPacks: ShippingFacts[] = SHIPPING_PACKS,
): { jurisdictionQisi: number; jurisdictionQaisi: number; cap: number } {
  let jurisdictionQisi = 0;
  let jurisdictionQaisi = 0;
  for (const p of allPacks.filter((x) => x.ceJurisdiction === ceJurisdiction)) {
    if (!managementTestPass(p)) continue;
    const s = classifiedSums(p);
    jurisdictionQisi = money(jurisdictionQisi + s.qisi);
    jurisdictionQaisi = money(jurisdictionQaisi + s.qaisi);
  }
  return { jurisdictionQisi, jurisdictionQaisi, cap: qaisiCapOf(jurisdictionQisi) };
}

/** Live Aetherion seed — Singapore maritime CE (SG-SHIP). */
export const SHIPPING_PACKS: ShippingFacts[] = [
  {
    entityId: "SG-SHIP",
    ceJurisdiction: "SG",
    strategicManagementInCeJur: true,
    commercialManagementInCeJur: true,
    currentTaxExpense: 1_120_000,
    taxableIncome: 8_900_000,
    sourceDoc: "SG-SHIP shipping P&L FY2026.xlsx",
    lines: [
      {
        id: "SH-01",
        kind: "qisi",
        category: "international_transport",
        amount: 5_200_000,
        flagJurisdiction: "LR",
        voyage: { solelyDomesticPlaces: false, inlandWaterwaysSameJurisdiction: false },
        notes: "Art. 3.3.2(a) · international traffic · Liberian flag; commercial management in SG (Art. 3.3.6)",
      },
      {
        id: "SH-02",
        kind: "qaisi",
        category: "bareboat_charter_third_party",
        amount: 800_000,
        flagJurisdiction: "SG",
        bareboat: {
          lesseeIsNonCeShippingEnterprise: true,
          lesseeIsGroupCe: false,
          charterYears: 2,
          relatedCharterYears: 0,
        },
        notes: "Art. 3.3.3(a) third-party bareboat-out · 2 years · non-CE shipping enterprise",
      },
      {
        id: "SH-03",
        kind: "qaisi",
        category: "container_leasing",
        amount: 1_400_000,
        notes: "Art. 3.3.3(c) container leasing / short-term storage",
      },
      {
        id: "SH-04",
        kind: "non_qualifying",
        category: "inland_transport",
        amount: 400_000,
        qualifies: false,
        notes: "Commentary ¶171 — inland haulage not QAISI; remains in GloBE",
      },
      {
        id: "SH-05",
        kind: "qisi",
        category: "ship_sale",
        amount: 600_000,
        flagJurisdiction: "LR",
        heldYears: 4,
        notes: "Art. 3.3.2(f) sale · held 4 years",
      },
    ],
  },
];

export function shippingFactsFor(entityId: string): ShippingFacts | undefined {
  return SHIPPING_PACKS.find((p) => p.entityId === entityId);
}

export function shippingPacksInJurisdiction(iso: string, packs = SHIPPING_PACKS): ShippingFacts[] {
  return packs.filter((p) => p.ceJurisdiction === iso);
}

/**
 * Build a one-CE facts pack from OECD Example 3.3.1-n numbers (management passes).
 * Tax fields unused unless the caller sets them for Art. 4.1.3(a) tests.
 */
export function example331Facts(opts: {
  entityId?: string;
  fanil: number;
  otherIncome: number;
  qisi: number;
  qaisi: number;
  currentTaxExpense?: number;
  taxableIncome?: number;
}): ShippingFacts {
  const shippingNet = money(opts.qisi + opts.qaisi);
  const impliedOther = money(opts.fanil - shippingNet);
  // otherIncome is documentary; lines carry qisi/qaisi only — residual FANIL handled by caller.
  void impliedOther;
  void opts.otherIncome;
  return {
    entityId: opts.entityId ?? "EX-331",
    ceJurisdiction: "EX",
    strategicManagementInCeJur: true,
    commercialManagementInCeJur: true,
    currentTaxExpense: opts.currentTaxExpense ?? 0,
    taxableIncome: opts.taxableIncome ?? opts.fanil,
    sourceDoc: "OECD Illustrative Examples Art. 3.3.1",
    lines: [
      {
        id: "ex-qisi",
        kind: "qisi",
        category: "international_transport",
        amount: opts.qisi,
        voyage: { solelyDomesticPlaces: false },
      },
      {
        id: "ex-qaisi",
        kind: "qaisi",
        category: "container_leasing",
        amount: opts.qaisi,
      },
    ],
  };
}

export function computeShippingExclusion(
  entityId: string,
  facts?: ShippingFacts,
  opts?: { allPacks?: ShippingFacts[] },
): ShippingResult | null {
  const pack = facts ?? shippingFactsFor(entityId);
  if (!pack) return null;

  const peerUniverse = opts?.allPacks ?? (SHIPPING_PACKS.some((p) => p.entityId === pack.entityId) ? SHIPPING_PACKS : [pack]);
  const managementPass = managementTestPass(pack);
  const { qisi: qisiGross, qaisi: qaisiGross, nonQ: nonQualifyingKept, rows } = classifiedSums(pack);

  const annotated: ShippingResult["lines"] = rows.map(({ line, kind, reason }) => ({
    ...line,
    kind,
    treatedAs: kind === "non_qualifying" ? "non_qualifying" : kind === "qisi" ? "excluded_qisi" : "excluded_qaisi",
    classifiedAs: kind,
    notes: line.notes ? `${line.notes} · ${reason}` : reason,
  }));

  const { cap: qaisiCap, jurisdictionQisi } = jurisdictionalQaisiCap(pack.ceJurisdiction, peerUniverse);

  if (!managementPass) {
    const why =
      !pack.strategicManagementInCeJur && !pack.commercialManagementInCeJur
        ? "Neither strategic nor commercial management is effectively carried on in the CE jurisdiction (Art. 3.3.6)."
        : "Art. 3.3.6 management test failed.";
    return {
      entityId: pack.entityId,
      managementPass: false,
      disqualified: true,
      disqualifyReason: why,
      qisiGross,
      qaisiGross,
      qaisiCap,
      qaisiExcluded: 0,
      qaisiCappedOut: 0,
      qisiExcluded: 0,
      incomeExcluded: 0,
      globeDelta: 0,
      coveredTaxExcluded: 0,
      nonQualifyingKept,
      lines: annotated.map((l) => ({
        ...l,
        treatedAs: l.classifiedAs === "non_qualifying" ? "non_qualifying" : "kept_management_fail",
      })),
      detail: `${why} International Shipping Income and QAISI remain in GloBE Income; no Art. 4.1.3(a) reduction.`,
      ruleId: "OECD-SHIP-33",
    };
  }

  const peersPassing = peerUniverse.filter((p) => p.ceJurisdiction === pack.ceJurisdiction && managementTestPass(p));
  const jurQaisiPositive = money(
    peersPassing.reduce((a, p) => {
      const q = classifiedSums(p).qaisi;
      return a + Math.max(0, q);
    }, 0),
  );

  let thisCeQaisiRoom = 0;
  if (qaisiGross > 0) {
    if (jurQaisiPositive > qaisiCap && jurQaisiPositive > 0) {
      thisCeQaisiRoom = money(qaisiCap * (qaisiGross / jurQaisiPositive));
    } else {
      thisCeQaisiRoom = money(Math.min(qaisiGross, qaisiCap));
    }
  }

  let qaisiExcludedSigned = 0;
  let qaisiCappedOut = 0;
  if (qaisiGross < 0) {
    // Example 3.3.1-3 — QAISI loss is excluded under Art. 3.3.1 (cap does not block losses).
    qaisiExcludedSigned = qaisiGross;
    qaisiCappedOut = 0;
  } else if (qaisiGross === 0) {
    qaisiExcludedSigned = 0;
    qaisiCappedOut = 0;
  } else {
    qaisiExcludedSigned = money(Math.min(qaisiGross, thisCeQaisiRoom));
    qaisiCappedOut = money(Math.max(0, qaisiGross - qaisiExcludedSigned));
  }

  const qisiExcluded = qisiGross;
  const incomeExcluded = money(qisiExcluded + qaisiExcludedSigned);
  const globeDelta = money(-incomeExcluded);
  const coveredTaxExcluded = art413aReduction(incomeExcluded, pack.taxableIncome, pack.currentTaxExpense);

  const linesOut: ShippingResult["lines"] = [];
  let qaisiRunning = 0;
  for (const line of annotated) {
    if (line.classifiedAs === "non_qualifying") {
      linesOut.push(line);
      continue;
    }
    if (line.classifiedAs === "qisi") {
      linesOut.push({ ...line, treatedAs: "excluded_qisi" });
      continue;
    }
    // qaisi
    if (qaisiGross < 0) {
      linesOut.push({ ...line, treatedAs: "excluded_qaisi" });
      continue;
    }
    if (qaisiExcludedSigned <= 0) {
      linesOut.push({ ...line, treatedAs: "capped_out" });
      continue;
    }
    if (line.amount <= 0) {
      linesOut.push({ ...line, treatedAs: "excluded_qaisi" });
      continue;
    }
    const room = money(qaisiExcludedSigned - qaisiRunning);
    if (room <= 0) {
      linesOut.push({ ...line, treatedAs: "capped_out" });
    } else if (line.amount <= room) {
      qaisiRunning = money(qaisiRunning + line.amount);
      linesOut.push({ ...line, treatedAs: "excluded_qaisi" });
    } else {
      qaisiRunning = qaisiExcludedSigned;
      linesOut.push({
        ...line,
        treatedAs: "capped_out",
        notes: `${line.notes ?? ""} · Art. 3.3.4 jurisdictional 50% cap — ${room.toLocaleString("en-GB")} of ${line.amount.toLocaleString("en-GB")} excluded`.trim(),
      });
    }
  }

  const flagNote = pack.lines.some((l) => l.flagJurisdiction && l.flagJurisdiction !== pack.ceJurisdiction)
    ? " Flag ≠ CE location — Art. 3.3.6 looks to management, not flag (¶182)."
    : "";

  return {
    entityId: pack.entityId,
    managementPass: true,
    disqualified: false,
    disqualifyReason: "",
    qisiGross,
    qaisiGross,
    qaisiCap,
    qaisiExcluded: qaisiExcludedSigned,
    qaisiCappedOut,
    qisiExcluded,
    incomeExcluded,
    globeDelta,
    coveredTaxExcluded,
    nonQualifyingKept,
    lines: linesOut,
    detail: `Art. 3.3.1 mandatory exclusion — QISI ${qisiExcluded.toLocaleString("en-GB")} + QAISI ${qaisiExcludedSigned.toLocaleString("en-GB")} (Art. 3.3.4 jurisdictional cap ${qaisiCap.toLocaleString("en-GB")} = 50% of jurisdiction QISI ${jurisdictionQisi.toLocaleString("en-GB")}). Art. 3.3.6 OR management passes. Art. 4.1.3(a) Covered Tax reduction ${coveredTaxExcluded.toLocaleString("en-GB")} (= excluded ${incomeExcluded.toLocaleString("en-GB")} ÷ taxable ${pack.taxableIncome.toLocaleString("en-GB")} × current tax ${pack.currentTaxExpense.toLocaleString("en-GB")}).${flagNote}`,
    ruleId: "OECD-SHIP-33",
  };
}

export function shippingGlobeDelta(entityId: string): number {
  return computeShippingExclusion(entityId)?.globeDelta ?? 0;
}

export function shippingCoveredTaxExcluded(entityId: string): number {
  return computeShippingExclusion(entityId)?.coveredTaxExcluded ?? 0;
}

export function shippingAsAdjustment(entityId: string): {
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
  status: "Reviewed";
} | null {
  const r = computeShippingExclusion(entityId);
  if (!r) return null;
  if (r.disqualified) {
    return {
      id: `ADJ-SHIP-${entityId}`,
      entityId,
      category: "International shipping (Art. 3.3)",
      original: money(r.qisiGross + r.qaisiGross),
      amount: 0,
      reason: r.detail,
      ruleId: "OECD-SHIP-33",
      sourceDoc: shippingFactsFor(entityId)?.sourceDoc ?? "shipping pack",
      account: "SHIP-QISI",
      preparer: "Group Tax",
      reviewer: "M. Sato",
      status: "Reviewed",
    };
  }
  if (r.globeDelta === 0 && r.incomeExcluded === 0 && r.nonQualifyingKept === 0) return null;
  return {
    id: `ADJ-SHIP-${entityId}`,
    entityId,
    category: "International shipping (Art. 3.3)",
    original: r.incomeExcluded,
    amount: r.globeDelta,
    reason: r.detail,
    ruleId: "OECD-SHIP-33",
    sourceDoc: shippingFactsFor(entityId)?.sourceDoc ?? "shipping pack",
    account: "SHIP-QISI",
    preparer: "Group Tax",
    reviewer: "M. Sato",
    status: "Reviewed",
  };
}

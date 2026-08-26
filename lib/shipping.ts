/**
 * OECD GloBE Model Rules — Article 3.3 International Shipping Income.
 *
 * Art. 3.3.5 (Commentary ¶174–179): net ISI / QAISI from gross revenue − direct
 * costs − indirect allocated by revenue ratio. Costs on Art. 3.3.4 spill QAISI stay
 * in GloBE (¶178) because only allowable net QAISI is excluded.
 *
 * Art. 4.1.3(a) (Commentary ¶148 · ¶9): Covered Taxes *associated with* excluded
 * shipping leave Adjusted Covered Taxes. Identifiable tax preferred; unidentifiable
 * remainder prorated on (excluded + spill + residual) using current + deferred +
 * otherCovered. Spill and residual tax stay in ACT.
 *
 * Management is Art. 3.3.6 (OR). Cap is Art. 3.3.4. Do not cite 3.3.4 as management.
 */

import { money } from "./format";

export type QisiCategory =
  | "international_transport"
  | "slot_charter"
  | "time_voyage_charter"
  | "bareboat_charter_intragroup"
  | "pool_joint_agency"
  | "ship_sale";

/** Art. 3.3.3(a)–(e) closed list only — no open “other ancillary”. */
export type QaisiCategory =
  | "bareboat_charter_third_party" // 3.3.3(a)
  | "ticket_domestic_leg" // 3.3.3(b)
  | "container_leasing" // 3.3.3(c)
  | "engineering_services" // 3.3.3(d)
  | "ancillary_investment"; // 3.3.3(e)

export type NonQualifyingShippingCategory =
  | "inland_transport"
  | "other_non_qualifying"
  | "treasury_interest"
  | "other_ancillary"
  | "towing_dredging";

export type ShippingLineKind = "qisi" | "qaisi" | "non_qualifying";

export type BareboatFacts = {
  lesseeIsGroupCe?: boolean;
  lesseeHasInternationalShippingIncome?: boolean;
  lesseeIsNonCeShippingEnterprise?: boolean;
  charterYears?: number;
  relatedCharterYears?: number;
};

export type VoyageFacts = {
  solelyDomesticPlaces?: boolean;
  inlandWaterwaysSameJurisdiction?: boolean;
  expectedInternationalTraffic?: boolean;
};

/** Art. 3.3.3(b) — tickets issued by *other* shipping enterprises. */
export type TicketFacts = {
  issuedByOtherShippingEnterprise?: boolean;
  domesticLegOfInternationalVoyage?: boolean;
};

export type ShippingLine = {
  id: string;
  /**
   * Preparer hint only — classification comes from category + OECD facts.
   * A `kind: "qaisi"` tag does **not** satisfy the Art. 3.3.3 chapeau.
   */
  kind: ShippingLineKind;
  category: QisiCategory | QaisiCategory | NonQualifyingShippingCategory;
  /**
   * Legacy / Example 3.3.1-x precomputed net. Ignored for Art. 3.3.5 when
   * `revenue` is set; otherwise treated as revenue with zero direct costs.
   */
  amount: number;
  /** Art. 3.3.5 — gross revenue from the activity. */
  revenue?: number;
  /** Art. 3.3.5 — direct costs attributable on facts and circumstances (¶174). */
  directCosts?: number;
  /**
   * Art. 4.1.3(a) — current tax expense attributable to this line (engine fact).
   * Identifiable association reads these fields; pack labels alone do not.
   */
  currentTax?: number;
  /** Art. 4.1.3(a) — deferred tax attributable to this line. */
  deferredTax?: number;
  flagJurisdiction?: string;
  bareboat?: BareboatFacts;
  voyage?: VoyageFacts;
  ticket?: TicketFacts;
  heldYears?: number;
  /**
   * Art. 3.3.3 chapeau — activity performed primarily in connection with
   * transportation of passengers or cargo by ships in international traffic.
   * Required for every QAISI line; false/omitted → residual GloBE.
   */
  primarilyInConnectionWithInternationalTraffic?: boolean;
  /**
   * Art. 3.3.3(e) / ¶170 — investment income integral to operating the ships
   * (working capital, statutory bonds, emissions permits). Not group treasury.
   */
  integralToShipOperations?: boolean;
  /** Commentary ¶166 — short-term container storage (~5 days). */
  containerStorageDays?: number;
  qualifies?: boolean;
  notes?: string;
};

export type ShippingTaxAssociation = {
  identifiableCurrentOnExcluded: number;
  identifiableDeferredOnExcluded: number;
  identifiableTaxOnSpill: number;
  identifiableTaxOnResidual: number;
};

export type ShippingFacts = {
  entityId: string;
  ceJurisdiction: string;
  strategicManagementInCeJur: boolean;
  commercialManagementInCeJur: boolean;
  lines: ShippingLine[];
  /** Art. 3.3.5 ¶176 — indirect / overhead pool. */
  indirectCosts: number;
  /** Revenue from activities outside shipping lines (non-qualified residual). */
  residualRevenue: number;
  /** Current tax expense (Art. 4.1.1 / FINANCIALS.currentTax). */
  currentTaxExpense: number;
  /** Deferred tax in the Covered Tax numerator (FINANCIALS.deferredTax). */
  deferredTaxExpense: number;
  /** Other covered (Art. 4.2/4.3); follows same association when non-zero. */
  otherCovered: number;
  /**
   * Domestic taxable income (or FANIL proxy) for unidentifiable-tax proration
   * when residual net is not otherwise known.
   */
  taxableIncome: number;
  /**
   * Optional CE *actual* shipping-activity tax rate (not a hardcoded 15%).
   * Used only to derive line tax from 3.3.5 net when that line has no
   * `currentTax`/`deferredTax` facts.
   */
  shippingActivityTaxRate?: number;
  sourceDoc: string;
};

export type ShippingLineTreatment =
  | "excluded_qisi"
  | "excluded_qaisi"
  | "capped_out"
  | "non_qualifying"
  | "kept_management_fail";

export type IndirectAllocation = {
  isi: number;
  qaisi: number;
  residual: number;
  totalRevenue: number;
};

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
  coveredTaxExcluded: number;
  nonQualifyingKept: number;
  /** Art. 3.3.5 cost build. */
  cost: {
    isiRevenue: number;
    qaisiRevenue: number;
    residualRevenue: number;
    isiDirect: number;
    qaisiDirect: number;
    residualDirect: number;
    indirect: IndirectAllocation;
    isiNet: number;
    qaisiNet: number;
    usedGrossEngine: boolean;
  };
  tax: {
    identifiableExcluded: number;
    identifiableSpill: number;
    identifiableResidual: number;
    unidentifiablePool: number;
    ratioShare: number;
    totalPool: number;
  };
  lines: Array<ShippingLine & { treatedAs: ShippingLineTreatment; classifiedAs: ShippingLineKind; netAfterCosts: number }>;
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

/** Art. 3.3.3(a)–(e) closed list. */
const QAISI_CLOSED: ReadonlySet<string> = new Set([
  "bareboat_charter_third_party",
  "ticket_domestic_leg",
  "container_leasing",
  "engineering_services",
  "ancillary_investment",
]);

export function bareboatTotalYears(b: BareboatFacts | undefined): number | null {
  if (!b || b.charterYears == null) return null;
  return money((b.charterYears + (b.relatedCharterYears ?? 0)) * 1000) / 1000;
}

export function bareboatWithinThreeYears(b: BareboatFacts | undefined): boolean {
  const total = bareboatTotalYears(b);
  return total != null && total <= 3;
}

function qaisiChapeauFail(line: ShippingLine): string | null {
  if (line.primarilyInConnectionWithInternationalTraffic !== true) {
    return "Art. 3.3.3 chapeau — primarily in connection with international traffic required (false or omitted)";
  }
  return null;
}

/**
 * Classify a shipping line from category + OECD facts.
 * Preparer `kind` is ignored for gate outcomes.
 */
export function classifyShippingLine(line: ShippingLine): { kind: ShippingLineKind; reason: string } {
  if (
    line.qualifies === false ||
    line.category === "inland_transport" ||
    line.category === "other_non_qualifying" ||
    line.category === "treasury_interest" ||
    line.category === "other_ancillary" ||
    line.category === "towing_dredging"
  ) {
    const reason =
      line.category === "inland_transport"
        ? "Commentary ¶171 — inland transportation is not QAISI"
        : line.category === "treasury_interest"
          ? "Commentary ¶170 — group treasury / surplus-cash interest is not Art. 3.3.3(e)"
          : line.category === "other_ancillary"
            ? "Art. 3.3.3 closed list — other_ancillary is not QAISI"
            : line.category === "towing_dredging"
              ? "Commentary ¶153 — towing/dredging is not transportation of passengers or cargo"
              : "Line marked non-qualifying";
    return { kind: "non_qualifying", reason };
  }

  const v = line.voyage;

  // Art. 3.3.2(a) — fail-closed: voyage facts required; omit → not ISI.
  if (line.category === "international_transport") {
    if (!v) {
      return { kind: "non_qualifying", reason: "Art. 3.3.2(a) / ¶152 — voyage facts required (fail-closed)" };
    }
    if (v.solelyDomesticPlaces === true) {
      return { kind: "non_qualifying", reason: "Commentary ¶152 — solely between places in a single jurisdiction" };
    }
    if (v.inlandWaterwaysSameJurisdiction === true) {
      return { kind: "non_qualifying", reason: "Art. 3.3.2 last sentence / ¶160 — inland waterways same jurisdiction" };
    }
    if (v.solelyDomesticPlaces !== false) {
      return {
        kind: "non_qualifying",
        reason: "Art. 3.3.2(a) / ¶152 — must affirm not solely domestic (solelyDomesticPlaces: false)",
      };
    }
    return { kind: "qisi", reason: "Art. 3.3.2(a) international transport in international traffic" };
  }

  if (line.category === "slot_charter" || line.category === "pool_joint_agency") {
    if (v?.solelyDomesticPlaces === true) {
      return { kind: "non_qualifying", reason: "Commentary ¶152 — solely between places in a single jurisdiction" };
    }
    if (v?.inlandWaterwaysSameJurisdiction === true) {
      return { kind: "non_qualifying", reason: "Art. 3.3.2 last sentence / ¶160 — inland waterways same jurisdiction" };
    }
    return { kind: "qisi", reason: `Art. 3.3.2 — ${line.category}` };
  }

  if (line.category === "time_voyage_charter") {
    if (v?.expectedInternationalTraffic !== true) {
      return { kind: "non_qualifying", reason: "Art. 3.3.2(c) / ¶156 — expected international traffic required" };
    }
    if (v.solelyDomesticPlaces || v.inlandWaterwaysSameJurisdiction) {
      return { kind: "non_qualifying", reason: "Art. 3.3.2(c) — voyage facts fail international traffic" };
    }
    return { kind: "qisi", reason: "Art. 3.3.2(c) time/voyage charter-out" };
  }

  if (line.category === "bareboat_charter_intragroup") {
    const b = line.bareboat;
    if (!b?.lesseeIsGroupCe) {
      return { kind: "non_qualifying", reason: "Art. 3.3.2(d) / ¶157 — lessee must be a group CE" };
    }
    if (!b.lesseeHasInternationalShippingIncome) {
      return { kind: "non_qualifying", reason: "Art. 3.3.2(d) / ¶157 — lessee must have International Shipping Income" };
    }
    return { kind: "qisi", reason: "Art. 3.3.2(d) intragroup bareboat-out" };
  }

  if (line.category === "ship_sale") {
    if ((line.heldYears ?? 0) < 1) {
      return { kind: "non_qualifying", reason: "Art. 3.3.2(f) / ¶159 — held ≥ 1 year required" };
    }
    return { kind: "qisi", reason: "Art. 3.3.2(f) ship sale" };
  }

  // ─── Art. 3.3.3 closed list + chapeau ───
  if (!QAISI_CLOSED.has(line.category)) {
    return { kind: "non_qualifying", reason: "Art. 3.3.3 closed list — category is not QAISI (a)–(e)" };
  }

  if (line.category === "bareboat_charter_third_party") {
    const b = line.bareboat;
    if (!b?.lesseeIsNonCeShippingEnterprise) {
      return { kind: "non_qualifying", reason: "Art. 3.3.3(a) / ¶163 — non-CE shipping enterprise lessee required" };
    }
    if (b.lesseeIsGroupCe) {
      return { kind: "non_qualifying", reason: "Art. 3.3.3(a) — group-CE lessee is Art. 3.3.2(d), not 3.3.3(a)" };
    }
    if (!bareboatWithinThreeYears(b)) {
      return { kind: "non_qualifying", reason: "Art. 3.3.3(a) / ¶164 — charter > 3 years incl. renewals (or duration missing)" };
    }
    const chapeau = qaisiChapeauFail(line);
    if (chapeau) return { kind: "non_qualifying", reason: chapeau };
    return { kind: "qaisi", reason: "Art. 3.3.3(a) third-party bareboat ≤ 3 years" };
  }

  if (line.category === "ticket_domestic_leg") {
    const t = line.ticket;
    if (!t?.issuedByOtherShippingEnterprise) {
      return {
        kind: "non_qualifying",
        reason: "Art. 3.3.3(b) — tickets must be issued by other shipping enterprises (own-ship tickets are 3.3.2(a))",
      };
    }
    if (t.domesticLegOfInternationalVoyage !== true) {
      return {
        kind: "non_qualifying",
        reason: "Art. 3.3.3(b) — must be domestic leg of an international voyage (purely domestic tickets fail)",
      };
    }
    const chapeau = qaisiChapeauFail(line);
    if (chapeau) return { kind: "non_qualifying", reason: chapeau };
    return { kind: "qaisi", reason: "Art. 3.3.3(b) other-enterprise domestic-leg tickets" };
  }

  if (line.category === "container_leasing") {
    if (line.containerStorageDays != null && line.containerStorageDays > 5) {
      return { kind: "non_qualifying", reason: "Commentary ¶166 — container storage beyond short-term (~5 days)" };
    }
    const chapeau = qaisiChapeauFail(line);
    if (chapeau) return { kind: "non_qualifying", reason: chapeau };
    return { kind: "qaisi", reason: "Art. 3.3.3(c) container leasing / short-term storage" };
  }

  if (line.category === "engineering_services") {
    const chapeau = qaisiChapeauFail(line);
    if (chapeau) return { kind: "non_qualifying", reason: chapeau };
    return { kind: "qaisi", reason: "Art. 3.3.3(d) engineering / related services" };
  }

  if (line.category === "ancillary_investment") {
    if (line.integralToShipOperations !== true) {
      return {
        kind: "non_qualifying",
        reason: "Art. 3.3.3(e) / ¶170 — integral to ship operations required (not group treasury)",
      };
    }
    const chapeau = qaisiChapeauFail(line);
    if (chapeau) return { kind: "non_qualifying", reason: chapeau };
    return { kind: "qaisi", reason: "Art. 3.3.3(e) investment income integral to ship operations" };
  }

  if (QISI_CATS.has(line.category)) return { kind: "qisi", reason: `Art. 3.3.2 — ${line.category}` };
  return { kind: "non_qualifying", reason: "Unrecognised shipping category" };
}

/**
 * Art. 3.3.5 ¶176 — allocate indirect costs by revenue ratio.
 * Example: ISI 80 + QAISI 20 + residual 20 = 120; indirect 30 → 20 / 5 / 5.
 */
export function allocateIndirectCosts(opts: {
  isiRevenue: number;
  qaisiRevenue: number;
  residualRevenue: number;
  indirectCosts: number;
}): IndirectAllocation {
  const totalRevenue = money(opts.isiRevenue + opts.qaisiRevenue + opts.residualRevenue);
  if (totalRevenue === 0 || opts.indirectCosts === 0) {
    return { isi: 0, qaisi: 0, residual: 0, totalRevenue };
  }
  const isi = money((opts.indirectCosts * opts.isiRevenue) / totalRevenue);
  const qaisi = money((opts.indirectCosts * opts.qaisiRevenue) / totalRevenue);
  // Residual takes the remainder so the pool fully allocates (rounding).
  const residual = money(opts.indirectCosts - isi - qaisi);
  return { isi, qaisi, residual, totalRevenue };
}

function lineRevenue(line: ShippingLine): number {
  return line.revenue != null ? line.revenue : line.amount;
}

function lineDirect(line: ShippingLine): number {
  if (line.revenue != null) return line.directCosts ?? 0;
  return 0;
}

function lineUsesGross(line: ShippingLine): boolean {
  return line.revenue != null;
}

export function qaisiCapOf(qisi: number): number {
  if (qisi <= 0) return 0;
  return money(qisi * 0.5);
}

export function managementTestPass(
  facts: Pick<ShippingFacts, "strategicManagementInCeJur" | "commercialManagementInCeJur">,
): boolean {
  return facts.strategicManagementInCeJur || facts.commercialManagementInCeJur;
}

type BuiltNets = {
  isiRevenue: number;
  qaisiRevenue: number;
  residualRevenue: number;
  isiDirect: number;
  qaisiDirect: number;
  residualDirect: number;
  indirect: IndirectAllocation;
  isiNet: number;
  qaisiNet: number;
  nonQNet: number;
  usedGrossEngine: boolean;
  rows: Array<{ line: ShippingLine; kind: ShippingLineKind; reason: string; netAfterCosts: number }>;
};

/**
 * Art. 3.3.5 — build net ISI / QAISI from gross revenue, direct costs, and
 * allocated indirect. Non-qualifying line nets stay in GloBE.
 */
export function buildShippingNets(pack: ShippingFacts): BuiltNets {
  let isiRevenue = 0;
  let qaisiRevenue = 0;
  let nonQRevenue = 0;
  let isiDirect = 0;
  let qaisiDirect = 0;
  let nonQDirect = 0;
  let usedGrossEngine = pack.indirectCosts > 0 || pack.lines.some(lineUsesGross);

  const classified = pack.lines.map((line) => {
    const c = classifyShippingLine(line);
    const rev = lineRevenue(line);
    const dir = lineDirect(line);
    if (c.kind === "qisi") {
      isiRevenue = money(isiRevenue + rev);
      isiDirect = money(isiDirect + dir);
    } else if (c.kind === "qaisi") {
      qaisiRevenue = money(qaisiRevenue + rev);
      qaisiDirect = money(qaisiDirect + dir);
    } else {
      nonQRevenue = money(nonQRevenue + rev);
      nonQDirect = money(nonQDirect + dir);
    }
    return { line, kind: c.kind, reason: c.reason, rev, dir };
  });

  const residualRevenue = money(pack.residualRevenue + nonQRevenue);
  const residualDirect = nonQDirect;
  const indirect = allocateIndirectCosts({
    isiRevenue,
    qaisiRevenue,
    residualRevenue,
    indirectCosts: pack.indirectCosts,
  });

  const isiNet = money(isiRevenue - isiDirect - indirect.isi);
  const qaisiNet = money(qaisiRevenue - qaisiDirect - indirect.qaisi);
  // Non-qualifying net after its share of residual indirect (allocated on residualRevenue bucket).
  // Split residual indirect between line non-Q revenue and pack.residualRevenue by revenue share.
  let nonQNet = money(nonQRevenue - nonQDirect);
  if (residualRevenue > 0 && nonQRevenue > 0) {
    const nonQShareOfResidualIndirect = money((indirect.residual * nonQRevenue) / residualRevenue);
    nonQNet = money(nonQNet - nonQShareOfResidualIndirect);
  }

  const rows = classified.map((row) => {
    let netAfterCosts = money(row.rev - row.dir);
    if (row.kind === "qisi" && isiRevenue > 0) {
      netAfterCosts = money(netAfterCosts - (indirect.isi * row.rev) / isiRevenue);
    } else if (row.kind === "qaisi" && qaisiRevenue > 0) {
      netAfterCosts = money(netAfterCosts - (indirect.qaisi * row.rev) / qaisiRevenue);
    } else if (row.kind === "non_qualifying" && residualRevenue > 0) {
      netAfterCosts = money(netAfterCosts - (indirect.residual * row.rev) / residualRevenue);
    }
    return { line: row.line, kind: row.kind, reason: row.reason, netAfterCosts: money(netAfterCosts) };
  });

  return {
    isiRevenue,
    qaisiRevenue,
    residualRevenue,
    isiDirect,
    qaisiDirect,
    residualDirect,
    indirect,
    isiNet,
    qaisiNet,
    nonQNet,
    usedGrossEngine,
    rows,
  };
}

/**
 * Art. 4.1.3(a) — associate Covered Taxes with excluded shipping.
 * Identifiable tax on excluded leaves ACT. Identifiable spill/residual stay.
 * Unidentifiable remainder prorated: excluded / (excluded + spill + residual) × pool,
 * where pool = current + deferred + otherCovered − identifiable buckets.
 */
export function art413aShippingReduction(opts: {
  incomeExcluded: number;
  spillNet: number;
  residualNet: number;
  currentTaxExpense: number;
  deferredTaxExpense: number;
  otherCovered: number;
  association: ShippingTaxAssociation;
}): {
  reduction: number;
  identifiableExcluded: number;
  identifiableSpill: number;
  identifiableResidual: number;
  unidentifiablePool: number;
  ratioShare: number;
  totalPool: number;
} {
  const assoc = opts.association;
  const identifiableExcluded = money(
    assoc.identifiableCurrentOnExcluded + assoc.identifiableDeferredOnExcluded,
  );
  const identifiableSpill = money(assoc.identifiableTaxOnSpill);
  const identifiableResidual = money(assoc.identifiableTaxOnResidual);
  const totalPool = money(opts.currentTaxExpense + opts.deferredTaxExpense + opts.otherCovered);
  const assigned = money(identifiableExcluded + identifiableSpill + identifiableResidual);
  const unidentifiablePool = money(Math.max(0, totalPool - assigned));

  const absEx = Math.abs(opts.incomeExcluded);
  const absSpill = Math.max(0, opts.spillNet);
  const absRes = Math.max(0, opts.residualNet);
  const ratioBase = money(absEx + absSpill + absRes);

  let ratioShare = 0;
  if (unidentifiablePool !== 0 && ratioBase !== 0 && absEx !== 0) {
    ratioShare = money((unidentifiablePool * absEx) / ratioBase);
    if (opts.incomeExcluded < 0) ratioShare = money(-ratioShare);
  }

  const reduction = money(identifiableExcluded + ratioShare);
  return {
    reduction,
    identifiableExcluded,
    identifiableSpill,
    identifiableResidual,
    unidentifiablePool,
    ratioShare,
    totalPool,
  };
}

/**
 * Build Art. 4.1.3(a) association from engine-readable line tax facts and
 * FINANCIALS pool totals. Pack-asserted “identifiable on shipping” labels are
 * not accepted — only `line.currentTax` / `line.deferredTax` (or derivation
 * from 3.3.5 net × CE `shippingActivityTaxRate` when that rate is provided).
 *
 * When line tax facts (or a CE shipping rate) exist, FINANCIALS tax not on any
 * line stays as residual (in ACT). When no identification facts exist, the
 * pool remains unidentifiable and the excluded/spill/residual ratio applies.
 */
export function buildTaxAssociationFromLines(opts: {
  lines: Array<{
    treatedAs: ShippingLineTreatment;
    netAfterCosts: number;
    currentTax?: number;
    deferredTax?: number;
  }>;
  currentTaxExpense: number;
  deferredTaxExpense: number;
  otherCovered: number;
  shippingActivityTaxRate?: number;
}): ShippingTaxAssociation {
  let identifiableCurrentOnExcluded = 0;
  let identifiableDeferredOnExcluded = 0;
  let identifiableTaxOnSpill = 0;
  let identifiableTaxOnResidual = 0;
  let lineTaxTotal = 0;

  const rate = opts.shippingActivityTaxRate;
  // Derive only when the CE supplies its actual shipping-activity rate as a fact.
  // The engine never invents a hardcoded 15% (or any other) rate.
  const derive = rate != null && Number.isFinite(rate) && rate !== 0;
  const anyLineTaxFact = opts.lines.some(
    (l) => (l.currentTax != null && l.currentTax !== 0) || (l.deferredTax != null && l.deferredTax !== 0),
  );

  for (const line of opts.lines) {
    let cur = line.currentTax ?? 0;
    let def = line.deferredTax ?? 0;
    if (
      cur === 0 &&
      def === 0 &&
      derive &&
      (line.treatedAs === "excluded_qisi" ||
        line.treatedAs === "excluded_qaisi" ||
        line.treatedAs === "capped_out" ||
        line.treatedAs === "non_qualifying")
    ) {
      cur = money(line.netAfterCosts * (rate as number));
    }
    const lineTax = money(cur + def);
    lineTaxTotal = money(lineTaxTotal + lineTax);

    if (line.treatedAs === "excluded_qisi" || line.treatedAs === "excluded_qaisi") {
      identifiableCurrentOnExcluded = money(identifiableCurrentOnExcluded + cur);
      identifiableDeferredOnExcluded = money(identifiableDeferredOnExcluded + def);
    } else if (line.treatedAs === "capped_out") {
      identifiableTaxOnSpill = money(identifiableTaxOnSpill + lineTax);
    } else if (line.treatedAs === "non_qualifying" || line.treatedAs === "kept_management_fail") {
      identifiableTaxOnResidual = money(identifiableTaxOnResidual + lineTax);
    }
  }

  const pool = money(opts.currentTaxExpense + opts.deferredTaxExpense + opts.otherCovered);
  const unassigned = money(Math.max(0, pool - lineTaxTotal));
  // Identification facts present → unassigned FINANCIALS = residual non-shipping (stays in ACT).
  // No identification facts → leave unassigned unidentifiable for the ratio.
  if ((anyLineTaxFact || derive) && unassigned !== 0) {
    identifiableTaxOnResidual = money(identifiableTaxOnResidual + unassigned);
  }

  return {
    identifiableCurrentOnExcluded,
    identifiableDeferredOnExcluded,
    identifiableTaxOnSpill,
    identifiableTaxOnResidual,
  };
}

/** @deprecated current-only proxy — kept for Example 4.1.3-1 dividend teaching only. */
export function art413aReduction(incomeExcluded: number, taxableIncome: number, currentTaxExpense: number): number {
  if (incomeExcluded === 0 || taxableIncome === 0) return 0;
  return money((incomeExcluded / taxableIncome) * currentTaxExpense);
}

export function jurisdictionalQaisiCap(
  ceJurisdiction: string,
  allPacks: ShippingFacts[] = SHIPPING_PACKS,
): { jurisdictionQisi: number; jurisdictionQaisi: number; cap: number } {
  let jurisdictionQisi = 0;
  let jurisdictionQaisi = 0;
  for (const p of allPacks.filter((x) => x.ceJurisdiction === ceJurisdiction)) {
    if (!managementTestPass(p)) continue;
    const n = buildShippingNets(p);
    jurisdictionQisi = money(jurisdictionQisi + n.isiNet);
    jurisdictionQaisi = money(jurisdictionQaisi + n.qaisiNet);
  }
  return { jurisdictionQisi, jurisdictionQaisi, cap: qaisiCapOf(jurisdictionQisi) };
}

/** Live Aetherion seed — gross Art. 3.3.5 lines (nets reconcile to FANIL 8.9m).
 * Art. 4.1.3(a) taxes are on lines + FINANCIALS pool (currentTaxExpense/deferredTaxExpense
 * mirror FINANCIALS for SG-SHIP) — no pack-asserted identifiable label.
 */
export const SHIPPING_PACKS: ShippingFacts[] = [
  {
    entityId: "SG-SHIP",
    ceJurisdiction: "SG",
    strategicManagementInCeJur: true,
    commercialManagementInCeJur: true,
    indirectCosts: 0,
    residualRevenue: 500_000,
    currentTaxExpense: 1_120_000,
    deferredTaxExpense: 40_000,
    otherCovered: 0,
    taxableIncome: 8_900_000,
    sourceDoc: "SG-SHIP shipping P&L FY2026.xlsx",
    lines: [
      {
        id: "SH-01",
        kind: "qisi",
        category: "international_transport",
        amount: 5_200_000,
        revenue: 9_000_000,
        directCosts: 3_800_000,
        currentTax: 650_000,
        deferredTax: 22_000,
        flagJurisdiction: "LR",
        voyage: { solelyDomesticPlaces: false, inlandWaterwaysSameJurisdiction: false },
        notes: "Art. 3.3.2(a) · gross 9.0 − direct 3.8",
      },
      {
        id: "SH-02",
        kind: "qaisi",
        category: "bareboat_charter_third_party",
        amount: 800_000,
        revenue: 1_200_000,
        directCosts: 400_000,
        currentTax: 100_000,
        deferredTax: 3_000,
        flagJurisdiction: "SG",
        primarilyInConnectionWithInternationalTraffic: true,
        bareboat: {
          lesseeIsNonCeShippingEnterprise: true,
          lesseeIsGroupCe: false,
          charterYears: 2,
          relatedCharterYears: 0,
        },
        notes: "Art. 3.3.3(a) third-party bareboat · 2 years",
      },
      {
        id: "SH-03",
        kind: "qaisi",
        category: "container_leasing",
        amount: 1_400_000,
        revenue: 2_000_000,
        directCosts: 600_000,
        currentTax: 100_000,
        deferredTax: 3_000,
        primarilyInConnectionWithInternationalTraffic: true,
        containerStorageDays: 4,
        notes: "Art. 3.3.3(c) containers · ¶166 short-term storage",
      },
      {
        id: "SH-04",
        kind: "non_qualifying",
        category: "inland_transport",
        amount: 400_000,
        revenue: 700_000,
        directCosts: 300_000,
        currentTax: 80_000,
        deferredTax: 5_000,
        qualifies: false,
        notes: "Commentary ¶171 — inland haulage not QAISI",
      },
      {
        id: "SH-05",
        kind: "qisi",
        category: "ship_sale",
        amount: 600_000,
        revenue: 600_000,
        directCosts: 0,
        currentTax: 50_000,
        deferredTax: 2_000,
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

/** OECD Example 3.3.1-n — nets only (no Art. 3.3.5 gross; examples publish nets). */
export function example331Facts(opts: {
  entityId?: string;
  fanil: number;
  otherIncome: number;
  qisi: number;
  qaisi: number;
  currentTaxExpense?: number;
  deferredTaxExpense?: number;
  otherCovered?: number;
  taxableIncome?: number;
  shippingActivityTaxRate?: number;
  qaisiLineTax?: { currentTax?: number; deferredTax?: number };
  qisiLineTax?: { currentTax?: number; deferredTax?: number };
}): ShippingFacts {
  void opts.otherIncome;
  return {
    entityId: opts.entityId ?? "EX-331",
    ceJurisdiction: "EX",
    strategicManagementInCeJur: true,
    commercialManagementInCeJur: true,
    indirectCosts: 0,
    residualRevenue: 0,
    currentTaxExpense: opts.currentTaxExpense ?? 0,
    deferredTaxExpense: opts.deferredTaxExpense ?? 0,
    otherCovered: opts.otherCovered ?? 0,
    taxableIncome: opts.taxableIncome ?? opts.fanil,
    shippingActivityTaxRate: opts.shippingActivityTaxRate,
    sourceDoc: "OECD Illustrative Examples Art. 3.3.1",
    lines: [
      {
        id: "ex-qisi",
        kind: "qisi",
        category: "international_transport",
        amount: opts.qisi,
        voyage: { solelyDomesticPlaces: false },
        currentTax: opts.qisiLineTax?.currentTax,
        deferredTax: opts.qisiLineTax?.deferredTax,
      },
      {
        id: "ex-qaisi",
        kind: "qaisi",
        category: "container_leasing",
        amount: opts.qaisi,
        primarilyInConnectionWithInternationalTraffic: true,
        currentTax: opts.qaisiLineTax?.currentTax,
        deferredTax: opts.qaisiLineTax?.deferredTax,
      },
    ],
  };
}

/**
 * Commentary ¶179 fixture — ISI rev 200 / costs 130 → 70; QAISI rev 100 / costs 60 → 40;
 * spill 5; FANIL 110; exclude 105 → GloBE 5. Costs on spill stay in GloBE (¶178).
 */
export function commentary179Facts(): ShippingFacts {
  return {
    entityId: "EX-179",
    ceJurisdiction: "EX",
    strategicManagementInCeJur: true,
    commercialManagementInCeJur: false,
    indirectCosts: 0,
    residualRevenue: 0,
    currentTaxExpense: 0,
    deferredTaxExpense: 0,
    otherCovered: 0,
    taxableIncome: 110,
    sourceDoc: "Commentary ¶179",
    lines: [
      {
        id: "isi",
        kind: "qisi",
        category: "international_transport",
        amount: 70,
        revenue: 200,
        directCosts: 130,
        voyage: { solelyDomesticPlaces: false },
      },
      {
        id: "qaisi",
        kind: "qaisi",
        category: "container_leasing",
        amount: 40,
        revenue: 100,
        directCosts: 60,
        primarilyInConnectionWithInternationalTraffic: true,
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
  const built = buildShippingNets(pack);
  const qisiGross = built.isiNet;
  const qaisiGross = built.qaisiNet;
  const nonQualifyingKept = built.nonQNet;

  const annotated: ShippingResult["lines"] = built.rows.map((r) => ({
    ...r.line,
    kind: r.kind,
    treatedAs: (r.kind === "non_qualifying" ? "non_qualifying" : r.kind === "qisi" ? "excluded_qisi" : "excluded_qaisi") as ShippingLineTreatment,
    classifiedAs: r.kind,
    netAfterCosts: r.netAfterCosts,
    notes: r.line.notes ? `${r.line.notes} · ${r.reason}` : r.reason,
  }));

  const { cap: qaisiCap, jurisdictionQisi } = jurisdictionalQaisiCap(pack.ceJurisdiction, peerUniverse);

  const emptyTax = {
    identifiableExcluded: 0,
    identifiableSpill: 0,
    identifiableResidual: 0,
    unidentifiablePool: 0,
    ratioShare: 0,
    totalPool: money(pack.currentTaxExpense + pack.deferredTaxExpense + pack.otherCovered),
  };

  const costBlock = {
    isiRevenue: built.isiRevenue,
    qaisiRevenue: built.qaisiRevenue,
    residualRevenue: built.residualRevenue,
    isiDirect: built.isiDirect,
    qaisiDirect: built.qaisiDirect,
    residualDirect: built.residualDirect,
    indirect: built.indirect,
    isiNet: built.isiNet,
    qaisiNet: built.qaisiNet,
    usedGrossEngine: built.usedGrossEngine,
  };

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
      cost: costBlock,
      tax: emptyTax,
      lines: annotated.map((l) => ({
        ...l,
        treatedAs: l.classifiedAs === "non_qualifying" ? "non_qualifying" : "kept_management_fail",
      })),
      detail: `${why} No Art. 3.3.1 exclusion; no Art. 4.1.3(a) reduction.`,
      ruleId: "OECD-SHIP-33",
    };
  }

  const peersPassing = peerUniverse.filter((p) => p.ceJurisdiction === pack.ceJurisdiction && managementTestPass(p));
  const jurQaisiPositive = money(
    peersPassing.reduce((a, p) => a + Math.max(0, buildShippingNets(p).qaisiNet), 0),
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
    qaisiExcludedSigned = qaisiGross; // Example 3.3.1-3
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

  // Residual net for tax association: non-qualifying shipping + pack residual after its costs.
  // Pack residual revenue share of indirect already in residual bucket; net residual income
  // ≈ taxableIncome − isiNet − qaisiNet when taxableIncome tracks FANIL (seed).
  const residualForTax = money(
    Math.max(0, pack.taxableIncome - qisiGross - qaisiGross),
  );

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
    if (qaisiGross < 0) {
      linesOut.push({ ...line, treatedAs: "excluded_qaisi" });
      continue;
    }
    if (qaisiExcludedSigned <= 0) {
      linesOut.push({ ...line, treatedAs: "capped_out" });
      continue;
    }
    const lineNet = line.netAfterCosts;
    if (lineNet <= 0) {
      linesOut.push({ ...line, treatedAs: "excluded_qaisi" });
      continue;
    }
    const room = money(qaisiExcludedSigned - qaisiRunning);
    if (room <= 0) {
      linesOut.push({ ...line, treatedAs: "capped_out" });
    } else if (lineNet <= room) {
      qaisiRunning = money(qaisiRunning + lineNet);
      linesOut.push({ ...line, treatedAs: "excluded_qaisi" });
    } else {
      qaisiRunning = qaisiExcludedSigned;
      linesOut.push({
        ...line,
        treatedAs: "capped_out",
        notes: `${line.notes ?? ""} · Art. 3.3.4 spill — costs on spill stay in GloBE (¶178)`.trim(),
      });
    }
  }

  // Art. 4.1.3(a) — association from line/FINANCIALS facts only (no pack-asserted IDs).
  const association = buildTaxAssociationFromLines({
    lines: linesOut,
    currentTaxExpense: pack.currentTaxExpense,
    deferredTaxExpense: pack.deferredTaxExpense,
    otherCovered: pack.otherCovered,
    shippingActivityTaxRate: pack.shippingActivityTaxRate,
  });

  const tax = art413aShippingReduction({
    incomeExcluded,
    spillNet: qaisiCappedOut,
    residualNet: residualForTax,
    currentTaxExpense: pack.currentTaxExpense,
    deferredTaxExpense: pack.deferredTaxExpense,
    otherCovered: pack.otherCovered,
    association,
  });

  const flagNote = pack.lines.some((l) => l.flagJurisdiction && l.flagJurisdiction !== pack.ceJurisdiction)
    ? " Flag ≠ CE location — Art. 3.3.6 looks to management (¶182)."
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
    coveredTaxExcluded: tax.reduction,
    nonQualifyingKept,
    cost: costBlock,
    tax: {
      identifiableExcluded: tax.identifiableExcluded,
      identifiableSpill: tax.identifiableSpill,
      identifiableResidual: tax.identifiableResidual,
      unidentifiablePool: tax.unidentifiablePool,
      ratioShare: tax.ratioShare,
      totalPool: tax.totalPool,
    },
    lines: linesOut,
    detail: `Art. 3.3.1 exclusion — QISI ${qisiExcluded.toLocaleString("en-GB")} + QAISI ${qaisiExcludedSigned.toLocaleString("en-GB")} (Art. 3.3.4 cap ${qaisiCap.toLocaleString("en-GB")}; spill ${qaisiCappedOut.toLocaleString("en-GB")} stays in GloBE with its costs ¶178). Art. 3.3.5 nets from gross/direct/indirect. Art. 3.3.6 OR management passes. Art. 4.1.3(a) reduction ${tax.reduction.toLocaleString("en-GB")} (identifiable excluded ${tax.identifiableExcluded.toLocaleString("en-GB")} + ratio ${tax.ratioShare.toLocaleString("en-GB")}; spill tax ${tax.identifiableSpill.toLocaleString("en-GB")} and residual tax ${tax.identifiableResidual.toLocaleString("en-GB")} stay in ACT — association from line/FINANCIALS facts).${flagNote}`,
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

/**
 * OECD GloBE Model Rules — Article 3.3 International Shipping Income.
 *
 * Pure classification / exclusion module. Hooked from `entityGlobe` /
 * `entityCovered` in lib/engine.ts. Does not invent a parallel tax engine.
 *
 * Coverage claimed only where tests in scripts/test-shipping.ts assert it.
 */

import { money } from "./format";

/** Art. 3.3.2 — Qualified International Shipping Income categories. */
export type QisiCategory =
  | "international_transport"
  | "bareboat_charter"
  | "slot_charter"
  | "pool_joint_agency"
  | "ship_sale";

/** Art. 3.3.3 — Qualified Ancillary International Shipping Income categories. */
export type QaisiCategory =
  | "inland_transport"
  | "container_leasing"
  | "engineering_services"
  | "other_ancillary";

export type ShippingLine = {
  id: string;
  kind: "qisi" | "qaisi";
  category: QisiCategory | QaisiCategory;
  /** Net amount included in FANIL (profit positive, loss negative). */
  amount: number;
  /**
   * Ship flag jurisdiction (ISO). Flag ≠ CE location does not by itself
   * disqualify — Art. 3.3.4 tests strategic / commercial management.
   */
  flagJurisdiction?: string;
  /**
   * Ship-sale / bareboat eligibility gate. When false the line is
   * non-qualifying and stays in GloBE Income.
   */
  qualifies?: boolean;
  notes?: string;
};

export type ShippingFacts = {
  entityId: string;
  /** Jurisdiction where the Constituent Entity is located (Art. 10.1). */
  ceJurisdiction: string;
  /** Art. 3.3.4 — strategic management of the ships in the CE jurisdiction. */
  strategicManagementInCeJur: boolean;
  /** Art. 3.3.4 — commercial management of the ships in the CE jurisdiction. */
  commercialManagementInCeJur: boolean;
  /**
   * Art. 3.3.1 election — CE may exclude QISI / QAISI.
   * When false, income and attributable Covered Taxes stay in the calc.
   */
  electExclusion: boolean;
  lines: ShippingLine[];
  /**
   * Covered Taxes attributable to the shipping income that would be
   * excluded (Commentary to Art. 3.3 / Art. 4 interaction). Excluded from
   * Adjusted Covered Taxes only when the income exclusion applies.
   */
  coveredTaxesOnShipping: number;
  sourceDoc: string;
};

export type ShippingResult = {
  entityId: string;
  elected: boolean;
  managementPass: boolean;
  disqualified: boolean;
  disqualifyReason: string;
  qisiGross: number;
  qaisiGross: number;
  qaisiCap: number;
  qaisiExcluded: number;
  qaisiCappedOut: number;
  qisiExcluded: number;
  /** Total shipping income/loss excluded from GloBE (before sign for delta). */
  incomeExcluded: number;
  /** Delta applied to GloBE Income: −incomeExcluded. */
  globeDelta: number;
  /** Covered Taxes stripped from Adjusted Covered Taxes. */
  coveredTaxExcluded: number;
  nonQualifyingKept: number;
  lines: Array<ShippingLine & { treatedAs: "excluded_qisi" | "excluded_qaisi" | "capped_out" | "non_qualifying" | "kept_no_election" | "kept_management_fail" }>;
  detail: string;
  ruleId: "OECD-SHIP-33";
};

const QISI_CATS: ReadonlySet<string> = new Set([
  "international_transport",
  "bareboat_charter",
  "slot_charter",
  "pool_joint_agency",
  "ship_sale",
]);

const QAISI_CATS: ReadonlySet<string> = new Set([
  "inland_transport",
  "container_leasing",
  "engineering_services",
  "other_ancillary",
]);

/** Live Aetherion teaching pack — Singapore maritime CE (SG-SHIP). */
export const SHIPPING_PACKS: ShippingFacts[] = [
  {
    entityId: "SG-SHIP",
    ceJurisdiction: "SG",
    strategicManagementInCeJur: true,
    commercialManagementInCeJur: true,
    electExclusion: true,
    coveredTaxesOnShipping: 1_050_000,
    sourceDoc: "SG-SHIP shipping P&L FY2026.xlsx",
    lines: [
      {
        id: "SH-01",
        kind: "qisi",
        category: "international_transport",
        amount: 5_200_000,
        flagJurisdiction: "LR",
        qualifies: true,
        notes: "Time-charter earnings · international traffic · Liberian flag; management in Singapore",
      },
      {
        id: "SH-02",
        kind: "qisi",
        category: "bareboat_charter",
        amount: 800_000,
        flagJurisdiction: "SG",
        qualifies: true,
        notes: "Bareboat lease to third-party operator used in international traffic",
      },
      {
        id: "SH-03",
        kind: "qaisi",
        category: "container_leasing",
        amount: 1_400_000,
        qualifies: true,
        notes: "Container leasing ancillary to the shipping enterprise",
      },
      {
        id: "SH-04",
        kind: "qaisi",
        category: "inland_transport",
        amount: 400_000,
        qualifies: true,
        notes: "Inland haulage to/from the ocean leg",
      },
      {
        id: "SH-05",
        kind: "qisi",
        category: "ship_sale",
        amount: 600_000,
        flagJurisdiction: "LR",
        qualifies: true,
        notes: "Gain on sale of a ship used in international shipping (holding-period gate passed)",
      },
    ],
  },
];

export function shippingFactsFor(entityId: string): ShippingFacts | undefined {
  return SHIPPING_PACKS.find((p) => p.entityId === entityId);
}

function lineQualifies(line: ShippingLine): boolean {
  if (line.qualifies === false) return false;
  if (line.kind === "qisi") return QISI_CATS.has(line.category);
  if (line.kind === "qaisi") return QAISI_CATS.has(line.category);
  return false;
}

/**
 * Art. 3.3.3 — QAISI of a Constituent Entity shall not exceed 50% of that
 * CE's QISI. If QISI ≤ 0, no QAISI may be excluded.
 */
export function qaisiCapOf(qisi: number): number {
  if (qisi <= 0) return 0;
  return money(qisi * 0.5);
}

/**
 * Compute Art. 3.3 exclusion for one Constituent Entity.
 * Pass `facts` directly for tests; otherwise loads SHIPPING_PACKS.
 */
export function computeShippingExclusion(
  entityId: string,
  facts?: ShippingFacts,
  opts?: { electOverride?: boolean },
): ShippingResult | null {
  const pack = facts ?? shippingFactsFor(entityId);
  if (!pack) return null;

  const elected = opts?.electOverride ?? pack.electExclusion;
  const managementPass = pack.strategicManagementInCeJur && pack.commercialManagementInCeJur;

  const annotated: ShippingResult["lines"] = [];
  let qisiGross = 0;
  let qaisiGross = 0;
  let nonQualifyingKept = 0;

  for (const line of pack.lines) {
    if (!lineQualifies(line)) {
      nonQualifyingKept = money(nonQualifyingKept + line.amount);
      annotated.push({ ...line, treatedAs: "non_qualifying" });
      continue;
    }
    if (line.kind === "qisi") {
      qisiGross = money(qisiGross + line.amount);
      annotated.push({ ...line, treatedAs: "excluded_qisi" });
    } else {
      qaisiGross = money(qaisiGross + line.amount);
      annotated.push({ ...line, treatedAs: "excluded_qaisi" });
    }
  }

  const empty = (extra: Partial<ShippingResult>): ShippingResult => ({
    entityId: pack.entityId,
    elected,
    managementPass,
    disqualified: !managementPass,
    disqualifyReason: "",
    qisiGross,
    qaisiGross,
    qaisiCap: qaisiCapOf(qisiGross),
    qaisiExcluded: 0,
    qaisiCappedOut: 0,
    qisiExcluded: 0,
    incomeExcluded: 0,
    globeDelta: 0,
    coveredTaxExcluded: 0,
    nonQualifyingKept,
    lines: annotated.map((l) => ({
      ...l,
      treatedAs:
        l.treatedAs === "non_qualifying"
          ? "non_qualifying"
          : !elected
            ? "kept_no_election"
            : !managementPass
              ? "kept_management_fail"
              : l.treatedAs,
    })),
    detail: "",
    ruleId: "OECD-SHIP-33",
    ...extra,
  });

  if (!elected) {
    return empty({
      disqualified: false,
      detail: "Art. 3.3 not elected — QISI / QAISI remain in GloBE Income; Covered Taxes on shipping remain in Adjusted Covered Taxes.",
      lines: annotated.map((l) => ({
        ...l,
        treatedAs: l.treatedAs === "non_qualifying" ? "non_qualifying" : "kept_no_election",
      })),
    });
  }

  if (!managementPass) {
    const why =
      !pack.strategicManagementInCeJur && !pack.commercialManagementInCeJur
        ? "Strategic and commercial management are not exercised in the CE jurisdiction (Art. 3.3.4)."
        : !pack.strategicManagementInCeJur
          ? "Strategic management is not exercised in the CE jurisdiction (Art. 3.3.4)."
          : "Commercial management is not exercised in the CE jurisdiction (Art. 3.3.4).";
    return empty({
      disqualified: true,
      disqualifyReason: why,
      detail: `${why} Entire shipping income stays in GloBE Income; no Covered Tax exclusion.`,
      lines: annotated.map((l) => ({
        ...l,
        treatedAs: l.treatedAs === "non_qualifying" ? "non_qualifying" : "kept_management_fail",
      })),
    });
  }

  const qaisiCap = qaisiCapOf(qisiGross);
  const qaisiExcluded = money(Math.min(Math.max(0, qaisiGross), qaisiCap));
  // Cap applies to positive QAISI only; negative QAISI (ancillary loss) is
  // excluded in full when QISI > 0 and management passes (Model Rules: exclude QAISI subject to the 50% ceiling on the positive amount).
  let qaisiExcludedSigned = 0;
  let qaisiCappedOut = 0;
  if (qaisiGross <= 0) {
    qaisiExcludedSigned = qaisiGross; // loss: exclude in full when management + election pass and QISI path open
    // Art. 3.3.3 ceiling is on the amount of QAISI; a loss does not consume the cap.
    if (qisiGross <= 0) {
      // No positive QISI → no QAISI exclusion (including ancillary losses stay in GloBE).
      qaisiExcludedSigned = 0;
      qaisiCappedOut = qaisiGross;
    }
  } else {
    qaisiExcludedSigned = qaisiExcluded;
    qaisiCappedOut = money(Math.max(0, qaisiGross - qaisiCap));
  }

  const qisiExcluded = qisiGross;
  const incomeExcluded = money(qisiExcluded + qaisiExcludedSigned);
  const globeDelta = money(-incomeExcluded);
  const coveredTaxExcluded = incomeExcluded !== 0 ? money(pack.coveredTaxesOnShipping) : 0;

  // Re-annotate QAISI lines for cap spill
  const linesOut: ShippingResult["lines"] = [];
  let qaisiRunning = 0;
  for (const line of annotated) {
    if (line.treatedAs === "non_qualifying") {
      linesOut.push(line);
      continue;
    }
    if (line.kind === "qisi") {
      linesOut.push({ ...line, treatedAs: "excluded_qisi" });
      continue;
    }
    // qaisi
    if (qisiGross <= 0) {
      linesOut.push({ ...line, treatedAs: "capped_out" });
      continue;
    }
    if (line.amount <= 0) {
      linesOut.push({ ...line, treatedAs: "excluded_qaisi" });
      continue;
    }
    const room = money(qaisiCap - qaisiRunning);
    if (room <= 0) {
      linesOut.push({ ...line, treatedAs: "capped_out" });
    } else if (line.amount <= room) {
      qaisiRunning = money(qaisiRunning + line.amount);
      linesOut.push({ ...line, treatedAs: "excluded_qaisi" });
    } else {
      // Partial cap — mark capped_out for the spill; excluded amount tracked in totals.
      qaisiRunning = qaisiCap;
      linesOut.push({
        ...line,
        treatedAs: "capped_out",
        notes: `${line.notes ?? ""} · Art. 3.3.3 50% QISI cap — ${room.toLocaleString("en-GB")} of ${line.amount.toLocaleString("en-GB")} excluded`.trim(),
      });
    }
  }

  const flagNote = pack.lines.some(
    (l) => l.flagJurisdiction && l.flagJurisdiction !== pack.ceJurisdiction,
  )
    ? " Flag jurisdiction differs from CE location on one or more ships — management test still passes."
    : "";

  return {
    entityId: pack.entityId,
    elected: true,
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
    detail: `Art. 3.3 — QISI ${qisiExcluded.toLocaleString("en-GB")} + QAISI ${qaisiExcludedSigned.toLocaleString("en-GB")} (cap ${qaisiCap.toLocaleString("en-GB")} = 50% of QISI) excluded from GloBE. Covered Taxes on shipping ${coveredTaxExcluded.toLocaleString("en-GB")} excluded from Adjusted Covered Taxes.${flagNote}`,
    ruleId: "OECD-SHIP-33",
  };
}

/** Globe-income delta for the engine (0 when no pack / no exclusion). */
export function shippingGlobeDelta(entityId: string): number {
  return computeShippingExclusion(entityId)?.globeDelta ?? 0;
}

/** Covered-tax reduction for the engine. */
export function shippingCoveredTaxExcluded(entityId: string): number {
  return computeShippingExclusion(entityId)?.coveredTaxExcluded ?? 0;
}

/** Build an Adjustment-shaped row for the GloBE income waterfall UI. */
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
  if (!r.elected || r.disqualified) {
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
  if (r.globeDelta === 0 && r.incomeExcluded === 0) return null;
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

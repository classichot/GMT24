/**
 * OECD GloBE Model Rules — Article 3.3 International Shipping Income.
 *
 * Legal anchors (Model Rules + Commentary 2022 / Consolidated Commentary):
 * - Art. 3.3.1 — International Shipping Income and QAISI **shall** be excluded
 *   (mandatory; not an election). Losses likewise excluded.
 * - Art. 3.3.2 — International Shipping Income (QISI) categories (a)–(f).
 *   Bareboat-out is QISI only when the lessee is another Constituent Entity
 *   of the same MNE Group with International Shipping Income (Art. 3.3.2(d);
 *   Commentary ¶157). Third-party bareboat-out is **not** QISI.
 * - Art. 3.3.3 — Qualified Ancillary International Shipping Income (QAISI).
 *   Third-party bareboat-out ≤ 3 years is QAISI (Art. 3.3.3(a); ¶163–164).
 *   Inland transportation is **not** QAISI (Commentary ¶171) — remains in GloBE.
 * - Art. 3.3.4 — Aggregated QAISI of all CEs in a jurisdiction shall not exceed
 *   50% of those CEs’ International Shipping Income (jurisdictional cap; ¶172–173).
 * - Art. 3.3.6 — Strategic **or** commercial management of all ships concerned
 *   must be effectively carried on from within the CE’s jurisdiction (OR test;
 *   Commentary ¶180–182). Flag alone is not determinative (¶182).
 *
 * Hooked from entityGlobe / entityCovered in lib/engine.ts.
 * Coverage claimed only where scripts/test-shipping.ts asserts it.
 */

import { money } from "./format";

/** Art. 3.3.2 — International Shipping Income categories. */
export type QisiCategory =
  | "international_transport" // 3.3.2(a)/(b) carriage in international traffic
  | "bareboat_charter_intragroup" // 3.3.2(d) lessor → other CE of same group
  | "slot_charter" // 3.3.2 slot / capacity arrangements in international traffic
  | "pool_joint_agency" // 3.3.2(e)/(f) pool, joint business, international operating agency
  | "ship_sale"; // 3.3.2 sale of a ship used for international shipping

/**
 * Art. 3.3.3 — Qualified Ancillary categories.
 * Inland haulage is intentionally absent — Commentary ¶171 excludes it from QAISI.
 */
export type QaisiCategory =
  | "bareboat_charter_third_party" // 3.3.3(a) lessor → non-CE shipping enterprise, ≤ 3 years
  | "ticket_domestic_leg" // 3.3.3(b)
  | "container_leasing" // 3.3.3(c) leasing / short-term storage of containers
  | "engineering_services" // 3.3.3(d) engineers, cargo handlers, etc. to other shipping enterprises
  | "ancillary_investment"; // 3.3.3(e)

/** Income that appears in a shipping P&L but is not QISI/QAISI under Art. 3.3. */
export type NonQualifyingShippingCategory =
  | "inland_transport" // Commentary ¶171 — not QAISI; stays in GloBE Income
  | "bareboat_charter_third_party_long" // 3.3.3(a) fails 3-year limit
  | "other_non_qualifying";

export type ShippingLineKind = "qisi" | "qaisi" | "non_qualifying";

export type ShippingLine = {
  id: string;
  kind: ShippingLineKind;
  category: QisiCategory | QaisiCategory | NonQualifyingShippingCategory;
  /** Net amount included in FANIL (profit positive, loss negative). */
  amount: number;
  /**
   * Ship flag jurisdiction (ISO). Flag ≠ CE location does not by itself
   * disqualify — Art. 3.3.6 tests strategic **or** commercial management.
   */
  flagJurisdiction?: string;
  /**
   * Fact gate (e.g. ship-sale holding period / use history, or 3.3.3(a) ≤3-year).
   * When false the line is non-qualifying and stays in GloBE Income.
   */
  qualifies?: boolean;
  notes?: string;
};

export type ShippingFacts = {
  entityId: string;
  /** Jurisdiction where the Constituent Entity is located (Art. 10.1). */
  ceJurisdiction: string;
  /** Art. 3.3.6 — strategic management effectively carried on in the CE jurisdiction. */
  strategicManagementInCeJur: boolean;
  /** Art. 3.3.6 — commercial management effectively carried on in the CE jurisdiction. */
  commercialManagementInCeJur: boolean;
  lines: ShippingLine[];
  /**
   * Covered Taxes attributable to the shipping income that is excluded
   * (Commentary to Art. 3.3 ↔ Art. 4). Leaves Adjusted Covered Taxes only when
   * the income exclusion applies under Art. 3.3.1 / 3.3.6.
   */
  coveredTaxesOnShipping: number;
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
  /** Art. 3.3.6 — strategic OR commercial management in the CE jurisdiction. */
  managementPass: boolean;
  disqualified: boolean;
  disqualifyReason: string;
  qisiGross: number;
  qaisiGross: number;
  /** Art. 3.3.4 jurisdictional cap = 50% × jurisdiction QISI. */
  qaisiCap: number;
  qaisiExcluded: number;
  qaisiCappedOut: number;
  qisiExcluded: number;
  incomeExcluded: number;
  globeDelta: number;
  coveredTaxExcluded: number;
  nonQualifyingKept: number;
  lines: Array<ShippingLine & { treatedAs: ShippingLineTreatment }>;
  detail: string;
  ruleId: "OECD-SHIP-33";
};

const QISI_CATS: ReadonlySet<string> = new Set([
  "international_transport",
  "bareboat_charter_intragroup",
  "slot_charter",
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

/** Live Aetherion seed — Singapore maritime CE (SG-SHIP). */
export const SHIPPING_PACKS: ShippingFacts[] = [
  {
    entityId: "SG-SHIP",
    ceJurisdiction: "SG",
    strategicManagementInCeJur: true,
    commercialManagementInCeJur: true,
    coveredTaxesOnShipping: 1_000_000,
    sourceDoc: "SG-SHIP shipping P&L FY2026.xlsx",
    lines: [
      {
        id: "SH-01",
        kind: "qisi",
        category: "international_transport",
        amount: 5_200_000,
        flagJurisdiction: "LR",
        qualifies: true,
        notes: "Time-charter earnings · international traffic · Liberian flag; commercial management in Singapore (Art. 3.3.6)",
      },
      {
        id: "SH-02",
        kind: "qaisi",
        category: "bareboat_charter_third_party",
        amount: 800_000,
        flagJurisdiction: "SG",
        qualifies: true,
        notes: "Bareboat-out to third-party shipping enterprise ≤ 3 years — QAISI Art. 3.3.3(a), not QISI (¶163)",
      },
      {
        id: "SH-03",
        kind: "qaisi",
        category: "container_leasing",
        amount: 1_400_000,
        qualifies: true,
        notes: "Container leasing / short-term storage — Art. 3.3.3(c)",
      },
      {
        id: "SH-04",
        kind: "non_qualifying",
        category: "inland_transport",
        amount: 400_000,
        qualifies: false,
        notes: "Inland haulage — Commentary ¶171: not QAISI; remains in GloBE Income",
      },
      {
        id: "SH-05",
        kind: "qisi",
        category: "ship_sale",
        amount: 600_000,
        flagJurisdiction: "LR",
        qualifies: true,
        notes: "Gain on sale of a ship used in international shipping (Art. 3.3.2)",
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

function lineQualifiesAsQisi(line: ShippingLine): boolean {
  if (line.kind !== "qisi") return false;
  if (line.qualifies === false) return false;
  return QISI_CATS.has(line.category);
}

function lineQualifiesAsQaisi(line: ShippingLine): boolean {
  if (line.kind !== "qaisi") return false;
  if (line.qualifies === false) return false;
  return QAISI_CATS.has(line.category);
}

/** Art. 3.3.4 — 50% of International Shipping Income (jurisdictional). */
export function qaisiCapOf(qisi: number): number {
  if (qisi <= 0) return 0;
  return money(qisi * 0.5);
}

/** Art. 3.3.6 — strategic OR commercial management in the CE jurisdiction. */
export function managementTestPass(facts: Pick<ShippingFacts, "strategicManagementInCeJur" | "commercialManagementInCeJur">): boolean {
  return facts.strategicManagementInCeJur || facts.commercialManagementInCeJur;
}

function sumQisi(pack: ShippingFacts): number {
  return money(pack.lines.filter(lineQualifiesAsQisi).reduce((a, l) => a + l.amount, 0));
}

function sumQaisi(pack: ShippingFacts): number {
  return money(pack.lines.filter(lineQualifiesAsQaisi).reduce((a, l) => a + l.amount, 0));
}

/**
 * Art. 3.3.4 jurisdictional QAISI ceiling for the CE’s jurisdiction.
 * When `allPacks` is supplied (tests), use that universe; else SHIPPING_PACKS.
 */
export function jurisdictionalQaisiCap(
  ceJurisdiction: string,
  allPacks: ShippingFacts[] = SHIPPING_PACKS,
): { jurisdictionQisi: number; jurisdictionQaisi: number; cap: number } {
  const peers = allPacks.filter((p) => p.ceJurisdiction === ceJurisdiction);
  // Cap uses income of CEs that qualify under Art. 3.3.6; disqualified CEs do not
  // contribute QISI to the jurisdictional ceiling numerator/denominator.
  let jurisdictionQisi = 0;
  let jurisdictionQaisi = 0;
  for (const p of peers) {
    if (!managementTestPass(p)) continue;
    jurisdictionQisi = money(jurisdictionQisi + sumQisi(p));
    jurisdictionQaisi = money(jurisdictionQaisi + sumQaisi(p));
  }
  return { jurisdictionQisi, jurisdictionQaisi, cap: qaisiCapOf(jurisdictionQisi) };
}

/**
 * Compute Art. 3.3 exclusion for one Constituent Entity.
 * Pass `facts` + optional `allPacks` for isolated tests (jurisdictional Art. 3.3.4).
 */
export function computeShippingExclusion(
  entityId: string,
  facts?: ShippingFacts,
  opts?: { allPacks?: ShippingFacts[] },
): ShippingResult | null {
  const pack = facts ?? shippingFactsFor(entityId);
  if (!pack) return null;

  const peerUniverse = opts?.allPacks ?? (SHIPPING_PACKS.some((p) => p.entityId === pack.entityId) ? SHIPPING_PACKS : [pack]);

  const managementPass = managementTestPass(pack);
  const annotated: ShippingResult["lines"] = [];
  let qisiGross = 0;
  let qaisiGross = 0;
  let nonQualifyingKept = 0;

  for (const line of pack.lines) {
    if (lineQualifiesAsQisi(line)) {
      qisiGross = money(qisiGross + line.amount);
      annotated.push({ ...line, treatedAs: "excluded_qisi" });
    } else if (lineQualifiesAsQaisi(line)) {
      qaisiGross = money(qaisiGross + line.amount);
      annotated.push({ ...line, treatedAs: "excluded_qaisi" });
    } else {
      nonQualifyingKept = money(nonQualifyingKept + line.amount);
      annotated.push({ ...line, kind: "non_qualifying", treatedAs: "non_qualifying" });
    }
  }

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
        treatedAs: l.treatedAs === "non_qualifying" ? "non_qualifying" : "kept_management_fail",
      })),
      detail: `${why} International Shipping Income and QAISI remain in GloBE Income (Art. 3.3.1 condition not met); no Covered Tax exclusion.`,
      ruleId: "OECD-SHIP-33",
    };
  }

  // Art. 3.3.4 — allocate jurisdictional cap across CEs in proportion to each CE’s QAISI (Commentary ¶173).
  const peersPassing = peerUniverse.filter((p) => p.ceJurisdiction === pack.ceJurisdiction && managementTestPass(p));
  const jurQaisi = money(peersPassing.reduce((a, p) => a + sumQaisi(p), 0));
  let thisCeQaisiRoom = qaisiCap;
  if (jurQaisi > qaisiCap && jurQaisi > 0 && qaisiGross > 0) {
    thisCeQaisiRoom = money(qaisiCap * (qaisiGross / jurQaisi));
  } else if (qaisiGross <= 0 || qaisiCap <= 0) {
    thisCeQaisiRoom = 0;
  } else {
    thisCeQaisiRoom = money(Math.min(qaisiGross, qaisiCap));
  }

  let qaisiExcludedSigned = 0;
  let qaisiCappedOut = 0;
  if (qaisiGross <= 0) {
    // Ancillary loss: exclude only when jurisdiction has positive QISI (Art. 3.3.4 ceiling context).
    if (jurisdictionQisi > 0) {
      qaisiExcludedSigned = qaisiGross;
    } else {
      qaisiExcludedSigned = 0;
      qaisiCappedOut = qaisiGross;
    }
  } else {
    qaisiExcludedSigned = money(Math.min(qaisiGross, thisCeQaisiRoom));
    qaisiCappedOut = money(Math.max(0, qaisiGross - qaisiExcludedSigned));
  }

  const qisiExcluded = qisiGross;
  const incomeExcluded = money(qisiExcluded + qaisiExcludedSigned);
  const globeDelta = money(-incomeExcluded);
  const coveredTaxExcluded = incomeExcluded !== 0 ? money(pack.coveredTaxesOnShipping) : 0;

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
    if (jurisdictionQisi <= 0 && qaisiGross > 0) {
      linesOut.push({ ...line, treatedAs: "capped_out" });
      continue;
    }
    if (line.amount <= 0) {
      linesOut.push({
        ...line,
        treatedAs: jurisdictionQisi > 0 ? "excluded_qaisi" : "capped_out",
      });
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

  const flagNote = pack.lines.some(
    (l) => l.flagJurisdiction && l.flagJurisdiction !== pack.ceJurisdiction,
  )
    ? " Flag jurisdiction differs from CE location on one or more ships — Art. 3.3.6 looks to management location, not flag (Commentary ¶182)."
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
    detail: `Art. 3.3.1 mandatory exclusion — QISI ${qisiExcluded.toLocaleString("en-GB")} + QAISI ${qaisiExcludedSigned.toLocaleString("en-GB")} (Art. 3.3.4 jurisdictional cap ${qaisiCap.toLocaleString("en-GB")} = 50% of jurisdiction QISI ${jurisdictionQisi.toLocaleString("en-GB")}). Art. 3.3.6 management (strategic or commercial) passes. Covered Taxes on excluded shipping ${coveredTaxExcluded.toLocaleString("en-GB")} leave Adjusted Covered Taxes.${flagNote}`,
    ruleId: "OECD-SHIP-33",
  };
}

export function shippingGlobeDelta(entityId: string): number {
  return computeShippingExclusion(entityId)?.globeDelta ?? 0;
}

export function shippingCoveredTaxExcluded(entityId: string): number {
  return computeShippingExclusion(entityId)?.coveredTaxExcluded ?? 0;
}

/** Adjustment-shaped row for the GloBE income waterfall UI. */
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

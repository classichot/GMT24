/**
 * Art. 3.3 / Art. 4.1.3(a) — auditor third-read scenarios.
 * Run: npm run test:shipping
 *
 * Prior CLEARED: B1, B2, B3, M1–M3, M5, M7.
 * This file closes Art. 3.3.5 (¶176 / ¶179) and upgrades Art. 4.1.3(a) beyond current-only ratio.
 */

import {
  allocateIndirectCosts,
  art413aReduction,
  art413aShippingReduction,
  bareboatWithinThreeYears,
  classifyShippingLine,
  commentary179Facts,
  computeShippingExclusion,
  example331Facts,
  managementTestPass,
  qaisiCapOf,
  type ShippingFacts,
  type ShippingLine,
} from "../lib/shipping";
import { entityCalc, calculateGroup } from "../lib/engine";
import { money } from "../lib/format";

let passed = 0;
let failed = 0;

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function assertEq(actual: number, expected: number, name: string) {
  const a = money(actual);
  const e = money(expected);
  assert(a === e, name, `expected ${e}, got ${a}`);
}

function pack(over: Partial<ShippingFacts> & { lines: ShippingLine[] }): ShippingFacts {
  return {
    entityId: "TEST-SHIP",
    ceJurisdiction: "SG",
    strategicManagementInCeJur: true,
    commercialManagementInCeJur: true,
    indirectCosts: 0,
    residualRevenue: 0,
    currentTaxExpense: 0,
    deferredTaxExpense: 0,
    otherCovered: 0,
    taxableIncome: 1,
    sourceDoc: "test",
    ...over,
  };
}

console.log("\nArt. 3.3 third-read (3.3.5 + 4.1.3(a) leftovers)\n");

// ─── B1 / M1 regression ───
{
  console.log("Regression · B1 Art. 3.3.6 OR · M1 mandatory 3.3.1");
  assert(managementTestPass({ strategicManagementInCeJur: true, commercialManagementInCeJur: false }), "strategic alone");
  assert(managementTestPass({ strategicManagementInCeJur: false, commercialManagementInCeJur: true }), "commercial alone");
  assert(!managementTestPass({ strategicManagementInCeJur: false, commercialManagementInCeJur: false }), "neither fails");
}

// ─── B2 auditor-grade bareboat ───
{
  console.log("B2 · Art. 3.3.2(d) intragroup bareboat — lessee CE + lessee ISI");
  const ok = classifyShippingLine({
    id: "1",
    kind: "qisi",
    category: "bareboat_charter_intragroup",
    amount: 1_000_000,
    bareboat: { lesseeIsGroupCe: true, lesseeHasInternationalShippingIncome: true },
  });
  assert(ok.kind === "qisi", "intragroup bareboat with CE+ISI → QISI");

  const noCe = classifyShippingLine({
    id: "1",
    kind: "qisi",
    category: "bareboat_charter_intragroup",
    amount: 1_000_000,
    bareboat: { lesseeIsGroupCe: false, lesseeHasInternationalShippingIncome: true },
  });
  assert(noCe.kind === "non_qualifying", "fails without group-CE lessee");

  const noIsi = classifyShippingLine({
    id: "1",
    kind: "qisi",
    category: "bareboat_charter_intragroup",
    amount: 1_000_000,
    bareboat: { lesseeIsGroupCe: true, lesseeHasInternationalShippingIncome: false },
  });
  assert(noIsi.kind === "non_qualifying", "fails without lessee ISI (¶157)");
  assert(noIsi.reason.includes("International Shipping Income"), "fail reason cites lessee ISI");

  const missing = classifyShippingLine({
    id: "1",
    kind: "qisi",
    category: "bareboat_charter_intragroup",
    amount: 1_000_000,
  });
  assert(missing.kind === "non_qualifying", "fails when bareboat facts absent");
}

{
  console.log("B2 · Art. 3.3.3(a) third-party bareboat — non-CE shipping enterprise + ≤3 years");
  assert(
    bareboatWithinThreeYears({ charterYears: 2, relatedCharterYears: 0 }),
    "2-year charter within 3 years",
  );
  assert(
    !bareboatWithinThreeYears({ charterYears: 2, relatedCharterYears: 2 }),
    "2+2 renewal exceeds 3 years (¶164)",
  );
  assert(!bareboatWithinThreeYears({ charterYears: 4 }), "4-year charter fails");
  assert(!bareboatWithinThreeYears(undefined), "missing duration facts fail");

  const ok = classifyShippingLine({
    id: "1",
    kind: "qaisi",
    category: "bareboat_charter_third_party",
    amount: 500_000,
    bareboat: {
      lesseeIsNonCeShippingEnterprise: true,
      lesseeIsGroupCe: false,
      charterYears: 2,
      relatedCharterYears: 0,
    },
  });
  assert(ok.kind === "qaisi", "third-party bareboat with facts → QAISI");

  const noEnterprise = classifyShippingLine({
    id: "1",
    kind: "qaisi",
    category: "bareboat_charter_third_party",
    amount: 500_000,
    bareboat: { lesseeIsNonCeShippingEnterprise: false, charterYears: 1 },
  });
  assert(noEnterprise.kind === "non_qualifying", "fails without non-CE shipping enterprise lessee");

  const long = classifyShippingLine({
    id: "1",
    kind: "qaisi",
    category: "bareboat_charter_third_party",
    amount: 500_000,
    bareboat: {
      lesseeIsNonCeShippingEnterprise: true,
      charterYears: 2,
      relatedCharterYears: 2,
    },
  });
  assert(long.kind === "non_qualifying", "fails when renewals push past 3 years");

  const noDuration = classifyShippingLine({
    id: "1",
    kind: "qaisi",
    category: "bareboat_charter_third_party",
    amount: 500_000,
    bareboat: { lesseeIsNonCeShippingEnterprise: true },
  });
  assert(noDuration.kind === "non_qualifying", "fails when charterYears missing (duration engine)");

  const failPack = pack({
    lines: [
      {
        id: "1",
        kind: "qaisi",
        category: "bareboat_charter_third_party",
        amount: 800_000,
        bareboat: { lesseeIsNonCeShippingEnterprise: true, charterYears: 5 },
      },
    ],
  });
  const failR = computeShippingExclusion("TEST-SHIP", failPack, { allPacks: [failPack] })!;
  assertEq(failR.qaisiGross, 0, "long third-party bareboat not in QAISI gross");
  assertEq(failR.nonQualifyingKept, 800_000, "long third-party bareboat stays in GloBE");
  assertEq(failR.incomeExcluded, 0, "no exclusion without qualifying bareboat");
}

// ─── B3 regression ───
{
  console.log("Regression · B3 inland ¶171");
  const inland = classifyShippingLine({
    id: "1",
    kind: "non_qualifying",
    category: "inland_transport",
    amount: 100,
    qualifies: false,
  });
  assert(inland.kind === "non_qualifying", "inland not QAISI");
}

// ─── M2 two-CE jurisdictional Art. 3.3.4 ───
{
  console.log("M2 · Art. 3.3.4 two-CE jurisdictional 50% QAISI cap");
  const ceA = pack({
    entityId: "CE-A",
    ceJurisdiction: "SG",
    lines: [
      { id: "a1", kind: "qisi", category: "international_transport", amount: 100, voyage: { solelyDomesticPlaces: false } },
      { id: "a2", kind: "qaisi", category: "container_leasing", amount: 80 },
    ],
  });
  const ceB = pack({
    entityId: "CE-B",
    ceJurisdiction: "SG",
    lines: [
      { id: "b1", kind: "qisi", category: "international_transport", amount: 100, voyage: { solelyDomesticPlaces: false } },
      { id: "b2", kind: "qaisi", category: "container_leasing", amount: 40 },
    ],
  });
  const rA = computeShippingExclusion("CE-A", ceA, { allPacks: [ceA, ceB] })!;
  const rB = computeShippingExclusion("CE-B", ceB, { allPacks: [ceA, ceB] })!;
  assertEq(rA.qaisiCap, 100, "jurisdictional cap = 50% × (100+100)");
  assertEq(rB.qaisiCap, 100, "same cap on peer CE");
  assertEq(money(rA.qaisiExcluded + rB.qaisiExcluded), 100, "aggregated QAISI excluded equals jurisdictional cap");
  assert(rA.qaisiExcluded < 80, "CE-A QAISI partially capped");
  assert(rB.qaisiExcluded < 40 || rB.qaisiExcluded === 40, "CE-B takes residual room");
  assertEq(money(rA.qaisiCappedOut + rB.qaisiCappedOut), 20, "spill 20 stays in GloBE across CEs");
}

// ─── M3 OECD Examples 3.3.1-1 / 2 / 3 ───
{
  console.log("M3 · OECD Example 3.3.1-1");
  const ex1 = example331Facts({ fanil: 200, otherIncome: 60, qisi: 100, qaisi: 40 });
  const r1 = computeShippingExclusion(ex1.entityId, ex1, { allPacks: [ex1] })!;
  assertEq(r1.incomeExcluded, 140, "Example 3.3.1-1 exclusion 140");
  assertEq(money(200 + r1.globeDelta), 60, "Example 3.3.1-1 GloBE = FANIL + delta = 60");

  console.log("M3 · OECD Example 3.3.1-2 (Art. 3.3.4 cap)");
  const ex2 = example331Facts({ fanil: 200, otherIncome: 40, qisi: 100, qaisi: 60 });
  const r2 = computeShippingExclusion(ex2.entityId, ex2, { allPacks: [ex2] })!;
  assertEq(r2.qaisiCap, 50, "Example 3.3.1-2 cap 50");
  assertEq(r2.qaisiExcluded, 50, "Example 3.3.1-2 QAISI limited to 50");
  assertEq(r2.qaisiCappedOut, 10, "Example 3.3.1-2 spill 10");
  assertEq(r2.incomeExcluded, 150, "Example 3.3.1-2 exclusion 150");
  assertEq(money(200 + r2.globeDelta), 50, "Example 3.3.1-2 GloBE = 50");

  console.log("M3 · OECD Example 3.3.1-3 (shipping losses)");
  const ex3 = example331Facts({ fanil: 200, otherIncome: 360, qisi: -100, qaisi: -60 });
  const r3 = computeShippingExclusion(ex3.entityId, ex3, { allPacks: [ex3] })!;
  assertEq(r3.qisiExcluded, -100, "Example 3.3.1-3 QISI loss excluded");
  assertEq(r3.qaisiExcluded, -60, "Example 3.3.1-3 QAISI loss excluded (Art. 3.3.1)");
  assertEq(r3.incomeExcluded, -160, "Example 3.3.1-3 total excluded loss 160");
  assertEq(money(200 + r3.globeDelta), 360, "Example 3.3.1-3 GloBE = 360");
}

// ─── Art. 3.3.5 cost attribution (Commentary ¶176 / ¶179) ───
{
  console.log("Art. 3.3.5 · Commentary ¶176 indirect allocation by revenue ratio");
  const alloc = allocateIndirectCosts({
    isiRevenue: 80,
    qaisiRevenue: 20,
    residualRevenue: 20,
    indirectCosts: 30,
  });
  assertEq(alloc.totalRevenue, 120, "¶176 total revenue 80+20+20");
  assertEq(alloc.isi, 20, "¶176 indirect to ISI = 20");
  assertEq(alloc.qaisi, 5, "¶176 indirect to QAISI = 5");
  assertEq(alloc.residual, 5, "¶176 indirect to residual = 5");

  const grossPack = pack({
    entityId: "EX-176",
    ceJurisdiction: "EX",
    indirectCosts: 30,
    residualRevenue: 20,
    taxableIncome: 75,
    lines: [
      {
        id: "isi",
        kind: "qisi",
        category: "international_transport",
        amount: 80,
        revenue: 80,
        directCosts: 0,
        voyage: { solelyDomesticPlaces: false },
      },
      {
        id: "qaisi",
        kind: "qaisi",
        category: "container_leasing",
        amount: 20,
        revenue: 20,
        directCosts: 0,
      },
    ],
  });
  const r176 = computeShippingExclusion("EX-176", grossPack, { allPacks: [grossPack] })!;
  assert(r176.cost.usedGrossEngine, "¶176 uses gross Art. 3.3.5 engine");
  assertEq(r176.cost.indirect.isi, 20, "engine allocates 20 indirect to ISI");
  assertEq(r176.cost.indirect.qaisi, 5, "engine allocates 5 indirect to QAISI");
  assertEq(r176.cost.indirect.residual, 5, "engine allocates 5 indirect to residual");
  assertEq(r176.qisiGross, 60, "ISI net = 80 − 20 indirect");
  assertEq(r176.qaisiGross, 15, "QAISI net = 20 − 5 indirect");
}

{
  console.log("Art. 3.3.5 · Commentary ¶179 spill costs stay in GloBE");
  const facts = commentary179Facts();
  const r = computeShippingExclusion(facts.entityId, facts, { allPacks: [facts] })!;
  assertEq(r.qisiGross, 70, "¶179 ISI net 70");
  assertEq(r.qaisiGross, 40, "¶179 QAISI net 40");
  assertEq(r.qaisiCap, 35, "¶179 cap 50% × 70 = 35");
  assertEq(r.qaisiExcluded, 35, "¶179 allowable QAISI 35");
  assertEq(r.qaisiCappedOut, 5, "¶179 spill 5");
  assertEq(r.incomeExcluded, 105, "¶179 exclude 105 (70+35); spill costs stay");
  assertEq(money(110 + r.globeDelta), 5, "¶179 GloBE = FANIL 110 − 105 = 5 (spill profit)");
  assertEq(r.cost.isiDirect, 130, "¶179 ISI direct costs 130");
  assertEq(r.cost.qaisiDirect, 60, "¶179 QAISI direct costs 60");
}

// ─── Art. 4.1.3(a) — real association (not current-only proxy) ───
{
  console.log("Art. 4.1.3(a) · teaching Example 4.1.3-1 current-only helper still works");
  assertEq(art413aReduction(100, 200, 40), 20, "Example 4.1.3-1 → 20");

  // Unidentifiable remainder uses current + deferred + otherCovered (not current-only).
  const shipping = example331Facts({
    fanil: 200,
    otherIncome: 60,
    qisi: 100,
    qaisi: 40,
    currentTaxExpense: 30,
    deferredTaxExpense: 10,
    otherCovered: 0,
    taxableIncome: 200,
  });
  const r = computeShippingExclusion(shipping.entityId, shipping, { allPacks: [shipping] })!;
  // excluded 140; residual 60; pool 40 → 140/200 × 40 = 28
  assertEq(r.coveredTaxExcluded, 28, "4.1.3(a) ratio base includes deferred (30+10)");
  assertEq(r.tax.totalPool, 40, "tax pool = current + deferred + otherCovered");

  const capped = example331Facts({
    fanil: 200,
    otherIncome: 40,
    qisi: 100,
    qaisi: 60,
    currentTaxExpense: 40,
    taxableIncome: 200,
  });
  const rc = computeShippingExclusion(capped.entityId, capped, { allPacks: [capped] })!;
  assertEq(rc.incomeExcluded, 150, "excluded income omits Art. 3.3.4 spill");
  assertEq(rc.coveredTaxExcluded, 30, "ratio omits spill from numerator; tax on spill stays");
}

{
  console.log("Art. 4.1.3(a) · (a) identifiable spill tax stays in ACT");
  // ISI 10 / QAISI 8 → cap 5 → spill 3; exclude 15. Identifiable tax on spill remains in Covered Taxes.
  const p = pack({
    entityId: "EX-413A-SPILL",
    ceJurisdiction: "EX",
    taxableIncome: 20,
    currentTaxExpense: 40,
    deferredTaxExpense: 0,
    otherCovered: 0,
    taxAssociation: {
      identifiableCurrentOnExcluded: 24,
      identifiableDeferredOnExcluded: 0,
      identifiableTaxOnSpill: 6,
      identifiableTaxOnResidual: 10,
    },
    lines: [
      {
        id: "isi",
        kind: "qisi",
        category: "international_transport",
        amount: 10,
        voyage: { solelyDomesticPlaces: false },
      },
      { id: "qaisi", kind: "qaisi", category: "container_leasing", amount: 8 },
    ],
  });
  const r = computeShippingExclusion(p.entityId, p, { allPacks: [p] })!;
  assertEq(r.incomeExcluded, 15, "ISI 10 + allowable QAISI 5");
  assertEq(r.qaisiCappedOut, 3, "spill QAISI 3");
  assertEq(r.coveredTaxExcluded, 24, "only identifiable excluded tax leaves ACT");
  assertEq(r.tax.identifiableSpill, 6, "spill tax identified");
  assertEq(money(40 - r.coveredTaxExcluded), 16, "ACT keeps spill 6 + residual 10");
}

{
  console.log("Art. 4.1.3(a) · (b) deferred on excluded shipping leaves ACT");
  const p = pack({
    entityId: "EX-413A-DEF",
    ceJurisdiction: "EX",
    taxableIncome: 100,
    currentTaxExpense: 10,
    deferredTaxExpense: 5,
    otherCovered: 0,
    taxAssociation: {
      identifiableCurrentOnExcluded: 8,
      identifiableDeferredOnExcluded: 4,
      identifiableTaxOnResidual: 3,
    },
    lines: [
      {
        id: "isi",
        kind: "qisi",
        category: "international_transport",
        amount: 80,
        voyage: { solelyDomesticPlaces: false },
      },
      { id: "qaisi", kind: "qaisi", category: "container_leasing", amount: 10 },
    ],
  });
  const r = computeShippingExclusion(p.entityId, p, { allPacks: [p] })!;
  assertEq(r.incomeExcluded, 90, "ISI 80 + QAISI 10 within 50% cap");
  assertEq(r.coveredTaxExcluded, 12, "current 8 + deferred 4 on excluded leave ACT");
  assertEq(r.tax.identifiableExcluded, 12, "identifiable excluded includes deferred");
  assertEq(money(15 - r.coveredTaxExcluded), 3, "residual tax 3 stays in ACT");
}

{
  console.log("Art. 4.1.3(a) · (c) residual non-shipping tax stays");
  const split = art413aShippingReduction({
    incomeExcluded: 50,
    spillNet: 0,
    residualNet: 50,
    currentTaxExpense: 8,
    deferredTaxExpense: 2,
    otherCovered: 4,
    association: {
      identifiableCurrentOnExcluded: 0,
      identifiableDeferredOnExcluded: 0,
      identifiableTaxOnResidual: 6,
    },
  });
  // Pool 14; residual identifiable 6 → unidentifiable 8; ratio 50/(50+50) × 8 = 4
  assertEq(split.totalPool, 14, "otherCovered joins the association pool");
  assertEq(split.identifiableResidual, 6, "residual tax identified");
  assertEq(split.unidentifiablePool, 8, "remainder after residual identifiable");
  assertEq(split.reduction, 4, "only excluded share of unidentifiable leaves ACT");
  assertEq(money(14 - split.reduction), 10, "ACT keeps residual 6 + half of unidentifiable 4");
}

{
  console.log("Art. 4.1.3(a) · do not strip whole pack lump when incomeExcluded ≠ 0");
  const p = pack({
    entityId: "EX-413A-PARTIAL",
    ceJurisdiction: "EX",
    taxableIncome: 100,
    currentTaxExpense: 20,
    deferredTaxExpense: 0,
    taxAssociation: {
      identifiableCurrentOnExcluded: 7,
      identifiableTaxOnResidual: 13,
    },
    lines: [
      {
        id: "isi",
        kind: "qisi",
        category: "international_transport",
        amount: 40,
        voyage: { solelyDomesticPlaces: false },
      },
    ],
  });
  const r = computeShippingExclusion(p.entityId, p, { allPacks: [p] })!;
  assertEq(r.incomeExcluded, 40, "partial shipping exclusion");
  assertEq(r.coveredTaxExcluded, 7, "only associated tax leaves — not the whole 20");
}

// ─── M5 traffic / voyage ───
{
  console.log("M5 · international traffic / voyage tests (¶152 / ¶160)");
  const domestic = classifyShippingLine({
    id: "1",
    kind: "qisi",
    category: "international_transport",
    amount: 10,
    voyage: { solelyDomesticPlaces: true },
  });
  assert(domestic.kind === "non_qualifying", "solely domestic places → not ISI");

  const inlandWw = classifyShippingLine({
    id: "1",
    kind: "qisi",
    category: "international_transport",
    amount: 10,
    voyage: { inlandWaterwaysSameJurisdiction: true },
  });
  assert(inlandWw.kind === "non_qualifying", "inland waterways same jurisdiction → not ISI");

  const ok = classifyShippingLine({
    id: "1",
    kind: "qisi",
    category: "international_transport",
    amount: 10,
    voyage: { solelyDomesticPlaces: false, inlandWaterwaysSameJurisdiction: false },
  });
  assert(ok.kind === "qisi", "international traffic transport → QISI");

  const slotDomestic = classifyShippingLine({
    id: "1",
    kind: "qisi",
    category: "slot_charter",
    amount: 10,
    voyage: { solelyDomesticPlaces: true },
  });
  assert(slotDomestic.kind === "non_qualifying", "slot charter on domestic-only route fails ¶152");
}

// ─── M7 Art. 3.3.2(c) ───
{
  console.log("M7 · Art. 3.3.2(c) time/voyage crewed charter-out");
  const ok = classifyShippingLine({
    id: "1",
    kind: "qisi",
    category: "time_voyage_charter",
    amount: 2_000_000,
    voyage: { expectedInternationalTraffic: true, solelyDomesticPlaces: false },
  });
  assert(ok.kind === "qisi", "crewed charter-out for international traffic → QISI");

  const noExpect = classifyShippingLine({
    id: "1",
    kind: "qisi",
    category: "time_voyage_charter",
    amount: 2_000_000,
    voyage: { expectedInternationalTraffic: false },
  });
  assert(noExpect.kind === "non_qualifying", "fails without expected international traffic (¶156)");

  const missing = classifyShippingLine({
    id: "1",
    kind: "qisi",
    category: "time_voyage_charter",
    amount: 2_000_000,
  });
  assert(missing.kind === "non_qualifying", "fails when voyage facts absent");

  const eng = pack({
    lines: [
      {
        id: "1",
        kind: "qisi",
        category: "time_voyage_charter",
        amount: 2_000_000,
        voyage: { expectedInternationalTraffic: true },
      },
    ],
  });
  const r = computeShippingExclusion("TEST-SHIP", eng, { allPacks: [eng] })!;
  assertEq(r.qisiExcluded, 2_000_000, "Art. 3.3.2(c) income excluded as QISI");
}

// ─── Live SG-SHIP engine ───
{
  console.log("Engine · SG-SHIP seed (gross Art. 3.3.5 + identifiable 4.1.3(a))");
  const row = entityCalc("SG-SHIP");
  assert(!!row, "SG-SHIP on entityCalc");
  if (row) {
    assertEq(row.globe, 900_000, "GloBE keeps inland 0.4 + residual 0.5");
    assertEq(row.shipping!.incomeExcluded, 8_000_000, "excludes 8.0m (ISI 5.8 + QAISI 2.2)");
    assert(row.shipping!.cost.usedGrossEngine, "SG-SHIP uses gross revenue/direct engine");
    assertEq(row.shipping!.cost.isiRevenue, 9_600_000, "ISI gross revenue");
    assertEq(row.shipping!.cost.isiDirect, 3_800_000, "ISI direct costs");
    assertEq(row.shipping!.coveredTaxExcluded, 930_000, "identifiable excluded current 900k + deferred 30k");
    assertEq(row.covered, 230_000, "ACT keeps residual tax 230k (spill tax 0)");
    assertEq(row.shipping!.tax.identifiableResidual, 230_000, "residual tax stays identified in ACT");
    assert(
      row.shipping!.lines.some(
        (l) => l.category === "bareboat_charter_third_party" && l.treatedAs === "excluded_qaisi",
      ),
      "seed third-party bareboat excluded as QAISI with duration facts",
    );
  }
  assert(
    !!calculateGroup("aetherion").find((c) => c.blendKind === "main" && c.entities.some((e) => e.id === "SG-SHIP")),
    "SG-SHIP in Singapore main blend",
  );
}

{
  console.log("Cap helper");
  assertEq(qaisiCapOf(100), 50, "50% cap");
  assertEq(qaisiCapOf(-10), 0, "no positive cap on loss QISI");
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

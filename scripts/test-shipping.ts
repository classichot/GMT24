/**
 * Art. 3.3 / Art. 4.1.3(a) — auditor second-read scenarios.
 * Run: npm run test:shipping
 *
 * Cleared previously: B1 (3.3.6 OR), B3 (inland ¶171), M1 (3.3.1 mandatory).
 * This file closes B2 and proves M2–M5, M7 against Model Rules / Commentary / Examples.
 */

import {
  art413aReduction,
  bareboatWithinThreeYears,
  classifyShippingLine,
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
    currentTaxExpense: 0,
    taxableIncome: 1,
    sourceDoc: "test",
    ...over,
  };
}

console.log("\nArt. 3.3 second-read (B2 + M2–M7)\n");

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

  // Engine posts non-qualifying amount into GloBE (not excluded)
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
  // Jurisdiction QISI = 200 → cap = 100. Jurisdiction QAISI = 120 → spill 20.
  // Pro-rata: A room = 100 * (80/120) = 66.666… → money; B room = 100 * (40/120).
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
  // FANIL 200, other 60, ISI 100, QAISI 40 → exclude 140 → GloBE 60
  const ex1 = example331Facts({ fanil: 200, otherIncome: 60, qisi: 100, qaisi: 40 });
  const r1 = computeShippingExclusion(ex1.entityId, ex1, { allPacks: [ex1] })!;
  assertEq(r1.incomeExcluded, 140, "Example 3.3.1-1 exclusion 140");
  assertEq(money(200 + r1.globeDelta), 60, "Example 3.3.1-1 GloBE = FANIL + delta = 60");

  console.log("M3 · OECD Example 3.3.1-2 (Art. 3.3.4 cap)");
  // FANIL 200, other 40, ISI 100, QAISI 60 → cap 50 → exclude 150 → GloBE 50
  const ex2 = example331Facts({ fanil: 200, otherIncome: 40, qisi: 100, qaisi: 60 });
  const r2 = computeShippingExclusion(ex2.entityId, ex2, { allPacks: [ex2] })!;
  assertEq(r2.qaisiCap, 50, "Example 3.3.1-2 cap 50");
  assertEq(r2.qaisiExcluded, 50, "Example 3.3.1-2 QAISI limited to 50");
  assertEq(r2.qaisiCappedOut, 10, "Example 3.3.1-2 spill 10");
  assertEq(r2.incomeExcluded, 150, "Example 3.3.1-2 exclusion 150");
  assertEq(money(200 + r2.globeDelta), 50, "Example 3.3.1-2 GloBE = 50");

  console.log("M3 · OECD Example 3.3.1-3 (shipping losses)");
  // FANIL 200, other 360, ISI (100), QAISI (60) → exclude (160) → GloBE 360
  const ex3 = example331Facts({ fanil: 200, otherIncome: 360, qisi: -100, qaisi: -60 });
  const r3 = computeShippingExclusion(ex3.entityId, ex3, { allPacks: [ex3] })!;
  assertEq(r3.qisiExcluded, -100, "Example 3.3.1-3 QISI loss excluded");
  assertEq(r3.qaisiExcluded, -60, "Example 3.3.1-3 QAISI loss excluded (Art. 3.3.1)");
  assertEq(r3.incomeExcluded, -160, "Example 3.3.1-3 total excluded loss 160");
  assertEq(money(200 + r3.globeDelta), 360, "Example 3.3.1-3 GloBE = 360");
}

// ─── M4 Art. 4.1.3(a) ───
{
  console.log("M4 · Art. 4.1.3(a) Covered Tax split (Example 4.1.3-1 method)");
  // Classic Example 4.1.3-1 numbers: excluded 100 / taxable 200 × tax 40 = 20
  assertEq(art413aReduction(100, 200, 40), 20, "Example 4.1.3-1 → 20");

  const shipping = example331Facts({
    fanil: 200,
    otherIncome: 60,
    qisi: 100,
    qaisi: 40,
    currentTaxExpense: 40,
    taxableIncome: 200,
  });
  const r = computeShippingExclusion(shipping.entityId, shipping, { allPacks: [shipping] })!;
  // excluded 140 / 200 × 40 = 28
  assertEq(r.coveredTaxExcluded, 28, "shipping Art. 4.1.3(a) = 140/200 × 40");

  // Cap spill: Example 3.3.1-2 style — excluded 150, spill 10 stays in GloBE → tax on spill stays
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
  assertEq(rc.coveredTaxExcluded, 30, "Art. 4.1.3(a) = 150/200 × 40; tax on spill 10 remains in Covered Taxes");
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
  console.log("Engine · SG-SHIP seed");
  const row = entityCalc("SG-SHIP");
  assert(!!row, "SG-SHIP on entityCalc");
  if (row) {
    assertEq(row.globe, 900_000, "GloBE keeps inland 0.4 + other 0.5");
    assertEq(row.shipping!.incomeExcluded, 8_000_000, "excludes 8.0m");
    // Art. 4.1.3(a): 8_000_000 / 8_900_000 × 1_120_000
    const expectTax = art413aReduction(8_000_000, 8_900_000, 1_120_000);
    assertEq(row.shipping!.coveredTaxExcluded, expectTax, "Art. 4.1.3(a) proportional tax");
    assertEq(row.covered, money(1_120_000 + 40_000 - expectTax), "entity Covered Taxes after 4.1.3(a)");
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

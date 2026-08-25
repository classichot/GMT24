/**
 * Art. 3.3 International Shipping Income — pass/fail scenarios.
 * Run: npx --yes tsx scripts/test-shipping.ts
 *
 * Only the assertions below are claimed as covered in docs/oecd-pillar2-coverage.md.
 */

import {
  computeShippingExclusion,
  qaisiCapOf,
  type ShippingFacts,
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

function base(over: Partial<ShippingFacts> = {}): ShippingFacts {
  return {
    entityId: "TEST-SHIP",
    ceJurisdiction: "SG",
    strategicManagementInCeJur: true,
    commercialManagementInCeJur: true,
    electExclusion: true,
    coveredTaxesOnShipping: 1_000_000,
    sourceDoc: "test",
    lines: [
      { id: "1", kind: "qisi", category: "international_transport", amount: 10_000_000, flagJurisdiction: "LR", qualifies: true },
      { id: "2", kind: "qaisi", category: "container_leasing", amount: 3_000_000, qualifies: true },
    ],
    ...over,
  };
}

console.log("\nArt. 3.3 International Shipping Income\n");

// --- Pure module ---
{
  console.log("QISI / QAISI / 50% cap");
  assertEq(qaisiCapOf(10_000_000), 5_000_000, "50% of positive QISI");
  assertEq(qaisiCapOf(0), 0, "cap is 0 when QISI is 0");
  assertEq(qaisiCapOf(-2_000_000), 0, "cap is 0 when QISI is a loss");

  const pass = computeShippingExclusion("TEST-SHIP", base())!;
  assertEq(pass.qisiExcluded, 10_000_000, "QISI fully excluded when management + election pass");
  assertEq(pass.qaisiExcluded, 3_000_000, "QAISI below cap fully excluded");
  assertEq(pass.incomeExcluded, 13_000_000, "total excluded income");
  assertEq(pass.globeDelta, -13_000_000, "globe delta is −excluded");
  assertEq(pass.coveredTaxExcluded, 1_000_000, "attributable Covered Taxes excluded");
  assert(!pass.disqualified, "not disqualified on pass path");
}

{
  console.log("Art. 3.3.3 QAISI cap");
  const capped = computeShippingExclusion(
    "TEST-SHIP",
    base({
      lines: [
        { id: "1", kind: "qisi", category: "international_transport", amount: 10_000_000, qualifies: true },
        { id: "2", kind: "qaisi", category: "container_leasing", amount: 8_000_000, qualifies: true },
      ],
    }),
  )!;
  assertEq(capped.qaisiCap, 5_000_000, "cap = 50% × 10m");
  assertEq(capped.qaisiExcluded, 5_000_000, "QAISI excluded limited to cap");
  assertEq(capped.qaisiCappedOut, 3_000_000, "QAISI spill stays in GloBE");
  assertEq(capped.incomeExcluded, 15_000_000, "QISI 10 + capped QAISI 5");
}

{
  console.log("Art. 3.3.4 management failure (recapture / disqualification)");
  const failS = computeShippingExclusion(
    "TEST-SHIP",
    base({ strategicManagementInCeJur: false }),
  )!;
  assert(failS.disqualified, "strategic fail → disqualified");
  assertEq(failS.globeDelta, 0, "no income exclusion on strategic fail");
  assertEq(failS.coveredTaxExcluded, 0, "no Covered Tax exclusion on strategic fail");

  const failC = computeShippingExclusion(
    "TEST-SHIP",
    base({ commercialManagementInCeJur: false }),
  )!;
  assert(failC.disqualified, "commercial fail → disqualified");
  assertEq(failC.globeDelta, 0, "no income exclusion on commercial fail");
}

{
  console.log("Election off");
  const off = computeShippingExclusion("TEST-SHIP", base({ electExclusion: false }))!;
  assert(!off.elected, "not elected");
  assertEq(off.globeDelta, 0, "no exclusion without election");
  assertEq(off.coveredTaxExcluded, 0, "no tax exclusion without election");
}

{
  console.log("Loss-making QISI");
  const loss = computeShippingExclusion(
    "TEST-SHIP",
    base({
      coveredTaxesOnShipping: -200_000,
      lines: [
        { id: "1", kind: "qisi", category: "international_transport", amount: -2_000_000, qualifies: true },
        { id: "2", kind: "qaisi", category: "inland_transport", amount: 500_000, qualifies: true },
      ],
    }),
  )!;
  assertEq(loss.qisiExcluded, -2_000_000, "QISI loss is excluded (raises GloBE)");
  assertEq(loss.qaisiExcluded, 0, "no QAISI exclusion when QISI ≤ 0");
  assertEq(loss.globeDelta, 2_000_000, "excluding a loss increases GloBE Income");
  assertEq(loss.coveredTaxExcluded, -200_000, "attributable tax follows when income is excluded");
}

{
  console.log("Bareboat / slot / inland / container / ship sale categories");
  const cats = computeShippingExclusion(
    "TEST-SHIP",
    base({
      lines: [
        { id: "a", kind: "qisi", category: "bareboat_charter", amount: 1_000_000, qualifies: true },
        { id: "b", kind: "qisi", category: "slot_charter", amount: 500_000, qualifies: true },
        { id: "c", kind: "qisi", category: "pool_joint_agency", amount: 250_000, qualifies: true },
        { id: "d", kind: "qisi", category: "ship_sale", amount: 750_000, qualifies: true },
        { id: "e", kind: "qaisi", category: "inland_transport", amount: 100_000, qualifies: true },
        { id: "f", kind: "qaisi", category: "container_leasing", amount: 100_000, qualifies: true },
        { id: "g", kind: "qaisi", category: "engineering_services", amount: 50_000, qualifies: true },
        { id: "h", kind: "qisi", category: "ship_sale", amount: 400_000, qualifies: false, notes: "holding-period gate failed" },
      ],
    }),
  )!;
  assertEq(cats.qisiExcluded, 2_500_000, "qualifying QISI categories sum (sale gate fail kept out)");
  assertEq(cats.nonQualifyingKept, 400_000, "non-qualifying ship sale stays in GloBE");
  assertEq(cats.qaisiExcluded, 250_000, "ancillary categories under cap");
  assertEq(cats.incomeExcluded, 2_750_000, "QISI + QAISI excluded");
}

{
  console.log("Flag vs management jurisdiction mismatch");
  const flag = computeShippingExclusion(
    "TEST-SHIP",
    base({
      ceJurisdiction: "SG",
      lines: [
        {
          id: "1",
          kind: "qisi",
          category: "international_transport",
          amount: 4_000_000,
          flagJurisdiction: "MH",
          qualifies: true,
          notes: "Marshall Islands flag; management in Singapore",
        },
      ],
    }),
  )!;
  assert(!flag.disqualified, "flag ≠ CE jurisdiction does not fail Art. 3.3.4");
  assertEq(flag.incomeExcluded, 4_000_000, "exclusion still applies when management is in CE jur");
  assert(flag.detail.includes("Flag jurisdiction"), "audit text notes flag mismatch");
}

{
  console.log("Mixed shipping + non-shipping (exclusion only on shipping lines)");
  const mixed = computeShippingExclusion(
    "TEST-SHIP",
    base({
      lines: [
        { id: "1", kind: "qisi", category: "international_transport", amount: 6_000_000, qualifies: true },
        { id: "2", kind: "qaisi", category: "other_ancillary", amount: 1_000_000, qualifies: true },
      ],
    }),
  )!;
  // Non-shipping FANIL is outside this module — engine keeps residual FANIL − shipping lines.
  assertEq(mixed.incomeExcluded, 7_000_000, "only shipping lines excluded; residual FANIL stays in engine");
}

// --- Engine integration (live SG-SHIP seed) ---
{
  console.log("Engine path · SG-SHIP seed");
  const row = entityCalc("SG-SHIP");
  assert(!!row, "SG-SHIP is on the entityCalc path");
  if (row) {
    // FANIL 8.9m − QISI 6.6m − QAISI 1.8m = 0.5m residual non-shipping
    assertEq(row.globe, 500_000, "SG-SHIP GloBE after Art. 3.3 = non-shipping residual");
    assertEq(row.covered, 110_000, "SG-SHIP Covered Taxes after shipping tax exclusion (1.16m − 1.05m)");
    assert(!!row.shipping && row.shipping.incomeExcluded === 8_400_000, "shipping pack posts 8.4m exclusion");
    assert(
      row.adjustments.some((a) => a.ruleId === "OECD-SHIP-33" && a.amount === -8_400_000),
      "waterfall shows Art. 3.3 adjustment",
    );
  }

  const sg = calculateGroup("aetherion").find((c) => c.blendKey.startsWith("SG:") && c.blendKind === "main");
  assert(!!sg, "Singapore main blend exists");
  if (sg) {
    assert(
      sg.entities.some((e) => e.id === "SG-SHIP"),
      "SG-SHIP blends with Singapore HoldCo (not JV)",
    );
    // HoldCo globe was 69.3m; + SG-SHIP 0.5m → 69.8m (shipping excluded at CE level before blend)
    assert(sg.globeIncome >= 69_000_000, "Singapore main GloBE still includes HoldCo after shipping exclusion");
  }
}

{
  console.log("JV path note (no rewrite)");
  // Art. 3.3 on a JV would use the same module if a shipping pack were attached to SG-JV.
  // No pack is seeded on SG-JV — prove the hook returns null, not a parallel engine.
  const jv = computeShippingExclusion("SG-JV");
  assert(jv === null, "SG-JV has no shipping pack — module is inert (look-through/JV not auto-inferred)");
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

/**
 * Art. 3.3 International Shipping Income — Model Rules pass/fail scenarios.
 * Run: npm run test:shipping
 *
 * Legal anchors asserted here: Art. 3.3.1, 3.3.2(d), 3.3.3(a), 3.3.4, 3.3.6,
 * Commentary ¶157, ¶163–164, ¶171, ¶180–182.
 */

import {
  computeShippingExclusion,
  managementTestPass,
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
    coveredTaxesOnShipping: 1_000_000,
    sourceDoc: "test",
    lines: [
      { id: "1", kind: "qisi", category: "international_transport", amount: 10_000_000, flagJurisdiction: "LR", qualifies: true },
      { id: "2", kind: "qaisi", category: "container_leasing", amount: 3_000_000, qualifies: true },
    ],
    ...over,
  };
}

console.log("\nArt. 3.3 International Shipping Income (Model Rules)\n");

{
  console.log("Art. 3.3.6 management — OR (strategic or commercial)");
  assert(managementTestPass({ strategicManagementInCeJur: true, commercialManagementInCeJur: false }), "strategic alone passes");
  assert(managementTestPass({ strategicManagementInCeJur: false, commercialManagementInCeJur: true }), "commercial alone passes");
  assert(!managementTestPass({ strategicManagementInCeJur: false, commercialManagementInCeJur: false }), "neither fails");

  const stratOnly = computeShippingExclusion("TEST-SHIP", base({
    strategicManagementInCeJur: true,
    commercialManagementInCeJur: false,
  }), { allPacks: [base({ strategicManagementInCeJur: true, commercialManagementInCeJur: false })] })!;
  assert(!stratOnly.disqualified, "strategic-only CE is not disqualified (Art. 3.3.6 OR)");
  assertEq(stratOnly.incomeExcluded, 13_000_000, "strategic-only still excludes QISI+QAISI");

  const bothFail = computeShippingExclusion("TEST-SHIP", base({
    strategicManagementInCeJur: false,
    commercialManagementInCeJur: false,
  }), { allPacks: [base({ strategicManagementInCeJur: false, commercialManagementInCeJur: false })] })!;
  assert(bothFail.disqualified, "both management legs fail → disqualified");
  assertEq(bothFail.globeDelta, 0, "no income exclusion when Art. 3.3.6 fails");
  assertEq(bothFail.coveredTaxExcluded, 0, "no Covered Tax exclusion when Art. 3.3.6 fails");
  assert(bothFail.detail.includes("3.3.6"), "disqualify text cites Art. 3.3.6 not 3.3.4");
}

{
  console.log("Art. 3.3.1 mandatory exclusion (not an election)");
  const r = computeShippingExclusion("TEST-SHIP", base(), { allPacks: [base()] })!;
  assertEq(r.incomeExcluded, 13_000_000, "exclusion applies without any election flag");
  assert(!(r as { elected?: boolean }).elected, "result has no elected gate");
  assert(r.detail.includes("3.3.1 mandatory"), "detail states Art. 3.3.1 mandatory");
}

{
  console.log("Art. 3.3.4 QAISI jurisdictional 50% cap");
  assertEq(qaisiCapOf(10_000_000), 5_000_000, "50% of positive QISI");
  assertEq(qaisiCapOf(0), 0, "cap is 0 when QISI is 0");
  assertEq(qaisiCapOf(-2_000_000), 0, "cap is 0 when QISI is a loss");

  const capped = computeShippingExclusion(
    "TEST-SHIP",
    base({
      lines: [
        { id: "1", kind: "qisi", category: "international_transport", amount: 10_000_000, qualifies: true },
        { id: "2", kind: "qaisi", category: "container_leasing", amount: 8_000_000, qualifies: true },
      ],
    }),
    {
      allPacks: [base({
        lines: [
          { id: "1", kind: "qisi", category: "international_transport", amount: 10_000_000, qualifies: true },
          { id: "2", kind: "qaisi", category: "container_leasing", amount: 8_000_000, qualifies: true },
        ],
      })],
    },
  )!;
  assertEq(capped.qaisiCap, 5_000_000, "Art. 3.3.4 cap = 50% × jurisdiction QISI");
  assertEq(capped.qaisiExcluded, 5_000_000, "QAISI excluded limited to cap");
  assertEq(capped.qaisiCappedOut, 3_000_000, "QAISI spill stays in GloBE");
  assert(capped.detail.includes("3.3.4"), "cap cited as Art. 3.3.4");
}

{
  console.log("Third-party bareboat is QAISI (Art. 3.3.3(a)), not QISI (¶157 / ¶163)");
  const third = computeShippingExclusion(
    "TEST-SHIP",
    base({
      lines: [
        { id: "1", kind: "qisi", category: "international_transport", amount: 4_000_000, qualifies: true },
        {
          id: "2",
          kind: "qaisi",
          category: "bareboat_charter_third_party",
          amount: 1_000_000,
          qualifies: true,
          notes: "lessor → non-CE shipping enterprise ≤ 3 years",
        },
      ],
    }),
    {
      allPacks: [base({
        lines: [
          { id: "1", kind: "qisi", category: "international_transport", amount: 4_000_000, qualifies: true },
          { id: "2", kind: "qaisi", category: "bareboat_charter_third_party", amount: 1_000_000, qualifies: true },
        ],
      })],
    },
  )!;
  assertEq(third.qisiGross, 4_000_000, "third-party bareboat not in QISI");
  assertEq(third.qaisiGross, 1_000_000, "third-party bareboat in QAISI");
  assertEq(third.incomeExcluded, 5_000_000, "both excluded subject to Art. 3.3.4");

  const wrongKind = computeShippingExclusion(
    "TEST-SHIP",
    base({
      lines: [
        // Mis-labelled as qisi + bareboat_charter_third_party must not qualify as QISI
        { id: "1", kind: "qisi", category: "bareboat_charter_third_party" as never, amount: 2_000_000, qualifies: true },
      ],
    }),
    {
      allPacks: [base({
        lines: [
          { id: "1", kind: "qisi", category: "bareboat_charter_third_party" as never, amount: 2_000_000, qualifies: true },
        ],
      })],
    },
  )!;
  assertEq(wrongKind.qisiGross, 0, "third-party bareboat category rejected from QISI set");
  assertEq(wrongKind.nonQualifyingKept, 2_000_000, "mis-labelled third-party bareboat kept in GloBE");
}

{
  console.log("Intragroup bareboat-out is QISI (Art. 3.3.2(d); Commentary ¶157)");
  const intra = computeShippingExclusion(
    "TEST-SHIP",
    base({
      lines: [
        {
          id: "1",
          kind: "qisi",
          category: "bareboat_charter_intragroup",
          amount: 2_500_000,
          qualifies: true,
          notes: "lessor → other CE of same MNE Group with International Shipping Income",
        },
      ],
    }),
    {
      allPacks: [base({
        lines: [
          { id: "1", kind: "qisi", category: "bareboat_charter_intragroup", amount: 2_500_000, qualifies: true },
        ],
      })],
    },
  )!;
  assertEq(intra.qisiExcluded, 2_500_000, "intragroup bareboat-out excluded as QISI");
  assertEq(intra.qaisiGross, 0, "intragroup bareboat-out is not QAISI");
}

{
  console.log("Inland haulage not QAISI (Commentary ¶171) — stays in GloBE");
  const inland = computeShippingExclusion(
    "TEST-SHIP",
    base({
      lines: [
        { id: "1", kind: "qisi", category: "international_transport", amount: 5_000_000, qualifies: true },
        {
          id: "2",
          kind: "non_qualifying",
          category: "inland_transport",
          amount: 900_000,
          qualifies: false,
          notes: "Commentary ¶171",
        },
      ],
    }),
    {
      allPacks: [base({
        lines: [
          { id: "1", kind: "qisi", category: "international_transport", amount: 5_000_000, qualifies: true },
          { id: "2", kind: "non_qualifying", category: "inland_transport", amount: 900_000, qualifies: false },
        ],
      })],
    },
  )!;
  assertEq(inland.qaisiGross, 0, "inland not counted as QAISI");
  assertEq(inland.nonQualifyingKept, 900_000, "inland remains in GloBE Income");
  assertEq(inland.incomeExcluded, 5_000_000, "only QISI excluded; inland not excluded");
}

{
  console.log("Loss-making QISI (Art. 3.3.1)");
  const lossPack = base({
    coveredTaxesOnShipping: -200_000,
    lines: [
      { id: "1", kind: "qisi", category: "international_transport", amount: -2_000_000, qualifies: true },
      { id: "2", kind: "qaisi", category: "container_leasing", amount: 500_000, qualifies: true },
    ],
  });
  const loss = computeShippingExclusion("TEST-SHIP", lossPack, { allPacks: [lossPack] })!;
  assertEq(loss.qisiExcluded, -2_000_000, "QISI loss is excluded (raises GloBE)");
  assertEq(loss.qaisiExcluded, 0, "no QAISI exclusion when jurisdiction QISI ≤ 0");
  assertEq(loss.globeDelta, 2_000_000, "excluding a loss increases GloBE Income");
}

{
  console.log("Flag vs management jurisdiction (Commentary ¶182)");
  const flagPack = base({
    ceJurisdiction: "SG",
    strategicManagementInCeJur: false,
    commercialManagementInCeJur: true,
    lines: [
      {
        id: "1",
        kind: "qisi",
        category: "international_transport",
        amount: 4_000_000,
        flagJurisdiction: "MH",
        qualifies: true,
      },
    ],
  });
  const flag = computeShippingExclusion("TEST-SHIP", flagPack, { allPacks: [flagPack] })!;
  assert(!flag.disqualified, "flag ≠ CE jurisdiction does not fail Art. 3.3.6");
  assertEq(flag.incomeExcluded, 4_000_000, "exclusion applies when commercial management is in CE jur");
  assert(flag.detail.includes("3.3.6") || flag.detail.includes("¶182") || flag.detail.includes("Flag"), "audit notes flag vs management");
}

{
  console.log("Engine path · SG-SHIP seed (corrected classifications)");
  const row = entityCalc("SG-SHIP");
  assert(!!row, "SG-SHIP is on the entityCalc path");
  if (row) {
    // FANIL 8.9m − QISI 5.8m − QAISI 2.2m = 0.9m (0.5 other + 0.4 inland ¶171)
    assertEq(row.globe, 900_000, "SG-SHIP GloBE keeps inland haulage + non-shipping residual");
    assertEq(row.covered, 160_000, "Covered Taxes after shipping tax exclusion (1.16m − 1.0m)");
    assert(!!row.shipping && row.shipping.incomeExcluded === 8_000_000, "shipping pack posts 8.0m exclusion");
    assert(!!row.shipping && row.shipping.qisiExcluded === 5_800_000, "QISI = transport 5.2 + sale 0.6");
    assert(!!row.shipping && row.shipping.qaisiExcluded === 2_200_000, "QAISI = third-party bareboat 0.8 + containers 1.4");
    assert(!!row.shipping && row.shipping.nonQualifyingKept === 400_000, "inland 0.4m kept in GloBE");
    assert(row.shipping!.detail.includes("3.3.6"), "live pack cites Art. 3.3.6");
    assert(row.shipping!.detail.includes("3.3.4"), "live pack cites Art. 3.3.4 for cap");
    assert(
      row.adjustments.some((a) => a.ruleId === "OECD-SHIP-33" && a.amount === -8_000_000),
      "waterfall shows Art. 3.3 adjustment −8.0m",
    );
  }

  const sg = calculateGroup("aetherion").find((c) => c.blendKey.startsWith("SG:") && c.blendKind === "main");
  assert(!!sg && sg.entities.some((e) => e.id === "SG-SHIP"), "SG-SHIP blends with Singapore HoldCo");
}

{
  console.log("JV path note");
  assert(computeShippingExclusion("SG-JV") === null, "SG-JV has no shipping pack — module inert");
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

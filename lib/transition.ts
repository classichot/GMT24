import { money } from "./format";
import { CIT_RATE, MIN_RATE } from "./deferredTax";
import { seedFacts } from "./seeds";

/** Art. 9.1 — transition cut-off for pre-GloBE anti-avoidance. */
export const TRANSITION_CUTOFF = "2021-11-30";
/** First Transition Year for both demo groups in this pack. */
export const TRANSITION_YEAR = "FY2025";

export type TransitionKind = "9.1.1" | "9.1.2" | "9.1.3";

export type TransitionFact = {
  id: string;
  kind: TransitionKind;
  entityId: string;
  iso: string;
  label: string;
  assetClass: string;
  transferDate: string | null;
  booksCarrying: number;
  transferorCarrying: number;
  accountingDta: number;
  excludedItem: boolean;
  inventory: boolean;
  taxPaidOnTransfer: number;
  evidence: string;
  note: string;
};

export type TransitionLine = TransitionFact & {
  globeCarrying: number;
  stepUpDisallowed: number;
  openingDtaAllowed: number;
  openingDtaExcluded: number;
  treatment: string;
  ruleId: string;
};

/**
 * Seeded Art. 9.1 facts for the Transition Year opening balance.
 * 9.1.1 — take pre-existing DT attributes (recast ≤ 15%).
 * 9.1.2 — exclude DTAs from post-30 Nov 2021 transactions on Chapter 3 excluded items.
 * 9.1.3 — non-inventory intra-group transfers after 30 Nov 2021: GloBE carrying = transferor CV; no artificial step-up / DTA.
 */
const AETHERION_FACTS: TransitionFact[] = [
  {
    id: "TR-TH-LOSS",
    kind: "9.1.1",
    entityId: "TH-CE",
    iso: "TH",
    label: "Pre-GloBE tax-loss DTA (origin FY2023)",
    assetClass: "Tax loss carry-forward",
    transferDate: null,
    booksCarrying: 0,
    transferorCarrying: 0,
    accountingDta: 2_400_000,
    excludedItem: false,
    inventory: false,
    taxPaidOnTransfer: 0,
    evidence: "Deferred_tax_rollforward.xlsx · Thai loss memorandum FY2023",
    note: "Reflected in financial accounts before Transition Year — taken into GloBE opening attributes at the Minimum Rate.",
  },
  {
    id: "TR-TH-PPE",
    kind: "9.1.1",
    entityId: "TH-CE",
    iso: "TH",
    label: "Opening PPE temporary difference DTL / DTA net",
    assetClass: "Plant & machinery",
    transferDate: null,
    booksCarrying: 38_400_000,
    transferorCarrying: 38_400_000,
    accountingDta: 610_000,
    excludedItem: false,
    inventory: false,
    taxPaidOnTransfer: 0,
    evidence: "Fixed_asset_register_TH.xlsx · Deferred_tax_rollforward.xlsx",
    note: "Ordinary temporary difference existing at Transition Year — Art. 9.1.1 opening attribute.",
  },
  {
    id: "TR-SG-DIV",
    kind: "9.1.2",
    entityId: "SG-HC",
    iso: "SG",
    label: "DTA on excluded dividend timing (post-cutoff hybrid)",
    assetClass: "Excluded dividend / equity",
    transferDate: "2022-06-15",
    booksCarrying: 0,
    transferorCarrying: 0,
    accountingDta: 480_000,
    excludedItem: true,
    inventory: false,
    taxPaidOnTransfer: 0,
    evidence: "SG_tax_provision_FY2022.xlsx · Dividend schedule",
    note: "DTA arose from a Chapter 3 excluded item in a transaction after 30 Nov 2021 — Art. 9.1.2 strips it from the Transition Year opening.",
  },
  {
    id: "TR-TH-IP",
    kind: "9.1.3",
    entityId: "TH-CE",
    iso: "TH",
    label: "Intra-group IP contribution (SG-HC → TH-CE)",
    assetClass: "Intangible — manufacturing know-how",
    transferDate: "2023-03-01",
    booksCarrying: 12_000_000,
    transferorCarrying: 4_200_000,
    accountingDta: 1_560_000,
    excludedItem: false,
    inventory: false,
    taxPaidOnTransfer: 0,
    evidence: "Intra_group_transfer_register.xlsx · IP contribution agreement 2023-03-01",
    note: "Non-inventory transfer after 30 Nov 2021 and before Transition Year — GloBE carrying stays at transferor CV; book step-up and related DTA are disallowed.",
  },
  {
    id: "TR-VN-LINE",
    kind: "9.1.3",
    entityId: "VN-CE",
    iso: "VN",
    label: "Line transfer with local CIT paid on gain",
    assetClass: "Production line",
    transferDate: "2022-11-20",
    booksCarrying: 6_800_000,
    transferorCarrying: 5_100_000,
    accountingDta: 340_000,
    excludedItem: false,
    inventory: false,
    taxPaidOnTransfer: 255_000,
    evidence: "VN_asset_transfer_memo.pdf · CIT assessment 2022",
    note: "Art. 9.1.3 carrying = transferor CV. Buyer may recognise a DTA limited to tax paid × Minimum Rate / local rate, capped at 15% of the GloBE basis gap.",
  },
  {
    id: "TR-TH-INV",
    kind: "9.1.3",
    entityId: "TH-CE",
    iso: "TH",
    label: "Inventory stock transfer (carve-out)",
    assetClass: "Inventory",
    transferDate: "2024-08-12",
    booksCarrying: 2_200_000,
    transferorCarrying: 1_900_000,
    accountingDta: 0,
    excludedItem: false,
    inventory: true,
    taxPaidOnTransfer: 0,
    evidence: "Inventory_transfer_TH.xlsx",
    note: "Inventory is outside Art. 9.1.3 — books carrying value stands for GloBE.",
  },
];

const THAICOAL_FACTS: TransitionFact[] = [
  {
    id: "TR-TC-AU-LOSS",
    kind: "9.1.1",
    entityId: "TC-AU-COAL",
    iso: "AU",
    label: "Pre-GloBE tax-loss DTA at 30% (origin FY2022–24)",
    assetClass: "Tax loss carry-forward",
    transferDate: null,
    booksCarrying: 0,
    transferorCarrying: 0,
    accountingDta: 21_000_000,
    excludedItem: false,
    inventory: false,
    taxPaidOnTransfer: 0,
    evidence: "Deferred_tax_rollforward.xlsx · AU loss schedule",
    note: "Recognised in the accounts before the Transition Year. Taken into GloBE at the Minimum Rate — the 30% Australian DTA is recast to 15%.",
  },
  {
    id: "TR-TC-TH-SOLAR",
    kind: "9.1.1",
    entityId: "TC-TH-NRG",
    iso: "TH",
    label: "Opening solar-farm PPE temporary difference (DTL)",
    assetClass: "Solar farms & BESS",
    transferDate: null,
    booksCarrying: 262_000_000,
    transferorCarrying: 262_000_000,
    accountingDta: 5_800_000,
    excludedItem: false,
    inventory: false,
    taxPaidOnTransfer: 0,
    evidence: "Fixed_asset_register_TH.xlsx · BOI project accounts",
    note: "Ordinary temporary difference existing at the Transition Year — Art. 9.1.1 opening attribute on the BOI CE.",
  },
  {
    id: "TR-TC-SG-DIV",
    kind: "9.1.2",
    entityId: "TC-SG-REN",
    iso: "SG",
    label: "DTA on excluded dividend timing (post-cutoff)",
    assetClass: "Excluded dividend / equity",
    transferDate: "2023-05-10",
    booksCarrying: 0,
    transferorCarrying: 0,
    accountingDta: 120_000,
    excludedItem: true,
    inventory: false,
    taxPaidOnTransfer: 0,
    evidence: "TC041 tax provision FY2023.xlsx · dividend schedule",
    note: "DTA arose from a Chapter 3 excluded item after 30 Nov 2021 — Art. 9.1.2 strips it from the Transition Year opening.",
  },
  {
    id: "TR-TC-ID-BARGE",
    kind: "9.1.3",
    entityId: "TC-ID-MINE",
    iso: "ID",
    label: "Barge fleet transferred from PT ThaiCoal Indo Tbk",
    assetClass: "Barges & tugs",
    transferDate: "2022-09-01",
    booksCarrying: 14_000_000,
    transferorCarrying: 9_500_000,
    accountingDta: 990_000,
    excludedItem: false,
    inventory: false,
    taxPaidOnTransfer: 990_000,
    evidence: "Intra_group_transfer_register_TC.xlsx · SKP 2022",
    note: "Non-inventory intra-group transfer after 30 Nov 2021 — GloBE carrying stays at the transferor's CV. Indonesian CIT was paid on the gain, so a DTA capped at tax paid × 15% / 22% may be recognised.",
  },
  {
    id: "TR-TC-TH-STOCK",
    kind: "9.1.3",
    entityId: "TC-TH-MIN",
    iso: "TH",
    label: "Coal stockpile transfer from the UPE (carve-out)",
    assetClass: "Inventory",
    transferDate: "2024-03-01",
    booksCarrying: 3_900_000,
    transferorCarrying: 3_600_000,
    accountingDta: 0,
    excludedItem: false,
    inventory: true,
    taxPaidOnTransfer: 0,
    evidence: "Inventory_transfer_TC.xlsx",
    note: "Inventory is outside Art. 9.1.3 — books carrying value stands for GloBE.",
  },
];

export const TRANSITION_FACTS = seedFacts<TransitionFact>({ aetherion: AETHERION_FACTS, thaicoal: THAICOAL_FACTS });

function afterCutoff(date: string | null) {
  return Boolean(date && date > TRANSITION_CUTOFF);
}

/** Art. 9.1.1 recast: an accounting DTA booked above the Minimum Rate is taken at 15% / domestic rate. */
function recastShare(iso: string) {
  const cit = CIT_RATE[iso] ?? 0.2;
  return Math.min(1, MIN_RATE / cit);
}

export function transitionLine(fact: TransitionFact): TransitionLine {
  if (fact.kind === "9.1.1") {
    const openingDtaAllowed = money(fact.accountingDta * recastShare(fact.iso));
    return {
      ...fact,
      globeCarrying: fact.booksCarrying,
      stepUpDisallowed: 0,
      openingDtaAllowed,
      openingDtaExcluded: money(Math.max(0, fact.accountingDta - openingDtaAllowed)),
      treatment: "Art. 9.1.1 — opening Transition Year attribute taken (recast ≤ 15%)",
      ruleId: "OECD-TR-91",
    };
  }

  if (fact.kind === "9.1.2") {
    const hit = fact.excludedItem && afterCutoff(fact.transferDate);
    return {
      ...fact,
      globeCarrying: fact.booksCarrying,
      stepUpDisallowed: 0,
      openingDtaAllowed: hit ? 0 : money(fact.accountingDta * recastShare(fact.iso)),
      openingDtaExcluded: hit ? fact.accountingDta : 0,
      treatment: hit
        ? "Art. 9.1.2 — DTA from post-cutoff excluded-item transaction stripped"
        : "Art. 9.1.2 — not engaged",
      ruleId: "OECD-TR-91",
    };
  }

  // Art. 9.1.3
  if (fact.inventory || !afterCutoff(fact.transferDate)) {
    return {
      ...fact,
      globeCarrying: fact.booksCarrying,
      stepUpDisallowed: 0,
      openingDtaAllowed: money(fact.accountingDta * recastShare(fact.iso)),
      openingDtaExcluded: money(Math.max(0, fact.accountingDta - money(fact.accountingDta * recastShare(fact.iso)))),
      treatment: fact.inventory
        ? "Inventory — Art. 9.1.3 does not rewrite carrying value"
        : "Pre-cutoff or non-transfer — books carrying stands",
      ruleId: "OECD-TR-91",
    };
  }

  const globeCarrying = fact.transferorCarrying;
  const stepUpDisallowed = money(Math.max(0, fact.booksCarrying - fact.transferorCarrying));
  const gap = money(Math.max(0, fact.booksCarrying - fact.transferorCarrying));
  const paidCap = fact.taxPaidOnTransfer > 0 ? money(Math.min(fact.taxPaidOnTransfer, gap * MIN_RATE)) : 0;
  const bookDtaDisallowed = money(Math.max(0, fact.accountingDta - paidCap));

  return {
    ...fact,
    globeCarrying,
    stepUpDisallowed,
    openingDtaAllowed: paidCap,
    openingDtaExcluded: bookDtaDisallowed,
    treatment: paidCap > 0
      ? "Art. 9.1.3 — transferor CV; DTA limited to tax paid on the transfer (≤ 15%)"
      : "Art. 9.1.3 — transferor CV; book step-up and related DTA disallowed",
    ruleId: "OECD-TR-91",
  };
}

export function transitionLines(entityId?: string) {
  return TRANSITION_FACTS
    .filter((f) => !entityId || f.entityId === entityId)
    .map(transitionLine);
}

export function transitionSummary(iso?: string) {
  const lines = transitionLines().filter((l) => !iso || l.iso === iso);
  return {
    transitionYear: TRANSITION_YEAR,
    cutoff: TRANSITION_CUTOFF,
    lines,
    count: lines.length,
    stepUpDisallowed: money(lines.reduce((a, l) => a + l.stepUpDisallowed, 0)),
    openingDtaAllowed: money(lines.reduce((a, l) => a + l.openingDtaAllowed, 0)),
    openingDtaExcluded: money(lines.reduce((a, l) => a + l.openingDtaExcluded, 0)),
    art911: lines.filter((l) => l.kind === "9.1.1").length,
    art912: lines.filter((l) => l.kind === "9.1.2").length,
    art913: lines.filter((l) => l.kind === "9.1.3").length,
  };
}

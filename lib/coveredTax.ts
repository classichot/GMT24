import { money } from "./format";
import { DATA } from "./model";
import { shippingPost } from "./shipping";
import { deferredTaxAdjustment } from "./deferredTax";
import { seedFacts } from "./seeds";

export type Article43Kind = "PE" | "tax-transparent" | "CFC" | "hybrid" | "distribution";

export type Article43Fact = {
  id: string;
  kind: Article43Kind;
  sourceEntityId: string;
  targetEntityId: string;
  tax: number;
  passiveIncome?: number;
  sourceDoc: string;
  detail: string;
};

export type Article43Line = Article43Fact & {
  sourceCode: string;
  targetCode: string;
  allocated: number;
  passiveCap: number | null;
};

/**
 * Seeded cross-border tax facts per demo group. The engine supports all five Article 4.3.2 routes;
 * Aetherion carries PE, CFC and distribution examples, ThaiCoal two distribution-tax allocations.
 */
const AETHERION_FACTS: Article43Fact[] = [
  {
    id: "A43-PE-TH",
    kind: "PE",
    sourceEntityId: "TH-CE",
    targetEntityId: "TH-PE",
    tax: 140_000,
    sourceDoc: "TH tax provision FY2026.xlsx",
    detail: "Main Entity tax attributable to Rayong PE income allocated to the PE under Art. 4.3.2(a).",
  },
  {
    id: "A43-CFC-AE",
    kind: "CFC",
    sourceEntityId: "JP-UPE",
    targetEntityId: "AE-CE",
    tax: 600_000,
    passiveIncome: 6_000_000,
    sourceDoc: "JP CFC inclusion schedule FY2026.xlsx",
    detail: "Japanese CFC tax on Aetherion MENA passive income; Art. 4.3.3 passive-income limitation applies.",
  },
  {
    id: "A43-DIST-NL",
    kind: "distribution",
    sourceEntityId: "UK-HC",
    targetEntityId: "NL-CE",
    tax: 180_000,
    sourceDoc: "UK010 distribution tax schedule FY2026.xlsx",
    detail: "Owner tax on the NL001 distribution allocated to the distributing CE under Art. 4.3.2(e).",
  },
];

const THAICOAL_FACTS: Article43Fact[] = [
  {
    id: "A43-DIST-TC-ID",
    kind: "distribution",
    sourceEntityId: "TC-SG-HC",
    targetEntityId: "TC-ID-COAL",
    tax: 1_200_000,
    sourceDoc: "Dividend WHT schedule FY2026.xlsx",
    detail: "Indonesian dividend withholding tax borne on the PT ThaiCoal Indo Tbk distribution to Singapore, allocated back to the distributing CE under Art. 4.3.2(e). Indonesia is already above 15%; this widens the QDMTT SH margin.",
  },
  {
    id: "A43-DIST-TC-CN",
    kind: "distribution",
    sourceEntityId: "TC-TH-PWR",
    targetEntityId: "TC-CN-PWR",
    tax: 300_000,
    sourceDoc: "Dividend WHT schedule FY2026.xlsx",
    detail: "Chinese 5% treaty withholding on the Shanxi dividend to ThaiCoal Power PCL, allocated to the distributing CE under Art. 4.3.2(e). China stays below 15% after the allocation — the residual still flows to the Thai IIR at the POPE.",
  },
];

export const ARTICLE43_FACTS = seedFacts<Article43Fact>({ aetherion: AETHERION_FACTS, thaicoal: THAICOAL_FACTS });

function targetBaseRate(entityId: string) {
  const f = DATA.financials.find((x) => x.entityId === entityId);
  if (!f) return 0;
  const adjustments = DATA.adjustments
    .filter((a) => a.entityId === entityId)
    .reduce((sum, a) => sum + a.amount, 0);
  const globe = money(f.fanil + adjustments - shippingPost(entityId).excludedIncome);
  const deferred = deferredTaxAdjustment(entityId) ?? f.deferredTax;
  const covered = money(f.currentTax + deferred + f.otherCovered - shippingPost(entityId).excludedTax);
  return globe > 0 ? covered / globe : 0;
}

export function article43Lines(): Article43Line[] {
  return ARTICLE43_FACTS.map((fact) => {
    const source = DATA.entities.find((e) => e.id === fact.sourceEntityId);
    const target = DATA.entities.find((e) => e.id === fact.targetEntityId);
    let passiveCap: number | null = null;
    let allocated = fact.tax;
    if ((fact.kind === "CFC" || fact.kind === "hybrid") && fact.passiveIncome != null) {
      const topUpRate = Math.max(0, 0.15 - targetBaseRate(fact.targetEntityId));
      passiveCap = money(topUpRate * fact.passiveIncome);
      allocated = money(Math.min(fact.tax, passiveCap));
    }
    return {
      ...fact,
      sourceCode: source?.code ?? fact.sourceEntityId,
      targetCode: target?.code ?? fact.targetEntityId,
      allocated,
      passiveCap,
    };
  });
}

export function article43Post(entityId: string) {
  const lines = article43Lines();
  const incoming = lines.filter((l) => l.targetEntityId === entityId);
  const outgoing = lines.filter((l) => l.sourceEntityId === entityId);
  const incomingAmount = money(incoming.reduce((sum, l) => sum + l.allocated, 0));
  const outgoingAmount = money(outgoing.reduce((sum, l) => sum + l.allocated, 0));
  return {
    incoming,
    outgoing,
    incomingAmount,
    outgoingAmount,
    net: money(incomingAmount - outgoingAmount),
  };
}

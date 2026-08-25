import { money } from "./format";
import { ADJUSTMENTS, ENTITIES, FINANCIALS } from "./model";
import { shippingPost } from "./shipping";
import { deferredTaxAdjustment } from "./deferredTax";

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
 * Seeded cross-border tax facts. The engine supports all five Article 4.3.2 routes;
 * this snapshot contains PE, CFC and distribution examples.
 */
export const ARTICLE43_FACTS: Article43Fact[] = [
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

function targetBaseRate(entityId: string) {
  const f = FINANCIALS.find((x) => x.entityId === entityId);
  if (!f) return 0;
  const adjustments = ADJUSTMENTS
    .filter((a) => a.entityId === entityId)
    .reduce((sum, a) => sum + a.amount, 0);
  const globe = money(f.fanil + adjustments - shippingPost(entityId).excludedIncome);
  const deferred = deferredTaxAdjustment(entityId) ?? f.deferredTax;
  const covered = money(f.currentTax + deferred + f.otherCovered - shippingPost(entityId).excludedTax);
  return globe > 0 ? covered / globe : 0;
}

export function article43Lines(): Article43Line[] {
  return ARTICLE43_FACTS.map((fact) => {
    const source = ENTITIES.find((e) => e.id === fact.sourceEntityId);
    const target = ENTITIES.find((e) => e.id === fact.targetEntityId);
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

import { money } from "./format";

/** Art. 3.4.3 — Qualified Ancillary International Shipping Income cannot exceed 50% of International Shipping Income. */
export const QAISI_CAP = 0.5;

export type ShippingFact = {
  entityId: string;
  /** Art. 3.4.2 International Shipping Income, net of attributable costs. */
  isi: number;
  /** Art. 3.4.3 ancillary net income before the 50% cap. */
  ancillary: number;
  /** Covered Taxes attributable to the excluded portion (Art. 4.1.3). */
  relatedTax: number;
  /** Eligible payroll used in generating excluded shipping income (Art. 5.3.3). */
  payroll: number;
  /** Eligible tangible assets (ships / ROU) used in excluded shipping (Art. 5.3.4). */
  assets: number;
  /** Art. 3.4.5 — strategic or commercial management of all ships effectively carried on from the CE's jurisdiction. */
  managementInJurisdiction: boolean;
  articleSource: string;
  sourceDoc: string;
  note: string;
};

export type ShippingPost = {
  entityId: string;
  present: boolean;
  isi: number;
  ancillary: number;
  ancillaryCap: number;
  qaisi: number;
  excessAncillary: number;
  excludedIncome: number;
  excludedTax: number;
  payrollStrip: number;
  assetStrip: number;
  managementOk: boolean;
  articleSource: string;
  sourceDoc: string;
  detail: string;
};

export const SHIPPING_FACTS: ShippingFact[] = [
  {
    entityId: "SG-SHIP",
    isi: 5_000_000,
    ancillary: 3_200_000,
    relatedTax: 750_000,
    payroll: 2_100_000,
    assets: 14_000_000,
    managementInJurisdiction: true,
    articleSource: "Art. 3.4.2(a)",
    sourceDoc: "SG020 Trial Balance FY2026.xlsx",
    note: "Intra-Asia component carriage in international traffic. Strategic and commercial management of the fleet is in Singapore.",
  },
  {
    entityId: "HK-CE",
    isi: 120_000,
    ancillary: 40_000,
    relatedTax: 8_000,
    payroll: 25_000,
    assets: 0,
    managementInJurisdiction: false,
    articleSource: "Art. 3.4.2(a)",
    sourceDoc: "HK001 TB FY2026.xlsx",
    note: "Feeder bookings sit in HK001 FANIL. Strategic and commercial management of the ships is in Singapore, not Hong Kong — Art. 3.4.5 fails; no exclusion.",
  },
];

const empty = (entityId: string): ShippingPost => ({
  entityId,
  present: false,
  isi: 0,
  ancillary: 0,
  ancillaryCap: 0,
  qaisi: 0,
  excessAncillary: 0,
  excludedIncome: 0,
  excludedTax: 0,
  payrollStrip: 0,
  assetStrip: 0,
  managementOk: false,
  articleSource: "Art. 3.4",
  sourceDoc: "",
  detail: "No International Shipping Income on this Constituent Entity.",
});

export function shippingPost(entityId: string): ShippingPost {
  const f = SHIPPING_FACTS.find((x) => x.entityId === entityId);
  if (!f) return empty(entityId);
  const ancillaryCap = money(f.isi * QAISI_CAP);
  const qaisi = money(Math.min(Math.max(0, f.ancillary), Math.max(0, ancillaryCap)));
  const excessAncillary = money(Math.max(0, f.ancillary - qaisi));
  if (!f.managementInJurisdiction) {
    return {
      entityId,
      present: true,
      isi: f.isi,
      ancillary: f.ancillary,
      ancillaryCap,
      qaisi,
      excessAncillary,
      excludedIncome: 0,
      excludedTax: 0,
      payrollStrip: 0,
      assetStrip: 0,
      managementOk: false,
      articleSource: f.articleSource,
      sourceDoc: f.sourceDoc,
      detail: `Art. 3.4.5 not met — strategic or commercial management of the ships is not effectively carried on from this jurisdiction. ISI ${f.isi.toLocaleString("en-GB")} and ancillary ${f.ancillary.toLocaleString("en-GB")} stay in GloBE. ${f.note}`,
    };
  }
  const excludedIncome = money(f.isi + qaisi);
  return {
    entityId,
    present: true,
    isi: f.isi,
    ancillary: f.ancillary,
    ancillaryCap,
    qaisi,
    excessAncillary,
    excludedIncome,
    excludedTax: money(f.relatedTax),
    payrollStrip: money(f.payroll),
    assetStrip: money(f.assets),
    managementOk: true,
    articleSource: f.articleSource,
    sourceDoc: f.sourceDoc,
    detail: `Art. 3.4.1 exclude ISI ${f.isi.toLocaleString("en-GB")} (${f.articleSource}) + QAISI ${qaisi.toLocaleString("en-GB")} (ancillary ${f.ancillary.toLocaleString("en-GB")} capped at 50% of ISI = ${ancillaryCap.toLocaleString("en-GB")}). Excess ancillary ${excessAncillary.toLocaleString("en-GB")} stays in GloBE. Related Covered Taxes ${f.relatedTax.toLocaleString("en-GB")} out of Adjusted Covered Taxes (Art. 4.1.3). Payroll ${f.payroll.toLocaleString("en-GB")} and tangible assets ${f.assets.toLocaleString("en-GB")} out of SBIE. ${f.note}`,
  };
}

export function shippingFactsForEntities(entityIds: string[]) {
  return entityIds.map(shippingPost).filter((s) => s.present);
}

export function eligiblePayroll(entityId: string, payrollEligible: number) {
  return money(Math.max(0, payrollEligible - shippingPost(entityId).payrollStrip));
}

export function eligibleAssets(entityId: string, tangibleEligible: number) {
  return money(Math.max(0, tangibleEligible - shippingPost(entityId).assetStrip));
}

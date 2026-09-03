import { money } from "./format";

/** Art. 3.1.3 GAAP screens. Defined here so fx.ts does not import thailand.ts, which imports engine.ts, which imports fx.ts. */
export const EUR_MATERIAL_PRESENTATION = 75_000_000;
export const EUR_PERMANENT_DIFF = 1_000_000;

/** Locked FY2026 mid-rates: local currency units per 1 USD. Thai THB uses BOT Notification No. 6. */
export type FxRow = {
  iso: string;
  currency: string;
  localPerUsd: number;
  asOf: string;
  source: string;
  pair: string;
};

export const FX_RATES: FxRow[] = [
  { iso: "USD", currency: "USD", localPerUsd: 1, asOf: "2025-12-31", source: "Presentation currency", pair: "USD/USD" },
  { iso: "XX", currency: "USD", localPerUsd: 1, asOf: "2025-12-31", source: "Stateless CE — presentation USD", pair: "USD/USD" },
  { iso: "JP", currency: "JPY", localPerUsd: 157.2, asOf: "2025-12-31", source: "UPE CFS average rate · FY2026", pair: "USD/JPY" },
  { iso: "SG", currency: "SGD", localPerUsd: 1.351, asOf: "2025-12-31", source: "UPE CFS average rate · FY2026", pair: "USD/SGD" },
  { iso: "TH", currency: "THB", localPerUsd: 38.45, asOf: "2025-12", source: "BOT average midpoint · December preceding FY2026 · Notif. No. 6", pair: "USD/THB" },
  { iso: "VN", currency: "VND", localPerUsd: 25_450, asOf: "2025-12-31", source: "UPE CFS average rate · FY2026", pair: "USD/VND" },
  { iso: "MY", currency: "MYR", localPerUsd: 4.47, asOf: "2025-12-31", source: "UPE CFS average rate · FY2026", pair: "USD/MYR" },
  { iso: "ID", currency: "IDR", localPerUsd: 16_200, asOf: "2025-12-31", source: "UPE CFS average rate · FY2026", pair: "USD/IDR" },
  { iso: "AE", currency: "AED", localPerUsd: 3.6725, asOf: "2025-12-31", source: "UPE CFS average rate · FY2026", pair: "USD/AED" },
  { iso: "GB", currency: "GBP", localPerUsd: 0.787, asOf: "2025-12-31", source: "UPE CFS average rate · FY2026", pair: "USD/GBP" },
  { iso: "DE", currency: "EUR", localPerUsd: 0.96, asOf: "2025-12-31", source: "UPE CFS average rate · FY2026", pair: "USD/EUR" },
  { iso: "FR", currency: "EUR", localPerUsd: 0.96, asOf: "2025-12-31", source: "UPE CFS average rate · FY2026", pair: "USD/EUR" },
  { iso: "NL", currency: "EUR", localPerUsd: 0.96, asOf: "2025-12-31", source: "UPE CFS average rate · FY2026", pair: "USD/EUR" },
  { iso: "IE", currency: "EUR", localPerUsd: 0.96, asOf: "2025-12-31", source: "UPE CFS average rate · FY2026", pair: "USD/EUR" },
  { iso: "LU", currency: "EUR", localPerUsd: 0.96, asOf: "2025-12-31", source: "UPE CFS average rate · FY2026", pair: "USD/EUR" },
  { iso: "HU", currency: "HUF", localPerUsd: 395, asOf: "2025-12-31", source: "UPE CFS average rate · FY2026", pair: "USD/HUF" },
  { iso: "US", currency: "USD", localPerUsd: 1, asOf: "2025-12-31", source: "Presentation currency", pair: "USD/USD" },
  { iso: "HK", currency: "HKD", localPerUsd: 7.78, asOf: "2025-12-31", source: "UPE CFS average rate · FY2026", pair: "USD/HKD" },
];

export function fxRate(iso: string): FxRow {
  return FX_RATES.find((r) => r.iso === iso) ?? FX_RATES[0];
}

export function fcFromUsd(iso: string, usd: number) {
  return Math.round(usd * fxRate(iso).localPerUsd);
}

export function usdFromFc(iso: string, fc: number) {
  const r = fxRate(iso);
  return money(fc / r.localPerUsd);
}

export function eurToUsd(eur: number) {
  return usdFromFc("DE", eur);
}

export const EUR_75M_USD = eurToUsd(EUR_MATERIAL_PRESENTATION);
export const EUR_1M_USD = eurToUsd(EUR_PERMANENT_DIFF);

export type GaapScreen = {
  basis: "upe" | "local";
  upeFanil: number;
  localFanil: number;
  permanentDiff: number;
  permLimit: number;
  presLimit: number;
  permOk: boolean;
  presOk: boolean;
  localAllowed: boolean;
  detail: string;
};

export function gaapScreen(opts: {
  basis: "upe" | "local";
  upeFanil: number;
  localFanil: number | undefined;
}): GaapScreen {
  const local = opts.localFanil ?? opts.upeFanil;
  const permanentDiff = money(Math.abs(local - opts.upeFanil));
  const permOk = permanentDiff < EUR_1M_USD;
  const presOk = permanentDiff < EUR_75M_USD;
  const localAllowed = permOk && presOk;
  return {
    basis: opts.basis,
    upeFanil: opts.upeFanil,
    localFanil: local,
    permanentDiff,
    permLimit: EUR_1M_USD,
    presLimit: EUR_75M_USD,
    permOk,
    presOk,
    localAllowed,
    detail: localAllowed
      ? `Art. 3.1.2/3.1.3 — permanent difference ${permanentDiff.toLocaleString("en-GB")} is below EUR 1m (${EUR_1M_USD.toLocaleString("en-GB")} USD) and EUR 75m presentation (${EUR_75M_USD.toLocaleString("en-GB")} USD). Local GAAP is an acceptable alternative if elected.`
      : `Art. 3.1.2/3.1.3 — permanent difference ${permanentDiff.toLocaleString("en-GB")} fails the EUR 1m / EUR 75m screens. FANIL stays on the UPE Acceptable Financial Accounting Standard.`,
  };
}

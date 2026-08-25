import { money } from "./format";
import { MIN_RATE } from "./deferredTax";
import { transitionLines } from "./transition";
import { deferredTaxAdjustment } from "./deferredTax";
import { FINANCIALS, ENTITIES } from "./model";

/** Seeded Art. 6.3.4 transfer for election restatement. */
export const TRANSFER_634 = {
  id: "TX-634-TH",
  iso: "TH",
  entityId: "TH-CE",
  label: "Rayong tooling fair-value step-up on intra-group contribution",
  booksGain: 2_400_000,
  taxBasisAlign: 1_800_000,
  evidence: "Intra_group_transfer_register.xlsx · Art. 6.3.4 memo",
};

/** Art. 4.6.1 immaterial prior-year Covered Tax decrease. */
export const IMMATERIAL_461 = {
  iso: "TH",
  amount: 180_000,
  note: "Prior-year Covered Tax decrease under EUR 1m — Art. 4.6.1 election posts in current year instead of reopening origin ETR.",
};

/** Art. 7.3 EDTS deemed distribution tax (demo fact for LU). */
export const EDTS_73 = {
  iso: "LU",
  deemedTax: 420_000,
  note: "Eligible Distribution Tax System — deemed distribution tax for the year.",
};

export type ElectionEffect = {
  globeAdj: number;
  coveredAdj: number;
  note: string;
  harbour?: boolean;
};

export function effect45(iso: string, globe: number, covered: number): ElectionEffect {
  const ents = ENTITIES.filter((e) => e.iso === iso).map((e) => e.id);
  const dt = money(ents.reduce((a, id) => a + (deferredTaxAdjustment(id) ?? 0), 0));
  // Replace Art. 4.4: strip DT movement; if GloBE loss, post deemed loss DTA at Minimum Rate.
  let coveredAdj = money(-dt);
  const notes = ["Art. 4.5 GloBE Loss Election — Art. 4.4 deferred-tax method replaced"];
  if (globe < 0) {
    const deemed = money(Math.abs(globe) * MIN_RATE);
    coveredAdj = money(coveredAdj + deemed);
    notes.push(`deemed GloBE Loss DTA ${deemed.toLocaleString("en-GB")}`);
  }
  return { globeAdj: 0, coveredAdj, note: notes.join(" · ") };
}

export function effect447(iso: string): ElectionEffect {
  const ents = ENTITIES.filter((e) => e.iso === iso).map((e) => e.id);
  const dt = money(ents.reduce((a, id) => a + Math.max(0, deferredTaxAdjustment(id) ?? 0), 0));
  return {
    globeAdj: 0,
    coveredAdj: money(-dt),
    note: `Art. 4.4.7 unclaimed accrual — excluded DTL category ${dt.toLocaleString("en-GB")} from Adjusted Covered Taxes`,
  };
}

export function effect461(iso: string): ElectionEffect | null {
  if (iso !== IMMATERIAL_461.iso) return null;
  return {
    globeAdj: 0,
    coveredAdj: -IMMATERIAL_461.amount,
    note: IMMATERIAL_461.note,
  };
}

export function effect634(iso: string, spread: boolean): ElectionEffect | null {
  if (iso !== TRANSFER_634.iso) return null;
  const full = money(TRANSFER_634.taxBasisAlign);
  const globeAdj = spread ? money(full / 5) : full;
  return {
    globeAdj,
    coveredAdj: 0,
    note: spread
      ? `Art. 6.3.4(c) — FV/tax-basis alignment spread (1/5 of ${full.toLocaleString("en-GB")})`
      : `Art. 6.3.4 — recognised fair-value / tax-basis alignment ${globeAdj.toLocaleString("en-GB")}`,
  };
}

export function effect73(iso: string): ElectionEffect | null {
  if (iso !== EDTS_73.iso) return null;
  return {
    globeAdj: 0,
    coveredAdj: EDTS_73.deemedTax,
    note: EDTS_73.note,
  };
}

export function effect913(iso: string): ElectionEffect {
  const lines = transitionLines().filter((l) => l.iso === iso && l.kind === "9.1.3");
  const allowed = money(lines.reduce((a, l) => a + l.openingDtaAllowed, 0));
  const excluded = money(lines.reduce((a, l) => a + l.openingDtaExcluded, 0));
  return {
    globeAdj: 0,
    coveredAdj: money(-excluded),
    note: `Art. 9.1.3 transition basis — DTA stripped ${excluded.toLocaleString("en-GB")}; allowed opening DTA ${allowed.toLocaleString("en-GB")}`,
  };
}

/** Owner share of Investment Entity GloBE / Covered when Art. 7.5 transparency elected. */
export function effect75(iso: string): ElectionEffect | null {
  const ie = ENTITIES.find((e) => e.type === "Investment" && e.iso === iso);
  if (!ie) return null;
  const f = FINANCIALS.find((x) => x.entityId === ie.id);
  if (!f) return null;
  // Transparency moves IE out of separate blend into owner — effect applied on IE blend (zero) and owner (add).
  return {
    globeAdj: money(-f.fanil),
    coveredAdj: money(-(f.currentTax + f.deferredTax)),
    note: `Art. 7.5 — IE ${ie.code} treated as tax transparent; income moved to owners`,
  };
}

export function effect75Owner(ownerIso: string): ElectionEffect | null {
  const ies = ENTITIES.filter((e) => e.type === "Investment");
  let globe = 0;
  let covered = 0;
  const notes: string[] = [];
  for (const ie of ies) {
    const owner = ENTITIES.find((e) => e.id === ie.parentId);
    if (!owner || owner.iso !== ownerIso) continue;
    const f = FINANCIALS.find((x) => x.entityId === ie.id);
    if (!f) continue;
    const share = ie.ownership / 100;
    globe += money(f.fanil * share);
    covered += money((f.currentTax + f.deferredTax) * share);
    notes.push(`${ie.code} × ${ie.ownership}%`);
  }
  if (!notes.length) return null;
  return {
    globeAdj: money(globe),
    coveredAdj: money(covered),
    note: `Art. 7.5 transparency into owner — ${notes.join(", ")}`,
  };
}

export function effect76(iso: string): ElectionEffect | null {
  const ie = ENTITIES.find((e) => e.type === "Investment" && e.iso === iso);
  if (!ie) return null;
  const f = FINANCIALS.find((x) => x.entityId === ie.id);
  if (!f) return null;
  // Taxable distribution method: exclude undistributed IE income from IE ETR (demo: strip 70% retained).
  const retained = money(f.fanil * 0.7);
  return {
    globeAdj: money(-retained),
    coveredAdj: 0,
    note: `Art. 7.6 taxable-distribution method — retained IE income ${retained.toLocaleString("en-GB")} out of IE ETR`,
  };
}

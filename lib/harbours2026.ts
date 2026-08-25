import { money } from "./format";
import { ENTITIES, FINANCIALS, INCENTIVES, type Entity, type ShResult } from "./model";
import { populationReconciliation } from "./population";
import { MIN_RATE } from "./deferredTax";

type HarbourCalc = {
  iso: string;
  name: string;
  blendKey: string;
  entities: Entity[];
  revenue: number;
  globeIncome: number;
  etr: number;
  sh: {
    outcome: ShResult;
    navigator: string;
    qdmttSH: ShResult;
    utprSH: ShResult;
    sbs: ShResult;
  };
};

export type HarbourRunRow = {
  iso: string;
  name: string;
  blendKey: string;
  harbour: string;
  article: string;
  result: ShResult;
  detail: string;
  zerosTopUp: boolean;
  fullGlobeRequired: boolean;
};

export type HarbourRunSummary = {
  rows: HarbourRunRow[];
  jurisdictions: number;
  fullGlobeRequired: number;
  harboursPass: number;
  harboursReview: number;
  harboursFail: number;
};

/** Seeded qualifying expenditure for SBTISH (Thailand BOI). */
export const SBTISH_EXPENDITURE = [
  { id: "SBT-TH-PPE", entityId: "TH-CE", incentiveId: "TH-BOI", label: "Rayong plant CapEx (qualifying)", amount: 18_400_000, qualified: true, evidence: "BOI_Certificate_TH001.pdf · CapEx ledger" },
  { id: "SBT-TH-RD", entityId: "TH-CE", incentiveId: "TH-BOI", label: "Process R&D wages", amount: 2_100_000, qualified: true, evidence: "Payroll_TH_FY2026.csv · R&D cost centre" },
  { id: "SBT-TH-MKT", entityId: "TH-CE", incentiveId: "TH-BOI", label: "Marketing (non-qualifying)", amount: 900_000, qualified: false, evidence: "GL marketing" },
];

export function sbtishTrace(entityId: string) {
  const lines = SBTISH_EXPENDITURE.filter((l) => l.entityId === entityId);
  const qualified = money(lines.filter((l) => l.qualified).reduce((a, l) => a + l.amount, 0));
  const total = money(lines.reduce((a, l) => a + l.amount, 0));
  const traced = lines.length > 0 && lines.some((l) => l.qualified);
  return { lines, qualified, total, traced, ratio: total > 0 ? qualified / total : 0 };
}

/** Simplified Income proxy for SETR SH — CbCR PBT ± limited adjustments. */
export function setrSimplified(calc: Pick<HarbourCalc, "entities">) {
  const cbcrProfit = money(calc.entities.reduce((a, e) => {
    const f = FINANCIALS.find((x) => x.entityId === e.id);
    return a + (f?.cbcrProfit ?? 0);
  }, 0));
  const cbcrTax = money(calc.entities.reduce((a, e) => {
    const f = FINANCIALS.find((x) => x.entityId === e.id);
    return a + (f?.cbcrTax ?? 0);
  }, 0));
  const simplifiedIncome = cbcrProfit;
  const simplifiedTax = cbcrTax;
  const setr = simplifiedIncome > 0 ? simplifiedTax / simplifiedIncome : 0;
  const pass = setr >= MIN_RATE;
  return {
    simplifiedIncome,
    simplifiedTax,
    setr,
    result: (pass ? "Pass" : simplifiedIncome <= 0 ? "Review" : "Fail") as ShResult,
    detail: `Simplified ETR ${(setr * 100).toFixed(1)}% on CbCR PBT ${simplifiedIncome.toLocaleString("en-GB")} (2026 package path).`,
  };
}

export function nmceSimplified() {
  const pop = populationReconciliation();
  const nm = pop.nonMaterialEntities;
  return {
    count: nm,
    result: (nm > 0 ? "Pass" : "N/A") as ShResult,
    detail: `${nm} Non-Material Constituent Entity records qualify for identity-level / CbCR-simplified reporting (SH_NMCE).`,
  };
}

export function permanentSimplified(calc: Pick<HarbourCalc, "revenue" | "globeIncome" | "etr">): { result: ShResult; detail: string } {
  // Permanent simplified calculations SH — routine / de minimis style permanent annex proxy.
  const rev = calc.revenue;
  const pass = rev < 10_000_000 && calc.globeIncome < 1_000_000;
  if (pass) return { result: "Pass", detail: "Permanent Simplified Calculations SH — de minimis-scale blend." };
  if (calc.etr >= MIN_RATE) return { result: "Review", detail: "ETR ≥ 15% — permanent simplified path optional; full GloBE still available." };
  return { result: "Fail", detail: "Above permanent simplified thresholds — full GloBE calculation required." };
}

export function sbtishResult(calc: Pick<HarbourCalc, "entities" | "etr" | "globeIncome">): { result: ShResult; detail: string; coveredAdd: number } {
  const withInc = calc.entities.filter((e) => e.incentiveIds.length);
  if (!withInc.length) return { result: "N/A", detail: "No substance-based incentive on this blend.", coveredAdd: 0 };
  const traces = withInc.map((e) => sbtishTrace(e.id));
  if (!traces.every((t) => t.traced)) {
    return { result: "Review", detail: "Incentive present but qualifying expenditure not fully traced — do not elect SBTISH.", coveredAdd: 0 };
  }
  const qualified = money(traces.reduce((a, t) => a + t.qualified, 0));
  // SBTISH treats qualified incentive as addition to covered taxes, capped at undertaxation support.
  const coveredAdd = money(Math.min(qualified * 0.15, Math.max(0, (MIN_RATE - Math.min(calc.etr, MIN_RATE)) * Math.max(0, calc.globeIncome))));
  const pass = calc.etr * calc.globeIncome + coveredAdd >= MIN_RATE * Math.max(0, calc.globeIncome);
  return {
    result: pass ? "Pass" : "Review",
    detail: `Qualifying expenditure ${qualified.toLocaleString("en-GB")} traced. Covered-tax addition ${coveredAdd.toLocaleString("en-GB")}.`,
    coveredAdd,
  };
}

/** RUN ALL SAFE HARBOURS — one matrix across TCSH, QDMTT SH, SETR, SBTISH, NMCE, permanent, UTPR/SbS. */
export function runAllSafeHarbours(calcs: HarbourCalc[]): HarbourRunSummary {
  const rows: HarbourRunRow[] = [];
  const nm = nmceSimplified();

  for (const c of calcs) {
    const push = (harbour: string, article: string, result: ShResult, detail: string, zerosTopUp: boolean) => {
      rows.push({
        iso: c.iso,
        name: c.name,
        blendKey: c.blendKey,
        harbour,
        article,
        result,
        detail,
        zerosTopUp: zerosTopUp && result === "Pass",
        fullGlobeRequired: result === "Fail" || result === "Review",
      });
    };

    push("Transitional CbCR", "OECD-TCSH-2026", c.sh.outcome, c.sh.navigator, true);
    push("QDMTT Safe Harbour", "QDMTT SH", c.sh.qdmttSH, "Central Record qualification + local QDMTT.", true);
    const setr = setrSimplified(c);
    push("Simplified ETR SH", "OECD-SETR-SH", setr.result, setr.detail, true);
    const sb = sbtishResult(c);
    push("SBTISH", "OECD-SBTISH", sb.result, sb.detail, false);
    const perm = permanentSimplified(c);
    push("Permanent simplified", "Permanent SH annex", perm.result, perm.detail, true);
    if (c.iso === "US") {
      push("UTPR / UPE SH", "US-SBS-2026", c.sh.utprSH, c.sh.navigator, true);
      push("Side-by-Side", "SbS", c.sh.sbs, "UPE-jurisdiction Side-by-Side path.", true);
    }
  }

  rows.push({
    iso: "GROUP",
    name: "Aetherion Group",
    blendKey: "group:nmce",
    harbour: "NMCE simplified",
    article: "NMCE SH",
    result: nm.result,
    detail: nm.detail,
    zerosTopUp: false,
    fullGlobeRequired: false,
  });

  const byJur = new Map<string, HarbourRunRow[]>();
  for (const r of rows) {
    if (r.iso === "GROUP") continue;
    const list = byJur.get(r.blendKey) ?? [];
    list.push(r);
    byJur.set(r.blendKey, list);
  }
  let fullGlobeRequired = 0;
  for (const [, list] of byJur) {
    const anyPass = list.some((r) => r.zerosTopUp);
    if (!anyPass) fullGlobeRequired += 1;
  }

  return {
    rows,
    jurisdictions: byJur.size,
    fullGlobeRequired,
    harboursPass: rows.filter((r) => r.result === "Pass").length,
    harboursReview: rows.filter((r) => r.result === "Review").length,
    harboursFail: rows.filter((r) => r.result === "Fail").length,
  };
}

export function incentiveEntities() {
  return INCENTIVES.map((i) => {
    const e = ENTITIES.find((x) => x.id === i.entityId);
    return { incentive: i, entity: e, trace: sbtishTrace(i.entityId) };
  });
}

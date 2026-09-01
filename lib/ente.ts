import { money } from "./format";

/** OECD Feb 2023 AG — Excess Negative Tax Expense (Arts. 4.1.5 and 5.2.1).
 *  Mandatory when positive Net GloBE Income and negative Adjusted Covered Taxes
 *  would otherwise produce a Top-up Tax Percentage above the 15% Minimum Rate.
 *  Elective (OECD_4.1.5) in a GloBE Loss year — handled separately as ACTTT.
 */
export type EntePriorRow = {
  blendKey: string;
  iso: string;
  amount: number;
};

export type EnteResult = {
  rawCovered: number;
  coveredForEtr: number;
  enteOriginated: number;
  enteApplied: number;
  enteCarryforward: number;
  mandatory521: boolean;
  reason: string;
};

export function applyEnte({
  globeIncome,
  coveredTax,
  priorEnte = 0,
}: {
  globeIncome: number;
  coveredTax: number;
  priorEnte?: number;
}): EnteResult {
  const rawCovered = money(coveredTax);
  const prior = Math.max(0, money(priorEnte));
  let covered = rawCovered;
  let applied = 0;
  let originated = 0;
  let mandatory521 = false;
  const bits: string[] = [];

  if (globeIncome > 0 && covered > 0 && prior > 0) {
    applied = money(Math.min(covered, prior));
    covered = money(covered - applied);
    bits.push(
      `Prior Excess Negative Tax Expense carry-forward ${applied.toLocaleString("en-GB")} reduces Adjusted Covered Taxes (OECD AG Feb 2023).`,
    );
  }

  if (globeIncome > 0 && covered < 0) {
    mandatory521 = true;
    originated = money(Math.abs(covered));
    covered = 0;
    bits.push(
      `Art. 5.2.1 Excess Negative Tax Expense is mandatory. Bare formula 15% − (negative ETR) would exceed the Minimum Rate. Negative Adjusted Covered Taxes ${originated.toLocaleString("en-GB")} are excluded from this year’s ETR (floor 0%), so Top-up % is 15%. The amount is carried forward.`,
    );
  }

  const carry = money(Math.max(0, prior - applied) + originated);
  if (!bits.length) bits.push("No Excess Negative Tax Expense this year.");

  return {
    rawCovered,
    coveredForEtr: covered,
    enteOriginated: originated,
    enteApplied: applied,
    enteCarryforward: carry,
    mandatory521,
    reason: bits.join(" "),
  };
}

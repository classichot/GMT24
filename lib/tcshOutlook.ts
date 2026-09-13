import type { JurCalc } from "./engine";
import { eligibilityEngine, switchKey, type EligStatus, type EligibilityRow } from "./electionEngine";
import { fyYearNum, nextFy, type YearRecord } from "./yearLedger";

/**
 * OECD Safe Harbours and Penalty Relief (Dec 2022) §1: the Transitional CbCR Safe Harbour is
 * available for Fiscal Years beginning on or before 31 December 2026 and ending before 1 July 2028.
 */
export const TCSH_LAST_START = "2026-12-31";
export const TCSH_LAST_END = "2028-06-30";

export function tcshPeriodOpen(fyStart: string, fyEnd: string) {
  return fyStart <= TCSH_LAST_START && fyEnd <= TCSH_LAST_END;
}

/** Shift an ISO date by whole years (FY boundaries move one year at a time). */
export function shiftYears(date: string, years: number) {
  const [y, m, d] = date.split("-");
  return `${Number(y) + years}-${m}-${d}`;
}

export type TcshThisFy = "Used" | "Pass — not elected" | "Review" | "Failed" | "Barred" | "N/A";

export type TcshNextStatus = "available" | "barred-once-out" | "barred-prior" | "period-closed" | "n/a";

export type TcshAlternative = {
  id: string;
  label: string;
  short: string;
  key: string | null;
  status: EligStatus;
  reason: string;
  /** Already switched on for this jurisdiction. */
  on: boolean;
};

export type TcshOutlook = {
  blendKey: string;
  iso: string;
  name: string;
  fy: string;
  thisFy: TcshThisFy;
  thisDetail: string;
  nextFy: string;
  nextStatus: TcshNextStatus;
  nextLabel: string;
  nextDetail: string;
  /** Once-out mark: this year's result alone bars TCSH from next FY (regardless of the period end). */
  onceOut: boolean;
  /** Fiscal year the blend first fell out of TCSH (locked record or the working year). */
  outSince: string | null;
  alternatives: TcshAlternative[];
  fullGlobe: boolean;
};

const ALTERNATIVES: { id: string; label: string; short: string }[] = [
  { id: "SH_QDMTT", label: "QDMTT Safe Harbour", short: "QDMTT SH" },
  { id: "SH_SBTI", label: "Substance-Based Tax Incentive Safe Harbour", short: "SBTISH" },
  { id: "SH_SETR", label: "Simplified ETR Safe Harbour (2026 package)", short: "Simplified ETR SH" },
  { id: "SH_SCSH", label: "Simplified Calculations Safe Harbour (permanent)", short: "Simplified calc SH" },
  { id: "SH_NMCE", label: "NMCE Simplified Calculations", short: "NMCE" },
];

function thisFyOf(c: JurCalc): { status: TcshThisFy; detail: string } {
  if (c.iso === "US") return { status: "N/A", detail: "UPE-jurisdiction path — Side-by-Side / UTPR Safe Harbour, TCSH not tested." };
  if (c.sh.barred) return { status: "Barred", detail: c.sh.navigator };
  if (c.sh.tcshUsed) return { status: "Used", detail: "Tests pass and SH_TCSH is elected — harbour used this year." };
  if (c.sh.outcome === "Pass") return { status: "Pass — not elected", detail: "Tests pass but SH_TCSH is not elected. Not using the harbour in a year it could apply counts as out." };
  if (c.sh.outcome === "Review") return { status: "Review", detail: c.sh.navigator };
  return { status: "Failed", detail: c.sh.navigator };
}

/** First FY in which a locked record shows the blend out of TCSH (failed, or eligible but not used). */
export function tcshOutSince(records: YearRecord[], blendKey: string, iso: string): string | null {
  const locked = records
    .filter((r) => r.locked)
    .sort((a, b) => fyYearNum(a.fy) - fyYearNum(b.fy));
  for (const r of locked) {
    const row = r.rows.find((x) => (x.blendKey ?? x.iso) === blendKey) ?? r.rows.find((x) => x.iso === iso);
    if (row && (row.tcshFailed || row.tcshBarred || row.tcshUsed === false)) return r.fy;
  }
  return null;
}

export function tcshOutlook(
  calcs: JurCalc[],
  opts: { fy: string; fyStart: string; fyEnd: string; electionsOn: Record<string, boolean>; yearRecords: YearRecord[] },
): TcshOutlook[] {
  const elig = eligibilityEngine(calcs);
  const next = nextFy(opts.fy);
  const nextOpen = tcshPeriodOpen(shiftYears(opts.fyStart, 1), shiftYears(opts.fyEnd, 1));

  return calcs.map((c) => {
    const t = thisFyOf(c);
    const outSince = tcshOutSince(opts.yearRecords, c.blendKey, c.iso) ?? (t.status !== "Used" && t.status !== "N/A" ? opts.fy : null);
    const onceOut = t.status === "Failed" || t.status === "Review" || t.status === "Pass — not elected" || t.status === "Barred";

    let nextStatus: TcshNextStatus;
    let nextLabel: string;
    let nextDetail: string;
    if (t.status === "N/A") {
      nextStatus = "n/a";
      nextLabel = "N/A";
      nextDetail = "TCSH is not the operative harbour for this blend.";
    } else if (t.status === "Barred") {
      nextStatus = "barred-prior";
      nextLabel = `Barred · out since ${outSince ?? "prior FY"}`;
      nextDetail = `Once out, always out — locked ${outSince ?? "prior"} record keeps TCSH closed for every remaining transition year.`;
    } else if (onceOut) {
      nextStatus = "barred-once-out";
      nextLabel = `Barred from ${next} · once out`;
      nextDetail = `${opts.fy} result "${t.status}" — locking this year bars TCSH for ${next} and later.${nextOpen ? "" : ` The transition period also closes: ${next} begins after ${TCSH_LAST_START}.`}`;
    } else if (!nextOpen) {
      nextStatus = "period-closed";
      nextLabel = `${next} · period closed`;
      nextDetail = `TCSH covers Fiscal Years beginning on or before ${TCSH_LAST_START} and ending by ${TCSH_LAST_END}. ${next} falls outside — permanent harbours or full GloBE from ${next}.`;
    } else {
      nextStatus = "available";
      nextLabel = `${next} · available`;
      nextDetail = `Used this year; re-test and re-elect SH_TCSH in ${next}.`;
    }

    const alternatives: TcshAlternative[] = ALTERNATIVES.map((a) => {
      const row: EligibilityRow | undefined = elig.find((r) => r.election.id === a.id && r.iso === c.iso);
      const key = switchKey(a.id, c.iso);
      return {
        ...a,
        key,
        status: row?.status ?? "n/a",
        reason: row?.reason ?? "Not tested for this blend.",
        on: Boolean(opts.electionsOn[key]),
      };
    });

    return {
      blendKey: c.blendKey,
      iso: c.iso,
      name: c.name,
      fy: opts.fy,
      thisFy: t.status,
      thisDetail: t.detail,
      nextFy: next,
      nextStatus,
      nextLabel,
      nextDetail,
      onceOut,
      outSince,
      alternatives,
      fullGlobe: !c.sh.tcshUsed && c.iso !== "US",
    };
  });
}

/** Blends that are out of TCSH — the once-out register. */
export function onceOutRegister(rows: TcshOutlook[]) {
  return rows.filter((r) => r.onceOut && r.thisFy !== "N/A");
}

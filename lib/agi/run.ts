/**
 * Calculation runs. Every number in AGI mode comes from the tested GloBE engine
 * (`lib/engine.ts`) through the same `runEngine` interface normal mode uses,
 * with the working election package restated by the shared Election Engine —
 * exactly what the Elections, Optimiser and Year Ledger screens show.
 * A run records the exact inputs and the case version it was produced from.
 */
import type { JurCalc } from "../engine";
import { totals } from "../engine";
import { runEngine } from "../ai/calc";
import { applyPackage, eligibilityEngine, flagsFromOn, type Restate } from "../electionEngine";
import { money } from "../format";
import { AGI_ENGINE, hashOf, toCalcInputs } from "./case";
import type { AgentClientId, CalcRun, CalcRunRow, CaseSnapshot } from "./types";

export type WorkingCalc = { calcs: JurCalc[]; restated: Restate[]; rows: CalcRunRow[]; totals: CalcRun["totals"]; coreTopUp: number };

/** Engine run plus the election-package overlay, merged per blend. */
export function workingCalc(s: CaseSnapshot, electionsOn: Record<string, boolean> = s.electionsOn): WorkingCalc {
  const calcs = runEngine(toCalcInputs(s), { electionsOn });
  const elig = eligibilityEngine(calcs);
  const restated = applyPackage(calcs, flagsFromOn(elig, electionsOn, s.sbieClaim));
  const rows: CalcRunRow[] = calcs.map((c) => {
    const r = restated.find((x) => (x.blendKey ?? x.iso) === c.blendKey) ?? restated.find((x) => x.iso === c.iso);
    const globe = r ? r.globe : c.globeIncome;
    const covered = r ? r.covered : c.coveredTax;
    const etrComputed = globe > 0;
    return {
      iso: c.iso,
      name: c.name,
      blendKey: c.blendKey,
      globeIncome: globe,
      coveredTax: covered,
      etr: etrComputed ? covered / globe : 0,
      etrComputed,
      sbie: r ? r.sbie : c.sbie,
      excess: r ? r.excess : c.excess,
      topUpRate: etrComputed ? Math.max(0, 0.15 - covered / globe) : 0,
      additionalCurrentTopUp: r?.additionalCurrent ?? c.additionalCurrentTopUp,
      jurisdictionalTopUp: r ? r.topUp : c.jurisdictionalTopUp,
      qdmtt: r ? r.qdmtt : c.collection.qdmtt,
      iir: r ? r.iir : c.collection.iir,
      utpr: r ? r.utpr : c.collection.utpr,
      exposure: r?.harbour ? "Safe harbour" : c.exposure,
      completeness: c.completeness,
    };
  });
  const sum = (f: (r: CalcRunRow) => number) => money(rows.reduce((a, r) => a + f(r), 0));
  return {
    calcs,
    restated,
    rows,
    totals: { topUp: sum((r) => r.jurisdictionalTopUp), qdmtt: sum((r) => r.qdmtt), iir: sum((r) => r.iir), utpr: sum((r) => r.utpr), globe: sum((r) => r.globeIncome), covered: sum((r) => r.coveredTax) },
    coreTopUp: totals(calcs).topUp,
  };
}

export function runInputsHash(s: CaseSnapshot, override?: { electionsOn?: Record<string, boolean> }) {
  return hashOf({
    groupId: s.groupId,
    fy: s.fy,
    electionsOn: override?.electionsOn ?? s.electionsOn,
    approvedMaps: s.approvedMaps,
    sbieClaim: s.sbieClaim,
    scenario: s.scenario,
    packOverlay: s.packOverlay,
    ruleVersions: s.ruleVersions,
    locks: s.yearRecords.filter((r) => r.locked).map((r) => r.fy),
  });
}

/** Run the engine for a case snapshot. `override.electionsOn` evaluates an alternative package without changing the case. */
export function runCase(s: CaseSnapshot, caseHash: string, label: string, by: AgentClientId, override?: { electionsOn?: Record<string, boolean> }): { run: CalcRun; calcs: JurCalc[]; working: WorkingCalc } {
  const electionsOn = override?.electionsOn ?? s.electionsOn;
  const working = workingCalc(s, electionsOn);
  const inputsHash = runInputsHash(s, override);
  const run: CalcRun = {
    id: `calc_${inputsHash.slice(0, 10)}`,
    label,
    caseHash,
    inputsHash,
    inputs: {
      electionsOn,
      approvedMaps: s.approvedMaps,
      sbieClaim: s.sbieClaim,
      scenario: s.scenario,
      ruleVersions: s.ruleVersions,
      dataVersion: `${s.groupId}/${s.fy}/${s.ingestStatus}`,
    },
    engine: AGI_ENGINE,
    rows: working.rows,
    totals: working.totals,
    coreTopUp: working.coreTopUp,
    ranAt: new Date().toISOString(),
    by,
  };
  return { run, calcs: working.calcs, working };
}

/** Scope a run's rows to the mission's jurisdictions. */
export function scopedRows(run: CalcRun, jurisdictions: string[]) {
  return run.rows.filter((r) => jurisdictions.includes(r.iso));
}

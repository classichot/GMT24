import { applyScenario, calculateGroup, totals, type AuditNode, type CalcCtx, type JurCalc, type ScenarioInput } from "../engine";
import { compareYears, buildTracks, entePriorRows, lastLocked, type YearRecord } from "../yearLedger";
import type { SbieMode } from "../electionEngine";
import type { PackOverlay } from "../packAmendments";
import { money } from "../format";

/**
 * Calculation interface. Structured access to the engine for every feature:
 * traces by rule, baseline-vs-working comparison, prior-year comparison and
 * isolated scenario execution. Nothing here writes to the store, so a scenario
 * can never leak into the approved calculation.
 */
export type CalcInputs = {
  groupId: string;
  fy: string;
  electionsOn: Record<string, boolean>;
  approvedMaps: Record<string, boolean>;
  yearRecords: YearRecord[];
  packOverlay: PackOverlay;
  scenario: ScenarioInput;
  sbieClaim: Record<string, SbieMode>;
};

export function runEngine(i: CalcInputs, override?: { electionsOn?: Record<string, boolean>; scenario?: ScenarioInput }): JurCalc[] {
  const prior = lastLocked(i.yearRecords, i.fy);
  const ctx: CalcCtx = {
    fy: i.fy,
    electionsOn: override?.electionsOn ?? i.electionsOn,
    approvedMaps: i.approvedMaps,
    tcshPrior: prior ? prior.rows.map((r) => ({ blendKey: r.blendKey ?? r.iso, iso: r.iso, fy: prior.fy, tcshUsed: r.tcshUsed, tcshFailed: r.tcshFailed })) : [],
    entePrior: entePriorRows(prior),
    packOverlay: i.packOverlay,
  };
  return applyScenario(calculateGroup(i.groupId, ctx), override?.scenario ?? i.scenario, i.packOverlay);
}

/** Core baseline: no elections, no simulator assumptions — the number the engine posts before any choice. */
export function baseline(i: CalcInputs): JurCalc[] {
  return runEngine(i, { electionsOn: {}, scenario: { boiExtend: false, payrollTh: 0, tpMargin: 3 } });
}

export function walk(node: AuditNode, fn: (n: AuditNode, depth: number) => void, depth = 0) {
  fn(node, depth);
  node.children?.forEach((c) => walk(c, fn, depth + 1));
}

export function nodesByRule(calcs: JurCalc[], ruleId: string): { calc: JurCalc; node: AuditNode }[] {
  const out: { calc: JurCalc; node: AuditNode }[] = [];
  for (const c of calcs) walk(c.audit, (n) => { if (n.ruleId === ruleId) out.push({ calc: c, node: n }); });
  return out;
}

export function sourcesIn(node: AuditNode): string[] {
  const s = new Set<string>();
  walk(node, (n) => { if (n.sourceFile) s.add(n.sourceFile); });
  return [...s];
}

export function rulesIn(node: AuditNode): { id: string; version: string }[] {
  const m = new Map<string, string>();
  walk(node, (n) => { if (n.ruleId) m.set(n.ruleId, n.ruleVersion ?? ""); });
  return [...m.entries()].map(([id, version]) => ({ id, version }));
}

export type Movement = {
  iso: string;
  name: string;
  blendKey: string;
  from: number;
  to: number;
  delta: number;
  etrFrom: number;
  etrTo: number;
  drivers: string[];
};

/** Working package vs Core baseline: which elections / assumptions moved which jurisdiction. */
export function movementVsBaseline(i: CalcInputs, working: JurCalc[]): Movement[] {
  const base = baseline(i);
  const out: Movement[] = [];
  for (const w of working) {
    const b = base.find((x) => x.blendKey === w.blendKey);
    if (!b) continue;
    const delta = money(w.jurisdictionalTopUp - b.jurisdictionalTopUp);
    if (!delta && Math.abs(w.etr - b.etr) < 0.00005) continue;
    const drivers: string[] = [];
    for (const [k, on] of Object.entries(i.electionsOn)) if (on && k.endsWith(`@${w.iso}`)) drivers.push(k);
    for (const [k, on] of Object.entries(i.electionsOn)) if (on && (k.endsWith("@GROUP") || !k.includes("@"))) drivers.push(k);
    if (w.iso === "TH" && (i.scenario.boiExtend || i.scenario.payrollTh)) drivers.push(`Simulator: BOI extend ${i.scenario.boiExtend ? "on" : "off"}, payroll +$${i.scenario.payrollTh.toLocaleString()}`);
    if (w.iso === "IE" && i.scenario.tpMargin !== 3) drivers.push(`Simulator: TP margin ${i.scenario.tpMargin}%`);
    if (w.sbie !== b.sbie && i.sbieClaim[w.iso]) drivers.push(`SBIE claim ${i.sbieClaim[w.iso]}`);
    out.push({ iso: w.iso, name: w.name, blendKey: w.blendKey, from: b.jurisdictionalTopUp, to: w.jurisdictionalTopUp, delta, etrFrom: b.etr, etrTo: w.etr, drivers });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/** Prior locked year vs the working package, using the year ledger's own comparison. */
export function movementVsPrior(i: CalcInputs, working: JurCalc[]) {
  const prior = lastLocked(i.yearRecords, i.fy);
  if (!prior) return null;
  const rows = working.map((c) => ({
    iso: c.iso, name: c.name, blendKey: c.blendKey, globe: c.globeIncome, covered: c.coveredTax, etr: c.etr, sbie: c.sbie, excess: c.excess,
    topUp: c.jurisdictionalTopUp, qdmtt: c.collection.qdmtt, iir: c.collection.iir, utpr: c.collection.utpr, harbour: c.exposure === "Safe harbour",
  }));
  return { prior, cmp: compareYears(prior, { fy: i.fy, electionsOn: i.electionsOn, sbieClaim: i.sbieClaim, rows }, buildTracks(i.yearRecords, { fy: i.fy, electionsOn: i.electionsOn })) };
}

export function groupTotals(calcs: JurCalc[]) {
  return totals(calcs);
}

/** Provisional inputs: anything the engine estimated or that X-Ray still questions. */
export function provisionalFlags(c: JurCalc, openFindingTitles: string[]): string[] {
  const out: string[] = [];
  if (c.completeness < 90) out.push(`Data completeness ${c.completeness}% — estimates in use.`);
  if (c.enteOriginated > 0) out.push("Excess Negative Tax Expense applied — carry-forward depends on next year's covered taxes.");
  if (c.additionalCurrentTopUp) out.push(`Additional Current Top-up Tax ${c.actttReason}`);
  out.push(...openFindingTitles.map((t) => `X-Ray open: ${t}`));
  return out;
}

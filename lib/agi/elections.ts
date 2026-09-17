/**
 * Options & Election Analyser. Takes the election scenarios the shared
 * Election Engine already restates, keeps those inside the mission scope, and
 * ranks them against the company's approved objectives. Rejected alternatives
 * stay in the output with the reason they were rejected.
 *
 * Scores are 0–1 per objective; the total is the weighted average using the
 * mission objective weights (0–5). Tax figures are engine-restated, not scored
 * by an LLM.
 */
import type { JurCalc } from "../engine";
import { electionById } from "../elections";
import { optimizeGlobe, scoreWorking, splitSwitch, type OptScenario } from "../electionEngine";
import { money } from "../format";
import type { CaseSnapshot, ElectionOption, MissionObjectives, MissionScope, OptionScore } from "./types";

const SBIE_PSEUDO = new Set(["SBIE_MAX", "SBIE_PARTIAL"]);

function inScope(sc: OptScenario, scope: MissionScope): { ok: boolean; why?: string } {
  for (const key of sc.elections) {
    if (SBIE_PSEUDO.has(key)) continue;
    const [id, iso] = splitSwitch(key);
    if (!scope.electionSet.includes(id)) return { ok: false, why: `${id} is outside the mission's election set` };
    if (iso !== "GROUP" && !scope.jurisdictions.includes(iso)) return { ok: false, why: `${iso} is outside the mission's jurisdiction scope` };
  }
  return { ok: true };
}

function clamp(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function scoreOption(sc: OptScenario, range: { min5: number; max5: number }): OptionScore {
  const spread = range.max5 - range.min5;
  const taxCash = spread > 0 ? clamp(1 - (sc.fy5 - range.min5) / spread) : 1;
  const electionsCount = sc.elections.filter((k) => !SBIE_PSEUDO.has(k)).length;
  const complianceEffort = clamp(sc.compliance === "harbour" ? 0.85 : sc.compliance === "mixed" ? 0.55 : 1 - electionsCount * 0.15);
  const evidenceSupport = !sc.bookable ? 0 : sc.audit === "low" ? 1 : sc.audit === "medium" ? 0.6 : 0.25;
  const uncertainty = clamp((sc.bookable ? 1 : 0.15) - (sc.audit === "high" ? 0.3 : 0));
  const futureRestriction = sc.lockYears ? 0.3 : 1;
  return { taxCash, complianceEffort, evidenceSupport, uncertainty, futureRestriction, total: 0 };
}

export function weightedTotal(s: OptionScore, w: MissionObjectives) {
  const sum = w.taxCash + w.complianceEffort + w.evidenceSupport + w.uncertainty + w.futureRestriction;
  if (!sum) return 0;
  return (s.taxCash * w.taxCash + s.complianceEffort * w.complianceEffort + s.evidenceSupport * w.evidenceSupport + s.uncertainty * w.uncertainty + s.futureRestriction * w.futureRestriction) / sum;
}

function approvalsFor(sc: OptScenario): string[] {
  const out: string[] = [];
  if (sc.lockYears) out.push(`Five-year lock: ${sc.lockYears} years; election binds every CE in the jurisdiction`);
  if (sc.compliance === "harbour") out.push("Safe-harbour test elected must be identified in the GIR");
  if (!sc.bookable) out.push("Not bookable on this snapshot — condition is Review or Unavailable");
  if (sc.elections.length) out.push("Election package decision by a person with approval permission");
  return out;
}

function dependenciesFor(sc: OptScenario): string[] {
  return sc.elections.filter((k) => !SBIE_PSEUDO.has(k)).map((k) => {
    const [id, iso] = splitSwitch(k);
    const e = electionById(id);
    return e ? `${e.article} ${e.name} @ ${iso} (${e.duration})` : k;
  });
}

function assumptionsFor(sc: OptScenario, s: CaseSnapshot): string[] {
  const out = [`Engine restated from GloBE Core on case ${s.fy}; SBIE ${sc.elections.includes("SBIE_PARTIAL") ? "partial (50%)" : sc.elections.includes("OECD_5.3.1@TH") ? "not claimed" : "maximum"}.`];
  if (sc.compliance === "harbour") out.push("Harbour jurisdictions post $0 top-up only while the elected test passes each year.");
  if (sc.lockYears) out.push("Five-year figure assumes stable income, covered tax and SBIE — it is a signal, not a forecast.");
  return out;
}

export function assessOptions(calcs: JurCalc[], s: CaseSnapshot, scope: MissionScope, caseHash: string) {
  const opt = optimizeGlobe(calcs);
  const working = scoreWorking(calcs, opt.elig, s.electionsOn, s.sbieClaim);
  const scenarios: OptScenario[] = [...opt.scenarios];
  const workingKeys = Object.entries(s.electionsOn).filter(([, v]) => v).map(([k]) => k).sort().join("|");
  if (workingKeys && !scenarios.some((x) => [...x.elections].sort().join("|") === workingKeys)) scenarios.push(working);

  const scoped = scenarios.map((sc) => ({ sc, scope: inScope(sc, scope) }));
  const candidates = scoped.filter((x) => x.scope.ok && x.sc.bookable).map((x) => x.sc);
  const range = {
    min5: Math.min(...candidates.map((c) => c.fy5)),
    max5: Math.max(...candidates.map((c) => c.fy5)),
  };

  const options: ElectionOption[] = scoped.map(({ sc, scope: sok }) => {
    const score = scoreOption(sc, range);
    score.total = sok.ok && sc.bookable ? weightedTotal(score, scope.objectives) : 0;
    const base = opt.scenarios[0];
    return {
      id: sc.id,
      title: sc.title,
      elections: sc.elections,
      fyTopUp: sc.fyTopUp,
      fy5: sc.fy5,
      deltaVsBaseline: money(sc.fyTopUp - base.fyTopUp),
      compliance: sc.compliance,
      audit: sc.audit,
      lockYears: sc.lockYears,
      eligible: sc.bookable,
      bookable: sc.bookable && sok.ok,
      score,
      rank: 0,
      assumptions: assumptionsFor(sc, s),
      dependencies: dependenciesFor(sc),
      approvals: approvalsFor(sc),
      rejectedBecause: !sok.ok ? sok.why : !sc.bookable ? `Not eligible on this snapshot: ${sc.why}` : undefined,
      why: sc.why,
      rows: sc.rows.filter((r) => scope.jurisdictions.includes(r.iso)).map((r) => ({ iso: r.iso, name: r.name, etr: r.etr, topUp: r.topUp, globeIncome: r.globe })),
    };
  });

  const ranked = [...options].sort((a, b) => (Number(b.bookable) - Number(a.bookable)) || b.score.total - a.score.total || a.fy5 - b.fy5);
  ranked.forEach((o, i) => { o.rank = i + 1; });
  const recommended = ranked.find((o) => o.bookable) ?? ranked[0];
  for (const o of ranked) {
    if (o.bookable && o.id !== recommended.id && !o.rejectedBecause) {
      const gaps = (Object.keys(scope.objectives) as (keyof MissionObjectives)[])
        .filter((k) => recommended.score[k] - o.score[k] > 0.15)
        .map((k) => k);
      o.rejectedBecause = gaps.length
        ? `Scored ${(o.score.total * 100).toFixed(0)} vs ${(recommended.score.total * 100).toFixed(0)}; weaker on ${gaps.join(", ")}.`
        : `Scored ${(o.score.total * 100).toFixed(0)} vs ${(recommended.score.total * 100).toFixed(0)} on the approved weights.`;
    }
  }

  return {
    assessment: {
      baselineId: "BASE",
      recommendedId: recommended.id,
      options: ranked,
      objectives: scope.objectives,
      method: `Election Engine restated ${scenarios.length} packages from GloBE Core (engine, not LLM). ${candidates.length} are bookable inside the mission scope. Each is scored 0–1 on tax/cash (five-year cost), compliance effort, evidence support, uncertainty and future restriction, then weighted by the approved objectives. Rejected alternatives are disclosed with the reason.`,
      caseHash,
    },
    elig: opt.elig,
    working,
  };
}

/** Election switch keys implied by an option id (SBIE pseudo-keys map to the SBIE claim). */
export function optionToChanges(o: ElectionOption): { electionsOn: Record<string, boolean>; sbieClaim?: { iso: string; mode: "max" | "partial" | "none" } } {
  const electionsOn: Record<string, boolean> = {};
  let sbieClaim: { iso: string; mode: "max" | "partial" | "none" } | undefined;
  for (const k of o.elections) {
    if (k === "SBIE_MAX") sbieClaim = { iso: "TH", mode: "max" };
    else if (k === "SBIE_PARTIAL") sbieClaim = { iso: "TH", mode: "partial" };
    else electionsOn[k] = true;
  }
  return { electionsOn, sbieClaim };
}

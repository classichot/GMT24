/**
 * Calculation Verification. Reproduces the calculation from the case version,
 * checks the engine arithmetic rule by rule, and folds in the shared AI
 * Calculation Reviewer (mapping, reconciliation, treatment, election,
 * movement and evidence checks). Every check states expected vs actual, the
 * rule it relies on and — when it fails — the concrete correction.
 *
 * A second AI agreeing is not a check. Checks here are deterministic.
 */
import type { JurCalc } from "../engine";
import { totals } from "../engine";
import { reviewCalculation } from "../ai/reviewer";
import { runXray } from "../xrayEngines";
import type { XrayState } from "../xray";
import { eur, etrPct, pct } from "../format";
import { DATA } from "../model";
import { ruleVersionRefs, toCalcInputs } from "./case";
import { runCase } from "./run";
import type { AgentClientId, CalcRun, CaseSnapshot, CheckResult } from "./types";

const MIN = 0.15;
const near = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;

export type VerifyInput = {
  snapshot: CaseSnapshot;
  caseHash: string;
  run: CalcRun;
  calcs: JurCalc[];
  jurisdictions: string[];
  xray?: XrayState;
  by: AgentClientId;
};

export function verifyCase(i: VerifyInput): CheckResult[] {
  const out: CheckResult[] = [];
  const { snapshot: s, run, jurisdictions } = i;
  const scoped = i.calcs.filter((c) => jurisdictions.includes(c.iso));

  // 1. Reproduce from the case version.
  const repro = runCase(s, i.caseHash, "Verification re-run", i.by, { electionsOn: run.inputs.electionsOn });
  const t = repro.run.totals;
  out.push({
    id: "repro-total",
    group: "reproduce",
    title: "Group top-up reproduced from the case version",
    status: near(t.topUp, run.totals.topUp) ? "pass" : "fail",
    expected: eur(run.totals.topUp),
    actual: `${eur(t.topUp)} (engine Core ${eur(repro.run.coreTopUp)} before the election overlay)`,
    rule: "GMT24-CALC 2026.2",
    href: "/top-up",
    correction: near(t.topUp, run.totals.topUp) ? undefined : "The run does not reproduce from its recorded inputs. Re-run the scenario on the current case version before relying on it.",
    severity: "block",
  });
  out.push({
    id: "repro-core",
    group: "reproduce",
    title: "Core engine total agrees with what Overview posts",
    status: near(totals(repro.calcs).topUp, repro.run.coreTopUp) ? "pass" : "fail",
    expected: eur(repro.run.coreTopUp),
    actual: eur(totals(repro.calcs).topUp),
    rule: "GMT24-CALC 2026.2",
    href: "/overview",
    severity: "block",
  });
  for (const r of run.rows.filter((r) => jurisdictions.includes(r.iso))) {
    const c = repro.run.rows.find((x) => x.blendKey === r.blendKey);
    const ok = Boolean(c) && near(c!.jurisdictionalTopUp, r.jurisdictionalTopUp) && near(c!.globeIncome, r.globeIncome) && near(c!.coveredTax, r.coveredTax);
    out.push({
      id: `repro-${r.blendKey}`,
      group: "reproduce",
      title: `${r.name}: income, covered tax and top-up reproduced`,
      status: ok ? "pass" : "fail",
      expected: `${eur(r.globeIncome)} / ${eur(r.coveredTax)} / ${eur(r.jurisdictionalTopUp)}`,
      actual: c ? `${eur(c.globeIncome)} / ${eur(c.coveredTax)} / ${eur(c.jurisdictionalTopUp)}` : "blend missing",
      iso: r.iso,
      href: `/etr?iso=${r.iso}`,
      severity: "block",
    });
  }

  // 2. Inputs: rule versions and data status.
  const active = ruleVersionRefs();
  const stale = run.inputs.ruleVersions.filter((r) => active.find((a) => a.id === r.id)?.version !== r.version);
  out.push({
    id: "rules-current",
    group: "inputs",
    title: "Rule versions used are the active versions",
    status: stale.length ? "fail" : "pass",
    expected: `${active.length} active rule versions`,
    actual: stale.length ? `${stale.length} stale: ${stale.map((r) => r.id).join(", ")}` : `${run.inputs.ruleVersions.length} matched`,
    rule: "Rule register",
    href: "/rules",
    correction: stale.length ? "Re-pin the case to pick up the current rule versions, then re-run." : undefined,
    severity: "block",
  });
  out.push({
    id: "data-ready",
    group: "inputs",
    title: "Data pack posted for the period",
    status: s.ingestStatus === "ready" ? "pass" : "fail",
    expected: "ready",
    actual: s.ingestStatus,
    href: "/data",
    correction: s.ingestStatus === "ready" ? undefined : "Load the period's data pack in Data Hub before verifying.",
    severity: "block",
  });

  // 3. Engine arithmetic, rule by rule, in scope.
  for (const c of scoped) {
    const sbieOk = near(c.sbie, c.payrollCarve + c.assetCarve);
    out.push({ id: `sbie-sum-${c.blendKey}`, group: "adjustments", title: `${c.name}: SBIE = payroll carve-out + tangible asset carve-out`, status: sbieOk ? "pass" : "fail", expected: eur(c.payrollCarve + c.assetCarve), actual: eur(c.sbie), rule: "OECD Art. 5.3", iso: c.iso, href: `/etr?iso=${c.iso}`, severity: "block" });
    const excessOk = near(c.excess, Math.max(0, c.globeIncome - c.sbie));
    out.push({ id: `excess-${c.blendKey}`, group: "adjustments", title: `${c.name}: Excess Profit = max(0, Net GloBE Income − SBIE)`, status: excessOk ? "pass" : "fail", expected: eur(Math.max(0, c.globeIncome - c.sbie)), actual: eur(c.excess), rule: "OECD Art. 5.2.2", iso: c.iso, href: `/etr?iso=${c.iso}`, severity: "block" });
    if (c.etrComputed) {
      const etrOk = Math.abs(c.etr - c.coveredTax / c.globeIncome) < 1e-9;
      out.push({ id: `etr-${c.blendKey}`, group: "treatment", title: `${c.name}: ETR = Adjusted Covered Taxes ÷ Net GloBE Income`, status: etrOk ? "pass" : "fail", expected: pct(c.coveredTax / c.globeIncome, 2), actual: etrPct(c, 2), rule: "OECD Art. 5.1.1", iso: c.iso, href: `/etr?iso=${c.iso}`, severity: "block" });
      const rateOk = Math.abs(c.topUpRate - Math.max(0, MIN - c.etr)) < 1e-9 && c.topUpRate <= MIN + 1e-9;
      out.push({ id: `rate-${c.blendKey}`, group: "treatment", title: `${c.name}: Top-up % = max(0, 15% − ETR), capped at 15%`, status: rateOk ? "pass" : "fail", expected: pct(Math.max(0, MIN - c.etr), 2), actual: pct(c.topUpRate, 2), rule: "OECD Art. 5.2.1", iso: c.iso, href: `/etr?iso=${c.iso}`, correction: rateOk ? undefined : "Check the covered-tax sign and the ENTE branch (Art. 5.2.1 cap).", severity: "block" });
    } else {
      const expectedCovered = c.globeIncome * MIN;
      const raw = c.coveredTaxRaw ?? c.coveredTax;
      const expectedActtt = raw < expectedCovered ? Math.max(0, expectedCovered - raw) : 0;
      const enteElected = Boolean(s.electionsOn[`OECD_4.1.5@${c.iso}`]);
      const status: CheckResult["status"] = c.etr === 0 && c.topUpRate === 0 ? (enteElected || near(c.additionalCurrentTopUp, expectedActtt, 2) ? "pass" : "warn") : "fail";
      out.push({
        id: `loss-${c.blendKey}`,
        group: "treatment",
        title: `${c.name}: Net GloBE Loss — no ETR; Art. 4.1.5 expected-tax test applied`,
        status,
        expected: `no ETR · Additional Current Top-up ${enteElected ? "carried as ENTE (Art. 4.1.5 election)" : eur(expectedActtt)}`,
        actual: `${etrPct(c)} · Additional Current Top-up ${eur(c.additionalCurrentTopUp)}${c.actttReason ? ` · ${c.actttReason}` : ""}`,
        rule: "OECD Art. 5.1.2 / Art. 4.1.5",
        iso: c.iso,
        href: `/etr?iso=${c.iso}`,
        severity: status === "fail" ? "block" : "warn",
      });
    }
    const coll = c.collection.qdmtt + c.collection.iir + c.collection.utpr;
    const collExpected = c.exposure === "Safe harbour" ? 0 : c.jurisdictionalTopUp;
    out.push({ id: `collect-${c.blendKey}`, group: "allocation", title: `${c.name}: QDMTT + IIR + UTPR reconciles to the jurisdictional top-up`, status: near(coll, collExpected) ? "pass" : "fail", expected: eur(collExpected), actual: `${eur(coll)} (QDMTT ${eur(c.collection.qdmtt)} · IIR ${eur(c.collection.iir)} · UTPR ${eur(c.collection.utpr)})`, rule: "OECD Art. 2.1–2.6 / Art. 10.1 QDMTT", iso: c.iso, href: `/top-up?iso=${c.iso}`, correction: near(coll, collExpected) ? undefined : "Charging allocation does not sum to the top-up. Check the jurisdiction pack (IIR / QDMTT / UTPR effective flags).", severity: "block" });
  }

  // 4. Shared reviewer: mapping, reconciliation, treatment, elections, movement, evidence.
  const inputs = toCalcInputs(s);
  const findings = reviewCalculation({
    calcs: i.calcs,
    inputs: { ...inputs, electionsOn: run.inputs.electionsOn },
    findings: runXray({ electionsOn: run.inputs.electionsOn }),
    xray: i.xray ?? {},
    approvedMaps: s.approvedMaps,
    groupId: s.groupId,
  }).filter((f) => !f.iso || jurisdictions.includes(f.iso));
  for (const f of findings) {
    const isValidation = f.kind === "validation";
    const evidenceUnknown = f.area === "evidence" && f.id.startsWith("xray-") && !i.xray;
    out.push({
      id: `rev-${f.id}`,
      group: f.area === "mapping" ? "inputs" : f.area === "reconciliation" ? "reconciliation" : f.area === "elections" ? "elections" : f.area === "evidence" ? "evidence" : "treatment",
      title: f.title,
      status: isValidation ? (evidenceUnknown ? "warn" : "fail") : "warn",
      expected: f.expected,
      actual: f.actual,
      rule: f.checked,
      iso: f.iso,
      href: f.href,
      correction: isValidation ? f.question : undefined,
      severity: evidenceUnknown ? "warn" : f.severity,
    });
  }

  // 5. Population: entities in scope appear in a blend. Flow-through entities allocate their income to owners (Art. 3.5) and are reported through them.
  const inPop = (e: (typeof DATA.entities)[number]) => jurisdictions.includes(e.iso) && !e.excludedReason && e.type !== "Excluded" && e.type !== "Tax-transparent";
  const missing = DATA.entities.filter((e) => inPop(e) && !i.calcs.some((c) => c.entities.some((x) => x.id === e.id)));
  const flowThrough = DATA.entities.filter((e) => jurisdictions.includes(e.iso) && e.type === "Tax-transparent");
  out.push({ id: "population", group: "reconciliation", title: "Every non-excluded constituent entity in scope sits in a jurisdictional blend", status: missing.length ? "fail" : "pass", expected: `${DATA.entities.filter(inPop).length} entities`, actual: missing.length ? `missing: ${missing.map((e) => e.code).join(", ")}` : `all present${flowThrough.length ? ` · ${flowThrough.map((e) => e.code).join(", ")} allocated to owners under Art. 3.5` : ""}`, rule: "OECD Art. 1.3 / 3.5 / 5.1", href: "/entities", severity: "block" });

  return dedupe(out).sort((a, b) => sev(a) - sev(b));
}

function sev(c: CheckResult) {
  const s = c.status === "fail" ? 0 : c.status === "warn" ? 1 : c.status === "pass" ? 2 : 3;
  return s * 10 + (c.severity === "block" ? 0 : c.severity === "warn" ? 1 : 2);
}

function dedupe(cs: CheckResult[]) {
  const seen = new Set<string>();
  return cs.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

export function checkSummary(checks: CheckResult[]) {
  const fails = checks.filter((c) => c.status === "fail");
  const blocking = fails.filter((c) => c.severity === "block");
  const warns = checks.filter((c) => c.status === "warn");
  const passes = checks.filter((c) => c.status === "pass");
  return { total: checks.length, blocking: blocking.length, fails: fails.length, warns: warns.length, passes: passes.length, passed: blocking.length === 0 };
}

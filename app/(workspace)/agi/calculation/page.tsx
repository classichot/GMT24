"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Calculator, ListChecks, RefreshCw } from "lucide-react";
import { NoMission } from "@/components/agi/AgiFrame";
import { EvidencePanel } from "@/components/agi/Evidence";
import { shortHash } from "@/lib/agi/case";
import { diffCases } from "@/lib/agi/diff";
import { latestRun } from "@/lib/agi/auditPack";
import { checkSummary } from "@/lib/agi/verify";
import { useAgi } from "@/lib/agi/useAgi";
import type { CalcRun, CaseSnapshot, CheckResult, MissionRecord } from "@/lib/agi/types";
import { etrPct, eur, pct } from "@/lib/format";

const GROUP_LABEL: Record<CheckResult["group"], string> = {
  reproduce: "Reproduction from the case version",
  inputs: "Inputs and mappings",
  adjustments: "Adjustments",
  allocation: "Allocation (QDMTT / IIR / UTPR)",
  reconciliation: "Reconciliation",
  treatment: "Treatment and rates",
  elections: "Elections",
  evidence: "Evidence",
};

export default function CalculationPage() {
  const agi = useAgi();
  const m = agi.selected;
  if (!m) return <NoMission />;
  return <Calculation m={m} />;
}

function snapshotForRun(base: CaseSnapshot, r: CalcRun): CaseSnapshot {
  return { ...base, electionsOn: r.inputs.electionsOn, approvedMaps: r.inputs.approvedMaps, sbieClaim: r.inputs.sbieClaim, scenario: r.inputs.scenario };
}

function Calculation({ m }: { m: MissionRecord }) {
  const agi = useAgi();
  const runs = m.runs.slice().reverse();
  const latest = latestRun(m);
  const [runId, setRunId] = useState<string | null>(null);
  const run = runs.find((r) => r.id === runId) ?? latest ?? null;
  const [filter, setFilter] = useState<"all" | "fail" | "warn" | "pass">("all");
  const [cmp, setCmp] = useState<string>("");
  const cs = checkSummary(m.checks);
  const busy = !!agi.busy;
  const locked = ["completed", "cancelled", "paused"].includes(m.state);
  const rows = run ? run.rows.filter((r) => m.scope.jurisdictions.includes(r.iso)) : [];
  const checks = m.checks.filter((c) => filter === "all" || c.status === filter);
  const groups = [...new Set(checks.map((c) => c.group))];
  const other = runs.find((r) => r.id === cmp);
  const diff = useMemo(() => (run && other && other.id !== run.id ? diffCases(snapshotForRun(m.case.snapshot, other), snapshotForRun(m.case.snapshot, run), other.id, run.id) : null), [m, run, other]);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, flex: 1 }}>Calculation Review</h2>
        <button className="btn btn-secondary" disabled={busy || locked} onClick={() => agi.tool("run_scenario", { missionId: m.id })}><Calculator size={15} />Run package</button>
        <button className="btn btn-primary" disabled={busy || locked || !latest} onClick={() => agi.tool("verify_calculation", { missionId: m.id, runId: run?.id, nonce: String(Date.now()).slice(-6) })} title="Reproduce the run from the case version and check it rule by rule"><ListChecks size={15} />Verify this case</button>
      </div>

      <div className="kpi-grid cols-4">
        <div className="kpi"><div className="kpi-label">Working top-up</div><div className="kpi-val" style={{ fontSize: 26 }}>{run ? eur(run.totals.topUp) : "—"}</div><div className="kpi-sub">{run ? `${run.id} · ${run.label}` : "no run on this mission"}</div></div>
        <div className="kpi"><div className="kpi-label">Engine Core</div><div className="kpi-val" style={{ fontSize: 26 }}>{run ? eur(run.coreTopUp) : "—"}</div><div className="kpi-sub">before elective overlay · what Overview posts</div></div>
        <div className="kpi"><div className="kpi-label">Checks</div><div className="kpi-val" style={{ fontSize: 26 }}>{cs.total ? `${cs.passes}/${cs.total}` : "—"}</div><div className={`kpi-sub${cs.blocking ? " hot" : ""}`}>{cs.total ? `${cs.blocking} blocking fail · ${cs.warns} warnings` : "not verified"}</div></div>
        <div className="kpi"><div className="kpi-label">Verified against</div><div className="kpi-val" style={{ fontSize: 26 }}>{m.verifiedAgainst ? shortHash(m.verifiedAgainst) : "—"}</div><div className={`kpi-sub${m.verifiedAgainst && m.verifiedAgainst !== m.case.hash ? " hot" : ""}`}>{m.verifiedAgainst ? (m.verifiedAgainst === m.case.hash ? "current case version" : "stale — case changed") : "no passing verification"}</div></div>
      </div>

      {runs.length > 0 && (
        <section className="panel">
          <div className="panel-head" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h4 style={{ flex: 1 }}>Calculation runs</h4>
            <span className="tag tag-outline">{runs.length} on this mission · drafts never touch the approved case</span>
          </div>
          <div className="panel-body" style={{ fontSize: 12 }}>
            <table className="table">
              <thead><tr><th>Calculation id</th><th>Label</th><th>Case</th><th className="num">Top-up</th><th className="num">QDMTT</th><th className="num">IIR</th><th className="num">UTPR</th><th>Elections on</th><th>Engine</th><th>Ran</th><th>By</th></tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className={`clickable${run?.id === r.id ? " selected" : ""}`} onClick={() => setRunId(r.id)}>
                    <td className="agi-mono">{r.id}</td><td>{r.label}</td><td className="agi-mono">{shortHash(r.caseHash)}{r.caseHash !== m.case.hash ? " (old)" : ""}</td>
                    <td className="num">{eur(r.totals.topUp)}</td><td className="num">{eur(r.totals.qdmtt)}</td><td className="num">{eur(r.totals.iir)}</td><td className="num">{eur(r.totals.utpr)}</td>
                    <td>{Object.values(r.inputs.electionsOn).filter(Boolean).length}</td><td>{r.engine}</td><td>{new Date(r.ranAt).toLocaleString("en-GB")}</td><td>{r.by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {run && (
        <section className="panel">
          <div className="panel-head"><h4>{run.id} · jurisdictions in scope</h4><span className="tag tag-outline">{rows.length} of {run.rows.length} blends</span></div>
          <div className="panel-body" style={{ fontSize: 12, overflowX: "auto" }}>
            <table className="table">
              <thead><tr><th>Jurisdiction</th><th className="num">GloBE income</th><th className="num">Covered tax</th><th className="num">ETR</th><th className="num">SBIE</th><th className="num">Excess profit</th><th className="num">Top-up %</th><th className="num">Top-up</th><th className="num">QDMTT</th><th className="num">IIR</th><th className="num">UTPR</th><th>Exposure</th><th className="num">Completeness</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.blendKey}>
                    <td>{r.name} <span className="agi-mono">{r.iso}</span>{r.blendKey !== r.iso && <span className="agi-mono" style={{ color: "var(--color-neutral-600)" }}> · {r.blendKey}</span>}</td>
                    <td className="num">{eur(r.globeIncome)}</td><td className="num">{eur(r.coveredTax)}</td><td className="num">{etrPct(r)}</td><td className="num">{eur(r.sbie)}</td><td className="num">{eur(r.excess)}</td>
                    <td className="num">{r.etrComputed ? pct(r.topUpRate) : "—"}</td><td className="num" style={{ fontWeight: 700 }}>{eur(r.jurisdictionalTopUp)}</td>
                    <td className="num">{eur(r.qdmtt)}</td><td className="num">{eur(r.iir)}</td><td className="num">{eur(r.utpr)}</td>
                    <td><span className={`tag ${r.exposure === "high" ? "tag-hot" : r.exposure === "medium" ? "tag-warn" : "tag-neutral"}`} style={{ fontSize: 10 }}>{r.exposure}</span></td>
                    <td className="num">{r.completeness}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 8, color: "var(--color-neutral-600)" }}>Every figure comes from GMT24-CALC (engine plus Election Engine overlay), never from an agent. Loss jurisdictions show no ETR (Art. 5.1.2). Drill into the same numbers in normal mode: <Link href="/etr">ETR</Link>, <Link href="/top-up">Top-up</Link>, <Link href="/allocation">Allocation</Link>, <Link href="/audit">Audit trail</Link>.</div>
          </div>
        </section>
      )}

      {runs.length > 1 && run && (
        <section className="panel">
          <div className="panel-head" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h4 style={{ flex: 1 }}>Why did this number change? <span style={{ fontWeight: 400, fontSize: 12, color: "var(--color-neutral-600)" }}>compare {run.id} with another run</span></h4>
            <select className="input" style={{ maxWidth: 360, minHeight: 32, fontSize: 12 }} value={cmp} onChange={(e) => setCmp(e.target.value)}>
              <option value="">Choose the earlier run…</option>
              {runs.filter((r) => r.id !== run.id).map((r) => <option key={r.id} value={r.id}>{r.id} · {r.label} · {eur(r.totals.topUp)}</option>)}
            </select>
          </div>
          {diff && (
            <div className="panel-body agi-two" style={{ fontSize: 12 }}>
              <table className="table">
                <thead><tr><th>Driver</th><th className="num">Δ top-up</th><th>Detail</th></tr></thead>
                <tbody>
                  <tr><td><strong>Total</strong></td><td className="num" style={{ fontWeight: 800 }}>{diff.totalDelta >= 0 ? "+" : "−"}{eur(Math.abs(diff.totalDelta))}</td><td>{other?.id} → {run.id}</td></tr>
                  {diff.attribution.map((a) => <tr key={a.driver + a.label}><td><span className={`tag ${a.driver === "unexplained" ? "tag-hot" : "tag-neutral"}`} style={{ fontSize: 10 }}>{a.driver}</span> {a.label}</td><td className="num">{a.delta >= 0 ? "+" : "−"}{eur(Math.abs(a.delta))}</td><td>{a.detail}</td></tr>)}
                  {diff.attribution.length === 0 && <tr><td colSpan={3}>Same inputs — no movement.</td></tr>}
                </tbody>
              </table>
              <table className="table">
                <thead><tr><th>Jurisdiction</th><th className="num">Earlier</th><th className="num">This run</th><th className="num">Δ</th></tr></thead>
                <tbody>
                  {diff.byJurisdiction.map((r) => <tr key={r.iso + r.name}><td>{r.name} <span className="agi-mono">{r.iso}</span></td><td className="num">{eur(r.from)}</td><td className="num">{eur(r.to)}</td><td className="num" style={{ fontWeight: 700 }}>{r.delta >= 0 ? "+" : "−"}{eur(Math.abs(r.delta))}</td></tr>)}
                  {diff.byJurisdiction.length === 0 && <tr><td colSpan={4}>No jurisdiction moved.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="panel">
        <div className="panel-head" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h4 style={{ flex: 1 }}>Verification checks</h4>
          {(["all", "fail", "warn", "pass"] as const).map((f) => (
            <button key={f} className={`chip${filter === f ? " active" : ""}`} style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setFilter(f)}>{f} {f === "all" ? cs.total : f === "fail" ? cs.fails : f === "warn" ? cs.warns : cs.passes}</button>
          ))}
          {m.checks.length > 0 && <button className="btn btn-ghost" disabled={busy || locked} onClick={() => agi.tool("verify_calculation", { missionId: m.id, runId: run?.id, nonce: String(Date.now()).slice(-6) })}><RefreshCw size={13} />Re-verify</button>}
        </div>
        <div className="panel-body" style={{ fontSize: 12 }}>
          {!m.checks.length && <div className="callout">Not verified on this case version. “Verify this case” reproduces the run from the pinned inputs and checks arithmetic, inputs, allocation, rates, elections and evidence against the rule pack. Blocking failures move the mission to Validation Failed and propose corrections — nothing is applied.</div>}
          {groups.map((g) => (
            <div key={g} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-600)", margin: "6px 0" }}>{GROUP_LABEL[g]}</div>
              <table className="table">
                <thead><tr><th>Check</th><th>Status</th><th>Expected</th><th>Actual</th><th>Rule</th><th>Correction / note</th></tr></thead>
                <tbody>
                  {checks.filter((c) => c.group === g).map((c) => (
                    <tr key={c.id} className={c.status === "fail" ? "agi-check-fail" : c.status === "warn" ? "agi-check-warn" : ""}>
                      <td><div>{c.title}</div><div className="agi-mono" style={{ color: "var(--color-neutral-600)" }}>{c.id}{c.iso ? ` · ${c.iso}` : ""}</div></td>
                      <td><span className={`tag ${c.status === "pass" ? "tag-ok" : c.status === "fail" ? (c.severity === "block" ? "tag-hot" : "tag-warn") : c.status === "warn" ? "tag-warn" : "tag-neutral"}`} style={{ fontSize: 10 }}>{c.status}{c.status === "fail" ? ` · ${c.severity}` : ""}</span></td>
                      <td>{c.expected}</td><td>{c.actual}</td><td>{c.rule ?? "—"}</td>
                      <td>{c.correction ?? "—"}{c.href && <> · <Link href={c.href}>open</Link></>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      <EvidencePanel m={m} supports="verify" title="Evidence behind the verification" compact />
    </div>
  );
}

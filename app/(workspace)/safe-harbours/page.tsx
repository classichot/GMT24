"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCalc } from "@/lib/useCalc";
import { pct } from "@/lib/format";
import { runAllSafeHarbours, sbtishTrace, SBTISH_EXPENDITURE } from "@/lib/harbours2026";

const TESTS = [
  ["deMinimis", "De minimis"],
  ["simplifiedEtr", "Simplified ETR (17% FY26/27)"],
  ["routineProfits", "Routine profits"],
  ["qdmttSH", "QDMTT Safe Harbour"],
  ["sbtish", "Substance-based Tax Incentive SH"],
  ["utprSH", "Transitional UTPR SH"],
  ["sbs", "Side-by-Side / UPE"],
] as const;

export default function SafeHarbourPage() {
  const { calcs } = useCalc();
  const [ran, setRan] = useState(false);
  const summary = useMemo(() => runAllSafeHarbours(calcs), [calcs]);
  const thTrace = sbtishTrace("TH-CE");

  return (
    <div>
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Safe Harbour Navigator</strong> is a generic framework, not a hard-coded Transitional CbCR screen. Tests are selected from the effective-dated rulebook (OECD-TCSH-2026 v2026.2; Simplified ETR SH; SBTISH with expenditure tracing; NMCE; Permanent SH; QDMTT SH; UTPR SH; SbS).
          {" "}<strong>Once out, always out:</strong> if a blend fails TCSH or does not elect it in a year it could have used it, the year lock bars TCSH for remaining transition years.
        </div>
        <div className="stack-actions">
          <button className="btn btn-primary" onClick={() => setRan(true)}>Run all safe harbours</button>
          <Link href="/elections" className="btn btn-secondary">SETR inner elections</Link>
          <Link href="/years" className="btn btn-secondary">Year record</Link>
        </div>
      </div>

      {ran ? (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <h4>Harbour decision engine</h4>
            <span className="tag tag-ok">{summary.jurisdictions} blends · {summary.fullGlobeRequired} need full GloBE</span>
          </div>
          <div className="kpi-grid cols-4" style={{ padding: "12px 16px 0" }}>
            <div className="kpi"><div className="kpi-label">Pass</div><div className="kpi-val">{summary.harboursPass}</div></div>
            <div className="kpi"><div className="kpi-label">Review</div><div className="kpi-val">{summary.harboursReview}</div></div>
            <div className="kpi"><div className="kpi-label">Fail</div><div className="kpi-val">{summary.harboursFail}</div></div>
            <div className="kpi"><div className="kpi-label">Full GloBE still required</div><div className="kpi-val">{summary.fullGlobeRequired}</div><div className="kpi-sub">of {summary.jurisdictions} blends</div></div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Jurisdiction</th><th>Safe harbour</th><th>Article</th><th>Result</th><th>Detail</th></tr>
              </thead>
              <tbody>
                {summary.rows.map((r) => (
                  <tr key={`${r.blendKey}-${r.harbour}`}>
                    <td>{r.name}</td>
                    <td>{r.harbour}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{r.article}</td>
                    <td><span className={`tag ${r.result === "Pass" ? "tag-ok" : r.result === "Fail" ? "tag-hot" : r.result === "Review" ? "tag-warn" : "tag-neutral"}`}>{r.result}</span></td>
                    <td style={{ fontSize: 12 }}>{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h4>SBTISH expenditure trace · TH001</h4><span className="tag tag-outline">{Math.round(thTrace.ratio * 100)}% qualified</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Line</th><th>Amount</th><th>Qualified</th><th>Evidence</th></tr></thead>
            <tbody>
              {SBTISH_EXPENDITURE.map((l) => (
                <tr key={l.id}>
                  <td>{l.label}</td>
                  <td className="num">{l.amount.toLocaleString("en-GB")}</td>
                  <td>{l.qualified ? <span className="tag tag-ok">Yes</span> : <span className="tag tag-hot">No</span>}</td>
                  <td style={{ fontSize: 12 }}>{l.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-wrap panel">
        <table className="table">
          <thead>
            <tr>
              <th>Jurisdiction</th>
              {TESTS.map(([, l]) => <th key={l}>{l}</th>)}
              <th>TCSH</th>
              <th>Navigator</th>
            </tr>
          </thead>
          <tbody>
            {calcs.map((c) => (
              <tr key={c.blendKey}>
                <td>
                  <div style={{ fontWeight: 700 }}>{c.name}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>CbCR ETR path · GloBE {pct(c.etr, 1)}</div>
                </td>
                {TESTS.map(([k]) => {
                  const v = c.sh[k];
                  const cls = v === "Pass" ? "tag-ok" : v === "Fail" ? "tag-hot" : v === "Review" ? "tag-warn" : "tag-neutral";
                  return <td key={k}><span className={`tag ${cls}`}>{v}</span></td>;
                })}
                <td>
                  {c.sh.barred ? <span className="tag tag-hot">Barred</span>
                    : c.sh.tcshUsed ? <span className="tag tag-ok">Used</span>
                    : c.sh.tcshFailed ? <span className="tag tag-hot">Failed</span>
                    : <span className="tag tag-warn">Not elected</span>}
                </td>
                <td style={{ fontSize: 12, maxWidth: 320 }}>{c.sh.navigator}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

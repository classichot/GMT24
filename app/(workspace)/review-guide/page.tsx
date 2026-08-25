"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ACCOUNTS, FILES } from "@/lib/model";
import { useStore } from "@/lib/store";
import { useCalc } from "@/lib/useCalc";
import { REVIEW_PHASES, reviewChecks, reviewScore } from "@/lib/reviewGuide";
import { SAMPLE_DOWNLOADS } from "@/lib/ingestSim";
import { eur } from "@/lib/format";

export default function ReviewGuidePage() {
  const { ingestStatus, loadDemoPack, resetIngest, workflow, approvedMaps, flash, group } = useStore();
  const { calcs, t } = useCalc();
  const pending = ACCOUNTS.filter((a) => !a.approved && !approvedMaps[a.account]).length;
  const checks = useMemo(
    () =>
      reviewChecks({
        calcs,
        ingestReady: ingestStatus === "ready",
        pendingMaps: pending,
        approvedMaps: Object.keys(approvedMaps).length,
        reviewerRan: workflow.reviewerRan,
        girValidated: workflow.girValidated,
        snapshotApproved: workflow.snapshotApproved,
      }),
    [calcs, ingestStatus, pending, approvedMaps, workflow],
  );
  const score = reviewScore(checks);

  return (
    <div>
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>App reviewer walkthrough · {group.name} · {group.fy}.</strong>{" "}
          Ingest sample files or the full demo close pack, approve mappings, then compare live engine output to the anchor checks below. Every euro amount is clickable for rule → entity → account → source.
        </div>
        <div className="stack-actions">
          {ingestStatus === "empty" && (
            <button type="button" className="btn btn-primary" onClick={() => loadDemoPack()}>
              Load demo close pack
            </button>
          )}
          {ingestStatus === "ready" && (
            <button type="button" className="btn btn-secondary" onClick={() => resetIngest()}>
              Reset ingest
            </button>
          )}
          <Link href="/data" className="btn btn-secondary">Data Hub</Link>
        </div>
      </div>

      <div className="kpi-grid cols-4" style={{ marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Review progress</div>
          <div className="kpi-val">{score.pct}%</div>
          <div className="kpi-sub">{score.done} / {score.total} checks</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Ingest</div>
          <div className="kpi-val">{ingestStatus === "ready" ? FILES.length : ingestStatus === "running" ? "…" : "0"}</div>
          <div className="kpi-sub">{ingestStatus === "ready" ? "files posted" : ingestStatus === "running" ? "classifying" : "empty pack"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Group top-up</div>
          <div className="kpi-val">{eur(t.topUp, true)}</div>
          <div className="kpi-sub">live engine</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Mappings pending</div>
          <div className="kpi-val">{pending}</div>
          <div className="kpi-sub">approve 830010 to post FX</div>
        </div>
      </div>

      <h5 className="sec-h">Five phases</h5>
      <div className="onboard-map" style={{ marginBottom: 24 }}>
        {REVIEW_PHASES.map((p) => (
          <div key={p.id} className="onboard-step">
            <div className="onboard-n">{p.n}</div>
            <div className="onboard-title">{p.title}</div>
            <div className="onboard-do">{p.body}</div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h4>Sample files to ingest</h4>
          <span className="tag tag-accent">Download · drop on Data Hub</span>
        </div>
        <div className="panel-body">
          <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
            Download a CSV, then drop it on Data Hub. For the full teaching snapshot, use <strong>Load demo close pack</strong> ({FILES.length} files).
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>File</th><th>Kind</th><th>Note</th><th></th></tr></thead>
              <tbody>
                {SAMPLE_DOWNLOADS.map((f) => (
                  <tr key={f.href}>
                    <td>{f.name}</td>
                    <td>{f.kind}</td>
                    <td className="text-muted" style={{ fontSize: 12 }}>{f.note}</td>
                    <td><a href={f.href} download className="btn btn-ghost">Download</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h4>Calculation &amp; logic checkpoints</h4>
          <span className={`tag ${score.pct >= 80 ? "tag-accent" : "tag-warn"}`}>{score.done} passed</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Phase</th><th>Check</th><th>Expected</th><th>Actual (live)</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.id}>
                  <td><span className="tag tag-neutral">{c.phase}</span></td>
                  <td>
                    <strong>{c.title}</strong>
                    <div className="text-muted" style={{ fontSize: 11 }}>{c.hint}</div>
                  </td>
                  <td className="mono">{c.expected}</td>
                  <td className="mono">{c.actual}</td>
                  <td>{c.ok ? <span className="status-done">Pass</span> : <span className="status-prep">Pending</span>}</td>
                  <td><Link href={c.href} className="btn btn-ghost">{c.hrefLabel}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="stack-actions" style={{ marginTop: 16 }}>
        <Link href="/playbook/app-review" className="btn btn-secondary">Full playbook</Link>
        <Link href="/mapping" className="btn btn-primary">Continue · Mapping</Link>
        <button type="button" className="btn btn-secondary" onClick={() => flash("Tip: click any amount on the dashboard to open the audit trail")}>
          Audit tip
        </button>
      </div>
    </div>
  );
}

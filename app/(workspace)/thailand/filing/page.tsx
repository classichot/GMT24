"use client";

import Link from "next/link";
import { ThaiPackBar } from "@/components/ThaiPackBar";
import { FILING_OBLIGATIONS, THAI_PACK } from "@/lib/thailand";
import { useStore } from "@/lib/store";
import { useCalc } from "@/lib/useCalc";
import { eur } from "@/lib/format";
import { Amount } from "@/components/Amount";
import { thaiSchemaReadiness } from "@/lib/thaiFilingSchema";

function days(deadline: string) {
  const d = (new Date(deadline).getTime() - new Date("2026-08-13").getTime()) / 86400000;
  return Math.round(d);
}

const STATUS_TAG: Record<string, string> = {
  ready: "tag-pass",
  mapped: "tag-ok",
  pending: "tag-warn",
  blocked: "tag-hot",
};

export default function ThaiFilingPage() {
  const { ask, workflow } = useStore();
  const { calcs } = useCalc();
  const th = calcs.find((c) => c.iso === "TH");
  const readiness = thaiSchemaReadiness(th);

  return (
    <div>
      <ThaiPackBar />
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Thai Filing Command Centre.</strong> Three clocks under ss 54–57 (15 months) and the first in-scope year under s 58 (18 months). CAA / exchange eligibility can relieve local GIR. Electronic form schema is <em>not</em> in this pack — {THAI_PACK.coverage.headline}.
        </div>
        <div className="stack-actions">
          <Link href="/gir" className="btn btn-secondary">OECD GIR</Link>
          <Link href="/filings" className="btn btn-secondary">Global matrix</Link>
          <button className="btn btn-ghost" disabled title={readiness.blockers[0]}>
            Export Thai XML (blocked)
          </button>
          <button className="btn btn-primary" onClick={() => ask("When is the Thai top-up tax return due for FY2026?")}>Ask GMT24</button>
        </div>
      </div>

      <div className="kpi-grid cols-4" style={{ marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">First in-scope FY</div>
          <div className="kpi-val" style={{ fontSize: 22 }}>{THAI_PACK.firstInScopeFy}</div>
          <div className="kpi-sub">Section 58 · 18 months</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">FY2026 clocks</div>
          <div className="kpi-val" style={{ fontSize: 22 }}>15 months</div>
          <div className="kpi-sub">ss 54 / 55–56 / 57 · 31 Mar 2028</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Schema readiness</div>
          <div className="kpi-val" style={{ fontSize: 18 }}>{readiness.readyCount + readiness.mappedCount}/{readiness.fields.length}</div>
          <div className="kpi-sub">{readiness.blockedCount} blocked · {readiness.pendingCount} pending</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Amount on return</div>
          <div className="kpi-val" style={{ fontSize: 22 }}>{th ? <Amount n={th.jurisdictionalTopUp} audit={th.audit} compact /> : "—"}</div>
          <div className="kpi-sub">QDMTT · schema pending</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h4>s 57 schema-readiness map</h4>
          <span className="tag tag-hot">Export gated</span>
        </div>
        <p className="text-muted" style={{ margin: "0 16px 12px", fontSize: 13 }}>{readiness.note}</p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Field family</th>
                <th>Label</th>
                <th>GMT24 source</th>
                <th>Value / blocker</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {readiness.fields.map((f) => (
                <tr key={f.id}>
                  <td className="mono">{f.section}</td>
                  <td>{f.family}</td>
                  <td>{f.label}</td>
                  <td><Link href={f.href}>{f.source}</Link></td>
                  <td style={{ fontSize: 12 }}>{f.blocker ?? f.value ?? "—"}</td>
                  <td><span className={`tag ${STATUS_TAG[f.status]}`}>{f.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h4>Obligation register</h4><span className="tag tag-warn">Forms pending</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Basis</th><th>Obligation</th><th>Deadline</th><th>Countdown</th><th>Filer</th><th>Status</th></tr></thead>
            <tbody>
              {FILING_OBLIGATIONS.map((f) => (
                <tr key={f.id}>
                  <td className="mono">{f.section}</td>
                  <td>{f.title}{f.firstYear ? " · first year" : ""}</td>
                  <td>{f.deadline}</td>
                  <td>{days(f.deadline)}d</td>
                  <td>{f.filer}</td>
                  <td><span className="status-prep">{f.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><h4>Exchange / local GIR</h4></div>
          <div className="panel-body waterfall">
            <div className="wf-row"><span>UPE jurisdiction</span><span>Japan</span></div>
            <div className="wf-row"><span>Designated filing entity</span><span>JP001 · central GIR</span></div>
            <div className="wf-row"><span>CAA / exchange with Thailand</span><span>Review — confirm before relying on exemption</span></div>
            <div className="wf-row"><span>Local GIR fallback</span><span>Armed if exchange conditions fail</span></div>
            <div className="wf-row"><span>GIR XML (OECD)</span><span>{workflow.girExported ? "Pack exported" : "Draft in GIR Autopilot"}</span></div>
            <div className="wf-row total"><span>Thai return XML</span><span>Blocked — schema unpublished</span></div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h4>Maker · checker · director</h4></div>
          <div className="panel-body waterfall">
            <div className="wf-row"><span>Preparer</span><span>N. Chai</span></div>
            <div className="wf-row"><span>Reviewer</span><span>M. Sato</span></div>
            <div className="wf-row"><span>Director sign-off</span><span>Required before s 57 payment</span></div>
            <div className="wf-row"><span>No-return position</span><span>{th && th.jurisdictionalTopUp === 0 ? "Available if payable is zero" : "Not available — QDMTT payable"}</span></div>
            <div className="wf-row"><span>Receipt locker</span><span>Empty until e-filing schema exists</span></div>
            <p className="text-muted" style={{ margin: "12px 0 0", fontSize: 13 }}>
              {th ? <>Thai QDMTT {eur(th.jurisdictionalTopUp)} will sit on the s 57 return once the form pack is published.</> : null}
              {" "}<Link href="/approvals">Open approvals</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

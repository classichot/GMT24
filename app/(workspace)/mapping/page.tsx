"use client";

import { ACCOUNTS } from "@/lib/model";
import { useStore } from "@/lib/store";
import Link from "next/link";

export default function MappingPage() {
  const { approvedMaps, approveMap, flash } = useStore();
  const pending = ACCOUNTS.filter((a) => !a.approved && !approvedMaps[a.account]).length;
  return (
    <div>
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>AI Smart Mapping</strong> — Account → Financial category → GloBE category → potential adjustment → covered-tax treatment → SBIE relevance. The tax team approves once; GMT24 remembers the map for subsequent years.
        </div>
        <div className="stack-actions">
          <Link href="/data" className="btn btn-secondary">Data Hub</Link>
          <Link href="/quality" className="btn btn-primary">Data quality</Link>
        </div>
      </div>
      <div className="kpi-grid cols-3" style={{ marginBottom: 20 }}>
        <div className="kpi"><div className="kpi-label">Accounts</div><div className="kpi-val">{ACCOUNTS.length}</div><div className="kpi-sub">TH001 sample</div></div>
        <div className="kpi"><div className="kpi-label">Auto-approved</div><div className="kpi-val">{ACCOUNTS.filter((a) => a.approved).length}</div><div className="kpi-sub">≥ 88% confidence</div></div>
        <div className="kpi"><div className="kpi-label">Review required</div><div className="kpi-val">{pending}</div><div className="kpi-sub hot">FX gain 62%</div></div>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Account</th><th>Name</th><th>Financial</th><th>GloBE</th><th>Adjustment</th><th>Covered tax</th><th>SBIE</th><th>Conf.</th><th></th>
              </tr>
            </thead>
            <tbody>
              {ACCOUNTS.map((a) => {
                const ok = a.approved || approvedMaps[a.account];
                return (
                  <tr key={a.account}>
                    <td className="mono">{a.account}</td>
                    <td>{a.name}</td>
                    <td>{a.financial}</td>
                    <td>{a.globe}</td>
                    <td>{a.adjustment ?? "—"}</td>
                    <td>{a.coveredTax ?? "—"}</td>
                    <td>{a.sbie ?? "—"}</td>
                    <td>
                      <span style={{ fontWeight: 800, color: a.confidence >= 90 ? "var(--color-accent-700)" : "var(--color-warn)" }}>{a.confidence}%</span>
                    </td>
                    <td>
                      {ok ? <span className="status-done">Approved</span> : (
                        <button className="btn btn-primary" onClick={() => { approveMap(a.account); flash(`Mapping ${a.account} stored for subsequent years`); }}>Approve</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

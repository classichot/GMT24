"use client";

import { ACCOUNTS } from "@/lib/model";
import { useStore } from "@/lib/store";
import { availableMappingPostings, mappingDelta } from "@/lib/fanil";
import { eur } from "@/lib/format";
import Link from "next/link";

export default function MappingPage() {
  const { approvedMaps, approveMap, flash } = useStore();
  const postings = availableMappingPostings();
  const pending = ACCOUNTS.filter((a) => !a.approved && !approvedMaps[a.account]).length;
  return (
    <div>
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Books → FANIL posting engine</strong> — Account → financial category → GloBE rule → computed debit/credit. Approval writes the Art. 3.2 / 3.5 posting into the live calculation context, reruns every jurisdiction and keeps the map for subsequent years.
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
                const mapped = postings.filter((p) => p.mappingAccount === a.account);
                const potential = mapped.reduce((sum, p) => sum + p.amount, 0);
                const posted = mappingDelta(a.account, approvedMaps);
                return (
                  <tr key={a.account}>
                    <td className="mono">{a.account}</td>
                    <td>{a.name}</td>
                    <td>{a.financial}</td>
                    <td>{a.globe}</td>
                    <td>
                      {a.adjustment ?? "—"}
                      {mapped.length > 0 && (
                        <div className="text-muted" style={{ fontSize: 11 }}>
                          {mapped.length > 1 ? `${mapped.length} equal/opposite postings · net ${eur(ok ? posted : potential)}` : ok ? `Posted ${eur(posted)}` : `On approval ${eur(potential)}`} · {mapped.map((p) => p.article).join(" / ")}
                        </div>
                      )}
                    </td>
                    <td>{a.coveredTax ?? "—"}</td>
                    <td>{a.sbie ?? "—"}</td>
                    <td>
                      <span style={{ fontWeight: 800, color: a.confidence >= 90 ? "var(--color-accent-700)" : "var(--color-warn)" }}>{a.confidence}%</span>
                    </td>
                    <td>
                      {ok ? <span className="status-done">{mapped.length ? "Posted" : "Approved"}</span> : (
                        <button className="btn btn-primary" onClick={() => { approveMap(a.account); flash(`Mapping ${a.account} posted · GloBE engine rerun`); }}>Approve & post</button>
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

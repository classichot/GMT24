"use client";

import { Amount } from "@/components/Amount";
import { JURISDICTION_PACKS } from "@/lib/model";
import { FlowBar } from "@/components/FlowBar";
import { useCalc } from "@/lib/useCalc";
import { eur, pct } from "@/lib/format";
import { utprAllocation, utprFactorTotals } from "@/lib/utpr";
import Link from "next/link";

export default function AllocationPage() {
  const { calcs, t } = useCalc();
  const exposed = calcs.filter((c) => c.jurisdictionalTopUp > 0);
  const utpr = utprAllocation(t.utpr);
  const utprTotals = utprFactorTotals(utpr);
  return (
    <div>
      <FlowBar />
      <p className="text-muted" style={{ marginBottom: 16 }}>Who pays → where → why → amount. Collection takes the Art. 5.2.3 amount — (Top-up % × Excess) + Additional Current Top-up Tax — then qualified QDMTT first, then POPE IIR × Inclusion Ratio (Art. 2.1.4), then UPE IIR residual, then UTPR. MOCE / JV / Investment / Stateless top-up is computed on a separate ETR blend.</p>
      <div className="stack-actions" style={{ marginBottom: 16 }}>
          <Link href="/thailand/liability" className="btn btn-secondary">Thai liability pack</Link>
          <Link href="/gir" className="btn btn-primary">Build GIR</Link>
        <Link href="/jurisdictions" className="btn btn-secondary">Rule packs</Link>
      </div>
      <div className="grid-2">
        {exposed.map((c) => (
          <div key={c.blendKey} className="panel">
            <div className="panel-head"><h4>{c.name}</h4><Amount n={c.jurisdictionalTopUp} audit={c.audit} compact /></div>
            <div className="panel-body">
              <div className="alloc">
                {c.collection.path.map((p, i) => (
                  <div key={p}>
                    <div className="alloc-box"><strong>{p}</strong></div>
                    {i < c.collection.path.length - 1 && <div className="alloc-arrow">↓</div>}
                  </div>
                ))}
              </div>
              <p className="text-muted" style={{ marginTop: 14, fontSize: 12 }}>
                Pack: {c.pack?.qualified}. QDMTT {eur(c.collection.qdmtt)} · IIR {eur(c.collection.iir)} · UTPR {eur(c.collection.utpr)}.
                {c.additionalCurrentTopUp > 0 ? ` Additional Current Top-up ${eur(c.additionalCurrentTopUp)} is in this amount.` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-head">
          <h4>Article 2.6 UTPR allocation key</h4>
          <span className="tag tag-accent">50% employees + 50% tangible assets</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>UTPR jurisdiction</th><th>Employees</th><th>Employee share</th><th>Tangible assets</th><th>Asset share</th><th>UTPR %</th><th>Allocated</th></tr></thead>
            <tbody>
              {utpr.map((row) => (
                <tr key={row.iso}>
                  <td><strong>{row.name}</strong><div className="text-muted" style={{ fontSize: 11 }}>{row.entityIds.length} included CEs</div></td>
                  <td>{row.employees.toLocaleString("en-GB")}</td>
                  <td>{pct(row.employeeShare, 2)}</td>
                  <td>{eur(row.assets)}</td>
                  <td>{pct(row.assetShare, 2)}</td>
                  <td><strong>{pct(row.percentage, 2)}</strong></td>
                  <td>{eur(row.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th>Total</th><th>{utprTotals.employees.toLocaleString("en-GB")}</th><th>100%</th><th>{eur(utprTotals.assets)}</th><th>100%</th><th>{pct(utprTotals.percentage, 2)}</th><th>{eur(utprTotals.amount)}</th></tr>
            </tfoot>
          </table>
        </div>
        <div className="panel-body text-muted" style={{ fontSize: 12 }}>
          Qualified UTPR jurisdictions in force enter the denominator. Investment Entities and JV Group members are excluded. The key is calculated even when the current residual is {eur(t.utpr)} so the filing dataset is ready when UTPR applies.
        </div>
      </div>
      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-head"><h4>Jurisdiction rule packs (excerpt)</h4></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Jur.</th><th>IIR</th><th>QDMTT</th><th>QDMTT SH</th><th>UTPR</th><th>From</th><th>Qualified</th></tr></thead>
            <tbody>
              {JURISDICTION_PACKS.map((p) => (
                <tr key={p.iso}>
                  <td>{p.name}</td>
                  <td>{p.iir ? "Yes" : "No"}</td>
                  <td>{p.qdmtt ? "Yes" : "No"}</td>
                  <td>{p.qdmttSH ? "Yes" : "No"}</td>
                  <td>{p.utpr ? "Yes" : "No"}</td>
                  <td>{p.from}</td>
                  <td>{p.qualified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

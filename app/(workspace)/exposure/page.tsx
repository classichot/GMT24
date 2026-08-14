"use client";

import { eur } from "@/lib/format";
import { Amount } from "@/components/Amount";
import Link from "next/link";
import { useCalc } from "@/lib/useCalc";

export default function ExposurePage() {
  const { calcs, t } = useCalc();
  const hot = calcs.filter((c) => c.jurisdictionalTopUp > 0);
  const max = Math.max(...calcs.map((c) => c.jurisdictionalTopUp), 1);

  return (
    <div>
      <div className="kpi-grid cols-4" style={{ marginBottom: 24 }}>
        <div className="kpi"><div className="kpi-label">Group top-up</div><div className="kpi-val"><Amount n={t.topUp} audit={t.audit} compact /></div></div>
        <div className="kpi"><div className="kpi-label">QDMTT</div><div className="kpi-val">{eur(t.qdmtt, true)}</div><div className="kpi-sub">local</div></div>
        <div className="kpi"><div className="kpi-label">IIR</div><div className="kpi-val">{eur(t.iir, true)}</div><div className="kpi-sub">Japan UPE</div></div>
        <div className="kpi"><div className="kpi-label">UTPR</div><div className="kpi-val">$0</div><div className="kpi-sub">residual none</div></div>
      </div>
      <div className="panel">
        <div className="panel-head"><h4>Who pays</h4><Link href="/allocation" className="btn btn-ghost">Allocation map</Link></div>
        <div className="panel-body">
          {hot.map((c) => (
            <div key={c.iso} style={{ display: "grid", gridTemplateColumns: "160px 1fr 120px 160px", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--color-divider)" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{c.name}</div>
                <div className="text-muted" style={{ fontSize: 12 }}><Amount n={c.etr} audit={c.trace.etr} compact /> ETR</div>
              </div>
              <div className="bar-track"><div className="bar-fill hot" style={{ width: `${(c.jurisdictionalTopUp / max) * 100}%` }} /></div>
              <Amount n={c.jurisdictionalTopUp} audit={c.audit} compact />
              <div style={{ fontSize: 12 }}>{c.collection.payer}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { calculateGroup, totals } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { MAP_COORDS } from "@/lib/model";
import { eur, pct } from "@/lib/format";
import { Amount } from "@/components/Amount";

function MapInner() {
  const { groupId } = useStore();
  const calcs = calculateGroup(groupId);
  const t = totals(calcs);
  const router = useRouter();
  const iso = useSearchParams().get("iso");
  const sel = calcs.find((c) => c.iso === iso) ?? calcs[0];

  return (
    <div>
      <p className="text-muted">Red = potential top-up. Amber = review / safe harbour. Green = no current exposure.</p>
      <div className="map-canvas" style={{ height: 360, margin: "16px 0 20px" }}>
        {calcs.map((c) => {
          const pos = MAP_COORDS[c.iso];
          if (!pos) return null;
          const cls = c.jurisdictionalTopUp > 0 ? "topup" : c.exposure === "Safe harbour" || c.exposure === "Review" ? "sh" : "ok";
          return (
            <button key={c.iso} className={`map-dot ${cls}`} style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: sel.iso === c.iso ? 18 : 14, height: sel.iso === c.iso ? 18 : 14 }} onClick={() => router.push(`/etr-map?iso=${c.iso}`)} title={c.name} />
          );
        })}
      </div>
      <div className="grid-split">
        <div className="panel">
          <div className="panel-head"><h4>{sel.name}</h4><span className={`tag ${sel.jurisdictionalTopUp ? "tag-hot" : "tag-ok"}`}>{sel.exposure}</span></div>
          <div className="panel-body">
            <div className="wf-row"><span>GloBE income</span><Amount n={sel.globeIncome} audit={sel.audit} /></div>
            <div className="wf-row"><span>Covered taxes</span><Amount n={sel.coveredTax} audit={sel.audit} /></div>
            <div className="wf-row"><span>ETR</span><strong>{pct(sel.etr, 2)}</strong></div>
            <div className="wf-row"><span>SBIE</span><span>{eur(sel.sbie)}</span></div>
            <div className="wf-row total"><span>Top-up tax</span><Amount n={sel.jurisdictionalTopUp} audit={sel.audit} /></div>
            <p className="text-muted" style={{ marginTop: 12, fontSize: 13 }}>{sel.sh.navigator}</p>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h4>All jurisdictions</h4><span className="text-muted">{eur(t.topUp, true)} group</span></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Jurisdiction</th><th className="num">ETR</th><th className="num">Top-up</th></tr></thead>
              <tbody>
                {calcs.map((c) => (
                  <tr key={c.iso} className="clickable" onClick={() => router.push(`/etr-map?iso=${c.iso}`)}>
                    <td>{c.name}</td>
                    <td className="num">{pct(c.etr, 1)}</td>
                    <td className="num">{eur(c.jurisdictionalTopUp, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense><MapInner /></Suspense>;
}

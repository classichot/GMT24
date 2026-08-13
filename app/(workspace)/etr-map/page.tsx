"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { MAP_COORDS } from "@/lib/model";
import { eur, pct } from "@/lib/format";
import { Amount } from "@/components/Amount";
import { WorldMap } from "@/components/WorldMap";
import { FlowBar } from "@/components/FlowBar";
import { useCalc } from "@/lib/useCalc";

function MapInner() {
  const { ask } = useStore();
  const { calcs, t } = useCalc();
  const router = useRouter();
  const iso = useSearchParams().get("iso");
  const sel = calcs.find((c) => c.iso === iso) ?? calcs[0];
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    const layer = el?.firstElementChild as HTMLElement | null;
    if (!el || !layer) return;
    const id = requestAnimationFrame(() => {
      el.scrollTop = Math.max(0, (layer.offsetHeight - el.clientHeight) / 2);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div>
      <FlowBar iso={sel.iso} />
      <p className="text-muted">Violet = potential top-up. Blue = review / safe harbour / no current exposure.</p>
      <div ref={scroller} className="map-canvas hero" style={{ margin: "16px 0 20px" }}>
        <div className="map-layer">
          <WorldMap />
          {calcs.map((c) => {
            const pos = MAP_COORDS[c.iso];
            if (!pos) return null;
            const cls = c.jurisdictionalTopUp > 0 ? "topup" : c.exposure === "Safe harbour" || c.exposure === "Review" ? "sh" : "ok";
            return (
              <button key={c.iso} className={`map-dot ${cls}${sel.iso === c.iso ? " active" : ""}`} style={{ left: `${pos.x}%`, top: `${pos.y}%` }} onClick={() => router.push(`/etr-map?iso=${c.iso}`)} title={c.name} />
            );
          })}
        </div>
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
            <div className="stack-actions" style={{ marginTop: 16 }}>
              <Link href={`/etr?iso=${sel.iso}`} className="btn btn-primary">Open ETR</Link>
              <Link href="/top-up" className="btn btn-secondary">Top-up</Link>
              <Link href="/allocation" className="btn btn-secondary">Allocation</Link>
              <button className="btn btn-secondary" onClick={() => ask(`Why is ${sel.name}'s ETR ${(sel.etr * 100).toFixed(1)}%?`)}>Ask GMT24</button>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h4>All jurisdictions</h4><span className="text-muted">{eur(t.topUp, true)} group</span></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Jurisdiction</th><th className="num">ETR</th><th className="num">Top-up</th></tr></thead>
              <tbody>
                {calcs.map((c) => (
                  <tr key={c.iso} className="clickable" onClick={() => router.push(`/etr?iso=${c.iso}`)}>
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

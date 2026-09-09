"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { MAP_COORDS } from "@/lib/model";
import { etrPct, eur } from "@/lib/format";
import { Amount } from "@/components/Amount";
import { WorldMap } from "@/components/WorldMap";
import { FlowBar } from "@/components/FlowBar";
import { useCalc } from "@/lib/useCalc";
import { etrHref, pickCalc, summarizeByIso } from "@/lib/engine";

function MapInner() {
  const { ask } = useStore();
  const { calcs, t } = useCalc();
  const router = useRouter();
  const iso = useSearchParams().get("iso");
  const blend = useSearchParams().get("blend");
  const sel = pickCalc(calcs, iso, blend) ?? calcs[0];
  const dots = summarizeByIso(calcs);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    const layer = el?.firstElementChild as HTMLElement | null;
    if (!el || !layer) return;
    const pin = el.querySelector(`[data-iso="${sel.iso}"]`) as HTMLElement | null;
    const id = requestAnimationFrame(() => {
      if (pin) {
        const top = pin.offsetTop - el.clientHeight / 2 + pin.offsetHeight / 2;
        el.scrollTo({ top: Math.max(0, top), behavior: iso ? "smooth" : "auto" });
      } else {
        el.scrollTop = Math.max(0, (layer.offsetHeight - el.clientHeight) / 2);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [sel.iso, iso]);

  return (
    <div>
      <FlowBar iso={sel.iso} />
      <p className="text-muted">Violet = potential top-up. Blue = review / safe harbour / no current exposure.</p>
      <div ref={scroller} className="map-canvas hero" style={{ margin: "16px 0 20px" }}>
        <div className="map-layer">
          <WorldMap />
          {dots.map((d) => {
            const pos = MAP_COORDS[d.iso];
            if (!pos) return null;
            const cls = d.jurisdictionalTopUp > 0 ? "topup" : d.exposure === "Safe harbour" || d.exposure === "Review" ? "sh" : "ok";
            const on = sel.iso === d.iso;
            return (
              <button
                key={d.iso}
                type="button"
                className="map-pin"
                data-iso={d.iso}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                onClick={() => router.push(`/etr-map?iso=${d.iso}`)}
                title={`${d.name} · ETR ${etrPct(d.main, 2)}`}
                aria-label={`${d.name}, ETR ${etrPct(d.main, 2)}`}
                aria-pressed={on}
              >
                <span className={`map-dot ${cls}${on ? " active" : ""}`} />
              </button>
            );
          })}
          {MAP_COORDS[sel.iso] && (
            <div
              className={`map-callout${MAP_COORDS[sel.iso].y < 24 ? " below" : ""}`}
              style={{ left: `${MAP_COORDS[sel.iso].x}%`, top: `${MAP_COORDS[sel.iso].y}%` }}
              role="status"
            >
              <div className="map-callout-kicker">{sel.iso} · {sel.exposure}</div>
              <div className="map-callout-name">{sel.name}</div>
              <div className="map-callout-etr">{etrPct(sel, 2)}</div>
              <div className="map-callout-meta">{sel.etrComputed ? "Jurisdictional ETR" : "Net GloBE Loss · Art. 5.1.2"}</div>
              <div className="map-callout-meta">Top-up {eur(sel.jurisdictionalTopUp, true)}</div>
            </div>
          )}
        </div>
      </div>
      <div className="grid-split">
        <div className="panel">
          <div className="panel-head"><h4>{sel.name}</h4><span className={`tag ${sel.jurisdictionalTopUp ? "tag-hot" : "tag-ok"}`}>{sel.exposure}</span></div>
          <div className="panel-body">
            <div className="wf-row"><span>GloBE income</span><Amount n={sel.globeIncome} audit={sel.audit} /></div>
            <div className="wf-row"><span>Covered taxes</span><Amount n={sel.coveredTax} audit={sel.audit} /></div>
            <div className="wf-row"><span>ETR</span><strong>{etrPct(sel, 2)}</strong></div>
            <div className="wf-row"><span>SBIE</span><span>{eur(sel.sbie)}</span></div>
            <div className="wf-row total"><span>Top-up tax</span><Amount n={sel.jurisdictionalTopUp} audit={sel.audit} /></div>
            <p className="text-muted" style={{ marginTop: 12, fontSize: 13 }}>{sel.sh.navigator}</p>
            <div className="stack-actions" style={{ marginTop: 16 }}>
              <Link href={etrHref(sel)} className="btn btn-primary">Open ETR</Link>
              <Link href="/top-up" className="btn btn-secondary">Top-up</Link>
              <Link href="/allocation" className="btn btn-secondary">Allocation</Link>
              <button className="btn btn-secondary" onClick={() => ask(sel.etrComputed ? `Why is ${sel.name}'s ETR ${(sel.etr * 100).toFixed(1)}%?` : `Why does ${sel.name} have no ETR and no top-up this year?`)}>Ask GMT24</button>
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
                  <tr key={c.blendKey} className={`clickable${c.iso === sel.iso && (!blend || c.blendKey === blend) ? " selected" : ""}`} onClick={() => router.push(`/etr-map?iso=${c.iso}${c.blendKind === "main" ? "" : `&blend=${encodeURIComponent(c.blendKey)}`}`)}>
                    <td>{c.name}</td>
                    <td className="num">{etrPct(c, 1)}</td>
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

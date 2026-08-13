"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ACTIVITY, GROUPS } from "@/lib/model";
import { calculateGroup, totals } from "@/lib/engine";
import { eur, pct } from "@/lib/format";
import { useStore } from "@/lib/store";
import { Amount } from "@/components/Amount";
import { MAP_COORDS } from "@/lib/model";

export default function OverviewPage() {
  const { groupId, mode, ask } = useStore();
  const router = useRouter();
  const group = GROUPS.find((g) => g.id === groupId) ?? GROUPS[0];
  const calcs = calculateGroup(groupId);
  const t = totals(calcs);
  const th = calcs.find((c) => c.iso === "TH");

  return (
    <div>
      <div className="callout" style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <strong>{mode === "advisor" ? "Advisory engagement" : "In-house close"} · {group.name} · {group.fy}.</strong>{" "}
          AI mapped the trial balances. The deterministic engine produced {eur(t.topUp)} of jurisdictional top-up tax across {t.tu} countries. {t.blocks} data issues still block a lock.
        </div>
        <div className="stack-actions">
          <Link href="/audit" className="btn btn-secondary">Explain calculation</Link>
          <Link href="/data" className="btn btn-secondary">View source</Link>
          <Link href="/simulator" className="btn btn-secondary">Run scenario</Link>
          <button className="btn btn-primary" onClick={() => ask("Why is Thailand's ETR 10.8%?")}>Ask GMT24</button>
        </div>
      </div>

      <div style={{ display: "flex", border: "2px solid var(--color-divider)", marginBottom: 24 }}>
        <div style={{ flex: 1, padding: "26px 24px 22px", borderRight: "1px solid var(--color-divider)" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-accent-700)" }}>Group Global Minimum Tax exposure · {group.fy}</div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 64, lineHeight: 0.95, letterSpacing: "-0.03em", marginTop: 10 }}>
            <Amount n={t.topUp} audit={th?.audit} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <span className="tag tag-neutral">Calculated 13 Aug 2026</span>
            <span className="tag tag-accent">Rule pack 2026.2</span>
            <span className="tag tag-outline">Snapshot v14 · locked inputs</span>
          </div>
        </div>
        <div style={{ width: "44%", flex: "none", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          {[
            [String(group.jurisdictions), "Jurisdictions"],
            [String(group.entities), "Entities"],
            [String(t.low), "Low-ETR"],
            [String(t.sh), "Safe harbour"],
            [String(t.tu), "With top-up"],
            [String(t.issues), "Data issues"],
          ].map(([v, l]) => (
            <div key={l} style={{ padding: "14px 18px", borderBottom: "1px solid var(--color-divider)", borderLeft: "1px solid var(--color-divider)" }}>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 26, lineHeight: 1.1 }}>{v}</div>
              <div style={{ fontSize: 11, color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <h4 style={{ margin: 0 }}>Jurisdictional ETR matrix</h4>
          <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, background: "var(--sig-red)", display: "block" }} />Top-up tax</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, background: "var(--sig-amber)", display: "block" }} />Review / safe harbour</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, background: "var(--color-accent)", display: "block" }} />No exposure</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 1, background: "var(--color-divider)", border: "1px solid var(--color-divider)" }}>
          {calcs.map((c) => {
            const fill = c.jurisdictionalTopUp > 0 ? "var(--sig-red)" : c.exposure === "Safe harbour" || c.exposure === "Review" ? "var(--sig-amber)" : "var(--color-accent)";
            return (
              <button key={c.iso} onClick={() => router.push(`/etr?iso=${c.iso}`)} style={{ border: 0, cursor: "pointer", font: "inherit", textAlign: "left", background: "var(--color-bg)", padding: "11px 12px 10px", display: "flex", flexDirection: "column", gap: 7, color: "inherit" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 15 }}>{c.iso}</span>
                  <span style={{ fontSize: 12, color: fill, fontWeight: 800 }}>{pct(c.etr, 1)}</span>
                </div>
                <div style={{ fontSize: 10, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>{c.name}</div>
                <div style={{ height: 5, background: "color-mix(in srgb, var(--color-text) 12%, transparent)" }}>
                  <div style={{ height: 5, width: `${Math.min(100, c.etr / 0.3 * 100)}%`, background: fill }} />
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginTop: 10 }}>+ {group.jurisdictions - calcs.length} further jurisdictions in the canonical model</div>
      </div>

      <div className="grid-split" style={{ marginBottom: 28 }}>
        <div>
          <div className="panel-head" style={{ border: "2px solid var(--color-divider)", borderBottom: 0 }}>
            <h4>World exposure</h4>
            <Link href="/etr-map" className="btn btn-ghost">Open ETR map</Link>
          </div>
          <div className="map-canvas">
            {calcs.map((c) => {
              const pos = MAP_COORDS[c.iso];
              if (!pos) return null;
              const cls = c.jurisdictionalTopUp > 0 ? "topup" : c.exposure === "Safe harbour" ? "sh" : c.exposure === "Review" ? "review" : "ok";
              return (
                <button
                  key={c.iso}
                  className={`map-dot ${cls}`}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  title={`${c.name} ${pct(c.etr)}`}
                  onClick={() => router.push(`/etr?iso=${c.iso}`)}
                />
              );
            })}
          </div>
          <div className="map-legend">
            <span><i className="map-dot topup" style={{ position: "static", display: "inline-block", transform: "none", marginRight: 6 }} />Top-up</span>
            <span><i className="map-dot sh" style={{ position: "static", display: "inline-block", transform: "none", marginRight: 6 }} />Safe harbour</span>
            <span><i className="map-dot ok" style={{ position: "static", display: "inline-block", transform: "none", marginRight: 6 }} />No top-up</span>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h4>Thailand</h4><span className="tag tag-hot">Exposure</span></div>
          <div className="panel-body">
            {th && (
              <>
                <div className="wf-row"><span>ETR</span><strong>{pct(th.etr, 1)}</strong></div>
                <div className="wf-row"><span>GloBE income</span><Amount n={th.globeIncome} audit={th.audit} compact /></div>
                <div className="wf-row"><span>Covered taxes</span><Amount n={th.coveredTax} audit={th.audit} compact /></div>
                <div className="wf-row"><span>SBIE</span><Amount n={th.sbie} compact /></div>
                <div className="wf-row total"><span>Estimated top-up</span><Amount n={th.jurisdictionalTopUp} audit={th.audit} compact /></div>
                <div className="wf-row"><span>Collection</span><span>QDMTT {eur(th.collection.qdmtt, true)}</span></div>
                <div className="wf-row"><span>Data confidence</span><span>{th.completeness}%</span></div>
                <div className="stack-actions" style={{ marginTop: 16 }}>
                  <button className="btn btn-primary" onClick={() => ask("Why is Thailand's ETR 10.8%?")}>Ask GMT24</button>
                  <Link href="/top-up" className="btn btn-secondary">Open calculation</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid-split">
        <div className="panel">
          <div className="panel-head"><h4>Jurisdictional ETR</h4></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Jurisdiction</th><th className="num">GloBE</th><th className="num">Covered tax</th><th className="num">ETR</th><th>Result</th></tr></thead>
              <tbody>
                {calcs.slice(0, 8).map((c) => (
                  <tr key={c.iso} className="clickable" onClick={() => router.push(`/etr?iso=${c.iso}`)}>
                    <td>{c.name}</td>
                    <td className="num">{eur(c.globeIncome, true)}</td>
                    <td className="num">{eur(c.coveredTax, true)}</td>
                    <td className="num">{pct(c.etr, 1)}</td>
                    <td>{c.jurisdictionalTopUp > 0 ? <span className="tag tag-hot">Exposure</span> : c.exposure === "Safe harbour" ? <span className="tag tag-warn">Review SH</span> : c.exposure === "Review" ? <span className="tag tag-warn">Review SH</span> : <span className="tag tag-ok">No top-up</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h4>Activity</h4></div>
          <div style={{ padding: "8px 16px 16px" }}>
            {ACTIVITY.map((a, i) => (
              <div key={i} style={{ padding: "12px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <div style={{ fontSize: 13 }}>{a.text}</div>
                <div className="text-muted" style={{ fontSize: 11 }}>{a.who} · {a.when}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

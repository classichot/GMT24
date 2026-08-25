"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ENTITIES } from "@/lib/model";
import { etrHref } from "@/lib/engine";
import { classFor } from "@/lib/entityClass";
import { useCalc } from "@/lib/useCalc";
import { eur, pct } from "@/lib/format";
import { Amount } from "@/components/Amount";

export default function GraphPage() {
  const { calcs } = useCalc();
  const byId = Object.fromEntries(calcs.flatMap((c) => c.entities.map((e) => [e.id, c])));
  const router = useRouter();
  const [sel, setSel] = useState("TH-CE");
  const selected = ENTITIES.find((e) => e.id === sel)!;
  const jc = byId[sel];

  const edges = useMemo(
    () => ENTITIES.filter((e) => e.parentId).map((e) => {
      const p = ENTITIES.find((x) => x.id === e.parentId)!;
      return { e, p };
    }),
    [],
  );

  return (
    <div>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        Global Tax Graph — hop % on each edge, look-through UPE % on the node. GloBE class (MOCE / POPE / JV / Investment / Stateless) and Pillar Two exposure. Click a node, then open that blend’s ETR.
      </p>
      <div className="graph-wrap" style={{ height: 460, marginBottom: 20 }}>
        <svg viewBox="0 0 960 440" width="100%" height="440">
          {edges.map(({ e, p }) => {
            const x1 = p.graph.x;
            const y1 = p.graph.y + 18;
            const x2 = e.graph.x;
            const y2 = e.graph.y - 18;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            return (
              <g key={e.id}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-divider)" strokeWidth="2" />
                <rect x={mx - 16} y={my - 8} width="32" height="14" fill="var(--color-surface, #fff)" />
                <text x={mx} y={my + 3} textAnchor="middle" fontSize="9" fontFamily="Archivo" fontWeight="700" fill="var(--color-neutral-700)">{e.ownership}%</text>
              </g>
            );
          })}
          {ENTITIES.map((e) => {
            const c = byId[e.id];
            const hot = (c?.jurisdictionalTopUp ?? 0) > 0;
            return (
              <g key={e.id} onClick={() => setSel(e.id)} style={{ cursor: "pointer" }}>
                <rect
                  className={`g-node${sel === e.id ? " active" : ""}${hot ? " topup" : ""}`}
                  x={e.graph.x - 70}
                  y={e.graph.y - 22}
                  width="140"
                  height="44"
                />
                <text x={e.graph.x} y={e.graph.y - 4} textAnchor="middle" fontSize="11" fontFamily="Archivo" fontWeight="800" fill="var(--color-text)">{e.iso} · {classFor(e.id).tag}</text>
                <text x={e.graph.x} y={e.graph.y + 12} textAnchor="middle" fontSize="10" fontFamily="Archivo" fill="var(--color-neutral-700)">{pct(c?.etr ?? 0, 0)} ETR</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="panel">
        <div className="panel-head">
          <div>
            <h4 style={{ margin: 0 }}>{selected.name}</h4>
            <div className="text-muted" style={{ fontSize: 12 }}>{selected.code} · {selected.jurisdiction} · {classFor(selected.id).tag} · UPE {classFor(selected.id).upeOwnership}% · direct {selected.ownership}%</div>
          </div>
          <button className="btn btn-primary" onClick={() => router.push(jc ? etrHref(jc) : `/etr?iso=${selected.iso}`)}>Open {jc?.name ?? selected.jurisdiction} calculation</button>
        </div>
        {jc && (
          <div className="kpi-grid cols-6">
            <div className="kpi"><div className="kpi-label">Revenue</div><div className="kpi-val" style={{ fontSize: 22 }}>{eur(jc.revenue, true)}</div></div>
            <div className="kpi"><div className="kpi-label">GloBE</div><div className="kpi-val" style={{ fontSize: 22 }}><Amount n={jc.globeIncome} audit={jc.trace.globe} compact /></div></div>
            <div className="kpi"><div className="kpi-label">Covered tax</div><div className="kpi-val" style={{ fontSize: 22 }}><Amount n={jc.coveredTax} audit={jc.trace.covered} compact /></div></div>
            <div className="kpi"><div className="kpi-label">ETR</div><div className="kpi-val" style={{ fontSize: 22 }}><Amount n={jc.etr} audit={jc.trace.etr} compact /></div></div>
            <div className="kpi"><div className="kpi-label">Safe harbour</div><div className="kpi-val" style={{ fontSize: 18 }}>{jc.sh.outcome}{jc.sh.barred ? " · barred" : ""}</div></div>
            <div className="kpi"><div className="kpi-label">Top-up</div><div className="kpi-val" style={{ fontSize: 22 }}><Amount n={jc.jurisdictionalTopUp} audit={jc.audit} compact /></div></div>
          </div>
        )}
      </div>
    </div>
  );
}

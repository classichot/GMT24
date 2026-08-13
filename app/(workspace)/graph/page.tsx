"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ENTITIES } from "@/lib/model";
import { calculateGroup } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { eur, pct } from "@/lib/format";

export default function GraphPage() {
  const { groupId } = useStore();
  const calcs = calculateGroup(groupId);
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
        Global Tax Graph — ownership, jurisdiction and Pillar Two exposure on every node. Click Thailand to open the entire Thai calculation.
      </p>
      <div className="graph-wrap" style={{ height: 420, marginBottom: 20 }}>
        <svg viewBox="0 0 960 400" width="100%" height="400">
          {edges.map(({ e, p }) => (
            <line key={e.id} x1={p.graph.x} y1={p.graph.y + 18} x2={e.graph.x} y2={e.graph.y - 18} stroke="var(--color-divider)" strokeWidth="2" />
          ))}
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
                <text x={e.graph.x} y={e.graph.y - 4} textAnchor="middle" fontSize="11" fontFamily="Archivo" fontWeight="800" fill="var(--color-text)">{e.iso} · {e.type}</text>
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
            <div className="text-muted" style={{ fontSize: 12 }}>{selected.code} · {selected.jurisdiction} · {selected.gaap} · ownership {selected.ownership}%</div>
          </div>
          <button className="btn btn-primary" onClick={() => router.push(`/etr?iso=${selected.iso}`)}>Open {selected.jurisdiction} calculation</button>
        </div>
        {jc && (
          <div className="kpi-grid cols-6">
            <div className="kpi"><div className="kpi-label">Revenue</div><div className="kpi-val" style={{ fontSize: 22 }}>{eur(jc.revenue, true)}</div></div>
            <div className="kpi"><div className="kpi-label">GloBE</div><div className="kpi-val" style={{ fontSize: 22 }}>{eur(jc.globeIncome, true)}</div></div>
            <div className="kpi"><div className="kpi-label">Covered tax</div><div className="kpi-val" style={{ fontSize: 22 }}>{eur(jc.coveredTax, true)}</div></div>
            <div className="kpi"><div className="kpi-label">ETR</div><div className="kpi-val" style={{ fontSize: 22 }}>{pct(jc.etr, 1)}</div></div>
            <div className="kpi"><div className="kpi-label">Safe harbour</div><div className="kpi-val" style={{ fontSize: 18 }}>{jc.sh.outcome}</div></div>
            <div className="kpi"><div className="kpi-label">Top-up</div><div className="kpi-val" style={{ fontSize: 22 }}>{eur(jc.jurisdictionalTopUp, true)}</div></div>
          </div>
        )}
      </div>
    </div>
  );
}

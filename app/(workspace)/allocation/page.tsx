"use client";

import { calculateGroup } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { eur } from "@/lib/format";
import { Amount } from "@/components/Amount";
import { JURISDICTION_PACKS } from "@/lib/model";

export default function AllocationPage() {
  const { groupId } = useStore();
  const calcs = calculateGroup(groupId).filter((c) => c.jurisdictionalTopUp > 0);
  return (
    <div>
      <p className="text-muted" style={{ marginBottom: 16 }}>Who pays → where → why → amount. Collection follows the Global Rulebook (qualified QDMTT first, residual IIR to the UPE, then UTPR).</p>
      <div className="grid-2">
        {calcs.map((c) => (
          <div key={c.iso} className="panel">
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
              </p>
            </div>
          </div>
        ))}
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

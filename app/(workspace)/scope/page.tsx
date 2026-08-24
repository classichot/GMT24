"use client";

import { ENTITIES } from "@/lib/model";
import { scopeTest } from "@/lib/engine";
import { classFor } from "@/lib/entityClass";
import { useStore } from "@/lib/store";
import { eur } from "@/lib/format";

export default function ScopePage() {
  const { groupId } = useStore();
  const s = scopeTest(groupId);
  return (
    <div>
      <div className="callout" style={{ marginBottom: 20 }}>
        First question: is this group actually subject to Pillar Two? Scope uses rule {s.rule.id} v{s.rule.version} — {s.rule.source}.
      </div>
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="panel" style={{ padding: 24 }}>
          <div className="kpi-label">Determination</div>
          <div className={s.status === "IN SCOPE" ? "status-in" : s.status === "OUT OF SCOPE" ? "status-out" : "status-rev"} style={{ marginTop: 12, fontSize: 16 }}>{s.status}</div>
          <p style={{ marginTop: 16 }}>{s.note}</p>
        </div>
        <div className="panel">
          <div className="panel-head"><h4>Threshold window</h4></div>
          <div className="panel-body">
            {s.window.map((r) => (
              <div key={r.fy} className="wf-row">
                <span>{r.fy}</span>
                <span>{eur(r.amount)} {r.amount >= s.threshold ? "· hit" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head"><h4>Classification</h4></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Entity</th><th>Type</th><th>GloBE class</th><th>UPE %</th><th>Excluded?</th><th>Effective</th></tr></thead>
            <tbody>
              {ENTITIES.map((e) => {
                const cls = classFor(e.id);
                return (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{e.type}</td>
                  <td>{cls.tag}</td>
                  <td>{cls.upeOwnership}%</td>
                  <td>{e.excludedReason ?? (cls.moce ? "In scope — MOCE, separate ETR" : cls.pope ? "In scope — POPE, IIR first" : cls.jv ? "In scope — JV Group, separate ETR" : "In scope CE / UPE / PE as classified")}</td>
                  <td>{e.acquired}</td>
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

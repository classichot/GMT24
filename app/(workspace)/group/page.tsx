"use client";

import { ENTITIES } from "@/lib/model";
import { calculateGroup, scopeTest } from "@/lib/engine";
import { classifyAll } from "@/lib/entityClass";
import { useStore } from "@/lib/store";
import { eur } from "@/lib/format";
import Link from "next/link";

export default function GroupPage() {
  const { groupId } = useStore();
  const scope = scopeTest(groupId);
  const calcs = calculateGroup(groupId);
  const classes = classifyAll();
  const cls = (t: string) => ENTITIES.filter((e) => e.type === t).length;
  const popeN = classes.filter((c) => c.pope).length;
  const moceN = classes.filter((c) => c.moce).length;

  return (
    <div>
      <div className="grid-score" style={{ marginBottom: 24 }}>
        <div className="panel" style={{ padding: 24, textAlign: "center" }}>
          <div className="kpi-label">Scope</div>
          <div className={scope.status === "IN SCOPE" ? "status-in" : scope.status === "OUT OF SCOPE" ? "status-out" : "status-rev"} style={{ margin: "16px auto", fontSize: 14 }}>
            {scope.status}
          </div>
          <p className="text-muted" style={{ fontSize: 13 }}>{scope.note}</p>
          <div className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>{scope.rule.id} · {scope.rule.version}</div>
        </div>
        <div className="panel">
          <div className="panel-head"><h4>Revenue history vs $750m</h4></div>
          <div className="panel-body">
            {scope.window.map((r) => (
              <div key={r.fy} style={{ display: "grid", gridTemplateColumns: "80px 1fr 120px", gap: 12, alignItems: "center", marginBottom: 10 }}>
                <div>{r.fy}</div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, (r.amount / 2_400_000_000) * 100)}%` }} /></div>
                <div className="num">{eur(r.amount, true)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="kpi-grid cols-6" style={{ marginBottom: 24 }}>
        {[
          ["UPE", cls("UPE")],
          ["HoldCo", cls("HoldCo")],
          ["CE", cls("CE")],
          ["MOCE", moceN],
          ["POPE", popeN],
          ["Graph nodes", ENTITIES.length],
        ].map(([k, v]) => (
          <div className="kpi" key={String(k)}><div className="kpi-label">{k}</div><div className="kpi-val">{v}</div></div>
        ))}
      </div>
      <div className="stack-actions">
        <Link href="/graph" className="btn btn-primary">Open Global Tax Graph</Link>
        <Link href="/entities" className="btn btn-secondary">Entity register</Link>
        <Link href="/scope" className="btn btn-secondary">Scope engine</Link>
      </div>
      <p className="text-muted" style={{ marginTop: 16, fontSize: 13 }}>{calcs.length} ETR blends computed in this snapshot (majority CEs, MOCE and JV are not mixed). Full group is 48 / 212 — remaining entities are held in the canonical model as in-scope CEs with complete data (prototype graph shows the control chain).</p>
    </div>
  );
}

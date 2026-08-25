"use client";

import { ENTITIES } from "@/lib/model";
import { scopeTest } from "@/lib/engine";
import { classifyAll } from "@/lib/entityClass";
import { useStore } from "@/lib/store";
import { eur } from "@/lib/format";
import Link from "next/link";
import { useCalc } from "@/lib/useCalc";
import { populationReconciliation } from "@/lib/population";

export default function GroupPage() {
  const { groupId } = useStore();
  const scope = scopeTest(groupId);
  const { calcs } = useCalc();
  const classes = classifyAll();
  const cls = (t: string) => ENTITIES.filter((e) => e.type === t).length;
  const popeN = classes.filter((c) => c.pope).length;
  const moceN = classes.filter((c) => c.moce).length;
  const population = populationReconciliation();
  const mosg = classes.filter((c) => c.blendKind === "mosg");

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
      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-head">
          <h4>Entity-population reconciliation</h4>
          <span className={population.entityReconciles && population.jurisdictionReconciles ? "tag tag-pass" : "tag tag-warn"}>
            {population.entityReconciles && population.jurisdictionReconciles ? "Source list reconciled" : "Population gap"}
          </span>
        </div>
        <div className="panel-body waterfall">
          <div className="wf-row"><span>Legal entity master</span><strong>{population.sourceEntities} entities · {population.sourceJurisdictions} jurisdictions</strong></div>
          <div className="wf-row"><span>Full-calculation records</span><span>{population.detailedEntities} · {Math.round(population.calculationCoverage * 100)}% coverage</span></div>
          <div className="wf-row"><span>Non-material CE records</span><span>{population.nonMaterialEntities} · GIR identity / simplified reporting only</span></div>
          <div className="wf-row"><span>Reporting jurisdictions</span><span>{population.reportingJurisdictions} + {population.statelessEntities} stateless CE</span></div>
          <div className="wf-row"><span>ETR blends computed</span><span>{calcs.length} · majority, MOSG, MOCE, JV and investment blends stay separate</span></div>
          <div className="wf-row total"><span>Seeded Minority-Owned Subgroup</span><span>{mosg.length} Malaysian CEs · blend {mosg[0]?.blendKey ?? "—"}</span></div>
        </div>
        <p className="text-muted" style={{ margin: "12px 16px 16px", fontSize: 13 }}>
          The 212-row population now reconciles to the source master. Non-material rows are not represented as invented financial calculations; they are explicitly marked for GIR simplified reporting. The Malaysian Minority-Owned Parent and its two subsidiaries form one multi-entity MOSG blend.
        </p>
      </div>
    </div>
  );
}

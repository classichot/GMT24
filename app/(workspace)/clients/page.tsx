"use client";

import { GROUPS } from "@/lib/model";
import { calculateGroup, scopeTest, totals } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { eur } from "@/lib/format";
import { useRouter } from "next/navigation";

export default function ClientsPage() {
  const { mode, setGroupId, groupId, flash } = useStore();
  const router = useRouter();
  if (mode !== "advisor") {
    return <p>Client portfolio is an Advisor-mode surface. Switch mode in Settings.</p>;
  }
  return (
    <div>
      <p className="text-muted" style={{ marginBottom: 16 }}>7-L Advisory · Pillar Two portfolio. Each client is an isolated tenant with its own calculation snapshot, rule pack and GIR pack.</p>
      <div className="grid-2">
        {GROUPS.map((g) => {
          const t = totals(calculateGroup(g.id));
          const s = scopeTest(g.id);
          return (
            <button
              key={g.id}
              className="panel"
              style={{ textAlign: "left", cursor: "pointer", borderColor: groupId === g.id ? "var(--color-accent)" : undefined }}
              onClick={() => { setGroupId(g.id); flash(`Opened ${g.name}`); router.push("/overview"); }}
            >
              <div className="panel-head">
                <div>
                  <h4 style={{ margin: 0 }}>{g.name}</h4>
                  <div className="text-muted" style={{ fontSize: 12 }}>{g.upe} · {g.fy}</div>
                </div>
                <span className={s.status === "IN SCOPE" ? "status-in" : "status-rev"}>{s.status}</span>
              </div>
              <div className="panel-body">
                <div className="wf-row"><span>Top-up</span><strong>{eur(t.topUp, true)}</strong></div>
                <div className="wf-row"><span>Entities / jur.</span><span>{g.entities} / {g.jurisdictions}</span></div>
                <div className="wf-row"><span>Workflow</span><span>{g.workflow}</span></div>
                <div className="wf-row"><span>Advisor</span><span>{g.advisor}</span></div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

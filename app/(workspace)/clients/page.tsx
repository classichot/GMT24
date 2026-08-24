"use client";

import { calculateGroup, scopeTest, totals } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { eur } from "@/lib/format";
import { peekGroupLocks } from "@/lib/yearLedger";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StartEngage } from "@/components/StartEngage";

export default function ClientsPage() {
  const { mode, setGroupId, groupId, flash, groups } = useStore();
  const router = useRouter();
  if (mode !== "advisor") {
    return (
      <p>
        Client portfolio is an Advisor-mode surface.{" "}
        <Link href="/settings">Switch mode in Settings</Link>.
      </p>
    );
  }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16, alignItems: "flex-start" }}>
        <p className="text-muted" style={{ margin: 0, flex: 1, maxWidth: "72ch" }}>
          7-L Advisory · Pillar Two portfolio. Each client is an isolated tenant with its own calculation snapshot, year ledger, rule pack and GIR pack. Open a new file from <strong>New engagement</strong>. Lock and compare Fiscal Years on <Link href="/years">Year record</Link>.
        </p>
        <StartEngage />
      </div>
      <div className="grid-2">
        {groups.map((g) => {
          const t = totals(calculateGroup(g.id));
          const s = scopeTest(g.id);
          const yr = peekGroupLocks(g.id);
          const stage = g.custom ? "Onboarding" : g.workflow;
          return (
            <button
              key={g.id}
              className="panel"
              style={{ textAlign: "left", cursor: "pointer", borderColor: groupId === g.id ? "var(--color-accent)" : undefined }}
              onClick={() => {
                setGroupId(g.id);
                flash(`Opened ${g.name}`);
                router.push(g.custom ? "/data" : "/overview");
              }}
            >
              <div className="panel-head">
                <div>
                  <h4 style={{ margin: 0 }}>{g.name}</h4>
                  <div className="text-muted" style={{ fontSize: 12 }}>{g.upe} · {g.fy}</div>
                </div>
                <span className={s.status === "IN SCOPE" ? "status-in" : s.status === "OUT OF SCOPE" ? "status-out" : "status-rev"}>{s.status}</span>
              </div>
              <div className="panel-body">
                <div className="wf-row"><span>Top-up</span><strong>{g.custom ? "—" : eur(t.topUp, true)}</strong></div>
                <div className="wf-row"><span>Entities / jur.</span><span>{g.entities} / {g.jurisdictions}</span></div>
                <div className="wf-row"><span>Workflow</span><span>{stage}</span></div>
                <div className="wf-row"><span>Advisor</span><span>{g.advisor}</span></div>
                <div className="wf-row"><span>Year record</span><span>{yr.fy} · {yr.locked ? `${yr.locked} locked` : "no lock yet"}</span></div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Database, Search } from "lucide-react";
import { NoMission } from "@/components/agi/AgiFrame";
import { recoverEvidence } from "@/lib/agi/wow";
import { useAgi } from "@/lib/agi/useAgi";
import type { MissionRecord } from "@/lib/agi/types";

const KLASS: Record<string, string> = { verified: "tag-ok", candidate: "tag-accent", assumption: "tag-warn", missing: "tag-hot" };

export default function DataReadinessPage() {
  const agi = useAgi();
  const m = agi.selected;
  if (!m) return <NoMission />;
  return <Readiness m={m} />;
}

function Readiness({ m }: { m: MissionRecord }) {
  const agi = useAgi();
  const step = m.steps.find((s) => s.id === "readiness");
  const gaps = recoverEvidence(m);
  const counts = { verified: 0, candidate: 0, assumption: 0, missing: 0 };
  for (const g of gaps) counts[g.klass] += 1;
  const busy = !!agi.busy;
  const locked = ["completed", "cancelled", "paused"].includes(m.state);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, flex: 1 }}>Data Readiness</h2>
        <button className="btn btn-primary" disabled={busy || locked} onClick={() => agi.tool("check_data_readiness", { missionId: m.id })}><Database size={15} />Check required datasets</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => agi.tool("recover_evidence", { missionId: m.id })}><Search size={15} />Recover missing evidence</button>
      </div>

      <div className="callout">
        Agents work against the pinned case version. Missing information stays unresolved — it is never estimated. Verified evidence, candidate documents, assumptions and missing items are listed separately so an unsupported conclusion cannot quietly become final.
      </div>

      <div className="kpi-grid cols-5">
        <div className="kpi"><div className="kpi-label">Readiness step</div><div className="kpi-val" style={{ fontSize: 18, marginTop: 8 }}><span className={`tag ${step?.status === "done" ? "tag-ok" : step?.status === "blocked" ? "tag-warn" : "tag-neutral"}`}>{step?.status ?? "pending"}</span></div><div className="kpi-sub">{step?.summary ?? "not run"}</div></div>
        <div className="kpi"><div className="kpi-label">Verified</div><div className="kpi-val">{counts.verified}</div><div className="kpi-sub">posted slots</div></div>
        <div className="kpi"><div className="kpi-label">Candidate</div><div className="kpi-val">{counts.candidate}</div><div className="kpi-sub">queued files</div></div>
        <div className="kpi"><div className="kpi-label">Assumption</div><div className="kpi-val">{counts.assumption}</div><div className="kpi-sub">incomplete</div></div>
        <div className="kpi"><div className="kpi-label">Missing</div><div className="kpi-val">{counts.missing}</div><div className={`kpi-sub${counts.missing ? " hot" : ""}`}>blocks completion</div></div>
      </div>

      <section className="panel">
        <div className="panel-head"><h4>Exception queue</h4><Link href="/data" className="btn btn-ghost">Open Data Hub</Link></div>
        <div className="panel-body" style={{ fontSize: 12 }}>
          <table className="table">
            <thead><tr><th>Class</th><th>Item</th><th>Detail</th><th>Information request</th></tr></thead>
            <tbody>
              {gaps.map((g) => (
                <tr key={g.id}>
                  <td><span className={`tag ${KLASS[g.klass]}`} style={{ fontSize: 10 }}>{g.klass}</span></td>
                  <td>{g.title}{g.href && <> · <Link href={g.href}>open</Link></>}</td>
                  <td>{g.detail}</td>
                  <td>{g.request ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

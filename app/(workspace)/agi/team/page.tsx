"use client";

import Link from "next/link";
import { useState } from "react";
import { RefreshCw, Users } from "lucide-react";
import { Briefing, CompletionList, ModeTags, TeamTable, useDirectorPlan } from "@/components/agi/DirectorPanel";
import { NoMission } from "@/components/agi/AgiFrame";
import { AUTONOMY_LABEL, SPECIALISTS, WORK_MODE_LABEL, type Autonomy, type WorkMode } from "@/lib/agi/specialists";
import { useAgi } from "@/lib/agi/useAgi";
import type { MissionRecord } from "@/lib/agi/types";

export default function TeamPage() {
  const agi = useAgi();
  const m = agi.selected;
  if (!m) return <NoMission />;
  return <Team m={m} />;
}

function Team({ m }: { m: MissionRecord }) {
  const agi = useAgi();
  const plan = useDirectorPlan(m);
  const [mode, setMode] = useState<WorkMode>(plan.mode);
  const [autonomy, setAutonomy] = useState<Autonomy>(plan.autonomy);
  const [cap, setCap] = useState(plan.agentCap);
  const busy = !!agi.busy;
  const locked = ["completed", "cancelled"].includes(m.state);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, flex: 1 }}>AI Team Builder</h2>
        <ModeTags m={m} />
        <button className="btn btn-primary" disabled={busy || locked} onClick={() => agi.tool("design_team", { missionId: m.id, workMode: mode, autonomy, agentCap: cap })}>
          <Users size={15} />Rebuild team
        </button>
      </div>

      <Briefing m={m} />

      <section className="panel">
        <div className="panel-head"><h4>Mode and autonomy</h4><span className="tag tag-outline">agent count ≠ permission</span></div>
        <div className="panel-body" style={{ display: "grid", gap: 12, fontSize: 12 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(Object.keys(WORK_MODE_LABEL) as WorkMode[]).map((k) => (
              <button key={k} type="button" className={`chip${mode === k ? " active" : ""}`} onClick={() => setMode(k)}>{WORK_MODE_LABEL[k].label}</button>
            ))}
          </div>
          <p style={{ margin: 0, color: "var(--color-neutral-600)" }}>{WORK_MODE_LABEL[mode].blurb}</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(Object.keys(AUTONOMY_LABEL) as Autonomy[]).map((k) => (
              <button key={k} type="button" className={`chip${autonomy === k ? " active" : ""}`} onClick={() => setAutonomy(k)}>{AUTONOMY_LABEL[k].label}</button>
            ))}
          </div>
          <p style={{ margin: 0, color: "var(--color-neutral-600)" }}>{AUTONOMY_LABEL[autonomy].blurb}</p>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            Concurrency cap
            <input className="input" type="number" min={1} max={16} value={cap} onChange={(e) => setCap(Math.min(16, Math.max(1, Number(e.target.value) || 1)))} style={{ width: 72 }} />
            <span style={{ color: "var(--color-neutral-600)" }}>Budget {plan.budget.steps} steps · {plan.budget.retries} retries · concurrency {plan.budget.concurrency}</span>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h4>Agent Cards · {plan.cards.length}</h4><span className="tag tag-outline">catalogue roles only</span></div>
        <div className="panel-body" style={{ fontSize: 12, overflowX: "auto" }}>
          <TeamTable m={m} />
        </div>
      </section>

      <div className="agi-two">
        <section className="panel">
          <div className="panel-head"><h4>Work plan</h4></div>
          <div className="panel-body" style={{ fontSize: 12 }}>
            <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              {plan.parallel.map((wave, i) => (
                <li key={i}>Wave {i + 1}: {wave.join(" · ") || "—"}</li>
              ))}
            </ol>
            <div style={{ marginTop: 12, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Handoffs</div>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.6 }}>
              {plan.handoffs.map((h) => <li key={h.from + h.to}><span className="agi-mono">{h.from}</span> → <span className="agi-mono">{h.to}</span> — {h.why}</li>)}
            </ul>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h4>Completion means</h4></div>
          <div className="panel-body" style={{ fontSize: 12 }}><CompletionList m={m} /></div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><h4>Approved specialist catalogue</h4><button className="btn btn-ghost" onClick={() => agi.tool("design_team", { missionId: m.id })} disabled={busy}><RefreshCw size={13} />Re-assess complexity</button></div>
        <div className="panel-body" style={{ fontSize: 12 }}>
          <p style={{ marginTop: 0, color: "var(--color-neutral-600)" }}>The director can tailor assignment and reviewer. It cannot invent a role or grant a permission the catalogue does not list.</p>
          <table className="table">
            <thead><tr><th>Role</th><th>Responsibility</th><th>Required output</th><th>Screen</th></tr></thead>
            <tbody>
              {SPECIALISTS.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.role}</strong><div className="agi-mono" style={{ color: "var(--color-neutral-600)" }}>{s.id} · {s.family}</div></td>
                  <td>{s.responsibility}</td>
                  <td>{s.output}</td>
                  <td><Link href={s.href}>{s.href}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

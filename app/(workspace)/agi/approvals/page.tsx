"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { NoMission } from "@/components/agi/AgiFrame";
import { auditChallenge, recoverEvidence } from "@/lib/agi/wow";
import { openBlockers, openDecisions } from "@/lib/agi/mission";
import { shortHash } from "@/lib/agi/case";
import { useAgi } from "@/lib/agi/useAgi";
import type { Decision, MissionRecord } from "@/lib/agi/types";

export default function ApprovalsPage() {
  const agi = useAgi();
  const m = agi.selected;
  if (!m) return <NoMission />;
  return <Approvals m={m} />;
}

function Approvals({ m }: { m: MissionRecord }) {
  const agi = useAgi();
  const decisions = openDecisions(m);
  const blockers = openBlockers(m);
  const findings = auditChallenge(m).filter((f) => f.status === "open");
  const missing = recoverEvidence(m).filter((g) => g.klass === "missing");
  const disagreements = m.proposals.filter((p) => p.status === "proposed" && p.caseHash === m.case.hash);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, flex: 1 }}>Approvals & Exceptions</h2>
        <span className="tag tag-outline">{decisions.length + blockers.length + findings.length + missing.length} items in the tax-team queue</span>
      </div>

      <div className="callout">
        One queue for the tax team: decisions awaiting approval, agent disagreements, missing evidence and unresolved interpretations. Agent majority voting does not establish tax correctness. Binding elections, final sign-off, filing and payment stay separately permissioned.
      </div>

      <div className="kpi-grid cols-4">
        <div className="kpi"><div className="kpi-label">Open decisions</div><div className="kpi-val">{decisions.length}</div><div className="kpi-sub">person required</div></div>
        <div className="kpi"><div className="kpi-label">Blockers</div><div className="kpi-val">{blockers.length}</div><div className="kpi-sub">information / validation</div></div>
        <div className="kpi"><div className="kpi-label">Review findings</div><div className="kpi-val">{findings.length}</div><div className="kpi-sub">independent challenge</div></div>
        <div className="kpi"><div className="kpi-label">Missing evidence</div><div className="kpi-val">{missing.length}</div><div className="kpi-sub">cannot become final</div></div>
      </div>

      {decisions.map((d) => <DecisionRow key={d.id} m={m} d={d} />)}

      {blockers.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h4>Blockers</h4></div>
          <div className="panel-body" style={{ fontSize: 12, display: "grid", gap: 10 }}>
            {blockers.map((b) => (
              <div key={b.id} className="callout" style={{ borderLeftColor: b.kind === "validation" ? "var(--color-hot)" : "var(--color-warn)" }}>
                <strong>{b.title}</strong> <span className="tag tag-neutral" style={{ fontSize: 10 }}>{b.kind}</span>
                <div style={{ marginTop: 4 }}>{b.detail}</div>
                {b.href && <Link href={b.href}>Open →</Link>}
              </div>
            ))}
          </div>
        </section>
      )}

      {disagreements.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h4>Proposed changes awaiting a person</h4></div>
          <div className="panel-body" style={{ fontSize: 12 }}>
            <table className="table">
              <thead><tr><th>Kind</th><th>Title</th><th>Target</th><th>Value</th><th>Reason</th></tr></thead>
              <tbody>{disagreements.map((p) => <tr key={p.id}><td>{p.kind}</td><td>{p.title}</td><td className="agi-mono">{p.target}</td><td>{String(p.value)}</td><td>{p.reason}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {findings.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h4>Independent review findings</h4><Link href="/agi/audit-file" className="btn btn-ghost">Open Audit Defence</Link></div>
          <div className="panel-body" style={{ fontSize: 12 }}>
            <table className="table">
              <thead><tr><th>Question</th><th>Target</th><th>Severity</th><th>Gap</th></tr></thead>
              <tbody>{findings.map((f) => <tr key={f.id}><td>{f.question}</td><td>{f.target}</td><td>{f.severity}</td><td>{f.gap}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {missing.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h4>Missing evidence</h4><Link href="/agi/data" className="btn btn-ghost">Open Data Readiness</Link></div>
          <div className="panel-body" style={{ fontSize: 12 }}>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
              {missing.map((g) => <li key={g.id}><strong>{g.title}</strong> — {g.request ?? g.detail}</li>)}
            </ul>
          </div>
        </section>
      )}

      {!decisions.length && !blockers.length && !findings.length && !missing.length && (
        <div className="callout">Nothing is waiting on the tax team for this mission. Continue from <Link href="/agi">Mission Control</Link>.</div>
      )}
    </div>
  );
}

function DecisionRow({ m, d }: { m: MissionRecord; d: Decision }) {
  const agi = useAgi();
  const [chosen, setChosen] = useState(d.options[0]?.id ?? "");
  const [note, setNote] = useState("");
  const stale = d.caseHash !== m.case.hash;
  return (
    <section className="panel">
      <div className="panel-head"><h4>{d.title}</h4><span className="tag tag-warn">{d.kind}</span></div>
      <div className="panel-body" style={{ fontSize: 12, display: "grid", gap: 10 }}>
        <div>{d.detail}</div>
        <div style={{ color: "var(--color-neutral-600)" }}>Requested by {d.requestedBy} on case {shortHash(d.caseHash)}</div>
        {stale && <div className="tag tag-hot">Case changed — re-run the analysis before deciding</div>}
        {d.options.map((o) => (
          <label key={o.id} style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 8, padding: "8px 10px", border: `1px solid ${chosen === o.id ? "var(--color-accent)" : "var(--color-divider)"}` }}>
            <input type="radio" name={d.id} checked={chosen === o.id} onChange={() => setChosen(o.id)} />
            <span><strong>{o.label}</strong><span style={{ display: "block", color: "var(--color-neutral-600)" }}>{o.detail}</span></span>
          </label>
        ))}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="input" placeholder="Decision note" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1 }} />
          <button className="btn btn-primary" disabled={stale || !chosen} onClick={() => agi.decide(m.id, d.id, "approved", chosen, note || undefined)}><Check size={14} />Approve</button>
          <button className="btn btn-secondary" disabled={stale} onClick={() => agi.decide(m.id, d.id, "rejected", undefined, note || undefined)}><X size={14} />Reject</button>
        </div>
      </div>
    </section>
  );
}

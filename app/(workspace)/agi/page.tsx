"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRightLeft, Bot, Check, CircleStop, Pause, Play, RefreshCw, Rocket, ShieldCheck, X } from "lucide-react";
import { NoMission, StateBadge } from "@/components/agi/AgiFrame";
import { EvidencePanel } from "@/components/agi/Evidence";
import { ObjectiveSliders } from "@/components/agi/Objectives";
import { describeCaseDiff, shortHash } from "@/lib/agi/case";
import { diffCases } from "@/lib/agi/diff";
import { DEFAULT_OBJECTIVES, RELEASE_COMPLETION, RELEASE_ELECTION_SET, RELEASE_OBJECTIVE, openBlockers, openDecisions, progress } from "@/lib/agi/mission";
import { applicableChanges } from "@/lib/agi/executor";
import { latestRun } from "@/lib/agi/auditPack";
import { checkSummary } from "@/lib/agi/verify";
import { useAgi } from "@/lib/agi/useAgi";
import { AGENT_CLIENTS, MISSION_STATE_LABEL, type AgentClientId, type Decision, type MissionObjectives, type MissionRecord } from "@/lib/agi/types";
import { eur } from "@/lib/format";
import { labelElection } from "@/lib/evidenceHistory";

const STEP_MARK: Record<string, string> = { done: "✓", running: "…", blocked: "!", failed: "×", skipped: "–", pending: "" };

export default function MissionOverview() {
  const agi = useAgi();
  const [building, setBuilding] = useState(agi.missions.length === 0);
  const m = agi.selected;
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, flex: 1 }}>Mission Overview</h2>
        <button className="btn btn-primary" onClick={() => setBuilding(!building)}><Rocket size={15} />{building ? "Close builder" : "New mission"}</button>
        <Link href="/agi/connections" className="btn btn-secondary"><Bot size={15} />Connect an assistant</Link>
      </div>
      {building && <MissionBuilder onDone={() => setBuilding(false)} />}
      {!m && !building && <NoMission />}
      {m && <MissionCard m={m} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mission Builder                                                     */
/* ------------------------------------------------------------------ */

function MissionBuilder({ onDone }: { onDone: () => void }) {
  const agi = useAgi();
  const [objective, setObjective] = useState(RELEASE_OBJECTIVE);
  const [jur, setJur] = useState<string[]>(agi.live.jurisdictions);
  const [weights, setWeights] = useState<MissionObjectives>(DEFAULT_OBJECTIVES);
  const toggle = (iso: string) => setJur((j) => (j.includes(iso) ? j.filter((x) => x !== iso) : [...j, iso]));
  return (
    <section className="panel">
      <div className="panel-head"><h4>Mission Builder · release 1 template</h4><span className="tag tag-outline">Case {shortHash(agi.liveHash)} · {agi.live.fy}</span></div>
      <div className="panel-body agi-two">
        <div style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
            <strong>Objective</strong>
            <textarea className="input" rows={3} value={objective} onChange={(e) => setObjective(e.target.value)} />
          </label>
          <div style={{ fontSize: 12 }}>
            <strong>Jurisdiction scope</strong>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {agi.live.jurisdictions.map((iso) => (
                <button key={iso} type="button" className={`chip${jur.includes(iso) ? " active" : ""}`} onClick={() => toggle(iso)}>{iso}</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 12 }}>
            <strong>Permitted actions</strong>
            <div style={{ color: "var(--color-neutral-600)", marginTop: 4, lineHeight: 1.5 }}>Read · compare elections ({RELEASE_ELECTION_SET.map(labelElection).join(", ")}) · run scenarios · verify · review compliance · propose changes · build the package. Approving, completing and applying changes stay with a person.</div>
          </div>
          <div style={{ fontSize: 12 }}>
            <strong>Completion rules</strong>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18, color: "var(--color-neutral-600)", lineHeight: 1.5 }}>{RELEASE_COMPLETION.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        </div>
        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <div style={{ fontSize: 12 }}><strong>Company objectives</strong><div style={{ color: "var(--color-neutral-600)" }}>Weights 0–5 the ranking of election alternatives reflects. Engine figures never change with them.</div></div>
          <ObjectiveSliders value={weights} onChange={setWeights} />
          <div className="stack-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-primary" disabled={!jur.length || !!agi.busy} onClick={() => { const r = agi.createMission({ objective, jurisdictions: jur, objectives: weights }); if (r) onDone(); }}>
              <Rocket size={15} />Create mission
            </button>
            <button className="btn btn-secondary" disabled={!jur.length || !!agi.busy} onClick={() => { const r = agi.createMission({ objective, jurisdictions: jur, objectives: weights }); if (r) { agi.run(r.id); onDone(); } }}>
              <Play size={15} />Create and run
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>Creating pins the live case version. The same mission id is visible to a connected assistant through the gateway.</div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Selected mission                                                    */
/* ------------------------------------------------------------------ */

function MissionCard({ m }: { m: MissionRecord }) {
  const agi = useAgi();
  const p = progress(m);
  const run = latestRun(m);
  const cs = checkSummary(m.checks);
  const gate = agi.gate(m);
  const blockers = openBlockers(m);
  const decisions = openDecisions(m);
  const drifted = agi.drifted(m);
  const approvedChanges = applicableChanges(m).proposals;
  const busy = !!agi.busy;
  const canRun = ["draft", "running", "waiting-info", "validation-failed"].includes(m.state);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="kpi-grid cols-6">
        <div className="kpi"><div className="kpi-label">State</div><div className="kpi-val" style={{ fontSize: 18, marginTop: 8 }}><StateBadge m={m} /></div><div className="kpi-sub">v{m.version} · {m.owner.client}</div></div>
        <div className="kpi"><div className="kpi-label">Progress</div><div className="kpi-val">{p.done}/{p.total}</div><div className="kpi-sub">steps · {p.pct}%</div></div>
        <div className="kpi"><div className="kpi-label">Latest calculation</div><div className="kpi-val" style={{ fontSize: 22 }}>{run ? eur(run.totals.topUp) : "—"}</div><div className="kpi-sub">{run ? `${run.id} · Core ${eur(run.coreTopUp)}` : "no run yet"}</div></div>
        <div className="kpi"><div className="kpi-label">Checks</div><div className="kpi-val" style={{ fontSize: 22 }}>{cs.total ? `${cs.passes}/${cs.total}` : "—"}</div><div className={`kpi-sub${cs.blocking ? " hot" : ""}`}>{cs.total ? `${cs.blocking} blocking · ${cs.warns} warn` : "not verified"}</div></div>
        <div className="kpi"><div className="kpi-label">Waiting on</div><div className="kpi-val" style={{ fontSize: 22 }}>{blockers.length + decisions.length}</div><div className="kpi-sub">{decisions.length} decision · {blockers.length} blocker</div></div>
        <div className="kpi"><div className="kpi-label">Evidence</div><div className="kpi-val" style={{ fontSize: 22 }}>{m.evidence.length}</div><div className="kpi-sub">hash-chained records</div></div>
      </div>

      <section className="panel">
        <div className="panel-head" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h4>{m.objective}</h4>
            <div style={{ fontSize: 12, color: "var(--color-neutral-600)", marginTop: 4 }}>{m.id} · {m.case.snapshot.groupName} · {m.scope.fy} · {m.scope.jurisdictions.join(", ")} · created by {m.createdBy} {new Date(m.createdAt).toLocaleString("en-GB")}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {canRun && <button className="btn btn-primary" disabled={busy} onClick={() => agi.run(m.id)}><Play size={14} />{m.state === "draft" ? "Start" : "Continue"}</button>}
            {["running", "waiting-info", "waiting-approval", "validation-failed"].includes(m.state) && <button className="btn btn-secondary" disabled={busy} onClick={() => agi.pause(m.id)}><Pause size={14} />Pause</button>}
            {m.state === "paused" && <button className="btn btn-primary" disabled={busy} onClick={() => { agi.resume(m.id); agi.run(m.id); }}><Play size={14} />Resume</button>}
            {(drifted || m.state === "completed") && <button className="btn btn-secondary" disabled={busy} onClick={() => agi.recheck(m.id)} title="Pin the live case; approvals reset; prior package preserved"><RefreshCw size={14} />Recheck what changed</button>}
            {m.state === "ready-for-review" && <button className="btn btn-hot" disabled={busy || !gate.ok} onClick={() => agi.complete(m.id)} title={gate.reasons.join(" ")}><ShieldCheck size={14} />Approve completion</button>}
            {m.state !== "cancelled" && m.state !== "completed" && <button className="btn btn-ghost" disabled={busy} onClick={() => setShowCancel(!showCancel)}><CircleStop size={14} />Cancel</button>}
          </div>
        </div>
        {showCancel && (
          <div className="panel-body" style={{ display: "flex", gap: 8, alignItems: "center", borderBottom: "2px solid var(--color-divider)" }}>
            <input className="input" placeholder="Reason (kept in the evidence record)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} style={{ flex: 1 }} />
            <button className="btn btn-hot" onClick={() => { agi.cancel(m.id, cancelReason); setShowCancel(false); }}>Confirm cancel</button>
          </div>
        )}
        <div className="panel-body agi-three">
          <div>
            <ul className="agi-steps">
              {m.steps.map((s, i) => (
                <li key={s.id} className={`agi-step ${s.status}`}>
                  <span className="agi-step-dot">{STEP_MARK[s.status] || i + 1}</span>
                  <div>
                    <div className="agi-step-title">{i + 1}. {s.title} <span className="agi-mono" style={{ color: "var(--color-neutral-600)", fontWeight: 400 }}>{s.tool}</span></div>
                    {s.summary && <div className="agi-step-sub">{s.summary}</div>}
                    {s.blocker && <div className="agi-step-sub warn">Blocked: {s.blocker}</div>}
                  </div>
                  <span className={`tag ${s.status === "done" ? "tag-ok" : s.status === "blocked" ? "tag-warn" : s.status === "failed" ? "tag-hot" : s.status === "running" ? "tag-accent" : "tag-neutral"}`} style={{ fontSize: 10 }}>{s.status}</span>
                </li>
              ))}
            </ul>
          </div>
          <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Completion gate</div>
              {gate.ok ? <div className="tag tag-ok" style={{ marginTop: 6 }}>All completion rules satisfied</div> : (
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, lineHeight: 1.5 }}>{gate.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              )}
            </div>
            {blockers.length > 0 && (
              <div>
                <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Open blockers</div>
                {blockers.map((b) => (
                  <div key={b.id} className="callout" style={{ marginTop: 6, borderLeftColor: b.kind === "validation" ? "var(--color-hot)" : "var(--color-warn)" }}>
                    <strong>{b.title}</strong> <span className="tag tag-neutral" style={{ fontSize: 10 }}>{b.kind}</span>
                    <div style={{ marginTop: 4 }}>{b.detail}</div>
                    {b.href && <Link href={b.href} style={{ fontSize: 12 }}>Open in {b.href.startsWith("/agi") ? "AGI" : "normal mode"} →</Link>}
                  </div>
                ))}
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Case version</div>
              <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                Mission pinned <span className="agi-mono">{m.case.hash}</span> ({m.case.snapshot.origin}, {new Date(m.case.snapshot.takenAt).toLocaleString("en-GB")}). {m.case.snapshot.ruleVersions.length} active rule versions.
                {drifted ? <> Live case is <span className="agi-mono">{shortHash(agi.liveHash)}</span> — see “Why did this number change” below.</> : <> Live case matches.</>}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Ownership</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>{m.owner.client} · {m.owner.actor} · lease until {new Date(m.owner.leaseUntil).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}{m.handoffs.length ? ` · ${m.handoffs.length} handoff(s)` : ""}</div>
              <Handoff m={m} />
            </div>
          </div>
        </div>
      </section>

      <DecisionCentre m={m} />

      {approvedChanges.length > 0 && (
        <section className="panel">
          <div className="panel-head" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h4 style={{ flex: 1 }}>Approved changes ready for normal mode</h4>
            <button className="btn btn-primary" disabled={busy} onClick={() => agi.applyApproved(m.id)}><Check size={14} />Apply {approvedChanges.length} in normal mode</button>
          </div>
          <div className="panel-body" style={{ fontSize: 12 }}>
            <table className="table">
              <thead><tr><th>Change</th><th>Target</th><th>Before</th><th>After</th><th>Reason</th></tr></thead>
              <tbody>{approvedChanges.map((pp) => <tr key={pp.id}><td>{pp.title}</td><td className="agi-mono">{pp.target}</td><td>{pp.before}</td><td>{String(pp.value)}</td><td>{pp.reason}</td></tr>)}</tbody>
            </table>
            <div style={{ marginTop: 8, color: "var(--color-neutral-600)" }}>Applying writes through the Election Engine with a history record; the change then shows in normal mode (Elections, Year record, Evidence history). The mission's case version will differ afterwards — use “Recheck what changed” to pin the new version; the previous approved package is preserved for comparison.</div>
          </div>
        </section>
      )}

      {drifted && <WhyChanged m={m} />}

      {m.proposals.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h4>Proposals</h4><span className="tag tag-neutral">{m.proposals.length}</span></div>
          <div className="panel-body" style={{ fontSize: 12 }}>
            <table className="table">
              <thead><tr><th>Status</th><th>Kind</th><th>Title</th><th>Target</th><th>Value</th><th>By</th><th>Case</th></tr></thead>
              <tbody>{m.proposals.slice().reverse().map((pp) => (
                <tr key={pp.id}>
                  <td><span className={`tag ${pp.status === "applied" ? "tag-ok" : pp.status === "approved" ? "tag-accent" : pp.status === "proposed" ? "tag-warn" : "tag-neutral"}`} style={{ fontSize: 10 }}>{pp.status}</span></td>
                  <td>{pp.kind}</td><td>{pp.title}</td><td className="agi-mono">{pp.target}</td><td>{String(pp.value)}</td><td>{pp.proposedBy}</td><td className="agi-mono">{shortHash(pp.caseHash)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      <EvidencePanel m={m} title="Audit evidence" compact />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Decision & Approval Centre                                          */
/* ------------------------------------------------------------------ */

function DecisionCentre({ m }: { m: MissionRecord }) {
  const agi = useAgi();
  const open = openDecisions(m);
  const past = m.decisions.filter((d) => d.status !== "open").slice().reverse();
  if (!m.decisions.length) return null;
  return (
    <section className="panel">
      <div className="panel-head" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h4 style={{ flex: 1 }}>Decision and Approval Centre</h4>
        <span className="tag tag-outline">Agents prepare · GMT24 enforces who approves</span>
      </div>
      <div className="panel-body" style={{ display: "grid", gap: 14 }}>
        {open.map((d) => <DecisionForm key={d.id} m={m} d={d} onDecide={(v, chosen, note) => agi.decide(m.id, d.id, v, chosen, note)} />)}
        {past.length > 0 && (
          <table className="table" style={{ fontSize: 12 }}>
            <thead><tr><th>Decision</th><th>Kind</th><th>Outcome</th><th>By</th><th>Case</th><th>Note</th></tr></thead>
            <tbody>{past.map((d) => (
              <tr key={d.id}>
                <td>{d.title}</td><td>{d.kind}</td>
                <td><span className={`tag ${d.status === "approved" ? "tag-ok" : d.status === "rejected" ? "tag-hot" : "tag-neutral"}`} style={{ fontSize: 10 }}>{d.status}{d.chosen ? ` · ${d.options.find((o) => o.id === d.chosen)?.label ?? d.chosen}` : ""}</span></td>
                <td>{d.decidedBy ?? "—"}</td><td className="agi-mono">{shortHash(d.caseHash)}</td><td>{d.note ?? ""}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function DecisionForm({ m, d, onDecide }: { m: MissionRecord; d: Decision; onDecide: (v: "approved" | "rejected", chosen?: string, note?: string) => void }) {
  const [chosen, setChosen] = useState(d.options[0]?.id ?? "");
  const [note, setNote] = useState("");
  const stale = d.caseHash !== m.case.hash;
  return (
    <div className="callout" style={{ borderLeftColor: "var(--color-warn)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>{d.title}</strong>
        <span className="tag tag-neutral" style={{ fontSize: 10 }}>{d.kind}</span>
        <span style={{ color: "var(--color-neutral-600)" }}>requested by {d.requestedBy} · presented on case {shortHash(d.caseHash)}</span>
      </div>
      <div style={{ marginTop: 6 }}>{d.detail}</div>
      {stale && <div className="tag tag-hot" style={{ marginTop: 8 }}>Case changed since this was presented — re-run the analysis before deciding</div>}
      <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
        {d.options.map((o) => (
          <label key={o.id} style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 8, alignItems: "start", padding: "8px 10px", border: `1px solid ${chosen === o.id ? "var(--color-accent)" : "var(--color-divider)"}`, cursor: "pointer" }}>
            <input type="radio" name={d.id} checked={chosen === o.id} onChange={() => setChosen(o.id)} />
            <span>
              <strong>{o.label}</strong>
              <span style={{ display: "block", color: "var(--color-neutral-600)" }}>{o.detail}</span>
              {o.effect && <span style={{ display: "block", fontSize: 11 }} className="agi-mono">{o.effect}</span>}
            </span>
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input className="input" placeholder="Decision note (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button className="btn btn-primary" disabled={stale || !chosen} onClick={() => onDecide("approved", chosen, note || undefined)}><Check size={14} />Approve</button>
        <button className="btn btn-secondary" disabled={stale} onClick={() => onDecide("rejected", undefined, note || undefined)}><X size={14} />Reject</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Continue with another agent                                         */
/* ------------------------------------------------------------------ */

function Handoff({ m }: { m: MissionRecord }) {
  const agi = useAgi();
  const [to, setTo] = useState<AgentClientId>("claude-cowork");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => setOpen(!open)}><ArrowRightLeft size={13} />Continue with another agent</button>
      {open && (
        <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
          <select className="input" value={to} onChange={(e) => setTo(e.target.value as AgentClientId)}>
            <option value="workspace">GMT24 workspace</option>
            {Object.values(AGENT_CLIENTS).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.vendor})</option>)}
          </select>
          <input className="input" placeholder="Handoff note" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn btn-secondary" disabled={!!agi.busy || to === m.owner.client} onClick={() => { agi.handoff(m.id, to, note); setOpen(false); }}>Hand over ownership</button>
          <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>Progress, decisions and evidence carry over unchanged. The new owner continues from the next checkpoint under the same mission id; other agents cannot mutate the mission while the lease is live.</div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Why did this number change                                          */
/* ------------------------------------------------------------------ */

function WhyChanged({ m }: { m: MissionRecord }) {
  const agi = useAgi();
  const changes = useMemo(() => describeCaseDiff(m.case.snapshot, agi.live), [m, agi.live]);
  const diff = useMemo(() => diffCases(m.case.snapshot, agi.live, `mission ${shortHash(m.case.hash)}`, `live ${shortHash(agi.liveHash)}`), [m, agi.live, agi.liveHash]);
  return (
    <section className="panel">
      <div className="panel-head" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h4 style={{ flex: 1 }}>Why did this number change? <span style={{ fontWeight: 400, fontSize: 12, color: "var(--color-neutral-600)" }}>mission case {shortHash(m.case.hash)} → live case {shortHash(agi.liveHash)}</span></h4>
        <span className={`tag ${diff.totalDelta === 0 ? "tag-neutral" : diff.totalDelta < 0 ? "tag-ok" : "tag-hot"}`}>Group top-up {diff.totalDelta >= 0 ? "+" : "−"}{eur(Math.abs(diff.totalDelta))}</span>
        <button className="btn btn-secondary" disabled={!!agi.busy} onClick={() => agi.recheck(m.id)}><RefreshCw size={14} />Recheck what changed</button>
      </div>
      <div className="panel-body agi-two" style={{ fontSize: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-600)", marginBottom: 6 }}>What changed in the case</div>
          {changes.length ? <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>{changes.map((c) => <li key={c}>{c}</li>)}</ul> : <div>Inputs changed without a describable difference.</div>}
          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-600)", margin: "14px 0 6px" }}>Attribution (sequential engine re-runs)</div>
          <table className="table">
            <thead><tr><th>Driver</th><th className="num">Δ top-up</th><th>Detail</th></tr></thead>
            <tbody>
              {diff.attribution.length === 0 && <tr><td colSpan={3}>No movement in the working total.</td></tr>}
              {diff.attribution.map((a) => <tr key={a.driver + a.label}><td><span className={`tag ${a.driver === "unexplained" ? "tag-hot" : "tag-neutral"}`} style={{ fontSize: 10 }}>{a.driver}</span> {a.label}</td><td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>{a.delta >= 0 ? "+" : "−"}{eur(Math.abs(a.delta))}</td><td>{a.detail}</td></tr>)}
            </tbody>
          </table>
        </div>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-600)", marginBottom: 6 }}>By jurisdiction</div>
          <table className="table">
            <thead><tr><th>Jurisdiction</th><th className="num">Mission</th><th className="num">Live</th><th className="num">Δ</th></tr></thead>
            <tbody>
              {diff.byJurisdiction.length === 0 && <tr><td colSpan={4}>No jurisdiction moved.</td></tr>}
              {diff.byJurisdiction.map((r) => <tr key={r.iso + r.name}><td>{r.name} <span className="agi-mono">{r.iso}</span></td><td className="num">{eur(r.from)}</td><td className="num">{eur(r.to)}</td><td className="num" style={{ fontWeight: 700 }}>{r.delta >= 0 ? "+" : "−"}{eur(Math.abs(r.delta))}</td></tr>)}
            </tbody>
          </table>
          <div className="callout" style={{ marginTop: 12 }}>
            Recheck pins the live version as mission v{m.version + 1}: approvals and verification on v{m.version} are voided (a changed input invalidates approvals), the engine-dependent steps re-open and any earlier approved package stays in the record for comparison. Current state: {MISSION_STATE_LABEL[m.state]}.
          </div>
        </div>
      </div>
    </section>
  );
}

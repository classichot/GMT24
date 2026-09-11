"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Sparkles, Send } from "lucide-react";
import { NoMission } from "@/components/agi/AgiFrame";
import { EvidencePanel } from "@/components/agi/Evidence";
import { ObjectiveSliders, ScoreBars } from "@/components/agi/Objectives";
import { shortHash } from "@/lib/agi/case";
import { openDecisions } from "@/lib/agi/mission";
import { approvedElections } from "@/lib/agi/tools";
import { useAgi } from "@/lib/agi/useAgi";
import type { ElectionOption, MissionRecord } from "@/lib/agi/types";
import { etrPct, eur } from "@/lib/format";
import { labelElection } from "@/lib/evidenceHistory";

export default function OptionsPage() {
  const agi = useAgi();
  const m = agi.selected;
  if (!m) return <NoMission />;
  return <Options m={m} />;
}

function Options({ m }: { m: MissionRecord }) {
  const agi = useAgi();
  const a = m.options;
  const [weights, setWeights] = useState(m.scope.objectives);
  const [picked, setPicked] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const busy = !!agi.busy;
  const stale = a && a.caseHash !== m.case.hash;
  const weightsDirty = (Object.keys(weights) as (keyof typeof weights)[]).some((k) => weights[k] !== m.scope.objectives[k]);
  const open = openDecisions(m).find((d) => d.kind === "election-package");
  const approved = m.decisions.find((d) => d.kind === "election-package" && d.status === "approved" && d.caseHash === m.case.hash);
  const pkg = approvedElections(m);
  const locked = ["completed", "cancelled"].includes(m.state);

  const assess = () => {
    if (weightsDirty) agi.setObjectives(m.id, weights);
    agi.tool("assess_election_options", { missionId: m.id });
  };
  const request = () => {
    const ids = picked.length ? picked : undefined;
    agi.tool("request_approval", { missionId: m.id, kind: "election-package", optionIds: ids });
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, flex: 1 }}>Options and Elections</h2>
        <button className="btn btn-primary" disabled={busy || locked || m.state === "paused"} onClick={assess}><Sparkles size={15} />{a ? "Re-assess best election combination" : "Find the best election combination"}</button>
      </div>

      <div className="agi-three">
        <section className="panel">
          <div className="panel-head"><h4>Company objectives</h4><span className="tag tag-outline">weights 0–5</span></div>
          <div className="panel-body" style={{ display: "grid", gap: 12 }}>
            <ObjectiveSliders value={weights} onChange={setWeights} disabled={locked} />
            <div style={{ fontSize: 12, color: "var(--color-neutral-600)", lineHeight: 1.5 }}>
              The ranking reflects tax and cash-flow, compliance effort, evidence support, uncertainty and future restrictions in the proportion the company approved. Changing weights re-ranks the same engine restatements; it never changes a number. {weightsDirty && <strong>Weights changed — re-assess to apply.</strong>}
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h4>Election register</h4></div>
          <div className="panel-body" style={{ fontSize: 12, display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>In force on the mission case {shortHash(m.case.hash)}</div>
              <div style={{ marginTop: 4 }}>{Object.entries(m.case.snapshot.electionsOn).filter(([, v]) => v).map(([k]) => <span key={k} className="tag tag-neutral" style={{ fontSize: 10, marginRight: 4, marginBottom: 4 }}>{labelElection(k)}</span>)}{!Object.values(m.case.snapshot.electionsOn).some(Boolean) && <span>None — GloBE Core defaults.</span>}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Package the mission runs</div>
              <div style={{ marginTop: 4 }}>{pkg.label}{approved ? ` · approved by ${approved.decidedBy}` : ""}</div>
              {approved && <div style={{ marginTop: 4 }}>{Object.entries(pkg.electionsOn).filter(([, v]) => v).map(([k]) => <span key={k} className="tag tag-accent" style={{ fontSize: 10, marginRight: 4, marginBottom: 4 }}>{labelElection(k)}</span>)}</div>}
            </div>
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Analyser scope</div>
              <div style={{ marginTop: 4 }}>{m.scope.electionSet.map(labelElection).join(" · ")} · {m.scope.jurisdictions.join(", ")}</div>
            </div>
          </div>
        </section>
      </div>

      {open && (
        <div className="callout" style={{ borderLeftColor: "var(--color-warn)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ flex: 1 }}><strong>Waiting for approval:</strong> {open.title} — {open.options.length} option(s) presented on case {shortHash(open.caseHash)}. A person decides in the Decision and Approval Centre.</span>
          <Link href="/agi" className="btn btn-primary">Open decision</Link>
        </div>
      )}

      {!a && <div className="callout">No assessment yet. Run “Find the best election combination”: the Election Engine restates every eligible package from GloBE Core and the analyser ranks them on the weights above, disclosing rejected alternatives with reasons.</div>}

      {a && (
        <section className="panel">
          <div className="panel-head" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h4 style={{ flex: 1 }}>{a.options.length} packages compared · recommended <span style={{ color: "var(--color-accent)" }}>{a.options.find((o) => o.id === a.recommendedId)?.title}</span></h4>
            {stale && <span className="tag tag-hot">Assessed on case {shortHash(a.caseHash)} — re-assess</span>}
            {!approved && !open && !locked && (
              <button className="btn btn-secondary" disabled={busy || !!stale || m.state === "paused"} onClick={request}><Send size={14} />Request approval{picked.length ? ` (${picked.length} picked)` : " (recommended + top 3)"}</button>
            )}
          </div>
          <div className="panel-body" style={{ fontSize: 12 }}>
            <div style={{ color: "var(--color-neutral-600)", marginBottom: 10, lineHeight: 1.5 }}>{a.method}</div>
            <table className="table">
              <thead>
                <tr><th></th><th>#</th><th>Package</th><th>Elections</th><th className="num">FY top-up</th><th className="num">Δ vs Core</th><th className="num">Five-year</th><th>Lock</th><th>Score</th><th>Status</th></tr>
              </thead>
              <tbody>
                {a.options.map((o) => (
                  <OptionRow key={o.id} o={o} rec={o.id === a.recommendedId} picked={picked.includes(o.id)} onPick={() => setPicked((p) => (p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id]))} expanded={expanded === o.id} onExpand={() => setExpanded(expanded === o.id ? null : o.id)} approved={approved?.chosen === o.id} />
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 10, color: "var(--color-neutral-600)", lineHeight: 1.5 }}>
              Score = weighted 0–100 across the five objectives (bars show each objective). Not-bookable packages are shown with the eligibility reason and never recommended. The five-year figure assumes stable income, covered tax and SBIE — a signal, not a forecast.
            </div>
          </div>
        </section>
      )}

      <EvidencePanel m={m} supports="options" title="Evidence behind the ranking" compact />
    </div>
  );
}

function OptionRow({ o, rec, picked, onPick, expanded, onExpand, approved }: { o: ElectionOption; rec: boolean; picked: boolean; onPick: () => void; expanded: boolean; onExpand: () => void; approved: boolean }) {
  return (
    <>
      <tr className={`clickable agi-option${rec ? " rec" : ""}${expanded ? " selected" : ""}`} onClick={onExpand}>
        <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={picked} disabled={!o.bookable} onChange={onPick} aria-label={`Pick ${o.title}`} /></td>
        <td>{o.rank}</td>
        <td><strong>{o.title}</strong>{rec && <span className="tag tag-accent" style={{ fontSize: 10, marginLeft: 6 }}>Recommended</span>}{approved && <span className="tag tag-ok" style={{ fontSize: 10, marginLeft: 6 }}><Check size={10} /> Approved</span>}</td>
        <td>{o.elections.length ? o.elections.map(labelElection).join(", ") : "Core default"}</td>
        <td className="num">{eur(o.fyTopUp)}</td>
        <td className="num" style={{ color: o.deltaVsBaseline < 0 ? "var(--color-ok)" : o.deltaVsBaseline > 0 ? "var(--color-hot)" : undefined }}>{o.deltaVsBaseline === 0 ? "—" : `${o.deltaVsBaseline < 0 ? "−" : "+"}${eur(Math.abs(o.deltaVsBaseline))}`}</td>
        <td className="num">{eur(o.fy5)}</td>
        <td>{o.lockYears ? `${o.lockYears}y` : "annual"}</td>
        <td><ScoreBars s={o.score} /> <strong>{o.bookable ? (o.score.total * 100).toFixed(0) : "—"}</strong></td>
        <td>{o.bookable ? <span className="tag tag-ok" style={{ fontSize: 10 }}>bookable</span> : <span className="tag tag-neutral" style={{ fontSize: 10 }}>not eligible</span>}</td>
      </tr>
      {expanded && (
        <tr className="detail-row">
          <td colSpan={10}>
            <div className="agi-two">
              <div style={{ display: "grid", gap: 8 }}>
                <div><strong>Why</strong><div>{o.why}</div></div>
                {o.rejectedBecause && <div><strong>{rec ? "Note" : "Why not recommended"}</strong><div>{o.rejectedBecause}</div></div>}
                <div><strong>Compliance</strong><div>{o.compliance}</div></div>
                <div><strong>Audit</strong><div>{o.audit}</div></div>
                {o.assumptions.length > 0 && <div><strong>Assumptions</strong><ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>{o.assumptions.map((x) => <li key={x}>{x}</li>)}</ul></div>}
                {o.dependencies.length > 0 && <div><strong>Dependencies</strong><ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>{o.dependencies.map((x) => <li key={x}>{x}</li>)}</ul></div>}
                {o.approvals.length > 0 && <div><strong>Approvals required</strong><ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>{o.approvals.map((x) => <li key={x}>{x}</li>)}</ul></div>}
              </div>
              <div>
                <strong>Jurisdictions in scope</strong>
                <table className="table" style={{ marginTop: 4 }}>
                  <thead><tr><th>Jurisdiction</th><th className="num">ETR</th><th className="num">Top-up</th></tr></thead>
                  <tbody>{o.rows.map((r) => <tr key={r.iso + r.name}><td>{r.name} <span className="agi-mono">{r.iso}</span></td><td className="num">{etrPct(r)}</td><td className="num">{eur(r.topUp)}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

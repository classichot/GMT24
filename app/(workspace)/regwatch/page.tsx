"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useAi } from "@/components/AiProvider";
import { propose } from "@/lib/ai/actions";
import { WATCHED_SOURCES, type WatchItem } from "@/lib/ai/regwatch";
import { eur } from "@/lib/format";

type Filter = "pending" | "decided" | "all";

export default function RegwatchPage() {
  const ai = useAi();
  const { setCopilotOpen } = useStore();
  const [filter, setFilter] = useState<Filter>("pending");
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  const isPending = (i: WatchItem) => i.status === "pending" || i.status === "pack";
  const rows = ai.watch.filter((i) => (filter === "all" ? true : filter === "pending" ? isPending(i) : !isPending(i)));
  const pending = ai.watch.filter(isPending);
  const touching = pending.filter((i) => i.affected.length);
  const exposed = touching.reduce((s, i) => s + i.affected.reduce((a, x) => a + x.topUp, 0), 0);

  const decide = (i: WatchItem, verdict: "approved" | "rejected") => {
    if (i.kind === "kb") return ai.run(propose(verdict === "approved" ? "approve-reg" : "reject-reg", { id: i.id, note: note[i.id] ?? "" }, ai.ctx));
    if (i.pack) return ai.run(propose("decide-pack", { id: i.pack.id, status: verdict === "approved" ? "accepted" : "rejected" }, ai.ctx));
    return null;
  };
  const decision = (i: WatchItem) => (i.kind === "kb" ? ai.state.regReview[i.id] : undefined);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="kpi-grid cols-4">
        <div className="kpi"><div className="kpi-label">Awaiting review</div><div className="kpi-val">{pending.length}</div><div className="kpi-sub">{pending.filter((i) => i.kind === "kb").length} guidance · {pending.filter((i) => i.kind === "pack").length} pack amendments</div></div>
        <div className="kpi"><div className="kpi-label">Touching this group</div><div className="kpi-val">{touching.length}</div><div className={`kpi-sub${touching.length ? " hot" : ""}`}>{touching.length ? `${eur(exposed)} top-up in affected jurisdictions` : "no live calculation affected"}</div></div>
        <div className="kpi"><div className="kpi-label">Decided</div><div className="kpi-val">{ai.watch.filter((i) => !isPending(i)).length}</div><div className="kpi-sub">{Object.values(ai.state.regReview).filter((r) => r.status === "approved").length} approved · {Object.values(ai.state.regReview).filter((r) => r.status === "rejected").length} rejected</div></div>
        <div className="kpi"><div className="kpi-label">Sources monitored</div><div className="kpi-val">{WATCHED_SOURCES.length}</div><div className="kpi-sub"><button className="btn btn-ghost" style={{ fontSize: 11, padding: 0 }} onClick={() => { setCopilotOpen(true); void ai.ask("What regulatory changes affect us?", { feature: "regwatch" }); }}>Ask the Co-Pilot for the impact summary</button></div></div>
      </div>

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap" }}>
          <div><h5>Review queue</h5><div className="text-muted" style={{ fontSize: 11 }}>Each item carries an impact analysis against the live figures. Nothing reaches the knowledge base or the rule pack without an expert decision, and the decision stays on the record.</div></div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["pending", "decided", "all"] as const).map((f) => <button key={f} className={`chip${filter === f ? " active" : ""}`} style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => setFilter(f)}>{f}</button>)}
          </div>
        </div>
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 12 }}>
            <thead><tr><th>Published</th><th>Item</th><th>Source</th><th>Affected</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((i) => {
                const d = decision(i);
                const open = openId === i.id;
                return (
                  <Fragment key={i.id}>
                    <tr style={{ cursor: "pointer" }} onClick={() => setOpenId(open ? null : i.id)}>
                      <td className="text-muted">{i.publishedAt || "—"}</td>
                      <td><strong>{i.title}</strong><div className="text-muted" style={{ fontSize: 11 }}>{i.kind === "kb" ? "Guidance · knowledge base" : "Pack amendment · Central Record"}</div></td>
                      <td>{i.source}</td>
                      <td>{i.affected.length ? i.affected.map((a) => <span key={a.iso} className="tag tag-neutral" style={{ fontSize: 10, marginRight: 4 }}>{a.iso} {eur(a.topUp)}</span>) : <span className="text-muted">none</span>}</td>
                      <td><span className={`tag ${i.status === "pending" || i.status === "pack" ? "tag-warn" : i.status === "approved" ? "tag-ok" : "tag-neutral"}`} style={{ fontSize: 10 }}>{i.status === "pack" ? "pending" : i.status}</span>{d ? <div className="text-muted" style={{ fontSize: 11 }}>{d.by} · {d.at.slice(0, 10)}</div> : null}</td>
                      <td style={{ textAlign: "right" }}><button className="btn btn-ghost" style={{ fontSize: 11 }}>{open ? "Close" : "Impact"}</button></td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={6} style={{ background: "var(--color-surface)" }}>
                          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)" }}>
                            <div style={{ display: "grid", gap: 8 }}>
                              <div><div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Change summary</div><div className="passage">{i.summary}</div></div>
                              {i.entry && <div className="text-muted" style={{ fontSize: 11 }}>Version {i.entry.version} · effective {i.entry.effectiveFrom} · applies from FY{i.entry.applicableFrom}{i.entry.applicableTo ? ` to FY${i.entry.applicableTo}` : ""} · topics {i.entry.topics.join(", ") || "—"}{i.entry.url ? <> · <a href={i.entry.url} target="_blank" rel="noreferrer">source</a></> : null}</div>}
                              {i.pack && <div className="text-muted" style={{ fontSize: 11 }}>{i.pack.name} · {i.pack.field}: {String(i.pack.current)} → {String(i.pack.proposed)} · detected {i.pack.detectedAt.slice(0, 10)} · <a href={i.pack.sourceUrl} target="_blank" rel="noreferrer">Central Record</a></div>}
                              <div>
                                <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Affected calculations</div>
                                {i.affected.length ? (
                                  <table className="table" style={{ fontSize: 12 }}><thead><tr><th>Jurisdiction</th><th>Current top-up</th><th>Why affected</th></tr></thead><tbody>{i.affected.map((a) => <tr key={a.iso}><td>{a.name}</td><td>{eur(a.topUp)}</td><td>{a.why}</td></tr>)}</tbody></table>
                                ) : <div className="text-muted">No current jurisdiction in this group is affected.</div>}
                              </div>
                              {i.quantified && <div className="reply-warn" style={{ fontSize: 12 }}>{i.quantified}</div>}
                            </div>
                            <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
                              <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Expert decision</div>
                              {isPending(i) ? (
                                <>
                                  {i.kind === "kb" && <textarea className="input" rows={3} style={{ fontSize: 12 }} placeholder="Decision note (kept on the record)…" value={note[i.id] ?? ""} onChange={(e) => setNote((n) => ({ ...n, [i.id]: e.target.value }))} />}
                                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => decide(i, "approved")}>{i.kind === "kb" ? "Approve as production guidance" : "Accept amendment"}</button>
                                    <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => decide(i, "rejected")}>{i.kind === "kb" ? "Reject / not applicable" : "Reject amendment"}</button>
                                  </div>
                                  <div className="text-muted" style={{ fontSize: 11 }}>
                                    {i.kind === "kb" ? "Approval enters the knowledge base and opens reassessment tasks for each affected jurisdiction. Production rule parameters change only through a rule-pack release." : "Accepting applies the amendment to the pack overlay; an administrator then closes the change record on Jurisdiction packs."}
                                    {" "}Requires approve-treatment (your role: {ai.ctx.role}).
                                  </div>
                                </>
                              ) : (
                                <div className="passage">{d ? <>{d.status} by {d.by} on {d.at.slice(0, 10)}{d.note ? <> — {d.note}</> : null}</> : `${i.status}.`}</div>
                              )}
                              <button className="btn btn-ghost" style={{ fontSize: 11, justifySelf: "start" }} onClick={() => { setCopilotOpen(true); void ai.ask(`Impact of ${i.title}`, { feature: "regwatch" }); }}>Ask the Co-Pilot about this item</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!rows.length && <tr><td colSpan={6} className="text-muted">{filter === "pending" ? "No pending regulatory items. All monitored sources checked; nothing new since the last review." : "Nothing here."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><div><h5>Monitored sources</h5><div className="text-muted" style={{ fontSize: 11 }}>What the watch reads, how often, and when it last checked.</div></div></div>
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 12 }}>
            <thead><tr><th>Source</th><th>Cadence</th><th>Last checked</th></tr></thead>
            <tbody>{WATCHED_SOURCES.map((s) => <tr key={s.id}><td><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></td><td>{s.cadence}</td><td>{s.lastChecked}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
      <div className="text-muted" style={{ fontSize: 12 }}>Pack amendments are decided here or on <Link href="/jurisdictions">Jurisdiction packs</Link>; both paths write the same evidence record. Approved guidance is visible to the Pillar Two Specialist from the next question onward.</div>
    </div>
  );
}

"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useAi, type RegCheckOutcome } from "@/components/AiProvider";
import { propose } from "@/lib/ai/actions";
import { WATCHED_SOURCES, type WatchItem } from "@/lib/ai/regwatch";
import type { RegSourceState } from "@/lib/ai/regwatchSources";
import { eur } from "@/lib/format";

type Filter = "pending" | "decided" | "all";

const fmt = (iso: string | null | undefined) => (iso ? iso.slice(0, 16).replace("T", " ") : "—");

export default function RegwatchPage() {
  const ai = useAi();
  const { setCopilotOpen } = useStore();
  const [filter, setFilter] = useState<Filter>("pending");
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<RegCheckOutcome | null>(null);
  const [showExcerpt, setShowExcerpt] = useState<Record<string, boolean>>({});

  useEffect(() => { void ai.regwatch.load(); }, [ai.regwatch.load]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPending = (i: WatchItem) => i.status === "pending" || i.status === "pack";
  const rows = ai.watch.filter((i) => (filter === "all" ? true : filter === "pending" ? isPending(i) : !isPending(i)));
  const pending = ai.watch.filter(isPending);
  const touching = pending.filter((i) => i.affected.length);
  const exposed = touching.reduce((s, i) => s + i.affected.reduce((a, x) => a + x.topUp, 0), 0);
  const sources: RegSourceState[] = ai.regwatch.sources.length ? ai.regwatch.sources : WATCHED_SOURCES.map((s) => ({ ...s, lastChecked: null, lastChangedAt: null, lastStatus: "unchecked" as const, lastError: null, hash: null, title: null, isPdf: false, knownLinks: 0, versions: [] }));
  const checkedCount = sources.filter((s) => s.lastChecked).length;
  const unreachable = sources.filter((s) => s.lastStatus === "error");
  const lastRun = sources.reduce<string | null>((m, s) => (s.lastChecked && (!m || s.lastChecked > m) ? s.lastChecked : m), null);

  const decide = (i: WatchItem, verdict: "approved" | "rejected") => {
    if (i.kind === "kb" || i.kind === "source") return ai.run(propose(verdict === "approved" ? "approve-reg" : "reject-reg", { id: i.id, note: note[i.id] ?? "" }, ai.ctx));
    if (i.pack) return ai.run(propose("decide-pack", { id: i.pack.id, status: verdict === "approved" ? "accepted" : "rejected" }, ai.ctx));
    return null;
  };
  const decision = (i: WatchItem) => (i.kind === "kb" || i.kind === "source" ? ai.state.regReview[i.id] : undefined);

  const runCheck = async (sourceIds?: string[]) => {
    setOutcome(null);
    const r = await ai.regwatch.check(sourceIds);
    setOutcome(r);
    if (r.ok && r.newChanges.length) { setFilter("pending"); setOpenId(r.newChanges[0].id); }
  };

  const kindLabel = (i: WatchItem) => (i.kind === "kb" ? "Guidance · knowledge base" : i.kind === "pack" ? "Pack amendment · Central Record" : i.change?.signal === "new-doc" ? "New publication · detected on official source" : "Amended page · detected on official source");

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="kpi-grid cols-4">
        <div className="kpi"><div className="kpi-label">Awaiting review</div><div className="kpi-val">{pending.length}</div><div className="kpi-sub">{pending.filter((i) => i.kind === "source").length} detected · {pending.filter((i) => i.kind === "kb").length} guidance · {pending.filter((i) => i.kind === "pack").length} pack amendments</div></div>
        <div className="kpi"><div className="kpi-label">Touching this group</div><div className="kpi-val">{touching.length}</div><div className={`kpi-sub${touching.length ? " hot" : ""}`}>{touching.length ? `${eur(exposed)} top-up in affected jurisdictions` : "no live calculation affected"}</div></div>
        <div className="kpi"><div className="kpi-label">Decided</div><div className="kpi-val">{ai.watch.filter((i) => !isPending(i)).length}</div><div className="kpi-sub">{Object.values(ai.state.regReview).filter((r) => r.status === "approved").length} approved · {Object.values(ai.state.regReview).filter((r) => r.status === "rejected").length} rejected</div></div>
        <div className="kpi"><div className="kpi-label">Sources monitored</div><div className="kpi-val">{sources.length}</div><div className="kpi-sub">{checkedCount ? `${checkedCount} checked · last run ${fmt(lastRun)}${unreachable.length ? ` · ${unreachable.length} unreachable` : ""}` : "not yet checked"}</div></div>
      </div>

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap", gap: 8 }}>
          <div><h5>Monitored sources</h5><div className="text-muted" style={{ fontSize: 11 }}>Each check fetches the official source, hashes its readable text and compares it with the stored version. New documents and amended pages become review items below; every version is kept.</div></div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={ai.regwatch.checking} onClick={() => void runCheck()} aria-busy={ai.regwatch.checking}>{ai.regwatch.checking ? "Checking sources…" : "Check sources now"}</button>
            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { setCopilotOpen(true); void ai.ask("What regulatory changes affect us?", { feature: "regwatch" }); }}>Ask the Co-Pilot for the impact summary</button>
          </div>
        </div>
        {ai.regwatch.checking && <div className="text-muted" style={{ fontSize: 12, padding: "0 16px 8px" }} role="status">Fetching {sources.length} sources, reading new documents and preparing summaries{ai.model.configured ? ` with ${ai.model.model}` : " (no model configured — raw excerpts will be kept)"}. This can take a minute.</div>}
        {outcome && (
          <div className={outcome.ok ? "passage" : "reply-warn"} style={{ margin: "0 16px 12px", fontSize: 12 }} role="status">
            {outcome.ok ? (
              <>
                Checked at {fmt(outcome.checkedAt)}. {outcome.newChanges.length ? <strong>{outcome.newChanges.length} new change{outcome.newChanges.length === 1 ? "" : "s"} detected</strong> : "No new changes since the previous check"}{outcome.model ? ` · summaries by ${outcome.model}` : ""}.
                {outcome.errors.length ? <div style={{ marginTop: 4 }}>{outcome.errors.map((e) => <div key={e.sourceId}>{sources.find((s) => s.id === e.sourceId)?.label ?? e.sourceId}: {e.error}</div>)}</div> : null}
              </>
            ) : (
              <>Source check did not run: {outcome.error}. Your queue is unchanged. <button className="btn btn-ghost" style={{ fontSize: 11, padding: "0 4px" }} onClick={() => void runCheck()}>Retry</button></>
            )}
          </div>
        )}
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 12 }}>
            <thead><tr><th>Source</th><th>Cadence</th><th>Last checked</th><th>Last change</th><th>Status</th><th></th></tr></thead>
            <tbody>{sources.map((s) => (
              <tr key={s.id}>
                <td><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a>{s.title ? <div className="text-muted" style={{ fontSize: 11 }}>{s.title}{s.isPdf ? " · PDF" : ""}{s.knownLinks ? ` · ${s.knownLinks} documents tracked` : ""}{s.versions.length > 1 ? ` · ${s.versions.length} versions kept` : ""}</div> : null}</td>
                <td>{s.cadence}</td>
                <td>{fmt(s.lastChecked)}</td>
                <td>{s.lastChangedAt ? fmt(s.lastChangedAt) : s.lastStatus === "ok" ? <span className="text-muted">unchanged since baseline</span> : "—"}</td>
                <td>{s.lastStatus === "ok" ? <span className="tag tag-ok" style={{ fontSize: 10 }}>reachable</span> : s.lastStatus === "error" ? <><span className="tag tag-warn" style={{ fontSize: 10 }}>unreachable</span><div className="text-muted" style={{ fontSize: 11, maxWidth: 320 }}>{s.lastError}</div></> : <span className="tag tag-neutral" style={{ fontSize: 10 }}>unchecked</span>}</td>
                <td style={{ textAlign: "right" }}><button className="btn btn-ghost" style={{ fontSize: 11 }} disabled={ai.regwatch.checking} onClick={() => void runCheck([s.id])}>Check</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="text-muted" style={{ fontSize: 11, padding: "8px 16px 12px" }}>Sources are configured on the server (<code>GMT24_REGWATCH_SOURCES</code>); the defaults are the OECD Central Record, the OECD global minimum tax hub and the Thai Revenue Department&apos;s Top-up Tax and announcement pages. Some publishers refuse automated readers from data-centre networks; those show as unreachable with the reason, and can be checked manually or through an accessible mirror.</div>
      </div>

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap" }}>
          <div><h5>Review queue</h5><div className="text-muted" style={{ fontSize: 11 }}>Each item carries an impact analysis against the live figures. Model summaries are proposals; nothing reaches the knowledge base or the rule pack without an expert decision, and the decision stays on the record.</div></div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["pending", "decided", "all"] as const).map((f) => <button key={f} className={`chip${filter === f ? " active" : ""}`} style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => setFilter(f)}>{f}</button>)}
          </div>
        </div>
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 12 }}>
            <thead><tr><th>Published / detected</th><th>Item</th><th>Source</th><th>Affected</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((i) => {
                const d = decision(i);
                const open = openId === i.id;
                const ch = i.change;
                return (
                  <Fragment key={i.id}>
                    <tr style={{ cursor: "pointer" }} onClick={() => setOpenId(open ? null : i.id)}>
                      <td className="text-muted">{i.publishedAt || "—"}</td>
                      <td><strong>{i.title}</strong><div className="text-muted" style={{ fontSize: 11 }}>{kindLabel(i)}</div></td>
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
                              <div><div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase" }}>{i.kind === "source" ? "Change summary (model-proposed)" : "Change summary"}</div><div className="passage" style={{ whiteSpace: "pre-wrap" }}>{i.summary}</div></div>
                              {ch && (
                                <div className="text-muted" style={{ fontSize: 11 }}>
                                  Detected {fmt(ch.detectedAt)} on {ch.sourceLabel} · <a href={ch.url} target="_blank" rel="noreferrer">open source document</a>
                                  {ch.summary ? <> · topics {ch.summary.topics.join(", ") || "—"} · status {ch.summary.publicationStatus}{ch.summary.applicableFrom ? ` · applies from ${ch.summary.applicableFrom}` : ""} · summary confidence {ch.summary.confidence}{ch.summaryModel ? ` (${ch.summaryModel})` : ""}</> : ch.summaryError ? <> · {ch.summaryError}</> : null}
                                  {" "}· version {ch.hash.slice(0, 10)}{ch.previousHash ? ` (previous ${ch.previousHash.slice(0, 10)})` : ""}
                                  {" "}· <button className="btn btn-ghost" style={{ fontSize: 11, padding: 0 }} onClick={() => setShowExcerpt((m) => ({ ...m, [i.id]: !m[i.id] }))}>{showExcerpt[i.id] ? "Hide source text" : "Show source text"}</button>
                                  {showExcerpt[i.id] && <pre className="passage" style={{ whiteSpace: "pre-wrap", maxHeight: 280, overflow: "auto", fontSize: 11, marginTop: 6 }}>{ch.excerpt}</pre>}
                                </div>
                              )}
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
                                  {i.kind !== "pack" && <textarea className="input" rows={3} style={{ fontSize: 12 }} placeholder="Decision note (kept on the record)…" value={note[i.id] ?? ""} onChange={(e) => setNote((n) => ({ ...n, [i.id]: e.target.value }))} />}
                                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => decide(i, "approved")}>{i.kind === "pack" ? "Accept amendment" : i.kind === "source" ? "Approve impact — open reassessment tasks" : "Approve as production guidance"}</button>
                                    <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => decide(i, "rejected")}>{i.kind === "pack" ? "Reject amendment" : "Reject / not applicable"}</button>
                                  </div>
                                  <div className="text-muted" style={{ fontSize: 11 }}>
                                    {i.kind === "pack" ? "Accepting applies the amendment to the pack overlay; an administrator then closes the change record on Jurisdiction packs." : i.kind === "source" ? "Approval records the reviewed impact and opens a reassessment task for each affected jurisdiction. Production guidance and rule parameters change only through a knowledge-base entry and a rule-pack release." : "Approval enters the knowledge base and opens reassessment tasks for each affected jurisdiction. Production rule parameters change only through a rule-pack release."}
                                    {" "}Requires approve-treatment (your role: {ai.ctx.role}).
                                  </div>
                                </>
                              ) : (
                                <div className="passage">{d ? <>{d.status} by {d.by} on {d.at.slice(0, 10)}{d.note ? <> — {d.note}</> : null}{d.status === "approved" && i.affected.length ? <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>{i.affected.length} reassessment task{i.affected.length === 1 ? "" : "s"} open on <Link href="/tasks">Tasks</Link>.</div> : null}</> : `${i.status}.`}</div>
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
              {!rows.length && <tr><td colSpan={6} className="text-muted">{filter === "pending" ? (checkedCount ? "No pending regulatory items. Nothing new detected on the monitored sources since the last review." : "No pending regulatory items. The monitor has not run yet — use “Check sources now” to establish the baseline.") : "Nothing here."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="text-muted" style={{ fontSize: 12 }}>Pack amendments are decided here or on <Link href="/jurisdictions">Jurisdiction packs</Link>; both paths write the same evidence record. Approved guidance is visible to the Pillar Two Specialist from the next question onward. Historical calculations keep their rule-pack version, so an approved change never rewrites a past result.</div>
    </div>
  );
}

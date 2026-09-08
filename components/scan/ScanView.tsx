"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, ChevronRight, Download, FileText, HelpCircle, Layers, ScanLine, Upload } from "lucide-react";
import { applyCorrections, compareScans, entityName, explainFlag, scanMarkdown, type ScanDiff } from "@/lib/scan/pipeline";
import { jur, schemeById } from "@/lib/scan/jurisdictionDb";
import type { Correction, ExposureFlag, Relationship, ScanEntity, ScanResult } from "@/lib/scan/types";

export type ScanViewProps = {
  scan: ScanResult;
  others: ScanResult[];
  actor: string;
  onAnswer: (qid: string, value: string) => void;
  onCorrect: (c: Correction) => void;
  onPeriod: (period: string) => void;
  onOnboard?: () => void;
  onboardLabel?: string;
  signedIn: boolean;
};

const PRIO_HELP: Record<string, string> = {
  High: "A disclosed indicator points to income taxed below 15% in the period, or the company itself disclosed a top-up.",
  Medium: "An indicator exists (available scheme, low statutory rate for a holding vehicle, or user-confirmed safe harbour) but disclosure does not tie it to these entities.",
  Low: "Positive evidence supports taxation at or above 15% — never assigned for lack of information.",
  Undetermined: "The sources do not support a rating. This is not a low-risk rating.",
};

function fmtEur(n: number | null) { return n == null ? "—" : `€${(n / 1_000_000).toFixed(0)}m`; }

export function ScanView(p: ScanViewProps) {
  const { scan } = p;
  const [openIso, setOpenIso] = useState<string | null>(scan.exposure[0]?.iso ?? null);
  const [mode, setMode] = useState<Record<string, "explain" | "change" | null>>({});
  const [compareWith, setCompareWith] = useState<string>("");
  const [showAllQ, setShowAllQ] = useState(false);
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const entities = useMemo(() => applyCorrections(scan.entities, scan.corrections), [scan.entities, scan.corrections]);
  const demo = scan.notes.some((n) => n.startsWith("Demonstration corpus"));
  const comparable = p.others.filter((o) => o.id !== scan.id && o.resolved?.registryId && o.resolved.registryId === scan.resolved?.registryId && o.period !== scan.period);
  const diff: ScanDiff | null = useMemo(() => { const o = comparable.find((x) => x.id === compareWith); return o ? compareScans(o, scan) : null; }, [compareWith, comparable, scan]);
  const unanswered = scan.questions.filter((q) => !scan.answers[q.id]);
  const answered = Object.entries(scan.answers);
  const download = () => { const blob = new Blob([scanMarkdown(scan)], { type: "text/markdown" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `GMT24-QuickScan-${(scan.resolved?.name ?? scan.query).replace(/\W+/g, "-")}-${scan.period}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const now = new Date().toISOString();

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Header */}
      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-accent)" }}>Preliminary exposure assessment · public evidence · not a calculation</div>
            <h4 style={{ margin: "4px 0 0" }}>{scan.resolved?.name ?? scan.query}</h4>
            <div className="text-muted" style={{ fontSize: 12 }}>
              {scan.resolved?.nameTh ? `${scan.resolved.nameTh} · ` : ""}{scan.resolved?.exchange ? `${scan.resolved.exchange}${scan.resolved.ticker ? `: ${scan.resolved.ticker}` : ""} · ` : ""}UPE {scan.resolved?.upeIso ?? "—"} · matched on {scan.resolved?.matchedOn ?? "upload"}
              {scan.resolved?.enteredWasSubsidiary ? ` · you entered "${scan.resolved.enteredWasSubsidiary}", a subsidiary` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {scan.periodsAvailable.length > 1 && (
              <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>Reporting period
                <select className="input" style={{ minHeight: 0, padding: "4px 8px", width: "auto" }} value={scan.period} onChange={(e) => p.onPeriod(e.target.value)}>{scan.periodsAvailable.map((x) => <option key={x}>{x}</option>)}</select>
              </label>
            )}
            {scan.periodsAvailable.length <= 1 && <span className="tag tag-outline">{scan.period}</span>}
            <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={download}><Download size={14} />Scan report</button>
          </div>
        </div>
        <div className="panel-body" style={{ display: "grid", gap: 10 }}>
          <div className="scan-stages">
            {scan.stages.map((s, i) => (
              <div key={s.id} className={`scan-stage ${s.status}`}>
                <div className="k">{i + 1} · {s.status}</div>
                <div style={{ fontWeight: 700, marginTop: 2 }}>{s.label}</div>
                {s.note && <div className="text-muted" style={{ marginTop: 2 }}>{s.note}</div>}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11 }}>
            <span className="tag tag-neutral">{scan.dbVersion}</span>
            <span className="tag tag-neutral">{scan.corpusVersion}</span>
            <span className="tag tag-neutral">run {scan.startedAt.slice(0, 16).replace("T", " ")}</span>
            {demo && <span className="tag tag-warn"><AlertTriangle size={10} style={{ marginRight: 4 }} />Demonstration corpus — verify against original filings</span>}
          </div>
          {scan.notes.filter((n) => !n.startsWith("Demonstration corpus")).map((n, i) => <div key={i} className="text-muted" style={{ fontSize: 12 }}>{n}</div>)}
        </div>
      </div>

      {/* Scope */}
      {scan.scope && (
        <div className="panel">
          <div className="panel-head"><h5>Scope assessment</h5><span className={scan.scope.verdict === "in-scope" ? "status-in" : scan.scope.verdict === "out-of-scope" ? "status-out" : "status-rev"}>{scan.scope.verdict === "in-scope" ? "Likely in scope" : scan.scope.verdict === "out-of-scope" ? "Likely out of scope" : "Insufficient evidence"}</span></div>
          <div className="panel-body grid-split" style={{ gap: 20 }}>
            <div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>{scan.scope.reasons.map((r, i) => <li key={i} style={{ marginBottom: 4 }}>{r}</li>)}</ul>
              <div className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>{scan.scope.threshold}. {scan.scope.fxAssumption}</div>
            </div>
            <div className="table-wrap">
              <table className="table" style={{ fontSize: 12 }}>
                <thead><tr><th>Period</th><th className="num">Revenue</th><th className="num">EUR eq.</th><th>Basis</th><th>Source</th></tr></thead>
                <tbody>{scan.scope.revenue.map((r) => <tr key={r.period}><td>{r.period}</td><td className="num">{r.currency} {(r.amount / 1_000_000).toLocaleString()}m</td><td className="num" style={{ color: (r.eurEquivalent ?? 0) >= 750_000_000 ? "var(--color-accent-700)" : undefined }}>{fmtEur(r.eurEquivalent)}</td><td>{r.basis}</td><td className="text-muted">{r.passage ? `${r.passage.docId} p.${r.passage.page}` : "—"}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Exposure map */}
      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap" }}>
          <div><h5>Jurisdiction exposure map</h5><div className="text-muted" style={{ fontSize: 11 }}>Review priority, evidence strength and coverage are three separate judgements. Undetermined is not low risk.</div></div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(["High", "Medium", "Undetermined", "Low"] as const).map((k) => <span key={k} className={`prio prio-${k}`} title={PRIO_HELP[k]}>{k} {scan.exposure.filter((f) => f.priority === k).length}</span>)}</div>
        </div>
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 13 }}>
            <thead><tr><th></th><th>Jurisdiction</th><th>Review priority</th><th>Evidence</th><th>Coverage</th><th>Potentially relevant entities</th><th>Collection · payer</th></tr></thead>
            <tbody>
              {scan.exposure.map((f) => (
                <FlagRows key={f.iso} f={f} scan={scan} open={openIso === f.iso} toggle={() => setOpenIso(openIso === f.iso ? null : f.iso)} mode={mode[f.iso] ?? null} setMode={(m) => setMode((s) => ({ ...s, [f.iso]: m }))} signedIn={p.signedIn} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Follow-up interview */}
      <div className="grid-split">
        <div className="panel">
          <div className="panel-head"><h5>Follow-up questions</h5><span className="tag tag-neutral">{unanswered.length} open · ranked by consequence</span></div>
          <div className="panel-body" style={{ display: "grid", gap: 12 }}>
            {unanswered.length === 0 && <div className="text-muted" style={{ fontSize: 13 }}>No open questions for this scan — the rest needs documents, not answers.</div>}
            {(showAllQ ? unanswered : unanswered.slice(0, 4)).map((q) => (
              <div key={q.id} style={{ borderLeft: `3px solid ${q.impact === "high" ? "var(--color-hot)" : q.impact === "medium" ? "var(--color-warn)" : "var(--color-divider)"}`, paddingLeft: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{q.question}</div>
                <div className="text-muted" style={{ fontSize: 12, margin: "2px 0 8px" }}>{q.why}</div>
                <div className="stack-actions">{q.options.map((o) => <button key={o.value} className="chip" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => p.onAnswer(q.id, o.value)}>{o.label}</button>)}</div>
              </div>
            ))}
            {unanswered.length > 4 && <button className="btn btn-ghost" style={{ fontSize: 12, justifySelf: "start" }} onClick={() => setShowAllQ(!showAllQ)}>{showAllQ ? "Show fewer" : `Show all ${unanswered.length}`}</button>}
            {answered.length > 0 && (
              <div>
                <div className="reply-label">Answered · user-confirmed · re-assessed</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>{answered.map(([id, a]) => <li key={id}>{scan.questions.find((q) => q.id === id)?.question ?? id} → <strong>{a.value}</strong> <span className="text-muted">({a.by}, {a.at.slice(0, 10)})</span></li>)}</ul>
              </div>
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h5>Entity watchlist</h5><span className="tag tag-neutral">{scan.watchlist.length}</span></div>
          <div className="panel-body" style={{ display: "grid", gap: 8 }}>
            {scan.watchlist.length === 0 && <div className="text-muted" style={{ fontSize: 13 }}>No entities flagged.</div>}
            {scan.watchlist.map((w) => { const e = entities.find((x) => x.id === w.entityId); return (
              <div key={w.entityId} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, fontSize: 12, borderBottom: "1px solid var(--color-divider)", paddingBottom: 6 }}>
                <div><strong>{e?.name ?? w.entityId}</strong> <span className="text-muted">· {e?.incorporationName}</span><div className="text-muted">{w.reasons.join(" · ")}</div></div>
                <span className={`tag ${w.role === "payer" ? "tag-outline" : w.role === "both" ? "tag-accent" : "tag-neutral"}`} style={{ fontSize: 10, alignSelf: "start" }}>{w.role === "both" ? "contributes · may pay" : w.role === "payer" ? "may pay / report" : "contributes"}</span>
              </div>
            ); })}
          </div>
        </div>
      </div>

      {/* Structure */}
      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap" }}>
          <div><h5>Disclosed group structure</h5><div className="text-muted" style={{ fontSize: 11 }}>{entities.filter((e) => !e.outdated).length} entities · {scan.unresolvedLinks.length} unresolved link{scan.unresolvedLinks.length === 1 ? "" : "s"} · incorporation shown; tax residence only when disclosed or confirmed</div></div>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setAdding(!adding)}>Add missing entity</button>
        </div>
        {adding && <AddEntity scan={scan} actor={p.actor} onAdd={(e) => { p.onCorrect({ kind: "add", entity: e, by: p.actor, at: now }); setAdding(false); }} onCancel={() => setAdding(false)} />}
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 12 }}>
            <thead><tr><th>Entity</th><th>Jurisdiction</th><th>Residence</th><th>Relationship</th><th className="num">Owned</th><th>Owner</th><th>Activity</th><th>Incentives</th><th>Basis · source</th><th></th></tr></thead>
            <tbody>
              {entities.map((e) => (
                <EntityRow key={e.id} e={e} scan={scan} entities={entities} unresolved={scan.unresolvedLinks.some((u) => u.entityId === e.id)} editing={correcting === e.id} setEditing={(v) => setCorrecting(v ? e.id : null)} onCorrect={(c) => { p.onCorrect(c); setCorrecting(null); }} actor={p.actor} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disclosures + evidence */}
      <div className="grid-split">
        <div className="panel">
          <div className="panel-head"><h5>Company&apos;s own Pillar Two disclosures</h5><span className="tag tag-neutral">{scan.disclosures.length}</span></div>
          <div className="panel-body">
            {scan.disclosures.length === 0 && <div className="text-muted" style={{ fontSize: 13 }}>No Pillar Two statement found in the sources read — listed as missing.</div>}
            {scan.disclosures.map((d) => (
              <div key={d.id} className="passage">
                <div className="ref">{d.topic.replace(/-/g, " ")} · {d.passage.docId} p.{d.passage.page}{d.passage.section ? ` · ${d.passage.section}` : ""}{d.isos.length ? ` · ${d.isos.join(", ")}` : ""}</div>
                <div>“{d.passage.text}”</div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h5>Evidence panel</h5><span className="tag tag-neutral">{scan.sources.length} sources</span></div>
          <div className="panel-body" style={{ display: "grid", gap: 8, fontSize: 12 }}>
            {scan.sources.map((s) => (
              <div key={s.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "start" }}>
                <FileText size={14} style={{ marginTop: 2, color: s.accessible ? "var(--color-accent)" : "var(--color-hot)" }} />
                <div>
                  <strong>{s.title}</strong> <span className="text-muted">· {s.kind} · {s.period}{s.pages ? ` · ${s.pages} pp` : ""} · {s.language}</span>
                  <div className="text-muted">{s.accessible ? `retrieved ${s.retrievedAt.slice(0, 16).replace("T", " ")}` : `inaccessible — ${s.inaccessibleReason}`}{s.url ? <> · <a href={s.url} target="_blank" rel="noreferrer" onClick={(ev) => ev.preventDefault()} title="Demonstration URL">{s.url}</a></> : null}</div>
                </div>
              </div>
            ))}
            <div className="text-muted" style={{ fontSize: 11 }}>Retrieval dates and page references are recorded so a reviewer can verify every passage against the original. Uploaded documents are read as evidence only.</div>
          </div>
        </div>
      </div>

      {/* Missing + compare */}
      <div className="grid-split">
        <div className="panel">
          <div className="panel-head"><h5>Missing information</h5><span className="tag tag-neutral">{scan.missing.length}</span></div>
          <div className="panel-body">
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>{scan.missing.map((m) => <li key={m.id} style={{ marginBottom: 3 }}><span className={`tag ${m.kind === "document" ? "tag-outline" : "tag-neutral"}`} style={{ fontSize: 9, marginRight: 6 }}>{m.kind}</span>{m.item} <span className="text-muted">— {m.why}</span></li>)}</ul>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h5>Compare with another period</h5>
            <select className="input" style={{ minHeight: 0, padding: "4px 8px", width: "auto", fontSize: 12 }} value={compareWith} onChange={(e) => setCompareWith(e.target.value)}>
              <option value="">{comparable.length ? "Choose a scan…" : "Run the same group for another period first"}</option>
              {comparable.map((o) => <option key={o.id} value={o.id}>{o.period} · {o.startedAt.slice(0, 10)}</option>)}
            </select>
          </div>
          <div className="panel-body" style={{ fontSize: 12 }}>
            {!diff && <div className="text-muted">Scan comparison shows structure changes, new incentives, new disclosures, scope changes and priority movements between two scans of the same group.</div>}
            {diff && (
              <div style={{ display: "grid", gap: 6 }}>
                <div><strong>{diff.from} → {diff.to}</strong>{diff.scopeChange ? ` · scope ${diff.scopeChange}` : " · scope unchanged"}</div>
                <div>New entities: {diff.newEntities.map((e) => e.name).join(", ") || "none"}</div>
                <div>No longer disclosed: {diff.removedEntities.map((e) => e.name).join(", ") || "none"}</div>
                <div>Ownership changes: {diff.ownershipChanges.map((c) => `${c.entity.name} ${c.from ?? "—"}% → ${c.to ?? "—"}%`).join("; ") || "none"}</div>
                <div>New incentives: {diff.newIncentives.map((i) => `${i.entity.name}: ${i.scheme}`).join("; ") || "none"}</div>
                <div>New disclosures: {diff.newDisclosures.map((d) => d.topic).join(", ") || "none"}</div>
                <div>Priority changes: {diff.priorityChanges.map((c) => `${c.name} ${c.from} → ${c.to}`).join("; ") || "none"}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Next actions */}
      <div className="panel">
        <div className="panel-head"><h5>Next actions</h5><span className="text-muted" style={{ fontSize: 11 }}>Quick Scan discovers · X-Ray obtains the facts · the engine calculates</span></div>
        <div className="panel-body stack-actions">
          {p.signedIn ? (
            <>
              <Link href="/xray" className="btn btn-primary"><ScanLine size={14} />Start X-Ray on the High flags</Link>
              <Link href="/data" className="btn btn-secondary"><Upload size={14} />Upload the missing documents</Link>
              {p.onOnboard && <button className="btn btn-secondary" onClick={p.onOnboard}><Layers size={14} />{p.onboardLabel ?? "Create GMT24 workspace from this scan"}</button>}
            </>
          ) : (
            <>
              <Link href="/" className="btn btn-primary"><Layers size={14} />Sign in to create a GMT24 workspace from this scan</Link>
              <Link href="/host" className="btn btn-secondary">Ask for a review link</Link>
            </>
          )}
          <button className="btn btn-ghost" onClick={download}><Download size={14} />Download the scan report</button>
        </div>
      </div>
    </div>
  );
}

function FlagRows({ f, scan, open, toggle, mode, setMode, signedIn }: { f: ExposureFlag; scan: ScanResult; open: boolean; toggle: () => void; mode: "explain" | "change" | null; setMode: (m: "explain" | "change" | null) => void; signedIn: boolean }) {
  const ex = useMemo(() => explainFlag(f, scan), [f, scan]);
  return (
    <>
      <tr className="clickable" onClick={toggle}>
        <td style={{ width: 24 }}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
        <td><strong>{f.name}</strong> <span className="text-muted">{f.iso}</span></td>
        <td><span className={`prio prio-${f.priority}`} title={PRIO_HELP[f.priority]}>{f.priority}</span></td>
        <td><span className={`evid evid-${f.evidence}`}>{f.evidence}</span></td>
        <td style={{ fontSize: 12 }}>{f.coverage.entities} entit{f.coverage.entities === 1 ? "y" : "ies"} · {f.coverage.jurisdictionFinancials ? "financials found" : "no financials"} · {f.coverage.periods.join(", ")}</td>
        <td style={{ fontSize: 12 }}>{f.contributing.map((id) => entityName(scan, id)).join(", ") || <span className="text-muted">—</span>}</td>
        <td style={{ fontSize: 12 }}>{f.collection.mechanism.split(" (")[0]}<div className="text-muted">{entityName(scan, f.collection.payerEntityId)}</div></td>
      </tr>
      {open && (
        <tr>
          <td></td>
          <td colSpan={6} style={{ background: "var(--color-surface)" }}>
            <div style={{ display: "grid", gap: 12, padding: "6px 0" }}>
              <div className="stack-actions">
                <button className={`chip${mode === "explain" ? " active" : ""}`} style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setMode(mode === "explain" ? null : "explain")}><HelpCircle size={12} />Explain this flag</button>
                <button className={`chip${mode === "change" ? " active" : ""}`} style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setMode(mode === "change" ? null : "change")}>What would change this assessment?</button>
                {signedIn && f.priority !== "Low" && !f.unsupportedJurisdiction && <Link href={`/xray?iso=${f.iso}`} className="btn btn-ghost" style={{ fontSize: 12 }}><ScanLine size={12} />Start X-Ray</Link>}
              </div>
              {mode === "explain" && (
                <div>
                  <div className="reply-label">Why it is flagged — chain from passage to rating</div>
                  <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>{ex.steps.map((s, i) => <li key={i} style={{ marginBottom: 3 }}>{s}</li>)}</ol>
                </div>
              )}
              {mode === "change" && (
                <div className="grid-3" style={{ fontSize: 12 }}>
                  <div><div className="reply-label" style={{ color: "var(--color-hot)" }}>Would raise it</div><ul style={{ margin: 0, paddingLeft: 16 }}>{f.whatWouldChange.increase.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                  <div><div className="reply-label" style={{ color: "var(--color-accent-700)" }}>Would lower it</div><ul style={{ margin: 0, paddingLeft: 16 }}>{f.whatWouldChange.reduce.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                  <div><div className="reply-label">Would settle it</div><ul style={{ margin: 0, paddingLeft: 16 }}>{f.whatWouldChange.resolve.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                </div>
              )}
              {!mode && (
                <div className="grid-split" style={{ gap: 16, fontSize: 12 }}>
                  <div>
                    <div className="reply-label">Reasons</div>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>{f.reasons.map((r, i) => <li key={i} style={{ marginBottom: 3 }}>{r}</li>)}</ul>
                    {f.disclosedAmount && <div className="passage" style={{ marginTop: 8 }}><div className="ref">Company-disclosed · {f.disclosedAmount.passage.docId} p.{f.disclosedAmount.passage.page}</div><strong>{f.disclosedAmount.label}: {f.disclosedAmount.amount}</strong><div>“{f.disclosedAmount.passage.text}”</div><div className="text-muted">Disclosed by the company. GMT24 did not calculate it.</div></div>}
                    {f.estimate && <div className="passage" style={{ marginTop: 8, borderLeftColor: "var(--color-warn)" }}><div className="ref">{f.estimate.label}</div><strong>≈ USD {f.estimate.amountUsd.toLocaleString()}</strong> <span className="text-muted">upper-bound screen</span><ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>{f.estimate.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul><div className="text-muted">{f.estimate.engine}</div></div>}
                  </div>
                  <div>
                    <div className="reply-label">Collection — separate from contribution</div>
                    <div><strong>{f.collection.mechanism}</strong></div>
                    <div>{f.collection.payerNote}</div>
                    <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>{f.collection.unconfirmed.map((u, i) => <li key={i} className="text-muted">Unconfirmed: {u}</li>)}</ul>
                    <div className="reply-label" style={{ marginTop: 10 }}>Screening record · {f.dbVersion}</div>
                    <div className="text-muted">Statutory {Number.isNaN(f.screening.statutoryRate) ? "n/a" : `${(f.screening.statutoryRate * 100).toFixed(1)}%`} · IIR {f.screening.iir.status}{f.screening.iir.from ? ` ${f.screening.iir.from}` : ""} · QDMTT {f.screening.qdmtt.status}{f.screening.qdmtt.from ? ` ${f.screening.qdmtt.from}` : ""} · UTPR {f.screening.utpr.status} · Central Record “{f.screening.centralRecord.listed}” as of {f.screening.centralRecord.asOf}</div>
                    <div className="reply-label" style={{ marginTop: 10 }}>Missing for this jurisdiction</div>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>{f.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
                  </div>
                </div>
              )}
              {f.passages.length > 0 && !mode && (
                <div>
                  <div className="reply-label">Passages</div>
                  {f.passages.slice(0, 4).map((ps, i) => <div key={i} className="passage"><div className="ref">{ps.docId} p.{ps.page}{ps.section ? ` · ${ps.section}` : ""} · {ps.period}</div>“{ps.text}”</div>)}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const RELS: Relationship[] = ["subsidiary", "joint-venture", "associate", "branch", "investment", "unresolved"];

function EntityRow({ e, scan, entities, unresolved, editing, setEditing, onCorrect, actor }: { e: ScanEntity; scan: ScanResult; entities: ScanEntity[]; unresolved: boolean; editing: boolean; setEditing: (v: boolean) => void; onCorrect: (c: Correction) => void; actor: string }) {
  const [own, setOwn] = useState(String(e.ownership ?? ""));
  const [rel, setRel] = useState<Relationship>(e.relationship);
  const [res, setRes] = useState(e.taxResidenceIso ?? e.incorporationIso);
  const now = new Date().toISOString();
  return (
    <>
      <tr style={{ opacity: e.outdated ? 0.45 : 1 }}>
        <td><strong>{e.name}</strong>{e.nameTh ? <div className="text-muted" style={{ fontSize: 11 }}>{e.nameTh}</div> : null}{e.formerNames?.length ? <div className="text-muted" style={{ fontSize: 11 }}>formerly {e.formerNames.join(", ")}</div> : null}{e.outdated && <span className="tag tag-neutral" style={{ fontSize: 9, marginLeft: 6 }}>outdated</span>}</td>
        <td>{e.incorporationName}{!scan.supportedIsos.includes(e.incorporationIso) && <span className="tag tag-warn" style={{ fontSize: 9, marginLeft: 4 }} title="Not in the jurisdiction database">no DB</span>}</td>
        <td>{e.taxResidenceIso ? <>{e.taxResidenceIso} <span className="text-muted">({e.taxResidenceBasis})</span></> : <span className="text-muted">not disclosed</span>}</td>
        <td>{e.relationship}{unresolved && <span className="tag tag-hot" style={{ fontSize: 9, marginLeft: 4 }}>unresolved</span>}</td>
        <td className="num">{e.ownership != null ? `${e.ownership}%` : "—"}</td>
        <td className="text-muted">{e.ownerId ? entityName(scan, e.ownerId) : e.relationship === "upe" ? "—" : "?"}</td>
        <td>{e.activity}</td>
        <td>{e.incentives.length ? e.incentives.map((i) => <div key={i.schemeId} title={i.passage?.text}>{schemeById(i.schemeId)?.name ?? i.schemeId}{i.period?.to ? ` → ${i.period.to}` : ""} <span className="text-muted">({i.basis})</span></div>) : <span className="text-muted">none disclosed</span>}</td>
        <td className="text-muted">{e.basis}{e.correctedBy ? ` by ${e.correctedBy}` : ""}<div>{e.evidence[0] ? `${e.evidence[0].docId} p.${e.evidence[0].page}` : "—"}</div></td>
        <td>{!e.outdated && <button className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 6px" }} onClick={() => setEditing(!editing)}>{editing ? "Close" : "Correct"}</button>}</td>
      </tr>
      {editing && (
        <tr><td colSpan={10} style={{ background: "var(--color-surface)" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", fontSize: 12 }}>
            <label className="field" style={{ margin: 0 }}>Ownership %<input className="input" style={{ width: 90, minHeight: 0, padding: "4px 8px" }} value={own} onChange={(ev) => setOwn(ev.target.value)} /></label>
            <label className="field" style={{ margin: 0 }}>Relationship<select className="input" style={{ minHeight: 0, padding: "4px 8px" }} value={rel} onChange={(ev) => setRel(ev.target.value as Relationship)}>{RELS.map((r) => <option key={r}>{r}</option>)}</select></label>
            <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => onCorrect({ kind: "ownership", entityId: e.id, ownership: Number(own) || 0, relationship: rel, by: actor, at: now })}>Save ownership</button>
            <label className="field" style={{ margin: 0 }}>Tax residence (ISO)<input className="input" style={{ width: 80, minHeight: 0, padding: "4px 8px" }} value={res} onChange={(ev) => setRes(ev.target.value.toUpperCase())} /></label>
            <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => onCorrect({ kind: "residence", entityId: e.id, iso: res, by: actor, at: now })}>Confirm residence</button>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => onCorrect({ kind: "outdated", entityId: e.id, by: actor, at: now })}>Mark outdated</button>
            <span className="text-muted">Corrections are recorded as user-confirmed with your name; the exposure map re-runs. Owner options: {entities.filter((x) => x.id !== e.id).length}.</span>
          </div>
        </td></tr>
      )}
    </>
  );
}

function AddEntity({ scan, actor, onAdd, onCancel }: { scan: ScanResult; actor: string; onAdd: (e: ScanEntity) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [iso, setIso] = useState("TH");
  const [rel, setRel] = useState<Relationship>("subsidiary");
  const [own, setOwn] = useState("100");
  const [act, setAct] = useState("");
  const upe = scan.entities.find((e) => e.relationship === "upe");
  return (
    <div className="panel-body" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", fontSize: 12, borderBottom: "2px solid var(--color-divider)" }}>
      <label className="field" style={{ margin: 0 }}>Legal name<input className="input" style={{ minHeight: 0, padding: "4px 8px", width: 260 }} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field" style={{ margin: 0 }}>Jurisdiction (ISO)<input className="input" style={{ minHeight: 0, padding: "4px 8px", width: 70 }} value={iso} onChange={(e) => setIso(e.target.value.toUpperCase())} /></label>
      <label className="field" style={{ margin: 0 }}>Relationship<select className="input" style={{ minHeight: 0, padding: "4px 8px" }} value={rel} onChange={(e) => setRel(e.target.value as Relationship)}>{RELS.map((r) => <option key={r}>{r}</option>)}</select></label>
      <label className="field" style={{ margin: 0 }}>Owned %<input className="input" style={{ minHeight: 0, padding: "4px 8px", width: 70 }} value={own} onChange={(e) => setOwn(e.target.value)} /></label>
      <label className="field" style={{ margin: 0 }}>Activity<input className="input" style={{ minHeight: 0, padding: "4px 8px", width: 200 }} value={act} onChange={(e) => setAct(e.target.value)} /></label>
      <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={!name.trim() || iso.length !== 2} onClick={() => onAdd({ id: `add-${Date.now().toString(36)}`, name: name.trim(), incorporationIso: iso, incorporationName: jur(iso)?.name ?? iso, taxResidenceIso: null, taxResidenceBasis: null, relationship: rel, ownerId: upe?.id ?? null, ownership: Number(own) || null, activity: act || "Not stated", incentives: [], evidence: [], basis: "user-confirmed", period: scan.period, correctedBy: actor })}>Add as user-confirmed</button>
      <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onCancel}>Cancel</button>
    </div>
  );
}

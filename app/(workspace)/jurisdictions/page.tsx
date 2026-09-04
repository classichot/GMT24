"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Lock, RotateCcw, ShieldCheck, Sparkles, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useCalc } from "@/lib/useCalc";
import { calculateGroup, totals } from "@/lib/engine";
import { eur } from "@/lib/format";
import {
  OECD_CENTRAL_RECORD_PDF,
  OECD_CENTRAL_RECORD_URL,
  type OecdRefresh,
} from "@/lib/oecdCentralRecord";
import {
  FIELD_LABEL,
  acceptedAmendments,
  amendedFields,
  blockedCount,
  effectivePacks,
  impactFrom,
  openChanges,
  overlayWith,
  overlayWithout,
  pendingCount,
  undecidedIn,
  type PackAmendment,
  type PackOverlay,
  type PackTotals,
} from "@/lib/packAmendments";

function yn(v: boolean) {
  return v ? "Y" : "—";
}

function shown(v: boolean | string) {
  return typeof v === "boolean" ? yn(v) : v;
}

export default function JurisdictionsPage() {
  const {
    flash,
    ask,
    groupId,
    activeFy,
    electionsOn,
    packAmendments,
    packChanges,
    packOverlay,
    scanPacks,
    adminReviewPackChange,
    decidePackAmendment,
    revertPackAmendment,
    clearPackAmendments,
  } = useStore();
  const { t } = useCalc();
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<OecdRefresh | null>(null);

  const packs = useMemo(() => effectivePacks(packOverlay), [packOverlay]);
  const proposals = packAmendments.filter((a) => a.status === "proposed");
  const accepted = acceptedAmendments(packAmendments);
  const rejected = packAmendments.filter((a) => a.status === "rejected");

  /**
   * Price a candidate overlay by re-running the engine, so a reviewer sees where
   * collection moves before accepting. A qualified QDMTT usually leaves group
   * top-up untouched and changes which jurisdiction collects it.
   */
  const priceOverlay = useMemo(() => {
    const base: PackTotals = { topUp: t.topUp, qdmtt: t.qdmtt, iir: t.iir, utpr: t.utpr };
    return (overlay: PackOverlay) => {
      const next = totals(calculateGroup(groupId, { fy: activeFy, electionsOn, packOverlay: overlay }));
      return impactFrom(base, { topUp: next.topUp, qdmtt: next.qdmtt, iir: next.iir, utpr: next.utpr });
    };
  }, [groupId, activeFy, electionsOn, t.topUp, t.qdmtt, t.iir, t.utpr]);

  async function refresh() {
    setBusy(true);
    try {
      const res = await fetch("/api/oecd-central-record", { cache: "no-store" });
      const data = (await res.json()) as OecdRefresh;
      setLive(data);
      if (!data.ok) {
        flash(data.error ?? "OECD Central Record could not be read");
        return;
      }
      const { changed, open } = scanPacks(data);
      flash(
        changed
          ? `Change detected · ${changed} field${changed === 1 ? "" : "s"} · ${open} awaiting your decision`
          : `Scan complete${data.asOf ? ` · Record as at ${data.asOf}` : ""}. Signed pack matches the Record.`,
      );
    } catch {
      flash("Could not reach the OECD refresh endpoint");
    } finally {
      setBusy(false);
    }
  }

  function decide(a: PackAmendment, status: "accepted" | "rejected") {
    const err = decidePackAmendment(a.id, status);
    flash(err ?? `${a.name} ${FIELD_LABEL[a.field]} ${status}`);
  }

  return (
    <div>
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ maxWidth: 760 }}>
          <strong>Jurisdiction packs.</strong> Qualified IIR / QDMTT / QDMTT Safe Harbour come from the OECD Central
          Record, not from the model. AI reads the live Record and proposes field-level amendments; the engine keeps
          using the signed pack until a named reviewer accepts one. Absence from the Record is not a finding that the
          law is unqualified, so it can never propose removing a qualified status on its own.
        </div>
        <div className="stack-actions">
          <button className="btn btn-primary" onClick={refresh} disabled={busy}>
            <Sparkles size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
            {busy ? "Reading OECD…" : "Scan OECD Record"}
          </button>
          <a href={OECD_CENTRAL_RECORD_URL} target="_blank" rel="noreferrer" className="btn btn-secondary">Open Central Record</a>
          {packAmendments.length > 0 && (
            <button className="btn btn-ghost" onClick={() => { clearPackAmendments(); flash("Back on the signed pack"); }}>Clear all</button>
          )}
          <button className="btn btn-ghost" onClick={() => ask("Show the OECD basis for this treatment.")}>Ask GMT24</button>
        </div>
      </div>

      <div className="kpi-grid cols-4" style={{ marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Awaiting decision</div>
          <div className="kpi-val" style={{ color: pendingCount(packAmendments) ? "var(--color-warn)" : undefined }}>{pendingCount(packAmendments)}</div>
          <div className="kpi-sub">AI proposals open for review</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">In force</div>
          <div className="kpi-val">{accepted.length}</div>
          <div className="kpi-sub">Accepted amendments driving the calculation</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Legally blocked</div>
          <div className="kpi-val" style={{ color: blockedCount(packAmendments) ? "var(--color-hot)" : undefined }}>{blockedCount(packAmendments)}</div>
          <div className="kpi-sub">Need a conclusion on the local instrument</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Unreviewed changes</div>
          <div className="kpi-val" style={{ color: openChanges(packChanges).length ? "var(--color-hot)" : undefined }}>{openChanges(packChanges).length}</div>
          <div className="kpi-sub">{live?.asOf ? `Record as at ${live.asOf}` : live ? "Record date not stated" : "Not yet scanned"}</div>
        </div>
      </div>

      {openChanges(packChanges).map((c) => {
        const undecided = undecidedIn(c, packAmendments);
        return (
          <div
            key={c.id}
            className="callout"
            style={{ marginBottom: 20, borderLeft: "4px solid var(--color-hot)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ maxWidth: 760 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800 }}>
                  <AlertTriangle size={16} />
                  Change detected — held on the record until administrator review
                </div>
                <div style={{ fontSize: 13, marginTop: 6 }}>{c.summary}</div>
                <ul style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 12 }}>
                  {c.lines.map((l) => <li key={l}>{l}</li>)}
                </ul>
                <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
                  Detected {new Date(c.detectedAt).toUTCString()} from the{" "}
                  <a href={c.sourceUrl} target="_blank" rel="noreferrer">{c.source === "pdf" ? "published PDF" : "Central Record page"}</a>
                  {c.note ? ` · ${c.note}` : ""}
                </div>
              </div>
              <div style={{ flex: "none" }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const err = adminReviewPackChange(c.id);
                    flash(err ?? "Change record closed by administrator review");
                  }}
                  title={undecided.length ? "Decide every amendment first" : "Close this change record"}
                >
                  <ShieldCheck size={15} />Administrator review
                </button>
                <div className="text-muted" style={{ fontSize: 11, marginTop: 6, maxWidth: 200 }}>
                  {undecided.length
                    ? `${undecided.length} amendment${undecided.length === 1 ? "" : "s"} undecided — the record cannot be closed yet.`
                    : "All amendments decided. Ready to close."}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {live && !live.ok && (
        <div
          className="callout"
          style={{ marginBottom: 20, borderLeft: "4px solid var(--color-hot)" }}
        >
          <strong>No comparison was made.</strong> {live.error}{" "}
          <a href={live.pdfUrl} target="_blank" rel="noreferrer">Open the Central Record PDF</a>. An empty proposal
          list here means the Record could not be read — not that the signed pack agrees with it.
        </div>
      )}

      {proposals.length > 0 && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <h4>AI proposed amendments</h4>
            <span className="text-muted">Priced against the live calculation before you accept</span>
          </div>
          {proposals.map((a) => {
            const impact = a.guard ? null : priceOverlay(overlayWith(packOverlay, a));
            return (
              <div key={a.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--color-divider)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ maxWidth: 640 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <strong>{a.name}</strong>
                      <span className="tag tag-outline">{FIELD_LABEL[a.field]}</span>
                      <span className={a.direction === "downgrade" ? "tag tag-hot" : a.direction === "upgrade" ? "tag tag-accent" : "tag tag-neutral"}>
                        {a.direction === "downgrade" ? "Removes qualified status" : a.direction === "upgrade" ? "Adds qualified status" : "Text"}
                      </span>
                      <span className="mono" style={{ fontSize: 12 }}>
                        {shown(a.current)} → {shown(a.proposed)}
                      </span>
                    </div>
                    <div className="text-muted" style={{ fontSize: 13, marginTop: 6 }}>{a.rationale}</div>
                    <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
                      Source: <a href={a.sourceUrl} target="_blank" rel="noreferrer">Central Record</a>
                      {a.asOf ? ` · as at ${a.asOf}` : ""} · detected {new Date(a.detectedAt).toUTCString().slice(5, 16)}
                    </div>
                    {a.guard ? (
                      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: "var(--color-hot)", display: "flex", gap: 6, alignItems: "flex-start" }}>
                        <Lock size={13} style={{ flex: "none", marginTop: 2 }} />
                        <span>{a.guard}</span>
                      </div>
                    ) : (
                      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700 }}>{impact?.summary}</div>
                    )}
                  </div>
                  <div className="stack-actions" style={{ alignItems: "flex-start", flex: "none" }}>
                    {!a.guard && (
                      <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => decide(a, "accepted")}>
                        <Check size={13} />Accept
                      </button>
                    )}
                    <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => decide(a, "rejected")}>
                      <X size={13} />Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="panel-body">
            <p className="text-muted" style={{ margin: 0, fontSize: 12 }}>
              Accepting writes the amendment into the effective pack, which changes the collection order on{" "}
              <Link href="/allocation">QDMTT / IIR / UTPR</Link> and the rules reported for each entity in the{" "}
              <Link href="/gir">GIR</Link>. Every decision is recorded in the{" "}
              <Link href="/evidence-history">evidence chronicle</Link> with the source URL and the Record date.
            </p>
          </div>
        </div>
      )}

      {accepted.length > 0 && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <h4>Amendments in force</h4>
            <span className="text-muted">Layered over the signed pack</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Jurisdiction</th>
                  <th>Field</th>
                  <th>Signed</th>
                  <th>In force</th>
                  <th>Reviewer</th>
                  <th>Record</th>
                  <th className="num">Revert impact</th>
                  <th className="num"></th>
                </tr>
              </thead>
              <tbody>
                {accepted.map((a) => {
                  const back = priceOverlay(overlayWithout(packAmendments, a));
                  return (
                    <tr key={a.id}>
                      <td>{a.name}</td>
                      <td>{FIELD_LABEL[a.field]}</td>
                      <td className="mono">{shown(a.current)}</td>
                      <td className="mono" style={{ fontWeight: 800 }}>{shown(a.proposed)}</td>
                      <td>{a.reviewer ?? "—"}</td>
                      <td style={{ fontSize: 12 }}>{a.asOf ?? "—"}</td>
                      <td className="num text-muted" style={{ fontSize: 12 }}>{back.summary}</td>
                      <td className="num">
                        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { revertPackAmendment(a.id); flash(`${a.name} reverted to the signed pack`); }}>
                          <RotateCcw size={13} />Revert
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {packChanges.length > 0 && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <h4>Change record</h4>
            <span className="text-muted">Every detected change, kept after review</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Detected</th>
                  <th>Record as at</th>
                  <th>Source</th>
                  <th>Change</th>
                  <th className="num">Fields</th>
                  <th>Administrator</th>
                </tr>
              </thead>
              <tbody>
                {packChanges.map((c) => (
                  <tr key={c.id}>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>{new Date(c.detectedAt).toUTCString().slice(5, 22)}</td>
                    <td style={{ fontSize: 12 }}>{c.asOf ?? "—"}</td>
                    <td><span className="tag tag-outline">{c.source === "pdf" ? "PDF" : c.source === "html" ? "Web" : "—"}</span></td>
                    <td style={{ fontSize: 12, maxWidth: 420 }}>{c.summary}</td>
                    <td className="num">{c.amendmentIds.length}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {c.adminReviewed
                        ? <span className="tag tag-accent">{c.admin}</span>
                        : <span className="tag tag-hot">Awaiting review</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-body">
            <p className="text-muted" style={{ margin: 0, fontSize: 12 }}>
              A detected change stays here permanently. The alert clears only once an administrator has reviewed the
              record, and only after every amendment inside it has been accepted or rejected.
            </p>
          </div>
        </div>
      )}

      {live && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <h4>OECD live extract</h4>
            <span className="text-muted">
              {live.ok ? (live.asOf ? `Central Record as at ${live.asOf}` : "Fetched") : "Fetch failed"}
              {" · "}
              {new Date(live.fetchedAt).toUTCString()}
            </span>
          </div>
          <div className="panel-body" style={{ paddingBottom: 8 }}>
            <p className="text-muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
              Source:{" "}
              <a href={live.sourceUrl} target="_blank" rel="noreferrer">{live.sourceUrl}</a>
              {" · "}
              <a href={live.pdfUrl} target="_blank" rel="noreferrer">PDF</a>
              {live.error
                ? ` · ${live.error}`
                : live.source === "pdf"
                  ? " · Read from the published PDF by column position: presence in the IIR table, presence in the QDMTT table, and a Safe Harbour \"Yes\" in its own column. Prose mentions are excluded because they do not sit in the jurisdiction column."
                  : " · Country names mapped to the IIR / QDMTT / QDMTT SH / SbS tables. Differences become the proposals above."}
              {live.note ? ` · ${live.note}` : ""}
            </p>
          </div>
          {live.ok && live.rows.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Jurisdiction</th>
                    <th>Pack IIR</th>
                    <th>OECD IIR</th>
                    <th>Pack QDMTT</th>
                    <th>OECD QDMTT</th>
                    <th>Pack SH</th>
                    <th>OECD SH</th>
                    <th>Status</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {live.rows.map((r) => (
                    <tr key={r.iso}>
                      <td>{r.name}</td>
                      <td>{yn(r.pack.iir)}</td>
                      <td>{yn(r.oecd.iir)}</td>
                      <td>{yn(r.pack.qdmtt)}</td>
                      <td>{yn(r.oecd.qdmtt)}</td>
                      <td>{yn(r.pack.qdmttSH)}</td>
                      <td>{yn(r.oecd.qdmttSH)}</td>
                      <td>
                        <span className={`tag ${r.status === "match" ? "tag-accent" : r.status === "changed" ? "tag-outline" : "tag-neutral"}`}>
                          {r.status === "match" ? "Match" : r.status === "changed" ? "Changed" : "Not on Record"}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {live.news.length > 0 && (
            <div style={{ padding: "12px 16px", borderTop: "2px solid var(--color-divider)" }}>
              <h4 style={{ margin: "0 0 8px" }}>OECD hub — recent titles</h4>
              {live.news.map((n) => (
                <div key={n.href} style={{ padding: "8px 0", borderBottom: "1px solid var(--color-divider)", fontSize: 13 }}>
                  <a href={n.href} target="_blank" rel="noreferrer">{n.title}</a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h4>Effective jurisdiction packs</h4>
          <span className="text-muted">
            Signed Aug 2026 pack{accepted.length ? ` + ${accepted.length} accepted amendment${accepted.length === 1 ? "" : "s"}` : ""}
          </span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Jurisdiction</th>
                <th>IIR</th>
                <th>QDMTT</th>
                <th>QDMTT SH</th>
                <th>UTPR</th>
                <th>Effective</th>
                <th>Qualified</th>
                <th>Filing</th>
                <th>FX</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {packs.map((p) => {
                const changed = amendedFields(p.iso, packAmendments);
                const mark = (f: string) => (changed.includes(f as never) ? { fontWeight: 800, color: "var(--color-accent-700)" } : undefined);
                return (
                  <tr key={p.iso}>
                    <td>
                      {p.name}
                      {changed.length ? <span className="tag tag-accent" style={{ marginLeft: 6, fontSize: 9 }}>Amended</span> : null}
                    </td>
                    <td style={mark("iir")}>{yn(p.iir)}</td>
                    <td style={mark("qdmtt")}>{yn(p.qdmtt)}</td>
                    <td style={mark("qdmttSH")}>{yn(p.qdmttSH)}</td>
                    <td style={mark("utpr")}>{yn(p.utpr)}</td>
                    <td>{p.from}</td>
                    <td style={mark("qualified")}>{p.qualified}</td>
                    <td>{p.filing}</td>
                    <td>{p.fx}</td>
                    <td style={{ fontSize: 12 }}>{p.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {rejected.length > 0 && (
        <p className="text-muted" style={{ marginTop: 14, fontSize: 13 }}>
          {rejected.length} proposal{rejected.length === 1 ? "" : "s"} rejected and held on the record:{" "}
          {rejected.map((a) => `${a.name} ${FIELD_LABEL[a.field]}`).join(" · ")}. A later scan reopens a row only if
          the Record changes what it proposes.
        </p>
      )}

      <p className="text-muted" style={{ marginTop: 14, fontSize: 13 }}>
        Group top-up on the effective pack is {eur(t.topUp, true)} — {eur(t.qdmtt, true)} QDMTT, {eur(t.iir, true)} IIR,
        {" "}{eur(t.utpr, true)} UTPR. Collection order still follows the pack (QDMTT → IIR → UTPR). Thailand has a
        separate jurisdiction pack — not a translation of the OECD engine.{" "}
        <Link href="/thailand">Thailand pack</Link>
        {" · "}
        <Link href="/allocation">Who pays</Link>
        {" · "}
        <Link href="/rulebook">Rulebook</Link>
        {" · "}
        <a href={OECD_CENTRAL_RECORD_PDF} target="_blank" rel="noreferrer">OECD Central Record PDF</a>
      </p>
    </div>
  );
}

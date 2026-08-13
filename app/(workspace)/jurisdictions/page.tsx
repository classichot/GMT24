"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { JURISDICTION_PACKS } from "@/lib/model";
import { useStore } from "@/lib/store";
import {
  OECD_CENTRAL_RECORD_PDF,
  OECD_CENTRAL_RECORD_URL,
  type OecdRefresh,
} from "@/lib/oecdCentralRecord";

function yn(v: boolean) {
  return v ? "Y" : "—";
}

export default function JurisdictionsPage() {
  const { flash, ask } = useStore();
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<OecdRefresh | null>(null);

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
      const n = data.rows.filter((r) => r.status === "changed").length;
      const missing = data.rows.filter((r) => r.status === "not-on-record").length;
      flash(
        n
          ? `OECD extract: ${n} pack difference${n === 1 ? "" : "s"} · ${missing} not on Central Record`
          : `OECD extract complete${data.asOf ? ` · as at ${data.asOf}` : ""}. Review before applying.`,
      );
    } catch {
      flash("Could not reach the OECD refresh endpoint");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Jurisdiction packs.</strong> Qualified IIR / QDMTT / QDMTT Safe Harbour come from the OECD Central Record, not from the LLM. AI extracts the live OECD page; the engine keeps using this signed pack until a reviewer accepts a change. Absence from the Record is not a finding that the law is unqualified.
        </div>
        <div className="stack-actions">
          <button className="btn btn-primary" onClick={refresh} disabled={busy}>
            <Sparkles size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
            {busy ? "Reading OECD…" : "Refresh from OECD"}
          </button>
          <a href={OECD_CENTRAL_RECORD_URL} target="_blank" rel="noreferrer" className="btn btn-secondary">Open Central Record</a>
          <button className="btn btn-ghost" onClick={() => ask("Show the OECD basis for this treatment.")}>Ask GMT24</button>
        </div>
      </div>

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
              {live.error ? ` · ${live.error}` : " · AI mapped country names to IIR / QDMTT / QDMTT SH / SbS tables. Nothing is written to the calculation until you accept."}
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
          <h4>Signed Central Record packs</h4>
          <span className="text-muted">In force for this snapshot · Aug 2026 pack</span>
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
              {JURISDICTION_PACKS.map((p) => (
                <tr key={p.iso}>
                  <td>{p.name}</td>
                  <td>{yn(p.iir)}</td>
                  <td>{yn(p.qdmtt)}</td>
                  <td>{yn(p.qdmttSH)}</td>
                  <td>{yn(p.utpr)}</td>
                  <td>{p.from}</td>
                  <td>{p.qualified}</td>
                  <td>{p.filing}</td>
                  <td>{p.fx}</td>
                  <td style={{ fontSize: 12 }}>{p.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-muted" style={{ marginTop: 14, fontSize: 13 }}>
        Collection order still follows the signed pack (QDMTT → IIR → UTPR).{" "}
        <Link href="/allocation">Who pays</Link>
        {" · "}
        <Link href="/rulebook">Rulebook</Link>
        {" · "}
        <a href={OECD_CENTRAL_RECORD_PDF} target="_blank" rel="noreferrer">OECD Central Record PDF</a>
      </p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { LEGAL_SOURCES, passagesForSource } from "@/lib/legal";
import { OECD_PUBLICATIONS, SERIES_LABEL, doiUrl, formatBytes, publicationsByDate } from "@/lib/publications";

function fmt(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export default function PublicationsPage() {
  const pubs = publicationsByDate();
  const totalPages = OECD_PUBLICATIONS.reduce((a, p) => a + p.pages, 0);
  const totalBytes = OECD_PUBLICATIONS.reduce((a, p) => a + p.fileBytes, 0);
  const years = [...new Set(pubs.map((p) => p.publishedAt.slice(0, 4)))];
  const latest = pubs[0];

  return (
    <div>
      <div className="callout" style={{ marginBottom: 16 }}>
        <strong>OECD publications on file.</strong> The official Inclusive Framework documents GMT24 works from, recorded by publication date with the copy stored in the app, the OECD DOI and the legal-corpus source built from each. A rule or passage cites one of these; the <Link href="/regwatch">Regulatory Watch</Link> flags when the OECD releases a newer edition. Texts in the <Link href="/legal">legal corpus</Link> are paraphrases — these PDFs are the wording to confirm against.
      </div>

      <div className="kpi-grid cols-4" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="kpi-label">Publications</div><div className="kpi-val" style={{ fontSize: 26 }}>{pubs.length}</div><div className="kpi-sub">{years.join(" · ")}</div></div>
        <div className="kpi"><div className="kpi-label">Latest</div><div className="kpi-val" style={{ fontSize: 20 }}>{fmt(latest.publishedAt)}</div><div className="kpi-sub">{latest.short}</div></div>
        <div className="kpi"><div className="kpi-label">Pages on file</div><div className="kpi-val" style={{ fontSize: 26 }}>{totalPages.toLocaleString("en-GB")}</div><div className="kpi-sub">{formatBytes(totalBytes)} in /oecd</div></div>
        <div className="kpi"><div className="kpi-label">Corpus passages</div><div className="kpi-val" style={{ fontSize: 26 }}>{pubs.reduce((a, p) => a + passagesForSource(p.sourceId).length, 0)}</div><div className="kpi-sub">paraphrased from these documents</div></div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h4>Register — by publication date</h4><span className="tag tag-outline">{pubs.length}</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Published</th><th>Publication</th><th>Series</th><th>Approved by IF</th><th>Pages</th><th>Corpus</th><th>Copy</th><th>DOI</th></tr></thead>
            <tbody>
              {pubs.map((p) => {
                const src = LEGAL_SOURCES.find((s) => s.id === p.sourceId);
                const n = passagesForSource(p.sourceId).length;
                return (
                  <tr key={p.id}>
                    <td className="mono" style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{p.publishedAt}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}><a href={`#${p.id}`}>{p.short}</a></div>
                      <div className="text-muted" style={{ fontSize: 12 }}>{p.title}</div>
                      {p.supersedes && <div className="text-muted" style={{ fontSize: 12 }}>Supersedes {p.supersedes}</div>}
                    </td>
                    <td><span className="tag tag-accent" style={{ fontSize: 10 }}>{SERIES_LABEL[p.series]}</span></td>
                    <td className="mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{p.approvedAt}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{p.pages}</td>
                    <td>
                      {src ? <Link href={`/legal?source=${encodeURIComponent(p.sourceId)}`} className="mono" style={{ fontSize: 12 }}>{src.short} · {n} passage{n === 1 ? "" : "s"}</Link> : <span className="text-muted">—</span>}
                      {src && <div><span className={`tag ${src.status === "in-force" ? "tag-ok" : "tag-warn"}`} style={{ fontSize: 10 }}>{src.status}</span></div>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}><a href={p.file} target="_blank" rel="noreferrer">PDF</a> <span className="text-muted" style={{ fontSize: 11 }}>{formatBytes(p.fileBytes)}</span></td>
                    <td><a href={doiUrl(p)} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 12 }}>{p.doi}</a></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {pubs.map((p) => {
        const src = LEGAL_SOURCES.find((s) => s.id === p.sourceId);
        return (
          <div key={p.id} id={p.id} className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head">
              <h4>{p.short}</h4>
              <span className="tag tag-neutral" style={{ fontSize: 10 }}>published {fmt(p.publishedAt)}</span>
            </div>
            <div className="panel-body">
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{p.title}</div>
              <p style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.55 }}>{p.summary}</p>
              <div className="text-muted" style={{ fontSize: 12, display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 10 }}>
                <span>Approved / declassified by the Inclusive Framework {fmt(p.approvedAt)}</span>
                <span>Published {fmt(p.publishedAt)}</span>
                <span>{p.pages} pages · {formatBytes(p.fileBytes)}</span>
                <span>{SERIES_LABEL[p.series]}</span>
                {p.supersedes && <span>Supersedes {p.supersedes}</span>}
                <span>Added to GMT24 {fmt(p.addedAt)}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <a className="btn btn-primary" href={p.file} target="_blank" rel="noreferrer">Open PDF</a>
                <a className="btn btn-secondary" href={doiUrl(p)} target="_blank" rel="noreferrer">OECD DOI {p.doi}</a>
                {src && <Link className="btn btn-secondary" href={`/legal?source=${encodeURIComponent(p.sourceId)}`}>Corpus passages ({passagesForSource(p.sourceId).length})</Link>}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <span className="text-muted" style={{ fontSize: 12, alignSelf: "center" }}>Used by</span>
                {p.usedBy.map((u) => <Link key={u.href} href={u.href} className="tag tag-outline" style={{ fontSize: 10 }}>{u.label}</Link>)}
              </div>
              <div className="text-muted mono" style={{ fontSize: 11, marginTop: 10, wordBreak: "break-all" }}>sha256 {p.sha256}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

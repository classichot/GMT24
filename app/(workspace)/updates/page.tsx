"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { AUTHORITY_NAME } from "@/lib/legal";
import type { LegalAuthority } from "@/lib/legal/types";
import { KIND_LABEL, STATUS_LABEL, countryStatus, oecdTimeline, updateHref, updateSummary, updatesByDate, type BuildStatus, type UpdateAuthority } from "@/lib/updates";
import { girEditionFor } from "@/lib/gir2026";

function fmt(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

const STATUS_CLASS: Record<BuildStatus, string> = {
  implemented: "tag-ok",
  partial: "tag-warn",
  planned: "tag-outline",
  monitoring: "tag-neutral",
  "not-applicable": "tag-neutral",
};

function authorityName(a: UpdateAuthority) {
  return (AUTHORITY_NAME as Record<string, string>)[a as LegalAuthority] ?? a;
}

export default function UpdatesPage() {
  return (
    <Suspense fallback={null}>
      <UpdatesInner />
    </Suspense>
  );
}

function UpdatesInner() {
  const params = useSearchParams();
  const { group, packOverlay, packChanges } = useStore();
  const [authority, setAuthority] = useState<string>(params.get("authority") ?? "all");
  const [status, setStatus] = useState<string>("all");
  const all = updatesByDate();
  const summary = updateSummary();
  const edition = girEditionFor(group.fyStart);
  const countries = useMemo(() => countryStatus(packOverlay), [packOverlay]);
  const authorities = ["all", ...new Set(all.map((u) => u.authority))];
  const list = all.filter((u) => (authority === "all" || u.authority === authority) && (status === "all" || u.status === status));
  const timeline = oecdTimeline();
  const openChanges = packChanges.filter((c) => !c.adminReviewed).length;

  return (
    <div>
      <div className="callout" style={{ marginBottom: 16 }}>
        <strong>Latest update.</strong> What the OECD and each country changed for Pillar Two, dated, and what GMT24 built for it. The newest entry is the <Link href={updateHref(summary.latest)}>{summary.latest.title}</Link> ({fmt(summary.latest.date)}). For {group.name} the FY starts {group.fyStart}, so the <Link href="/gir">{edition.short}</Link> template governs the return. Track a change here, then open the screen that carries it; the <Link href="/regwatch">Regulatory Watch</Link> raises new OECD releases and the <Link href="/publications">publications register</Link> keeps the PDFs.
      </div>

      <div className="kpi-grid cols-6" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="kpi-label">Changes tracked</div><div className="kpi-val" style={{ fontSize: 26 }}>{summary.total}</div><div className="kpi-sub">OECD + country</div></div>
        <div className="kpi"><div className="kpi-label">Implemented</div><div className="kpi-val" style={{ fontSize: 26 }}>{summary.implemented}</div><div className="kpi-sub">in the build</div></div>
        <div className="kpi"><div className="kpi-label">Partly</div><div className="kpi-val" style={{ fontSize: 26 }}>{summary.partial}</div><div className={`kpi-sub${summary.partial ? " hot" : ""}`}>open points listed</div></div>
        <div className="kpi"><div className="kpi-label">Monitoring</div><div className="kpi-val" style={{ fontSize: 26 }}>{summary.monitoring}</div><div className="kpi-sub">awaiting the regulator</div></div>
        <div className="kpi"><div className="kpi-label">GIR template</div><div className="kpi-val" style={{ fontSize: 18 }}>{edition.short}</div><div className="kpi-sub">FY {group.fy} · schema {edition.schema.status}</div></div>
        <div className="kpi"><div className="kpi-label">Pack changes open</div><div className="kpi-val" style={{ fontSize: 26 }}>{openChanges}</div><div className="kpi-sub"><Link href="/jurisdictions">Regulatory Watch proposals</Link></div></div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h4>OECD documents on file — by publication date</h4><Link href="/publications" className="tag tag-outline">Register</Link></div>
        <div className="panel-body" style={{ display: "flex", gap: 0, overflowX: "auto", alignItems: "stretch" }}>
          {timeline.map((t, i) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center" }}>
              <Link href={t.href} style={{ textDecoration: "none", color: "inherit", minWidth: 180, padding: "8px 12px", border: "1px solid var(--color-divider)", background: i === timeline.length - 1 ? "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))" : "var(--color-surface)" }}>
                <div className="mono" style={{ fontSize: 11, fontWeight: 700 }}>{t.date}</div>
                <div style={{ fontSize: 12 }}>{t.label}</div>
              </Link>
              {i < timeline.length - 1 && <span style={{ width: 28, height: 2, background: "var(--color-divider)", display: "block" }} />}
            </div>
          ))}
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h4>Change register — regulation vs GMT24 build</h4>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {authorities.map((a) => <button key={a} type="button" className={`chip${authority === a ? " active" : ""}`} onClick={() => setAuthority(a)}>{a === "all" ? "All" : authorityName(a as UpdateAuthority)}</button>)}
            <span style={{ width: 1, background: "var(--color-divider)" }} />
            {(["all", "implemented", "partial", "monitoring"] as const).map((s) => <button key={s} type="button" className={`chip${status === s ? " active" : ""}`} onClick={() => setStatus(s)}>{s === "all" ? "Any status" : STATUS_LABEL[s]}</button>)}
          </div>
        </div>
        {list.map((u) => (
          <div key={u.id} id={u.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--color-divider)", display: "grid", gridTemplateColumns: "120px 1fr", gap: 16 }}>
            <div>
              <div className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{u.date}</div>
              <div className="text-muted" style={{ fontSize: 11 }}>{authorityName(u.authority)}</div>
              <div style={{ marginTop: 6 }}><span className={`tag ${STATUS_CLASS[u.status]}`} style={{ fontSize: 10 }}>{STATUS_LABEL[u.status]}</span></div>
              <div style={{ marginTop: 4 }}><span className="tag tag-outline" style={{ fontSize: 10 }}>{KIND_LABEL[u.kind]}</span></div>
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>{u.title}</div>
              <p style={{ margin: "4px 0 8px", fontSize: 13, lineHeight: 1.5 }}>{u.summary}</p>
              <div className="text-muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Source: <Link href={updateHref(u)}>{u.source.label}</Link>{u.effectiveFrom ? ` · applies to FYs from ${u.effectiveFrom}` : ""} · recorded {u.recordedAt}
              </div>
              <div style={{ fontSize: 12 }}>
                <strong>GMT24 built</strong>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {u.built.map((b) => <li key={b.href + b.text} style={{ marginBottom: 2 }}>{b.text} — <Link href={b.href}>open</Link></li>)}
                </ul>
              </div>
              {u.open && <div style={{ fontSize: 12, marginTop: 8, padding: "6px 10px", background: "color-mix(in srgb, var(--color-hot) 10%, var(--color-surface))" }}><strong>Open</strong> · {u.open}</div>}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {u.modules.map((m) => <span key={m} className="tag tag-neutral" style={{ fontSize: 10 }}>{m}</span>)}
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="panel-body text-muted">No change matches the filter.</div>}
      </div>

      <div className="panel">
        <div className="panel-head"><h4>Pillar Two by country — latest regulation vs GMT24 ({group.name})</h4><Link href="/jurisdictions" className="tag tag-outline">Jurisdiction packs</Link></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Jurisdiction</th><th>Latest regulation</th><th>Charging provisions</th><th>Qualified status</th><th>GIR rules</th><th>Engine rules</th><th>Corpus</th><th>GMT24</th></tr></thead>
            <tbody>
              {countries.map((c) => (
                <tr key={c.iso}>
                  <td><strong>{c.name}</strong> <span className="mono text-muted" style={{ fontSize: 11 }}>{c.iso}</span>{c.overlaid && <div><span className="tag tag-warn" style={{ fontSize: 10 }}>pack amendment pending</span></div>}</td>
                  <td style={{ fontSize: 12 }}>
                    {c.latestRegulation ? <><Link href={c.latestRegulation.href}>{c.latestRegulation.label}</Link><div className="mono text-muted" style={{ fontSize: 11 }}>{c.latestRegulation.date} · {c.latestRegulation.status}</div></> : <span className="text-muted">No domestic instrument on file</span>}
                    {c.updates.slice(0, 1).map((u) => <div key={u.id} style={{ fontSize: 11, marginTop: 4 }}><a href={`#${u.id}`}>{u.date} · {u.title}</a></div>)}
                  </td>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    <span className={`tag ${c.rules.iir ? "tag-ok" : "tag-neutral"}`} style={{ fontSize: 10 }}>IIR</span>{" "}
                    <span className={`tag ${c.rules.qdmtt ? "tag-ok" : "tag-neutral"}`} style={{ fontSize: 10 }}>QDMTT{c.rules.qdmttSH ? " SH" : ""}</span>{" "}
                    <span className={`tag ${c.rules.utpr ? "tag-ok" : "tag-neutral"}`} style={{ fontSize: 10 }}>UTPR</span>
                    <div className="mono text-muted" style={{ fontSize: 11 }}>from {c.rules.from}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{c.rules.qualified}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{c.girRules}</td>
                  <td style={{ fontSize: 11 }}>{c.engineRules.length ? c.engineRules.map((r) => <div key={r.id}><Link href="/rulebook" className="mono">{r.id}</Link> <span className="text-muted">v{r.version} · {r.effectiveFrom}</span></div>) : <span className="text-muted">OECD Model Rules + pack</span>}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{c.passages ? <Link href={["TH", "IE", "JP", "US"].includes(c.iso) ? `/legal?authority=${c.iso}` : `/legal?q=${encodeURIComponent(c.name)}`}>{c.passages}</Link> : "—"}</td>
                  <td style={{ fontSize: 12, maxWidth: 320 }}><span className={`tag ${STATUS_CLASS[c.build]}`} style={{ fontSize: 10 }}>{STATUS_LABEL[c.build]}</span><div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>{c.note}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Download, FileText, Package, ShieldCheck } from "lucide-react";
import { NoMission } from "@/components/agi/AgiFrame";
import { EvidencePanel } from "@/components/agi/Evidence";
import { packToMarkdown } from "@/lib/agi/auditPack";
import { shortHash } from "@/lib/agi/case";
import { EVIDENCE_KIND_LABEL, evidenceKindTag } from "@/lib/agi/evidence";
import { useAgi } from "@/lib/agi/useAgi";
import type { AuditPack, MissionRecord } from "@/lib/agi/types";

export default function AuditFilePage() {
  const agi = useAgi();
  const m = agi.selected;
  if (!m) return <NoMission />;
  return <AuditFile m={m} />;
}

function download(name: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function AuditFile({ m }: { m: MissionRecord }) {
  const agi = useAgi();
  const packs = m.packs.slice().reverse();
  const current = packs.find((p) => p.caseHash === m.case.hash && p.status !== "superseded") ?? packs[0] ?? null;
  const [packId, setPackId] = useState<string | null>(null);
  const pack = packs.find((p) => p.id === packId) ?? current;
  const gate = agi.gate(m);
  const busy = !!agi.busy;
  const locked = ["completed", "cancelled", "paused"].includes(m.state);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, flex: 1 }}>Audit File</h2>
        <button className="btn btn-primary" disabled={busy || locked} onClick={() => agi.tool("build_audit_pack", { missionId: m.id })}><Package size={15} />{current ? "Rebuild package on this case version" : "Prepare for audit"}</button>
        {pack && <button className="btn btn-secondary" onClick={() => download(`GMT24-audit-package-${m.id}-v${pack.version}.md`, packToMarkdown(pack, m))}><Download size={15} />Download v{pack.version} (.md)</button>}
        {m.state === "ready-for-review" && <button className="btn btn-hot" disabled={busy || !gate.ok} onClick={() => agi.complete(m.id)} title={gate.reasons.join(" ")}><ShieldCheck size={15} />Approve completion</button>}
      </div>

      <div className="callout">
        Audit readiness describes the file GMT24 assembled: executive summary, election register with rejected alternatives, calculation summary, verification checks, compliance findings, decisions, a hash-chained evidence index and the outstanding issues. It never predicts or guarantees an auditor's or tax authority's conclusion. Packages are versioned per case version; earlier approved packages stay in the record when the case changes.
      </div>

      {packs.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h4>Package versions</h4><span className="tag tag-outline">{packs.length}</span></div>
          <div className="panel-body" style={{ fontSize: 12 }}>
            <table className="table">
              <thead><tr><th>Version</th><th>Status</th><th>Case</th><th>Built</th><th>Sections</th><th>Evidence</th><th>Outstanding</th></tr></thead>
              <tbody>
                {packs.map((p) => (
                  <tr key={p.id} className={`clickable${pack?.id === p.id ? " selected" : ""}`} onClick={() => setPackId(p.id)}>
                    <td>v{p.version} <span className="agi-mono" style={{ color: "var(--color-neutral-600)" }}>{p.id}</span></td>
                    <td><span className={`tag ${p.status === "approved" ? "tag-ok" : p.status === "draft" ? "tag-accent" : "tag-neutral"}`} style={{ fontSize: 10 }}>{p.status}</span></td>
                    <td className="agi-mono">{shortHash(p.caseHash)}{p.caseHash !== m.case.hash ? " (previous)" : ""}</td>
                    <td>{new Date(p.builtAt).toLocaleString("en-GB")}</td><td>{p.sections.length}</td><td>{p.evidenceIndex.length}</td><td>{p.outstanding.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!pack && <div className="callout" style={{ borderLeftColor: "var(--color-warn)" }}>No package on this mission yet. Build it once the calculation is verified and compliance reviewed; a package can also be built earlier — it then lists the failures and open items as outstanding.</div>}

      {pack && <PackView p={pack} m={m} />}

      <EvidencePanel m={m} title="Complete evidence record" compact />
    </div>
  );
}

function PackView({ p, m }: { p: AuditPack; m: MissionRecord }) {
  const gate = { ok: p.outstanding.length === 0 };
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="kpi-grid cols-4">
        <div className="kpi"><div className="kpi-label">Package</div><div className="kpi-val" style={{ fontSize: 26 }}>v{p.version}</div><div className="kpi-sub">{p.status} · case {shortHash(p.caseHash)}</div></div>
        <div className="kpi"><div className="kpi-label">Sections</div><div className="kpi-val" style={{ fontSize: 26 }}>{p.sections.length}</div><div className="kpi-sub">{p.sections.map((s) => s.title.split(" ")[0]).join(" · ")}</div></div>
        <div className="kpi"><div className="kpi-label">Evidence indexed</div><div className="kpi-val" style={{ fontSize: 26 }}>{p.evidenceIndex.length}</div><div className="kpi-sub">hash-chained records</div></div>
        <div className="kpi"><div className="kpi-label">Outstanding</div><div className="kpi-val" style={{ fontSize: 26 }}>{p.outstanding.length}</div><div className={`kpi-sub${gate.ok ? "" : " hot"}`}>{gate.ok ? "nothing open" : "listed below"}</div></div>
      </div>

      {p.sections.map((s) => (
        <section key={s.id} className="panel">
          <div className="panel-head"><h4><FileText size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{s.title}</h4></div>
          <div className="panel-body" style={{ fontSize: 13, lineHeight: 1.55 }}>
            {s.body.length > 0 && <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>{s.body.map((b, i) => <li key={i}>{b}</li>)}</ul>}
            {s.table && s.table.rows.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ fontSize: 12 }}>
                  <thead><tr>{s.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>{s.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ))}

      <section className="panel">
        <div className="panel-head"><h4>Outstanding issues</h4><span className={`tag ${p.outstanding.length ? "tag-hot" : "tag-ok"}`}>{p.outstanding.length}</span></div>
        <div className="panel-body" style={{ fontSize: 13 }}>
          {p.outstanding.length === 0 ? <div>None. Every blocking check passed, no decision or blocker is open and approved changes have been applied.</div> : <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>{p.outstanding.map((o) => <li key={o}>{o}</li>)}</ul>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h4>Evidence index</h4><span className="tag tag-outline">{p.evidenceIndex.length} records at build time · mission has {m.evidence.length}</span></div>
        <div className="panel-body" style={{ fontSize: 12 }}>
          <table className="table">
            <thead><tr><th>#</th><th>Kind</th><th>Record</th><th>Hash</th><th>Refs</th></tr></thead>
            <tbody>{p.evidenceIndex.map((e, i) => <tr key={e.id}><td>{i + 1}</td><td><span className={`tag ${evidenceKindTag(e.kind)}`} style={{ fontSize: 10 }}>{EVIDENCE_KIND_LABEL[e.kind]}</span></td><td>{e.title}</td><td className="agi-mono">{e.hash}</td><td style={{ color: "var(--color-neutral-600)" }}>{e.refs.slice(0, 4).join(", ")}{e.refs.length > 4 ? ` +${e.refs.length - 4}` : ""}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

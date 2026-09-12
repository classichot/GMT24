"use client";

import Link from "next/link";
import { useState } from "react";
import { Scale } from "lucide-react";
import { NoMission } from "@/components/agi/AgiFrame";
import { EvidencePanel } from "@/components/agi/Evidence";
import { complianceSummary } from "@/lib/agi/compliance";
import { useAgi } from "@/lib/agi/useAgi";
import { citeLegal, passageById } from "@/lib/legal";
import type { ComplianceFinding, MissionRecord } from "@/lib/agi/types";

export default function CompliancePage() {
  const agi = useAgi();
  const m = agi.selected;
  if (!m) return <NoMission />;
  return <Compliance m={m} />;
}

const STATUS_TAG: Record<ComplianceFinding["status"], string> = { met: "tag-ok", gap: "tag-hot", judgment: "tag-warn", "n/a": "tag-neutral" };

function Compliance({ m }: { m: MissionRecord }) {
  const agi = useAgi();
  const rows = m.compliance;
  const sum = complianceSummary(rows);
  const [status, setStatus] = useState<"all" | ComplianceFinding["status"]>("all");
  const [onlyApplies, setOnlyApplies] = useState(true);
  const busy = !!agi.busy;
  const locked = ["completed", "cancelled", "paused"].includes(m.state);
  const shown = rows.filter((r) => (status === "all" || r.status === status) && (!onlyApplies || r.applies));
  const oecd = shown.filter((r) => r.authority === "OECD");
  const domestic = shown.filter((r) => r.authority !== "OECD");
  const authorities = [...new Set(domestic.map((r) => r.authority))];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, flex: 1 }}>Compliance Review</h2>
        <button className="btn btn-primary" disabled={busy || locked} onClick={() => agi.tool("review_compliance", { missionId: m.id })}><Scale size={15} />{rows.length ? "Re-run compliance review" : "Review compliance"}</button>
      </div>

      <div className="kpi-grid cols-6">
        <div className="kpi"><div className="kpi-label">Requirements</div><div className="kpi-val" style={{ fontSize: 26 }}>{rows.filter((r) => r.applies).length}</div><div className="kpi-sub">apply · {rows.length} in register</div></div>
        <div className="kpi"><div className="kpi-label">Met</div><div className="kpi-val" style={{ fontSize: 26 }}>{sum.met}</div><div className="kpi-sub">evidence on file</div></div>
        <div className="kpi"><div className="kpi-label">Gaps</div><div className="kpi-val" style={{ fontSize: 26 }}>{sum.gap}</div><div className={`kpi-sub${sum.gap ? " hot" : ""}`}>need action</div></div>
        <div className="kpi"><div className="kpi-label">Judgments</div><div className="kpi-val" style={{ fontSize: 26 }}>{sum.judgment}</div><div className="kpi-sub">documented position</div></div>
        <div className="kpi"><div className="kpi-label">OECD</div><div className="kpi-val" style={{ fontSize: 26 }}>{sum.oecd}</div><div className="kpi-sub">Model Rules / Commentary / AG</div></div>
        <div className="kpi"><div className="kpi-label">Domestic</div><div className="kpi-val" style={{ fontSize: 26 }}>{sum.domestic}</div><div className="kpi-sub">{authorities.join(", ") || "scoped jurisdictions"}</div></div>
      </div>

      {!rows.length && <div className="callout">Not reviewed on this case version. The review walks the requirement register for {m.scope.jurisdictions.join(", ")} and {m.scope.fy}: OECD requirements and domestic requirements are reported separately, each with its instrument and effective dates. A finding of “met” cites the evidence; a “judgment” is a documented position, not a certainty.</div>}

      {rows.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {(["all", "met", "gap", "judgment", "n/a"] as const).map((s) => (
            <button key={s} className={`chip${status === s ? " active" : ""}`} style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setStatus(s)}>{s}</button>
          ))}
          <label style={{ fontSize: 12, display: "inline-flex", gap: 6, alignItems: "center", marginLeft: 8 }}>
            <input type="checkbox" checked={onlyApplies} onChange={(e) => setOnlyApplies(e.target.checked)} /> Only requirements that apply
          </label>
        </div>
      )}

      {rows.length > 0 && <FindingsTable title="OECD requirements" sub="Model Rules, Commentary and Administrative Guidance — cited as the OECD source, not as domestic law" rows={oecd} />}
      {rows.length > 0 && <FindingsTable title={`Domestic requirements${authorities.length ? ` · ${authorities.join(", ")}` : ""}`} sub="Domestic legislation and guidance for the scoped jurisdictions, with effective dates. Domestic and OECD requirements may differ; differences are reported as findings, not resolved by assumption." rows={domestic} />}

      <EvidencePanel m={m} supports="compliance" title="Evidence behind the compliance findings" compact />
    </div>
  );
}

function FindingsTable({ title, sub, rows }: { title: string; sub: string; rows: ComplianceFinding[] }) {
  return (
    <section className="panel">
      <div className="panel-head"><h4>{title}</h4><span className="tag tag-outline">{rows.length}</span></div>
      <div className="panel-body" style={{ fontSize: 12 }}>
        <div style={{ color: "var(--color-neutral-600)", marginBottom: 8 }}>{sub}</div>
        {rows.length === 0 ? <div>No findings for this filter.</div> : (
          <table className="table">
            <thead><tr><th>Requirement</th><th>Instrument</th><th>Effective</th><th>Status</th><th>Finding</th><th>Evidence</th><th>Law</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><div><strong>{r.title}</strong></div><div className="agi-mono" style={{ color: "var(--color-neutral-600)" }}>{r.requirementId}{r.iso ? ` · ${r.iso}` : ""}</div></td>
                  <td>{r.instrument}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.effectiveFrom}{r.effectiveTo ? ` → ${r.effectiveTo}` : " →"}</td>
                  <td><span className={`tag ${STATUS_TAG[r.status]}`} style={{ fontSize: 10 }}>{r.applies ? r.status : "does not apply"}</span></td>
                  <td style={{ lineHeight: 1.5 }}>{r.finding}</td>
                  <td>{r.evidence.slice(0, 4).join(", ")}{r.evidence.length > 4 ? ` +${r.evidence.length - 4}` : ""}{r.href && <> · <Link href={r.href}>open</Link></>}</td>
                  <td><ReadTheLaw ids={r.passages} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

/** Links each finding to the corpus passages it was read from — the same passages the rulebook and Co-Pilot cite. */
function ReadTheLaw({ ids }: { ids?: string[] }) {
  const passages = (ids ?? []).map(passageById).filter((p): p is NonNullable<typeof p> => Boolean(p));
  if (!passages.length) return <span style={{ color: "var(--color-neutral-500)" }}>—</span>;
  const shown = passages.slice(0, 3);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, whiteSpace: "nowrap" }}>
      {shown.map((p) => { const c = citeLegal(p); return <Link key={p.id} href={c.href} title={p.heading}>{c.label}</Link>; })}
      {passages.length > shown.length && <Link href={`/legal?p=${passages.map((p) => encodeURIComponent(p.id)).join(",")}`}>+{passages.length - shown.length} more · read the law</Link>}
    </div>
  );
}

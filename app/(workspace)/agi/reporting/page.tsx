"use client";

import Link from "next/link";
import { FileText, ShieldCheck } from "lucide-react";
import { NoMission } from "@/components/agi/AgiFrame";
import { latestRun } from "@/lib/agi/auditPack";
import { useAgi } from "@/lib/agi/useAgi";
import { eur } from "@/lib/format";
import type { MissionRecord } from "@/lib/agi/types";

export default function ReportingPage() {
  const agi = useAgi();
  const m = agi.selected;
  if (!m) return <NoMission />;
  return <Reporting m={m} />;
}

function Reporting({ m }: { m: MissionRecord }) {
  const run = latestRun(m);
  const pack = m.packs.find((p) => p.caseHash === m.case.hash && p.status !== "superseded") ?? m.packs[m.packs.length - 1];
  const verified = m.verifiedAgainst === m.case.hash;
  const tracks = [
    {
      id: "gir",
      title: "GloBE Information Return",
      status: pack && verified ? "Draft ready for review" : verified ? "Numbers verified — build the pack" : "Waiting on verified calculation",
      detail: "OECD GIR (September 2026) is the information return. It is not a domestic tax return and does not pay the tax.",
      href: "/gir",
    },
    {
      id: "local",
      title: "Domestic tax returns",
      status: "Tracked separately",
      detail: `QDMTT / IIR / UTPR returns for ${m.scope.jurisdictions.join(", ")}. Filing stays a permissioned human action.`,
      href: "/filings",
    },
    {
      id: "pay",
      title: "Payment obligations",
      status: run ? `Working top-up ${eur(run.totals.topUp)}` : "No run yet",
      detail: `QDMTT ${run ? eur(run.totals.qdmtt) : "—"} · IIR ${run ? eur(run.totals.iir) : "—"} · UTPR ${run ? eur(run.totals.utpr) : "—"}. Payment is never an agent action.`,
      href: "/allocation",
    },
  ];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, flex: 1 }}>Reporting & Filing</h2>
        <Link href="/agi/audit-file" className="btn btn-secondary"><FileText size={15} />Audit package</Link>
        <Link href="/gir" className="btn btn-primary"><ShieldCheck size={15} />Open GIR</Link>
      </div>

      <div className="callout">
        The OECD’s September 2026 GIR distinguishes the information return from domestic tax-return and payment requirements. GMT24 tracks the three streams separately. Agents may draft and validate; they cannot file or pay.
      </div>

      <div className="kpi-grid cols-3">
        {tracks.map((t) => (
          <div key={t.id} className="kpi">
            <div className="kpi-label">{t.title}</div>
            <div className="kpi-val" style={{ fontSize: 16, marginTop: 8 }}>{t.status}</div>
            <div className="kpi-sub">{t.detail}</div>
            <div style={{ marginTop: 10 }}><Link href={t.href}>Open {t.id === "gir" ? "GIR" : t.id === "local" ? "filing matrix" : "allocation"} →</Link></div>
          </div>
        ))}
      </div>

      <section className="panel">
        <div className="panel-head"><h4>Consistency checklist</h4></div>
        <div className="panel-body" style={{ fontSize: 12 }}>
          <table className="table">
            <thead><tr><th>Check</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>Calculation verified on the pinned case</td><td>{verified ? "Pass" : "Open"}</td></tr>
              <tr><td>Audit package built on this case version</td><td>{pack ? `v${pack.version} · ${pack.status}` : "Not built"}</td></tr>
              <tr><td>Election package decided</td><td>{m.decisions.some((d) => d.kind === "election-package" && d.status === "approved" && d.caseHash === m.case.hash) ? "Approved" : "Awaiting a person"}</td></tr>
              <tr><td>GIR draft consistent with engine totals</td><td>{run ? `${run.id} · ${eur(run.totals.topUp)}` : "No run"}</td></tr>
              <tr><td>Domestic return / payment</td><td>Not an agent deliverable</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

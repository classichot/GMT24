"use client";

import Link from "next/link";
import { FILINGS } from "@/lib/model";
import { useStore } from "@/lib/store";
import { FlowBar } from "@/components/FlowBar";
import { useCalc } from "@/lib/useCalc";
import { eur } from "@/lib/format";

function days(deadline: string) {
  const d = (new Date(deadline).getTime() - new Date("2026-08-13").getTime()) / 86400000;
  return Math.round(d);
}

export default function FilingsPage() {
  const { workflow } = useStore();
  const { calcs, t } = useCalc();
  return (
    <div>
      <FlowBar />
      <div className="callout" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          Group top-up {eur(t.topUp)}. Central filing relieves local GIR where conditions are met.
          {workflow.girExported ? " GIR pack is exported." : " Export the GIR pack before local filing."}
          {workflow.snapshotApproved ? " Snapshot approved." : ""}
        </div>
        <div className="stack-actions">
          <Link href="/gir" className="btn btn-secondary">GIR</Link>
          <Link href="/notifications" className="btn btn-secondary">Notifications</Link>
          <Link href="/approvals" className="btn btn-primary">Approvals</Link>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head"><h4>Global filing matrix</h4></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Country</th><th>Requirement</th><th>Deadline</th><th>Countdown</th><th>Status</th><th>Top-up</th><th>Preparer</th><th>Reviewer</th><th>Filed</th></tr></thead>
            <tbody>
              {FILINGS.map((f) => {
                const c = calcs.find((x) => x.name === f.jurisdiction);
                const status = f.central && workflow.girExported ? "Covered — GIR exported" : workflow.snapshotApproved && f.status === "Preparing" ? "Ready for reviewer" : f.status;
                return (
                  <tr key={f.id}>
                    <td>{f.jurisdiction}</td>
                    <td>{f.requirement}{f.central ? " · central" : ""}</td>
                    <td>{f.deadline}</td>
                    <td>{days(f.deadline)}d</td>
                    <td><span className="status-prep">{status}</span></td>
                    <td className="num">{c ? eur(c.jurisdictionalTopUp, true) : "—"}</td>
                    <td>{f.preparer}</td>
                    <td>{f.reviewer}</td>
                    <td>{f.filed ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

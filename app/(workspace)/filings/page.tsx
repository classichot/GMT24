"use client";

import { FILINGS } from "@/lib/model";

function days(deadline: string) {
  const d = (new Date(deadline).getTime() - new Date("2026-08-13").getTime()) / 86400000;
  return Math.round(d);
}

export default function FilingsPage() {
  return (
    <div className="panel">
      <div className="panel-head"><h4>Global filing matrix</h4><span className="text-muted">Central filing relieves local GIR where conditions are met</span></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Country</th><th>Requirement</th><th>Deadline</th><th>Countdown</th><th>Status</th><th>Preparer</th><th>Reviewer</th><th>Filed</th></tr></thead>
          <tbody>
            {FILINGS.map((f) => (
              <tr key={f.id}>
                <td>{f.jurisdiction}</td>
                <td>{f.requirement}{f.central ? " · central" : ""}</td>
                <td>{f.deadline}</td>
                <td>{days(f.deadline)}d</td>
                <td><span className="status-prep">{f.status}</span></td>
                <td>{f.preparer}</td>
                <td>{f.reviewer}</td>
                <td>{f.filed ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

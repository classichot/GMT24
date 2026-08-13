"use client";

import { FILES } from "@/lib/model";

export default function EvidencePage() {
  return (
    <div className="panel">
      <div className="panel-head"><h4>Evidence locker</h4><span className="text-muted">Immutable access log · encryption at rest (prototype flag)</span></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Document</th><th>Kind</th><th>Linked calc</th><th>Access</th></tr></thead>
          <tbody>
            {FILES.map((f) => (
              <tr key={f.id}>
                <td>{f.name}</td>
                <td>{f.kind}</td>
                <td>FY2026 snapshot 2026.2</td>
                <td>Logged · {f.by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

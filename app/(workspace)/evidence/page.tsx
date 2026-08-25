"use client";

import Link from "next/link";
import { FILES } from "@/lib/model";
import { useStore } from "@/lib/store";

export default function EvidencePage() {
  const { historyEvents, historyImmutable, historyChainOk } = useStore();
  return (
    <div>
      <div className="callout" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Evidence locker</strong> is the source-file list. The chronicle — docs, changes, calculations, user actions and comments — lives in Evidence history.
          {historyImmutable ? " That log is sealed (append-only)." : " That log is writable."} Chain {historyChainOk ? "intact" : "broken"} · {historyEvents.length} rows.
        </div>
        <Link href="/evidence-history" className="btn btn-primary">Evidence history</Link>
      </div>
      <div className="panel">
        <div className="panel-head"><h4>Evidence locker</h4><span className="text-muted">Access logged on the chronicle</span></div>
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
    </div>
  );
}

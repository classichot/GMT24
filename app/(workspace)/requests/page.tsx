"use client";

import { ISSUES } from "@/lib/model";
import { useStore } from "@/lib/store";

export default function RequestsPage() {
  const { flash, mode, workflow, patchWorkflow } = useStore();
  const blocks = ISSUES.filter((i) => i.severity !== "info");
  return (
    <div>
      <div className="callout" style={{ marginBottom: 20 }}>
        <strong>AI Data Gap Hunter.</strong> GMT24 will not invent missing deferred tax or payroll. It names the gap, the entity, and drafts the request to local finance.
        {mode === "advisor" ? " In Advisor mode the request is sent as a client PBC item." : " In In-house mode it routes to the local tax / finance owner."}
      </div>
      {blocks.map((i) => (
        <div key={i.id} className="panel" style={{ marginBottom: 12 }}>
          <div className="panel-head">
            <div>
              <h5 style={{ margin: 0 }}>{i.title}</h5>
              <div className="text-muted" style={{ fontSize: 12 }}>To: {i.owner} · {i.jurisdiction}</div>
            </div>
            <button className="btn btn-primary" onClick={() => { patchWorkflow({ sentRequests: { [i.id]: true } }); flash(`Request queued to ${i.owner}`); }}>
              {workflow.sentRequests[i.id] ? "Sent" : "Send request"}
            </button>
          </div>
          <div className="panel-body" style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
            {`Please provide the following for FY2026 Pillar Two:\n\n${i.detail}\n\nNeeded to complete GloBE / covered tax / SBIE. Upload to GMT24 Data Hub (XLSX or PDF).`}
          </div>
        </div>
      ))}
    </div>
  );
}

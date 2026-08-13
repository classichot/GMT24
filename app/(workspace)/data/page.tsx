"use client";

import { FILES } from "@/lib/model";
import { useStore } from "@/lib/store";

export default function DataHubPage() {
  const { flash } = useStore();
  return (
    <div>
      <div
        className="dropzone"
        style={{ marginBottom: 20 }}
        onClick={() => flash("Prototype: files are already ingested into the canonical Pillar Two data model. Connectors (SAP / Oracle / NetSuite) are stubbed.")}
      >
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18 }}>Drop XLSX, CSV or PDF</div>
        <p className="text-muted" style={{ margin: "8px auto 0", maxWidth: "54ch" }}>
          Trial balance, consolidation, tax provision, CbCR, tax return, fixed-asset register, payroll, deferred tax, legal entity list, TP report, BOI certificates, prior GIR.
        </p>
      </div>
      <div className="panel">
        <div className="panel-head"><h4>Ingested sources</h4><span className="tag tag-accent">{FILES.length} files</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>File</th><th>Kind</th><th>Entity</th><th>Rows</th><th>Uploaded</th><th>By</th><th>Status</th></tr></thead>
            <tbody>
              {FILES.map((f) => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  <td>{f.kind}</td>
                  <td>{f.entity ?? "Group"}</td>
                  <td>{f.rows ?? "—"}</td>
                  <td>{f.uploaded}</td>
                  <td>{f.by}</td>
                  <td><span className="status-prep">{f.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

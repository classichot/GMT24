"use client";

import Link from "next/link";
import { GIR_SECTIONS } from "@/lib/model";
import { useStore } from "@/lib/store";
import { eur } from "@/lib/format";
import { FlowBar } from "@/components/FlowBar";
import { useCalc } from "@/lib/useCalc";

export default function GirPage() {
  const { flash, workflow, patchWorkflow, group } = useStore();
  const { t } = useCalc();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<GIR xmlns="urn:oecd:ties:gir:v1" version="2026.1">
  <MessageSpec>
    <SendingCompanyIN>JP-UPE</SendingCompanyIN>
    <MessageType>GIR</MessageType>
    <ReportingPeriod>2026-04-01/2027-03-31</ReportingPeriod>
  </MessageSpec>
  <MneGroup>
    <UPE>${group.upe}</UPE>
    <TopUpTax currCode="USD">${t.topUp}</TopUpTax>
  </MneGroup>
</GIR>`;
  return (
    <div>
      <FlowBar />
      <div className="callout" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>GIR Autopilot</strong> — calculation → GIR fields → XML → schema validation → reviewer → filing pack.
          Group top-up {eur(t.topUp)}. {workflow.girValidated ? "Schema validated." : "Not yet validated."} {workflow.girExported ? "Pack exported." : ""}
        </div>
        <div className="stack-actions">
          <button className="btn btn-secondary" onClick={() => { patchWorkflow({ girValidated: true }); flash("Schema validation passed · 0 errors, 2 warnings (VN DTA)"); }}>Validate XML</button>
          <button className="btn btn-primary" onClick={() => { patchWorkflow({ girExported: true }); flash("GIR pack exported (XML + PDF + evidence zip)"); }}>Export pack</button>
          <Link href="/elections" className="btn btn-secondary">Elections</Link>
          <Link href="/filings" className="btn btn-secondary">Filing matrix</Link>
          <Link href="/approvals" className="btn btn-secondary">Approvals</Link>
        </div>
      </div>
      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><h4>Sections</h4></div>
          {GIR_SECTIONS.map((s) => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--color-divider)" }}>
              <div>
                <strong>{s.id}. {s.title}</strong>
                <div className="text-muted" style={{ fontSize: 12 }}>{s.fields} fields · {s.missing} missing</div>
              </div>
              <div className="stack-actions">
                {s.id === "D" && <Link href="/elections" className="btn btn-ghost">Election engine</Link>}
                <span className="status-prep">{s.id === "C" ? `Top-up ${eur(t.topUp, true)}` : s.status}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="panel-head"><h4>XML preview</h4><span className="tag tag-accent">schema 2026.1</span></div>
          <pre style={{ margin: 0, padding: 16, fontSize: 12, overflow: "auto", background: "var(--color-surface)" }}>{xml}</pre>
        </div>
      </div>
    </div>
  );
}

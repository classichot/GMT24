"use client";

import Link from "next/link";
import { GIR_SECTIONS } from "@/lib/model";
import { useStore } from "@/lib/store";
import { eur } from "@/lib/format";
import { FlowBar } from "@/components/FlowBar";
import { useCalc } from "@/lib/useCalc";
import { buildGirPackage, downloadGir } from "@/lib/gir";

export default function GirPage() {
  const { flash, workflow, patchWorkflow, group, electionsOn, activeFy } = useStore();
  const { t, calcs } = useCalc();
  const pkg = buildGirPackage({ group, calcs, electionsOn, activeFy });
  const validate = () => {
    if (!pkg.validation.valid) {
      patchWorkflow({ girValidated: false });
      flash(`GIR validation failed · ${pkg.validation.errors.length} errors`);
      return;
    }
    patchWorkflow({ girValidated: true });
    flash(`GIR preflight passed · ${pkg.fieldCount} populated XML elements · official XSD validation still required`);
  };
  const exportXml = () => {
    if (!pkg.validation.valid) {
      flash("Fix GIR validation errors before export");
      return;
    }
    downloadGir(pkg, `${group.id}-${activeFy}-GIR-v1.0.xml`);
    patchWorkflow({ girExported: true });
    flash("Snapshot-driven GIR XML downloaded and evidence event sealed");
  };
  return (
    <div>
      <FlowBar />
      <div className="callout" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>GIR Autopilot</strong> — the current entities, jurisdictional blends, safe-harbour results, elections and QDMTT/IIR/UTPR collection now populate the OECD GIR exchange structure.
          Group top-up {eur(t.topUp)}. {workflow.girValidated ? "Current package passed GMT24 preflight." : "Run preflight."} {workflow.girExported ? " XML exported." : ""}
        </div>
        <div className="stack-actions">
          <button className="btn btn-secondary" onClick={validate}>Run preflight</button>
          <button className="btn btn-primary" onClick={exportXml}>Download XML</button>
          <Link href="/elections" className="btn btn-secondary">Elections</Link>
          <Link href="/filings" className="btn btn-secondary">Filing matrix</Link>
          <Link href="/approvals" className="btn btn-secondary">Approvals</Link>
        </div>
      </div>
      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><h4>Live GIR sections</h4><span className={pkg.validation.valid ? "status-done" : "status-block"}>{pkg.validation.valid ? "Ready" : `${pkg.validation.errors.length} errors`}</span></div>
          {GIR_SECTIONS.map((s) => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--color-divider)" }}>
              <div>
                <strong>{s.id}. {s.title}</strong>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  {s.id === "A" && `${pkg.fieldCount} populated XML elements · ${pkg.messageRefId}`}
                  {s.id === "B" && `${pkg.entityCount} live entities/JV members`}
                  {s.id === "C" && `${pkg.jurisdictionCount} jurisdictional blends · ${eur(t.topUp)} top-up`}
                  {s.id === "D" && `${Object.values(electionsOn).filter(Boolean).length} elected switches · collection reconciled`}
                </div>
              </div>
              <div className="stack-actions">
                {s.id === "D" && <Link href="/elections" className="btn btn-ghost">Election engine</Link>}
                <span className="status-prep">{s.id === "C" ? `Top-up ${eur(t.topUp, true)}` : "Populated"}</span>
              </div>
            </div>
          ))}
          <div className="panel-body">
            <strong>Validation profile</strong>
            <div className="text-muted" style={{ fontSize: 12, margin: "4px 0 10px" }}>{pkg.schema}</div>
            {pkg.validation.checks.map((check) => (
              <div key={check.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderTop: "1px solid var(--color-divider)" }}>
                <span>{check.label}</span>
                <span className={check.pass ? "status-done" : "status-block"}>{check.pass ? "Pass" : "Fail"}</span>
              </div>
            ))}
            {pkg.validation.warnings.map((warning) => <p key={warning} className="text-muted" style={{ fontSize: 11, margin: "8px 0 0" }}>Warning · {warning}</p>)}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h4>XML preview</h4><span className="tag tag-accent">GLOBEXML v1.0 · namespace v2</span></div>
          <pre style={{ margin: 0, padding: 16, fontSize: 12, overflow: "auto", maxHeight: 760, background: "var(--color-surface)" }}>{pkg.xml}</pre>
        </div>
      </div>
    </div>
  );
}

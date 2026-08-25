"use client";

import { FILES } from "@/lib/model";
import { useStore } from "@/lib/store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StartEngage } from "@/components/StartEngage";

export default function DataHubPage() {
  const { flash, group, mode } = useStore();
  const router = useRouter();
  const onboarding = Boolean(group.custom);
  return (
    <div>
      {onboarding && (
        <div className="callout" style={{ marginBottom: 16 }}>
          <strong>{group.name}</strong> has no posted close pack yet. Drop the entity list, consolidation, tax provision and CbCR. The engine will not calculate this file until mappings are approved.{" "}
          {mode === "advisor" && <Link href="/onboard">Back to New engagement</Link>}
        </div>
      )}
      <div
        className="dropzone"
        style={{ marginBottom: 20 }}
        onClick={() => {
          if (onboarding) {
            flash("Drop queued for classification. Mapping opens after the pack scores.");
            return;
          }
          flash("Files already in the canonical model. Opening mapping.");
          router.push("/mapping");
        }}
      >
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18 }}>Drop XLSX, CSV or PDF</div>
        <p className="text-muted" style={{ margin: "8px auto 0", maxWidth: "54ch" }}>
          Trial balance, consolidation, tax provision, CbCR, tax return, fixed-asset register, payroll, deferred tax, legal entity list, TP report, BOI certificates, prior GIR.
        </p>
      </div>
      <div className="stack-actions" style={{ marginBottom: 16 }}>
        <Link href="/mapping" className="btn btn-primary">Account mapping</Link>
        <Link href="/quality" className="btn btn-secondary">Data quality</Link>
        <Link href="/evidence" className="btn btn-secondary">Evidence locker</Link>
        <Link href="/evidence-history" className="btn btn-secondary">Evidence history</Link>
        {mode === "advisor" && <StartEngage />}
      </div>
      <div className="panel">
        <div className="panel-head">
          <h4>Ingested sources</h4>
          <span className="tag tag-accent">{onboarding ? "0 files" : `${FILES.length} files`}</span>
        </div>
        {onboarding ? (
          <div className="panel-body">
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
              Empty pack. Required: legal entity list, consolidation, trial balance, tax provision, CbCR.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>File</th><th>Kind</th><th>Entity</th><th>Rows</th><th>Uploaded</th><th>By</th><th>Status</th></tr></thead>
              <tbody>
                {FILES.map((f) => (
                  <tr key={f.id} className="clickable" onClick={() => router.push("/mapping")}>
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
        )}
      </div>
    </div>
  );
}

"use client";

import { FILES } from "@/lib/model";
import { useStore } from "@/lib/store";
import { INGEST_QUEUE, SAMPLE_DOWNLOADS, classifyDroppedName } from "@/lib/ingestSim";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { StartEngage } from "@/components/StartEngage";

export default function DataHubPage() {
  const {
    flash,
    group,
    mode,
    ingestStatus,
    ingestProgress,
    loadDemoPack,
    resetIngest,
    noteFileDrop,
  } = useStore();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const onboarding = Boolean(group.custom);
  const packReady = ingestStatus === "ready";
  const packRunning = ingestStatus === "running";

  const onFiles = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return;
      const names = Array.from(list).map((f) => f.name);
      names.forEach((n) => noteFileDrop(n));
      const kinds = names.map(classifyDroppedName);
      flash(
        names.length === 1
          ? `${names[0]} queued (${kinds[0]}). Load the full demo pack to post all ${FILES.length} sources.`
          : `${names.length} files queued. Load the full demo pack to classify and map the teaching snapshot.`,
      );
    },
    [flash, noteFileDrop],
  );

  return (
    <div>
      {!packReady && !packRunning && (
        <div className="callout" style={{ marginBottom: 16 }}>
          <strong>Reviewer path:</strong> download sample CSVs below or load the Aetherion FY2026 close pack. The engine waits for mapped source data.{" "}
          <Link href="/review-guide">Open review guide →</Link>
        </div>
      )}
      {onboarding && (
        <div className="callout" style={{ marginBottom: 16 }}>
          <strong>{group.name}</strong> has no posted close pack yet. Drop the entity list, consolidation, tax provision and CbCR. The engine will not calculate this file until mappings are approved.{" "}
          {mode === "advisor" && <Link href="/onboard">Back to New engagement</Link>}
        </div>
      )}
      <div
        className={`dropzone${drag ? " on" : ""}`}
        style={{ marginBottom: 20 }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".xlsx,.csv,.pdf,.xml"
          style={{ display: "none" }}
          onChange={(e) => onFiles(e.target.files)}
        />
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18 }}>
          {packRunning ? "Classifying close pack…" : "Drop XLSX, CSV or PDF"}
        </div>
        <p className="text-muted" style={{ margin: "8px auto 0", maxWidth: "54ch" }}>
          Trial balance, consolidation, tax provision, CbCR, tax return, fixed-asset register, payroll, deferred tax, legal entity list, TP report, BOI certificates, prior GIR.
        </p>
        {packRunning && ingestProgress && (
          <div style={{ marginTop: 16, maxWidth: 480, marginInline: "auto" }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>
              {ingestProgress.current} / {ingestProgress.total} · {ingestProgress.file}
            </div>
            <div style={{ height: 6, background: "var(--color-divider)", border: "1px solid var(--color-divider)" }}>
              <div
                style={{
                  height: "100%",
                  width: ingestProgress.total ? `${(ingestProgress.current / ingestProgress.total) * 100}%` : "8%",
                  background: "var(--color-accent)",
                  transition: "width 0.15s ease",
                }}
              />
            </div>
          </div>
        )}
      </div>
      <div className="stack-actions" style={{ marginBottom: 16 }}>
        {!packReady && !packRunning && (
          <button type="button" className="btn btn-primary" onClick={() => loadDemoPack()}>
            Load Aetherion FY2026 close pack ({INGEST_QUEUE.length} files)
          </button>
        )}
        {packReady && (
          <>
            <Link href="/mapping" className="btn btn-primary">Account mapping</Link>
            <button type="button" className="btn btn-secondary" onClick={() => resetIngest()}>
              Reset ingest (reviewer)
            </button>
          </>
        )}
        <Link href="/review-guide" className="btn btn-secondary">Review guide</Link>
        <Link href="/quality" className="btn btn-secondary">Data quality</Link>
        <Link href="/evidence" className="btn btn-secondary">Evidence locker</Link>
        <Link href="/evidence-history" className="btn btn-secondary">Evidence history</Link>
        {mode === "advisor" && <StartEngage />}
      </div>

      {!packReady && !packRunning && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <h4>Sample files for ingest test</h4>
            <span className="tag tag-outline">Download then drop above</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>File</th><th>Kind</th><th>Note</th><th></th></tr></thead>
              <tbody>
                {SAMPLE_DOWNLOADS.map((f) => (
                  <tr key={f.href}>
                    <td>{f.name}</td>
                    <td>{f.kind}</td>
                    <td className="text-muted" style={{ fontSize: 12 }}>{f.note}</td>
                    <td><a href={f.href} download className="btn btn-ghost">Download</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h4>Ingested sources</h4>
          <span className="tag tag-accent">{packReady ? `${FILES.length} files` : packRunning ? "Ingesting…" : "0 files"}</span>
        </div>
        {!packReady ? (
          <div className="panel-body">
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
              {packRunning
                ? "Classification in progress. Mapping opens when the pack scores."
                : "Empty pack. Required: legal entity list, consolidation, trial balance, tax provision, CbCR — or load the demo close pack."}
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

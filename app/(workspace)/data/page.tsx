"use client";

import { DATA } from "@/lib/model";
import { useStore } from "@/lib/store";
import { ingestQueue, sampleDownloads, classifyDroppedName } from "@/lib/ingestSim";
import { reviewDataset, type SlotStatus } from "@/lib/datasetGuideline";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { StartEngage } from "@/components/StartEngage";

const STATUS_TAG: Record<SlotStatus, string> = {
  posted: "tag-ok",
  queued: "tag-accent",
  incomplete: "tag-warn",
  missing: "tag-hot",
};

const STATUS_LABEL: Record<SlotStatus, string> = {
  posted: "Posted",
  queued: "Queued",
  incomplete: "Incomplete",
  missing: "Missing",
};

const FILTERS: { id: "all" | "required" | "missing" | "incomplete"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "required", label: "Required to calculate" },
  { id: "missing", label: "Missing" },
  { id: "incomplete", label: "Incomplete" },
];

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
    queuedDrops,
    ask,
  } = useStore();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const onboarding = Boolean(group.custom);
  const packReady = ingestStatus === "ready";
  const packRunning = ingestStatus === "running";

  const R = useMemo(
    () => reviewDataset(packReady ? DATA.files : null, queuedDrops, DATA.issues),
    [packReady, queuedDrops],
  );
  const rows = R.items.filter((i) => {
    if (filter === "required") return i.slot.need === "required";
    if (filter === "missing") return i.status === "missing" || i.status === "queued";
    if (filter === "incomplete") return i.status === "incomplete";
    return true;
  });

  const onFiles = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return;
      const names = Array.from(list).map((f) => f.name);
      names.forEach((n) => noteFileDrop(n));
      const kinds = names.map(classifyDroppedName);
      flash(
        names.length === 1
          ? `${names[0]} queued as ${kinds[0]}. The dataset guideline updates completion.`
          : `${names.length} files queued. Dataset guideline scores them against the required close-pack list.`,
      );
    },
    [flash, noteFileDrop],
  );

  return (
    <div>
      {!packReady && !packRunning && (
        <div className="callout" style={{ marginBottom: 16 }}>
          <strong>Reviewer path:</strong> download sample CSVs below or load the {DATA.demo.packName}. The engine waits for mapped source data.{" "}
          <Link href="/review-guide">Open review guide →</Link>
        </div>
      )}
      {onboarding && (
        <div className="callout" style={{ marginBottom: 16 }}>
          <strong>{group.name}</strong> has no posted close pack yet. Drop the entity list, consolidation, tax provision and CbCR. The engine will not calculate this file until mappings are approved.{" "}
          {mode === "advisor" && <Link href="/onboard">Back to New engagement</Link>}
        </div>
      )}

      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Dataset guideline.</strong> {R.suggestion}
        </div>
        <div className="stack-actions">
          <button className="btn btn-primary" type="button" onClick={() => ask("What documents are missing from the close pack, and how complete is the dataset for the GloBE calculation?")}>
            Ask GMT24
          </button>
          <Link href="/requests" className="btn btn-secondary">Gap Hunter</Link>
          <Link href="/playbook/data" className="btn btn-secondary">Playbook</Link>
        </div>
      </div>

      <div className="kpi-grid cols-4" style={{ marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Dataset completion</div>
          <div className="kpi-val">{R.completion}%</div>
          <div className="kpi-sub">{R.headline}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Required to calculate</div>
          <div className="kpi-val" style={{ fontSize: 22 }}>{R.required.posted + R.required.incomplete}/{R.required.total}</div>
          <div className="kpi-sub">
            {R.required.missing} missing · {R.required.incomplete} incomplete{R.required.queued ? ` · ${R.required.queued} queued` : ""}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Recommended overlays</div>
          <div className="kpi-val" style={{ fontSize: 22 }}>{R.recommended.posted + R.recommended.incomplete}/{R.recommended.total}</div>
          <div className="kpi-sub">{R.recommended.missing} still open · harbours, incentives, PE, FX</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Can calculate</div>
          <div className="kpi-val" style={{ fontSize: 22 }}>{R.canCalculate ? "Yes" : "Not yet"}</div>
          <div className="kpi-sub">{R.canCalculate ? "Required sources are on file. Approve mappings before lock." : "Add the missing required sources first."}</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h4>Close-pack checklist</h4>
          <div className="stack-actions">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className={`btn ${filter === f.id ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(f.id)}>{f.label}</button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Need</th>
                <th>Needed for</th>
                <th>Pin</th>
                <th>Status</th>
                <th>On file / AI note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.slot.id} className="clickable" onClick={() => router.push(i.slot.href)}>
                  <td>
                    <strong>{i.slot.title}</strong>
                    <div className="text-muted" style={{ fontSize: 11 }}>{i.slot.kind}</div>
                  </td>
                  <td>
                    <span className={`tag ${i.slot.need === "required" ? "tag-accent" : "tag-outline"}`}>
                      {i.slot.need === "required" ? "Required" : "Recommended"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, maxWidth: 320 }}>{i.slot.why}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{i.slot.oecd}</td>
                  <td><span className={`tag ${STATUS_TAG[i.status]}`}>{STATUS_LABEL[i.status]}</span></td>
                  <td style={{ fontSize: 12 }}>
                    {i.files.length > 0 && <div style={{ marginBottom: 4 }}>{i.files.join(" · ")}</div>}
                    <span className="text-muted">{i.note}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {R.nextDrops.length > 0 && (
          <div className="panel-body" style={{ borderTop: "1px solid var(--color-divider)" }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>AI next drops</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {R.nextDrops.map((d) => (
                <li key={d.title} style={{ marginBottom: 6 }}>
                  <strong>{d.title}</strong>
                  <span className={`tag ${d.need === "required" ? "tag-hot" : "tag-outline"}`} style={{ marginLeft: 8, fontSize: 10 }}>{d.need}</span>
                  <div className="text-muted" style={{ marginTop: 2 }}>{d.why}</div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

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
          Match the checklist above: trial balance, consolidation, tax provision, CbCR, payroll, fixed-asset register, certificates, prior GIR.
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
            Load {DATA.demo.packName} ({ingestQueue().length} files)
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
                {sampleDownloads().map((f) => (
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
          <span className="tag tag-accent">{packReady ? `${DATA.files.length} files` : packRunning ? "Ingesting…" : `${queuedDrops.length} queued`}</span>
        </div>
        {!packReady ? (
          <div className="panel-body">
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
              {packRunning
                ? "Classification in progress. Mapping opens when the pack scores."
                : queuedDrops.length
                  ? `Queued: ${queuedDrops.join(", ")}. Required still missing are listed on the dataset guideline.`
                  : "Empty pack. The dataset guideline lists the eight required sources. Load the demo close pack or drop files above."}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>File</th><th>Kind</th><th>Entity</th><th>Rows</th><th>Uploaded</th><th>By</th><th>Status</th></tr></thead>
              <tbody>
                {DATA.files.map((f) => (
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

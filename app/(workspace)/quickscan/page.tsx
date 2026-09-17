"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useAi, type DiscoverOutcome, type ScanProgress } from "@/components/AiProvider";
import { ScanRunner } from "@/components/scan/ScanRunner";
import { ScanView } from "@/components/scan/ScanView";
import { periodsFor, resolveEntity } from "@/lib/scan/pipeline";

export default function QuickScanPage() {
  const ai = useAi();
  const { flash, mode } = useStore();
  const [current, setCurrent] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [outcome, setOutcome] = useState<DiscoverOutcome | null>(null);
  const abort = useRef<AbortController | null>(null);
  const scan = ai.scans.find((s) => s.id === current) ?? ai.scans[0] ?? null;
  const periods = useMemo(() => (scan?.resolved ? periodsFor(scan.resolved.registryId) : []), [scan]);

  const run = (query: string, opts: { registryId?: string; period?: string }) => {
    setOutcome(null);
    const r = ai.runScan(query, opts);
    setCurrent(r.id);
    if (!r.exposure.length) flash(r.stages.find((s) => s.status === "failed")?.note ?? "Scan could not complete");
  };

  const settle = (o: DiscoverOutcome) => {
    setProgress(null);
    setOutcome(o);
    if (o.kind === "scan") { setCurrent(o.scan.id); if (!o.scan.exposure.length) flash(o.scan.stages.find((s) => s.status === "failed")?.note ?? "Scan completed with gaps — see the stages"); }
    else if (o.kind === "error") flash(o.message);
  };
  const discover = async (query: string, period?: string, url?: string) => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setOutcome(null);
    setProgress({ stage: "discover", detail: query });
    settle(await ai.discoverScan(query, { period, url, onProgress: setProgress, signal: ctl.signal }));
  };
  const cancel = () => { abort.current?.abort(); setProgress(null); };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="callout" style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <strong>Quick Scan discovers. X-Ray obtains the facts. The engine calculates.</strong>
          <div className="text-muted" style={{ marginTop: 4 }}>Enter a group and get a preliminary exposure map from its public disclosures: scope, structure, jurisdictions, incentives, the company&apos;s own Pillar Two statements — each finding with its basis, source page and what would change it. Nothing here is a top-up calculation.</div>
        </div>
        <div className="stack-actions" style={{ fontSize: 12 }}>
          <Link href="/playbook/copilot" className="btn btn-secondary">Playbook</Link>
          <Link href="/scan" className="btn btn-ghost">Public scan page</Link>
          <Link href="/xray" className="btn btn-ghost">Pillar Two X-Ray</Link>
        </div>
      </div>

      <ScanRunner
        onRun={run}
        onDiscover={(q, p) => void discover(q, p)}
        onPickSource={(url, q, p) => void discover(q, p, url)}
        onCancel={cancel}
        progress={progress}
        outcome={outcome}
        periods={periods}
        lastPeriod={scan?.period ?? null}
        uploading={uploading || !!progress}
        onUpload={async (file, period) => {
          setUploading(true);
          const a = await ai.attach(file);
          setUploading(false);
          if (!a) return;
          const res = resolveEntity(file.name.replace(/[-_.]/g, " "));
          if (res.resolved) {
            // A demo-corpus report: keep the corpus path so the two sources are compared, as before.
            const r = ai.runScan(res.resolved.name, { attachmentId: a.id, period: period || undefined, registryId: res.resolved.registryId });
            setCurrent(r.id);
            return;
          }
          abort.current?.abort();
          const ctl = new AbortController();
          abort.current = ctl;
          setOutcome(null);
          setProgress({ stage: "structure", detail: a.name });
          settle(await ai.uploadScan(a.id, { period: period || undefined, onProgress: setProgress, signal: ctl.signal }));
        }}
      />

      {ai.scans.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 12 }}>
          <span className="text-muted">Scans in this workspace:</span>
          {ai.scans.map((s) => <button key={s.id} className={`chip${scan?.id === s.id ? " active" : ""}`} style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setCurrent(s.id)}>{s.resolved?.name ?? s.query} · {s.period}</button>)}
          {scan && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { ai.deleteScan(scan.id); setCurrent(null); }}>Delete this scan</button>}
        </div>
      )}

      {scan && (
        <ScanView
          scan={scan}
          others={ai.scans}
          actor={ai.ctx.user.name}
          signedIn
          onAnswer={(qid, v) => ai.answerScan(scan.id, qid, v)}
          onCorrect={(c) => ai.correctScan(scan.id, c)}
          onPeriod={(period) => { if (scan.resolved) run(scan.resolved.name, { registryId: scan.resolved.registryId, period }); }}
          onOnboard={() => { const err = ai.onboard(scan.id); if (err) flash(err); }}
          onboardLabel={mode === "advisor" ? "Create engagement from this scan (proposed data)" : "Import into this workspace as proposed data"}
        />
      )}

      {!scan && (
        <div className="panel"><div className="panel-body text-muted" style={{ fontSize: 13 }}>
          No scan yet. Enter any listed group&apos;s name (Thai or English) and Quick Scan finds its official disclosures, reads the latest report with the model and assesses it — or upload an annual report to run the same pipeline on your own copy. Names in the demonstration corpus are labelled as such.
        </div></div>
      )}
    </div>
  );
}

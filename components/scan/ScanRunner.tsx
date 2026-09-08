"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, Search } from "lucide-react";
import { registryList, resolveEntity, STAGE_LABEL, STAGE_ORDER } from "@/lib/scan/pipeline";
import type { ResolvedEntity } from "@/lib/scan/types";

/**
 * Entry form for a Quick Scan: company name (Thai / English / ticker / former
 * name / subsidiary), optional period, optional uploaded report. Shows the
 * resolution step first so the user confirms the legal entity, then the seven
 * stages as the scan progresses.
 */
export function ScanRunner({ onRun, onUpload, uploading, periods, lastPeriod, compactHint }: {
  onRun: (query: string, opts: { registryId?: string; period?: string }) => void;
  onUpload?: (file: File, period: string) => void;
  uploading?: boolean;
  periods?: string[];
  lastPeriod?: string | null;
  compactHint?: boolean;
}) {
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<string>("");
  const [res, setRes] = useState<ReturnType<typeof resolveEntity> | null>(null);
  const [running, setRunning] = useState<number>(-1);
  const file = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { if (q.trim().length >= 3) setRes(resolveEntity(q)); else setRes(null); }, [q]);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const start = (registryId?: string) => {
    if (!q.trim() && !registryId) return;
    setRunning(0);
    let i = 0;
    timer.current = setInterval(() => {
      i += 1;
      setRunning(i);
      if (i >= STAGE_ORDER.length) { if (timer.current) clearInterval(timer.current); onRun(q.trim() || registryId!, { registryId, period: period || undefined }); setRunning(-1); }
    }, 260);
  };

  const pick = (r: ResolvedEntity) => { setQ(r.name); start(r.registryId); };

  return (
    <div className="panel">
      <div className="panel-body" style={{ display: "grid", gap: 12 }}>
        <form style={{ display: "flex", gap: 8, flexWrap: "wrap" }} onSubmit={(e) => { e.preventDefault(); if (res?.resolved) start(res.resolved.registryId); else if (res?.ambiguous) { /* choose below */ } else start(); }}>
          <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 14, color: "var(--color-neutral-500)" }} />
            <input className="input" style={{ paddingLeft: 36 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Company name — Thai or English, ticker, former name, or a subsidiary…" aria-label="Company name" />
          </div>
          {periods && periods.length > 0 && (
            <select className="input" style={{ width: "auto" }} value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Reporting period">
              <option value="">Latest period</option>
              {periods.map((p) => <option key={p}>{p}</option>)}
            </select>
          )}
          <button className="btn btn-primary" type="submit" disabled={running >= 0 || (!q.trim())}>Run Quick Scan</button>
          {onUpload && (
            <>
              <input ref={file} type="file" hidden accept=".pdf,.txt,.csv,.md" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f, period || lastPeriod || "FY2025"); e.target.value = ""; }} />
              <button type="button" className="btn btn-secondary" onClick={() => file.current?.click()} disabled={uploading}><Paperclip size={14} />{uploading ? "Reading…" : "Upload annual report"}</button>
            </>
          )}
        </form>

        {res && running < 0 && (
          <div style={{ fontSize: 12 }}>
            {res.resolved && (
              <div className="callout" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <strong>{res.resolved.name}</strong>{res.resolved.nameTh ? ` · ${res.resolved.nameTh}` : ""} <span className="text-muted">· {res.resolved.exchange}{res.resolved.ticker ? `: ${res.resolved.ticker}` : ""} · UPE in {res.resolved.upeIso}</span>
                  <div className="text-muted">{res.note}</div>
                </div>
                <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => start(res.resolved!.registryId)}>Scan this group</button>
              </div>
            )}
            {res.ambiguous && (
              <div className="callout">
                <div style={{ marginBottom: 6 }}>{res.note}</div>
                <div className="stack-actions">{res.alternatives.map((a) => <button key={a.registryId} className="chip" style={{ fontSize: 12 }} onClick={() => pick(a)}>{a.name} <span className="text-muted">· {a.matchedOn}</span></button>)}</div>
              </div>
            )}
            {!res.resolved && !res.ambiguous && (
              <div className="callout" style={{ borderLeftColor: "var(--color-warn)" }}>{res.note}{onUpload ? " Use Upload annual report to scan it from the document." : ""}</div>
            )}
          </div>
        )}

        {running >= 0 && (
          <div className="scan-stages">
            {STAGE_ORDER.map((id, i) => <div key={id} className={`scan-stage ${i < running ? "done" : i === running ? "running" : ""}`}><div className="k">{i + 1} · {i < running ? "done" : i === running ? "running" : "pending"}</div><div style={{ fontWeight: 700, marginTop: 2 }}>{STAGE_LABEL[id]}</div></div>)}
          </div>
        )}

        {!compactHint && running < 0 && !q && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 12 }}>
            <span className="text-muted">Try:</span>
            {registryList().map((r) => <button key={r.id} className="chip" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => { setQ(r.name); start(r.id); }}>{r.name}</button>)}
            <button className="chip" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setQ("Verdant Vietnam")}>a subsidiary name</button>
            <button className="chip" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setQ("สยามเวอร์แดนท์")}>ชื่อไทย</button>
          </div>
        )}
      </div>
    </div>
  );
}

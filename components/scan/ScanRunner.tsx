"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Globe, Paperclip, Search, Square } from "lucide-react";
import { registryList, resolveEntity } from "@/lib/scan/pipeline";
import type { ResolvedEntity } from "@/lib/scan/types";
import type { DiscoverOutcome, ScanProgress } from "@/components/AiProvider";

/**
 * Entry form for a Quick Scan: company name (Thai / English / ticker / former
 * name / subsidiary), optional period, optional uploaded report. Names in the
 * demonstration registry run against the demo corpus (labelled); any other
 * name is discovered from official public sources and read by the model.
 */
export function ScanRunner({ onRun, onDiscover, onPickSource, onCancel, progress, outcome, onUpload, uploading, periods, lastPeriod, compactHint }: {
  onRun: (query: string, opts: { registryId?: string; period?: string }) => void;
  onDiscover?: (query: string, period?: string) => void;
  onPickSource?: (url: string, query: string, period?: string) => void;
  onCancel?: () => void;
  progress?: ScanProgress | null;
  outcome?: DiscoverOutcome | null;
  onUpload?: (file: File, period: string) => void;
  uploading?: boolean;
  periods?: string[];
  lastPeriod?: string | null;
  compactHint?: boolean;
}) {
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<string>("");
  const [res, setRes] = useState<ReturnType<typeof resolveEntity> | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const busy = !!progress;

  useEffect(() => { if (q.trim().length >= 3) setRes(resolveEntity(q)); else setRes(null); }, [q]);

  const start = (registryId?: string) => { if (!q.trim() && !registryId) return; onRun(q.trim() || registryId!, { registryId, period: period || undefined }); };
  const discover = () => { if (q.trim().length >= 2 && onDiscover) onDiscover(q.trim(), period || undefined); };
  const pick = (r: ResolvedEntity) => { setQ(r.name); onRun(r.name, { registryId: r.registryId, period: period || undefined }); };

  const STAGES: { id: ScanProgress["stage"]; label: string }[] = [{ id: "discover", label: "Find official sources" }, { id: "fetch", label: "Retrieve the report" }, { id: "structure", label: "Read and structure (model)" }, { id: "assess", label: "Match and assess" }];
  const stageIdx = progress ? STAGES.findIndex((s) => s.id === progress.stage) : -1;

  return (
    <div className="panel">
      <div className="panel-body" style={{ display: "grid", gap: 12 }}>
        <form style={{ display: "flex", gap: 8, flexWrap: "wrap" }} onSubmit={(e) => { e.preventDefault(); if (busy) return; if (res?.resolved) start(res.resolved.registryId); else if (res?.ambiguous) { /* choose below */ } else if (onDiscover) discover(); else start(); }}>
          <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 14, color: "var(--color-neutral-500)" }} />
            <input className="input" style={{ paddingLeft: 36 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Company name — any listed group, Thai or English…" aria-label="Company name" disabled={busy} />
          </div>
          {periods && periods.length > 0 && (
            <select className="input" style={{ width: "auto" }} value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Reporting period">
              <option value="">Latest period</option>
              {periods.map((p) => <option key={p}>{p}</option>)}
            </select>
          )}
          <button className="btn btn-primary" type="submit" disabled={busy || !q.trim()}>Run Quick Scan</button>
          {onUpload && (
            <>
              <input ref={file} type="file" hidden accept=".pdf,.txt,.csv,.md" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f, period || lastPeriod || ""); e.target.value = ""; }} />
              <button type="button" className="btn btn-secondary" onClick={() => file.current?.click()} disabled={uploading || busy}><Paperclip size={14} />{uploading ? "Reading…" : "Upload annual report"}</button>
            </>
          )}
        </form>

        {res && !busy && (
          <div style={{ fontSize: 12 }}>
            {res.resolved && (
              <div className="callout" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <strong>{res.resolved.name}</strong>{res.resolved.nameTh ? ` · ${res.resolved.nameTh}` : ""} <span className="text-muted">· {res.resolved.exchange}{res.resolved.ticker ? `: ${res.resolved.ticker}` : ""} · UPE in {res.resolved.upeIso}</span>
                  <div className="text-muted">{res.note} <span className="tag tag-neutral" style={{ fontSize: 10 }}>demonstration corpus</span></div>
                </div>
                <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => start(res.resolved!.registryId)}>Scan this group</button>
                {onDiscover && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={discover}><Globe size={12} />Search public sources instead</button>}
              </div>
            )}
            {res.ambiguous && (
              <div className="callout">
                <div style={{ marginBottom: 6 }}>{res.note}</div>
                <div className="stack-actions">{res.alternatives.map((a) => <button key={a.registryId} className="chip" style={{ fontSize: 12 }} onClick={() => pick(a)}>{a.name} <span className="text-muted">· {a.matchedOn}</span></button>)}</div>
              </div>
            )}
            {!res.resolved && !res.ambiguous && (
              <div className="callout" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>{onDiscover ? <>Not in the demonstration registry. Quick Scan will look for <strong>{q.trim()}</strong>&apos;s official investor-relations, exchange or regulator disclosures and read the latest report.</> : res.note}{onUpload ? " You can also upload the annual report." : ""}</div>
                {onDiscover && <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={discover}><Globe size={12} />Search public sources</button>}
              </div>
            )}
          </div>
        )}

        {busy && (
          <div>
            <div className="scan-stages">
              {STAGES.map((s, i) => <div key={s.id} className={`scan-stage ${i < stageIdx ? "done" : i === stageIdx ? "running" : ""}`}><div className="k">{i + 1} · {i < stageIdx ? "done" : i === stageIdx ? "running" : "pending"}</div><div style={{ fontWeight: 700, marginTop: 2 }}>{s.label}</div>{i === stageIdx && progress?.detail && <div className="text-muted" style={{ fontSize: 11, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{progress.detail}</div>}</div>)}
            </div>
            {onCancel && <button className="btn btn-ghost" style={{ fontSize: 12, marginTop: 8 }} onClick={onCancel}><Square size={11} />Cancel</button>}
          </div>
        )}

        {!busy && outcome && outcome.kind !== "scan" && (
          <div className="callout" style={{ fontSize: 12, borderLeftColor: outcome.kind === "error" ? "var(--color-hot)" : "var(--color-warn)" }}>
            {outcome.kind === "error" && <div><strong>Could not complete the scan.</strong> {outcome.message}</div>}
            {outcome.kind === "none" && <div><strong>No official sources found.</strong> {outcome.message}{outcome.discovery && outcome.discovery.hits > 0 ? ` (${outcome.discovery.hits} search results reviewed.)` : ""}{!outcome.discovery?.searchConfigured ? " No search provider is configured for this deployment; results depend on a keyless fallback." : ""}</div>}
            {outcome.kind === "choose" && (
              <div>
                <div style={{ marginBottom: 6 }}><strong>Choose the source to read.</strong> {outcome.reason}</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {outcome.discovery.candidates.slice(0, 8).map((c) => (
                    <div key={c.url} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span className={`tag ${c.official ? "tag-accent" : "tag-neutral"}`} style={{ fontSize: 10 }}>{c.kind}{c.period ? ` · ${c.period}` : ""}</span>
                      <span style={{ flex: 1, minWidth: 200 }}>{c.title} <span className="text-muted">· {c.domain}</span></span>
                      <a href={c.url} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 6px" }}><ExternalLink size={11} />open</a>
                      {onPickSource && c.isPdf && <button className="btn btn-secondary" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => onPickSource(c.url, q.trim() || outcome.discovery.query, period || undefined)}>Read this</button>}
                    </div>
                  ))}
                </div>
                {outcome.discovery.notes.length > 0 && <div className="text-muted" style={{ marginTop: 6 }}>{outcome.discovery.notes.join(" ")}</div>}
              </div>
            )}
          </div>
        )}

        {!compactHint && !busy && !q && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 12 }}>
            <span className="text-muted">Demonstration corpus:</span>
            {registryList().map((r) => <button key={r.id} className="chip" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => { setQ(r.name); onRun(r.name, { registryId: r.id, period: period || undefined }); }}>{r.name}</button>)}
            {onDiscover && <span className="text-muted">· or type any listed group&apos;s name to search its public disclosures.</span>}
          </div>
        )}
      </div>
    </div>
  );
}

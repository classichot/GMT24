"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ScanRunner } from "@/components/scan/ScanRunner";
import { ScanView } from "@/components/scan/ScanView";
import { buildScan, periodsFor, reassess } from "@/lib/scan/pipeline";
import type { ScanResult } from "@/lib/scan/types";
import { scanDiscover, type DiscoverOutcome, type ScanProgress } from "@/lib/scan/discoverClient";

/**
 * Public Quick Scan. No workspace, no login: the demonstration door for a
 * prospective group. Results stay in the browser; the sign-in path carries the
 * scan into a GMT24 workspace as proposed data.
 */
export default function PublicScanPage() {
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [outcome, setOutcome] = useState<DiscoverOutcome | null>(null);
  const [modelConfigured, setModelConfigured] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const scan = scans[0] ?? null;
  useEffect(() => { void fetch("/api/ai/status").then((r) => r.json()).then((j: { configured?: boolean }) => setModelConfigured(!!j.configured)).catch(() => undefined); }, []);
  const run = (query: string, opts: { registryId?: string; period?: string }) => { setOutcome(null); setScans((s) => [buildScan(query, opts), ...s].slice(0, 8)); };
  const discover = async (query: string, period?: string, url?: string) => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setOutcome(null);
    setProgress({ stage: "discover", detail: query });
    const out = await scanDiscover(query, { period, url, onProgress: setProgress, signal: ctl.signal, modelConfigured, contextKey: "public", onAttachment: () => undefined });
    setProgress(null);
    setOutcome(out);
    if (out.kind === "scan") setScans((s) => [out.scan, ...s].slice(0, 8));
  };
  const mutate = (fn: (r: ScanResult) => ScanResult) => setScans((s) => s.map((r, i) => (i === 0 ? reassess(fn(r)) : r)));
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "18px 28px", borderBottom: "2px solid var(--color-divider)", flexWrap: "wrap" }}>
        <div>
          <div className="login-mark" style={{ fontSize: 32 }}>GMT24<span /></div>
          <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-neutral-600)", marginTop: 4 }}>AI Pillar Two Quick Scan</div>
        </div>
        <div className="stack-actions">
          <Link href="/" className="btn btn-secondary">Sign in</Link>
          <Link href="/host" className="btn btn-ghost">Host desk</Link>
        </div>
      </header>
      <main style={{ padding: 28, maxWidth: 1240, margin: "0 auto", display: "grid", gap: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Where would Pillar Two bite — and what would settle it?</h2>
          <p className="text-muted" style={{ maxWidth: 760, marginTop: 8 }}>Enter a listed group. GMT24 identifies the legal entity, reads its official disclosures, builds the group structure, matches each jurisdiction to a versioned tax database and returns an exposure map with review priority, evidence strength and coverage shown separately — plus the follow-up questions that would change the picture. A preliminary assessment from public evidence, not a calculation.</p>
        </div>
        <ScanRunner onRun={run} onDiscover={(q, p) => void discover(q, p)} onPickSource={(url, q, p) => void discover(q, p, url)} onCancel={() => { abort.current?.abort(); setProgress(null); }} progress={progress} outcome={outcome} periods={scan?.resolved ? periodsFor(scan.resolved.registryId) : []} lastPeriod={scan?.period ?? null} />
        {scan && <ScanView scan={scan} others={scans} actor="Guest" signedIn={false} onAnswer={(qid, v) => mutate((r) => ({ ...r, answers: { ...r.answers, [qid]: { value: v, by: "Guest", at: new Date().toISOString() } } }))} onCorrect={(c) => mutate((r) => ({ ...r, corrections: [...r.corrections, c] }))} onPeriod={(period) => { if (scan.resolved) run(scan.resolved.name, { registryId: scan.resolved.registryId, period }); }} />}
        <div className="text-muted" style={{ fontSize: 11 }}>Quick Scan is the demonstration door to GMT24. Within a workspace the same scan connects to Pillar Two X-Ray (which obtains the facts) and the deterministic calculation engine (which produces the numbers). Public research enters a workspace as proposed data for reviewer acceptance only.</div>
      </main>
    </div>
  );
}

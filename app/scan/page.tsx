"use client";

import { useState } from "react";
import Link from "next/link";
import { ScanRunner } from "@/components/scan/ScanRunner";
import { ScanView } from "@/components/scan/ScanView";
import { buildScan, periodsFor, reassess } from "@/lib/scan/pipeline";
import type { ScanResult } from "@/lib/scan/types";

/**
 * Public Quick Scan. No workspace, no login: the demonstration door for a
 * prospective group. Results stay in the browser; the sign-in path carries the
 * scan into a GMT24 workspace as proposed data.
 */
export default function PublicScanPage() {
  const [scans, setScans] = useState<ScanResult[]>([]);
  const scan = scans[0] ?? null;
  const run = (query: string, opts: { registryId?: string; period?: string }) => setScans((s) => [buildScan(query, opts), ...s].slice(0, 8));
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
        <ScanRunner onRun={run} periods={scan?.resolved ? periodsFor(scan.resolved.registryId) : []} lastPeriod={scan?.period ?? null} />
        {scan && <ScanView scan={scan} others={scans} actor="Guest" signedIn={false} onAnswer={(qid, v) => mutate((r) => ({ ...r, answers: { ...r.answers, [qid]: { value: v, by: "Guest", at: new Date().toISOString() } } }))} onCorrect={(c) => mutate((r) => ({ ...r, corrections: [...r.corrections, c] }))} onPeriod={(period) => { if (scan.resolved) run(scan.resolved.name, { registryId: scan.resolved.registryId, period }); }} />}
        <div className="text-muted" style={{ fontSize: 11 }}>Quick Scan is the demonstration door to GMT24. Within a workspace the same scan connects to Pillar Two X-Ray (which obtains the facts) and the deterministic calculation engine (which produces the numbers). Public research enters a workspace as proposed data for reviewer acceptance only.</div>
      </main>
    </div>
  );
}

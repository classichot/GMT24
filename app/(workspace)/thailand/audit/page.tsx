"use client";

import { useState } from "react";
import Link from "next/link";
import { ThaiPackBar } from "@/components/ThaiPackBar";
import { Amount } from "@/components/Amount";
import { useCalc } from "@/lib/useCalc";
import { useStore } from "@/lib/store";
import { eur, thb } from "@/lib/format";
import { DEFENCE_CHAPTERS, RD_RISK, penaltyPreview, THAI_PACK } from "@/lib/thailand";

export default function ThaiAuditPage() {
  const { ask, flash } = useStore();
  const { calcs } = useCalc();
  const th = calcs.find((c) => c.iso === "TH");
  const [months, setMonths] = useState(3);
  const [kind, setKind] = useState<"incorrect" | "non-filing">("incorrect");
  const [extension, setExtension] = useState(false);
  const tax = th?.jurisdictionalTopUp ?? 0;
  const p = penaltyPreview(tax, months, kind, extension);

  return (
    <div>
      <ThaiPackBar />
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Thai Pillar 2 Audit Defence Book.</strong> The Decree gives a ten-year assessment window and information-request powers. This book is the one-click pack: scope, situs, elections, source, adjustments, ETR, SBIE, QDMTT/IIR/UTPR, filings, payment and evidence. Thai citations sit on each line. {THAI_PACK.coverage.headline}.
        </div>
        <div className="stack-actions">
          <button className="btn btn-primary" onClick={() => { flash("Defence book assembled from locked snapshot GMT24-CALC 2026.2 + TH-PACK-2567. Thai translation pack queued."); ask("What would the Revenue Department ask for on Thai QDMTT?"); }}>Assemble book</button>
          <Link href="/thailand/boi" className="btn btn-secondary">BOI Optimizer</Link>
          <Link href="/thailand/gap" className="btn btn-secondary">OECD vs RD gap</Link>
          <Link href="/audit" className="btn btn-secondary">Calc trail</Link>
          <Link href="/evidence" className="btn btn-secondary">Evidence</Link>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h4>Chapters</h4><span className="text-muted">TH / EN workpapers</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Ch.</th><th>Content</th><th></th></tr></thead>
            <tbody>
              {DEFENCE_CHAPTERS.map((c) => (
                <tr key={c.n}>
                  <td className="mono">{c.n}</td>
                  <td>{c.title}</td>
                  <td><Link href={c.href}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h4>Thai RD risk review · pre-file</h4></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Flag</th><th>Severity</th><th>Why it matters</th></tr></thead>
            <tbody>
              {RD_RISK.map((r) => (
                <tr key={r.id}>
                  <td>{r.flag}</td>
                  <td><span className={`tag ${r.severity === "ok" ? "tag-ok" : r.severity === "warn" ? "tag-warn" : "tag-neutral"}`}>{r.severity}</span></td>
                  <td style={{ fontSize: 13 }}>{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><h4>Penalty and interest calculator</h4></div>
          <div className="panel-body">
            <div className="wf-row"><span>Underlying tax</span>{th ? <Amount n={tax} audit={th.audit} /> : "—"}</div>
            <div className="wf-row">
              <span>Assessment type</span>
              <span>
                <button type="button" className={`btn ${kind === "incorrect" ? "btn-primary" : "btn-ghost"}`} onClick={() => setKind("incorrect")}>1× incorrect</button>
                {" "}
                <button type="button" className={`btn ${kind === "non-filing" ? "btn-primary" : "btn-ghost"}`} onClick={() => setKind("non-filing")}>2× non-filing</button>
              </span>
            </div>
            <div className="wf-row">
              <span>Months late (or fraction)</span>
              <input className="input" style={{ maxWidth: 80 }} type="number" min={0} value={months} onChange={(e) => setMonths(Number(e.target.value) || 0)} />
            </div>
            <div className="wf-row">
              <span>Approved extension (0.75%)</span>
              <input type="checkbox" checked={extension} onChange={(e) => setExtension(e.target.checked)} />
            </div>
            <div className="wf-row"><span>Tax penalty</span><span>{eur(p.taxPenalty)}</span></div>
            <div className="wf-row"><span>Surcharge {(p.rate * 100).toFixed(2)}% / month</span><span>{eur(p.surcharge)}</span></div>
            <div className="wf-row"><span>Filing penalty cap</span><span>{thb(p.filingThb)}</span></div>
            <p className="text-muted" style={{ margin: "12px 0 0", fontSize: 13 }}>{p.cap} Appeal window {p.appealDays} days. Refund claim {p.refundYears} years. 30-day RD summons calendar lives with the data-request room.</p>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h4>Assessment window</h4></div>
          <div className="panel-body waterfall">
            <div className="wf-row"><span>Assessment period</span><span>10 years</span></div>
            <div className="wf-row"><span>RD information powers</span><span>Extensive — keep lineage to journal</span></div>
            <div className="wf-row"><span>Immutable calc versions</span><span>GMT24-CALC 2026.2 · {THAI_PACK.id} {THAI_PACK.version}</span></div>
            <div className="wf-row"><span>MAP / CA tracker</span><span>No open case</span></div>
            <div className="wf-row"><span>Thai translation pack</span><span>Queued on Assemble book</span></div>
            <p className="text-muted" style={{ margin: "12px 0 0", fontSize: 13 }}>
              Prior-year recalculation uses the same engines with origin-year DT recapture (see <Link href="/deferred-tax">Deferred tax</Link>). Do not restyle OECD numbers into Thai without the pack overlay.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

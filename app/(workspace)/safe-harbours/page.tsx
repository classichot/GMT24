"use client";

import Link from "next/link";
import { useCalc } from "@/lib/useCalc";
import { pct } from "@/lib/format";

const TESTS = [
  ["deMinimis", "De minimis"],
  ["simplifiedEtr", "Simplified ETR (17% FY26/27)"],
  ["routineProfits", "Routine profits"],
  ["qdmttSH", "QDMTT Safe Harbour"],
  ["sbtish", "Substance-based Tax Incentive SH"],
  ["utprSH", "Transitional UTPR SH"],
  ["sbs", "Side-by-Side / UPE"],
] as const;

export default function SafeHarbourPage() {
  const { calcs } = useCalc();
  return (
    <div>
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Safe Harbour Navigator</strong> is a generic framework, not a hard-coded Transitional CbCR screen. Tests are selected from the effective-dated rulebook (OECD-TCSH-2026 v2026.2 extended to FY beginning on or before 31 Dec 2027; Simplified ETR SH for later years; SBTISH; QDMTT SH; UTPR SH; SbS).
          {" "}<strong>Once out, always out:</strong> if a blend fails TCSH or does not elect it in a year it could have used it, the year lock bars TCSH for remaining transition years. Elect SH_TCSH on the GIR to use a Pass.
        </div>
        <div className="stack-actions">
          <Link href="/elections" className="btn btn-secondary">SETR inner elections</Link>
          <Link href="/years" className="btn btn-secondary">Year record</Link>
          <Link href="/optimize" className="btn btn-primary">Optimize GloBE</Link>
        </div>
      </div>
      <div className="table-wrap panel">
        <table className="table">
          <thead>
            <tr>
              <th>Jurisdiction</th>
              {TESTS.map(([, l]) => <th key={l}>{l}</th>)}
              <th>TCSH</th>
              <th>Navigator</th>
            </tr>
          </thead>
          <tbody>
            {calcs.map((c) => (
              <tr key={c.blendKey}>
                <td>
                  <div style={{ fontWeight: 700 }}>{c.name}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>CbCR ETR path · GloBE {pct(c.etr, 1)}</div>
                </td>
                {TESTS.map(([k]) => {
                  const v = c.sh[k];
                  const cls = v === "Pass" ? "tag-ok" : v === "Fail" ? "tag-hot" : v === "Review" ? "tag-warn" : "tag-neutral";
                  return <td key={k}><span className={`tag ${cls}`}>{v}</span></td>;
                })}
                <td>
                  {c.sh.barred ? <span className="tag tag-hot">Barred</span>
                    : c.sh.tcshUsed ? <span className="tag tag-ok">Used</span>
                    : c.sh.tcshFailed ? <span className="tag tag-hot">Failed</span>
                    : <span className="tag tag-warn">Not elected</span>}
                </td>
                <td style={{ fontSize: 12, maxWidth: 320 }}>{c.sh.navigator}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

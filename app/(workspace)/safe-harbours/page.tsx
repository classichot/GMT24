"use client";

import { calculateGroup } from "@/lib/engine";
import { useStore } from "@/lib/store";
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
  const { groupId } = useStore();
  const calcs = calculateGroup(groupId);
  return (
    <div>
      <div className="callout" style={{ marginBottom: 20 }}>
        <strong>Safe Harbour Navigator</strong> is a generic framework, not a hard-coded Transitional CbCR screen. Tests are selected from the effective-dated rulebook (OECD-TCSH-2026 v2026.2 extended to FY beginning on or before 31 Dec 2027; Simplified ETR SH for later years; SBTISH; QDMTT SH; UTPR SH; SbS).
      </div>
      <div className="table-wrap panel">
        <table className="table">
          <thead>
            <tr>
              <th>Jurisdiction</th>
              {TESTS.map(([, l]) => <th key={l}>{l}</th>)}
              <th>Navigator</th>
            </tr>
          </thead>
          <tbody>
            {calcs.map((c) => (
              <tr key={c.iso}>
                <td>
                  <div style={{ fontWeight: 700 }}>{c.name}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>CbCR ETR path · GloBE {pct(c.etr, 1)}</div>
                </td>
                {TESTS.map(([k]) => {
                  const v = c.sh[k];
                  const cls = v === "Pass" ? "tag-ok" : v === "Fail" ? "tag-hot" : v === "Review" ? "tag-warn" : "tag-neutral";
                  return <td key={k}><span className={`tag ${cls}`}>{v}</span></td>;
                })}
                <td style={{ fontSize: 12, maxWidth: 280 }}>{c.sh.navigator}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

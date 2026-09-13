"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCalc } from "@/lib/useCalc";
import { etrPct } from "@/lib/format";
import { runAllSafeHarbours, sbtishTrace, SBTISH_EXPENDITURE } from "@/lib/harbours2026";
import { DATA } from "@/lib/model";
import { BlendBadge, blendsForIso, EtrGroupsBadge } from "@/components/BlendBadge";
import { useStore } from "@/lib/store";
import { canElect, switchKey } from "@/lib/electionEngine";
import { onceOutRegister, tcshOutlook, TCSH_LAST_END, TCSH_LAST_START, type TcshOutlook } from "@/lib/tcshOutlook";

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
  const { group, activeFy, electionsOn, setElection, yearRecords, flash } = useStore();
  const [ran, setRan] = useState(false);
  const summary = useMemo(() => runAllSafeHarbours(calcs), [calcs]);
  const outlook = useMemo(
    () => tcshOutlook(calcs, { fy: activeFy, fyStart: group.fyStart, fyEnd: group.fyEnd, electionsOn, yearRecords }),
    [calcs, activeFy, group.fyStart, group.fyEnd, electionsOn, yearRecords],
  );
  const register = onceOutRegister(outlook);
  const outlookFor = (blendKey: string) => outlook.find((o) => o.blendKey === blendKey);

  /** Switching to another harbour turns TCSH off for that jurisdiction — the two are not stacked. */
  const switchTo = (o: TcshOutlook, id: string) => {
    const key = switchKey(id, o.iso);
    const on = Boolean(electionsOn[key]);
    const gate = setElection(key, !on);
    if (gate) { flash(gate); return; }
    if (!on && electionsOn[switchKey("SH_TCSH", o.iso)]) setElection(switchKey("SH_TCSH", o.iso), false);
    flash(`${o.name}: ${on ? "switched off" : "switched to"} ${o.alternatives.find((a) => a.id === id)?.short ?? id}`);
  };
  const traceEntity = SBTISH_EXPENDITURE[0]?.entityId ?? "";
  const traceCode = DATA.entities.find((e) => e.id === traceEntity)?.code ?? traceEntity;
  const thTrace = sbtishTrace(traceEntity);

  return (
    <div>
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Safe Harbour Navigator</strong> is a generic framework, not a hard-coded Transitional CbCR screen. Tests are selected from the effective-dated rulebook (OECD-TCSH-2026 v2026.2; Simplified ETR SH; SBTISH with expenditure tracing; NMCE; Permanent SH; QDMTT SH; UTPR SH; SbS).
          {" "}<strong>Once out, always out:</strong> if a blend fails TCSH or does not elect it in a year it could have used it, the year lock bars TCSH for remaining transition years. The "Next FY" column marks that forward; the period itself covers Fiscal Years beginning on or before {TCSH_LAST_START} and ending by {TCSH_LAST_END}.
        </div>
        <div className="stack-actions">
          <button className="btn btn-primary" onClick={() => setRan(true)}>Run all safe harbours</button>
          <Link href="/elections" className="btn btn-secondary">SETR inner elections</Link>
          <Link href="/years" className="btn btn-secondary">Year record</Link>
        </div>
      </div>

      {ran ? (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <h4>Harbour decision engine</h4>
            <span className="tag tag-ok">{summary.jurisdictions} blends · {summary.fullGlobeRequired} need full GloBE</span>
          </div>
          <div className="kpi-grid cols-4" style={{ padding: "12px 16px 0" }}>
            <div className="kpi"><div className="kpi-label">Pass</div><div className="kpi-val">{summary.harboursPass}</div></div>
            <div className="kpi"><div className="kpi-label">Review</div><div className="kpi-val">{summary.harboursReview}</div></div>
            <div className="kpi"><div className="kpi-label">Fail</div><div className="kpi-val">{summary.harboursFail}</div></div>
            <div className="kpi"><div className="kpi-label">Full GloBE still required</div><div className="kpi-val">{summary.fullGlobeRequired}</div><div className="kpi-sub">of {summary.jurisdictions} blends</div></div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Jurisdiction</th><th>Safe harbour</th><th>Article</th><th>Result</th><th>Detail</th></tr>
              </thead>
              <tbody>
                {summary.rows.map((r) => (
                  <tr key={`${r.blendKey}-${r.harbour}`}>
                    <td>{r.name}</td>
                    <td>{r.harbour}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{r.article}</td>
                    <td><span className={`tag ${r.result === "Pass" ? "tag-ok" : r.result === "Fail" ? "tag-hot" : r.result === "Review" ? "tag-warn" : "tag-neutral"}`}>{r.result}</span></td>
                    <td style={{ fontSize: 12 }}>{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h4>Once out, always out — TCSH register · {activeFy} → {outlook[0]?.nextFy}</h4>
          <span className={`tag ${register.length ? "tag-hot" : "tag-ok"}`}>{register.length} of {outlook.filter((o) => o.thisFy !== "N/A").length} blends out</span>
        </div>
        {register.length === 0 ? (
          <div className="panel-body text-muted" style={{ fontSize: 13 }}>Every tested blend used TCSH this year. Nothing is barred for {outlook[0]?.nextFy}.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Blend</th><th>Out since</th><th>{activeFy} result</th><th>{outlook[0]?.nextFy} mark</th><th>Switch to</th></tr></thead>
              <tbody>
                {register.map((o) => (
                  <tr key={o.blendKey}>
                    <td style={{ fontWeight: 700 }}>{o.name}</td>
                    <td className="mono">{o.outSince ?? activeFy}</td>
                    <td><span className={`tag ${o.thisFy === "Barred" || o.thisFy === "Failed" ? "tag-hot" : "tag-warn"}`}>{o.thisFy}</span></td>
                    <td>
                      <span className="tag tag-hot">{o.nextLabel}</span>
                      <div className="text-muted" style={{ fontSize: 11, marginTop: 4, maxWidth: 360 }}>{o.nextDetail}</div>
                    </td>
                    <td><SwitchChips o={o} onSwitch={switchTo} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h4>SBTISH expenditure trace · {traceCode}</h4><span className="tag tag-outline">{Math.round(thTrace.ratio * 100)}% qualified</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Line</th><th>Amount</th><th>Qualified</th><th>Evidence</th></tr></thead>
            <tbody>
              {SBTISH_EXPENDITURE.map((l) => (
                <tr key={l.id}>
                  <td>{l.label}</td>
                  <td className="num">{l.amount.toLocaleString("en-GB")}</td>
                  <td>{l.qualified ? <span className="tag tag-ok">Yes</span> : <span className="tag tag-hot">No</span>}</td>
                  <td style={{ fontSize: 12 }}>{l.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-wrap panel">
        <table className="table">
          <thead>
            <tr>
              <th>Jurisdiction</th>
              {TESTS.map(([, l]) => <th key={l}>{l}</th>)}
              <th>TCSH {activeFy}</th>
              <th>Next FY (once out)</th>
              <th>Switch to</th>
              <th>Navigator</th>
            </tr>
          </thead>
          <tbody>
            {calcs.map((c) => (
              <tr key={c.blendKey}>
                <td>
                  <div style={{ fontWeight: 700 }}>{c.name}<BlendBadge blendKind={c.blendKind} /><EtrGroupsBadge calc={c} calcs={calcs} /></div>
                  <div className="text-muted" style={{ fontSize: 11 }}>{c.entities.map((e) => e.code).join(", ") || "no CE"} · CbCR ETR path · GloBE {etrPct(c, 1)}</div>
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
                {(() => {
                  const o = outlookFor(c.blendKey);
                  if (!o) return <><td /><td /></>;
                  const cls = o.nextStatus === "available" ? "tag-ok" : o.nextStatus === "n/a" ? "tag-neutral" : o.nextStatus === "period-closed" ? "tag-warn" : "tag-hot";
                  return (
                    <>
                      <td title={o.nextDetail}><span className={`tag ${cls}`}>{o.nextLabel}</span></td>
                      <td><SwitchChips o={o} onSwitch={switchTo} compact /></td>
                    </>
                  );
                })()}
                <td style={{ fontSize: 12, maxWidth: 320 }}>{c.sh.navigator}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Alternatives to TCSH for one blend — switching one on turns TCSH off for that jurisdiction. */
function SwitchChips({ o, onSwitch, compact }: { o: TcshOutlook; onSwitch: (o: TcshOutlook, id: string) => void; compact?: boolean }) {
  if (o.thisFy === "N/A") return <span className="text-muted" style={{ fontSize: 11 }}>—</span>;
  const shown = compact ? o.alternatives.filter((a) => canElect(a.status) || a.on) : o.alternatives;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxWidth: compact ? 220 : 420 }}>
      {shown.map((a) => (
        <button
          key={a.id}
          type="button"
          className={`chip${a.on ? " active" : ""}`}
          disabled={!canElect(a.status) && !a.on}
          title={`${a.label} · ${a.status}: ${a.reason}`}
          onClick={() => onSwitch(o, a.id)}
          style={{ fontSize: 11, opacity: canElect(a.status) || a.on ? 1 : 0.45 }}
        >
          {a.short}{a.on ? " ✓" : a.status === "review" ? " ?" : ""}
        </button>
      ))}
      {o.fullGlobe && <Link href={`/etr?iso=${o.iso}${o.blendKey.includes(":") && !o.blendKey.endsWith(":main") ? `&blend=${encodeURIComponent(o.blendKey)}` : ""}`} className="chip" style={{ fontSize: 11 }}>Full GloBE</Link>}
      {shown.length === 0 && !o.fullGlobe && <span className="text-muted" style={{ fontSize: 11 }}>no alternative available</span>}
    </div>
  );
}

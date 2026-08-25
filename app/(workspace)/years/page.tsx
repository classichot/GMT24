"use client";

import Link from "next/link";
import { Amount } from "@/components/Amount";
import { ElectionBar } from "@/components/ElectionBar";
import { useCalc } from "@/lib/useCalc";
import { useStore } from "@/lib/store";
import { eur, pct } from "@/lib/format";
import {
  eligibilityEngine,
  scoreWorking,
} from "@/lib/electionEngine";
import {
  YEAR_LOGIC,
  buildTracks,
  compareYears,
  lastLocked,
  lockedFor,
  nextFy,
  workingDiffers,
  yearsLeftOnLock,
} from "@/lib/yearLedger";

export default function YearsPage() {
  const {
    mode,
    groupId,
    group,
    ask,
    flash,
    electionsOn,
    sbieClaim,
    activeFy,
    yearRecords,
    yearLocked,
    lockCurrentYear,
    openNextYear,
  } = useStore();
  const { calcs } = useCalc();
  const elig = eligibilityEngine(calcs);
  const work = scoreWorking(calcs, elig, electionsOn, sbieClaim);
  const sameLock = lockedFor(yearRecords, activeFy);
  const prior = lastLocked(yearRecords, activeFy);
  const base = prior ?? (sameLock && workingDiffers(sameLock, electionsOn, sbieClaim) ? sameLock : null);
  const tracks = buildTracks(yearRecords, { fy: activeFy, electionsOn });
  const compare = base
    ? compareYears(base, { fy: activeFy, electionsOn, sbieClaim, rows: work.rows.map((r) => ({
      iso: r.iso, name: r.name, globe: r.globe, covered: r.covered, etr: r.etr, sbie: r.sbie, excess: r.excess,
      topUp: r.topUp, qdmtt: r.qdmtt, iir: r.iir, utpr: r.utpr, harbour: r.harbour,
      additionalCurrent: r.additionalCurrent, tcshUsed: r.tcshUsed, tcshFailed: r.tcshFailed, tcshBarred: r.tcshBarred,
      blendKey: r.blendKey,
    })) }, tracks)
    : null;
  const carried = tracks.filter((t) => (t.duration === "five-year" || t.duration === "first-gir") && electionsOn[t.key] && t.firstFy !== activeFy);
  const blocks = compare?.hits.filter((h) => h.severity === "block") ?? [];
  const dirty = !!(sameLock && workingDiffers(sameLock, electionsOn, sbieClaim));
  const next = nextFy(activeFy);
  const desk = mode === "advisor" ? "Advisor engagement" : "In-house close";

  function lock() {
    const rec = lockCurrentYear(work.rows);
    flash(`${rec.fy} locked — ${Object.values(rec.electionsOn).filter(Boolean).length} election(s), group top-up ${eur(rec.groupTopUp, true)}`);
  }

  function openNext() {
    if (!sameLock) {
      flash(`Lock ${activeFy} first. Next year needs a final calc and election record.`);
      return;
    }
    if (dirty) {
      flash(`Working package differs from the locked ${activeFy} close. Re-lock to carry the latest elections.`);
      return;
    }
    const fy = openNextYear();
    if (fy) flash(`${fy} opened. Five-year and first-GIR elections carried from ${activeFy}.`);
    else flash(`Lock ${activeFy} before opening the next year.`);
  }

  return (
    <div>
      <ElectionBar />
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Year record · {desk}.</strong> {mode === "advisor" ? `${group.name} has its own ledger.` : `${group.name} is the in-house MNE ledger.`}
          {" "}Lock the final calculation and GIR elections for the Fiscal Year. Open the next year and GMT24 factors that close: five-year locks carry, Art. 4.5 cannot be re-elected after revocation, and both elections and amounts are compared.
          {" "}Working years still run on this snapshot’s data model until later-year books are loaded — election overlays are what move the numbers.
        </div>
        <div className="stack-actions">
          <Link href="/elections" className="btn btn-secondary">Election engine</Link>
          <button className="btn btn-primary" type="button" onClick={() => ask(`Compare ${base?.fy ?? "prior"} and ${activeFy} elections and calculation.`)}>Ask GMT24</button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h4>How this works</h4></div>
        <div className="panel-body">
          <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
            Same logic in In-house and Advisor. Advisor keeps a separate ledger per client — switching engagements does not mix locks.
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th />
                  <th>Step</th>
                  <th>What GMT24 does</th>
                </tr>
              </thead>
              <tbody>
                {YEAR_LOGIC.map((s) => (
                  <tr key={s.n}>
                    <td className="mono">{s.n}</td>
                    <td style={{ fontWeight: 700 }}>{s.title}</td>
                    <td style={{ fontSize: 13 }}>{s.body}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="kpi-grid cols-4" style={{ marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Active year</div>
          <div className="kpi-val" style={{ fontSize: 22 }}>{activeFy}</div>
          <div className="kpi-sub">{group.name} · {yearLocked ? "has a lock on file" : "working"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Locked years</div>
          <div className="kpi-val">{yearRecords.filter((r) => r.locked).length}</div>
          <div className="kpi-sub">Final calc + elections</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{activeFy} top-up</div>
          <div className="kpi-val">{eur(work.fyTopUp, true)}</div>
          <div className="kpi-sub">{Object.values(electionsOn).filter(Boolean).length} election(s) on</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Carried locks</div>
          <div className="kpi-val">{carried.length}</div>
          <div className="kpi-sub">From a prior year</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h4>Fiscal Year desk</h4>
          <div className="stack-actions">
            <button className="btn btn-secondary" type="button" onClick={lock}>
              {sameLock ? `Re-lock ${activeFy}` : `Lock ${activeFy} as final`}
            </button>
            <button className="btn btn-primary" type="button" onClick={openNext}>Open {next}</button>
          </div>
        </div>
        <div className="panel-body">
          <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
            Lock writes the live engine restatement and the election package to this {mode === "advisor" ? "client" : "group"} ledger. Open next year only after that lock — GMT24 then factors the prior close (carried elections, Art. 4.5 bar, TCSH once-out-always-out, compare baseline).
          </p>
          {dirty && (
            <p style={{ color: "var(--color-signal)", fontSize: 13 }}>Working elections differ from the locked {activeFy} record. Re-lock before opening {next} if those toggles should carry.</p>
          )}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Status</th>
                  <th>Elections</th>
                  <th className="num">GloBE</th>
                  <th className="num">Covered taxes</th>
                  <th className="num">Top-up</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...yearRecords].sort((a, b) => a.fy.localeCompare(b.fy)).map((r) => (
                  <tr key={r.fy}>
                    <td style={{ fontWeight: 700 }}>{r.fy}</td>
                    <td><span className="tag tag-accent">Locked {r.lockedAt ? new Date(r.lockedAt).toLocaleDateString() : ""}</span></td>
                    <td>{Object.values(r.electionsOn).filter(Boolean).length}</td>
                    <td className="num">{eur(r.groupGlobe, true)}</td>
                    <td className="num">{eur(r.groupCovered, true)}</td>
                    <td className="num">{eur(r.groupTopUp, true)}</td>
                    <td>{r.fy === activeFy ? "Active" : "On ledger"}</td>
                  </tr>
                ))}
                {!yearLocked && (
                  <tr>
                    <td style={{ fontWeight: 700 }}>{activeFy}</td>
                    <td><span className="tag tag-outline">Working</span></td>
                    <td>{Object.values(electionsOn).filter(Boolean).length}</td>
                    <td className="num">{eur(work.rows.reduce((a, r) => a + r.globe, 0), true)}</td>
                    <td className="num">{eur(work.rows.reduce((a, r) => a + r.covered, 0), true)}</td>
                    <td className="num">{eur(work.fyTopUp, true)}</td>
                    <td>Live engine</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h4>Transitional CbCR — once out, always out</h4><Link href="/safe-harbours" className="btn btn-ghost">Navigator</Link></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Blend</th>
                <th>Outcome</th>
                <th>Used</th>
                <th>Failed</th>
                <th>Barred</th>
              </tr>
            </thead>
            <tbody>
              {calcs.map((c) => (
                <tr key={c.blendKey}>
                  <td>{c.name}</td>
                  <td>{c.sh.outcome}</td>
                  <td>{c.sh.tcshUsed ? "Yes" : "No"}</td>
                  <td>{c.sh.tcshFailed ? "Yes" : "No"}</td>
                  <td>{c.sh.barred ? "Yes — prior year" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-head"><h4>Prior year factored into {activeFy}</h4></div>
          <div className="panel-body">
            {!base ? (
              <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>No prior locked year. {activeFy} is the first close on this ledger.</p>
            ) : (
              <>
                <div className="wf-row"><span>Prior close</span><strong>{base.fy}</strong></div>
                <div className="wf-row"><span>Prior top-up</span><span>{eur(base.groupTopUp, true)}</span></div>
                <div className="wf-row"><span>Prior elections</span><span>{Object.values(base.electionsOn).filter(Boolean).length}</span></div>
                <div className="wf-row"><span>Carried into {activeFy}</span><span>{carried.length} lock(s)</span></div>
                {carried.length === 0 ? (
                  <p className="text-muted" style={{ fontSize: 13 }}>No five-year or first-GIR election was on in {base.fy}. Annual elections do not auto-carry — they must be made again.</p>
                ) : (
                  <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13 }}>
                    {carried.map((t) => (
                      <li key={t.key}>{t.article} · {t.iso} · from {t.firstFy} · {yearsLeftOnLock(t.firstFy, activeFy)} year(s) left</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h4>Consistency</h4></div>
          <div className="panel-body">
            {!compare ? (
              <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Lock a year, then open the next one to run the consistency check.</p>
            ) : blocks.length ? (
              blocks.map((h) => (
                <div key={h.title + h.detail} className="wf-row">
                  <span className="tag tag-neutral">Block</span>
                  <span>{h.title} — {h.detail}</span>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 13, margin: 0 }}>
                No consistency block versus {base?.fy}. Five-year locks that should carry are on. Art. 4.5 has not been re-elected after a revocation.
              </p>
            )}
            {compare && compare.hits.filter((h) => h.severity !== "block").slice(0, 6).map((h) => (
              <div key={h.kind + (h.key ?? h.title)} className="wf-row" style={{ fontSize: 13 }}>
                <span className={`tag ${h.severity === "warn" ? "tag-outline" : "tag-accent"}`}>{h.severity === "warn" ? "Review" : "OK"}</span>
                <span>{h.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h4>Election compare · {base?.fy ?? "—"} → {activeFy}</h4></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Election</th>
                <th>Scope</th>
                <th>Duration</th>
                <th>{base?.fy ?? "Prior"}</th>
                <th>{activeFy}</th>
                <th>Change</th>
                <th>Consistency</th>
              </tr>
            </thead>
            <tbody>
              {(compare?.elections ?? []).length === 0 && (
                <tr><td colSpan={7} className="text-muted">No elections on in either year. Core GloBE (no elective overlays) in both.</td></tr>
              )}
              {compare?.elections.map((e) => (
                <tr key={e.key}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{e.name}</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>{e.article}</div>
                  </td>
                  <td>{e.iso}</td>
                  <td>{e.duration}</td>
                  <td>{e.prior ? "On" : "Off"}</td>
                  <td>{e.current ? "On" : "Off"}</td>
                  <td><span className={`tag ${e.action === "dropped" || e.action === "added" ? "tag-outline" : "tag-accent"}`}>{e.action}</span></td>
                  <td>
                    <span className={`tag ${e.consistency === "breach" ? "tag-neutral" : e.consistency === "review" ? "tag-outline" : "tag-accent"}`}>{e.consistency}</span>
                    <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>{e.note}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h4>Calculation compare · {base?.fy ?? "—"} → {activeFy}</h4></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Jurisdiction</th>
                <th className="num">GloBE Δ</th>
                <th className="num">Covered Δ</th>
                <th className="num">ETR</th>
                <th className="num">Top-up Δ</th>
                <th className="num">{activeFy} top-up</th>
              </tr>
            </thead>
            <tbody>
              {(compare?.calcs ?? []).length === 0 && (
                <tr><td colSpan={6} className="text-muted">No calculation movement versus the prior close — expected when the data model is unchanged and no election overlay moved GloBE or covered taxes.</td></tr>
              )}
              {compare?.calcs.map((c) => (
                <tr key={c.blendKey ?? c.iso}>
                  <td style={{ fontWeight: 700 }}>{c.name}</td>
                  <td className="num"><Amount n={c.dGlobe} compact /></td>
                  <td className="num"><Amount n={c.dCovered} compact /></td>
                  <td className="num">{pct(c.etrPrior, 1)} → {pct(c.etr, 1)}</td>
                  <td className="num"><Amount n={c.dTopUp} compact /></td>
                  <td className="num"><Amount n={c.topUp} compact /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted" style={{ fontSize: 13, padding: "12px 16px 16px" }}>
          Amounts are the engine restatement, not a copilot guess. Opening DTA/DTL and Art. 4.4.4 recapture clocks already sit in the FY2026 books; they are the calculation carry-forward. Election carry-forward is separate and is what this desk locks.
        </p>
      </div>
    </div>
  );
}

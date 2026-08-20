"use client";

import { useState } from "react";
import Link from "next/link";
import { Amount } from "@/components/Amount";
import { ElectionBar } from "@/components/ElectionBar";
import { ElectionSwitch } from "@/components/ElectionSwitch";
import { useCalc } from "@/lib/useCalc";
import { useStore } from "@/lib/store";
import { eur, pct, thb } from "@/lib/format";
import {
  DURATION_LABEL,
  ELECTION_PLAY,
  OECD_ELEC_URLS,
  SCOPE_LABEL,
  WORKED_SBC_THB,
  type ElectionFamily,
} from "@/lib/elections";
import {
  ELIG_LABEL,
  ELIG_TAG,
  canElect,
  familyLabel,
  lifecycleOf,
  optimizeGlobe,
  rollupElig,
  scoreWorking,
  switchKey,
  type EligibilityRow,
  type SbieMode,
} from "@/lib/electionEngine";

const FILTERS: { id: "all" | ElectionFamily; label: string }[] = [
  { id: "all", label: "All" },
  { id: "globe", label: "GloBE" },
  { id: "harbour", label: "Safe harbours" },
  { id: "setr", label: "Simplified ETR inner" },
];

export default function ElectionsPage() {
  const { ask, flash, electionsOn, setElection, resetElections, sbieClaim, setSbieClaim } = useStore();
  const { calcs } = useCalc();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [sel, setSel] = useState("OECD_3.2.2");
  const O = optimizeGlobe(calcs);
  const work = scoreWorking(calcs, O.elig, electionsOn, sbieClaim);
  const rolled = rollupElig(O.elig);
  const rows = filter === "all" ? rolled : rolled.filter((r) => r.election.family === filter);
  const pick = rows.find((r) => r.election.id === sel) ?? rows[0] ?? rolled[0];
  const life = pick ? lifecycleOf(pick.election) : null;
  const W = WORKED_SBC_THB;
  const taxThb = W.entities.reduce((a, e) => a + e.tax, 0);
  const bookThb = W.entities.reduce((a, e) => a + e.book, 0);
  const elected = Object.values(electionsOn).filter(Boolean).length;
  const thWork = work.rows.find((r) => r.iso === "TH");

  function toggleRow(row: EligibilityRow, next: boolean) {
    if (!canElect(row.status)) {
      flash("Not available at this OECD scope — a jurisdiction election cannot be flipped for one entity, and unavailable harbours cannot be elected.");
      return;
    }
    setElection(switchKey(row.election.id, row.iso), next);
    if (row.election.id === "OECD_5.3.1") setSbieClaim(row.iso === "GROUP" ? "TH" : row.iso, next ? "none" : "max");
    if (next && row.election.duration === "five-year") {
      flash(`${row.election.article} is a five-year lock. Scope: ${SCOPE_LABEL[row.election.scope]}.`);
    } else if (next && row.status === "review") {
      flash("Review — recorded on the working package. Not booked as $0.");
    }
  }

  return (
    <div>
      <ElectionBar />
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Yes — toggles are how a GIR is actually filed.</strong> Each election is a real OECD choice. They are not 40 independent entity switches. A jurisdiction election (Art. 3.2.2 stock-comp) binds every CE in that country. Unavailable tests stay off. Review-status harbours can be marked but are not booked as $0. SBIE is max / partial / none, not a silent yes.
        </div>
        <div className="stack-actions">
          <Link href="/optimize" className="btn btn-primary">Optimize my GloBE position</Link>
          <button type="button" className="btn btn-secondary" onClick={resetElections}>Reset to Core</button>
          <a className="btn btn-secondary" href={OECD_ELEC_URLS.gir} target="_blank" rel="noreferrer">GIR</a>
          <button className="btn btn-secondary" onClick={() => ask("Should Thailand elect Art. 3.2.2 stock compensation?")}>Ask GMT24</button>
        </div>
      </div>

      <div className="kpi-grid cols-4" style={{ marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Working package top-up</div>
          <div className="kpi-val"><Amount n={work.fyTopUp} audit={O.audit} /></div>
          <div className="kpi-sub">{elected} elected · Core {eur(O.groupBase, true)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Thai ETR / top-up</div>
          <div className="kpi-val">{thWork ? pct(thWork.etr, 1) : "—"}</div>
          <div className="kpi-sub">
            Core {pct(O.thBase.etr, 1)} · {thWork ? eur(thWork.topUp, true) : "—"} QDMTT
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">QDMTT / IIR / UTPR</div>
          <div className="kpi-val" style={{ fontSize: 18 }}>{eur(work.fyQdmtt, true)}</div>
          <div className="kpi-sub">IIR {eur(work.fyIir, true)} · UTPR {eur(work.fyUtpr, true)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Lock / book</div>
          <div className="kpi-val" style={{ fontSize: 18 }}>{work.lockYears ? `${work.lockYears}-year lock` : "No lock-in"}</div>
          <div className="kpi-sub">{work.bookable ? "Bookable" : "Contains Review — do not book $0"}</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h4>Art. 3.2.2 stock compensation — worked example</h4>
          <span className="tag tag-accent">Jurisdiction / 5-year · not entity-by-entity</span>
        </div>
        <div className="panel-body">
          <p className="text-muted" style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.55 }}>
            {W.note} Default treatment uses financial-accounting expense. The election substitutes the local tax deduction into GloBE Income and must be applied to stock-based compensation of every CE located in Thailand.
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Book expense</th>
                  <th>Tax deduction</th>
                  <th>Spread</th>
                </tr>
              </thead>
              <tbody>
                {W.entities.map((e) => (
                  <tr key={e.name}>
                    <td>{e.name}</td>
                    <td className="mono">{thb(e.book, true)}</td>
                    <td className="mono">{thb(e.tax, true)}</td>
                    <td className="mono">{thb(e.tax - e.book, true)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ fontWeight: 700 }}>Thailand (both CEs)</td>
                  <td className="mono">{thb(bookThb, true)}</td>
                  <td className="mono">{thb(taxThb, true)}</td>
                  <td className="mono">{thb(taxThb - bookThb, true)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="kpi-grid cols-4" style={{ marginTop: 16 }}>
            <div className="kpi">
              <div className="kpi-label">Without election</div>
              <div className="kpi-val">{pct(W.without.etr, 1)}</div>
              <div className="kpi-sub">Top-up {thb(W.without.topUp, true)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">With Art. 3.2.2</div>
              <div className="kpi-val">{pct(W.with.etr, 1)}</div>
              <div className="kpi-sub">Top-up {thb(W.with.topUp, true)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Teaching vs live</div>
              <div className="kpi-val" style={{ fontSize: 16 }}>Use the TH switch</div>
              <div className="kpi-sub">THB illustration above · live overlay in the working package</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Bound entities</div>
              <div className="kpi-val" style={{ fontSize: 16 }}>TH001 · TH-PE1</div>
              <div className="kpi-sub">One Thailand toggle — not two entity toggles</div>
            </div>
          </div>
        </div>
      </div>

      <div className="stack-actions" style={{ marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={`btn ${filter === f.id ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h4>Election register · on / off at OECD scope</h4>
          <span className="tag tag-neutral">{elected} on · {rows.length} shown</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Election</th>
                <th>OECD</th>
                <th>Scope</th>
                <th>Duration</th>
                <th>Eligibility</th>
                <th>Elect</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const places = r.rows.filter((row) => canElect(row.status));
                return (
                  <tr key={r.election.id} className="clickable" onClick={() => setSel(r.election.id)}>
                    <td className="mono">{r.election.n}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{r.election.name}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>{familyLabel(r.election.family)} · {r.election.girField}</div>
                    </td>
                    <td>{r.election.article}</td>
                    <td>{SCOPE_LABEL[r.election.scope]}</td>
                    <td>{DURATION_LABEL[r.election.duration]}</td>
                    <td>
                      <span className={`tag ${ELIG_TAG[r.status]}`}>{ELIG_LABEL[r.status]}</span>
                      {r.election.id === sel && <span className="tag tag-accent" style={{ marginLeft: 6 }}>Open</span>}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {places.length ? (
                        <div className="elec-switch-row">
                          {places.map((row) => {
                            const key = switchKey(row.election.id, row.iso);
                            const on = !!electionsOn[key];
                            return (
                              <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <ElectionSwitch
                                  on={on}
                                  label={`${r.election.name} · ${row.iso}`}
                                  onToggle={(next) => toggleRow(row, next)}
                                />
                                <span className="text-muted" style={{ fontSize: 11 }}>{row.iso}</span>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <ElectionSwitch on={false} disabled label={`${r.election.name} unavailable`} onToggle={() => {}} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {pick && life && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <h4>{pick.election.name}</h4>
            <span className={`tag ${ELIG_TAG[pick.status]}`}>{ELIG_LABEL[pick.status]}</span>
          </div>
          <div className="panel-body">
            <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.55 }}>{pick.reason}</p>
            <div className="grid-2">
              <div>
                {[
                  ["Election ID", pick.election.id],
                  ["OECD article", pick.election.article],
                  ["Scope", SCOPE_LABEL[pick.election.scope]],
                  ["Default treatment", pick.election.defaultTx],
                  ["Alternative treatment", pick.election.electedTx],
                  ["Duration", DURATION_LABEL[pick.election.duration]],
                  ["Election year", String(life.electionYear)],
                  ["Earliest revocation", life.earliestRevocation],
                ].map(([k, v]) => (
                  <div key={k} className="wf-row"><span>{k}</span><span>{v}</span></div>
                ))}
              </div>
              <div>
                {[
                  ["Consistency", pick.election.consistency],
                  ["Revocable", pick.election.revocable ? "Yes" : "No"],
                  ["Re-election restriction", pick.election.reelect === "no" ? "NO — cannot re-elect after revocation" : pick.election.reelect === "restricted" ? "Restricted" : "Annual / unrestricted"],
                  ["Revocation consequence", life.revocationConsequence],
                  ["Safe-harbour interaction", life.harbour],
                  ["QDMTT interaction", pick.election.qdmtt],
                  ["GIR disclosure", `${pick.election.gir} · ${pick.election.girField}`],
                  ["Calculation impact", pick.election.impact],
                ].map(([k, v]) => (
                  <div key={k} className="wf-row"><span>{k}</span><span style={{ textAlign: "right", maxWidth: 280 }}>{v}</span></div>
                ))}
              </div>
            </div>
            {pick.election.id === "OECD_5.3.1" && (
              <div className="stack-actions" style={{ marginTop: 16 }}>
                {(["max", "partial", "none"] as SbieMode[]).map((mode) => {
                  const iso = pick.rows.find((row) => canElect(row.status))?.iso ?? "TH";
                  const current = sbieClaim[iso] ?? "max";
                  return (
                    <button key={mode} type="button" className={`btn ${current === mode ? "btn-primary" : "btn-secondary"}`} onClick={() => setSbieClaim(iso, mode)}>
                      SBIE {mode}
                    </button>
                  );
                })}
              </div>
            )}
            {pick.rows.length > 0 && (
              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Where</th>
                      <th>Status</th>
                      <th>Bound</th>
                      <th>Elect</th>
                      <th>Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pick.rows.map((row) => {
                      const key = switchKey(row.election.id, row.iso);
                      const allowed = canElect(row.status);
                      return (
                        <tr key={`${row.iso}-${row.election.id}`}>
                          <td>{row.name} · {row.iso}</td>
                          <td><span className={`tag ${ELIG_TAG[row.status]}`}>{ELIG_LABEL[row.status]}</span></td>
                          <td className="mono">{row.boundEntities.join(", ") || "—"}</td>
                          <td>
                            <ElectionSwitch
                              on={!!electionsOn[key]}
                              disabled={!allowed}
                              label={`${row.election.name} · ${row.iso}`}
                              onToggle={(next) => toggleRow(row, next)}
                            />
                          </td>
                          <td style={{ fontSize: 12 }}>{row.reason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="stack-actions" style={{ marginTop: 16 }}>
              <Link href={pick.election.href} className="btn btn-secondary">Open module</Link>
              <Link href="/optimize" className="btn btn-primary">Run optimizer</Link>
              <a className="btn btn-ghost" href={OECD_ELEC_URLS.central} target="_blank" rel="noreferrer">OECD Central Record</a>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h4>How to run it</h4>
          <Link href="/playbook/elections" className="btn btn-ghost">Full playbook</Link>
        </div>
        {ELECTION_PLAY.map((s) => (
          <div key={s.n} style={{ display: "grid", gridTemplateColumns: "56px 1fr auto", gap: 16, alignItems: "start", padding: "18px 20px", borderBottom: "1px solid var(--color-divider)" }}>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22, color: "var(--color-accent)" }}>{s.n}</div>
            <div>
              <h4 style={{ margin: 0 }}>{s.title}</h4>
              <p className="text-muted" style={{ margin: "6px 0 0", fontSize: 14 }}>{s.body}</p>
            </div>
            <Link href={s.href} className="btn btn-secondary">{s.hrefLabel}</Link>
          </div>
        ))}
      </div>
    </div>
  );
}

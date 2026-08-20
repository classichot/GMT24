"use client";

import { useState } from "react";
import Link from "next/link";
import { Amount } from "@/components/Amount";
import { ElectionBar } from "@/components/ElectionBar";
import { useCalc } from "@/lib/useCalc";
import { useStore } from "@/lib/store";
import { eur, pct } from "@/lib/format";
import { OECD_ELEC_URLS } from "@/lib/elections";
import { optimizeGlobe, type OptScenario } from "@/lib/electionEngine";

const AUDIT_TAG: Record<OptScenario["audit"], string> = {
  low: "tag-ok",
  medium: "tag-warn",
  high: "tag-hot",
};

export default function OptimizePage() {
  const { ask } = useStore();
  const { calcs } = useCalc();
  const O = optimizeGlobe(calcs);
  const [sel, setSel] = useState(O.recs[4]?.scenario.id ?? "B");
  const pick = O.scenarios.find((s) => s.id === sel) ?? O.recs[4].scenario;
  const rec = O.recs.find((r) => r.scenario.id === pick.id);
  const delta = pick.fyTopUp - O.groupBase;

  return (
    <div>
      <ElectionBar />
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>GMT24 Pillar Two Scenario Optimizer.</strong> Default treatment → eligible elections → safe harbours → five-year lock-ins → QDMTT / IIR / UTPR → GIR disclosure. Ranked on bookable packages only. Review-status harbours (Simplified ETR, SBTI) are modelled but not booked as $0. The LLM does not post the overlay.
        </div>
        <div className="stack-actions">
          <Link href="/elections" className="btn btn-secondary">Election register</Link>
          <Link href="/gir" className="btn btn-secondary">GIR section D</Link>
          <a className="btn btn-secondary" href={OECD_ELEC_URLS.sbs} target="_blank" rel="noreferrer">Side-by-Side 2026</a>
          <button className="btn btn-primary" onClick={() => ask("Optimize my GloBE position")}>Ask GMT24</button>
        </div>
      </div>

      <div style={{ display: "flex", border: "2px solid var(--color-divider)", marginBottom: 24 }}>
        <div style={{ flex: 1, padding: "26px 24px 22px", borderRight: "1px solid var(--color-divider)" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-accent-700)" }}>Optimize my GloBE position · recommended bookable package</div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22, marginTop: 8 }}>{O.recs[4].scenario.title}</div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 56, lineHeight: 0.95, letterSpacing: "-0.03em", marginTop: 10 }}>
            <Amount n={O.recs[4].scenario.fyTopUp} audit={O.audit} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <span className="tag tag-accent">vs baseline {eur(O.groupBase, true)}</span>
            <span className="tag tag-neutral">{O.recs[4].scenario.lockYears ? `${O.recs[4].scenario.lockYears}-year lock` : "No lock-in"}</span>
            <span className="tag tag-ok">Bookable</span>
          </div>
        </div>
        <div style={{ width: "42%", flex: "none", padding: "22px 20px" }}>
          <div className="wf-row"><span>QDMTT</span><span>{eur(O.recs[4].scenario.fyQdmtt)}</span></div>
          <div className="wf-row"><span>IIR</span><span>{eur(O.recs[4].scenario.fyIir)}</span></div>
          <div className="wf-row"><span>UTPR</span><span>{eur(O.recs[4].scenario.fyUtpr)}</span></div>
          <div className="wf-row total"><span>5-year tax (illustrative)</span><span>{eur(O.recs[4].scenario.fy5)}</span></div>
          <p className="text-muted" style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.5 }}>{O.recs[4].scenario.why}</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1, background: "var(--color-divider)", border: "2px solid var(--color-divider)", marginBottom: 24 }}>
        {O.recs.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSel(r.scenario.id)}
            style={{ border: 0, cursor: "pointer", font: "inherit", textAlign: "left", background: r.scenario.id === sel ? "color-mix(in srgb, var(--color-accent) 12%, var(--color-bg))" : "var(--color-bg)", padding: "16px 14px", color: "inherit" }}
          >
            <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-accent-700)" }}>Scenario {r.id}</div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 13, marginTop: 6, lineHeight: 1.3 }}>{r.label}</div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22, marginTop: 10 }}>{eur(r.scenario.fyTopUp, true)}</div>
            <div className="text-muted" style={{ fontSize: 11, marginTop: 6 }}>{r.scenario.title}</div>
          </button>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h4>Scenario generator</h4>
          <span className="tag tag-neutral">Hand-built eligible combinations — not 2^{O.counts.total} switches</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Elections</th>
                <th>Book</th>
                <th>Lock</th>
                <th>Audit</th>
                <th className="num">FY2026 top-up</th>
                <th className="num">5-year</th>
              </tr>
            </thead>
            <tbody>
              {O.scenarios.map((s) => (
                <tr key={s.id} className="clickable" onClick={() => setSel(s.id)}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{s.title}</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>{s.etrNote}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{s.elections.length ? s.elections.join(" · ") : "None (Core default)"}</td>
                  <td>
                    <span className={`tag ${s.bookable ? "tag-ok" : "tag-warn"}`}>{s.bookable ? "Bookable" : "Do not book"}</span>
                    {s.id === O.recs[4].scenario.id && <span className="tag tag-accent" style={{ marginLeft: 6 }}>Recommended</span>}
                  </td>
                  <td>{s.lockYears ? `${s.lockYears}y` : "—"}</td>
                  <td><span className={`tag ${AUDIT_TAG[s.audit]}`}>{s.audit}</span></td>
                  <td className="num mono">{s.id === O.recs[4].scenario.id ? <Amount n={s.fyTopUp} audit={O.audit} compact /> : eur(s.fyTopUp, true)}</td>
                  <td className="num mono">{eur(s.fy5, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted" style={{ padding: "12px 16px 16px", margin: 0, fontSize: 13, lineHeight: 1.5 }}>
          Thailand fails Transitional CbCR on this snapshot — Scenario D cannot zero top-up. Simplified ETR and SBTI are Review, not Pass. Ireland Art. 3.2.2 is legally available but tax deduction is below book, so the optimizer rejects it. SBIE is modelled as max / partial / none because an MNE does not have to claim the maximum.
        </p>
      </div>

      {pick && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <h4>{pick.title}</h4>
            <div className="stack-actions">
              {rec && <span className="tag tag-accent">{rec.label}</span>}
              <span className={`tag ${pick.bookable ? "tag-ok" : "tag-warn"}`}>{pick.bookable ? "Bookable" : "Do not book"}</span>
            </div>
          </div>
          <div className="panel-body">
            <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.55 }}>{pick.why}</p>
            {pick.lockYears >= 5 && (
              <div className="callout" style={{ marginBottom: 16 }}>
                <strong>Five-year lock.</strong> This package includes at least one five-year election. Revocation is restricted. Art. 4.5 (GloBE Loss) cannot be re-elected after revocation. Simplified ETR FX and pension opt-outs survive a later return to full GloBE.
              </div>
            )}
            <div className="kpi-grid cols-4" style={{ marginBottom: 16 }}>
              <div className="kpi">
                <div className="kpi-label">FY2026 top-up</div>
                <div className="kpi-val">{eur(pick.fyTopUp, true)}</div>
                <div className="kpi-sub">{delta === 0 ? "Same as Core" : delta < 0 ? `${eur(Math.abs(delta), true)} below Core` : `${eur(delta, true)} above Core`}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">QDMTT</div>
                <div className="kpi-val">{eur(pick.fyQdmtt, true)}</div>
                <div className="kpi-sub">Thai collection if QDMTT remains qualified</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">IIR / UTPR</div>
                <div className="kpi-val">{eur(pick.fyIir + pick.fyUtpr, true)}</div>
                <div className="kpi-sub">IIR {eur(pick.fyIir, true)} · UTPR {eur(pick.fyUtpr, true)}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">GIR</div>
                <div className="kpi-val" style={{ fontSize: 16 }}>Section D</div>
                <div className="kpi-sub">{pick.elections.length ? pick.elections.join(" · ") : "No elective fields beyond Core defaults"}</div>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Jurisdiction</th>
                    <th className="num">GloBE</th>
                    <th className="num">Covered</th>
                    <th>ETR</th>
                    <th className="num">SBIE</th>
                    <th className="num">Top-up</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {pick.rows.filter((r) => r.topUp > 0 || r.iso === "TH" || r.iso === "IE" || r.harbour).map((r) => (
                    <tr key={r.iso}>
                      <td>{r.name}</td>
                      <td className="num mono">{eur(r.globe, true)}</td>
                      <td className="num mono">{eur(r.covered, true)}</td>
                      <td>{pct(r.etr, 1)}</td>
                      <td className="num mono">{eur(r.sbie, true)}</td>
                      <td className="num mono">{eur(r.topUp, true)}</td>
                      <td style={{ fontSize: 12 }}>{r.harbour ? "Harbour deemed zero" : r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

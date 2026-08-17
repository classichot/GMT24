"use client";

import { useState } from "react";
import Link from "next/link";
import { Amount } from "@/components/Amount";
import { ThaiPackBar } from "@/components/ThaiPackBar";
import { useCalc } from "@/lib/useCalc";
import { useStore } from "@/lib/store";
import { eur, pct } from "@/lib/format";
import {
  BOI_KIND_LABEL,
  BOI_OPT,
  BOI_PLAY,
  NON_TAX_PRIVILEGES,
  conversionYears,
  optimizeBoi,
  workedBoiExample,
  type BoiScenarioId,
} from "@/lib/boiOptimizer";
import { boiValue } from "@/lib/thailand";

const KIND_TAG: Record<BoiScenarioId, string> = {
  keep: "tag-ok",
  convert10: "tag-accent",
  qrtc: "tag-warn",
  none: "tag-neutral",
};

export default function ThaiBoiPage() {
  const { ask } = useStore();
  const { calcs } = useCalc();
  const th = calcs.find((c) => c.iso === "TH");
  const [blend, setBlend] = useState(true);
  const [rate, setRate] = useState(BOI_OPT.discountRate);
  const [sel, setSel] = useState<BoiScenarioId>("keep");
  if (!th) return null;
  const O = optimizeBoi(th, { blend, discountRate: rate });
  const v = boiValue(th, true);
  const W = workedBoiExample();
  const pick = O.scenarios.find((s) => s.id === sel) ?? O.scenarios[0];
  const keep = O.scenarios.find((s) => s.id === "keep")!;

  return (
    <div>
      <ThaiPackBar />
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>BOI–Pillar Two Incentive Optimizer.</strong> Pillar Two does not cancel BOI privileges. It changes their economic value. A certificate can still show 0% CIT while the group pays Thai QDMTT on excess profit. Engine posts jurisdictional blending, SBIE, harbours, 0% vs 10% conversion, QRTC/SBTISH (unbookable) and 10-year NPV. The LLM does not invent a Thai credit.
        </div>
        <div className="stack-actions">
          <Link href="/playbook/boi-optimizer" className="btn btn-secondary">Playbook</Link>
          <Link href="/incentives" className="btn btn-secondary">Certificates</Link>
          <Link href="/safe-harbours" className="btn btn-secondary">Harbours</Link>
          <button className="btn btn-primary" onClick={() => ask("Should we keep the BOI holiday, convert to 10%, or wait for QRTC?")}>Ask GMT24</button>
        </div>
      </div>

      <div className="kpi-grid cols-4" style={{ marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Board line</div>
          <div className="kpi-val" style={{ fontSize: 16, lineHeight: 1.35 }}>{O.headline}</div>
          <div className="kpi-sub">{O.pack} · {O.version} · {blend ? "jurisdictional blend" : "BOI project only"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Advertised FY2026 saving</div>
          <div className="kpi-val">{eur(keep.fy0.nominalBoi, true)}</div>
          <div className="kpi-sub">20% CIT not paid on promoted GloBE {eur(O.promotedGlobe, true)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">QDMTT clawback</div>
          <div className="kpi-val"><Amount n={keep.fy0.clawback} audit={O.audit.clawback} compact /></div>
          <div className="kpi-sub">{pct(O.clawbackRatio, 0)} of the advertised CIT holiday</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Net retained</div>
          <div className="kpi-val"><Amount n={keep.fy0.netBenefit} audit={O.audit.net} compact /></div>
          <div className="kpi-sub">Bookable pick · {BOI_KIND_LABEL[O.recommended]}</div>
        </div>
      </div>

      <p className="text-muted" style={{ margin: "-8px 0 20px", fontSize: 14, lineHeight: 1.55 }}>{O.recommendation}</p>

      <div className="stack-actions" style={{ marginBottom: 16 }}>
        <button type="button" className={`btn ${blend ? "btn-primary" : "btn-secondary"}`} onClick={() => setBlend(true)}>Jurisdictional blending</button>
        <button type="button" className={`btn ${!blend ? "btn-primary" : "btn-secondary"}`} onClick={() => setBlend(false)}>BOI project only (no shelter)</button>
        {[0.06, 0.08, 0.1].map((r) => (
          <button key={r} type="button" className={`btn ${rate === r ? "btn-primary" : "btn-ghost"}`} onClick={() => setRate(r)}>NPV {pct(r, 0)}</button>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h4>Four scenarios · {BOI_OPT.horizon}-year cash tax</h4>
          <span className="tag tag-warn">QRTC not bookable</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Book</th>
                <th>FY2026 CIT + QDMTT</th>
                <th>FY2026 net BOI</th>
                <th>10y NPV cash tax</th>
                <th>10y NPV net benefit</th>
              </tr>
            </thead>
            <tbody>
              {O.scenarios.map((s) => (
                <tr key={s.id} className="clickable" onClick={() => setSel(s.id)}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{s.title}</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>{s.subtitle}</div>
                  </td>
                  <td>
                    <span className={`tag ${s.bookable ? "tag-ok" : "tag-warn"}`}>{s.bookable ? "Bookable" : "Do not book"}</span>
                    {s.id === O.recommended && <span className="tag tag-accent" style={{ marginLeft: 6 }}>Ranked</span>}
                  </td>
                  <td className="mono">{eur(s.fy0.cashTax)}</td>
                  <td className="mono">{eur(s.fy0.netBenefit)}</td>
                  <td className="mono">{s.id === "keep" ? <Amount n={s.npvCash} audit={O.audit.npv} /> : eur(s.npvCash)}</td>
                  <td className="mono">{eur(s.npvNet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted" style={{ padding: "12px 16px 16px", margin: 0, fontSize: 13, lineHeight: 1.5 }}>
          Rank uses bookable scenarios only (lowest cash-tax NPV). 10% remains below 15%, so conversion still produces ordinary CIT plus top-up. The attraction of Announcement 1/2566 is a longer period, not a lower current-year bill. QRTC would preserve more value if it becomes law — it is not law on this snapshot.
        </p>
      </div>

      {pick && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <h4>{pick.title} · year path</h4>
            <span className={`tag ${KIND_TAG[pick.id]}`}>{BOI_KIND_LABEL[pick.id]}</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>GloBE</th>
                  <th>Covered</th>
                  <th>ETR</th>
                  <th>SBIE</th>
                  <th>Top-up</th>
                  <th>Cash tax</th>
                  <th>Net BOI</th>
                </tr>
              </thead>
              <tbody>
                {pick.years.map((y) => (
                  <tr key={y.fy}>
                    <td>{y.fy}</td>
                    <td className="mono">{eur(y.globe, true)}</td>
                    <td className="mono">{eur(y.covered, true)}</td>
                    <td>{pct(y.etr, 1)}</td>
                    <td className="mono">{eur(y.sbie, true)}</td>
                    <td className="mono">{eur(y.topUp, true)}</td>
                    <td className="mono">{eur(y.cashTax, true)}</td>
                    <td className="mono">{eur(y.netBenefit, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted" style={{ padding: "12px 16px 16px", margin: 0, fontSize: 13 }}>{pick.legal}</p>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-head"><h4>Certificate register · project vs jurisdiction</h4></div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Certificate</th>
                  <th>Holiday / reduced</th>
                  <th>1/2566 conversion</th>
                  <th>Promoted GloBE</th>
                  <th>Cap left</th>
                </tr>
              </thead>
              <tbody>
                {O.certificates.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{c.name}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>{c.certNo} · {c.extractedFrom}</div>
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{c.remainingFullExemptionYears}y at 0% · {c.remainingReducedYears}y at 10%</td>
                    <td className="mono" style={{ fontSize: 12 }}>{conversionYears(c.remainingFullExemptionYears)}y at 10%</td>
                    <td className="mono">{eur(c.promotedGlobe)}</td>
                    <td className="mono">{eur(c.remainingCapUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted" style={{ padding: "0 16px 16px", margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            BOI requires project accounts. Pillar Two blends all Thai CEs. Stranded cap at the FY2026 clawback ratio: {eur(O.strandedUsd)}. Do not drop a high-tax Thai subsidiary without re-running this file.
          </p>
        </div>
        <div className="panel">
          <div className="panel-head"><h4>Jurisdictional blending</h4><span className="tag tag-outline">{pct(O.blending.blendedEtr, 2)} ETR</span></div>
          <div className="panel-body waterfall">
            <div className="wf-row"><span>BOI / promoted GloBE</span><span>{eur(O.blending.boiGlobe)}</span></div>
            <div className="wf-row"><span>Covered tax on promoted</span><span>{eur(O.blending.boiCovered)}</span></div>
            <div className="wf-row"><span>Other Thai GloBE</span><span>{eur(O.blending.otherGlobe)}</span></div>
            <div className="wf-row"><span>Covered tax on other Thai</span><span>{eur(O.blending.otherCovered)}</span></div>
            <div className="wf-row total"><span>Thai jurisdictional ETR</span><span>{pct(O.blending.blendedEtr, 2)}</span></div>
          </div>
          <p className="text-muted" style={{ padding: "0 16px 16px", margin: 0, fontSize: 13, lineHeight: 1.5 }}>{O.blending.note}</p>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-head"><h4>Harbour gate · before you assert a clawback</h4></div>
          <div className="panel-body">
            {O.harbours.map((h) => (
              <div key={h.test} className="wf-row">
                <span>{h.test}</span>
                <span><span className={`tag ${h.result === "Pass" ? "tag-ok" : h.result === "Fail" ? "tag-hot" : "tag-warn"}`}>{h.result}</span></span>
              </div>
            ))}
            <p className="text-muted" style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.5 }}>
              {th.sh.navigator} Manufacturing SBIE (payroll + plant) is why some of the holiday survives. An asset-light, high-margin BOI project would keep less.
            </p>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h4>FY2026 keep-holiday waterfall</h4><span className="tag tag-ok">SBTISH candidate</span></div>
          <div className="panel-body waterfall">
            <div className="wf-row"><span>Promoted GloBE</span><span>{eur(v.promotedGlobe)}</span></div>
            <div className="wf-row"><span>Non-promoted GloBE</span><span>{eur(v.nonPromotedGlobe)}</span></div>
            <div className="wf-row"><span>CIT if no holiday (20%)</span><span>{eur(v.citIfNoHoliday)}</span></div>
            <div className="wf-row total"><span>Nominal BOI benefit</span><span>{eur(v.nominal)}</span></div>
            <div className="wf-row"><span>− Thai QDMTT</span><Amount n={v.thaiTopUp} audit={th.audit} /></div>
            <div className="wf-row"><span>− Foreign IIR / UTPR</span><span>{eur(v.foreignIir + v.foreignUtpr)}</span></div>
            <div className="wf-row total"><span>Net retained</span><Amount n={keep.fy0.netBenefit} audit={O.audit.net} /></div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h4>Worked illustration · not the Aetherion file</h4>
          <span className="tag tag-outline">{W.unit}</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Thai operations</th>
                <th>GloBE income</th>
                <th>Covered taxes</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>BOI factory under tax holiday</td><td className="mono">{W.boiGlobe.toLocaleString("en-GB")}</td><td className="mono">0</td></tr>
              <tr><td>Normal Thai entity taxed at 20%</td><td className="mono">{W.otherGlobe.toLocaleString("en-GB")}</td><td className="mono">{W.citOrdinary.toLocaleString("en-GB")}</td></tr>
              <tr><td>Thailand total</td><td className="mono">{W.globe.toLocaleString("en-GB")}</td><td className="mono">{W.covered.toLocaleString("en-GB")}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="panel-body waterfall">
          <div className="wf-row"><span>Thai ETR</span><span>{pct(W.etr, 2)}</span></div>
          <div className="wf-row"><span>SBIE</span><span>{W.sbie.toLocaleString("en-GB")}</span></div>
          <div className="wf-row"><span>Excess profit</span><span>{W.excess.toLocaleString("en-GB")}</span></div>
          <div className="wf-row"><span>Top-up ≈ (15% − ETR) × excess</span><span>{W.topUp.toLocaleString("en-GB")}</span></div>
          <div className="wf-row"><span>Ordinary CIT + top-up</span><span>{W.totalWithBoi.toLocaleString("en-GB")}</span></div>
          <div className="wf-row"><span>CIT if no BOI</span><span>{W.citIfNoBoi.toLocaleString("en-GB")}</span></div>
          <div className="wf-row total"><span>Advertised saving / clawback / remaining</span><span>{W.advertised.toLocaleString("en-GB")} / {W.topUp.toLocaleString("en-GB")} / {W.remaining.toLocaleString("en-GB")}</span></div>
        </div>
        <p className="text-muted" style={{ padding: "0 16px 16px", margin: 0, fontSize: 13, lineHeight: 1.5 }}>
          {W.note} At locked BOT USD/THB {W.usdThb}: remaining benefit about {eur(W.usd.remaining)}. Illustration only — Aetherion numbers are in the scenario table.
        </p>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-head"><h4>QRTC / SBTISH · do not book</h4><span className="tag tag-warn">Pending</span></div>
          <div className="panel-body waterfall">
            <div className="wf-row"><span>Illustrative qualifying spend</span><span>{eur(O.qrtc.spend)}</span></div>
            <div className="wf-row"><span>Illustrative cash credit ({pct(BOI_OPT.qrtcCreditRate, 0)})</span><span>{eur(O.qrtc.cash)}</span></div>
            <div className="wf-row total"><span>Booking status</span><span>Not available</span></div>
          </div>
          <p className="text-muted" style={{ padding: "0 16px 16px", margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            {O.qrtc.note} OECD January 2026 Substance-based Tax Incentive Safe Harbour is a second design route. Thai implementation is untested.{" "}
            <a href="https://www.boi.go.th/index.php?_module=news&from_page=press_releases2&page=press_releases_detail&topic_id=138180" target="_blank" rel="noreferrer">BOI QRTC announcement</a>
            {" · "}
            <a href="https://www.oecd.org/en/topics/sub-issues/global-minimum-tax/global-anti-base-erosion-model-rules-pillar-two.html" target="_blank" rel="noreferrer">OECD 2026 package</a>
          </p>
        </div>
        <div className="panel">
          <div className="panel-head"><h4>Non-tax BOI value · still counts</h4></div>
          <div className="panel-body">
            {NON_TAX_PRIVILEGES.map((p) => (
              <div key={p.id} className="wf-row">
                <span>{p.title}</span>
                <span style={{ maxWidth: 280, textAlign: "right" }} className="text-muted">{p.body}</span>
              </div>
            ))}
            <p className="text-muted" style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.5 }}>
              Even if QDMTT recaptures most of the CIT holiday, BOI is not “negative” versus ordinary 20% CIT in this file. The damage is a 0% investment model that only keeps a fraction of that benefit, plus two ledgers (project BOI vs Thai GloBE).
            </p>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h4>Playbook · close the incentive decision</h4>
          <Link href="/playbook/boi-optimizer" className="btn btn-ghost">Full playbook</Link>
        </div>
        {BOI_PLAY.map((s) => (
          <div key={s.n} style={{ display: "grid", gridTemplateColumns: "56px 1fr auto", gap: 16, alignItems: "start", padding: "18px 20px", borderBottom: "1px solid var(--color-divider)" }}>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22, color: "var(--color-accent)" }}>{s.n}</div>
            <div>
              <h4 style={{ margin: 0 }}>{s.title}</h4>
              <p className="text-muted" style={{ margin: "6px 0 0", fontSize: 14 }}>{s.body}</p>
            </div>
            <Link href={s.href} className="btn btn-primary">{s.hrefLabel}</Link>
          </div>
        ))}
      </div>
    </div>
  );
}

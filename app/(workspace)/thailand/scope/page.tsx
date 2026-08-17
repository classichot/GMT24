"use client";

import Link from "next/link";
import { ThaiPackBar } from "@/components/ThaiPackBar";
import { eur, thb } from "@/lib/format";
import { COVERED_TAX_Q, EUR_MATERIAL_PRESENTATION, EUR_PERMANENT_DIFF, GAAP_WHITELIST, THAI_PACK, botRate, thaiScopeMemo } from "@/lib/thailand";
import { useStore } from "@/lib/store";

export default function ThaiScopePage() {
  const { ask } = useStore();
  const memo = thaiScopeMemo();
  const eurThb = botRate("BOT-EUR-THB-202512");

  return (
    <div>
      <ThaiPackBar />
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Thai Scope Determination Memorandum.</strong> EUR 750 million in at least two of the preceding four fiscal years, converted at the prescribed BOT rate. Proration for non-12-month years. Accepted GAAP from DG Notification No. 1. This is a Thai statutory test sitting on top of the OECD scope engine.
        </div>
        <div className="stack-actions">
          <Link href="/scope" className="btn btn-secondary">OECD scope</Link>
          <button className="btn btn-primary" onClick={() => ask("Is Aetherion in scope of Thai top-up tax?")}>Ask GMT24</button>
        </div>
      </div>

      <div className="kpi-grid cols-4" style={{ marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Determination</div>
          <div className="kpi-val" style={{ fontSize: 22 }}>{memo.status}</div>
          <div className="kpi-sub">{memo.hits} of {memo.window} years · need {memo.required}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">EUR 750m → THB</div>
          <div className="kpi-val" style={{ fontSize: 22 }}>{thb(memo.thresholdThb, true)}</div>
          <div className="kpi-sub">{eurThb.pair} {eurThb.rate} · {eurThb.asOf}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Presentation Δ test</div>
          <div className="kpi-val" style={{ fontSize: 22 }}>{eur(EUR_MATERIAL_PRESENTATION, true)}</div>
          <div className="kpi-sub">EUR 75m material difference</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Permanent Δ test</div>
          <div className="kpi-val" style={{ fontSize: 22 }}>{eur(EUR_PERMANENT_DIFF, true)}</div>
          <div className="kpi-sub">EUR 1m</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h4>Four-year revenue window · BOT locked</h4><span className="tag tag-ok">Rates archived</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>FY</th><th className="num">CFS USD</th><th className="num">USD/THB</th><th className="num">Revenue THB</th><th className="num">Threshold THB</th><th>Hit</th></tr></thead>
            <tbody>
              {memo.years.map((y) => (
                <tr key={y.fy}>
                  <td>{y.fy}</td>
                  <td className="num">{eur(y.usd, true)}</td>
                  <td className="num">{y.usdThb.toFixed(2)}</td>
                  <td className="num">{thb(y.thbRev, true)}</td>
                  <td className="num">{thb(y.thbThr, true)}</td>
                  <td>{y.hit ? <span className="tag tag-ok">Hit</span> : <span className="tag tag-neutral">Below</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted" style={{ padding: "12px 16px 16px", margin: 0, fontSize: 13, lineHeight: 1.5 }}>
          {memo.gaap} {memo.proration} Evidence: {memo.evidence}. A manual year-end rate would raise a validation warning — open <Link href="/thailand/fx">BOT FX</Link>.
        </p>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-head"><h4>Notification No. 1 · accepted GAAP</h4></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Standard</th><th>Jurisdictions</th><th>Accepted</th></tr></thead>
              <tbody>
                {GAAP_WHITELIST.map((g) => (
                  <tr key={g.standard}>
                    <td>{g.standard}</td>
                    <td style={{ fontSize: 12 }}>{g.jurisdictions}</td>
                    <td>{g.accepted ? "Yes" : "Test required"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h4>Notification No. 2 · covered-tax questionnaire</h4></div>
          <div className="panel-body">
            {COVERED_TAX_Q.map((r) => (
              <div className="wf-row" key={r.q}>
                <span>{r.q}<div className="text-muted" style={{ fontSize: 12 }}>{r.a}</div></span>
                <span className="text-muted">{r.include === true ? "Covered" : r.include === false ? "Out" : "N/A"}</span>
              </div>
            ))}
            <p className="text-muted" style={{ margin: "12px 0 0", fontSize: 12 }}>
              Result posts to Adjusted Covered Taxes only after reviewer approval. Rationale is stored. Engine: {THAI_PACK.engine}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Amount } from "@/components/Amount";
import { ThaiPackBar } from "@/components/ThaiPackBar";
import { useCalc } from "@/lib/useCalc";
import { useStore } from "@/lib/store";
import { eur, pct } from "@/lib/format";
import { ASSET_LINES, PAYROLL_LINES, SBIE_RATES, THAI_PACK, thaiSbie } from "@/lib/thailand";
import type { AuditNode } from "@/lib/engine";

export default function ThaiSbiePage() {
  const { ask } = useStore();
  const { calcs } = useCalc();
  const th = calcs.find((c) => c.iso === "TH");
  const s = thaiSbie();
  const audit: AuditNode = {
    id: "TH-sbie-pack",
    label: "Thai SBIE (Notification No. 4 / MOF No. 1)",
    amount: s.sbie,
    kind: "formula",
    ruleId: s.ruleId,
    ruleVersion: s.ruleVersion,
    detail: s.detail,
    children: th ? [th.trace.sbie] : undefined,
  };

  return (
    <div>
      <ThaiPackBar />
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Exact Thai SBIE Engine.</strong> Notification No. 4 is a different data model from the generic OECD carve-out. Rates come from MOF Notification No. 1 and follow the <em>fiscal year start date</em>, not the filing date. FY{THAI_PACK.fy.replace("FY", "")} start {THAI_PACK.fyStart}: payroll {pct(s.rates.payroll, 1)} / assets {pct(s.rates.assets, 1)}.
        </div>
        <div className="stack-actions">
          <Link href="/sbie" className="btn btn-secondary">OECD SBIE</Link>
          <button className="btn btn-primary" onClick={() => ask("How does Thai SBIE differ from the OECD SBIE engine?")}>Ask GMT24</button>
        </div>
      </div>

      <div className="grid-split" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-head"><h4>Thai SBIE bridge</h4><span className="tag tag-accent">{s.ruleId}</span></div>
          <div className="panel-body waterfall">
            <div className="wf-row"><span>Eligible payroll (after proportional / capitalised exclusions)</span><span>{eur(s.payrollEligible)}</span></div>
            <div className="wf-row"><span>× {pct(s.rates.payroll, 1)} payroll carve-out</span><span>{eur(s.payrollCarve)}</span></div>
            <div className="wf-row"><span>Eligible tangible assets (average OC, revaluation out)</span><span>{eur(s.assetsEligible)}</span></div>
            <div className="wf-row"><span>× {pct(s.rates.assets, 1)} asset carve-out</span><span>{eur(s.assetCarve)}</span></div>
            <div className="wf-row total"><span>Thai SBIE</span><Amount n={s.sbie} audit={audit} /></div>
            {th && (
              <div className="wf-row">
                <span>OECD engine SBIE (same FY rates)<div className="text-muted" style={{ fontSize: 12 }}>Reconcile to the GloBE Core. Differences are Notification No. 4 inclusions (contractors, proportional days, licences).</div></span>
                <Amount n={th.sbie} audit={th.trace.sbie} />
              </div>
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h4>MOF transitional rates</h4><span className="text-muted">By fiscal-year beginning</span></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>FY beginning</th><th className="num">Payroll</th><th className="num">Assets</th></tr></thead>
              <tbody>
                {SBIE_RATES.map((r) => (
                  <tr key={r.from} style={r.from === THAI_PACK.fyStart ? { fontWeight: 800 } : undefined}>
                    <td>{r.from.slice(0, 4)}{r.to ? "" : " onward"}</td>
                    <td className="num">{pct(r.payroll, 1)}</td>
                    <td className="num">{pct(r.assets, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h4>Payroll component · Notification No. 4</h4></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Line</th><th>Entity</th><th className="num">Amount</th><th className="num">Include</th><th>Treatment</th></tr></thead>
            <tbody>
              {PAYROLL_LINES.map((r) => (
                <tr key={r.id}>
                  <td>{r.label}</td>
                  <td className="mono">{r.entityId}</td>
                  <td className="num">{eur(r.amount, true)}</td>
                  <td className="num">{pct(r.include, 0)}</td>
                  <td style={{ fontSize: 12 }}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h4>Tangible-asset component · Notification No. 4</h4></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Line</th><th>Entity</th><th className="num">Opening</th><th className="num">Closing</th><th className="num">Include</th><th>Treatment</th></tr></thead>
            <tbody>
              {ASSET_LINES.map((r) => (
                <tr key={r.id}>
                  <td>{r.label}</td>
                  <td className="mono">{r.entityId}</td>
                  <td className="num">{eur(r.opening, true)}</td>
                  <td className="num">{eur(r.closing, true)}</td>
                  <td className="num">{pct(r.include, 0)}</td>
                  <td style={{ fontSize: 12 }}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

"use client";

import { calculateGroup, PAYROLL_RATE, ASSET_RATE } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { eur } from "@/lib/format";
import { Amount } from "@/components/Amount";

export default function SbiePage() {
  const { groupId } = useStore();
  const calcs = calculateGroup(groupId);
  const th = calcs.find((c) => c.iso === "TH") ?? calcs[0];
  return (
    <div>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        FY2026 SBIE rates from OECD-SBIE-2026 v2026.1: payroll {(PAYROLL_RATE * 100).toFixed(1)}% · tangible assets {(ASSET_RATE * 100).toFixed(1)}%. Every component traces to payroll files and the fixed-asset register.
      </p>
      <div className="grid-split">
        <div className="panel">
          <div className="panel-head"><h4>{th.name} bridge</h4></div>
          <div className="panel-body waterfall">
            <div className="wf-row"><span>GloBE income</span><Amount n={th.globeIncome} audit={th.audit} /></div>
            <div className="wf-row"><span>− Payroll carve-out</span><span>{eur(th.payrollCarve)}</span></div>
            <div className="wf-row"><span>− Asset carve-out</span><span>{eur(th.assetCarve)}</span></div>
            <div className="wf-row total"><span>Excess profit</span><strong>{eur(th.excess)}</strong></div>
          </div>
        </div>
        <div className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Jurisdiction</th><th className="num">Payroll</th><th className="num">Assets</th><th className="num">SBIE</th><th className="num">Excess</th></tr></thead>
              <tbody>
                {calcs.map((c) => (
                  <tr key={c.iso}>
                    <td>{c.name}</td>
                    <td className="num">{eur(c.payrollCarve, true)}</td>
                    <td className="num">{eur(c.assetCarve, true)}</td>
                    <td className="num">{eur(c.sbie, true)}</td>
                    <td className="num">{eur(c.excess, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

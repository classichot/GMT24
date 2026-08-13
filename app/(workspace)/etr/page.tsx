"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { calculateGroup } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { eur, pct } from "@/lib/format";
import { Amount } from "@/components/Amount";

function Inner() {
  const { groupId } = useStore();
  const calcs = calculateGroup(groupId);
  const iso = useSearchParams().get("iso");
  const sel = calcs.find((c) => c.iso === iso) ?? calcs[0];
  return (
    <div className="grid-split">
      <div className="panel">
        <div className="panel-head"><h4>{sel.name} ETR</h4></div>
        <div className="panel-body waterfall">
          <div className="wf-row"><span>Covered taxes</span><Amount n={sel.coveredTax} audit={sel.audit} /></div>
          <div className="wf-row"><span>÷ GloBE income</span><Amount n={sel.globeIncome} audit={sel.audit} /></div>
          <div className="wf-row total"><span>Jurisdictional ETR</span><strong>{pct(sel.etr, 2)}</strong></div>
          <div className="wf-row"><span>Minimum rate</span><span>15.00%</span></div>
          <div className="wf-row"><span>Top-up rate</span><span>{pct(sel.topUpRate, 2)}</span></div>
        </div>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Jurisdiction</th><th className="num">GloBE</th><th className="num">Covered</th><th className="num">ETR</th><th>Result</th></tr></thead>
            <tbody>
              {calcs.map((c) => (
                <tr key={c.iso}>
                  <td>{c.name}</td>
                  <td className="num">{eur(c.globeIncome, true)}</td>
                  <td className="num">{eur(c.coveredTax, true)}</td>
                  <td className="num">{pct(c.etr, 1)}</td>
                  <td>{c.exposure}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}

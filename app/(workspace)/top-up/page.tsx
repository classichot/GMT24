"use client";

import { calculateGroup, totals } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { eur, pct } from "@/lib/format";
import { Amount } from "@/components/Amount";

export default function TopUpPage() {
  const { groupId, ask } = useStore();
  const calcs = calculateGroup(groupId);
  const t = totals(calcs);
  const th = calcs.find((c) => c.iso === "TH") ?? calcs[0];
  return (
    <div>
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>{th.name} top-up tax: </strong>
          <Amount n={th.jurisdictionalTopUp} audit={th.audit} />
          — click it. The trail walks rate → ETR → covered taxes → deferred tax → entity → account → trial balance → uploaded file. Rule {th.audit.ruleId} v{th.audit.ruleVersion}.
        </div>
        <button className="btn btn-primary" onClick={() => ask("Why is Thailand's ETR 10.8%?")}>Ask GMT24</button>
      </div>
      <div className="panel">
        <div className="panel-head"><h4>Jurisdictional calculation</h4><span>Group {eur(t.topUp)}</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Jurisdiction</th><th className="num">GloBE</th><th className="num">Covered</th><th className="num">ETR</th><th className="num">Top-up %</th><th className="num">SBIE</th><th className="num">Excess</th><th className="num">Top-up</th>
              </tr>
            </thead>
            <tbody>
              {calcs.map((c) => (
                <tr key={c.iso}>
                  <td>{c.name}</td>
                  <td className="num">{eur(c.globeIncome, true)}</td>
                  <td className="num">{eur(c.coveredTax, true)}</td>
                  <td className="num">{pct(c.etr, 1)}</td>
                  <td className="num">{pct(c.topUpRate, 2)}</td>
                  <td className="num">{eur(c.sbie, true)}</td>
                  <td className="num">{eur(c.excess, true)}</td>
                  <td className="num"><Amount n={c.jurisdictionalTopUp} audit={c.audit} compact /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

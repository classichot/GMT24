"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { eur, pct } from "@/lib/format";
import { Amount } from "@/components/Amount";
import { FlowBar } from "@/components/FlowBar";
import { useCalc } from "@/lib/useCalc";
import { useStore } from "@/lib/store";

export default function TopUpPage() {
  const { ask } = useStore();
  const { calcs, t } = useCalc();
  const router = useRouter();
  const th = calcs.find((c) => c.iso === "TH") ?? calcs[0];
  return (
    <div>
      <FlowBar iso={th.iso} />
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>{th.name} top-up tax: </strong>
          <Amount n={th.jurisdictionalTopUp} audit={th.audit} />
          — click it. The trail walks rate → ETR → covered taxes → entity → account → source file. Rule {th.audit.ruleId} v{th.audit.ruleVersion}.
        </div>
        <div className="stack-actions">
          <button className="btn btn-primary" onClick={() => ask("Why is Thailand's ETR 10.8%?")}>Ask GMT24</button>
          <Link href="/allocation" className="btn btn-secondary">Who pays</Link>
          <Link href="/gir" className="btn btn-secondary">GIR</Link>
        </div>
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
                <tr key={c.iso} className="clickable" onClick={() => router.push(`/etr?iso=${c.iso}`)}>
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

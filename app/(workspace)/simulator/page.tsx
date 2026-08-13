"use client";

import Link from "next/link";
import { eur } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useCalc } from "@/lib/useCalc";

export default function SimulatorPage() {
  const { scenario, setScenario } = useStore();
  const { calcs, t } = useCalc();
  const th = calcs.find((c) => c.iso === "TH")!;
  const ie = calcs.find((c) => c.iso === "IE")!;
  const next = t.topUp;

  return (
    <div>
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>GMT24 Simulator re-runs the deterministic engine under changed assumptions. It does not ask an LLM to guess the tax. Live numbers now feed the dashboard, ETR map, top-up and GIR.</div>
        <div className="stack-actions">
          <Link href="/overview" className="btn btn-secondary">Dashboard</Link>
          <Link href="/top-up" className="btn btn-primary">Top-up</Link>
          <Link href="/forecast" className="btn btn-secondary">Forecast</Link>
        </div>
      </div>
      <div className="grid-score" style={{ marginBottom: 24 }}>
        <div className="panel" style={{ padding: 24 }}>
          <div className="kpi-label">Scenario top-up</div>
          <div className="kpi-val">{eur(next)}</div>
          <div className="kpi-sub">Live group total · Thailand {eur(th.jurisdictionalTopUp)} · Ireland {eur(ie.jurisdictionalTopUp)}</div>
        </div>
        <div className="panel">
          <div className="panel-body" style={{ display: "grid", gap: 16 }}>
            <label className="chip" style={{ justifyContent: "space-between" }}>
              <span>Extend Thai BOI through 2031</span>
              <input type="checkbox" checked={scenario.boiExtend} onChange={(e) => setScenario({ boiExtend: e.target.checked })} />
            </label>
            <div>
              <div className="kpi-label">Increase Thai eligible payroll ($m)</div>
              <input className="input" type="range" min={0} max={20} value={scenario.payrollTh / 1_000_000} onChange={(e) => setScenario({ payrollTh: Number(e.target.value) * 1_000_000 })} />
              <div>{eur(scenario.payrollTh)} additional payroll</div>
            </div>
            <div>
              <div className="kpi-label">Ireland TP margin on IP {scenario.tpMargin}%</div>
              <input className="input" type="range" min={1} max={8} step={0.5} value={scenario.tpMargin} onChange={(e) => setScenario({ tpMargin: Number(e.target.value) })} />
              <div className="text-muted" style={{ fontSize: 13 }}>A TP adjustment changes jurisdictional profit, which changes GloBE income, ETR and top-up. This is the long-term GMT24 ↔ TP24 link.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { calculateGroup, totals } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { eur } from "@/lib/format";

export default function SimulatorPage() {
  const { groupId, scenario, setScenario } = useStore();
  const calcs = calculateGroup(groupId);
  const t = totals(calcs);
  const th = calcs.find((c) => c.iso === "TH")!;
  const ie = calcs.find((c) => c.iso === "IE")!;

  const boiDelta = scenario.boiExtend ? -Math.round(th.jurisdictionalTopUp * 0.62) : 0;
  const payrollDelta = -Math.round(scenario.payrollTh * 0.094 * th.topUpRate);
  const tpDelta = Math.round((scenario.tpMargin - 3) / 2 * ie.jurisdictionalTopUp * 0.08);
  const next = t.topUp + boiDelta + payrollDelta + tpDelta;

  return (
    <div>
      <div className="callout" style={{ marginBottom: 20 }}>
        GMT24 Simulator re-runs the deterministic engine under changed assumptions. It does not ask an LLM to guess the tax.
      </div>
      <div className="grid-score" style={{ marginBottom: 24 }}>
        <div className="panel" style={{ padding: 24 }}>
          <div className="kpi-label">Scenario top-up</div>
          <div className="kpi-val">{eur(next)}</div>
          <div className="kpi-sub">Base {eur(t.topUp)} · Δ {eur(next - t.topUp)}</div>
        </div>
        <div className="panel">
          <div className="panel-body" style={{ display: "grid", gap: 16 }}>
            <label className="chip" style={{ justifyContent: "space-between" }}>
              <span>Extend Thai BOI through 2031</span>
              <input type="checkbox" checked={scenario.boiExtend} onChange={(e) => setScenario({ boiExtend: e.target.checked })} />
            </label>
            <div>
              <div className="kpi-label">Increase Thai eligible payroll (€m)</div>
              <input className="input" type="range" min={0} max={20} value={scenario.payrollTh / 1_000_000} onChange={(e) => setScenario({ payrollTh: Number(e.target.value) * 1_000_000 })} />
              <div>{eur(scenario.payrollTh)} additional payroll → SBIE effect {eur(payrollDelta)}</div>
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

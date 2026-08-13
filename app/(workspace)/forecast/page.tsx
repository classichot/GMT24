"use client";

import { FORECAST } from "@/lib/model";
import { eur } from "@/lib/format";
import { useCalc } from "@/lib/useCalc";
import Link from "next/link";

export default function ForecastPage() {
  const { t } = useCalc();
  const projected = FORECAST.reduce((a, p) => a + p.topUp, 0);
  return (
    <div>
      <div className="callout" style={{ marginBottom: 20 }}>
        Don’t wait until year-end. Monthly / quarterly actuals + forecast feed the same engine. YTD uses the live (scenario-aware) calculation.{" "}
        <Link href="/simulator">Open simulator</Link>
      </div>
      <div className="kpi-grid cols-3" style={{ marginBottom: 20 }}>
        <div className="kpi"><div className="kpi-label">FY2026 YTD calc</div><div className="kpi-val">{eur(t.topUp, true)}</div></div>
        <div className="kpi"><div className="kpi-label">Projected FY2027</div><div className="kpi-val">{eur(projected, true)}</div><div className="kpi-sub hot">in-year run</div></div>
        <div className="kpi"><div className="kpi-label">Q4 remaining</div><div className="kpi-val">{eur(FORECAST[3].topUp, true)}</div></div>
      </div>
      <div className="panel">
        <div className="panel-body">
          {FORECAST.map((p) => (
            <div key={p.period} style={{ display: "grid", gridTemplateColumns: "140px 1fr 100px", gap: 12, alignItems: "center", marginBottom: 10 }}>
              <div>{p.period}</div>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${(p.topUp / 5_100_000) * 100}%` }} /></div>
              <div className="num">{eur(p.topUp, true)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ThaiPackBar } from "@/components/ThaiPackBar";
import { thb } from "@/lib/format";
import { BOT_RATES, EUR_THRESHOLD, botRate } from "@/lib/thailand";
import { useStore } from "@/lib/store";

const METHODS = [
  { n: "01", title: "EUR statutory thresholds → THB", body: "BOT average midpoint for December preceding the relevant fiscal year. Locks EUR 750m, EUR 75m and EUR 1m into baht." },
  { n: "02", title: "Foreign-currency financials → THB", body: "The same prescribed prior-December BOT rate, used to compare UPE CFS revenue with the Thai threshold." },
  { n: "03", title: "Actual tax payment or refund → THB", body: "BOT-calculated commercial-bank average buy/sell on the last business day before payment or refund approval, with fallback to the last available rate." },
];

export default function ThaiFxPage() {
  const { ask, flash } = useStore();
  const [override, setOverride] = useState("");
  const locked = botRate("BOT-EUR-THB-202512");
  const warn = override !== "" && Number(override) !== locked.rate;

  return (
    <div>
      <ThaiPackBar />
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>BOT Foreign-Exchange Engine.</strong> Three conversion methods under DG Notification No. 6. GMT24 retrieves, locks and archives the rate. A convenient year-end rate cannot be applied silently.
        </div>
        <div className="stack-actions">
          <button className="btn btn-primary" onClick={() => ask("Which Bank of Thailand rate does GMT24 lock for the EUR 750m test?")}>Ask GMT24</button>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {METHODS.map((m) => (
          <div key={m.n} className="panel">
            <div className="panel-body">
              <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-accent)", fontWeight: 700 }}>{m.n}</div>
              <h4 style={{ margin: "8px 0 6px" }}>{m.title}</h4>
              <p className="text-muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{m.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h4>Locked archive</h4><span className="tag tag-ok">Immutable for this snapshot</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>ID</th><th>Pair</th><th>As of</th><th>Method</th><th className="num">Rate</th><th>Source</th></tr></thead>
            <tbody>
              {BOT_RATES.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id}</td>
                  <td>{r.pair}</td>
                  <td>{r.asOf}</td>
                  <td>{r.method}</td>
                  <td className="num">{r.rate.toFixed(4)}</td>
                  <td style={{ fontSize: 12 }}>{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h4>Override test · EUR/THB FY2026 threshold</h4></div>
        <div className="panel-body">
          <p className="text-muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
            Locked rate {locked.rate.toFixed(4)} → EUR 750m = {thb(EUR_THRESHOLD * locked.rate, true)}. Type a different year-end rate to see the validation warning. The engine will not silently accept it.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <input className="input" style={{ maxWidth: 200 }} placeholder={String(locked.rate)} value={override} onChange={(e) => setOverride(e.target.value)} />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => flash(warn ? "Validation warning: proposed rate is not the locked BOT December midpoint. Snapshot unchanged." : "Rate matches the locked BOT archive.")}
            >
              Propose rate
            </button>
          </div>
          {warn && (
            <div className="callout" style={{ marginTop: 16 }}>
              <strong>Validation warning.</strong> {override} is not {locked.rate} ({locked.id}). GMT24 will not restate the EUR 750m THB threshold or CFS comparison without a documented BOT correction and reviewer approval.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

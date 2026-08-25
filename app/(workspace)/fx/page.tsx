"use client";

import Link from "next/link";
import { ENTITIES, FINANCIALS } from "@/lib/model";
import { EUR_1M_USD, EUR_75M_USD, FX_RATES, fxRate, gaapScreen, usdFromFc } from "@/lib/fx";
import { eur } from "@/lib/format";

export default function FxPage() {
  return (
    <div>
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Locked FX table.</strong> FANIL in functional currency is translated to USD at these FY2026 mid-rates. Changing a rate restates USD FANIL. Thailand uses the BOT December midpoint (Notification No. 6); other countries use the UPE CFS average rate.
          {" "}Art. 3.1.2 / 3.1.3: local GAAP is allowed only if the EUR 75m presentation and EUR 1m permanent-difference screens pass ({eur(EUR_75M_USD, true)} / {eur(EUR_1M_USD, true)}).
        </div>
        <div className="stack-actions">
          <Link href="/thailand/fx" className="btn btn-secondary">Thai BOT FX</Link>
          <Link href="/globe-income" className="btn btn-primary">FANIL / GloBE income</Link>
          <Link href="/elections" className="btn btn-secondary">Art. 3.1.3 election</Link>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h4>FY2026 locked rates</h4><span className="tag tag-ok">Immutable for this snapshot</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Iso</th><th>Pair</th><th>Currency</th><th className="num">Local / USD</th><th>As of</th><th>Source</th>
              </tr>
            </thead>
            <tbody>
              {FX_RATES.filter((r, i, a) => a.findIndex((x) => x.iso === r.iso) === i).map((r) => (
                <tr key={`${r.iso}-${r.pair}`}>
                  <td className="mono">{r.iso}</td>
                  <td>{r.pair}</td>
                  <td>{r.currency}</td>
                  <td className="num">{r.localPerUsd.toLocaleString("en-GB", { maximumFractionDigits: 4 })}</td>
                  <td>{r.asOf}</td>
                  <td style={{ fontSize: 12 }}>{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h4>FANIL translation + GAAP screen</h4></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Entity</th><th>FX</th><th className="num">Functional FANIL</th><th className="num">USD FANIL</th><th>GAAP</th><th>Art. 3.1.2 / 3.1.3</th>
              </tr>
            </thead>
            <tbody>
              {ENTITIES.map((e) => {
                const f = FINANCIALS.find((x) => x.entityId === e.id);
                if (!f) return null;
                const fx = fxRate(e.iso);
                const usd = f.fanilFc != null ? usdFromFc(e.iso, f.fanilFc) : f.fanil;
                const screen = gaapScreen({ basis: e.gaapBasis ?? "upe", upeFanil: f.fanil, localFanil: e.fanilLocal });
                return (
                  <tr key={e.id}>
                    <td>{e.code} · {e.name}</td>
                    <td>{e.fx} · {fx.asOf}</td>
                    <td className="num">{f.fanilFc != null ? `${f.fanilFc.toLocaleString("en-GB")} ${e.fx}` : "—"}</td>
                    <td className="num">{eur(usd, true)}</td>
                    <td>{e.gaap}</td>
                    <td style={{ fontSize: 12 }}>
                      {e.fanilLocal != null
                        ? (screen.localAllowed
                          ? `Local allowed · Δ ${eur(screen.permanentDiff, true)} vs UPE CFS`
                          : screen.detail)
                        : "UPE CFS (Art. 3.1.1)"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

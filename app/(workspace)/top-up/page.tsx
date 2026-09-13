"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Amount } from "@/components/Amount";
import { FlowBar } from "@/components/FlowBar";
import { useCalc } from "@/lib/useCalc";
import { useStore } from "@/lib/store";
import { pickCalc, etrHref } from "@/lib/engine";
import { BlendBadge, EtrGroupsBadge } from "@/components/BlendBadge";
import { fxNoteText, fxRowsFor } from "@/components/FxNote";

export default function TopUpPage() {
  const { ask } = useStore();
  const { calcs, t } = useCalc();
  const router = useRouter();
  const th = pickCalc(calcs, "TH") ?? calcs[0];
  return (
    <div>
      <FlowBar iso={th.iso} />
      {calcs.some((c) => c.globeIncome > 0 && c.enteOriginated > 0) && (
        <div className="callout" style={{ marginBottom: 16 }}>
          <strong>Top-up % cannot exceed 15%.</strong> 15% is the Minimum Rate (Art. 5.2.1), not a rate stacked on a negative ETR. Where Adjusted Covered Taxes are negative and Net GloBE Income is positive, Excess Negative Tax Expense is mandatory — ETR floors at 0% and Top-up % stays at 15%.{" "}
          {calcs.filter((c) => c.globeIncome > 0 && c.enteOriginated > 0).map((c) => (
            <span key={c.blendKey}>{c.name} carry-forward {c.enteCarryforward.toLocaleString("en-GB")}. </span>
          ))}
          <Link href="/etr?iso=HK">Hong Kong ETR</Link>
        </div>
      )}
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
        <div className="panel-head"><h4>Jurisdictional calculation</h4><span>Group <Amount n={t.topUp} audit={t.audit} compact /></span></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Jurisdiction</th><th title="Locked rate translating this blend to presentation USD — full table on /fx">FX</th><th className="num">GloBE</th><th className="num">Covered</th><th className="num">ETR</th><th className="num">Top-up %</th><th className="num">SBIE</th><th className="num">Excess</th><th className="num">ACTTT</th><th className="num">Less: QDMTT</th><th className="num">Top-up</th>
              </tr>
            </thead>
            <tbody>
              {calcs.map((c) => (
                <tr key={c.blendKey} className="clickable" onClick={() => router.push(etrHref(c))}>
                  <td><span>{c.name}</span><BlendBadge blendKind={c.blendKind} /><EtrGroupsBadge calc={c} calcs={calcs} /></td>
                  <td className="mono" style={{ fontSize: 11, whiteSpace: "nowrap" }} title={fxNoteText(c.entities, c.iso)}>{fxRowsFor(c.entities, c.iso).map(({ row, currency }) => row ? (row.currency === "USD" ? "USD" : `${row.currency} ${row.localPerUsd.toLocaleString("en-GB")}`) : `${currency} ?`).join(" · ")}</td>
                  <td className="num"><Amount n={c.globeIncome} audit={c.trace.globe} compact /></td>
                  <td className="num"><Amount n={c.coveredTax} audit={c.trace.covered} compact /></td>
                  <td className="num">
                    {c.globeIncome > 0 ? (
                      <Amount n={c.etr} audit={c.trace.etr} compact />
                    ) : (
                      <span className="text-muted">N/A (Loss)</span>
                    )}
                  </td>
                  <td className="num">
                    {c.globeIncome > 0 ? (
                      <Amount n={c.topUpRate} audit={c.audit.children?.find((n) => n.id.endsWith("-rate"))} compact />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="num">
                    {c.globeIncome > 0 ? (
                      <Amount n={c.sbie} audit={c.trace.sbie} compact />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="num">
                    {(c.exposure !== "Safe harbour" && c.topUpRate > 0 && c.globeIncome > 0) ? (
                      <Amount n={c.excess} audit={c.trace.excess} compact />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="num"><Amount n={c.additionalCurrentTopUp} audit={c.audit.children?.find((n) => n.id.endsWith("-acttt"))} compact /></td>
                  <td className="num"><Amount n={c.collection.qdmtt} compact /></td>
                  <td className="num"><Amount n={c.collection.iir + c.collection.utpr} compact /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-head">
          <h4>Art. 5.2.4 / 5.2.5 — allocation to Constituent Entities</h4>
          <span className="tag tag-outline">{calcs.filter((c) => c.ceAlloc.jurisdictionalTopUp > 0).length} blends with Top-up Tax</span>
        </div>
        <div className="panel-body text-muted" style={{ fontSize: 12, paddingBottom: 0 }}>
          Jurisdictional Top-up Tax (Top-up % × Excess + Additional Current Top-up Tax) is allocated to each CE in the blend in proportion to GloBE Income (Art. 5.2.4). Where the blend has no Net GloBE Income and ACTTT arises, the share uses deemed GloBE Income = −ACT ÷ 15% (Art. 5.2.5). Collection to QDMTT / IIR / UTPR still happens on the jurisdictional amount — this table is the CE split.
        </div>
        {calcs.filter((c) => c.ceAlloc.jurisdictionalTopUp > 0).map((c) => (
          <div key={c.blendKey} style={{ padding: "12px 16px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
              <strong>{c.name}</strong>
              <span className="text-muted" style={{ fontSize: 12 }}>{c.ceAlloc.basisLabel}</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>CE</th>
                    <th className="num">GloBE</th>
                    <th className="num">Covered</th>
                    <th className="num">Deemed GloBE</th>
                    <th className="num">Share</th>
                    <th className="num">Rate top-up</th>
                    <th className="num">ACTTT</th>
                    <th className="num">Allocated</th>
                  </tr>
                </thead>
                <tbody>
                  {c.ceAlloc.rows.map((r) => (
                    <tr key={r.id}>
                      <td><span className="mono">{r.code}</span> {r.name}<div className="text-muted" style={{ fontSize: 11 }}>{r.type}</div></td>
                      <td className="num"><Amount n={r.globeIncome} compact /></td>
                      <td className="num"><Amount n={r.coveredTax} compact /></td>
                      <td className="num">{r.deemedGlobe ? <Amount n={r.deemedGlobe} compact /> : "—"}</td>
                      <td className="num mono">{(r.share * 100).toFixed(2)}%</td>
                      <td className="num"><Amount n={r.rateTopUp} compact /></td>
                      <td className="num"><Amount n={r.acttt} compact /></td>
                      <td className="num"><Amount n={r.topUp} compact /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Blend</th>
                    <th className="num"><Amount n={c.globeIncome} compact /></th>
                    <th className="num"><Amount n={c.coveredTax} compact /></th>
                    <th />
                    <th className="num">100%</th>
                    <th className="num"><Amount n={c.ceAlloc.rateTopUp} compact /></th>
                    <th className="num"><Amount n={c.ceAlloc.additionalCurrentTopUp} compact /></th>
                    <th className="num"><Amount n={c.ceAlloc.jurisdictionalTopUp} compact /></th>
                  </tr>
                </tfoot>
              </table>
            </div>
            {!c.ceAlloc.reconciling && <p className="status-block" style={{ fontSize: 12, marginTop: 6 }}>Allocation remainder {c.ceAlloc.remainder.toLocaleString("en-GB")} — last-penny rounding did not close.</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

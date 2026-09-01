"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { pct } from "@/lib/format";
import { Amount } from "@/components/Amount";
import { FlowBar } from "@/components/FlowBar";
import { useCalc } from "@/lib/useCalc";
import { useStore } from "@/lib/store";
import { MIN_RATE, pickCalc, etrHref } from "@/lib/engine";

const METHOD = [
  {
    n: "01",
    title: "Blend the jurisdiction",
    body: "ETR is jurisdictional, not entity-level — with the entity-test exceptions. Sum Adjusted Covered Taxes and Net GloBE Income of CEs in the same blend: majority CEs together; a standalone MOCE or MOSG separately (Art. 5.1.3); a JV Group separately (Art. 6.4). Investment Entities are out. Each Stateless CE is its own jurisdiction.",
    refs: ["Art. 5.1.1", "Art. 5.1.2", "Art. 5.1.3", "Art. 6.4"],
  },
  {
    n: "02",
    title: "Take Adjusted Covered Taxes",
    body: "Numerator is Chapter 4, not the P&L tax line: current Covered Tax ± Art. 4.1 additions and reductions + deferred tax recast at the Minimum Rate. Non-covered levies never enter.",
    refs: ["Art. 4.1.1", "Art. 4.4.1"],
  },
  {
    n: "03",
    title: "Divide by Net GloBE Income",
    body: "Denominator is the positive Net GloBE Income of the jurisdiction (GloBE income of profit CEs less GloBE losses of loss CEs). SBIE does not reduce this figure. If Net GloBE Income is zero or negative, no ETR is computed. If Net GloBE Income is positive and Adjusted Covered Taxes are negative, Excess Negative Tax Expense is mandatory (OECD AG Feb 2023): ETR floors at 0% so Top-up % cannot exceed 15%.",
    refs: ["Art. 5.1.1", "Art. 5.1.2", "Art. 3.1"],
  },
  {
    n: "04",
    title: "Compare to 15%",
    body: "If ETR is below the Minimum Rate, Top-up Tax Percentage = Minimum Rate − ETR. That rate is applied to Excess Profit (GloBE income after SBIE), not to GloBE income. ETR itself is unchanged by the carve-out. 15% is the Minimum Rate, not a statutory cap you apply after a negative ETR — ENTE stops the negative ETR from arising.",
    refs: ["Art. 5.2.1", "Art. 5.2.2", "OECD-GloBE-15"],
  },
];

const REFERENCES = [
  { cite: "OECD (2021)", work: "Tax Challenges Arising from the Digitalisation of the Economy – Global Anti-Base Erosion Model Rules (Pillar Two)", loc: "Chapter 5, Art. 5.1 Determination of Effective Tax Rate", href: "/rulebook" },
  { cite: "OECD (2026)", work: "Consolidated Commentary to the GloBE Model Rules", loc: "Arts. 5.1–5.2", href: "/rulebook" },
  { cite: "Art. 5.1.1", work: "ETR = Σ Adjusted Covered Taxes of CEs in the jurisdiction ÷ Net GloBE Income of the jurisdiction", loc: "OECD-GloBE-15 v2026.1", href: "/rulebook" },
  { cite: "Art. 5.1.2", work: "Net GloBE Income = GloBE Income of profit CEs − GloBE Losses of loss CEs. No ETR if net ≤ 0. Positive net + negative Covered Taxes → mandatory ENTE (Hong Kong on this snapshot)", loc: "OECD-ENTE-521 v2023.2", href: "/etr?iso=HK" },
  { cite: "Art. 4.1.1", work: "Adjusted Covered Taxes — numerator of the ETR", loc: "Model Rules Ch. 4", href: "/covered-taxes" },
  { cite: "Art. 4.4.1", work: "Deferred tax recast at the Minimum Rate before it enters Covered Taxes", loc: "OECD-GloBE-15 v2026.1", href: "/covered-taxes" },
  { cite: "Art. 5.2.1", work: "Top-up Tax Percentage = max(0, Minimum Rate − ETR). Cannot exceed 15% once Excess Negative Tax Expense is applied", loc: "OECD-ENTE-521 v2023.2", href: "/top-up" },
  { cite: "Art. 5.2.2", work: "Excess Profit = Net GloBE Income − SBIE — the base the top-up percentage multiplies", loc: "OECD-SBIE-2026 v2026.1", href: "/sbie" },
  { cite: "Art. 5.2.3", work: "Jurisdictional Top-up Tax = (Top-up Tax Percentage × Excess Profit) + Additional Current Top-up Tax − QDMTT", loc: "OECD-GloBE-15 v2026.1", href: "/top-up" },
  { cite: "Art. 5.1.3", work: "MOCE / MOSG — ETR computed separately from other CEs located in the same jurisdiction when UPE ownership ≤ 30%", loc: "OECD-MOCE-513 v2026.1", href: "/entities" },
  { cite: "Art. 2.1.4", work: "POPE applies IIR first on its Ownership Interests (Inclusion Ratio); UPE takes the residual (Art. 2.1.5 / 2.2.2)", loc: "OECD-POPE-214 v2026.1", href: "/allocation" },
  { cite: "Art. 6.4", work: "Joint Venture Group treated as a separate MNE for ETR — not blended with majority CEs", loc: "OECD-JV-64 v2026.1", href: "/entities" },
];

function Inner() {
  const { ask } = useStore();
  const { calcs } = useCalc();
  const router = useRouter();
  const iso = useSearchParams().get("iso");
  const blend = useSearchParams().get("blend");
  const sel = pickCalc(calcs, iso, blend) ?? pickCalc(calcs, "TH") ?? calcs[0];
  const min = pct(MIN_RATE, 0);
  const siblings = calcs.filter((c) => c.iso === sel.iso && c.blendKey !== sel.blendKey);

  return (
    <div>
      <FlowBar iso={sel.iso} />

      {sel.enteOriginated > 0 && (
        <div className="callout" style={{ marginBottom: 16 }}>
          <strong>Excess Negative Tax Expense — mandatory.</strong> {sel.name} has positive Net GloBE Income and negative Adjusted Covered Taxes ({sel.coveredTaxRaw < 0 ? `raw ${pct(sel.coveredTaxRaw / sel.globeIncome, 2)} ETR` : "negative ACT"}). Bare Art. 5.2.1 would be {min} − (negative ETR) and exceed {min}. OECD Feb 2023 AG excludes the negative tax from this year’s numerator, floors ETR at 0%, holds Top-up % at {min}, and carries {sel.enteOriginated.toLocaleString("en-GB")} forward. 15% is the Minimum Rate, not a rate you add on top of a negative ETR.{" "}
          <Link href="/covered-taxes">Covered taxes</Link>
          {" · "}
          <Link href="/top-up">Top-up</Link>
        </div>
      )}
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>ETR method.</strong> {sel.name}: Adjusted Covered Taxes over Net GloBE Income for this blend ({sel.blendKind}). Majority CEs, MOCE/MOSG and JV Groups are not mixed. Formula:{" "}
          <span className="mono">ETR = Covered Taxes ÷ GloBE income</span>
          {" · "}
          <span className="mono">Top-up % = max(0, {min} − ETR)</span>
        </div>
        <div className="stack-actions">
          <Link href="/covered-taxes" className="btn btn-secondary">Covered taxes</Link>
          <Link href="/deferred-tax" className="btn btn-secondary">Deferred tax</Link>
          <Link href="/rulebook" className="btn btn-secondary">Rulebook</Link>
          <button className="btn btn-primary" onClick={() => ask(`Why is ${sel.name}'s ETR ${(sel.etr * 100).toFixed(1)}%?`)}>Ask GMT24</button>
        </div>
      </div>

      {siblings.length > 0 && (
        <p className="text-muted" style={{ marginBottom: 16, fontSize: 13 }}>
          Same country, different blend:{" "}
          {siblings.map((c, i) => (
            <span key={c.blendKey}>
              {i > 0 ? " · " : ""}
              <Link href={etrHref(c)}>{c.name}</Link>
            </span>
          ))}
        </p>
      )}

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {METHOD.map((m) => (
          <div key={m.n} className="panel">
            <div className="panel-body">
              <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-accent)", fontWeight: 700 }}>{m.n}</div>
              <h4 style={{ margin: "8px 0 6px" }}>{m.title}</h4>
              <p className="text-muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{m.body}</p>
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {m.refs.map((r) => (
                  <Link key={r} href="/rulebook" className="tag tag-outline" style={{ fontSize: 10 }}>{r}</Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="dt-engines" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-head">
            <h4>FANIL Engine</h4>
            <span className="text-muted">Denominator</span>
          </div>
          <div className="panel-body waterfall">
            <div className="wf-row"><span>FANIL ± Art. 3.2</span><Link href="/globe-income">GloBE income</Link></div>
            <div className="wf-row total"><span>Net GloBE Income</span><Amount n={sel.globeIncome} audit={sel.trace.globe} /></div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h4>Covered Tax &amp; Deferred Tax Engine</h4>
            <span className="text-muted">Numerator</span>
          </div>
          <div className="panel-body waterfall">
            <div className="wf-row"><span>Current + Art. 4.4 recast {min}</span><Link href={`/deferred-tax?iso=${sel.iso}`}>Deferred tax</Link></div>
            <div className="wf-row total"><span>Adjusted Covered Taxes</span><Amount n={sel.coveredTax} audit={sel.trace.covered} /></div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h4>Jurisdictional ETR Engine</h4>
            <span className="text-muted">Art. 5.1.1</span>
          </div>
          <div className="panel-body waterfall">
            <div className="wf-row"><span>Covered ÷ GloBE</span><Amount n={sel.etr} audit={sel.trace.etr} /></div>
            <div className="wf-row total"><span>Top-up</span><Amount n={sel.jurisdictionalTopUp} audit={sel.audit} /></div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <h4>{sel.name} ETR</h4>
            <Link href="/rulebook" className="tag tag-accent">OECD-GloBE-15 v2026.1</Link>
          </div>
          <div className="panel-body waterfall">
            <div className="wf-row">
              <span>
                Adjusted Covered Taxes
                <div className="text-muted" style={{ fontSize: 12 }}>Numerator · <Link href="/covered-taxes">Art. 4.1.1</Link> / <Link href="/rulebook">Art. 4.4.1</Link></div>
              </span>
              <Amount n={sel.coveredTaxRaw} audit={sel.trace.covered} />
            </div>
            {sel.enteOriginated > 0 && (
              <div className="wf-row">
                <span>
                  − Excess Negative Tax Expense
                  <div className="text-muted" style={{ fontSize: 12 }}>Mandatory Art. 5.2.1 · OECD AG Feb 2023 · carried forward {sel.enteCarryforward.toLocaleString("en-GB")}</div>
                </span>
                <Amount n={-sel.enteOriginated} audit={sel.audit.children?.find((n) => n.id.endsWith("-ente"))} />
              </div>
            )}
            {sel.enteApplied > 0 && (
              <div className="wf-row">
                <span>
                  − Prior ENTE carry-forward used
                  <div className="text-muted" style={{ fontSize: 12 }}>Reduces this year’s Adjusted Covered Taxes · remaining {sel.enteCarryforward.toLocaleString("en-GB")}</div>
                </span>
                <Amount n={-sel.enteApplied} audit={sel.audit.children?.find((n) => n.id.endsWith("-ente"))} />
              </div>
            )}
            {(sel.enteOriginated > 0 || sel.enteApplied > 0) && (
              <div className="wf-row">
                <span>
                  Adjusted Covered Taxes for ETR
                  <div className="text-muted" style={{ fontSize: 12 }}>After ENTE · Art. 5.1.1 numerator</div>
                </span>
                <Amount n={sel.coveredTax} audit={sel.trace.etr} />
              </div>
            )}
            <div className="wf-row">
              <span>
                ÷ Net GloBE Income
                <div className="text-muted" style={{ fontSize: 12 }}>Denominator — not reduced by SBIE · <Link href="/globe-income">Art. 5.1.2</Link></div>
              </span>
              <Amount n={sel.globeIncome} audit={sel.trace.globe} />
            </div>
            <div className="wf-row total">
              <span>
                Jurisdictional ETR
                <div className="text-muted" style={{ fontSize: 12, fontWeight: 400 }}><Link href="/rulebook">Art. 5.1.1</Link></div>
              </span>
              <Amount n={sel.etr} audit={sel.trace.etr} />
            </div>
            <div className="wf-row">
              <span>
                Minimum Rate
                <div className="text-muted" style={{ fontSize: 12 }}>OECD-GloBE-15 · <Link href="/rulebook">Art. 5.1 / 5.2.1</Link></div>
              </span>
              <span>{pct(MIN_RATE, 2)}</span>
            </div>
            <div className="wf-row">
              <span>
                Top-up Tax Percentage
                <div className="text-muted" style={{ fontSize: 12 }}>max(0, {min} − ETR) · <Link href="/top-up">Art. 5.2.1</Link></div>
              </span>
              <Amount n={sel.topUpRate} audit={sel.audit.children?.find((n) => n.id.endsWith("-rate"))} />
            </div>
            <div className="wf-row">
              <span>
                Additional Current Top-up Tax
                <div className="text-muted" style={{ fontSize: 12 }}>{sel.actttReason} · <Link href="/covered-taxes">Art. 4.1.5</Link> / <Link href="/top-up">Art. 5.2.3</Link></div>
              </span>
              <Amount n={sel.additionalCurrentTopUp} audit={sel.audit.children?.find((n) => n.id.endsWith("-acttt"))} />
            </div>
          </div>
          <div className="stack-actions" style={{ padding: "0 16px 16px" }}>
            <Link href="/globe-income" className="btn btn-secondary">GloBE income</Link>
            <Link href={`/sbie?iso=${sel.iso}`} className="btn btn-secondary">SBIE</Link>
            <Link href="/top-up" className="btn btn-primary">Top-up</Link>
          </div>
        </div>
        <div className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Jurisdiction</th><th className="num">GloBE</th><th className="num">Covered</th><th className="num">ETR</th><th>Result</th></tr></thead>
              <tbody>
                {calcs.map((c) => (
                  <tr key={c.blendKey} className="clickable" onClick={() => router.push(etrHref(c))}>
                    <td>{c.name}</td>
                    <td className="num"><Amount n={c.globeIncome} audit={c.trace.globe} compact /></td>
                    <td className="num"><Amount n={c.coveredTax} audit={c.trace.covered} compact /></td>
                    <td className="num"><Amount n={c.etr} audit={c.trace.etr} compact /></td>
                    <td>{c.exposure}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="text-muted" style={{ marginTop: 14, fontSize: 13 }}>
        SBIE changes Excess Profit, not the ETR. Jurisdictional top-up is (Top-up Tax Percentage × Excess Profit) + Additional Current Top-up Tax (<Link href="/top-up">Art. 5.2.3</Link>), then allocated QDMTT → POPE IIR → UPE IIR → UTPR.
        {" "}
        <Link href="/globe-income">FANIL engine</Link>
        {" · "}
        <Link href="/covered-taxes">Covered taxes</Link>
        {" · "}
        <Link href={`/deferred-tax?iso=${sel.iso}`}>Deferred tax engine</Link>
        {" · "}
        <Link href={`/sbie?iso=${sel.iso}`}>SBIE</Link>
      </p>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-head"><h4>References</h4><Link href="/rulebook" className="btn btn-ghost">GMT24 rulebook</Link></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Cite</th><th>Authority</th><th>GMT24 / location</th></tr></thead>
            <tbody>
              {REFERENCES.map((r) => (
                <tr key={r.cite} className="clickable" onClick={() => router.push(r.href)}>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{r.cite}</td>
                  <td>{r.work}</td>
                  <td><Link href={r.href}>{r.loc}</Link></td>
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

"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { eur, pct } from "@/lib/format";
import { Amount } from "@/components/Amount";
import { FlowBar } from "@/components/FlowBar";
import { useCalc } from "@/lib/useCalc";
import { useStore } from "@/lib/store";
import { MIN_RATE } from "@/lib/engine";

const METHOD = [
  {
    n: "01",
    title: "Blend the jurisdiction",
    body: "ETR is jurisdictional, not entity-level. Sum Adjusted Covered Taxes and Net GloBE Income of Constituent Entities located in the country. Investment Entities are out. Each Stateless CE is treated as its own jurisdiction.",
    refs: ["Art. 5.1.1", "Art. 5.1.2"],
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
    body: "Denominator is the positive Net GloBE Income of the jurisdiction (GloBE income of profit CEs less GloBE losses of loss CEs). SBIE does not reduce this figure. If Net GloBE Income is zero or negative, no ETR is computed.",
    refs: ["Art. 5.1.1", "Art. 5.1.2", "Art. 3.1"],
  },
  {
    n: "04",
    title: "Compare to 15%",
    body: "If ETR is below the Minimum Rate, Top-up Tax Percentage = Minimum Rate − ETR. That rate is applied to Excess Profit (GloBE income after SBIE), not to GloBE income. ETR itself is unchanged by the carve-out.",
    refs: ["Art. 5.2.1", "Art. 5.2.2", "OECD-GloBE-15"],
  },
];

const REFERENCES = [
  { cite: "OECD (2021)", work: "Tax Challenges Arising from the Digitalisation of the Economy – Global Anti-Base Erosion Model Rules (Pillar Two)", loc: "Chapter 5, Art. 5.1 Determination of Effective Tax Rate", href: "/rulebook" },
  { cite: "OECD (2026)", work: "Consolidated Commentary to the GloBE Model Rules", loc: "Arts. 5.1–5.2", href: "/rulebook" },
  { cite: "Art. 5.1.1", work: "ETR = Σ Adjusted Covered Taxes of CEs in the jurisdiction ÷ Net GloBE Income of the jurisdiction", loc: "OECD-GloBE-15 v2026.1", href: "/rulebook" },
  { cite: "Art. 5.1.2", work: "Net GloBE Income = GloBE Income of profit CEs − GloBE Losses of loss CEs (not below zero for ETR)", loc: "OECD-GloBE-15 v2026.1", href: "/globe-income" },
  { cite: "Art. 4.1.1", work: "Adjusted Covered Taxes — numerator of the ETR", loc: "Model Rules Ch. 4", href: "/covered-taxes" },
  { cite: "Art. 4.4.1", work: "Deferred tax recast at the Minimum Rate before it enters Covered Taxes", loc: "OECD-GloBE-15 v2026.1", href: "/covered-taxes" },
  { cite: "Art. 5.2.1", work: "Top-up Tax Percentage = max(0, Minimum Rate − ETR)", loc: "OECD-GloBE-15 v2026.1", href: "/top-up" },
  { cite: "Art. 5.2.2", work: "Excess Profit = Net GloBE Income − SBIE — the base the top-up percentage multiplies", loc: "OECD-SBIE-2026 v2026.1", href: "/sbie" },
  { cite: "Art. 5.2.3", work: "Jurisdictional Top-up Tax = Top-up Tax Percentage × Excess Profit (+ additional current − QDMTT)", loc: "OECD-GloBE-15 v2026.1", href: "/top-up" },
];

function Inner() {
  const { ask } = useStore();
  const { calcs } = useCalc();
  const router = useRouter();
  const iso = useSearchParams().get("iso");
  const sel = calcs.find((c) => c.iso === iso) ?? calcs.find((c) => c.iso === "TH") ?? calcs[0];
  const min = pct(MIN_RATE, 0);

  return (
    <div>
      <FlowBar iso={sel.iso} />

      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>ETR method.</strong> Jurisdictional Effective Tax Rate is Adjusted Covered Taxes over Net GloBE Income. It is not a local CIT computation and it is not reduced by SBIE. Formula:{" "}
          <span className="mono">ETR = Covered Taxes ÷ GloBE income</span>
          {" · "}
          <span className="mono">Top-up % = max(0, {min} − ETR)</span>
        </div>
        <div className="stack-actions">
          <Link href="/covered-taxes" className="btn btn-secondary">Covered taxes</Link>
          <Link href="/rulebook" className="btn btn-secondary">Rulebook</Link>
          <button className="btn btn-primary" onClick={() => ask(`Why is ${sel.name}'s ETR ${(sel.etr * 100).toFixed(1)}%?`)}>Ask GMT24</button>
        </div>
      </div>

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
              <Amount n={sel.coveredTax} audit={sel.audit} />
            </div>
            <div className="wf-row">
              <span>
                ÷ Net GloBE Income
                <div className="text-muted" style={{ fontSize: 12 }}>Denominator — not reduced by SBIE · <Link href="/globe-income">Art. 5.1.2</Link></div>
              </span>
              <Amount n={sel.globeIncome} audit={sel.audit} />
            </div>
            <div className="wf-row total">
              <span>
                Jurisdictional ETR
                <div className="text-muted" style={{ fontSize: 12, fontWeight: 400 }}><Link href="/rulebook">Art. 5.1.1</Link></div>
              </span>
              <strong>{pct(sel.etr, 2)}</strong>
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
              <span>{pct(sel.topUpRate, 2)}</span>
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
                  <tr key={c.iso} className="clickable" onClick={() => router.push(`/etr?iso=${c.iso}`)}>
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

      <p className="text-muted" style={{ marginTop: 14, fontSize: 13 }}>
        SBIE changes Excess Profit, not the ETR. Top-up is Top-up Tax Percentage × Excess Profit (<Link href="/top-up">Art. 5.2.3</Link>).
        {" "}
        <Link href="/covered-taxes">Covered taxes</Link>
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

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PAYROLL_RATE, ASSET_RATE, pickCalc } from "@/lib/engine";
import { shippingPost } from "@/lib/shipping";
import { pct } from "@/lib/format";
import { Amount } from "@/components/Amount";
import { useStore } from "@/lib/store";
import { useCalc } from "@/lib/useCalc";

const METHOD = [
  {
    n: "01",
    title: "Start from jurisdictional GloBE income",
    body: "SBIE is not an entity tax deduction. It is computed after GloBE income has been blended for the jurisdiction. Excess profit — not GloBE income — is what the top-up rate applies to. A filing CE may elect not to claim SBIE for a year.",
    refs: ["Art. 5.3.1", "Art. 5.2.2"],
  },
  {
    n: "02",
    title: "Identify eligible payroll",
    body: "Eligible payroll is the compensation of Eligible Employees performing activities for the MNE in that jurisdiction. Mapped payroll accounts (approved once) feed the engine. Headcount location, not the payroll company, drives the carve-out. Payroll capitalised into eligible PPE is excluded here and taken in the asset carve-out. Payroll used in generating Art. 3.4 excluded shipping income is stripped.",
    refs: ["Art. 5.3.3"],
  },
  {
    n: "03",
    title: "Identify eligible tangible assets",
    body: "Eligible tangible assets are PPE, natural resources, lessee ROU assets, and certain government licences located in the jurisdiction. Carrying value is the average of opening and closing book value from the UPE consolidation. Intangibles, cash and financial assets are out. Assets used in generating Art. 3.4 excluded shipping income (ships, marine ROU) are stripped.",
    refs: ["Art. 5.3.4", "Art. 5.3.5"],
  },
  {
    n: "04",
    title: "Apply FY rates and post excess",
    body: "SBIE = payroll carve-out + tangible-asset carve-out (Investment Entities excluded). Steady-state rates are 5% / 5%. FY2026 transitional rates in this pack: 9.4% payroll, 7.4% assets. Excess profit = max(0, Net GloBE income − SBIE).",
    refs: ["Art. 5.3.2", "Art. 9.2", "OECD-SBIE-2026"],
  },
];

const REFERENCES = [
  { cite: "OECD (2021)", work: "Tax Challenges Arising from the Digitalisation of the Economy – Global Anti-Base Erosion Model Rules (Pillar Two)", loc: "Chapter 5, Art. 5.3 Substance-based Income Exclusion", href: "/rulebook" },
  { cite: "OECD (2026)", work: "Consolidated Commentary to the GloBE Model Rules", loc: "Arts. 5.2–5.3 and 9.2", href: "/rulebook" },
  { cite: "Art. 5.3.1", work: "Net GloBE Income reduced by SBIE to determine Excess Profit; annual election not to apply", loc: "OECD-SBIE-2026 v2026.1", href: "/rulebook" },
  { cite: "Art. 5.3.2", work: "SBIE = payroll carve-out + tangible-asset carve-out (Investment Entities excluded)", loc: "OECD-SBIE-2026 v2026.1", href: "/rulebook" },
  { cite: "Art. 5.3.3", work: "Payroll carve-out — 5% of Eligible Payroll Costs of Eligible Employees in the jurisdiction", loc: "OECD-SBIE-2026 v2026.1", href: "/mapping" },
  { cite: "Art. 5.3.4", work: "Tangible-asset carve-out — 5% of carrying value of Eligible Tangible Assets located in the jurisdiction", loc: "OECD-SBIE-2026 v2026.1", href: "/mapping" },
  { cite: "Art. 3.4 / 5.3", work: "Payroll and tangible assets used in generating excluded International Shipping Income are not Eligible Payroll Costs or Eligible Tangible Assets", loc: "OECD-SHIP-34 v2026.1", href: "/globe-income" },
  { cite: "Art. 9.2", work: "Transitional SBIE rates. Payroll 10% → 5% and assets 8% → 5%. FY2026: 9.4% / 7.4%", loc: "OECD-SBIE-2026 v2026.1", href: "/rulebook" },
  { cite: "Art. 5.2.2", work: "Excess Profit = Net GloBE Income − Substance-based Income Exclusion (not below zero)", loc: "Model Rules Ch. 5", href: "/top-up" },
  { cite: "Art. 5.2.3", work: "Jurisdictional Top-up Tax = Top-up Tax Percentage × Excess Profit (after SBIE)", loc: "OECD-GloBE-15 v2026.1", href: "/top-up" },
];

function Inner() {
  const { ask } = useStore();
  const { calcs } = useCalc();
  const router = useRouter();
  const iso = useSearchParams().get("iso");
  const blend = useSearchParams().get("blend");
  const sel = pickCalc(calcs, iso, blend) ?? pickCalc(calcs, "TH") ?? calcs[0];
  const pr = pct(PAYROLL_RATE, 1);
  const ar = pct(ASSET_RATE, 1);
  const shipPayroll = sel.entities.some((e) => shippingPost(e.id).payrollStrip > 0);
  const shipAssets = sel.entities.some((e) => shippingPost(e.id).assetStrip > 0);

  return (
    <div>
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>SBIE method.</strong> Substance-based Income Exclusion carves routine returns on people and tangible assets out of Excess Profits. It does not change GloBE income or the ETR. Formula:{" "}
          <span className="mono">SBIE = {pr} × payroll + {ar} × tangible assets</span>
          {" · "}
          <span className="mono">Excess = max(0, GloBE − SBIE)</span>
        </div>
        <div className="stack-actions">
          <Link href="/mapping" className="btn btn-secondary">Account mapping</Link>
          <Link href="/rulebook" className="btn btn-secondary">Rulebook</Link>
          <button className="btn btn-primary" onClick={() => ask("How is SBIE calculated for Thailand?")}>Ask GMT24</button>
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

      <div className="grid-split">
        <div className="panel">
          <div className="panel-head">
            <h4>{sel.name} bridge</h4>
            <Link href="/rulebook" className="tag tag-accent">OECD-SBIE-2026 v2026.1</Link>
          </div>
          <div className="panel-body waterfall">
            <div className="wf-row">
              <span>
                GloBE income
                <div className="text-muted" style={{ fontSize: 12 }}>Denominator of ETR — not reduced by SBIE · <Link href="/rulebook">Art. 5.1.1</Link></div>
              </span>
              <Amount n={sel.globeIncome} audit={sel.trace.globe} />
            </div>
            <div className="wf-row">
              <span>
                − Payroll carve-out
                <div className="text-muted" style={{ fontSize: 12 }}>
                  {pr} × Eligible Payroll Costs · <Link href="/rulebook">Art. 5.3.3</Link> / <Link href="/rulebook">Art. 9.2</Link>
                  {shipPayroll ? " · Art. 3.4 shipping payroll stripped" : ""}
                </div>
              </span>
              <Amount n={sel.payrollCarve} audit={sel.trace.payroll} />
            </div>
            <div className="wf-row">
              <span>
                − Tangible-asset carve-out
                <div className="text-muted" style={{ fontSize: 12 }}>
                  {ar} × average carrying value of Eligible Tangible Assets · <Link href="/rulebook">Art. 5.3.4</Link> / <Link href="/rulebook">Art. 5.3.5</Link> / <Link href="/rulebook">Art. 9.2</Link>
                  {shipAssets ? " · Art. 3.4 shipping assets stripped" : ""}
                </div>
              </span>
              <Amount n={sel.assetCarve} audit={sel.trace.assets} />
            </div>
            <div className="wf-row">
              <span>
                SBIE
                <div className="text-muted" style={{ fontSize: 12 }}>Payroll carve-out + asset carve-out · <Link href="/rulebook">Art. 5.3.2</Link></div>
              </span>
              <Amount n={sel.sbie} audit={sel.trace.sbie} />
            </div>
            <div className="wf-row total">
              <span>
                Excess profit
                <div className="text-muted" style={{ fontSize: 12, fontWeight: 400 }}>max(0, Net GloBE income − SBIE) · <Link href="/rulebook">Art. 5.2.2</Link></div>
              </span>
              <Amount n={sel.excess} audit={sel.trace.excess} />
            </div>
          </div>
          <div className="stack-actions" style={{ padding: "0 16px 16px" }}>
            <Link href={`/etr?iso=${sel.iso}`} className="btn btn-secondary">ETR</Link>
            <Link href="/top-up" className="btn btn-primary">Top-up</Link>
          </div>
        </div>
        <div className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Jurisdiction</th><th className="num">Payroll</th><th className="num">Assets</th><th className="num">SBIE</th><th className="num">Excess</th></tr></thead>
              <tbody>
                {calcs.map((c) => (
                  <tr key={c.blendKey} className="clickable" onClick={() => router.push(`/sbie?iso=${c.iso}${c.blendKind === "main" ? "" : `&blend=${encodeURIComponent(c.blendKey)}`}`)}>
                    <td>{c.name}</td>
                    <td className="num"><Amount n={c.payrollCarve} audit={c.trace.payroll} compact /></td>
                    <td className="num"><Amount n={c.assetCarve} audit={c.trace.assets} compact /></td>
                    <td className="num"><Amount n={c.sbie} audit={c.trace.sbie} compact /></td>
                    <td className="num"><Amount n={c.excess} audit={c.trace.excess} compact /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="text-muted" style={{ marginTop: 14, fontSize: 13 }}>
        SBIE does not change Covered Taxes or the jurisdictional ETR. It only reduces the base the top-up rate multiplies (Art. 5.1.2). Intangibles and financial assets have no carve-out.
        {" "}
        <Link href="/globe-income">GloBE income</Link>
        {" · "}
        <Link href="/top-up">Top-up</Link>
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

export default function SbiePage() {
  return <Suspense><Inner /></Suspense>;
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ENTITIES, FINANCIALS } from "@/lib/model";
import { entityCalc, MIN_RATE, traceCoveredEntity, traceDeferredEntity } from "@/lib/engine";
import { deferredTaxAdjustment } from "@/lib/deferredTax";
import { eur, pct } from "@/lib/format";
import { Amount } from "@/components/Amount";
import { useStore } from "@/lib/store";
import { useCalc } from "@/lib/useCalc";

const METHOD = [
  {
    n: "01",
    title: "Identify Covered Taxes",
    body: "Covered Taxes are taxes on income or profits, taxes in lieu of a generally applicable CIT, and certain distribution / equity taxes. IIR, QDMTT and UTPR top-up, VAT, payroll tax and similar levies are out. Mapping decides covered vs non-covered once; the engine never guesses.",
    refs: ["Art. 4.2"],
  },
  {
    n: "02",
    title: "Start from current tax in FANIL",
    body: "Adjusted Covered Taxes begin with current tax expense accrued in FANIL with respect to Covered Taxes, then additions (Art. 4.1.2) and reductions (Art. 4.1.3). Tax on excluded GloBE items, uncertain positions not expected to be paid, and amounts not paid within three years come out.",
    refs: ["Art. 4.1.1", "Art. 4.1.2", "Art. 4.1.3"],
  },
  {
    n: "03",
    title: "Recast deferred tax at 15%",
    body: "The Total Deferred Tax Adjustment Amount takes deferred tax expense. If the local rate is above the Minimum Rate, recast at 15%. Recapture accounts track DTLs that are not Recapture Exception Accruals; unpaid amounts reverse after five years and re-open the prior ETR. Open the Deferred Tax Intelligence Engine for the sub-ledger and Time Machine.",
    refs: ["Art. 4.4.1", "Art. 4.4.4"],
  },
  {
    n: "04",
    title: "Allocate, then blend",
    body: "PE, CFC, hybrid and distribution taxes move to the Constituent Entity that has the GloBE income (Art. 4.3). Jurisdiction Adjusted Covered Taxes is the sum of CEs in that country — the numerator of the ETR. It is not a GloBE-income adjustment.",
    refs: ["Art. 4.3", "Art. 5.1.1"],
  },
  {
    n: "05",
    title: "Net GloBE Loss and negative Covered Taxes",
    body: "If Net GloBE Income is a loss and Adjusted Covered Taxes are negative, Art. 4.1.5 treats the negative tax as Additional Current Top-up Tax unless the MNE elects to carry the negative tax expense forward (OECD_4.1.5, annual). Open Luxembourg on this snapshot.",
    refs: ["Art. 4.1.5", "Art. 5.2.3"],
  },
];

const REFERENCES = [
  { cite: "OECD (2021)", work: "Tax Challenges Arising from the Digitalisation of the Economy – Global Anti-Base Erosion Model Rules (Pillar Two)", loc: "Chapter 4, Computation of Adjusted Covered Taxes", href: "/rulebook" },
  { cite: "OECD (2026)", work: "Consolidated Commentary to the GloBE Model Rules", loc: "Arts. 4.1–4.4 and 5.1", href: "/rulebook" },
  { cite: "Art. 4.1.1", work: "Adjusted Covered Taxes = current tax expense on Covered Taxes ± additions/reductions + Total Deferred Tax Adjustment Amount", loc: "OECD-GloBE-15 v2026.1", href: "/rulebook" },
  { cite: "Art. 4.1.2–4.1.3", work: "Additions to and Reductions from Covered Taxes (excluded-item tax including Art. 3.4 shipping, uncertain positions, amounts not paid within three years)", loc: "OECD-GloBE-15 / OECD-SHIP-34 v2026.1", href: "/rulebook" },
  { cite: "Art. 4.2", work: "Definition of Covered Taxes — income/profits, in-lieu CIT, Eligible Distribution Tax System; excludes IIR / QDMTT / UTPR", loc: "Model Rules Ch. 4", href: "/rulebook" },
  { cite: "Art. 4.3", work: "Allocation of Covered Taxes — PE, tax-transparent, Hybrid, CFC, distributions", loc: "OECD-GloBE-15 v2026.1", href: "/rulebook" },
  { cite: "Art. 4.4.1", work: "Total Deferred Tax Adjustment Amount — recast at the Minimum Rate", loc: "OECD-GloBE-15 v2026.1", href: "/rulebook" },
  { cite: "Art. 4.4.4", work: "Five-year recapture of deferred tax liabilities that are not Recapture Exception Accruals", loc: "OECD-GloBE-15 v2026.1", href: "/rulebook" },
  { cite: "Art. 4.5", work: "GloBE Loss Election — in lieu of Art. 4.4 deferred-tax mechanics", loc: "Model Rules Ch. 4", href: "/rulebook" },
  { cite: "Art. 4.1.5", work: "Net GloBE Loss + negative Adjusted Covered Taxes → Additional Current Top-up Tax unless carry-forward elected", loc: "OECD-GloBE-15 v2026.1", href: "/etr?iso=LU" },
  { cite: "Art. 5.1.1", work: "Jurisdictional ETR = Σ Adjusted Covered Taxes ÷ Net GloBE Income", loc: "OECD-GloBE-15 v2026.1", href: "/etr" },
];

export default function CoveredTaxesPage() {
  const { ask } = useStore();
  const { calcs } = useCalc();
  const router = useRouter();
  const [id, setId] = useState("TH-CE");
  const row = entityCalc(id);
  const jur = calcs.find((c) => c.entities.some((e) => e.id === id));
  if (!row) return null;
  const f = row.f;
  const min = pct(MIN_RATE, 0);
  const deferred = deferredTaxAdjustment(id) ?? f.deferredTax;

  return (
    <div>
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Covered-tax method.</strong> The ETR numerator is Adjusted Covered Taxes, not the P&amp;L tax line. Current tax is taken from FANIL, deferred tax is recast at the Minimum Rate, non-covered levies stay out. Formula:{" "}
          <span className="mono">ACT = current Covered Tax ± Art. 4.1 adj. + Art. 4.4 deferred (recast {min})</span>
        </div>
        <div className="stack-actions">
          <Link href="/deferred-tax" className="btn btn-secondary">Deferred tax engine</Link>
          <Link href="/mapping" className="btn btn-secondary">Account mapping</Link>
          <Link href="/rulebook" className="btn btn-secondary">Rulebook</Link>
          <button className="btn btn-primary" onClick={() => ask("Explain deferred tax recast for Thailand")}>Ask GMT24</button>
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

      <select className="input" style={{ maxWidth: 420, marginBottom: 16 }} value={id} onChange={(e) => setId(e.target.value)}>
        {ENTITIES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>

      <div className="grid-split">
        <div className="panel">
          <div className="panel-head">
            <h4>{row.entity.code} bridge</h4>
            <Link href="/rulebook" className="tag tag-accent">OECD-GloBE-15 v2026.1</Link>
          </div>
          <div className="panel-body waterfall">
            <div className="wf-row">
              <span>
                Current tax expense
                <div className="text-muted" style={{ fontSize: 12 }}>Covered Taxes accrued in FANIL · <Link href="/rulebook">Art. 4.1.1</Link> / <Link href="/rulebook">Art. 4.2</Link></div>
              </span>
              <Amount n={f.currentTax} audit={row.trace.current} />
            </div>
            <div className="wf-row">
              <span>
                + Deferred tax (recast {min})
                <div className="text-muted" style={{ fontSize: 12 }}>Total Deferred Tax Adjustment Amount · <Link href="/rulebook">Art. 4.4.1</Link></div>
              </span>
              <Amount n={deferred} audit={row.trace.deferred ?? undefined} />
            </div>
            <div className="wf-row">
              <span>
                + Other covered
                <div className="text-muted" style={{ fontSize: 12 }}>In-lieu / allocated PE · CFC · hybrid · distributions · <Link href="/rulebook">Art. 4.2</Link> / <Link href="/rulebook">Art. 4.3</Link></div>
              </span>
              <Amount n={f.otherCovered} audit={row.trace.other} />
            </div>
            {row.shipping.present && (
              <div className="wf-row">
                <span>
                  − Tax on excluded shipping
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    Art. 4.1.3 reduction for Covered Taxes on Art. 3.4 excluded income
                    {row.shipping.managementOk ? ` · ${eur(row.shipping.excludedTax)}` : " · Art. 3.4.5 failed — $0"}
                    {" · "}
                    <Link href="/rulebook">OECD-SHIP-34</Link>
                  </div>
                </span>
                <Amount n={-row.shipping.excludedTax} audit={row.trace.shippingTax ?? undefined} />
              </div>
            )}
            <div className="wf-row">
              <span>
                Non-covered (excluded)
                <div className="text-muted" style={{ fontSize: 12 }}>Not in Adjusted Covered Taxes · <Link href="/rulebook">Art. 4.2</Link> / <Link href="/rulebook">Art. 4.1.3</Link></div>
              </span>
              <Amount n={f.nonCovered} audit={row.trace.nonCovered} className="text-muted" />
            </div>
            <div className="wf-row total">
              <span>
                Adjusted Covered Taxes
                <div className="text-muted" style={{ fontSize: 12, fontWeight: 400 }}>Current + deferred (recast) + other covered · <Link href="/rulebook">Art. 4.1.1</Link></div>
              </span>
              <Amount n={row.covered} audit={row.trace.covered} />
            </div>
          </div>
          <div className="stack-actions" style={{ padding: "0 16px 16px" }}>
            <Link href={`/deferred-tax?iso=${row.entity.iso}`} className="btn btn-secondary">Deferred tax ledger</Link>
            <Link href="/globe-income" className="btn btn-secondary">GloBE income</Link>
            <Link href={jur ? `/etr?iso=${jur.iso}` : "/etr"} className="btn btn-primary">ETR</Link>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h4>{jur?.name ?? "Jurisdiction"} blend</h4>
            <span className="text-muted">Art. 5.1.1 numerator</span>
          </div>
          <div className="panel-body waterfall">
            <div className="wf-row">
              <span>Σ Adjusted Covered Taxes</span>
              <Amount n={jur?.coveredTax ?? 0} audit={jur?.trace.covered} />
            </div>
            <div className="wf-row">
              <span>÷ Net GloBE Income</span>
              <Amount n={jur?.globeIncome ?? 0} audit={jur?.trace.globe} />
            </div>
            <div className="wf-row total">
              <span>Jurisdictional ETR</span>
              {jur ? <Amount n={jur.etr} audit={jur.trace.etr} /> : <strong>—</strong>}
            </div>
          </div>
          <p className="text-muted" style={{ padding: "0 16px 16px", margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            Opening DTA {eur(f.priorDta)} · opening DTL {eur(f.priorDtl)}. Recapture is five-year state carried into the next Fiscal Year (<Link href="/rulebook">Art. 4.4.4</Link>). Open the <Link href={`/deferred-tax?iso=${row.entity.iso}`}>Deferred Tax Time Machine</Link> — Pillar Two is not an isolated annual calc.
          </p>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Entity</th>
                <th className="num">Current</th>
                <th className="num">Deferred</th>
                <th className="num">Other covered</th>
                <th className="num">Non-covered</th>
                <th className="num">Prior DTA</th>
                <th className="num">Prior DTL</th>
                <th className="num">Covered taxes</th>
              </tr>
            </thead>
            <tbody>
              {FINANCIALS.map((fin) => {
                const e = ENTITIES.find((x) => x.id === fin.entityId)!;
                const deferred = deferredTaxAdjustment(fin.entityId) ?? fin.deferredTax;
                const covered = fin.currentTax + deferred + fin.otherCovered;
                const ct = traceCoveredEntity(fin.entityId);
                return (
                  <tr key={fin.entityId} className="clickable" onClick={() => setId(fin.entityId)}>
                    <td>{e.name}</td>
                    <td className="num"><Amount n={fin.currentTax} audit={ct?.children?.find((n) => n.id.endsWith("-current"))} compact /></td>
                    <td className="num"><Amount n={deferred} audit={traceDeferredEntity(fin.entityId) ?? undefined} compact /></td>
                    <td className="num">{eur(fin.otherCovered, true)}</td>
                    <td className="num">{eur(fin.nonCovered, true)}</td>
                    <td className="num">{eur(fin.priorDta, true)}</td>
                    <td className="num">{eur(fin.priorDtl, true)}</td>
                    <td className="num"><Amount n={covered} audit={ct ?? undefined} compact /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-muted" style={{ marginTop: 14, fontSize: 13 }}>
        Recast at {min} sits in Chapter 4, not Art. 3.2. Non-covered tax is stripped from Covered Taxes; it is not a GloBE-income delta.
        {" "}
        <Link href="/deferred-tax">Deferred tax engine</Link>
        {" · "}
        <Link href="/globe-income">GloBE income</Link>
        {" · "}
        <Link href="/etr">ETR</Link>
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

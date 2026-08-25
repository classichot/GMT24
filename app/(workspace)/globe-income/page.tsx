"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ENTITIES } from "@/lib/model";
import { entityCalc, traceAdj } from "@/lib/engine";
import { eur } from "@/lib/format";
import { Amount } from "@/components/Amount";
import { useStore } from "@/lib/store";
import { useCalc } from "@/lib/useCalc";

const METHOD = [
  {
    n: "01",
    title: "Start with FANIL",
    body: "Financial Accounting Net Income or Loss of the Constituent Entity, taken from the UPE consolidated financial statements (Art. 3.1.1), translated at the locked FX table. A CE may use an acceptable local GAAP under Art. 3.1.2 / 3.1.3 only if the EUR 75m / EUR 1m screens pass.",
    refs: ["Art. 3.1.1", "Art. 3.1.2", "Art. 3.1.3"],
  },
  {
    n: "02",
    title: "Map each account once",
    body: "AI Smart Mapping classifies the GL line: financial category → GloBE category → whether an Art. 3.2 adjustment applies. The tax team approves. The LLM never posts the number.",
    refs: ["GMT24 mapping v2026.2"],
  },
  {
    n: "03",
    title: "Apply Art. 3.2 adjustments",
    body: "Each approved category becomes a signed delta: original amount in FANIL, then +/− the GloBE adjustment. Subtract excluded items. Add back policy-disallowed expense and net taxes. Replace stock-based compensation with the tax-deductible amount where elected.",
    refs: ["Art. 3.2.1", "Art. 3.2.2"],
  },
  {
    n: "04",
    title: "Exclude International Shipping Income",
    body: "Art. 3.4 is not an election. If strategic or commercial management of the ships is effectively carried on from the CE’s jurisdiction (Art. 3.4.5), net International Shipping Income and Qualified Ancillary International Shipping Income (capped at 50% of ISI) come out of GloBE. Related Covered Taxes and SBIE payroll/assets used in that activity come out with them. Excess ancillary stays in GloBE.",
    refs: ["Art. 3.4.1", "Art. 3.4.3", "Art. 3.4.5"],
  },
  {
    n: "05",
    title: "Engine posts GloBE income",
    body: "GloBE income = FANIL + approved account postings under Art. 3.2 and PE allocation under Art. 3.5 − Art. 3.4 shipping. Approval changes the engine input and reruns the jurisdictional ETR.",
    refs: ["Art. 3.1", "Art. 3.2", "Art. 3.4", "Art. 3.5", "Art. 5.1.1"],
  },
];

const ADJ_REF: Record<string, { article: string; note: string }> = {
  "Excluded dividends": { article: "Art. 3.2.1(b)", note: "Ownership interest ≥ 10%" },
  "Net tax expense": { article: "Art. 3.2.1(a)", note: "Net Taxes add-back; non-covered tax stays out of GloBE income" },
  "FX / as-if": { article: "Art. 3.2.1(f)", note: "Asymmetric foreign currency gain or loss" },
  "Stock-based compensation": { article: "Art. 3.2.2", note: "Election: replace accounting cost with tax deduction" },
  "Policy disallowed": { article: "Art. 3.2.1(g)", note: "Illegal payments and fines add-back" },
};

const REFERENCES = [
  { cite: "OECD (2021)", work: "Tax Challenges Arising from the Digitalisation of the Economy – Global Anti-Base Erosion Model Rules (Pillar Two)", loc: "Chapter 3, Computation of GloBE Income or Loss", href: "/rulebook" },
  { cite: "OECD (2026)", work: "Consolidated Commentary to the GloBE Model Rules", loc: "Arts. 3.1–3.2 and 5.1", href: "/rulebook" },
  { cite: "Art. 3.1.1–3.1.3", work: "FANIL starting point from UPE consolidated accounts / acceptable accounting standard", loc: "Model Rules Ch. 3", href: "/rulebook" },
  { cite: "Art. 3.2.1(a)", work: "Net Taxes expense adjustment", loc: "OECD-GloBE-15 v2026.1", href: "/rulebook" },
  { cite: "Art. 3.2.1(b)", work: "Excluded Dividends (ownership ≥ 10%)", loc: "OECD-DIV-EXCL v2026.1", href: "/rulebook" },
  { cite: "Art. 3.2.1(f)", work: "Asymmetric Foreign Currency Gains or Losses", loc: "OECD-GloBE-15 v2026.1", href: "/rulebook" },
  { cite: "Art. 3.2.1(g)", work: "Policy Disallowed Expenses", loc: "OECD-GloBE-15 v2026.1", href: "/rulebook" },
  { cite: "Art. 3.2.2", work: "Stock-based compensation election", loc: "OECD-GloBE-15 v2026.1", href: "/rulebook" },
  { cite: "Arts. 3.2.3 / 3.2.4 / 3.2.9", work: "Pension, arm's-length and insurance policyholder-tax account postings", loc: "Books → FANIL posting engine", href: "/mapping" },
  { cite: "Art. 3.4", work: "International Shipping Income exclusion — ISI + QAISI (50% cap); Art. 3.4.5 management test; related tax and SBIE strip", loc: "OECD-SHIP-34 v2026.1", href: "/rulebook" },
  { cite: "Art. 3.5", work: "Permanent Establishment FANIL allocation — equal and opposite Main Entity / PE postings", loc: "TH001 PE allocation workbook FY2026.xlsx", href: "/mapping" },
  { cite: "Art. 4", work: "Covered Taxes — not a GloBE-income adjustment (recast 15% sits here)", loc: "Model Rules Ch. 4", href: "/covered-taxes" },
  { cite: "Art. 5.1.1", work: "Jurisdictional ETR = Covered Taxes ÷ GloBE Income", loc: "OECD-GloBE-15 v2026.1", href: "/etr" },
];

export default function GlobeIncomePage() {
  const { ask, approvedMaps, electionsOn, activeFy } = useStore();
  const { calcs } = useCalc();
  const router = useRouter();
  const [id, setId] = useState("TH-CE");
  const row = entityCalc(id, { approvedMaps, electionsOn, fy: activeFy });
  const jur = calcs.find((c) => c.entities.some((e) => e.id === id));
  if (!row) return null;
  const f = row.f;
  const ship = row.shipping;
  let running = row.trace.fanil.amount ?? f.fanil;

  return (
    <div>
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Books → FANIL → GloBE.</strong> Approved account mappings post Article 3.2 and PE Article 3.5 entries into the engine; Article 3.4 shipping is then excluded. Formula: <span className="mono">GloBE = FANIL + mapped postings − Art. 3.4</span>.
        </div>
        <div className="stack-actions">
          <Link href="/mapping" className="btn btn-secondary">Account mapping</Link>
          <Link href="/fx" className="btn btn-secondary">FX / GAAP</Link>
          <Link href="/rulebook" className="btn btn-secondary">Rulebook</Link>
          <button className="btn btn-primary" onClick={() => ask(ship.present ? "Explain Art. 3.4 shipping exclusion" : "Explain TH001 excluded dividends")}>Ask GMT24</button>
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

      <div className="panel">
        <div className="panel-head">
          <h4>GloBE income waterfall · {row.entity.code}</h4>
          <span className="text-muted">{row.adjustments.length} mapped postings · {ship.present ? "Art. 3.4 posted" : "no shipping"} · {jur?.name}</span>
        </div>
        <div className="panel-body waterfall">
          <div className="wf-row">
            <span>FANIL (Art. 3.1 — accounting, USD)</span>
            <Amount n={row.trace.fanil.amount ?? f.fanil} audit={row.trace.fanil} />
          </div>
          {row.adjustments.map((a) => {
            running += a.amount;
            return (
              <div className="wf-row" key={a.id}>
                <span>
                  {a.category}
                  {" "}
                  {ADJ_REF[a.category] && (
                    <Link href="/rulebook" className="tag tag-accent" style={{ fontSize: 10, marginLeft: 6 }}>{ADJ_REF[a.category].article}</Link>
                  )}
                  {!ADJ_REF[a.category] && a.article && (
                    <Link href="/rulebook" className="tag tag-accent" style={{ fontSize: 10, marginLeft: 6 }}>{a.article}</Link>
                  )}
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    Original {eur(a.original)} · delta {eur(a.amount)} · <Link href="/rulebook" className="mono">{a.ruleId}</Link>
                    {a.account ? <> · acct {a.account}</> : null}
                    {ADJ_REF[a.category] ? <> · {ADJ_REF[a.category].note}</> : null}
                    <br />
                    {a.reason} · {a.sourceDoc} · {a.preparer}{a.reviewer ? ` / ${a.reviewer}` : ""} · {a.status}
                  </div>
                </span>
                <Amount n={a.amount} audit={traceAdj(a)} />
              </div>
            );
          })}
          {row.adjustments.length === 0 && !ship.present && (
            <div className="wf-row">
              <span className="text-muted">No Art. 3.2 or Art. 3.4 adjustments on this entity. FANIL equals GloBE income.</span>
              <span>—</span>
            </div>
          )}
          {ship.present && (
            <div className="wf-row">
              <span>
                International shipping
                {" "}
                <Link href="/rulebook" className="tag tag-accent" style={{ fontSize: 10, marginLeft: 6 }}>Art. 3.4</Link>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  ISI {eur(ship.isi)} · ancillary {eur(ship.ancillary)} · QAISI cap {eur(ship.ancillaryCap)} · excluded {eur(ship.excludedIncome)}
                  {ship.excessAncillary ? <> · excess ancillary {eur(ship.excessAncillary)} stays in GloBE</> : null}
                  {" · "}
                  <Link href="/rulebook" className="mono">OECD-SHIP-34</Link>
                  <br />
                  {ship.detail}
                </div>
              </span>
              <Amount n={-ship.excludedIncome} audit={row.trace.shipping ?? undefined} />
            </div>
          )}
          <div className="wf-row total">
            <span>GloBE income (Art. 3.1 + 3.2{ship.present ? " − 3.4" : ""})</span>
            <Amount n={row.globe} audit={row.trace.globe} />
          </div>
        </div>
      </div>

      <p className="text-muted" style={{ marginTop: 14, fontSize: 13 }}>
        Covered-tax recast at 15% is not a GloBE-income adjustment — Art. 4, not Art. 3.2.
        {" "}
        <Link href="/covered-taxes">Open covered taxes</Link>
        {" · "}
        <Link href="/deferred-tax">Deferred tax engine</Link>
        {" · "}
        <Link href="/etr">Open ETR</Link>
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

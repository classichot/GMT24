"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ENTITIES } from "@/lib/model";
import { MIN_RATE, calcForIso, traceDtPosition, traceDeferredIso } from "@/lib/engine";
import { eur, pct } from "@/lib/format";
import { Amount } from "@/components/Amount";
import { useStore } from "@/lib/store";
import { useCalc } from "@/lib/useCalc";
import {
  DT_FY,
  EXCEPTION_LABEL,
  RECAST_LESSON,
  dtaTracks,
  dtJurisdictions,
  intelligenceFlow,
  jurisdictionDt,
  originRecompute,
  recaptureClocks,
  recaptureImpact,
  statusAt,
  timeMachine,
  type DtView,
  type RecaptureStatus,
} from "@/lib/deferredTax";
import { transitionSummary } from "@/lib/transition";

const OECD_MODEL =
  "https://www.oecd.org/content/dam/oecd/en/topics/policy-sub-issues/global-minimum-tax/tax-challenges-arising-from-the-digitalisation-of-the-economy-global-anti-base-erosion-model-rules-pillar-two.pdf";
const OECD_COMMENTARY =
  "https://www.oecd.org/content/dam/oecd/en/publications/reports/2025/05/tax-challenges-arising-from-the-digitalisation-of-the-economy-consolidated-commentary-to-the-global-anti-base-erosion-model-rules-2025_be9651c2/a551b351-en.pdf";

const METHOD = [
  {
    n: "01",
    title: "Start from deferred tax in FANIL",
    body: "The Total Deferred Tax Adjustment Amount begins with deferred tax expense (or benefit) accrued in the financial accounts with respect to Covered Taxes. That is the timing bridge: current tax alone would treat accelerated depreciation or a tax-loss DTA as permanent undertaxation.",
    refs: ["Art. 4.1.1", "Art. 4.4.1"],
  },
  {
    n: "02",
    title: "Strip Article 4.4.1 exclusions",
    body: "Take out deferred tax on items excluded from GloBE income, disallowed and unclaimed accruals, valuation / recognition adjustments (subject to the GloBE DTA rules), re-measurement from a change in domestic tax rate, and the generation or use of tax credits. Permanent differences never enter Article 4.4.",
    refs: ["Art. 4.4.1"],
  },
  {
    n: "03",
    title: "Recast at the Minimum Rate",
    body: "If the applicable domestic rate exceeds 15%, recast the remaining deferred tax at the Minimum Rate so a high CIT cannot inflate ETR. If the applicable rate is at or below 15%, do not recast upward. A DTA recorded below 15% that is attributable to a GloBE Loss may be recast at 15% under Article 4.4.3.",
    refs: ["Art. 4.4.1", "Art. 4.4.3"],
  },
  {
    n: "04",
    title: "Apply Article 4.4.2 adjustments",
    body: "Increase the amount for disallowed or unclaimed accruals paid this year, and for a recaptured Deferred Tax Liability from a prior year that is paid this year. The result is the Total Deferred Tax Adjustment Amount that enters Adjusted Covered Taxes.",
    refs: ["Art. 4.4.2"],
  },
  {
    n: "05",
    title: "Classify Recapture Exception Accruals",
    body: "Article 4.4.5 categories (tangible cost recovery, government licences, R&D, decommissioning, certain fair-value and FX items, insurance reserves, reinvested in-jurisdiction tangible gains, and related accounting-principle changes) do not sit on the five-year clock.",
    refs: ["Art. 4.4.5"],
  },
  {
    n: "06",
    title: "Run the five-year recapture clock",
    body: "Any other DTL taken into the deferred-tax adjustment must reverse by the end of the fifth subsequent Fiscal Year. If it has not, Article 4.4.4 recaptures it and the origin-year ETR is recomputed. Alternatively, a GloBE Loss Election under Article 4.5 can replace these deferred-tax mechanics.",
    refs: ["Art. 4.4.4", "Art. 4.5"],
  },
];

const REFERENCES: { cite: string; work: string; loc: string; href: string; external?: boolean }[] = [
  { cite: "OECD (2021)", work: "Tax Challenges Arising from the Digitalisation of the Economy – Global Anti-Base Erosion Model Rules (Pillar Two)", loc: "Chapter 4, Art. 4.4 Total Deferred Tax Adjustment Amount", href: OECD_MODEL, external: true },
  { cite: "OECD (2025)", work: "Consolidated Commentary to the GloBE Model Rules (2025)", loc: "Arts. 4.4.1–4.4.5 — recast, exclusions, DTA recast, recapture, Recapture Exception Accruals", href: OECD_COMMENTARY, external: true },
  { cite: "Art. 4.1.1", work: "Adjusted Covered Taxes = current tax expense on Covered Taxes ± Art. 4.1.2/4.1.3 + Total Deferred Tax Adjustment Amount", loc: "OECD-GloBE-15 v2026.1", href: "/covered-taxes" },
  { cite: "Art. 4.4.1", work: "Total Deferred Tax Adjustment Amount — recast at the Minimum Rate when the applicable rate exceeds 15%; listed exclusions", loc: "OECD-DT-441 v2026.1", href: "/rulebook" },
  { cite: "Art. 4.4.2", work: "Adjustments to the Total Deferred Tax Adjustment Amount (paid disallowed/unclaimed accruals; recaptured DTL paid this year)", loc: "OECD-DT-442 v2026.1", href: "/rulebook" },
  { cite: "Art. 4.4.3", work: "Deferred Tax Asset recorded below the Minimum Rate may be recast at 15% if attributable to a GloBE Loss", loc: "OECD-DT-443 v2026.1", href: "/rulebook" },
  { cite: "Art. 4.4.4", work: "Five-year recapture of deferred tax liabilities that are not Recapture Exception Accruals; origin-year ETR recomputed", loc: "OECD-DT-444 v2026.1", href: "/rulebook" },
  { cite: "Art. 4.4.5", work: "Recapture Exception Accruals — tangible cost recovery, licences, R&D, decommissioning, certain FV / FX / insurance / reinvestment items", loc: "OECD-DT-445 v2026.1", href: "/rulebook" },
  { cite: "Art. 4.5", work: "GloBE Loss Election — in lieu of Article 4.4 deferred-tax mechanics", loc: "Model Rules Ch. 4", href: "/rulebook" },
  { cite: "Art. 9.1", work: "Tax Attributes Upon Transition — opening DTAs/DTLs, post-30 Nov 2021 excluded-item DTA strip, transferor carrying value on non-inventory transfers", loc: "OECD-TR-91 v2026.2", href: "/rulebook" },
  { cite: "Art. 5.1.1", work: "Jurisdictional ETR = Adjusted Covered Taxes ÷ Net GloBE Income", loc: "OECD-GloBE-15 v2026.1", href: "/etr" },
];

const STATUS_TAG: Record<RecaptureStatus, [string, string]> = {
  exception: ["tag-ok", "Art. 4.4.5 exception"],
  dta: ["tag-accent", "DTA — no DTL clock"],
  reversed: ["tag-ok", "Reversed"],
  outstanding: ["tag-warn", "Clock running"],
  approaching: ["tag-hot", "Approaching recapture"],
  recapture: ["tag-hot", "Recapture required"],
};

type Filter = "all" | "exception" | "monitored" | "dta" | "approaching" | "excluded";

function Inner() {
  const { ask } = useStore();
  const { calcs } = useCalc();
  const router = useRouter();
  const q = useSearchParams().get("iso");
  const ledgers = dtJurisdictions();
  const iso = ledgers.some((j) => j.iso === q) ? q! : "TH";
  const dt = jurisdictionDt(iso);
  const jur = calcs.find((c) => c.iso === iso) ?? calcForIso(iso);
  const [asOf, setAsOf] = useState(DT_FY);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string>(iso === "TH" ? "DTL-92382" : dt.positions[0]?.id ?? "");
  const [recompute, setRecompute] = useState(false);
  const tm = useMemo(() => timeMachine(iso), [iso]);
  const clocks = useMemo(() => recaptureClocks(iso, asOf), [iso, asOf]);
  const dtas = useMemo(() => dtaTracks(iso), [iso]);
  const yearCol = tm.find((y) => y.year === asOf) ?? tm[0];
  const min = pct(MIN_RATE, 0);
  const cit = pct(dt.citRate, dt.citRate >= 0.2 ? 0 : 1);

  const rows = dt.positions.filter((p) => {
    const st = statusAt(p, asOf);
    if (filter === "exception") return p.recaptureException;
    if (filter === "monitored") return p.side === "DTL" && !p.recaptureException && p.globeRelevant;
    if (filter === "dta") return p.side === "DTA";
    if (filter === "approaching") return st === "approaching" || st === "recapture";
    if (filter === "excluded") return !p.globeRelevant;
    return true;
  });
  const pick = dt.positions.find((p) => p.id === selected) ?? rows[0];
  const approachingAmt = dt.approaching + dt.recapture;
  const currentCovered = jur ? jur.coveredTax - dt.pnl : 0;
  const currentOnlyEtr = jur && jur.globeIncome > 0 ? currentCovered / jur.globeIncome : 0;
  const dtTrace = traceDeferredIso(iso);
  const currentTrace = jur
    ? {
        id: `${iso}-current-blend`,
        label: `${dt.name} Current Covered Tax`,
        amount: currentCovered,
        kind: "formula" as const,
        ruleId: "OECD-GloBE-15",
        ruleVersion: "2026.1",
        detail: "Σ Art. 4.1.1 current tax expense on Covered Taxes of Constituent Entities in the jurisdiction. Engine posted, not the LLM.",
        children: (jur.trace.covered.children ?? []).flatMap((n) => n.children?.filter((c) => c.id.endsWith("-current")) ?? []),
      }
    : undefined;
  const haircutTrace = {
    id: `${iso}-haircut`,
    label: `${dt.name} 15% recast haircut`,
    amount: dt.haircut,
    kind: "formula" as const,
    ruleId: "OECD-DT-441",
    ruleVersion: "2026.1",
    detail: `Accounting close ${dt.accountingClose.toLocaleString("en-GB")} recast at the Minimum Rate → GloBE ${dt.globeClose.toLocaleString("en-GB")}. A high domestic CIT cannot inflate ETR.`,
  };
  const recaptureTrace = {
    id: `${iso}-approaching`,
    label: `${dt.name} approaching recapture`,
    amount: approachingAmt,
    kind: "formula" as const,
    ruleId: "OECD-DT-444",
    ruleVersion: "2026.1",
    detail: `Art. 4.4.4 five-year DTL recapture · non-excepted outstanding at FY${DT_FY + 1}`,
  };
  const flow = intelligenceFlow(dt, jur?.coveredTax ?? 0, jur?.globeIncome ?? 0, jur?.jurisdictionalTopUp ?? 0);
  const hotClock = clocks.find((c) => c.status === "recapture" || c.status === "approaching") ?? clocks[0];
  const originAfter = hotClock ? originRecompute(hotClock) : null;
  const impact = jur
    ? recaptureImpact({
        coveredTax: jur.coveredTax,
        globeIncome: jur.globeIncome,
        sbie: jur.sbie,
        currentTopUp: jur.jurisdictionalTopUp,
        recaptureAmount: approachingAmt,
      })
    : null;
  const stackMax = Math.max(1, ...tm.map((y) => y.reversed + y.exception + y.outstanding + y.approaching + y.recapture));
  const transition = transitionSummary(iso);

  return (
    <div>
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Deferred-tax adjustment method.</strong> Article 4.4 exists so a timing difference is not treated as a real low-tax outcome. Adjusted Covered Taxes take current Covered Tax and add the Total Deferred Tax Adjustment Amount — deferred tax expense recast at the Minimum Rate, after exclusions and Article 4.4.2 adjustments. Formula:{" "}
          <span className="mono">ACT = current Covered Tax ± Art. 4.1 + Total Deferred Tax Adjustment (recast {min})</span>
          {" · "}
          <span className="mono">TDTA = recast deferred tax − Art. 4.4.1 exclusions ± Art. 4.4.2</span>
        </div>
        <div className="stack-actions">
          <Link href="/covered-taxes" className="btn btn-secondary">Covered taxes</Link>
          <Link href={jur ? `/etr?iso=${iso}` : "/etr"} className="btn btn-secondary">ETR</Link>
          <a href={OECD_COMMENTARY} className="btn btn-secondary" target="_blank" rel="noreferrer">OECD Commentary 2025</a>
          <button className="btn btn-primary" onClick={() => ask("Explain deferred tax recast and DTL recapture for Thailand")}>Ask GMT24</button>
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
                  <Link key={r} href="#references" className="tag tag-outline" style={{ fontSize: 10 }}>{r}</Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <select className="input" style={{ maxWidth: 320 }} value={iso} onChange={(e) => { setSelected(""); router.push(`/deferred-tax?iso=${e.target.value}`); }}>
          {ledgers.map((j) => (
            <option key={j.iso} value={j.iso}>{j.name} · {j.count} positions</option>
          ))}
        </select>
        <span className="text-muted" style={{ fontSize: 13 }}>
          Domestic CIT {cit}
          {dt.citRate > MIN_RATE ? ` · recast ${min}` : ` · applicable rate below ${min}, no upward recast`}
          {" · "}presentation USD
        </span>
      </div>

      {transition.count > 0 ? (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <h4>Art. 9.1 transition attributes · {iso}</h4>
            <span className="tag tag-outline">Transition Year {transition.transitionYear} · cut-off {transition.cutoff}</span>
          </div>
          <div className="kpi-grid cols-4" style={{ padding: "12px 16px 0" }}>
            <div className="kpi"><div className="kpi-label">9.1.1 / 9.1.2 / 9.1.3</div><div className="kpi-val" style={{ fontSize: 18 }}>{transition.art911} · {transition.art912} · {transition.art913}</div></div>
            <div className="kpi"><div className="kpi-label">Opening DTA allowed</div><div className="kpi-val" style={{ fontSize: 18 }}>{eur(transition.openingDtaAllowed, true)}</div></div>
            <div className="kpi"><div className="kpi-label">DTA stripped</div><div className="kpi-val" style={{ fontSize: 18 }}>{eur(transition.openingDtaExcluded, true)}</div></div>
            <div className="kpi"><div className="kpi-label">Step-up disallowed</div><div className="kpi-val" style={{ fontSize: 18 }}>{eur(transition.stepUpDisallowed, true)}</div></div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Art.</th><th>Item</th><th>Books CV</th><th>GloBE CV</th><th>DTA allowed</th><th>Treatment</th>
                </tr>
              </thead>
              <tbody>
                {transition.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="mono">{line.kind}</td>
                    <td>{line.label}<div className="text-muted" style={{ fontSize: 11 }}>{line.evidence}</div></td>
                    <td className="num">{eur(line.booksCarrying, true)}</td>
                    <td className="num">{eur(line.globeCarrying, true)}</td>
                    <td className="num">{eur(line.openingDtaAllowed, true)}</td>
                    <td style={{ fontSize: 12 }}>{line.treatment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="kpi-grid cols-4" style={{ marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Positions</div>
          <div className="kpi-val">{dt.count}</div>
          <div className="kpi-sub">{dt.name} FY{DT_FY}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">GloBE deferred tax adj.</div>
          <div className="kpi-val"><Amount n={dt.pnl} audit={dtTrace ?? undefined} compact /></div>
          <div className="kpi-sub">Art. 4.4.1 · recast {min}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">15% recast haircut</div>
          <div className="kpi-val"><Amount n={dt.haircut} audit={haircutTrace} compact /></div>
          <div className="kpi-sub">Accounting {eur(dt.accountingClose, true)} → GloBE {eur(dt.globeClose, true)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Approaching recapture</div>
          <div className="kpi-val"><Amount n={approachingAmt} audit={recaptureTrace} compact /></div>
          <div className="kpi-sub">Art. 4.4.4 · deadline FY{DT_FY + 1}</div>
        </div>
      </div>

      <div id="flow" className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h4>Deferred Tax Intelligence Engine</h4>
          <span className="text-muted">Art. 4.4 pipeline · {dt.name}</span>
        </div>
        <div className="panel-body">
          <div className="dt-flow">
            {flow.map((s) => (
              <Link key={s.n} href={s.n === "09" ? `/etr?iso=${iso}` : s.n === "10" ? "/top-up" : s.href} className="dt-flow-step">
                <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-accent)", fontWeight: 700 }}>{s.n}</div>
                <h4 style={{ margin: "6px 0 4px", fontSize: 14 }}>{s.title}</h4>
                <p className="text-muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.4 }}>{s.body}</p>
                {s.amount !== undefined && (
                  <div className="mono" style={{ marginTop: 8 }}>{s.n === "01" ? s.amount : eur(s.amount, true)}</div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div id="recast" className="grid-2" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-head">
            <h4>Why recast exists</h4>
            <Link href="/rulebook" className="tag tag-accent">Art. 4.4.1</Link>
          </div>
          <div className="panel-body waterfall">
            <p className="text-muted" style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5 }}>
              Unit example: GloBE income {RECAST_LESSON.globeIncome}, CIT {pct(RECAST_LESSON.citRate, 0)}, accelerated tax depreciation so taxable income is {RECAST_LESSON.taxableIncome}.
            </p>
            <div className="wf-row">
              <span>Current tax only</span>
              <span>{RECAST_LESSON.currentTax} / {RECAST_LESSON.globeIncome} = {pct(RECAST_LESSON.currentOnlyEtr, 0)}</span>
            </div>
            <div className="wf-row">
              <span>Looks like top-up of {pct(RECAST_LESSON.topUpIfCurrentOnly, 0)}</span>
              <span className="text-muted">Misleading — tax is deferred, not forgiven</span>
            </div>
            <div className="wf-row">
              <span>Accounting DTL (80 × 20%)</span>
              <span>{RECAST_LESSON.accountingDtl}</span>
            </div>
            <div className="wf-row">
              <span>GloBE DTL recast (80 × 15%)</span>
              <span>{RECAST_LESSON.globeDtl}</span>
            </div>
            <div className="wf-row total">
              <span>GloBE ETR (4 + 12) / 100</span>
              <strong>{pct(RECAST_LESSON.globeEtr, 0)} · no top-up</strong>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h4>{dt.name} live recast</h4>
            <span className="text-muted">CIT {cit} → GloBE {min}</span>
          </div>
          <div className="panel-body waterfall">
            <div className="wf-row">
              <span>If Pillar Two used current tax only</span>
              <span>{jur ? `${eur(currentCovered, true)} / ${eur(jur.globeIncome, true)} = ${pct(currentOnlyEtr, 1)}` : "—"}</span>
            </div>
            <div className="wf-row">
              <span>Accounting net DTA/DTL</span>
              <span>{eur(dt.accountingClose)}</span>
            </div>
            <div className="wf-row">
              <span>GloBE amount (temp. difference × {min})</span>
              <span>{eur(dt.globeClose)}</span>
            </div>
            <div className="wf-row">
              <span>Haircut that cannot inflate ETR</span>
              <Amount n={dt.haircut} audit={haircutTrace} />
            </div>
            <div className="wf-row total">
              <span>With Art. 4.4 deferred · jurisdictional ETR</span>
              {jur ? <Amount n={jur.etr} audit={jur.trace.etr} /> : "—"}
            </div>
          </div>
        </div>
      </div>

      <div id="dta" className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h4>DTA lifecycle · tax losses → GloBE DTA → utilisation</h4>
          <span className="text-muted">{dtas.length} DTA tracks · utilised FY{DT_FY} {eur(dt.dtaUtilised, true)}</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Entity</th>
                <th>Path</th>
                <th className="num">Accounting close</th>
                <th className="num">GloBE close</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {dtas.slice(0, 12).map((t) => {
                const e = ENTITIES.find((x) => x.id === t.entityId);
                return (
                  <tr key={t.id} className="clickable" onClick={() => { setSelected(t.id); setFilter("dta"); }}>
                    <td>
                      <div className="mono">{t.id}</div>
                      <div>{t.type}</div>
                    </td>
                    <td>{e?.code ?? t.entityId}</td>
                    <td style={{ fontSize: 12 }}>
                      {t.steps.map((s) => `FY${s.year} ${s.label}${s.globe ? ` ${eur(s.globe, true)}` : ""}`).join(" → ")}
                    </td>
                    <td className="num">{eur(t.accounting.closing, true)}</td>
                    <td className="num">{t.deemed ? eur(t.deemedGlobe, true) : eur(t.globe.closing, true)}</td>
                    <td>
                      <span className={`tag ${t.blocked ? "tag-warn" : "tag-ok"}`}>
                        {t.deemed ? "Deemed — not posted" : t.globe.reversal ? "Utilising" : "Carry-forward"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-muted" style={{ padding: "12px 16px", margin: 0, fontSize: 13 }}>
          Without this track, a later profit year with little current tax looks like a 4% ETR. The DTA reversal is deferred tax expense in the numerator, matching the loss that sheltered the income.
          {dt.deemedCount > 0 ? " Deemed DTAs stay out of Adjusted Covered Taxes until evidence clears IQ-01." : ""}
        </p>
      </div>

      <div id="recapture" className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h4>DTL recapture clocks</h4>
          <Link href="/rulebook" className="tag tag-accent">Art. 4.4.4</Link>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Origin</th>
                <th>Deadline</th>
                <th className="num">Credited (GloBE)</th>
                <th className="num">Still outstanding</th>
                <th>Status</th>
                <th>Positions</th>
              </tr>
            </thead>
            <tbody>
              {clocks.map((c) => {
                const [tag, label] = STATUS_TAG[c.status];
                return (
                  <tr key={c.originYear} className="clickable" onClick={() => { setFilter("approaching"); setAsOf(c.deadlineYear); }}>
                    <td>FY{c.originYear}</td>
                    <td>end of FY{c.deadlineYear}</td>
                    <td className="num">{eur(c.credited, true)}</td>
                    <td className="num">{eur(c.remaining, true)}</td>
                    <td><span className={`tag ${tag}`}>{label}</span></td>
                    <td>{c.positions.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {hotClock && originAfter && hotClock.snapshot && (
          <div className="panel-body">
            <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5 }}>
              <strong>{recompute ? "DTL recapture applied." : "DTL recapture required if not reversed."}</strong>
              {" "}Origin FY{hotClock.originYear} · amount {eur(hotClock.remaining)} · deadline end of FY{hotClock.deadlineYear}.
              {" "}{hotClock.snapshot.source}.
            </p>
            <div className="waterfall">
              <div className="wf-row">
                <span>Origin-year Covered Taxes</span>
                <span>{eur(hotClock.snapshot.coveredTax)} → {recompute ? eur(originAfter.newCovered) : eur(hotClock.snapshot.coveredTax)}</span>
              </div>
              <div className="wf-row">
                <span>Origin-year ETR</span>
                <span>{pct(hotClock.snapshot.coveredTax / hotClock.snapshot.globeIncome, 1)} → {recompute ? pct(originAfter.newEtr, 1) : pct(hotClock.snapshot.coveredTax / hotClock.snapshot.globeIncome, 1)}</span>
              </div>
              <div className="wf-row total">
                <span>Incremental origin-year Top-up Tax</span>
                <strong>{recompute ? eur(originAfter.incremental) : "—"}</strong>
              </div>
            </div>
            <div className="stack-actions" style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-primary" onClick={() => setRecompute((v) => !v)}>
                {recompute ? "Clear recapture simulation" : "Recompute origin-year ETR"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setFilter("approaching"); setAsOf(DT_FY); }}>Show positions</button>
            </div>
          </div>
        )}
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h4>Deferred Tax Time Machine · {dt.name}</h4>
          <span className="text-muted">FY{DT_FY} → FY{DT_FY + 5} · Art. 4.4.4 / 4.4.5</span>
        </div>
        <div className="panel-body">
          <div className="dt-timeline">
            {tm.map((y) => {
              const total = y.reversed + y.exception + y.outstanding + y.approaching + y.recapture;
              const on = y.year === asOf;
              return (
                <button
                  key={y.year}
                  type="button"
                  className={`dt-year${on ? " on" : ""}${y.approaching || y.recapture ? " risk" : ""}`}
                  onClick={() => setAsOf(y.year)}
                >
                  <div className="dt-year-label">FY{y.year}</div>
                  <div className="dt-stack" aria-hidden>
                    <div className="dt-seg recapture" style={{ height: `${((y.recapture + y.approaching) / stackMax) * 100}%` }} />
                    <div className="dt-seg outstanding" style={{ height: `${(y.outstanding / stackMax) * 100}%` }} />
                    <div className="dt-seg exception" style={{ height: `${(y.exception / stackMax) * 100}%` }} />
                    <div className="dt-seg reversed" style={{ height: `${(y.reversed / stackMax) * 100}%` }} />
                  </div>
                  <div className="dt-year-total">{eur(total, true)}</div>
                </button>
              );
            })}
          </div>
          <div className="dt-legend">
            <span><i className="dt-dot reversed" /> Reversed {eur(yearCol.reversed, true)}</span>
            <span><i className="dt-dot exception" /> Exception {eur(yearCol.exception, true)}</span>
            <span><i className="dt-dot outstanding" /> Outstanding {eur(yearCol.outstanding, true)}</span>
            <span><i className="dt-dot recapture" /> Recapture {eur(yearCol.approaching + yearCol.recapture, true)}</span>
          </div>
        </div>
      </div>

      {impact && approachingAmt > 0 && (
        <div className="callout" style={{ marginBottom: 20 }}>
          <strong>Potential exposure.</strong> {eur(approachingAmt)} of {dt.name} DTL is not an Article 4.4.5 Recapture Exception Accrual and remains outstanding at the FY{DT_FY + 1} deadline.
          {" "}If it does not reverse, Article 4.4.4 requires the origin-year ETR to be recomputed.
          {jur && (
            <>
              {" "}Illustrative impact if that GloBE amount came out of this year’s Covered Taxes: ETR{" "}
              <strong>{pct(jur.etr, 1)} → {pct(impact.newEtr, 1)}</strong>
              {" · "}potential additional Top-up Tax <strong>{eur(impact.incremental)}</strong>.
            </>
          )}
          <div className="stack-actions" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => { setFilter("approaching"); setAsOf(DT_FY); }}>Show recapture clock</button>
            <Link href="/issues" className="btn btn-secondary">Open issues</Link>
          </div>
        </div>
      )}

      {dt.deemedCount > 0 && (
        <div className="callout" style={{ marginBottom: 20 }}>
          <strong>Deemed DTA.</strong> {dt.deemedCount} position{dt.deemedCount === 1 ? "" : "s"} would be a GloBE deferred tax asset if accounting recognition criteria had been met. They are held out of Adjusted Covered Taxes until the loss memorandum is in evidence (IQ-01).
          {" "}<Link href="/issues">Vietnam data gap</Link>
        </div>
      )}

      <div id="engines" className="dt-engines" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-head">
            <h4>FANIL Engine</h4>
            <span className="text-muted">Denominator · Art. 3.1–3.2</span>
          </div>
          <div className="panel-body waterfall">
            <div className="wf-row"><span>Financial accounts → FANIL</span><span>UPE CFS</span></div>
            <div className="wf-row"><span>± Art. 3.2 adjustments</span><span><Link href="/globe-income">Open</Link></span></div>
            <div className="wf-row total">
              <span>Net GloBE Income</span>
              {jur ? <Amount n={jur.globeIncome} audit={jur.trace.globe} /> : "—"}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h4>Covered Tax &amp; Deferred Tax Engine</h4>
            <span className="text-muted">Numerator · Art. 4.1–4.4</span>
          </div>
          <div className="panel-body waterfall">
            <div className="wf-row"><span>Current Covered Tax</span>{jur ? <Amount n={currentCovered} audit={currentTrace} /> : "—"}</div>
            <div className="wf-row"><span>+ Art. 4.4 deferred (recast {min})</span><Amount n={dt.pnl} audit={dtTrace ?? undefined} /></div>
            <div className="wf-row total">
              <span>Adjusted Covered Taxes</span>
              {jur ? <Amount n={jur.coveredTax} audit={jur.trace.covered} /> : "—"}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h4>Jurisdictional ETR Engine</h4>
            <span className="text-muted">Where they meet · Art. 5.1.1</span>
          </div>
          <div className="panel-body waterfall">
            <div className="wf-row"><span>Covered Taxes ÷ GloBE Income</span>{jur ? <Amount n={jur.etr} audit={jur.trace.etr} /> : "—"}</div>
            <div className="wf-row"><span>Top-up Tax Percentage</span><span>{jur ? pct(jur.topUpRate, 2) : "—"}</span></div>
            <div className="wf-row total">
              <span>Jurisdictional Top-up</span>
              {jur ? <Amount n={jur.jurisdictionalTopUp} audit={jur.audit} /> : "—"}
            </div>
          </div>
          <div className="stack-actions" style={{ padding: "0 16px 16px" }}>
            <Link href="/globe-income" className="btn btn-secondary">FANIL</Link>
            <Link href="/covered-taxes" className="btn btn-secondary">Covered taxes</Link>
            <Link href={`/etr?iso=${iso}`} className="btn btn-primary">ETR</Link>
          </div>
        </div>
      </div>

      <div className="grid-split" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-head">
            <h4>Article 4.4.5 classifier</h4>
            <span className="text-muted">{pick ? pick.id : "Select a position"}</span>
          </div>
          <div className="panel-body">
            {pick ? <PositionCard p={pick} asOf={asOf} /> : <p className="text-muted">Select a ledger row.</p>}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h4>{dt.name} ETR numerator</h4>
            <span className="text-muted">Art. 5.1.1</span>
          </div>
          <div className="panel-body waterfall">
            <div className="wf-row">
              <span>Current Covered Tax</span>
              {jur ? <Amount n={jur.coveredTax - dt.pnl} audit={currentTrace} /> : "—"}
            </div>
            <div className="wf-row">
              <span>+ Total Deferred Tax Adjustment</span>
              <Amount n={dt.pnl} audit={dtTrace ?? undefined} />
            </div>
            <div className="wf-row total">
              <span>Adjusted Covered Taxes</span>
              {jur ? <Amount n={jur.coveredTax} audit={jur.trace.covered} /> : "—"}
            </div>
            <div className="wf-row">
              <span>÷ Net GloBE Income</span>
              {jur ? <Amount n={jur.globeIncome} audit={jur.trace.globe} /> : "—"}
            </div>
            <div className="wf-row total">
              <span>Jurisdictional ETR</span>
              {jur ? <Amount n={jur.etr} audit={jur.trace.etr} /> : "—"}
            </div>
          </div>
          <div className="stack-actions" style={{ padding: "0 16px 16px" }}>
            <Link href="/globe-income" className="btn btn-secondary">FANIL engine</Link>
            <Link href="/covered-taxes" className="btn btn-primary">Covered taxes</Link>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h4>DTA / DTL sub-ledger</h4>
          <div className="stack-actions">
            {(["all", "exception", "monitored", "dta", "approaching", "excluded"] as Filter[]).map((f) => (
              <button key={f} type="button" className={`btn ${filter === f ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "exception" ? "4.4.5 exception" : f === "monitored" ? "Five-year clock" : f === "dta" ? "DTA" : f === "excluded" ? "Exclusions" : "Recapture"}
              </button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Entity</th>
                <th>Type</th>
                <th className="num">Open</th>
                <th className="num">Add</th>
                <th className="num">Rev.</th>
                <th className="num">Close</th>
                <th className="num">Acct rate</th>
                <th className="num">GloBE</th>
                <th>Art. 4.4</th>
                <th>4.4.5</th>
                <th>Deadline</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 80).map((p) => {
                const e = ENTITIES.find((x) => x.id === p.entityId);
                const st = statusAt(p, asOf);
                const [tag, label] = STATUS_TAG[st];
                return (
                  <tr key={p.id} className="clickable" onClick={() => setSelected(p.id)}>
                    <td className="mono">{p.id}</td>
                    <td>{e?.code ?? p.entityId}</td>
                    <td>{p.side} · {p.type}</td>
                    <td className="num">{eur(p.opening, true)}</td>
                    <td className="num">{eur(p.addition, true)}</td>
                    <td className="num">{eur(p.reversal, true)}</td>
                    <td className="num">{eur(p.closing, true)}</td>
                    <td className="num">{pct(p.accountingRate, p.accountingRate >= 0.2 ? 0 : 1)}</td>
                    <td className="num"><Amount n={p.globeClosing} audit={traceDtPosition(p)} compact /></td>
                    <td>{p.treatment}</td>
                    <td>{p.exception ? "Y" : p.side === "DTL" && p.globeRelevant ? "N" : "—"}</td>
                    <td><span className={`tag ${tag}`}>{p.deadlineYear ? `FY${p.deadlineYear}` : label}</span></td>
                    <td className="text-muted" style={{ fontSize: 12 }}>{p.evidence}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length > 80 && (
          <p className="text-muted" style={{ padding: "12px 16px", margin: 0, fontSize: 13 }}>
            Showing 80 of {rows.length} positions in this filter. {dt.count} in the {dt.name} register.
          </p>
        )}
      </div>

      <p className="text-muted" style={{ marginTop: 14, fontSize: 13 }}>
        FANIL Engine sets the denominator. Covered Tax &amp; Deferred Tax Engine sets the numerator. They meet in the Jurisdictional ETR.
        {" "}
        <Link href="/globe-income">GloBE income</Link>
        {" · "}
        <Link href="/covered-taxes">Covered taxes</Link>
        {" · "}
        <Link href="/etr">ETR</Link>
      </p>

      <div className="panel" style={{ marginTop: 20 }} id="references">
        <div className="panel-head">
          <h4>References</h4>
          <div className="stack-actions">
            <a href={OECD_MODEL} className="btn btn-ghost" target="_blank" rel="noreferrer">Model Rules 2021</a>
            <a href={OECD_COMMENTARY} className="btn btn-ghost" target="_blank" rel="noreferrer">Commentary 2025</a>
            <Link href="/rulebook" className="btn btn-ghost">GMT24 rulebook</Link>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Cite</th><th>Authority</th><th>GMT24 / location</th></tr></thead>
            <tbody>
              {REFERENCES.map((r) => (
                <tr
                  key={r.cite}
                  className="clickable"
                  onClick={() => { if (r.external) window.open(r.href, "_blank", "noopener,noreferrer"); else router.push(r.href); }}
                >
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{r.cite}</td>
                  <td>{r.work}</td>
                  <td>
                    {r.external
                      ? <a href={r.href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{r.loc}</a>
                      : <Link href={r.href}>{r.loc}</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PositionCard({ p, asOf }: { p: DtView; asOf: number }) {
  const st = statusAt(p, asOf);
  const [tag, label] = STATUS_TAG[st];
  const e = ENTITIES.find((x) => x.id === p.entityId);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div className="mono" style={{ fontSize: 12 }}>{p.id}</div>
          <h4 style={{ margin: "4px 0 0" }}>{p.type}</h4>
          <div className="text-muted" style={{ fontSize: 12 }}>{e?.name} · origin FY{p.originYear}</div>
        </div>
        <span className={`tag ${tag}`}>{label}</span>
      </div>
      <div className="wf-row"><span>Side</span><span>{p.side}</span></div>
      <div className="wf-row"><span>Opening / + addition / − reversal / closing</span><span>{eur(p.opening, true)} / {eur(p.addition, true)} / {eur(p.reversal, true)} / {eur(p.closing, true)}</span></div>
      <div className="wf-row"><span>Accounting rate</span><span>{pct(p.accountingRate, p.accountingRate >= 0.2 ? 0 : 1)}</span></div>
      <div className="wf-row"><span>GloBE rate</span><span>{pct(p.globeRate, 0)}</span></div>
      <div className="wf-row"><span>GloBE closing</span><Amount n={p.globeClosing} audit={traceDtPosition(p)} /></div>
      <div className="wf-row"><span>Recast haircut</span><span>{eur(p.recastHaircut)}</span></div>
      <div className="wf-row"><span>Article 4.4.5 exception?</span><span>{p.exception ? `Yes · ${p.exception}` : "No"}</span></div>
      {p.exception && <p className="text-muted" style={{ fontSize: 13, margin: "8px 0 0" }}>{EXCEPTION_LABEL[p.exception]}. Five-year recapture monitoring is not required. <Link href="#references">Art. 4.4.5</Link></p>}
      {!p.globeRelevant && !p.deemed && <p className="text-muted" style={{ fontSize: 13, margin: "8px 0 0" }}>Excluded from the Total Deferred Tax Adjustment Amount. <Link href="#references">Art. 4.4.1</Link></p>}
      {!p.exception && p.side === "DTL" && (
        <div className="wf-row">
          <span>Five-year deadline</span>
          <span>FY{p.deadlineYear}{p.expectedReversalYear ? ` · expected reversal FY${p.expectedReversalYear}` : " · no expected reversal dated"}</span>
        </div>
      )}
      <p className="text-muted" style={{ fontSize: 12, margin: "12px 0 0" }}>{p.evidence}{p.excludedReason ? ` · ${p.excludedReason}` : ""}</p>
    </div>
  );
}

export default function DeferredTaxPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}

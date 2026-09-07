import type { JurCalc } from "../engine";
import { isosIn } from "./i18n";
import { applyPackage, eligibilityEngine, flagsFromOn, optimizeGlobe, switchKey, type SbieMode } from "../electionEngine";
import { ELECTIONS, electionById } from "../elections";
import { eur, money, pct } from "../format";
import { runEngine, type CalcInputs } from "./calc";
import { propose } from "./actions";
import { ruleVersion } from "./knowledge";
import type { Reply, SavedScenario, ScenarioJurRow, ScenarioSpec, Section, WorkContext } from "./types";

/**
 * AI Strategy Simulator. Translates a plain-language question into explicit
 * assumptions, runs the calculation engine in isolation, and compares against the
 * current working package. The result is a draft scenario; adoption goes through
 * the gateway and the election engine's own eligibility and lock rules.
 */

export function parseScenario(q: string, calcs: JurCalc[], current: { scenario: CalcInputs["scenario"]; electionsOn: Record<string, boolean>; sbieClaim: Record<string, SbieMode> }): { spec: ScenarioSpec; assumptions: string[]; unparsed: string[] } {
  const l = q.toLowerCase();
  const spec: ScenarioSpec = {};
  const assumptions: string[] = [];
  const unparsed: string[] = [];
  const isos = isosIn(q);
  const iso = isos[0] ?? (calcs.some((c) => c.iso === "TH") ? "TH" : calcs[0]?.iso);
  const name = calcs.find((c) => c.iso === iso)?.name ?? iso;
  const num = (re: RegExp) => { const m = l.match(re); return m ? Number(m[1].replace(/,/g, "")) * (m[2]?.startsWith("m") || m[2] === "ล้าน" ? 1_000_000 : m[2]?.startsWith("k") ? 1_000 : 1) : null; };

  if (/boi|tax holiday|incentive|extend/.test(l) && iso === "TH") {
    const off = /\b(drop|end|ends|ending|expire|expires|expiry|lose|lapse|without|no longer|not extend|don't extend|do not extend)\b|ไม่ต่อ|หมดอายุ/.test(l);
    spec.boiExtend = !off;
    assumptions.push(`BOI incentive ${off ? "is not extended — Thai statutory tax applies from the expiry date in the incentive register" : "is extended for the full fiscal year on the same certificate terms"}.`);
  }
  if (/payroll|hire|headcount|employee|staff|จ้าง|พนักงาน/.test(l)) {
    const n = num(/(?:\$|usd)?\s?([\d.,]+)\s?(m|million|k|thousand|ล้าน)?/);
    const heads = l.match(/(\d+)\s?(employees|staff|heads|people|คน)/);
    const add = heads ? Number(heads[1]) * 45_000 : n ?? 2_000_000;
    spec.payrollTh = money(add);
    assumptions.push(heads ? `${heads[1]} additional Thai employees at an assumed $45,000 eligible payroll each (${eur(add)}) — replace with the HR budget figure.` : `Additional eligible Thai payroll of ${eur(add)}, all performed in Thailand, all Eligible Employees under Art. 5.3.3.`);
  }
  if (/transfer pric|tp margin|margin|mark-?up/.test(l)) {
    const m = l.match(/([\d.]+)\s?%/);
    spec.tpMargin = m ? Number(m[1]) : 5;
    assumptions.push(`Ireland cost-plus margin set to ${spec.tpMargin}% — assumes the counterparty deduction and Irish inclusion move symmetrically and the policy is arm's length.`);
  }
  const elects: { key: string; on: boolean }[] = [];
  for (const e of ELECTIONS) {
    const idl = e.id.toLowerCase();
    const art = e.article.toLowerCase().replace("art. ", "");
    const hit = l.includes(art) || l.includes(idl) || e.name.toLowerCase().split(" ").filter((w) => w.length > 5).some((w) => l.includes(w));
    if (!hit) continue;
    const off = /(revoke|drop|turn off|remove|without|ยกเลิก)/.test(l);
    const scopeIso = e.scope === "GROUP" || e.scope === "ALL_JURISDICTIONS" ? "GROUP" : iso;
    elects.push({ key: switchKey(e.id, scopeIso), on: !off });
    assumptions.push(`${off ? "Revoke" : "Elect"} ${e.name} (${e.article}) for ${scopeIso === "GROUP" ? "the group" : name}. Duration: ${e.duration}.`);
  }
  if (/stock|share-?based|equity comp/.test(l) && !elects.some((x) => x.key.startsWith("OECD_3.2.2"))) { elects.push({ key: switchKey("OECD_3.2.2", iso), on: true }); assumptions.push(`Elect Art. 3.2.2 stock-based compensation for ${name} (five-year election).`); }
  if (/safe harbou?r|tcsh|transitional/.test(l) && !elects.length) { elects.push({ key: switchKey("SH_TCSH", iso), on: true }); assumptions.push(`Apply the transitional CbCR safe harbour to ${name} — requires qualified CbCR data and passes one of the three tests.`); }
  if (elects.length) spec.elections = elects;
  if (/sbie|substance|carve/.test(l)) {
    const mode: SbieMode = /no sbie|without sbie|none|zero/.test(l) ? "none" : /partial|half/.test(l) ? "partial" : "max";
    spec.sbie = [{ iso, mode }];
    assumptions.push(`SBIE claim for ${name} set to ${mode}.`);
  }
  if (/restructur|move|relocat|shift|transfer (the )?(ip|function|entity)|ย้าย/.test(l)) unparsed.push("Restructuring (moving income, IP or entities between jurisdictions) is not a modelled lever — the engine has no transfer-of-function inputs. Model it as a TP margin or payroll change, or open a task for a tax-manager-led scenario.");
  if (!Object.keys(spec).length && !unparsed.length) unparsed.push("No modelled lever recognised. Levers: BOI extension, Thai payroll, Ireland TP margin, any election in the register, SBIE claim.");
  return { spec, assumptions, unparsed };
}

export function runScenario(spec: ScenarioSpec, inputs: CalcInputs, working: JurCalc[], ctx: WorkContext, question: string, assumptions: string[]): SavedScenario {
  const electionsOn = { ...inputs.electionsOn };
  for (const e of spec.elections ?? []) { if (e.on) electionsOn[e.key] = true; else delete electionsOn[e.key]; }
  const scenario = { boiExtend: spec.boiExtend ?? inputs.scenario.boiExtend, payrollTh: spec.payrollTh != null ? inputs.scenario.payrollTh + spec.payrollTh : inputs.scenario.payrollTh, tpMargin: spec.tpMargin ?? inputs.scenario.tpMargin };
  const sbieClaim = { ...inputs.sbieClaim };
  for (const s of spec.sbie ?? []) sbieClaim[s.iso] = s.mode;
  const calcs = runEngine(inputs, { electionsOn, scenario });
  const elig = eligibilityEngine(calcs);
  const rowsS = applyPackage(calcs, flagsFromOn(elig, electionsOn, sbieClaim));
  const rowsB = applyPackage(working, flagsFromOn(eligibilityEngine(working), inputs.electionsOn, inputs.sbieClaim));
  const rows: ScenarioJurRow[] = rowsS.map((r) => {
    const b = rowsB.find((x) => (x.blendKey ?? x.iso) === (r.blendKey ?? r.iso));
    const c = calcs.find((x) => x.blendKey === (r.blendKey ?? r.iso));
    return { iso: r.iso, name: r.name, blendKey: r.blendKey ?? r.iso, baseTopUp: b?.topUp ?? 0, topUp: r.topUp, baseEtr: b?.etr ?? 0, etr: r.etr, payer: c?.collection.payer ?? "" };
  });
  const baseTopUp = money(rowsB.reduce((a, r) => a + r.topUp, 0));
  const topUp = money(rowsS.reduce((a, r) => a + r.topUp, 0));
  const eligibility = (spec.elections ?? []).map((e) => {
    const [id, iso] = e.key.split("@");
    const row = elig.find((r) => r.election.id === id && r.iso === iso);
    return { key: e.key, status: row?.status ?? "n/a", reason: row?.reason ?? "No eligibility row for this jurisdiction." };
  });
  const lockYears = (spec.elections ?? []).some((e) => e.on && electionById(e.key.split("@")[0])?.duration === "five-year") ? 5 : 0;
  const multiYear = [0, 1, 2, 3, 4].map((k) => {
    const fy = `FY${2026 + k}`;
    const decay = spec.boiExtend === false && k > 0 ? 1 : 1;
    return { fy, base: baseTopUp, scenario: money(topUp * decay), note: k === 0 ? "Engine result" : lockYears ? `Flat extrapolation — five-year lock binds through FY${2026 + lockYears - 1}` : "Flat extrapolation; re-run when the year's inputs exist" };
  });
  const sens: SavedScenario["sensitivity"] = [];
  if (spec.payrollTh != null) {
    for (const f of [0.8, 1.2]) {
      const alt = runEngine(inputs, { electionsOn, scenario: { ...scenario, payrollTh: money(inputs.scenario.payrollTh + spec.payrollTh * f) } });
      const t = money(applyPackage(alt, flagsFromOn(eligibilityEngine(alt), electionsOn, sbieClaim)).reduce((a, r) => a + r.topUp, 0));
      sens.push({ label: `Payroll ${f < 1 ? "−20%" : "+20%"}`, topUp: t, delta: money(t - topUp) });
    }
  }
  if (spec.tpMargin != null) {
    for (const d of [-1, 1]) {
      const alt = runEngine(inputs, { electionsOn, scenario: { ...scenario, tpMargin: scenario.tpMargin + d } });
      const t = money(applyPackage(alt, flagsFromOn(eligibilityEngine(alt), electionsOn, sbieClaim)).reduce((a, r) => a + r.topUp, 0));
      sens.push({ label: `TP margin ${d > 0 ? "+" : "−"}1pt`, topUp: t, delta: money(t - topUp) });
    }
  }
  const compliance: string[] = [];
  if (lockYears) compliance.push(`Five-year election: binds ${ctx.fy}–FY${2026 + lockYears - 1}; early revocation is a GIR consistency breach.`);
  for (const e of eligibility) if (e.status !== "available" && e.status !== "locked") compliance.push(`${e.key}: ${e.status} — ${e.reason}`);
  if (spec.boiExtend != null) compliance.push("BOI extension is a fact to be evidenced by a BOI certificate amendment, not an election. Route through X-Ray BOI Privilege before booking.");
  if (spec.payrollTh) compliance.push("Payroll carve-out counts only Eligible Employees performing activities in the jurisdiction (Art. 5.3.3) — contractors and seconded staff need the X-Ray payroll confirmation.");
  if (spec.tpMargin != null) compliance.push("TP change must be arm's length and documented; the counterparty jurisdiction's income moves in the opposite direction (Art. 3.2.3 consistency).");
  compliance.push("Adoption changes the working package only. The approved snapshot is untouched until re-approved.");
  return {
    id: `sc-${Date.now().toString(36)}`,
    title: assumptions[0]?.split(" — ")[0]?.replace(/\.$/, "").slice(0, 70) || question.slice(0, 70),
    question,
    spec,
    assumptions,
    eligibility,
    ruleVersion: `${ctx.rulePack} · ${ruleVersion("OECD_5.2")}`,
    calcVersion: ctx.calcVersion,
    fy: ctx.fy,
    createdAt: new Date().toISOString(),
    createdBy: ctx.user.name,
    status: "draft",
    baseTopUp,
    topUp,
    rows,
    multiYear,
    sensitivity: sens,
    compliance,
  };
}

export function strategyReply(sc: SavedScenario, ctx: WorkContext, unparsed: string[], calcs: JurCalc[]): Reply {
  const delta = money(sc.topUp - sc.baseTopUp);
  const moved = sc.rows.filter((r) => Math.abs(r.topUp - r.baseTopUp) >= 1).sort((a, b) => Math.abs(b.topUp - b.baseTopUp) - Math.abs(a.topUp - a.baseTopUp));
  const sections: Section[] = [];
  sections.push({ kind: "conclusion", text: `${sc.title}: group top-up ${eur(sc.baseTopUp)} → ${eur(sc.topUp)} (${delta <= 0 ? "−" : "+"}${eur(Math.abs(delta))}) on ${sc.calcVersion}. ${moved.length ? `${moved.length} jurisdiction${moved.length === 1 ? "" : "s"} move.` : "No jurisdiction moves — the lever does not touch this group's figures."}` });
  sections.push({ kind: "list", title: "Explicit assumptions", items: sc.assumptions });
  if (unparsed.length) sections.push({ kind: "warning", text: unparsed.join(" ") });
  if (moved.length) sections.push({ kind: "table", title: "Jurisdiction comparison", head: ["Jurisdiction", "Top-up now", "Scenario", "ETR now → scenario", "Collected by"], rows: moved.slice(0, 8).map((r) => [r.name, eur(r.baseTopUp), eur(r.topUp), `${pct(r.baseEtr, 2)} → ${pct(r.etr, 2)}`, r.payer]) });
  if (sc.eligibility.length) sections.push({ kind: "facts", title: "Eligibility screen", items: sc.eligibility.map((e) => `${e.key}: ${e.status} — ${e.reason}`) });
  sections.push({ kind: "table", title: "Multi-year view (flat extrapolation)", head: ["Year", "Current package", "Scenario", "Note"], rows: sc.multiYear.map((m) => [m.fy, eur(m.base), eur(m.scenario), m.note]) });
  if (sc.sensitivity.length) sections.push({ kind: "table", title: "Sensitivity", head: ["Case", "Group top-up", "vs scenario"], rows: sc.sensitivity.map((s) => [s.label, eur(s.topUp), `${s.delta >= 0 ? "+" : "−"}${eur(Math.abs(s.delta))}`]) });
  sections.push({ kind: "impact", title: "Compliance considerations", items: sc.compliance });
  const O = optimizeGlobe(calcs);
  const best = O.recs.find((r) => r.id === "05") ?? O.recs[0];
  sections.push({ kind: "next", items: [
    "Save as a draft scenario (reproducible: inputs, assumptions, eligibility, rule version).",
    "Adoption converts the scenario into working-package changes through review — an authorised reviewer must execute it.",
    best ? `For comparison, the election engine's ${best.label.toLowerCase()} package posts ${eur(best.scenario.fyTopUp)}.` : "",
  ].filter(Boolean) });
  return {
    id: `r-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    feature: "strategy",
    title: `Strategy Simulator · ${sc.title}`,
    sections,
    cites: [{ label: sc.ruleVersion, href: "/rulebook" }, { label: "Election engine", href: "/elections" }],
    actions: [
      propose("save-scenario", { id: sc.id }, ctx),
      propose("adopt-scenario", { id: sc.id }, ctx),
      propose("navigate", { href: "/strategy", label: "Open Strategy Simulator" }, ctx),
    ],
    grounded: true,
    unsupported: unparsed,
    version: ctx.calcVersion,
    lang: ctx.lang,
    chips: ["What if BOI is not extended?", "Hire 50 more Thai employees", "Elect stock compensation in Thailand", "Ireland TP margin 5%"],
  };
}

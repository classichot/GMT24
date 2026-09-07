import type { JurCalc } from "../engine";
import { eligibilityEngine, splitSwitch } from "../electionEngine";
import { eur, pct } from "../format";
import { ACCOUNTS, ADJUSTMENTS, ENTITIES, ISSUES } from "../model";
import { findingStatus, type XrayFinding, type XrayState } from "../xray";
import { movementVsBaseline, movementVsPrior, type CalcInputs } from "./calc";
import { propose } from "./actions";
import type { Reply, Section, Task, WorkContext } from "./types";

/**
 * AI Calculation Reviewer. Two kinds of finding, never mixed:
 *  - validation: a deterministic check failed (numbers, presence, eligibility);
 *  - suspected: a pattern the reviewer thinks a human should challenge.
 * Every finding states what was checked, what was expected, what was found, and
 * the question to ask. Resolution goes through the task service, so a dismissal
 * needs a reason and stays visible.
 */
export type ReviewFinding = {
  id: string;
  kind: "validation" | "suspected";
  area: "mapping" | "reconciliation" | "treatment" | "elections" | "movement" | "evidence";
  severity: Task["severity"];
  title: string;
  checked: string;
  expected: string;
  actual: string;
  question: string;
  owner: string;
  href: string;
  iso?: string;
  entityId?: string;
};

export type ReviewInput = {
  calcs: JurCalc[];
  inputs: CalcInputs;
  findings: XrayFinding[];
  xray: XrayState;
  approvedMaps: Record<string, boolean>;
  groupId: string;
};

export function reviewCalculation(i: ReviewInput): ReviewFinding[] {
  const out: ReviewFinding[] = [];
  const { calcs } = i;
  const ents = ENTITIES.filter((e) => calcs.some((c) => c.entities.some((x) => x.id === e.id)) || e.id.startsWith(i.groupId.slice(0, 3)));

  // 1. Mapping completeness.
  const pending = ACCOUNTS.filter((a) => !a.approved && !i.approvedMaps[a.account]);
  for (const a of pending) {
    out.push({ id: `map-${a.account}`, kind: "validation", area: "mapping", severity: a.confidence < 70 ? "block" : "warn", title: `Mapping ${a.account} ${a.name} not approved`, checked: "Every posted account has an approved GloBE category.", expected: "Approved (≥ 80% confidence or reviewer-approved)", actual: `${a.confidence}% confidence · ${a.globe}${a.adjustment ? ` → ${a.adjustment}` : ""} · ${eur(a.amount)} posted at default`, question: `Is ${a.name} correctly a ${a.globe}${a.adjustment ? ` with ${a.adjustment}` : ""}?`, owner: "Preparer", href: "/mapping", entityId: a.entityId });
  }
  const dupMaps = new Map<string, Set<string>>();
  for (const a of ACCOUNTS) {
    const k = a.name.toLowerCase();
    dupMaps.set(k, new Set([...(dupMaps.get(k) ?? []), a.globe]));
  }
  for (const [name, cats] of dupMaps) if (cats.size > 1) out.push({ id: `map-incons-${name.replace(/\W+/g, "-")}`, kind: "suspected", area: "treatment", severity: "warn", title: `"${name}" mapped to ${cats.size} different categories`, checked: "Same-named accounts across entities map consistently.", expected: "One GloBE category", actual: [...cats].join(" / "), question: "Is the difference intentional (different economic nature) or a mapping inconsistency?", owner: "Reviewer", href: "/mapping" });

  // 2. Reconciliation — population and entity-to-jurisdiction sums.
  for (const c of calcs) {
    const fanilSum = c.entities.length ? c.fanil : 0;
    const adj = ADJUSTMENTS.filter((a) => c.entities.some((e) => e.id === a.entityId)).reduce((s, a) => s + a.amount, 0);
    const bridge = Math.abs(fanilSum + adj - c.globeIncome);
    if (fanilSum && bridge > Math.max(50_000, Math.abs(c.globeIncome) * 0.02)) {
      out.push({ id: `recon-${c.blendKey}`, kind: "suspected", area: "reconciliation", severity: "warn", title: `${c.name}: FANIL + listed adjustments ≠ GloBE income`, checked: "FANIL plus recorded Art. 3.2 adjustments bridges to GloBE income.", expected: eur(fanilSum + adj), actual: `${eur(c.globeIncome)} (gap ${eur(bridge)})`, question: "Which engine-level adjustment (mapping override, election, scenario) explains the residual? Open the trace.", owner: "Reviewer", href: `/etr?iso=${c.iso}`, iso: c.iso });
    }
    if (c.sbie > c.globeIncome && c.globeIncome > 0) out.push({ id: `sbie-gt-${c.blendKey}`, kind: "suspected", area: "reconciliation", severity: "info", title: `${c.name}: SBIE exceeds GloBE income`, checked: "SBIE relative to income.", expected: "SBIE ≤ GloBE income for a positive top-up base", actual: `SBIE ${eur(c.sbie)} vs income ${eur(c.globeIncome)}`, question: "Is the payroll/asset base overstated, or is income understated after adjustments?", owner: "Preparer", href: `/etr?iso=${c.iso}`, iso: c.iso });
  }
  const missingEnts = ents.filter((e) => !e.excludedReason && !calcs.some((c) => c.entities.some((x) => x.id === e.id)));
  for (const e of missingEnts) out.push({ id: `pop-${e.id}`, kind: "validation", area: "reconciliation", severity: "block", title: `${e.code} not in any jurisdiction calculation`, checked: "Every non-excluded constituent entity is in a jurisdictional blend.", expected: "Present", actual: "Absent", question: `Is ${e.name} an excluded entity, or did the blend key drop it?`, owner: "Preparer", href: "/entities", entityId: e.id, iso: e.iso });

  // 3. Treatment consistency — adjustments without reviewer, ENTE, negative covered.
  for (const a of ADJUSTMENTS.filter((x) => !x.reviewer)) out.push({ id: `adj-${a.id}`, kind: "validation", area: "evidence", severity: "warn", title: `${a.id} ${a.category} unsigned`, checked: "Each Art. 3.2 adjustment has a reviewer.", expected: "Reviewer recorded", actual: `${eur(a.amount)} · preparer ${a.preparer} · no reviewer`, question: `Does ${a.sourceDoc} support ${a.reason}?`, owner: "Reviewer", href: "/globe-income", entityId: a.entityId });
  for (const c of calcs) {
    if (c.coveredTax < 0 && c.globeIncome > 0 && !c.enteOriginated) out.push({ id: `ente-missing-${c.blendKey}`, kind: "validation", area: "treatment", severity: "block", title: `${c.name}: negative covered taxes with profit but no ENTE`, checked: "Art. 5.2.1 Excess Negative Tax Expense procedure applies when Adjusted Covered Taxes < 0 and GloBE income > 0.", expected: "ENTE originated; Top-up % capped at 15%", actual: `Covered ${eur(c.coveredTax)} · Top-up % ${pct(c.topUpRate, 2)}`, question: "Why did the engine not apply the ENTE administrative procedure?", owner: "Reviewer", href: `/etr?iso=${c.iso}`, iso: c.iso });
    if (c.topUpRate > 0.15001) out.push({ id: `rate-cap-${c.blendKey}`, kind: "validation", area: "treatment", severity: "block", title: `${c.name}: Top-up % above 15%`, checked: "Top-up Tax Percentage cannot exceed the 15% minimum rate.", expected: "≤ 15.00%", actual: pct(c.topUpRate, 2), question: "Negative ETR without ENTE cap — check covered tax sign and the ENTE branch.", owner: "Reviewer", href: `/etr?iso=${c.iso}`, iso: c.iso });
    if (c.completeness < 90) out.push({ id: `compl-${c.blendKey}`, kind: "suspected", area: "evidence", severity: c.completeness < 75 ? "block" : "warn", title: `${c.name}: data completeness ${c.completeness}%`, checked: "Estimated inputs in the jurisdiction.", expected: "≥ 90%", actual: `${c.completeness}% · top-up ${eur(c.jurisdictionalTopUp)} rests partly on estimates`, question: `Which inputs are estimated and who owns the source? (${ISSUES.filter((x) => x.jurisdiction === c.name).map((x) => x.id).join(", ") || "see Data quality"})`, owner: "Preparer", href: "/quality", iso: c.iso });
    if (c.exposure === "Top-up" && c.sh.outcome === "Not tested") out.push({ id: `sh-untested-${c.blendKey}`, kind: "suspected", area: "treatment", severity: "info", title: `${c.name}: safe harbours not tested`, checked: "Safe-harbour navigator ran for jurisdictions with a top-up.", expected: "Tested", actual: `Not tested · top-up ${eur(c.jurisdictionalTopUp)}`, question: "Is CbCR data available to test the transitional safe harbour?", owner: "Tax manager", href: "/safe-harbour", iso: c.iso });
  }

  // 4. Election eligibility — anything switched on that the eligibility engine does not allow.
  const elig = eligibilityEngine(calcs);
  for (const [key, on] of Object.entries(i.inputs.electionsOn)) {
    if (!on) continue;
    const [id, iso] = splitSwitch(key);
    const row = elig.find((r) => r.election.id === id && r.iso === iso);
    if (!row) continue;
    if (row.status === "unavailable" || row.status === "n/a") out.push({ id: `elig-${key}`, kind: "validation", area: "elections", severity: "block", title: `${row.election.name} @ ${row.name} is on but ${row.status}`, checked: "Elections on the working package pass the eligibility engine.", expected: "available / locked", actual: `${row.status} — ${row.reason}`, question: "Turn the election off, or document why the eligibility conclusion is wrong.", owner: "Tax manager", href: "/elections", iso });
    if (row.status === "review") out.push({ id: `elig-rev-${key}`, kind: "suspected", area: "elections", severity: "warn", title: `${row.election.name} @ ${row.name} rests on a review-status condition`, checked: "Elections booked only when conditions are confirmed.", expected: "available", actual: `review — ${row.reason}`, question: "Which fact confirms the condition? Route it through X-Ray.", owner: "Tax manager", href: "/elections", iso });
  }

  // 5. Movement — unexplained changes vs prior lock and vs baseline.
  const prior = movementVsPrior(i.inputs, calcs);
  if (prior) {
    for (const r of prior.cmp.calcs) {
      const d = Math.abs(r.topUp - r.topUpPrior);
      const pctMove = r.topUpPrior ? d / Math.abs(r.topUpPrior) : d > 0 ? 1 : 0;
      const driver = prior.cmp.elections.some((e) => e.iso === r.iso && e.action !== "unchanged");
      if (d > 250_000 && pctMove > 0.2 && !driver) out.push({ id: `move-${r.blendKey ?? r.iso}`, kind: "suspected", area: "movement", severity: "warn", title: `${r.name}: top-up moved ${eur(r.topUpPrior)} → ${eur(r.topUp)} without a recorded driver`, checked: `Movement vs ${prior.prior.fy} lock has an explanation.`, expected: "Driver recorded (election, restructuring, data)", actual: `${pctMove >= 1 ? ">100" : Math.round(pctMove * 100)}% move · no note`, question: "Which of income, covered tax or SBIE moved, and is it supported by the close pack?", owner: "Reviewer", href: "/years", iso: r.iso });
    }
  }
  for (const m of movementVsBaseline(i.inputs, calcs)) {
    if (!m.drivers.length && Math.abs(m.delta) > 100_000) out.push({ id: `base-${m.blendKey}`, kind: "suspected", area: "movement", severity: "info", title: `${m.name}: differs from Core baseline without a working-package driver`, checked: "Every baseline-to-working movement traces to an election, claim or simulator assumption.", expected: "Driver identified", actual: `${eur(m.from)} → ${eur(m.to)}`, question: "Which setting produced the movement?", owner: "Reviewer", href: `/etr?iso=${m.iso}`, iso: m.iso });
  }

  // 6. Evidence completeness — X-Ray.
  for (const f of i.findings) {
    const st = findingStatus(f, i.xray[f.id]);
    if (st === "resolved" || f.severity !== "material") continue;
    out.push({ id: `xray-${f.id}`, kind: "validation", area: "evidence", severity: "block", title: `${f.title} (${f.entityCode}) — ${st}`, checked: "Material X-Ray findings confirmed, supported and reviewed.", expected: "Confirmed", actual: st, question: f.missing, owner: f.dept, href: `/xray/confirm?finding=${f.id}`, iso: f.iso, entityId: f.entityId });
  }

  return out.sort((a, b) => sev(a.severity) - sev(b.severity) || (a.kind === b.kind ? 0 : a.kind === "validation" ? -1 : 1));
}

function sev(s: Task["severity"]) { return s === "block" ? 0 : s === "warn" ? 1 : 2; }

export function reviewerReply(findings: ReviewFinding[], ctx: WorkContext, overrides: Record<string, { status?: string }>, focus?: string): Reply {
  const open = findings.filter((f) => !["resolved", "dismissed"].includes(overrides[`task:reviewer:${f.id}`]?.status ?? "open"));
  const validation = open.filter((f) => f.kind === "validation");
  const suspected = open.filter((f) => f.kind === "suspected");
  const sections: Section[] = [];
  const actions = [];
  const target = focus ? open.find((f) => f.id === focus || f.title.toLowerCase().includes(focus.toLowerCase())) : undefined;
  if (target) {
    sections.push({ kind: "conclusion", text: `${target.kind === "validation" ? "Validation failure" : "Suspected issue"} — ${target.title}.` });
    sections.push({ kind: "table", title: "Check", head: ["", ""], rows: [["Checked", target.checked], ["Expected", target.expected], ["Found", target.actual], ["Question", target.question], ["Owner", target.owner]] });
    sections.push({ kind: "next", items: [`Open ${target.href} and answer the question.`, "Resolve with a reason, or dismiss with a reason (kept on the record)."] });
    actions.push(propose("navigate", { href: target.href, label: "Open location" }, ctx));
    actions.push(propose("resolve-task", { id: `task:reviewer:${target.id}`, reason: "Reviewed and corrected" }, ctx));
    actions.push(propose("dismiss-task", { id: `task:reviewer:${target.id}`, reason: "" }, ctx));
  } else {
    sections.push({ kind: "conclusion", text: open.length ? `${validation.length} validation failure${validation.length === 1 ? "" : "s"} and ${suspected.length} suspected issue${suspected.length === 1 ? "" : "s"} on ${ctx.calcVersion}. Validation failures are deterministic; suspected issues are questions for a human.` : `No open findings on ${ctx.calcVersion}. ${findings.length} check results are resolved or dismissed with reasons.` });
    if (validation.length) sections.push({ kind: "table", title: "Validation failures", head: ["Finding", "Expected", "Found", "Owner"], rows: validation.slice(0, 8).map((f) => [f.title, f.expected, f.actual, f.owner]) });
    if (suspected.length) sections.push({ kind: "table", title: "Suspected issues — questions to ask", head: ["Finding", "Question", "Owner"], rows: suspected.slice(0, 8).map((f) => [f.title, f.question, f.owner]) });
    const areas = ["mapping", "reconciliation", "treatment", "elections", "movement", "evidence"] as const;
    sections.push({ kind: "facts", title: "Coverage", items: areas.map((a) => `${a}: ${open.filter((f) => f.area === a).length} open`) });
    sections.push({ kind: "next", items: ["Work validation failures first — they block the snapshot.", "Each suspected issue needs an answer, a resolution note, or a dismissal reason.", "Re-run after corrections; the finding list is derived, so fixed items disappear and dismissed ones stay visible."] });
    actions.push(propose("run-reviewer", {}, ctx));
    actions.push(propose("navigate", { href: "/reviewer", label: "Open Reviewer" }, ctx));
  }
  return {
    id: `r-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    feature: "reviewer",
    title: target ? `Reviewer · ${target.title}` : "AI Calculation Reviewer",
    sections,
    cites: [{ label: ctx.calcVersion, href: "/reviewer" }],
    actions,
    grounded: true,
    unsupported: [],
    version: ctx.calcVersion,
    lang: ctx.lang,
    chips: open.slice(0, 3).map((f) => `Explain finding: ${f.title.slice(0, 40)}`),
  };
}

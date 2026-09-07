import type { JurCalc } from "../engine";
import { eur, pct } from "../format";
import { hardStop, openExposure, type XrayFinding, type XrayState } from "../xray";
import { groupTotals, movementVsBaseline, movementVsPrior, type CalcInputs } from "./calc";
import { propose } from "./actions";
import type { ReviewFinding } from "./reviewer";
import type { Reply, SavedScenario, Section, Task, WorkContext } from "./types";

/**
 * AI CFO Briefing. Exposure, movement, decisions, uncertainty and next steps for a
 * chosen audience, every figure stamped with the calculation version and marked
 * provisional where X-Ray or data quality says so. Output is a draft document.
 */
export type Audience = "cfo" | "tax-committee" | "board";

export const AUDIENCE_LABEL: Record<Audience, string> = { cfo: "CFO", "tax-committee": "Tax committee", board: "Board" };

export type BriefingInput = {
  audience: Audience;
  calcs: JurCalc[];
  inputs: CalcInputs;
  findings: XrayFinding[];
  xray: XrayState;
  reviewer: ReviewFinding[];
  tasks: Task[];
  scenarios: SavedScenario[];
  ctx: WorkContext;
};

export function briefing(i: BriefingInput): { sections: Section[]; markdown: string; provisional: boolean } {
  const { calcs, ctx } = i;
  const t = groupTotals(calcs);
  const hs = hardStop(i.findings, i.xray, calcs);
  const exposureAtRisk = openExposure(i.findings, i.xray, calcs);
  const provisional = !ctx.outstanding.snapshotApproved || hs.blocked || calcs.some((c) => c.completeness < 90);
  const top = [...calcs].filter((c) => c.jurisdictionalTopUp > 0).sort((a, b) => b.jurisdictionalTopUp - a.jurisdictionalTopUp);
  const mvBase = movementVsBaseline(i.inputs, calcs);
  const mvPrior = movementVsPrior(i.inputs, calcs);
  const openTasks = i.tasks.filter((x) => x.status === "open" || x.status === "assigned");
  const decisions = [
    ...Object.keys(i.inputs.electionsOn).filter((k) => i.inputs.electionsOn[k]).map((k) => `Election on working package: ${k}`),
    ...i.scenarios.filter((s) => s.status === "proposed" || s.status === "draft").map((s) => `Scenario awaiting decision: ${s.title} (${eur(s.baseTopUp)} → ${eur(s.topUp)})`),
    ...i.reviewer.filter((r) => r.kind === "validation" && r.severity === "block").slice(0, 3).map((r) => `Blocking validation: ${r.title}`),
  ];
  const detail = i.audience === "board" ? 3 : i.audience === "cfo" ? 5 : 8;

  const sections: Section[] = [];
  sections.push({ kind: "conclusion", text: `${ctx.groupName} · ${ctx.fy} · ${ctx.calcVersion}${provisional ? " · PROVISIONAL" : " · approved snapshot"}. Group top-up ${eur(t.topUp)} across ${t.low} low-taxed jurisdiction${t.low === 1 ? "" : "s"}; collected as QDMTT ${eur(t.qdmtt)}, IIR ${eur(t.iir)}, UTPR ${eur(t.utpr)}.` });
  sections.push({ kind: "table", title: "Exposure by jurisdiction", head: ["Jurisdiction", "GloBE ETR", "Top-up", "Collected by", "Status"], rows: top.slice(0, detail).map((c) => [c.name, pct(c.etr, 2), eur(c.jurisdictionalTopUp), c.collection.payer, c.completeness < 90 ? `provisional (${c.completeness}% data)` : hs.reasons.some((r) => r.jurisdiction === c.name) ? "X-Ray open" : "supported"]) });
  const mv: string[] = [];
  if (mvPrior) {
    const moved = mvPrior.cmp.calcs.filter((r) => Math.abs(r.dTopUp) >= 1).sort((a, b) => Math.abs(b.dTopUp) - Math.abs(a.dTopUp)).slice(0, detail);
    const totalPrior = mvPrior.cmp.calcs.reduce((s, r) => s + r.topUpPrior, 0);
    mv.push(`Versus ${mvPrior.prior.fy} lock: group top-up ${eur(totalPrior)} → ${eur(t.topUp)}.`);
    for (const r of moved) mv.push(`${r.name}: ${eur(r.topUpPrior)} → ${eur(r.topUp)} (income ${r.dGlobe >= 0 ? "+" : "−"}${eur(Math.abs(r.dGlobe))}, covered tax ${r.dCovered >= 0 ? "+" : "−"}${eur(Math.abs(r.dCovered))}).`);
  } else mv.push(`No prior locked year on the ledger — first-year position; period movement not available.`);
  for (const m of mvBase.slice(0, 3)) mv.push(`${m.name} vs Core baseline: ${eur(m.from)} → ${eur(m.to)} — ${m.drivers.join("; ") || "engine restatement"}.`);
  sections.push({ kind: "impact", title: "Movement and drivers", items: mv });
  sections.push({ kind: "list", title: "Decisions required", items: decisions.length ? decisions.slice(0, detail) : ["None outstanding on the working package."] });
  const unc: string[] = [];
  if (hs.blocked) unc.push(`${hs.reasons.length} material X-Ray item${hs.reasons.length === 1 ? "" : "s"} unresolved; up to ${eur(exposureAtRisk)} of top-up depends on the answers.`);
  for (const c of calcs.filter((x) => x.completeness < 90)) unc.push(`${c.name}: ${c.completeness}% data completeness — estimates in use.`);
  for (const c of calcs.filter((x) => x.enteOriginated > 0)) unc.push(`${c.name}: Excess Negative Tax Expense ${eur(c.enteCarryforward)} carried forward — future covered taxes reduce.`);
  if (!ctx.outstanding.reviewerRan) unc.push("Calculation Reviewer has not run on this snapshot.");
  if (!ctx.outstanding.girValidated) unc.push("GIR preflight not run.");
  sections.push({ kind: "gaps", title: "Uncertainty", items: unc.length ? unc : ["No open uncertainty flags on this version."] });
  sections.push({ kind: "next", items: [
    openTasks.length ? `${openTasks.length} open task${openTasks.length === 1 ? "" : "s"} across ${new Set(openTasks.map((x) => x.owner)).size} owners; ${openTasks.filter((x) => x.severity === "block").length} blocking.` : "No open tasks.",
    ctx.outstanding.snapshotApproved ? "Snapshot approved — proceed to GIR export and filing calendar." : "Approve the snapshot once X-Ray hard-stops clear.",
    i.audience === "board" ? "Board asks: is the number final, who collects, what could move it — answered above." : "Detail available on request: jurisdiction traces, X-Ray items, scenario comparisons.",
  ] });

  const md: string[] = [`# Pillar Two briefing — ${AUDIENCE_LABEL[i.audience]}`, `${ctx.groupName} · ${ctx.fy} · ${ctx.calcVersion} · prepared ${new Date().toISOString().slice(0, 10)} by GMT24 Co-Pilot for ${ctx.user.name}`, provisional ? "\n**PROVISIONAL — figures depend on open X-Ray items or estimated data; not for external use.**\n" : "\nApproved snapshot.\n"];
  for (const s of sections) {
    md.push(`## ${s.title ?? (s.kind === "conclusion" ? "Headline" : s.kind)}`);
    if (s.text) md.push(s.text);
    if (s.rows) { md.push(`| ${s.head?.join(" | ")} |`); md.push(`| ${s.head?.map(() => "---").join(" | ")} |`); for (const r of s.rows) md.push(`| ${r.join(" | ")} |`); }
    for (const it of s.items ?? []) md.push(`- ${it}`);
    md.push("");
  }
  md.push("---", `Every figure is copied from calculation version ${ctx.calcVersion}. Items marked provisional or X-Ray open may change. This document is a draft for internal review.`);
  return { sections, markdown: md.join("\n"), provisional };
}

export function briefingReply(i: BriefingInput): Reply {
  const b = briefing(i);
  return {
    id: `r-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    feature: "briefing",
    title: `CFO Briefing · ${AUDIENCE_LABEL[i.audience]}`,
    sections: b.sections,
    cites: [{ label: i.ctx.calcVersion, href: "/overview" }, { label: "Pillar Two X-Ray", href: "/xray" }],
    actions: [
      propose("download", { name: `briefing-${i.audience}-${i.ctx.fy}.md`, body: b.markdown }, i.ctx, { label: `Download ${AUDIENCE_LABEL[i.audience]} briefing (draft)` }),
      propose("navigate", { href: `/briefing?audience=${i.audience}`, label: "Open briefing page" }, i.ctx),
    ],
    grounded: true,
    unsupported: [],
    version: i.ctx.calcVersion,
    lang: i.ctx.lang,
    chips: ["Board version", "Tax committee version", "What could move the number?"],
  };
}

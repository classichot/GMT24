import type { AuditNode, JurCalc } from "../engine";
import { eur, pct } from "../format";
import { RULES } from "../model";
import type { XrayFinding, XrayState } from "../xray";
import { findingStatus } from "../xray";
import { movementVsBaseline, movementVsPrior, provisionalFlags, rulesIn, sourcesIn, type CalcInputs } from "./calc";
import { propose } from "./actions";
import { byRule } from "./knowledge";
import type { Cite, Reply, Section, WorkContext } from "./types";

/**
 * Explain Any Number. The explanation is assembled from the engine's audit trace
 * for the amount — formula nodes, rule nodes, entity and account nodes, source
 * files — never reconstructed from the final figure. If the trace does not carry
 * a piece of information, the reply says so.
 */
function fmt(n: AuditNode) {
  if (n.amount == null) return "";
  const l = n.label.toLowerCase();
  if (Math.abs(n.amount) <= 1 && (l.includes("etr") || l.includes("rate") || l.includes("%"))) return pct(n.amount, 2);
  return eur(n.amount);
}

function collect(node: AuditNode) {
  const formulas: AuditNode[] = [];
  const inputs: AuditNode[] = [];
  const adjustments: AuditNode[] = [];
  const tests: AuditNode[] = [];
  const visit = (n: AuditNode, depth: number) => {
    if (depth > 0) {
      if (n.kind === "formula" || n.kind === "result") formulas.push(n);
      else if (n.kind === "account" || n.kind === "source" || n.kind === "entity") inputs.push(n);
      else if (n.kind === "rule") adjustments.push(n);
      else if (n.kind === "test") tests.push(n);
    }
    n.children?.forEach((c) => visit(c, depth + 1));
  };
  visit(node, 0);
  return { formulas, inputs, adjustments, tests };
}

export type ExplainInput = {
  node: AuditNode;
  calc?: JurCalc;
  calcs: JurCalc[];
  inputs: CalcInputs;
  findings: XrayFinding[];
  xray: XrayState;
  ctx: WorkContext;
};

export function explainNode(i: ExplainInput): Reply {
  const { node, ctx } = i;
  const parts = collect(node);
  const rules = rulesIn(node);
  const sources = sourcesIn(node);
  const sections: Section[] = [];
  const cites: Cite[] = [];
  const unsupported: string[] = [];

  sections.push({ kind: "conclusion", text: `${node.label}${node.amount != null ? ` = ${fmt(node)}` : ""}. ${node.detail}` });

  const formulaRows = parts.formulas.slice(0, 12).map((n) => [n.label, fmt(n), n.detail.slice(0, 140)]);
  if (formulaRows.length) sections.push({ kind: "table", title: "Calculation breakdown (from the trace)", head: ["Step", "Amount", "Detail"], rows: formulaRows });
  else sections.push({ kind: "text", title: "Calculation breakdown", text: "This node has no formula children — it is a leaf posting. The amount comes directly from the mapped source below." });

  if (parts.adjustments.length) {
    sections.push({ kind: "list", title: "Adjustments and rules applied", items: parts.adjustments.slice(0, 10).map((n) => `${n.label}${n.amount != null ? ` · ${fmt(n)}` : ""} — ${n.detail.slice(0, 160)}`) });
  }

  if (rules.length) {
    sections.push({ kind: "authority", items: rules.map((r) => {
      const def = RULES.find((x) => x.id === r.id);
      return `${r.id} ${r.version || def?.version || ""} — ${def?.source ?? "rule pack"}${def ? ` · ${def.formula}` : ""}`;
    }) });
    for (const r of rules) {
      cites.push({ label: `${r.id} ${r.version}`, href: "/rulebook" });
      for (const kb of byRule(r.id).slice(0, 1)) cites.push({ label: kb.provision, href: kb.url ?? kb.href, authority: kb.authority });
    }
  } else {
    unsupported.push("No rule id on this node — the trace records the amount but not the provision. Check the parent node.");
  }

  if (parts.inputs.length || sources.length) {
    sections.push({ kind: "facts", title: "Source traceability", items: [
      ...parts.inputs.slice(0, 8).map((n) => `${n.label}${n.amount != null ? ` · ${fmt(n)}` : ""} — ${n.detail.slice(0, 120)}`),
      ...sources.map((f) => `Source file: ${f}`),
    ] });
    for (const f of sources) cites.push({ label: f, href: "/data" });
  } else {
    unsupported.push("The trace for this node lists no source file. Input lineage stops at the engine posting.");
  }

  if (parts.tests.length) sections.push({ kind: "list", title: "Tests", items: parts.tests.map((n) => `${n.label} — ${n.detail.slice(0, 140)}`) });

  const c = i.calc;
  if (c) {
    const open = i.findings.filter((f) => f.iso === c.iso && findingStatus(f, i.xray[f.id]) !== "resolved");
    const flags = provisionalFlags(c, open.map((f) => f.title));
    if (flags.length) sections.push({ kind: "gaps", title: "Uncertainty", items: flags });
    const mv = movementVsBaseline(i.inputs, i.calcs).find((m) => m.blendKey === c.blendKey);
    const prior = movementVsPrior(i.inputs, i.calcs);
    const priorRow = prior?.cmp.calcs.find((r) => (r.blendKey ?? r.iso) === c.blendKey);
    const items: string[] = [];
    if (mv) items.push(`Versus Core baseline: top-up ${eur(mv.from)} → ${eur(mv.to)} (${mv.delta >= 0 ? "+" : "−"}${eur(Math.abs(mv.delta))}); ETR ${pct(mv.etrFrom, 2)} → ${pct(mv.etrTo, 2)}. Drivers: ${mv.drivers.join("; ") || "engine restatement"}.`);
    else items.push("Versus Core baseline: no movement — no election or simulator assumption touches this blend.");
    if (priorRow) items.push(`Versus ${prior!.prior.fy} lock: top-up ${eur(priorRow.topUpPrior)} → ${eur(priorRow.topUp)}; GloBE ${eur(priorRow.globePrior)} → ${eur(priorRow.globe)}; covered ${eur(priorRow.coveredPrior)} → ${eur(priorRow.covered)}.`);
    else if (!prior) items.push(`No prior locked year on the ledger for ${ctx.groupName} — period comparison unavailable until ${ctx.fy} is locked and the next year opened.`);
    sections.push({ kind: "impact", title: "Change explanation", items });
    sections.push({ kind: "next", items: [
      `Drill down: jurisdiction → ${c.entities.length} entit${c.entities.length === 1 ? "y" : "ies"} (${c.entities.slice(0, 4).map((e) => e.code).join(", ")}${c.entities.length > 4 ? "…" : ""}) → accounts → source files.`,
      open.length ? `Resolve ${open.length} open X-Ray item${open.length === 1 ? "" : "s"} before treating this figure as final.` : "No open X-Ray items on this blend.",
    ] });
  }

  const note = calcNote(i, rules, sources);
  const actions = [
    propose("download", { name: `calc-note-${(c?.iso ?? "group").toLowerCase()}-${ctx.fy}.md`, body: note }, ctx, { label: "Download calculation note" }),
  ];
  if (c) actions.push(propose("navigate", { href: c.blendKind === "main" ? `/etr?iso=${c.iso}` : `/etr?iso=${c.iso}&blend=${encodeURIComponent(c.blendKey)}`, label: `${c.name} ETR` }, ctx));

  return {
    id: `r-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    feature: "explain",
    title: `Explain · ${node.label}`,
    sections,
    cites: dedupe(cites),
    actions,
    grounded: rules.length > 0 || sources.length > 0,
    unsupported,
    version: ctx.calcVersion,
    lang: ctx.lang,
    chips: c ? [`Why did ${c.name} top-up move?`, `Which entities drive ${c.name}?`, `What is still provisional in ${c.name}?`] : undefined,
  };
}

function dedupe(c: Cite[]) {
  const seen = new Set<string>();
  return c.filter((x) => (seen.has(x.label) ? false : (seen.add(x.label), true)));
}

export function calcNote(i: ExplainInput, rules: { id: string; version: string }[], sources: string[]) {
  const lines: string[] = [];
  const n = i.node;
  lines.push(`# Calculation note — ${n.label}`);
  lines.push(`Group: ${i.ctx.groupName} · ${i.ctx.fy} · ${i.ctx.calcVersion}`);
  lines.push(`Prepared by GMT24 Co-Pilot (Explain Any Number) for ${i.ctx.user.name} · ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`Amount: ${fmt(n) || "—"}`);
  lines.push(`Detail: ${n.detail}`);
  lines.push("");
  lines.push("## Trace");
  const visit = (x: AuditNode, d: number) => {
    lines.push(`${"  ".repeat(d)}- ${x.label}${x.amount != null ? ` · ${fmt(x)}` : ""}${x.ruleId ? ` [${x.ruleId} ${x.ruleVersion ?? ""}]` : ""}${x.sourceFile ? ` (${x.sourceFile})` : ""}`);
    x.children?.forEach((c) => visit(c, d + 1));
  };
  visit(n, 0);
  lines.push("");
  lines.push("## Rules");
  rules.forEach((r) => lines.push(`- ${r.id} ${r.version}`));
  lines.push("");
  lines.push("## Sources");
  sources.forEach((s) => lines.push(`- ${s}`));
  lines.push("");
  lines.push("Every figure above is copied from the engine trace of the stated calculation version. This note is a reviewable draft, not an approval.");
  return lines.join("\n");
}

/** Find the trace node that best matches a phrase ("Thailand ETR", "SBIE Ireland", "group top-up"). */
export function locateNode(q: string, calcs: JurCalc[], groupAudit: AuditNode): { node: AuditNode; calc?: JurCalc } | null {
  const l = q.toLowerCase();
  const calc = calcs.find((c) => l.includes(c.name.toLowerCase()) || new RegExp(`\\b${c.iso.toLowerCase()}\\b`).test(l));
  if (!calc) {
    if (/group|total|headline/.test(l)) return { node: groupAudit };
    return null;
  }
  const t = calc.trace;
  if (/sbie|substance|carve/.test(l)) return { node: t.sbie, calc };
  if (/payroll/.test(l)) return { node: t.payroll, calc };
  if (/asset|tangible/.test(l)) return { node: t.assets, calc };
  if (/covered|tax(es)? (paid|expense)|deferred/.test(l)) return { node: t.covered, calc };
  if (/globe income|fanil|income/.test(l)) return { node: t.globe, calc };
  if (/excess/.test(l)) return { node: t.excess, calc };
  if (/etr|effective/.test(l)) return { node: t.etr, calc };
  return { node: calc.audit, calc };
}

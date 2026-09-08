import type { JurCalc } from "../engine";
import { isosIn } from "./i18n";
import { optimizeGlobe } from "../electionEngine";
import { eur, pct } from "../format";
import { answerCopilot } from "../copilot";
import type { XrayFinding, XrayState } from "../xray";
import { findingStatus } from "../xray";
import { propose } from "./actions";
import { factsFor } from "./facts";
import { AUTHORITY_LABEL, cite, retrieve, type Retrieved } from "./knowledge";
import type { Cite, Fact, Reply, Section, WorkContext } from "./types";

/**
 * AI Pillar Two Specialist. Legal answer from the approved knowledge base,
 * applied to the group's engine figures and confirmed facts. Material advice
 * always follows Conclusion → authority → company facts → assumptions or gaps →
 * potential impact → next action. When facts are missing the conclusion is
 * withheld and the missing facts are listed instead.
 */
export type SpecialistInput = {
  q: string;
  ctx: WorkContext;
  calcs: JurCalc[];
  findings: XrayFinding[];
  xray: XrayState;
  facts: Fact[];
};

const TOPIC_TO_ENGINE: { re: RegExp; engine: string; area: string }[] = [
  { re: /dividend|3\.2\.1/, engine: "dividend", area: "GloBE income" },
  { re: /payroll|employee|contractor|secondment/, engine: "payroll", area: "Payroll SBIE" },
  { re: /asset|tangible|lease|situs/, engine: "asset", area: "Tangible asset SBIE" },
  { re: /boi|incentive|holiday|qrtc|mttc/, engine: "boi", area: "Incentives" },
  { re: /deferred|recapture|dtl|dta|recast/, engine: "deferred", area: "Deferred tax" },
  { re: /covered tax|withholding|cfc|4\.3/, engine: "covered", area: "Covered taxes" },
  { re: /entity|pe\b|permanent establishment|moce|pope|joint venture|transparen/, engine: "entity", area: "Entity & ownership" },
  { re: /election|3\.2\.2|4\.5|safe harbour|harbour/, engine: "election", area: "Elections" },
];

function targetCalc(q: string, ctx: WorkContext, calcs: JurCalc[]) {
  const l = q.toLowerCase();
  const isos = isosIn(q);
  const byName = calcs.find((c) => l.includes(c.name.toLowerCase())) ?? (isos.length ? calcs.find((c) => c.iso === isos[0] && c.blendKind === "main") ?? calcs.find((c) => c.iso === isos[0]) : undefined);
  if (byName) return byName;
  if (ctx.iso) return calcs.find((c) => c.iso === ctx.iso && c.blendKind === "main") ?? calcs.find((c) => c.iso === ctx.iso);
  return undefined;
}

function authoritySection(hits: Retrieved[], lang: WorkContext["lang"]): { section: Section; cites: Cite[]; stale: string[] } {
  const items: string[] = [];
  const cites: Cite[] = [];
  const stale: string[] = [];
  for (const h of hits) {
    const e = h.entry;
    const tag = AUTHORITY_LABEL[e.authority];
    if (!h.current) {
      stale.push(`${e.provision} (${e.status}, ${e.version}) is ${e.status === "pending-review" || e.status === "draft" ? "not approved production guidance" : "outside the applicable period"} — cited for awareness only.`);
      continue;
    }
    items.push(`[${tag}] ${e.provision}: ${e.passage}`);
    cites.push(cite(e));
  }
  void lang;
  return { section: { kind: "authority", items }, cites, stale };
}

export function specialistReply(i: SpecialistInput): Reply {
  const { q, ctx, calcs } = i;
  const hits = retrieve(q, ctx, 4);
  const calc = targetCalc(q, ctx, calcs);
  const topic = TOPIC_TO_ENGINE.find((t) => t.re.test(q.toLowerCase()));
  const sections: Section[] = [];
  const unsupported: string[] = [];
  const legacy = answerCopilot(q, calcs);
  const legacyHit = !/I can only answer from the GMT24 calculation snapshot/.test(legacy.text);

  // Company facts: engine figures for the jurisdiction + confirmed / open facts on the topic.
  const factItems: string[] = [];
  const openFacts: Fact[] = [];
  if (calc) {
    factItems.push(`${calc.name} (${calc.blendKind} blend): GloBE income ${eur(calc.globeIncome)} · Adjusted Covered Taxes ${eur(calc.coveredTax)} · ETR ${pct(calc.etr, 2)} · SBIE ${eur(calc.sbie)} · top-up ${eur(calc.jurisdictionalTopUp)} · collected by ${calc.collection.payer}.`);
    if (calc.sh.navigator) factItems.push(`Safe harbour: ${calc.sh.navigator}`);
    const scoped = factsFor(i.facts, { iso: calc.iso, topic: topic?.area ?? null });
    for (const f of scoped) {
      if (f.status === "confirmed") factItems.push(`Confirmed by ${f.confirmedBy}: ${f.statement} → ${f.value} (${f.entityCode}).`);
      else openFacts.push(f);
    }
  }
  const openFindings = i.findings.filter((f) => (!calc || f.iso === calc.iso) && (!topic || f.engine === topic.engine) && findingStatus(f, i.xray[f.id]) !== "resolved");

  const material = /should|can (we|thailand|the group)|elig|qualif|treat|exclude|apply|memo|position|advice|liab|ควร|ได้หรือไม่/.test(q.toLowerCase());
  const insufficient = material && (openFindings.length > 0 || openFacts.some((f) => f.status === "open"));

  if (insufficient) {
    sections.push({ kind: "conclusion", text: `No definitive treatment yet. ${openFindings.length + openFacts.filter((f) => f.status === "open").length} fact${openFindings.length + openFacts.length === 1 ? "" : "s"} needed to conclude on ${topic?.area ?? "this question"}${calc ? ` for ${calc.name}` : ""} are unconfirmed. The provisional engine position is shown below and must be labelled preliminary.` });
  } else if (legacyHit) {
    sections.push({ kind: "conclusion", text: legacy.text.split("\n\n")[0] });
  } else if (hits.length && hits[0].current) {
    sections.push({ kind: "conclusion", text: `${hits[0].entry.title}. ${hits[0].entry.passage}` });
  } else {
    sections.push({ kind: "conclusion", text: "The approved knowledge base has no passage on this point. I will not present a treatment from general memory." });
    unsupported.push("Question not covered by the approved knowledge base.");
  }

  const auth = authoritySection(hits, ctx.lang);
  if (auth.section.items?.length) sections.push(auth.section);
  else if (!legacyHit) unsupported.push("No current authority retrieved for this question.");

  if (legacyHit) {
    const body = legacy.text.split("\n\n").slice(1).join("\n\n");
    if (body) sections.push({ kind: "facts", items: [...factItems, body] });
    else if (factItems.length) sections.push({ kind: "facts", items: factItems });
  } else if (factItems.length) sections.push({ kind: "facts", items: factItems });

  const gaps: string[] = [...auth.stale];
  for (const f of openFindings.slice(0, 5)) gaps.push(`${f.title} (${f.entityCode}) — ${f.missing} Ask ${f.dept}.`);
  for (const f of openFacts.slice(0, 3)) if (!openFindings.some((x) => x.id === f.findingId)) gaps.push(`${f.statement} — ${f.status === "proposed" ? `answered "${f.value}" but not signed` : f.status}.`);
  if (calc && calc.completeness < 90) gaps.push(`Data completeness ${calc.completeness}% — estimates in the ${calc.name} figures.`);
  if (gaps.length) sections.push({ kind: "gaps", items: gaps });

  // Impact and options.
  const impact: string[] = [];
  if (calc) {
    const risk = openFindings.reduce((a, f) => a + Math.abs(f.amount), 0);
    if (risk) impact.push(`${eur(risk)} of balances under question in ${calc.name}; current top-up ${eur(calc.jurisdictionalTopUp)}.`);
    if (/strateg|option|elect|should|optimi/.test(q.toLowerCase())) {
      const O = optimizeGlobe(calcs);
      const rel = O.recs.filter((r) => r.scenario.elections.some((e) => e.endsWith(`@${calc.iso}`)) || r.id === "05").slice(0, 3);
      for (const r of rel) impact.push(`Option: ${r.scenario.title} → FY top-up ${eur(r.scenario.fyTopUp)} (${r.scenario.bookable ? "bookable" : "not bookable"}; lock ${r.scenario.lockYears}y; audit ${r.scenario.audit}). ${r.scenario.why}`);
    }
  }
  if (impact.length) sections.push({ kind: "impact", items: impact });

  const next: string[] = [];
  if (openFindings.length) next.push(`Open the X-Ray confirmation for ${openFindings[0].title} and route to ${openFindings[0].dept}.`);
  if (material) next.push("Draft a position memo for reviewer sign-off (download below).");
  if (!next.length) next.push(legacy.cites?.[0]?.href ? `Open ${legacy.cites[0].label}.` : "Open the rulebook entry.");
  sections.push({ kind: "next", items: next });

  const cites: Cite[] = [...auth.cites, ...(legacy.cites ?? []).map((c) => ({ label: c.label, href: c.href }))];
  const actions = [];
  if (openFindings.length) actions.push(propose("navigate", { href: `/xray/confirm?finding=${openFindings[0].id}`, label: "Open confirmation" }, ctx));
  if (material) actions.push(propose("download", { name: `memo-${(calc?.iso ?? "group").toLowerCase()}-${Date.now().toString(36)}.md`, body: memo(i, sections, cites) }, ctx, { label: "Download position memo (draft)" }));
  if (calc) actions.push(propose("open-audit", { iso: calc.iso }, ctx));

  return {
    id: `r-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    feature: "specialist",
    title: calc ? `Pillar Two Specialist · ${calc.name}` : "Pillar Two Specialist",
    sections,
    cites: cites.filter((c, idx, arr) => arr.findIndex((x) => x.label === c.label) === idx),
    actions,
    grounded: cites.length > 0 && unsupported.length === 0,
    unsupported,
    version: ctx.calcVersion,
    lang: ctx.lang,
    chips: calc ? [`What facts are missing for ${calc.name}?`, `Options to reduce ${calc.name} top-up`, `Draft a memo on ${calc.name} treatment`] : ["Is Thailand eligible for SBTISH?", "Explain Art. 5.2.1 ENTE", "Who pays the Thai QDMTT?"],
  };
}

function memo(i: SpecialistInput, sections: Section[], cites: Cite[]) {
  const lines = [`# Position memo (draft) — ${i.q}`, `Group ${i.ctx.groupName} · ${i.ctx.fy} · ${i.ctx.calcVersion}`, `Prepared for ${i.ctx.user.name} (${i.ctx.role}) by GMT24 Co-Pilot · ${new Date().toISOString()}`, "", "Status: DRAFT — requires reviewer sign-off. Not a filing position.", ""];
  for (const s of sections) {
    lines.push(`## ${s.title ?? s.kind}`);
    if (s.text) lines.push(s.text);
    for (const it of s.items ?? []) lines.push(`- ${it}`);
    lines.push("");
  }
  lines.push("## Sources");
  for (const c of cites) lines.push(`- ${c.label}${c.href ? ` (${c.href})` : ""}${c.authority ? ` [${AUTHORITY_LABEL[c.authority]}]` : ""}`);
  lines.push("", "## Unresolved issues", "See 'Assumptions or gaps' above. Each open fact is tracked on the X-Ray confirmation workflow and the task list.");
  return lines.join("\n");
}

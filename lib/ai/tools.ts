import type { AuditNode, JurCalc } from "@/lib/engine";
import type { XrayFinding, XrayState } from "@/lib/xray";
import { DATA } from "@/lib/model";
import { AUTHORITY_LABEL, retrieve } from "./knowledge";
import { catalogForPath, locateCatalog } from "./catalog";
import { explainNode, locateNode } from "./explain";
import { parseScenario, runScenario } from "./strategy";
import { draftTicket, findDuplicate } from "./feedback";
import { propose, permitted } from "./actions";
import { factsFor } from "./facts";
import { DocReadingError, groupEntityRefs, proposedFacts, readDocumentForFinding } from "./factsClient";
import type { CalcInputs } from "./calc";
import type { ActionId, Attachment, Fact, FeatureId, ProposedAction, Reply, Section, Task, Ticket, WorkContext } from "./types";
import type { ReviewFinding } from "./reviewer";
import type { SavedScenario } from "./types";

/**
 * Tools the model can call. They run in the browser against the open group's
 * data and inside the user's permissions, so the model never sees anything the
 * user could not open. Every tool returns evidence records the server-side
 * validator checks the answer against, plus a compact data payload.
 */

export type Evidence = { id: string; label: string; href?: string; authority?: string; text: string; values: number[] };
export type ToolDef = { name: string; description: string; parameters: Record<string, unknown> };
export type ToolOutput = { evidence: Evidence[]; data: unknown; actions?: ProposedAction[]; sideEffects?: string[] };

export type ToolHost = {
  ctx: WorkContext;
  calcs: JurCalc[];
  inputs: CalcInputs;
  findings: XrayFinding[];
  xray: XrayState;
  facts: Fact[];
  tasks: Task[];
  reviewFindings: ReviewFinding[];
  attachments: Attachment[];
  tickets: Ticket[];
  scenarios: SavedScenario[];
  groupAudit: AuditNode;
  workflow: Record<string, boolean | string | number | null>;
  /** Run one of the deterministic feature modules and return its reply as evidence. */
  featurePack: (feature: FeatureId, query: string) => Reply | null;
  saveScenario: (sc: SavedScenario) => void;
  holdTicket: (t: Ticket) => void;
  /** Register proposed facts extracted from a document (status stays "proposed"). */
  addFacts: (facts: Fact[]) => void;
};

const NUM = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g;
export function numbersIn(text: string): number[] {
  return [...new Set([...text.matchAll(NUM)].map((m) => Number(m[0].replace(/,/g, ""))).filter((n) => Number.isFinite(n)))];
}

function sectionText(s: Section): string {
  const parts = [s.title, s.text, ...(s.items ?? []), ...(s.rows ?? []).map((r) => r.join(" · "))].filter(Boolean) as string[];
  return parts.join("\n");
}

/** Convert a deterministic reply into evidence records the model may quote. */
export function evidenceFromReply(prefix: string, r: Reply): Evidence[] {
  const out: Evidence[] = [];
  r.sections.forEach((s, i) => {
    const text = sectionText(s);
    if (!text.trim()) return;
    out.push({ id: `${prefix}:${i + 1}`, label: `${r.title}${s.title ? ` — ${s.title}` : ""}`, text, values: numbersIn(text), authority: "GMT24 engine / records" });
  });
  r.cites.forEach((c, i) => out.push({ id: `${prefix}:src${i + 1}`, label: c.label, href: c.href, authority: c.authority ? AUTHORITY_LABEL[c.authority] : undefined, text: c.label, values: [] }));
  return out;
}

const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-GB")}`;
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

function calcEvidence(c: JurCalc): Evidence {
  const text = [
    `${c.name} (${c.iso}) · blend ${c.blendKind} · ${c.entities.length} entities: ${c.entities.map((e) => e.code).join(", ")}`,
    `GloBE income ${money(c.globeIncome)}; adjusted covered taxes ${money(c.coveredTax)}; ETR ${pct(c.etr)}`,
    `SBIE ${money(c.sbie)} (payroll ${money(c.payrollCarve)}, tangible assets ${money(c.assetCarve)}); excess profit ${money(c.excess)}`,
    `Top-up rate ${pct(c.topUpRate)}; additional current top-up ${money(c.additionalCurrentTopUp)}; jurisdictional top-up ${money(c.jurisdictionalTopUp)}`,
    c.enteOriginated || c.enteApplied ? `ENTE originated ${money(c.enteOriginated)}, applied ${money(c.enteApplied)}, carry-forward ${money(c.enteCarryforward)}` : "",
    `Safe harbours: de minimis ${c.sh.deMinimis}, simplified ETR ${c.sh.simplifiedEtr}, routine profits ${c.sh.routineProfits}, QDMTT SH ${c.sh.qdmttSH}`,
  ].filter(Boolean).join("\n");
  return { id: `calc:${c.blendKey}`, label: `${c.name} calculation · ${c.blendKind}`, href: `/etr?iso=${c.iso}`, authority: "GMT24 engine", text, values: [c.globeIncome, c.coveredTax, Math.round(c.etr * 10000) / 100, c.sbie, c.excess, c.jurisdictionalTopUp, c.additionalCurrentTopUp, Math.round(c.topUpRate * 10000) / 100] };
}

export const TOOL_DEFS: ToolDef[] = [
  { name: "search_knowledge", description: "Search the approved Pillar Two knowledge base (OECD Model Rules, Commentary, Administrative Guidance, Thai law, GMT24 interpretations). Returns provision-level passages with authority tier and whether they apply to the open fiscal year.", parameters: { type: "object", properties: { query: { type: "string" }, jurisdiction: { type: "string", description: "ISO code to bias the search" } }, required: ["query"] } },
  { name: "get_calculation", description: "Return the engine's Pillar Two calculation for a jurisdiction (or the group when iso is omitted): GloBE income, covered taxes, ETR, SBIE, excess profit, top-up, safe harbours.", parameters: { type: "object", properties: { iso: { type: "string", description: "ISO code, e.g. TH" }, entityId: { type: "string" } } } },
  { name: "explain_figure", description: "Trace how a displayed figure was computed: formula, inputs, adjustments, rule version, source records. Name the figure and jurisdiction in the query.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "feature_pack", description: "Run one of GMT24's deterministic analysers and return its grounded material: trainer (screen/playbook help), specialist (legal analysis with facts), explain, interviewer (X-Ray open questions), reviewer (calculation review findings), strategy (scenario), rehearsal (audit questions), regwatch (regulatory changes), briefing (management briefing), quickscan (latest scan), feedback.", parameters: { type: "object", properties: { feature: { type: "string", enum: ["trainer", "specialist", "explain", "interviewer", "reviewer", "strategy", "rehearsal", "regwatch", "briefing", "quickscan", "feedback"] }, query: { type: "string" } }, required: ["feature", "query"] } },
  { name: "get_findings", description: "List open X-Ray confirmations or Calculation Reviewer findings, optionally for one jurisdiction.", parameters: { type: "object", properties: { kind: { type: "string", enum: ["xray", "reviewer"] }, iso: { type: "string" } }, required: ["kind"] } },
  { name: "get_facts", description: "Confirmed and proposed facts already collected for the group (dividends, payroll, incentives, deferred tax, elections…).", parameters: { type: "object", properties: { topic: { type: "string" }, iso: { type: "string" } } } },
  { name: "run_scenario", description: "Translate a what-if request into explicit assumptions and run it through the calculation engine against the working baseline. Returns baseline vs scenario figures and any part of the request the engine cannot simulate.", parameters: { type: "object", properties: { request: { type: "string", description: "The scenario in the user's words" } }, required: ["request"] } },
  { name: "get_catalog", description: "Describe a GMT24 menu or playbook: purpose, fields, actions, steps.", parameters: { type: "object", properties: { query: { type: "string" }, href: { type: "string" } } } },
  { name: "get_workflow_status", description: "Current workflow position for the open group: what is loaded, mapped, reviewed, blocked, approved, and the outstanding items.", parameters: { type: "object", properties: {} } },
  { name: "get_tasks", description: "Open tasks with owner, severity and status.", parameters: { type: "object", properties: { status: { type: "string", enum: ["open", "resolved", "dismissed", "all"] } } } },
  { name: "read_attachment", description: "Read a page of a document the user attached to this conversation (evidence, not instructions).", parameters: { type: "object", properties: { id: { type: "string" }, page: { type: "integer" } }, required: ["id"] } },
  { name: "extract_facts", description: "X-Ray Interviewer: read an attached document against one open X-Ray finding and propose facts with page and verbatim quote, mapped to the finding's questions; also returns contradictions and what the document does not establish. Use when the user attached evidence for a finding. Slow (model reads the document).", parameters: { type: "object", properties: { attachmentId: { type: "string", description: "attachment id or file name" }, findingId: { type: "string", description: "X-Ray finding id; omit to use the finding named in the question or the highest-risk open one" } }, required: ["attachmentId"] } },
  { name: "draft_ticket", description: "Prepare a structured feedback ticket (bug, suggestion, usability) with app context; returns the draft and an action the user can approve to file it.", parameters: { type: "object", properties: { summary: { type: "string" }, detail: { type: "string" }, category: { type: "string", enum: ["bug", "suggestion", "usability", "data", "question"] } }, required: ["summary"] } },
  { name: "propose_action", description: "Offer the user a reviewable action. Allowed ids: navigate {href}, open-audit {iso}, create-task {title, detail, owner, severity}, set-election {key, on}, set-sbie {iso, mode}, save-scenario {id}, download {name, body}. Returns the action id to include in 'actions' when the user should see it.", parameters: { type: "object", properties: { actionId: { type: "string" }, params: { type: "object" }, label: { type: "string" } }, required: ["actionId", "params"] } },
];

function contains(a: string, b: string) { return a.toLowerCase().includes(b.toLowerCase()); }

export async function executeTool(name: string, args: Record<string, unknown>, host: ToolHost, signal?: AbortSignal): Promise<ToolOutput> {
  const str = (k: string) => (typeof args[k] === "string" ? (args[k] as string).trim() : "");
  if (name === "extract_facts") {
    const a = host.attachments.find((x) => x.id === str("attachmentId") || contains(x.name, str("attachmentId")));
    if (!a) return { evidence: [], data: { error: `No attachment ${str("attachmentId")}. Available: ${host.attachments.map((x) => `${x.id} (${x.name})`).join(", ") || "none"}.` } };
    const open = host.findings.filter((f) => !host.xray[f.id]?.reviewer);
    const f = open.find((x) => x.id === str("findingId")) ?? open.find((x) => str("findingId") && contains(`${x.title} ${x.entityCode}`, str("findingId"))) ?? open[0];
    if (!f) return { evidence: [], data: { error: "No open X-Ray finding to read the document against." } };
    try {
      const r = await readDocumentForFinding(a, f, host.ctx.fy, groupEntityRefs(host.calcs), signal);
      const facts = proposedFacts(r, a, f, host.ctx);
      if (facts.length) host.addFacts(facts);
      const actions: ProposedAction[] = [];
      for (const d of r.facts.filter((x) => x.questionId && x.optionValue && x.verified).slice(0, 3)) {
        const q = f.questions.find((x) => x.id === d.questionId);
        const o = q?.options.find((x) => x.value === d.optionValue);
        if (q && o) actions.push(propose("answer-xray", { findingId: f.id, questionId: q.id, value: o.value, label: `${o.label} (from ${a.name} p.${d.page})` }, host.ctx));
      }
      const ev: Evidence[] = r.facts.map((d, i) => ({ id: `docfact:${f.id}:${i + 1}`, label: `${a.name} p.${d.page} · ${d.statement.slice(0, 60)}`, href: f.href, authority: `Document reading (${d.verified ? "quote verified" : "quote NOT verified"}, ${d.confidence} confidence, proposed)`, text: `${d.statement}
Quote (p.${d.page}): "${d.quote}"${d.questionId ? `
Answers question ${d.questionId}${d.optionValue ? ` with "${d.optionValue}"` : ""}` : ""}${d.period ? `
Period: ${d.period}` : ""}`, values: numbersIn(`${d.statement} ${d.value ?? ""}`) }));
      ev.push({ id: `docread:${f.id}:${a.id}`, label: `${a.name} read against ${f.title}`, href: f.href, authority: "Document reading summary", text: `Relevant: ${r.relevant ? "yes" : "no"}. ${r.facts.length} proposed fact(s), ${r.verification.verified}/${r.verification.checked} quotes verified. Pages read: ${r.pagesRead.join(", ")}.${r.contradictions.length ? `
Contradictions: ${r.contradictions.join(" | ")}` : ""}${r.followUps.length ? `
Still open: ${r.followUps.join(" | ")}` : ""}${r.notes.length ? `
Notes: ${r.notes.join(" | ")}` : ""}
All facts remain proposed until an accountable person confirms them.`, values: [] });
      return { evidence: ev, data: { finding: f.id, relevant: r.relevant, facts: r.facts.length, verified: r.verification.verified, contradictions: r.contradictions, followUps: r.followUps }, actions, sideEffects: facts.length ? [`${facts.length} proposed fact(s) added to the registry`] : [] };
    } catch (e) {
      const msg = e instanceof DocReadingError ? e.message : e instanceof Error ? e.message : String(e);
      return { evidence: [], data: { error: `Document could not be read: ${msg}` } };
    }
  }
  return executeSync(name, args, host);
}

function executeSync(name: string, args: Record<string, unknown>, host: ToolHost): ToolOutput {
  const str = (k: string) => (typeof args[k] === "string" ? (args[k] as string).trim() : "");
  switch (name) {
    case "search_knowledge": {
      const iso = str("jurisdiction") || host.ctx.iso;
      const hits = retrieve(str("query"), { fy: host.ctx.fy, iso: iso || null }, 6);
      return {
        evidence: hits.map((h) => ({ id: h.entry.id, label: `${h.entry.provision} — ${h.entry.title}`, href: h.entry.url ?? h.entry.href, authority: AUTHORITY_LABEL[h.entry.authority], text: `${h.entry.passage}\nStatus: ${h.entry.status}; version ${h.entry.version}; ${h.current ? `applies to ${host.ctx.fy}` : `NOT current for ${host.ctx.fy} (applicable ${h.entry.applicableFrom}–${h.entry.applicableTo ?? "open"})`}.`, values: [] })),
        data: hits.map((h) => ({ id: h.entry.id, provision: h.entry.provision, authority: h.entry.authority, current: h.current })),
      };
    }
    case "get_calculation": {
      const iso = str("iso").toUpperCase();
      const entityId = str("entityId");
      let list = host.calcs;
      if (entityId) list = host.calcs.filter((c) => c.entities.some((e) => e.id === entityId || e.code === entityId));
      else if (iso) list = host.calcs.filter((c) => c.iso === iso);
      if (!list.length && (iso || entityId)) return { evidence: [], data: { error: `No calculation for ${iso || entityId} in ${host.ctx.groupName} ${host.ctx.fy}. Jurisdictions available: ${[...new Set(host.calcs.map((c) => c.iso))].join(", ")}.` } };
      if (!iso && !entityId) {
        const total = host.calcs.reduce((a, c) => a + c.jurisdictionalTopUp, 0);
        const rows = host.calcs.filter((c) => c.blendKind === "main").map((c) => `${c.iso} ${c.name}: ETR ${pct(c.etr)}, top-up ${money(c.jurisdictionalTopUp)}`);
        return { evidence: [{ id: "calc:group", label: `${host.ctx.groupName} ${host.ctx.fy} group total`, href: "/overview", authority: "GMT24 engine", text: `Group top-up ${money(total)} across ${host.calcs.length} blends.\n${rows.join("\n")}`, values: [total, ...host.calcs.map((c) => c.jurisdictionalTopUp)] }], data: { total, jurisdictions: host.calcs.length } };
      }
      return { evidence: list.map(calcEvidence), data: list.map((c) => ({ iso: c.iso, blend: c.blendKind, etr: c.etr, topUp: c.jurisdictionalTopUp })) };
    }
    case "explain_figure": {
      const loc = locateNode(str("query"), host.calcs, host.groupAudit);
      if (!loc) return { evidence: [], data: { error: "Could not identify the figure. Name the jurisdiction and the line (e.g. 'Vietnam ETR', 'Thailand SBIE', 'group top-up')." } };
      const r = explainNode({ node: loc.node, calc: loc.calc, calcs: host.calcs, inputs: host.inputs, findings: host.findings, xray: host.xray, ctx: host.ctx });
      return { evidence: evidenceFromReply(`trace:${loc.node.label.replace(/\W+/g, "-").slice(0, 24)}`, r), data: { figure: loc.node.label, amount: loc.node.amount ?? null }, actions: r.actions };
    }
    case "feature_pack": {
      const f = str("feature") as FeatureId;
      const r = host.featurePack(f, str("query") || "overview");
      if (!r) return { evidence: [], data: { error: `Feature ${f} is not available here.` } };
      return { evidence: evidenceFromReply(`${f}`, r), data: { title: r.title, unsupported: r.unsupported }, actions: r.actions };
    }
    case "get_findings": {
      const iso = str("iso").toUpperCase();
      if (str("kind") === "reviewer") {
        const list = host.reviewFindings.filter((f) => !iso || f.iso === iso).slice(0, 12);
        return { evidence: list.map((f) => ({ id: `review:${f.id}`, label: f.title, href: f.href, authority: "GMT24 Calculation Reviewer", text: `${f.checked} Expected ${f.expected}; actual ${f.actual}. ${f.question} Severity ${f.severity}; owner ${f.owner}; ${f.iso ?? ""} ${f.entityId ?? ""}`, values: numbersIn(`${f.expected} ${f.actual}`) })), data: list.map((f) => ({ id: f.id, severity: f.severity })) };
      }
      const list = host.findings.filter((f) => !iso || f.iso === iso).filter((f) => !host.xray[f.id]?.reviewer).slice(0, 12);
      return { evidence: list.map((f) => ({ id: `xray:${f.id}`, label: f.title, href: "/xray/confirm", authority: "GMT24 X-Ray", text: `${f.jurisdiction} · ${f.entityName} (${f.entityCode}): detected — ${f.detected}. Missing — ${f.missing}. Amount ${money(f.amount)}; ${f.article}; severity ${f.severity}; owner ${f.owner}.`, values: [f.amount] })), data: list.map((f) => ({ id: f.id, iso: f.iso })) };
    }
    case "get_facts": {
      const list = factsFor(host.facts, { iso: str("iso") || null, topic: str("topic") || null }).slice(0, 20);
      return { evidence: list.map((f) => ({ id: `fact:${f.id}`, label: `${f.topic} · ${f.entityId ?? ""}`, authority: `GMT24 fact (${f.status})`, text: `${f.statement} — status ${f.status}${f.confirmedBy ? `, confirmed by ${f.confirmedBy}` : ""}; applies ${f.fy}. Source: ${f.source}.`, values: numbersIn(f.statement) })), data: list.map((f) => ({ id: f.id, status: f.status })) };
    }
    case "run_scenario": {
      const parsed = parseScenario(str("request"), host.calcs, { scenario: host.inputs.scenario, electionsOn: host.inputs.electionsOn, sbieClaim: host.inputs.sbieClaim });
      if (!parsed.assumptions.length) return { evidence: [], data: { error: "The engine cannot simulate this request. Supported levers: BOI holiday extension/conversion, Thai payroll, transfer-pricing margin, SBIE claim mode, elections.", unparsed: parsed.unparsed } };
      const sc = runScenario(parsed.spec, host.inputs, host.calcs, host.ctx, str("request"), parsed.assumptions);
      host.saveScenario(sc);
      const deltaRows = sc.rows.map((d) => `${d.iso} ${d.name}: baseline top-up ${money(d.baseTopUp)} (ETR ${pct(d.baseEtr)}) → scenario ${money(d.topUp)} (ETR ${pct(d.etr)}), payer ${d.payer}`);
      const text = `Assumptions: ${sc.assumptions.join("; ")}.\nEligibility: ${sc.eligibility.map((e) => `${e.key} ${e.status} (${e.reason})`).join("; ") || "n/a"}.\nGroup top-up baseline ${money(sc.baseTopUp)} → scenario ${money(sc.topUp)} (Δ ${money(sc.topUp - sc.baseTopUp)}).\n${deltaRows.join("\n")}\nSensitivity: ${sc.sensitivity.map((x) => `${x.label}: ${money(x.topUp)} (Δ ${money(x.delta)})`).join("; ") || "n/a"}${sc.multiYear.length ? `\nMulti-year: ${sc.multiYear.map((m) => `${m.fy} ${money(m.base)} → ${money(m.scenario)}`).join("; ")}` : ""}${parsed.unparsed.length ? `\nNot simulated: ${parsed.unparsed.join("; ")}` : ""}`;
      const act = propose("save-scenario", { id: sc.id }, host.ctx, { label: "Save scenario for review" });
      return { evidence: [{ id: `scenario:${sc.id}`, label: sc.title, href: "/strategy", authority: "GMT24 engine · scenario run", text, values: [sc.baseTopUp, sc.topUp, sc.topUp - sc.baseTopUp, ...sc.rows.flatMap((d) => [d.baseTopUp, d.topUp, Math.round(d.baseEtr * 10000) / 100, Math.round(d.etr * 10000) / 100]), ...sc.sensitivity.flatMap((x) => [x.topUp, x.delta])] }], data: { id: sc.id, unparsed: parsed.unparsed }, actions: [act] };
    }
    case "get_catalog": {
      const href = str("href");
      const hit = href ? catalogForPath(href) : (() => { const h = locateCatalog(str("query")); return h ? (h.kind === "screen" ? { screen: h.screen, book: h.book } : { screen: null, book: h.book }) : catalogForPath(host.ctx.path); })();
      const ev: Evidence[] = [];
      if (hit.screen) ev.push({ id: `menu:${hit.screen.key}`, label: hit.screen.title, href: hit.screen.href, authority: "GMT24 product catalog", text: `${hit.screen.title} (${hit.screen.module}): ${hit.screen.purpose}\nFields: ${hit.screen.fields.map((f) => `${f.term} = ${f.meaning}`).join("; ") || "—"}\nActions: ${hit.screen.actions.join("; ") || "—"}`, values: [] });
      if (hit.book) ev.push({ id: `playbook:${hit.book.slug}`, label: hit.book.title, href: `/playbook/${hit.book.slug}`, authority: "GMT24 playbook", text: `${hit.book.summary}\nSteps: ${hit.book.steps.map((s) => `${s.n}. ${s.title} (${s.href}) — ${s.body}`).join("\n")}`, values: [] });
      return { evidence: ev, data: { screen: hit.screen?.title ?? null, playbook: hit.book?.title ?? null } };
    }
    case "get_workflow_status": {
      const o = host.ctx.outstanding;
      const w = host.workflow;
      const text = `Group ${host.ctx.groupName}, ${host.ctx.fy}, calculation ${host.ctx.calcVersion}, screen ${host.ctx.screen?.title ?? host.ctx.path}. Role ${host.ctx.role}. Workflow: ${Object.entries(w).map(([k, v]) => `${k}=${String(v)}`).join(", ")}. Outstanding: X-Ray open ${o.xrayOpen} (material ${o.xrayMaterial}), blocking issues ${o.issuesBlock}, tasks open ${host.tasks.filter((t) => t.status === "open").length}.`;
      return { evidence: [{ id: "workflow:status", label: "Workflow status", href: "/approvals", authority: "GMT24 workflow", text, values: [o.xrayOpen, o.xrayMaterial, o.issuesBlock] }], data: { ...w, ...o } };
    }
    case "get_tasks": {
      const st = str("status") || "open";
      const list = host.tasks.filter((t) => st === "all" || t.status === st).slice(0, 15);
      return { evidence: list.map((t) => ({ id: `task:${t.id}`, label: t.title, href: t.href, authority: "GMT24 tasks", text: `${t.title} — ${t.detail}. Owner ${t.owner}; severity ${t.severity}; status ${t.status}.`, values: [] })), data: list.map((t) => ({ id: t.id, status: t.status })) };
    }
    case "read_attachment": {
      const a = host.attachments.find((x) => x.id === str("id") || contains(x.name, str("id")));
      if (!a) return { evidence: [], data: { error: `No attachment ${str("id")}. Available: ${host.attachments.map((x) => `${x.id} (${x.name})`).join(", ") || "none"}.` } };
      const n = Number(args.page) || 1;
      const p = a.pages.find((x) => x.n === n) ?? a.pages[0];
      if (!p) return { evidence: [], data: { error: `${a.name} has no extractable text (quality ${a.quality}%).` } };
      return { evidence: [{ id: `doc:${a.id}:p${p.n}`, label: `${a.name} p.${p.n}`, authority: "Uploaded document (evidence)", text: p.text.slice(0, 6000), values: numbersIn(p.text.slice(0, 6000)) }], data: { pages: a.pages.length, page: p.n } };
    }
    case "draft_ticket": {
      const text = [str("summary"), str("detail")].filter(Boolean).join(" — ");
      const t = draftTicket(text, host.ctx, host.tickets, { screen: true, versions: true, steps: true }, host.ctx.user.name);
      const dup = findDuplicate(text, host.tickets);
      host.holdTicket(t);
      const act = propose("create-ticket", { id: t.id }, host.ctx, { label: "File this ticket" });
      return { evidence: [{ id: `ticket:${t.id}`, label: `Ticket draft ${t.id}`, href: "/feedback", authority: "GMT24 feedback", text: `${t.ref} ${t.title} · ${t.category} · ${t.severity}\n${t.description}\nSteps: ${t.steps.join(" → ") || "—"}\nContext included: ${t.contextIncluded.join(", ")}; excluded: ${t.contextExcluded.join(", ") || "none"}${dup ? `\nPossible duplicate of ${dup.ref}: ${dup.title}` : ""}`, values: [] }], data: { id: t.id, duplicate: dup?.id ?? null }, actions: [act] };
    }
    case "propose_action": {
      const id = str("actionId") as ActionId;
      const allowed: ActionId[] = ["navigate", "open-audit", "create-task", "set-election", "set-sbie", "save-scenario", "download"];
      if (!allowed.includes(id)) return { evidence: [], data: { error: `Action ${id} cannot be proposed by the assistant.` } };
      const params = (args.params && typeof args.params === "object" ? args.params : {}) as Record<string, string | number | boolean>;
      const a = propose(id, params, host.ctx, { label: str("label") || undefined });
      const ok = permitted(a, host.ctx);
      return { evidence: [], data: { id: a.id, permitted: ok, reason: ok ? null : `Requires permission ${a.requires}` }, actions: ok ? [a] : [] };
    }
    default:
      return { evidence: [], data: { error: `Unknown tool ${name}` } };
  }
}

export { DATA as _DATA };

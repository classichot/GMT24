"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useXray } from "@/lib/useXray";
import type { AuditNode, JurCalc } from "@/lib/engine";
import { totals } from "@/lib/engine";
import { buildContext } from "@/lib/ai/context";
import { detectLang } from "@/lib/ai/i18n";
import { detectIntent } from "@/lib/ai/router";
import { execute, propose, type GatewayApi, type GatewayResult } from "@/lib/ai/actions";
import { allFacts } from "@/lib/ai/facts";
import { deriveTasks, newManualTask } from "@/lib/ai/tasks";
import { trainerReply } from "@/lib/ai/trainer";
import { specialistReply } from "@/lib/ai/specialist";
import { draftTicket, feedbackReply, findDuplicate } from "@/lib/ai/feedback";
import { explainNode, locateNode } from "@/lib/ai/explain";
import { interviewOverview, interviewReply, priority as xrayPriority } from "@/lib/ai/interviewer";
import { reviewCalculation, reviewerReply, type ReviewFinding } from "@/lib/ai/reviewer";
import { parseScenario, runScenario, strategyReply } from "@/lib/ai/strategy";
import { rehearsalReply, rehearse, type RehearsalQ } from "@/lib/ai/rehearsal";
import { regwatchReply, watchItems, type WatchItem } from "@/lib/ai/regwatch";
import { briefing, briefingReply, type Audience } from "@/lib/ai/briefing";
import { quickscanReply } from "@/lib/ai/quickscan";
import type { CalcInputs } from "@/lib/ai/calc";
import { extractAttachment } from "@/lib/ai/documents";
import { emptyAiState, type AiAuditRecord, type AiState, type Attachment, type Fact, type FeatureId, type Lang, type ProposedAction, type Reply, type Task, type Thread, type Ticket, type UserRole, type WorkContext } from "@/lib/ai/types";
import type { XrayFinding } from "@/lib/xray";
import { buildScan, reassess, type ScanOptions } from "@/lib/scan/pipeline";
import { extractUpload } from "@/lib/scan/extract";
import { onboardingPackage } from "@/lib/scan/onboard";
import type { Correction, ScanResult } from "@/lib/scan/types";

const KEY = "gmt24_ai_v1";

type Ai = {
  state: AiState;
  ctx: WorkContext;
  lang: Lang;
  setLang: (l: Lang) => void;
  setRole: (r: UserRole) => void;
  calcs: JurCalc[];
  inputs: CalcInputs;
  findings: XrayFinding[];
  facts: Fact[];
  tasks: Task[];
  reviewFindings: ReviewFinding[];
  watch: WatchItem[];
  rehearsal: RehearsalQ[];
  thread: Thread | null;
  busy: boolean;
  ask: (q: string, opts?: { feature?: FeatureId | null; attachmentIds?: string[] }) => Promise<Reply | null>;
  run: (a: ProposedAction) => GatewayResult;
  explain: (node: AuditNode, calc?: JurCalc) => Reply;
  interview: (findingId: string, q?: string) => Reply;
  briefingFor: (audience: Audience) => ReturnType<typeof briefing>;
  attach: (file: File) => Promise<Attachment | null>;
  removeAttachment: (id: string) => void;
  createTask: GatewayApi["createTask"];
  updateTask: GatewayApi["updateTask"];
  updateTicket: (id: string, p: Partial<Pick<Ticket, "status">> & { note?: string }) => void;
  submitTicket: (t: Ticket) => GatewayResult;
  reviewReg: GatewayApi["reviewReg"];
  confirmFact: GatewayApi["confirmFact"];
  addFact: (f: Fact) => void;
  scans: ScanResult[];
  runScan: (query: string, opts?: ScanOptions & { attachmentId?: string }) => ScanResult;
  answerScan: (scanId: string, qid: string, value: string) => void;
  correctScan: (scanId: string, c: Correction) => void;
  deleteScan: (scanId: string) => void;
  onboard: (scanId: string) => string | null;
  clearThread: () => void;
  guideNext: () => void;
  guideEnd: () => void;
};

const Ctx = createContext<Ai | null>(null);

function load(): AiState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyAiState();
    return { ...emptyAiState(), ...(JSON.parse(raw) as Partial<AiState>) };
  } catch {
    return emptyAiState();
  }
}

function download(name: string, body: string, mime = "text/markdown") {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AiProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const x = useXray();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [state, setState] = useState<AiState>(emptyAiState);
  const [lang, setLangState] = useState<Lang>("en");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState<URLSearchParams | null>(null);
  const loaded = useRef(false);
  const pendingTickets = useRef<Map<string, Ticket>>(new Map());
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => { setState(load()); loaded.current = true; }, []);
  useEffect(() => { if (loaded.current) try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota — keep in memory */ } }, [state]);
  useEffect(() => { setSearch(typeof window === "undefined" ? null : new URLSearchParams(window.location.search)); }, [pathname]);

  const patch = useCallback((fn: (s: AiState) => Partial<AiState>) => setState((s) => ({ ...s, ...fn(s) })), []);

  const inputs: CalcInputs = useMemo(() => ({ groupId: store.groupId, fy: store.activeFy, electionsOn: store.electionsOn, approvedMaps: store.approvedMaps, yearRecords: store.yearRecords, packOverlay: store.packOverlay, scenario: store.scenario, sbieClaim: store.sbieClaim }), [store.groupId, store.activeFy, store.electionsOn, store.approvedMaps, store.yearRecords, store.packOverlay, store.scenario, store.sbieClaim]);

  const ctx = useMemo(() => buildContext({
    groupId: store.groupId, groupName: store.group.name, upe: store.group.upe, fy: store.activeFy, mode: store.mode, role: state.role, path: pathname, search, lang,
    workflow: store.workflow, approvedMaps: store.approvedMaps, yearLocked: store.yearLocked, ingestReady: store.ingestStatus === "ready", stop: x.stop,
    packAmendments: store.packAmendments, packChanges: store.packChanges, snapshot: `${store.activeFy} working`,
  }), [store.groupId, store.group, store.activeFy, store.mode, state.role, pathname, search, lang, store.workflow, store.approvedMaps, store.yearLocked, store.ingestStatus, x.stop, store.packAmendments, store.packChanges]);

  const facts = useMemo(() => allFacts({ findings: x.findings, xray: x.state, fy: store.activeFy, manual: state.manualFacts, packAmendments: store.packAmendments }), [x.findings, x.state, store.activeFy, state.manualFacts, store.packAmendments]);
  const reviewFindings = useMemo(() => reviewCalculation({ calcs: x.calcs, inputs, findings: x.findings, xray: x.state, approvedMaps: store.approvedMaps, groupId: store.groupId }), [x.calcs, inputs, x.findings, x.state, store.approvedMaps, store.groupId]);
  const tasks = useMemo(() => deriveTasks({ findings: x.findings, xray: x.state, reviewer: reviewFindings.map((f) => ({ id: f.id, title: f.title, detail: `${f.checked} Expected ${f.expected}; actual ${f.actual}. ${f.question}`, owner: f.owner, severity: f.severity, href: f.href, iso: f.iso, entityId: f.entityId })), overrides: state.taskOverrides, manual: state.manualTasks, fy: store.activeFy }), [x.findings, x.state, reviewFindings, state.taskOverrides, state.manualTasks, store.activeFy]);
  const watch = useMemo(() => watchItems(x.calcs, store.packAmendments, state.regReview), [x.calcs, store.packAmendments, state.regReview]);
  const rehearsal = useMemo(() => rehearse({ calcs: x.calcs, findings: x.findings, xray: x.state, approvedMaps: store.approvedMaps, electionsOn: store.electionsOn, scenario: store.scenario, ctx }), [x.calcs, x.findings, x.state, store.approvedMaps, store.electionsOn, store.scenario, ctx]);
  const scans = state.scans as ScanResult[];
  const groupAudit: AuditNode = useMemo(() => totals(x.calcs).audit, [x.calcs]);

  const thread = useMemo(() => state.threads.find((t) => t.contextKey === ctx.contextKey) ?? null, [state.threads, ctx.contextKey]);

  const record = useCallback((r: Omit<AiAuditRecord, "id" | "at" | "actor" | "role" | "contextKey" | "calcVersion">) => {
    patch((s) => ({ audit: [{ id: `au-${Date.now().toString(36)}-${s.audit.length}`, at: new Date().toISOString(), actor: ctx.user.name, role: ctx.role, contextKey: ctx.contextKey, calcVersion: ctx.calcVersion, ...r }, ...s.audit].slice(0, 500) }));
  }, [patch, ctx]);

  const append = useCallback((userText: string | null, reply: Reply, attachments?: string[]) => {
    patch((s) => {
      const now = new Date().toISOString();
      const existing = s.threads.find((t) => t.contextKey === ctx.contextKey);
      const msgs: Thread["messages"] = [...(existing?.messages ?? [])];
      if (userText != null) msgs.push({ role: "user", at: now, text: userText, attachments });
      msgs.push({ role: "assistant", at: now, reply });
      const t: Thread = existing ? { ...existing, updatedAt: now, messages: msgs.slice(-60), calcVersion: ctx.calcVersion } : { id: `th-${Date.now().toString(36)}`, contextKey: ctx.contextKey, title: userText ?? reply.title, groupId: ctx.groupId, fy: ctx.fy, screen: ctx.screen?.title ?? "General", calcVersion: ctx.calcVersion, createdAt: now, updatedAt: now, messages: msgs };
      const threads = existing ? s.threads.map((o) => (o.id === t.id ? t : o)) : [t, ...s.threads].slice(0, 40);
      const quality = [{ at: now, feature: reply.feature, grounded: reply.grounded, unsupported: reply.unsupported.length, cites: reply.cites.length, latencyMs: reply.latencyMs ?? 0, tokensEst: Math.round(JSON.stringify(reply.sections).length / 4), lang: reply.lang }, ...s.quality].slice(0, 500);
      return { threads, quality };
    });
    record({ kind: "answer", feature: reply.feature, summary: reply.title, sources: reply.cites.map((c) => c.label) });
  }, [patch, ctx, record]);

  // Quick Scan operations.
  const runScan = useCallback((query: string, opts: ScanOptions & { attachmentId?: string } = {}) => {
    const att = opts.attachmentId ? stateRef.current.attachments.find((a) => a.id === opts.attachmentId) : undefined;
    const upload = att ? extractUpload(att, opts.period ?? "FY2025") : undefined;
    const r = buildScan(query, { ...opts, upload });
    if (upload?.notes.length) r.notes.push(...upload.notes);
    patch((s) => ({ scans: [r, ...(s.scans as ScanResult[])].slice(0, 20) }));
    record({ kind: "answer", feature: "quickscan", summary: `Quick Scan run: ${r.resolved?.name ?? query} · ${r.period}`, sources: r.sources.map((d) => d.title) });
    return r;
  }, [patch, record]);
  const mutateScan = useCallback((scanId: string, fn: (r: ScanResult) => ScanResult) => patch((s) => ({ scans: (s.scans as ScanResult[]).map((r) => (r.id === scanId ? reassess(fn(r)) : r)) })), [patch]);
  const answerScan = useCallback((scanId: string, qid: string, value: string) => { mutateScan(scanId, (r) => ({ ...r, answers: { ...r.answers, [qid]: { value, by: ctx.user.name, at: new Date().toISOString() } } })); record({ kind: "action", feature: "quickscan", summary: `Quick Scan answer ${qid} = ${value}`, sources: [] }); }, [mutateScan, ctx.user.name, record]);
  const correctScan = useCallback((scanId: string, c: Correction) => { mutateScan(scanId, (r) => ({ ...r, corrections: [...r.corrections, c] })); record({ kind: "action", feature: "quickscan", summary: `Quick Scan structure correction: ${c.kind}`, sources: [] }); }, [mutateScan, record]);
  const deleteScan = useCallback((scanId: string) => patch((s) => ({ scans: (s.scans as ScanResult[]).filter((r) => r.id !== scanId) })), [patch]);

  const onboard = useCallback((scanId: string): string | null => {
    const r = (stateRef.current.scans as ScanResult[]).find((s) => s.id === scanId);
    if (!r) return "Scan not found.";
    if (!r.exposure.length) return "Nothing to onboard — the scan has no assessed jurisdictions.";
    const pkg = onboardingPackage(r, { name: ctx.user.name, role: ctx.user.title });
    let target = "current workspace";
    if (store.mode === "advisor") {
      const id = store.addEngagement(pkg.draft);
      if (!id) return "Engagement could not be created (see the message shown).";
      target = pkg.draft.name;
    }
    patch((s) => ({ manualFacts: [...s.manualFacts.filter((f) => !pkg.facts.some((n) => n.id === f.id)), ...pkg.facts], manualTasks: [...s.manualTasks, ...pkg.tasks.map((t) => newManualTask(t))] }));
    for (const e of pkg.evidence) store.appendHistory(e);
    record({ kind: "draft", feature: "quickscan", summary: `Workspace created from Quick Scan ${r.id} → ${target}: ${pkg.entities.length} entities, ${pkg.facts.length} proposed facts, ${pkg.tasks.length} tasks, ${pkg.evidence.length} evidence records`, sources: r.sources.map((d) => d.title), actionId: "onboard-scan", ok: true });
    store.flash(`${target}: ${pkg.entities.length} entities, ${pkg.facts.length} proposed facts, ${pkg.tasks.length} tasks — all marked proposed.`);
    return null;
  }, [ctx.user, store, patch, record]);

  // Gateway API bound to the store.
  const api: GatewayApi = useMemo(() => ({
    navigate: (href) => router.push(href),
    openAuditFor: (iso) => { const c = x.calcs.find((k) => k.iso === iso && k.blendKind === "main") ?? x.calcs.find((k) => k.iso === iso); if (!c) return false; store.openAudit(c.audit); return true; },
    approveMap: store.approveMap,
    setElection: store.setElection,
    setSbieClaim: store.setSbieClaim,
    setScenario: store.setScenario,
    patchWorkflow: store.patchWorkflow,
    answerXray: store.answerXray,
    attachXrayEvidence: store.attachXrayEvidence,
    signXray: store.signXray,
    decidePackAmendment: store.decidePackAmendment,
    adminReviewPackChange: store.adminReviewPackChange,
    createTask: (p) => { const t = newManualTask({ source: p.source as Task["source"], title: p.title, detail: p.detail, owner: p.owner, due: p.due ?? null, severity: p.severity, href: p.href }); patch((s) => ({ manualTasks: [...s.manualTasks, t] })); return t.id; },
    updateTask: (id, p) => { patch((s) => ({ taskOverrides: { ...s.taskOverrides, [id]: { ...s.taskOverrides[id], ...(p.status ? { status: p.status } : {}), ...(p.owner ? { owner: p.owner } : {}), ...(p.reason || p.status === "resolved" || p.status === "dismissed" ? { resolution: { by: ctx.user.name, at: new Date().toISOString(), reason: p.reason ?? "" } } : {}) } } })); return null; },
    saveScenario: (id) => { let err: string | null = "Scenario not found."; patch((s) => { if (s.scenarios.some((sc) => sc.id === id)) err = null; return { scenarios: s.scenarios.map((sc) => (sc.id === id ? { ...sc, status: "proposed" } : sc)) }; }); return err; },
    adoptScenario: (id) => {
      const sc = stateRef.current.scenarios.find((s) => s.id === id);
      if (!sc) return "Scenario not found.";
      if (store.yearLocked) return "Fiscal year is locked — reopen before adopting.";
      for (const e of sc.spec.elections ?? []) { const err = store.setElection(e.key, e.on); if (err) return err; }
      for (const s of sc.spec.sbie ?? []) store.setSbieClaim(s.iso, s.mode);
      store.setScenario({ ...(sc.spec.boiExtend != null ? { boiExtend: sc.spec.boiExtend } : {}), ...(sc.spec.payrollTh != null ? { payrollTh: sc.spec.payrollTh } : {}), ...(sc.spec.tpMargin != null ? { tpMargin: sc.spec.tpMargin } : {}) });
      patch((s) => ({ scenarios: s.scenarios.map((o) => (o.id === id ? { ...o, status: "adopted", adoptedBy: ctx.user.name, adoptedAt: new Date().toISOString() } : o)) }));
      store.appendHistory({ kind: "change", title: `Scenario adopted · ${sc.title}`, detail: `${sc.question} — assumptions: ${sc.assumptions.join("; ")}. Adopted into the working package through the Co-Pilot gateway.`, actor: ctx.user.name, role: ctx.user.title, fy: ctx.fy, href: "/strategy", ref: sc.id });
      return null;
    },
    createTicket: (id) => { const t = pendingTickets.current.get(id); if (!t) return "Ticket draft expired — describe the issue again."; pendingTickets.current.delete(id); patch((s) => ({ tickets: [t, ...s.tickets] })); return null; },
    reviewReg: (id, status, note) => { patch((s) => ({ regReview: { ...s.regReview, [id]: { status, by: ctx.user.name, at: new Date().toISOString(), note } } })); store.appendHistory({ kind: "action", title: `Regulatory item ${status} · ${id}`, detail: note || `${status} by ${ctx.user.name} in Regulatory Impact Watch.`, actor: ctx.user.name, role: ctx.user.title, fy: ctx.fy, href: "/regwatch", ref: id }); },
    confirmFact: (factId) => { const f = stateRef.current.manualFacts.find((m) => m.id === factId); if (!f) return "Only proposed facts from documents or Quick Scan can be confirmed here; X-Ray facts are confirmed by signing the finding."; patch((s) => ({ manualFacts: s.manualFacts.map((m) => (m.id === factId ? { ...m, status: "confirmed", confirmedBy: ctx.user.name, at: new Date().toISOString() } : m)) })); return null; },
    download,
    snapshotBlocked: () => (x.stop.open ? `X-Ray hard stop: ${x.stop.reasons.length} material item${x.stop.reasons.length === 1 ? "" : "s"} unresolved.` : null),
    onboardScan: onboard,
  }), [router, x.calcs, x.stop, store, patch, ctx, onboard]);

  const run = useCallback((a: ProposedAction): GatewayResult => {
    const res = execute(a, ctx, api);
    record({ kind: res.ok ? (a.kind === "draft" ? "draft" : "action") : "refused", feature: "gateway", summary: `${a.label} → ${res.message}`, sources: [], actionId: a.actionId, ok: res.ok });
    if (a.kind !== "navigate") store.flash(res.message);
    return res;
  }, [ctx, api, record, store]);

  const explain = useCallback((node: AuditNode, calc?: JurCalc) => {
    const r = explainNode({ node, calc, calcs: x.calcs, inputs, findings: x.findings, xray: x.state, ctx });
    append(`Explain: ${node.label}`, r);
    return r;
  }, [x.calcs, x.findings, x.state, inputs, ctx, append]);

  const interview = useCallback((findingId: string, q?: string) => {
    const f = x.findings.find((k) => k.id === findingId);
    const r = f ? interviewReply({ finding: f, xray: x.state, calcs: x.calcs, facts, attachments: state.attachments.filter((a) => a.contextKey === ctx.contextKey), ctx, q }) : interviewOverview(x.findings, x.state, x.calcs, ctx);
    append(q ?? `X-Ray: ${f?.title ?? "overview"}`, r);
    return r;
  }, [x.findings, x.state, x.calcs, facts, state.attachments, ctx, append]);

  const briefingFor = useCallback((audience: Audience) => briefing({ audience, calcs: x.calcs, inputs, findings: x.findings, xray: x.state, reviewer: reviewFindings, tasks, scenarios: state.scenarios, ctx }), [x.calcs, inputs, x.findings, x.state, reviewFindings, tasks, state.scenarios, ctx]);

  const ask = useCallback(async (q: string, opts?: { feature?: FeatureId | null; attachmentIds?: string[] }): Promise<Reply | null> => {
    const text = q.trim();
    if (!text) return null;
    setBusy(true);
    const t0 = performance.now();
    const l = detectLang(text);
    const c: WorkContext = { ...ctx, lang: l };
    const intent = detectIntent(text, c.screen?.key ?? null, opts?.feature ?? null);
    let reply: Reply;
    try {
      switch (intent.feature) {
        case "trainer": reply = trainerReply(text, c, intent.mode); break;
        case "feedback": {
          const dup = findDuplicate(text, stateRef.current.tickets);
          const tk = draftTicket(text, c, stateRef.current.tickets, { screen: true, versions: true, steps: true }, c.user.name);
          pendingTickets.current.set(tk.id, tk);
          reply = feedbackReply(tk, c, dup);
          break;
        }
        case "explain": {
          const loc = locateNode(text, x.calcs, groupAudit);
          reply = loc ? explainNode({ node: loc.node, calc: loc.calc, calcs: x.calcs, inputs, findings: x.findings, xray: x.state, ctx: c }) : specialistReply({ q: text, ctx: c, calcs: x.calcs, findings: x.findings, xray: x.state, facts });
          if (!loc) reply = { ...reply, unsupported: [...reply.unsupported, "Could not identify the amount to explain — name the jurisdiction and the figure (e.g. \"Vietnam ETR\"), or click Explain on the audit trail."] };
          break;
        }
        case "interviewer": {
          const ordered = xrayPriority(x.findings, x.state, x.calcs).map((p) => p.f);
          const named = ordered.find((f) => text.toLowerCase().includes(f.jurisdiction.toLowerCase()) || text.toLowerCase().includes(f.entityName.toLowerCase()) || text.toLowerCase().includes(f.title.toLowerCase().slice(0, 18)));
          reply = named ? interviewReply({ finding: named, xray: x.state, calcs: x.calcs, facts, attachments: stateRef.current.attachments.filter((a) => a.contextKey === c.contextKey || (opts?.attachmentIds ?? []).includes(a.id)), ctx: c, q: text }) : interviewOverview(x.findings, x.state, x.calcs, c);
          break;
        }
        case "reviewer": reply = reviewerReply(reviewFindings, c, stateRef.current.taskOverrides, text); if (!store.workflow.reviewerRan) store.patchWorkflow({ reviewerRan: true }); break;
        case "strategy": {
          const parsed = parseScenario(text, x.calcs, { scenario: store.scenario, electionsOn: store.electionsOn, sbieClaim: store.sbieClaim });
          const sc = runScenario(parsed.spec, inputs, x.calcs, c, text, parsed.assumptions);
          patch((s) => ({ scenarios: [sc, ...s.scenarios].slice(0, 30) }));
          reply = strategyReply(sc, c, parsed.unparsed, x.calcs);
          break;
        }
        case "rehearsal": reply = rehearsalReply(rehearsal, c, text); break;
        case "regwatch": reply = regwatchReply(watch, c, text); break;
        case "briefing": reply = briefingReply({ audience: intent.audience === "board" ? "board" : intent.audience === "committee" ? "tax-committee" : "cfo", calcs: x.calcs, inputs, findings: x.findings, xray: x.state, reviewer: reviewFindings, tasks, scenarios: stateRef.current.scenarios, ctx: c }); break;
        case "quickscan": {
          const m = text.match(/(?:quick ?scan|scan|สแกน)\s+(?:of\s+|for\s+)?["“]?([^"”?]+?)["”]?\s*$/i);
          const latest = (stateRef.current.scans as ScanResult[])[0] ?? null;
          if (m && m[1].trim().length > 2 && !/^(the )?(group|company|it|this)$/i.test(m[1].trim())) { const r = runScan(m[1].trim()); reply = quickscanReply(text, r, c, true); }
          else reply = quickscanReply(text, latest, c, false);
          break;
        }
        default: reply = specialistReply({ q: text, ctx: c, calcs: x.calcs, findings: x.findings, xray: x.state, facts });
      }
    } catch (e) {
      reply = { id: `r-${Date.now().toString(36)}`, at: new Date().toISOString(), feature: intent.feature, title: "Could not answer", sections: [{ kind: "warning", text: `The ${intent.feature} feature failed: ${e instanceof Error ? e.message : String(e)}. Nothing was changed. Use Feedback to report it with the context attached.` }], cites: [], actions: [propose("navigate", { href: "/feedback" }, c, { label: "Report" })], grounded: false, unsupported: ["Feature error"], version: c.calcVersion, lang: l };
    }
    reply = { ...reply, latencyMs: Math.round(performance.now() - t0), chips: [intent.feature, ...(intent.mode ? [intent.mode] : [])] };
    append(text, reply, opts?.attachmentIds);
    setBusy(false);
    return reply;
  }, [ctx, x.calcs, x.findings, x.state, inputs, facts, reviewFindings, rehearsal, watch, tasks, store, groupAudit, patch, append, runScan]);

  // Pending "ask" from other screens (existing store.ask bridge).
  useEffect(() => {
    if (!store.pendingAsk) return;
    const q = store.consumeAsk();
    if (q) void ask(q);
  }, [store.pendingAsk, store, ask]);

  const attach = useCallback(async (file: File) => {
    try {
      const a = await extractAttachment(file, ctx.contextKey);
      patch((s) => ({ attachments: [a, ...s.attachments].slice(0, 12) }));
      record({ kind: "action", feature: "interviewer", summary: `Attachment read as evidence: ${a.name} (${a.pages.length} pages, quality ${a.quality}%, ${a.stripped} instruction-like lines ignored)`, sources: [a.name] });
      return a;
    } catch (e) {
      store.flash(e instanceof Error ? e.message : "Extraction failed");
      return null;
    }
  }, [ctx.contextKey, patch, record, store]);

  const value: Ai = useMemo(() => ({
    state, ctx, lang, setLang: setLangState, setRole: (r) => patch(() => ({ role: r })),
    calcs: x.calcs, inputs, findings: x.findings, facts, tasks, reviewFindings, watch, rehearsal, thread, busy,
    ask, run, explain, interview, briefingFor, attach,
    removeAttachment: (id) => patch((s) => ({ attachments: s.attachments.filter((a) => a.id !== id) })),
    createTask: api.createTask, updateTask: api.updateTask,
    updateTicket: (id, p) => patch((s) => ({ tickets: s.tickets.map((t) => (t.id === id ? { ...t, ...(p.status ? { status: p.status } : {}), updates: [...t.updates, { at: new Date().toISOString(), note: p.note ?? `Status → ${p.status}` }] } : t)) })),
    submitTicket: (t) => { pendingTickets.current.set(t.id, t); return run(propose("create-ticket", { id: t.id }, ctx)); },
    reviewReg: api.reviewReg, confirmFact: api.confirmFact,
    addFact: (f) => patch((s) => ({ manualFacts: [...s.manualFacts.filter((m) => m.id !== f.id), f] })),
    scans, runScan, answerScan, correctScan, deleteScan, onboard,
    clearThread: () => patch((s) => ({ threads: s.threads.filter((t) => t.contextKey !== ctx.contextKey) })),
    guideNext: () => patch((s) => (s.guide ? { guide: s.guide.index + 1 >= s.guide.steps.length ? null : { ...s.guide, index: s.guide.index + 1 } } : {})),
    guideEnd: () => patch(() => ({ guide: null })),
  }), [state, ctx, lang, patch, x.calcs, x.findings, inputs, facts, tasks, reviewFindings, watch, rehearsal, thread, busy, ask, run, explain, interview, briefingFor, attach, api, scans, runScan, answerScan, correctScan, deleteScan, onboard]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAi() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAi outside AiProvider");
  return v;
}

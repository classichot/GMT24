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
import { explainCatalog, trainerReply } from "@/lib/ai/trainer";
import { specialistReply } from "@/lib/ai/specialist";
import { draftTicket, feedbackReply, findDuplicate } from "@/lib/ai/feedback";
import { explainNode, locateNode } from "@/lib/ai/explain";
import { interviewOverview, interviewReply, priority as xrayPriority } from "@/lib/ai/interviewer";
import { reviewCalculation, reviewerReply, type ReviewFinding } from "@/lib/ai/reviewer";
import { parseScenario, runScenario, strategyReply } from "@/lib/ai/strategy";
import { rehearsalReply, rehearse, type RehearsalQ } from "@/lib/ai/rehearsal";
import { regwatchReply, watchItems, type WatchItem } from "@/lib/ai/regwatch";
import type { RegChange, RegSourceState } from "@/lib/ai/regwatchSources";
import { briefing, briefingReply, type Audience } from "@/lib/ai/briefing";
import { quickscanReply } from "@/lib/ai/quickscan";
import type { CalcInputs } from "@/lib/ai/calc";
import { extractAttachment } from "@/lib/ai/documents";
import { orchestrate, OrchestrationError, type Progress } from "@/lib/ai/orchestrate";
import type { ToolHost } from "@/lib/ai/tools";
import { emptyAiState, type AiAuditRecord, type AiState, type Attachment, type Fact, type FeatureId, type Lang, type ProposedAction, type Reply, type Task, type Thread, type Ticket, type UserRole, type WorkContext } from "@/lib/ai/types";
import type { XrayFinding } from "@/lib/xray";
import { buildScan, reassess, type ScanOptions } from "@/lib/scan/pipeline";
import { extractUpload } from "@/lib/scan/extract";
import { onboardingPackage } from "@/lib/scan/onboard";
import type { Correction, ScanResult } from "@/lib/scan/types";
import { scanDiscover, scanUpload, type DiscoverOutcome, type ScanProgress } from "@/lib/scan/discoverClient";

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
  /** What the assistant is doing right now (retrieving, thinking, tool name, validating). */
  progress: Progress | null;
  model: ModelStatus;
  refreshModel: () => Promise<void>;
  ask: (q: string, opts?: { feature?: FeatureId | null; attachmentIds?: string[] }) => Promise<Reply | null>;
  /** Deterministic answer without the language model — always labelled as rule-based. */
  askRules: (q: string, opts?: { feature?: FeatureId | null; attachmentIds?: string[] }) => Reply | null;
  cancel: () => void;
  run: (a: ProposedAction) => GatewayResult;
  explain: (node: AuditNode, calc?: JurCalc) => Reply;
  explainMenu: (href?: string) => Reply | null;
  interview: (findingId: string, q?: string) => Reply;
  briefingFor: (audience: Audience) => ReturnType<typeof briefing>;
  attach: (file: File) => Promise<Attachment | null>;
  removeAttachment: (id: string) => void;
  createTask: GatewayApi["createTask"];
  updateTask: GatewayApi["updateTask"];
  updateTicket: (id: string, p: Partial<Pick<Ticket, "status">> & { note?: string }) => void;
  submitTicket: (t: Ticket) => GatewayResult;
  reviewReg: GatewayApi["reviewReg"];
  /** Regulatory Impact Watch monitor: cached server state, refresh, and run-now. */
  regwatch: { sources: RegSourceState[]; changes: RegChange[]; checking: boolean; load: () => Promise<void>; check: (sourceIds?: string[]) => Promise<RegCheckOutcome> };
  confirmFact: GatewayApi["confirmFact"];
  addFact: (f: Fact) => void;
  scans: ScanResult[];
  runScan: (query: string, opts?: ScanOptions & { attachmentId?: string }) => ScanResult;
  /** Company-name entry: discover official sources on the web, read the report, structure it with the model, assess. */
  discoverScan: (company: string, opts?: { period?: string; url?: string; onProgress?: (p: ScanProgress) => void; signal?: AbortSignal }) => Promise<DiscoverOutcome>;
  /** Upload entry: structure an attached report with the model (falls back to heuristics, labelled, when no model). */
  uploadScan: (attachmentId: string, opts?: { period?: string; query?: string; onProgress?: (p: ScanProgress) => void; signal?: AbortSignal }) => Promise<DiscoverOutcome>;
  answerScan: (scanId: string, qid: string, value: string) => void;
  correctScan: (scanId: string, c: Correction) => void;
  deleteScan: (scanId: string) => void;
  onboard: (scanId: string) => string | null;
  clearThread: () => void;
  guideNext: () => void;
  guideEnd: () => void;
};

export type { DiscoverOutcome, ScanProgress } from "@/lib/scan/discoverClient";
export type RegCheckOutcome = { ok: boolean; error: string | null; checkedAt: string | null; newChanges: RegChange[]; errors: { sourceId: string; error: string }[]; model: string | null };
function mergeChanges(cached: RegChange[], fresh: RegChange[]): RegChange[] {
  const byId = new Map(cached.map((c) => [c.id, c]));
  for (const c of fresh) byId.set(c.id, c);
  return [...byId.values()].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)).slice(0, 300);
}
function mergeSources(cached: RegSourceState[], fresh: RegSourceState[]): RegSourceState[] {
  const byId = new Map(cached.map((c) => [c.id, c]));
  for (const c of fresh) byId.set(c.id, c);
  return [...byId.values()];
}
export type ModelStatus = { checked: boolean; configured: boolean; reachable: boolean; provider: string; model: string; detail: string; store: string };
const NO_MODEL: ModelStatus = { checked: false, configured: false, reachable: false, provider: "none", model: "", detail: "", store: "memory" };

const Ctx = createContext<Ai | null>(null);

/**
 * Browser persistence is split so the small, decision-bearing core (threads,
 * tickets, facts, reviews, tasks) always saves. Attachments and scans carry
 * document text and are written separately; if they exceed the quota, page
 * text is evicted (metadata kept, note set) rather than losing the core.
 */
const KEY_ATT = `${KEY}_att`;
const KEY_SCANS = `${KEY}_scans`;

function readJson<T>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}

function load(): AiState {
  const core = readJson<Partial<AiState>>(KEY) ?? {};
  const attachments = readJson<Attachment[]>(KEY_ATT) ?? core.attachments ?? [];
  const scans = readJson<unknown[]>(KEY_SCANS) ?? core.scans ?? [];
  return { ...emptyAiState(), ...core, attachments, scans };
}

function trySet(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { console.error(`gmt24: could not persist ${key}`, e); return false; }
}

function saveCore(s: AiState) {
  const { attachments: _a, scans: _s, ...core } = s; // eslint-disable-line @typescript-eslint/no-unused-vars
  if (trySet(KEY, core)) return;
  // Still too large: keep decisions, shrink the bulky caches.
  trySet(KEY, { ...core, regChanges: core.regChanges.map((c) => ({ ...c, excerpt: c.excerpt.slice(0, 600) })), audit: core.audit.slice(0, 100), quality: core.quality.slice(0, 100) });
}

function saveAttachments(list: Attachment[]) {
  if (trySet(KEY_ATT, list)) return;
  const slim = [...list].sort((a, b) => b.size - a.size);
  for (let i = 0; i < slim.length; i++) {
    slim[i] = { ...slim[i], pages: [], qualityNote: "Document text was too large to keep in this browser after refresh; attach the file again to use it." };
    if (trySet(KEY_ATT, slim)) return;
  }
}

function saveScans(list: unknown[]) {
  let keep = list;
  while (keep.length && !trySet(KEY_SCANS, keep)) keep = keep.slice(0, -1);
  if (!keep.length) trySet(KEY_SCANS, []);
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
  const [progress, setProgress] = useState<Progress | null>(null);
  const [model, setModel] = useState<ModelStatus>(NO_MODEL);
  const abortRef = useRef<AbortController | null>(null);
  const [search, setSearch] = useState<URLSearchParams | null>(null);
  /** True once the persisted state has been committed; saves before that would overwrite the stored record with the empty initial state. */
  const [hydrated, setHydrated] = useState(false);
  const pendingTickets = useRef<Map<string, Ticket>>(new Map());
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    // Keep anything the monitor fetched before hydration finished; everything else comes from the stored record.
    setState((s) => { const l = load(); return { ...l, regSources: s.regSources.length ? mergeSources(l.regSources, s.regSources) : l.regSources, regChanges: s.regChanges.length ? mergeChanges(l.regChanges, s.regChanges) : l.regChanges }; });
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) saveCore(state); }, [state, hydrated]);
  useEffect(() => { if (hydrated) saveAttachments(state.attachments); }, [state.attachments, hydrated]);
  useEffect(() => { if (hydrated) saveScans(state.scans); }, [state.scans, hydrated]);
  useEffect(() => { setSearch(typeof window === "undefined" ? null : new URLSearchParams(window.location.search)); }, [pathname]);

  const refreshModel = useCallback(async () => {
    try {
      const r = await fetch("/api/ai/status", { cache: "no-store" });
      const j = (await r.json()) as Omit<ModelStatus, "checked">;
      setModel({ ...j, checked: true });
    } catch {
      setModel((m) => ({ ...m, checked: true, reachable: false, detail: "status endpoint unreachable" }));
    }
  }, []);
  useEffect(() => { void refreshModel(); const t = setInterval(() => void refreshModel(), 120_000); return () => clearInterval(t); }, [refreshModel]);

  // Durable mirror of the thread for the open context (no-op on the in-memory store, kept for configured stores).
  useEffect(() => {
    if (!hydrated) return;
    const t = state.threads.find((th) => th.contextKey === ctxKeyRef.current);
    if (!t) return;
    const h = setTimeout(() => { void fetch("/api/ai/records", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenant: t.groupId, kind: "thread", id: t.id, record: t }) }).catch(() => undefined); }, 1500);
    return () => clearTimeout(h);
  }, [state.threads]);

  const patch = useCallback((fn: (s: AiState) => Partial<AiState>) => setState((s) => ({ ...s, ...fn(s) })), []);

  const inputs: CalcInputs = useMemo(() => ({ groupId: store.groupId, fy: store.activeFy, electionsOn: store.electionsOn, approvedMaps: store.approvedMaps, yearRecords: store.yearRecords, packOverlay: store.packOverlay, scenario: store.scenario, sbieClaim: store.sbieClaim }), [store.groupId, store.activeFy, store.electionsOn, store.approvedMaps, store.yearRecords, store.packOverlay, store.scenario, store.sbieClaim]);

  const ctx = useMemo(() => buildContext({
    groupId: store.groupId, groupName: store.group.name, upe: store.group.upe, fy: store.activeFy, mode: store.mode, role: state.role, path: pathname, search, lang,
    workflow: store.workflow, approvedMaps: store.approvedMaps, yearLocked: store.yearLocked, ingestReady: store.ingestStatus === "ready", stop: x.stop,
    packAmendments: store.packAmendments, packChanges: store.packChanges, snapshot: `${store.activeFy} working`,
  }), [store.groupId, store.group, store.activeFy, store.mode, state.role, pathname, search, lang, store.workflow, store.approvedMaps, store.yearLocked, store.ingestStatus, x.stop, store.packAmendments, store.packChanges]);

  const ctxKeyRef = useRef("");
  ctxKeyRef.current = ctx.contextKey;

  const facts = useMemo(() => allFacts({ findings: x.findings, xray: x.state, fy: store.activeFy, manual: state.manualFacts, packAmendments: store.packAmendments }), [x.findings, x.state, store.activeFy, state.manualFacts, store.packAmendments]);
  const reviewFindings = useMemo(() => reviewCalculation({ calcs: x.calcs, inputs, findings: x.findings, xray: x.state, approvedMaps: store.approvedMaps, groupId: store.groupId }), [x.calcs, inputs, x.findings, x.state, store.approvedMaps, store.groupId]);
  const watch = useMemo(() => watchItems(x.calcs, store.packAmendments, state.regReview, state.regChanges), [x.calcs, store.packAmendments, state.regReview, state.regChanges]);
  const regTasks = useMemo(() => watch.filter((w) => w.status === "approved" && (w.kind === "kb" || w.kind === "source")).flatMap((w) => w.affected.map((a) => ({ id: w.id, iso: a.iso, title: w.title, detail: `${w.source}. ${a.why}. Re-run the ${a.name} computation against the approved guidance and record whether the treatment changes.`, approvedAt: state.regReview[w.id]?.at ?? new Date().toISOString() }))), [watch, state.regReview]);
  const tasks = useMemo(() => deriveTasks({ findings: x.findings, xray: x.state, reviewer: reviewFindings.map((f) => ({ id: f.id, title: f.title, detail: `${f.checked} Expected ${f.expected}; actual ${f.actual}. ${f.question}`, owner: f.owner, severity: f.severity, href: f.href, iso: f.iso, entityId: f.entityId })), regwatch: regTasks, overrides: state.taskOverrides, manual: state.manualTasks, fy: store.activeFy }), [x.findings, x.state, reviewFindings, regTasks, state.taskOverrides, state.manualTasks, store.activeFy]);
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

  const finishScan = useCallback((query: string, r: ScanResult, extraNotes: string[]) => {
    r.notes.push(...extraNotes);
    patch((s) => ({ scans: [r, ...(s.scans as ScanResult[])].slice(0, 20) }));
    record({ kind: "answer", feature: "quickscan", summary: `Quick Scan run: ${r.resolved?.name ?? query} · ${r.period}${r.discovery ? ` · discovered via ${r.discovery.provider}` : ""}`, sources: r.sources.map((d) => d.title) });
    return r;
  }, [patch, record]);

  const uploadScan = useCallback(async (attachmentId: string, opts: { period?: string; query?: string; onProgress?: (p: ScanProgress) => void; signal?: AbortSignal } = {}): Promise<DiscoverOutcome> => {
    const att = stateRef.current.attachments.find((a) => a.id === attachmentId);
    if (!att) return { kind: "error", code: "missing", message: "Attachment not found." };
    const out = await scanUpload(att, { ...opts, modelConfigured: model.configured });
    if (out.kind === "scan") finishScan(out.scan.query, out.scan, []);
    return out;
  }, [model.configured, finishScan]);

  const discoverScan = useCallback(async (company: string, opts: { period?: string; url?: string; onProgress?: (p: ScanProgress) => void; signal?: AbortSignal } = {}): Promise<DiscoverOutcome> => {
    const out = await scanDiscover(company, { ...opts, modelConfigured: model.configured, contextKey: ctx.contextKey, onAttachment: (att) => patch((s) => ({ attachments: [att, ...s.attachments].slice(0, 12) })) });
    if (out.kind === "scan") finishScan(out.scan.query, out.scan, []);
    return out;
  }, [ctx.contextKey, model.configured, patch, finishScan]);

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

  const explainMenu = useCallback((href?: string) => {
    const target = href ?? ctx.path;
    const r = explainCatalog("What is this menu for?", ctx, target);
    if (r) append(`What is ${r.title.replace(/^This menu · /, "")} for?`, r);
    return r;
  }, [ctx, append]);

  const interview = useCallback((findingId: string, q?: string) => {
    const f = x.findings.find((k) => k.id === findingId);
    const r = f ? interviewReply({ finding: f, xray: x.state, calcs: x.calcs, facts, attachments: state.attachments.filter((a) => a.contextKey === ctx.contextKey), ctx, q }) : interviewOverview(x.findings, x.state, x.calcs, ctx);
    append(q ?? `X-Ray: ${f?.title ?? "overview"}`, r);
    return r;
  }, [x.findings, x.state, x.calcs, facts, state.attachments, ctx, append]);

  const briefingFor = useCallback((audience: Audience) => briefing({ audience, calcs: x.calcs, inputs, findings: x.findings, xray: x.state, reviewer: reviewFindings, tasks, scenarios: state.scenarios, ctx }), [x.calcs, inputs, x.findings, x.state, reviewFindings, tasks, state.scenarios, ctx]);

  /** Deterministic feature modules. Used as first-pass evidence for the model and as the labelled rule-based fallback. */
  const rulesReply = useCallback((text: string, c: WorkContext, feature: FeatureId, mode: ReturnType<typeof detectIntent>["mode"], audience: ReturnType<typeof detectIntent>["audience"], opts?: { attachmentIds?: string[] }): Reply => {
    switch (feature) {
      case "trainer": return trainerReply(text, c, mode);
      case "feedback": {
        const dup = findDuplicate(text, stateRef.current.tickets);
        const tk = draftTicket(text, c, stateRef.current.tickets, { screen: true, versions: true, steps: true }, c.user.name);
        pendingTickets.current.set(tk.id, tk);
        return feedbackReply(tk, c, dup);
      }
      case "explain": {
        const loc = locateNode(text, x.calcs, groupAudit);
        let reply = loc ? explainNode({ node: loc.node, calc: loc.calc, calcs: x.calcs, inputs, findings: x.findings, xray: x.state, ctx: c }) : specialistReply({ q: text, ctx: c, calcs: x.calcs, findings: x.findings, xray: x.state, facts });
        if (!loc) reply = { ...reply, unsupported: [...reply.unsupported, "Could not identify the amount to explain — name the jurisdiction and the figure (e.g. \"Vietnam ETR\"), or click Explain on the audit trail."] };
        return reply;
      }
      case "interviewer": {
        const ordered = xrayPriority(x.findings, x.state, x.calcs).map((p) => p.f);
        const named = ordered.find((f) => text.toLowerCase().includes(f.jurisdiction.toLowerCase()) || text.toLowerCase().includes(f.entityName.toLowerCase()) || text.toLowerCase().includes(f.title.toLowerCase().slice(0, 18)));
        return named ? interviewReply({ finding: named, xray: x.state, calcs: x.calcs, facts, attachments: stateRef.current.attachments.filter((a) => a.contextKey === c.contextKey || (opts?.attachmentIds ?? []).includes(a.id)), ctx: c, q: text }) : interviewOverview(x.findings, x.state, x.calcs, c);
      }
      case "reviewer": { if (!store.workflow.reviewerRan) store.patchWorkflow({ reviewerRan: true }); return reviewerReply(reviewFindings, c, stateRef.current.taskOverrides, text); }
      case "strategy": {
        const parsed = parseScenario(text, x.calcs, { scenario: store.scenario, electionsOn: store.electionsOn, sbieClaim: store.sbieClaim });
        const sc = runScenario(parsed.spec, inputs, x.calcs, c, text, parsed.assumptions);
        patch((s) => ({ scenarios: [sc, ...s.scenarios].slice(0, 30) }));
        return strategyReply(sc, c, parsed.unparsed, x.calcs);
      }
      case "rehearsal": return rehearsalReply(rehearsal, c, text);
      case "regwatch": return regwatchReply(watch, c, text, state.regSources);
      case "briefing": return briefingReply({ audience: audience === "board" ? "board" : audience === "committee" ? "tax-committee" : "cfo", calcs: x.calcs, inputs, findings: x.findings, xray: x.state, reviewer: reviewFindings, tasks, scenarios: stateRef.current.scenarios, ctx: c });
      case "quickscan": {
        const m = text.match(/(?:quick ?scan|scan|สแกน)\s+(?:of\s+|for\s+)?["“]?([^"”?]+?)["”]?\s*$/i);
        const latest = (stateRef.current.scans as ScanResult[])[0] ?? null;
        if (m && m[1].trim().length > 2 && !/^(the )?(group|company|it|this)$/i.test(m[1].trim())) { const r = runScan(m[1].trim()); return quickscanReply(text, r, c, true); }
        return quickscanReply(text, latest, c, false);
      }
      default: return specialistReply({ q: text, ctx: c, calcs: x.calcs, findings: x.findings, xray: x.state, facts });
    }
  }, [x.calcs, x.findings, x.state, inputs, facts, reviewFindings, rehearsal, watch, state.regSources, tasks, store, groupAudit, patch, runScan]);

  // Regulatory Impact Watch — server monitor. `load` mirrors the stored state; `check` runs the monitor now.
  const [regChecking, setRegChecking] = useState(false);
  const loadRegwatch = useCallback(async () => {
    try {
      const r = await fetch("/api/regwatch/check", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { sources: RegSourceState[]; changes: RegChange[] };
      patch((s) => ({ regSources: j.sources, regChanges: mergeChanges(s.regChanges, j.changes) }));
    } catch { /* offline: keep the cached copy */ }
  }, [patch]);
  const checkRegwatch = useCallback(async (sourceIds?: string[]): Promise<RegCheckOutcome> => {
    setRegChecking(true);
    try {
      const r = await fetch("/api/regwatch/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sourceIds ? { sourceIds } : {}) });
      const j = (await r.json()) as { checkedAt: string; sources: RegSourceState[]; changes: RegChange[]; allChanges: RegChange[]; errors: { sourceId: string; error: string }[]; model: string | null; error?: string; detail?: string };
      if (!r.ok || j.error) return { ok: false, error: j.detail ?? j.error ?? `HTTP ${r.status}`, checkedAt: null, newChanges: [], errors: [], model: null };
      patch((s) => ({ regSources: mergeSources(s.regSources, j.sources), regChanges: mergeChanges(s.regChanges, j.allChanges) }));
      store.appendHistory({ kind: "action", title: `Regulatory sources checked · ${j.sources.length} source${j.sources.length === 1 ? "" : "s"}`, detail: `${j.changes.length} new change${j.changes.length === 1 ? "" : "s"} detected; ${j.errors.length} unreachable.${j.model ? ` Summaries by ${j.model}.` : ""}`, actor: ctx.user.name, role: ctx.user.title, fy: ctx.fy, href: "/regwatch" });
      return { ok: true, error: null, checkedAt: j.checkedAt, newChanges: j.changes, errors: j.errors, model: j.model };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e), checkedAt: null, newChanges: [], errors: [], model: null };
    } finally {
      setRegChecking(false);
    }
  }, [patch, store, ctx.user.name, ctx.user.title, ctx.fy]);

  const toolHost = useCallback((c: WorkContext): ToolHost => ({
    ctx: c, calcs: x.calcs, inputs, findings: x.findings, xray: x.state, facts, tasks, reviewFindings,
    attachments: stateRef.current.attachments, tickets: stateRef.current.tickets, scenarios: stateRef.current.scenarios, groupAudit,
    workflow: { girValidated: store.workflow.girValidated, girExported: store.workflow.girExported, snapshotApproved: store.workflow.snapshotApproved, reviewerRan: store.workflow.reviewerRan, requestsSent: Object.values(store.workflow.sentRequests).filter(Boolean).length, ingestReady: store.ingestStatus === "ready", yearLocked: store.yearLocked, approvedMaps: Object.keys(store.approvedMaps).length },
    featurePack: (f, q) => { try { return rulesReply(q, c, f, null, undefined); } catch { return null; } },
    saveScenario: (sc) => patch((s) => ({ scenarios: [sc, ...s.scenarios.filter((o) => o.id !== sc.id)].slice(0, 30) })),
    holdTicket: (t) => pendingTickets.current.set(t.id, t),
    addFacts: (list) => patch((s) => ({ manualFacts: [...s.manualFacts.filter((m) => !list.some((n) => n.id === m.id)), ...list] })),
  }), [x.calcs, x.findings, x.state, inputs, facts, tasks, reviewFindings, groupAudit, store, rulesReply, patch]);

  const askRules = useCallback((q: string, opts?: { feature?: FeatureId | null; attachmentIds?: string[] }): Reply | null => {
    const text = q.trim();
    if (!text) return null;
    const l = detectLang(text);
    const c: WorkContext = { ...ctx, lang: l };
    const intent = detectIntent(text, c.screen?.key ?? null, opts?.feature ?? null);
    let reply: Reply;
    try { reply = rulesReply(text, c, intent.feature, intent.mode, intent.audience, opts); }
    catch (e) { reply = { id: `r-${Date.now().toString(36)}`, at: new Date().toISOString(), feature: intent.feature, title: "Could not answer", sections: [{ kind: "warning", text: `The ${intent.feature} module failed: ${e instanceof Error ? e.message : String(e)}. Nothing was changed.` }], cites: [], actions: [], grounded: false, unsupported: ["Feature error"], version: c.calcVersion, lang: l }; }
    reply = { ...reply, engine: "rules", chips: [intent.feature, ...(intent.mode ? [intent.mode] : [])], sections: [{ kind: "warning", text: l === "th" ? "คำตอบจากกฎเกณฑ์ที่กำหนดไว้ (ไม่ได้ใช้โมเดลภาษา) — ตัวเลขมาจากเครื่องคำนวณและฐานความรู้ที่อนุมัติ" : "Rule-based answer — produced by GMT24's deterministic modules without a language model. Figures come from the engine and the approved knowledge base." }, ...reply.sections] };
    append(text, reply, opts?.attachmentIds);
    return reply;
  }, [ctx, rulesReply, append]);

  const cancel = useCallback(() => { abortRef.current?.abort(); }, []);

  const ask = useCallback(async (q: string, opts?: { feature?: FeatureId | null; attachmentIds?: string[] }): Promise<Reply | null> => {
    const text = q.trim();
    if (!text) return null;
    const l = detectLang(text);
    const c: WorkContext = { ...ctx, lang: l };
    const intent = detectIntent(text, c.screen?.key ?? null, opts?.feature ?? null);
    const t0 = performance.now();
    setBusy(true);
    setProgress({ stage: "retrieving" });
    const ctl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctl;
    let seed: Reply | null = null;
    try { seed = rulesReply(text, c, intent.feature, intent.mode, intent.audience, opts); } catch { seed = null; }
    let reply: Reply;
    if (!model.configured) {
      reply = { id: `r-${Date.now().toString(36)}`, at: new Date().toISOString(), feature: intent.feature, title: l === "th" ? "ยังไม่ได้เชื่อมต่อโมเดลภาษา" : "Language model not connected", sections: [{ kind: "warning", text: l === "th" ? "พื้นที่ทำงานนี้ยังไม่ได้ตั้งค่าโมเดลภาษา จึงยังตอบคำถามแบบเปิดไม่ได้ คุณสามารถดูคำตอบจากกฎเกณฑ์ (ตัวเลขจากเครื่องคำนวณ) หรือแจ้งผู้ดูแลระบบให้ตั้งค่า" : "No language model is configured for this workspace, so open-ended questions cannot be answered yet. You can view the rule-based answer (figures straight from the engine and knowledge base) or ask your administrator to connect a model." }], cites: [], actions: [], grounded: false, unsupported: [], version: c.calcVersion, lang: l, engine: "llm", failed: { code: "not_configured", detail: model.detail, question: text, feature: intent.feature, attachmentIds: opts?.attachmentIds } };
    } else {
      try {
        reply = await orchestrate({ question: text, feature: intent.feature, lang: l, ctx: c, thread: stateRef.current.threads.find((t) => t.contextKey === c.contextKey) ?? null, host: toolHost(c), seed, attachmentIds: opts?.attachmentIds, signal: ctl.signal, onProgress: setProgress });
        // Actions the model did not surface but the deterministic module proposed stay available as secondary options.
        if (seed && reply.actions.length === 0 && seed.actions.length) reply = { ...reply, actions: seed.actions.slice(0, 3) };
      } catch (e) {
        const aborted = ctl.signal.aborted;
        const code = aborted ? "cancelled" : e instanceof OrchestrationError ? e.code : "error";
        const detail = e instanceof Error ? e.message : String(e);
        const human = aborted
          ? (l === "th" ? "ยกเลิกแล้ว คำถามของคุณยังอยู่ — กดลองใหม่ได้" : "Cancelled. Your question is kept — retry when ready.")
          : code === "timeout" ? (l === "th" ? "โมเดลใช้เวลานานเกินไป ลองใหม่หรือดูคำตอบจากกฎเกณฑ์" : "The model took too long. Retry, or view the rule-based answer.")
          : code === "not_configured" ? (l === "th" ? "ยังไม่ได้ตั้งค่าโมเดลภาษา" : "No language model is configured for this workspace.")
          : code === "bad_response" ? (l === "th" ? "โมเดลไม่ได้ตอบในรูปแบบที่ตรวจสอบได้ จึงไม่แสดงคำตอบนั้น" : "The model did not return an answer that could be validated, so it was not shown.")
          : (l === "th" ? "บริการโมเดลภาษาไม่พร้อมใช้งานในขณะนี้" : "The language model service is unavailable right now.");
        reply = { id: `r-${Date.now().toString(36)}`, at: new Date().toISOString(), feature: intent.feature, title: aborted ? (l === "th" ? "ยกเลิก" : "Cancelled") : (l === "th" ? "ตอบไม่ได้ในขณะนี้" : "Assistant unavailable"), sections: [{ kind: "warning", text: `${human} ${l === "th" ? "ไม่มีการเปลี่ยนแปลงข้อมูลใด ๆ" : "Nothing was changed."}` }], cites: [], actions: [], grounded: false, unsupported: [], version: c.calcVersion, lang: l, engine: "llm", failed: { code, detail, question: text, feature: intent.feature, attachmentIds: opts?.attachmentIds } };
        void refreshModel();
      }
    }
    reply = { ...reply, latencyMs: reply.latencyMs ?? Math.round(performance.now() - t0), chips: reply.chips?.length ? reply.chips : [intent.feature, ...(intent.mode ? [intent.mode] : [])] };
    append(text, reply, opts?.attachmentIds);
    setBusy(false);
    setProgress(null);
    if (abortRef.current === ctl) abortRef.current = null;
    return reply;
  }, [ctx, model.configured, model.detail, rulesReply, toolHost, append, refreshModel]);

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
    calcs: x.calcs, inputs, findings: x.findings, facts, tasks, reviewFindings, watch, rehearsal, thread, busy, progress, model, refreshModel,
    ask, askRules, cancel, run, explain, explainMenu, interview, briefingFor, attach,
    removeAttachment: (id) => patch((s) => ({ attachments: s.attachments.filter((a) => a.id !== id) })),
    createTask: api.createTask, updateTask: api.updateTask,
    updateTicket: (id, p) => patch((s) => ({ tickets: s.tickets.map((t) => (t.id === id ? { ...t, ...(p.status ? { status: p.status } : {}), updates: [...t.updates, { at: new Date().toISOString(), note: p.note ?? `Status → ${p.status}` }] } : t)) })),
    submitTicket: (t) => { pendingTickets.current.set(t.id, t); return run(propose("create-ticket", { id: t.id }, ctx)); },
    reviewReg: api.reviewReg, confirmFact: api.confirmFact,
    regwatch: { sources: state.regSources, changes: state.regChanges, checking: regChecking, load: loadRegwatch, check: checkRegwatch },
    addFact: (f) => patch((s) => ({ manualFacts: [...s.manualFacts.filter((m) => m.id !== f.id), f] })),
    scans, runScan, discoverScan, uploadScan, answerScan, correctScan, deleteScan, onboard,
    clearThread: () => patch((s) => ({ threads: s.threads.filter((t) => t.contextKey !== ctx.contextKey) })),
    guideNext: () => patch((s) => (s.guide ? { guide: s.guide.index + 1 >= s.guide.steps.length ? null : { ...s.guide, index: s.guide.index + 1 } } : {})),
    guideEnd: () => patch(() => ({ guide: null })),
  }), [state, ctx, lang, patch, x.calcs, x.findings, inputs, facts, tasks, reviewFindings, watch, rehearsal, thread, busy, progress, model, refreshModel, ask, askRules, cancel, run, explain, explainMenu, interview, briefingFor, attach, api, scans, runScan, discoverScan, uploadScan, answerScan, correctScan, deleteScan, onboard, regChecking, loadRegwatch, checkRegwatch]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAi() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAi outside AiProvider");
  return v;
}

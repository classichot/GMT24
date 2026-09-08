import { AUTHORITY_LABEL, retrieve } from "./knowledge";
import { evidenceFromReply, executeTool, TOOL_DEFS, type Evidence, type ToolHost } from "./tools";
import type { Cite, FeatureId, Lang, ProposedAction, Reply, Section, Thread, WorkContext } from "./types";

/**
 * Client side of the orchestration loop. Retrieval runs first (knowledge base
 * plus the deterministic feature module for the detected intent), so the model
 * starts with grounded evidence; it may then call tools for anything else.
 * The server validates every answer against the evidence gathered here.
 */

type WireMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: { id: string; name: string; args: Record<string, unknown> }[] }
  | { role: "tool"; toolCallId: string; name: string; content: string };

type StepResponse =
  | { kind: "tool_calls"; calls: { id: string; name: string; args: Record<string, unknown> }[]; assistant: WireMessage; usage: { input: number; output: number }; model: string; latencyMs: number }
  | { kind: "answer"; answer: { title: string; language: Lang; conclusion: string; sections: Section[]; cites: string[]; missingFacts: string[]; actions: string[]; followUps: string[]; confidence: "high" | "medium" | "low" }; grounded: boolean; unsupported: string[]; usage: { input: number; output: number }; model: string; latencyMs: number; repaired: boolean };

export class OrchestrationError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

export type Progress = { stage: "retrieving" | "thinking" | "tool" | "validating"; detail?: string };

export type OrchestrateInput = {
  question: string;
  feature: FeatureId;
  lang: Lang;
  ctx: WorkContext;
  thread: Thread | null;
  host: ToolHost;
  /** Deterministic reply for the detected intent, used as first-pass evidence. */
  seed: Reply | null;
  attachmentIds?: string[];
  signal?: AbortSignal;
  onProgress?: (p: Progress) => void;
};

const MAX_STEPS = 4;
const PROFILE_FOR: Partial<Record<FeatureId, "chat" | "reasoning">> = { specialist: "reasoning", strategy: "reasoning", briefing: "reasoning", reviewer: "reasoning", rehearsal: "reasoning" };

function contextSummary(ctx: WorkContext, attachments: string[]): Record<string, string | number | boolean | null> {
  return {
    group: ctx.groupName, upe: ctx.upe, fiscalYear: ctx.fy, calculationVersion: ctx.calcVersion, dataset: ctx.datasetVersion, rulePack: ctx.rulePack, appVersion: ctx.appVersion,
    screen: ctx.screen ? `${ctx.screen.title} (${ctx.path})` : ctx.path, jurisdiction: ctx.jurisdiction ? `${ctx.jurisdiction} (${ctx.iso})` : null, entity: ctx.entityId,
    userRole: ctx.role, permissions: ctx.permissions.join(", "), mode: ctx.mode, language: ctx.lang,
    outstanding: `X-Ray open ${ctx.outstanding.xrayOpen}, material ${ctx.outstanding.xrayMaterial}, blocking issues ${ctx.outstanding.issuesBlock}`,
    attachments: attachments.length ? attachments.join("; ") : null,
  };
}

function historyMessages(thread: Thread | null): WireMessage[] {
  if (!thread) return [];
  const out: WireMessage[] = [];
  for (const m of thread.messages.slice(-8)) {
    if (m.role === "user") out.push({ role: "user", content: m.text });
    else {
      const r = m.reply;
      const concl = r.sections.find((s) => s.kind === "conclusion")?.text ?? r.sections[0]?.text ?? "";
      out.push({ role: "assistant", content: `${r.title}\n${concl}`.slice(0, 1200) });
    }
  }
  return out;
}

export async function orchestrate(i: OrchestrateInput): Promise<Reply> {
  const t0 = performance.now();
  i.onProgress?.({ stage: "retrieving" });
  const evidence = new Map<string, Evidence>();
  const actions = new Map<string, ProposedAction>();
  const addEvidence = (list: Evidence[]) => { for (const e of list) if (!evidence.has(e.id)) evidence.set(e.id, e); };
  const addActions = (list?: ProposedAction[]) => { for (const a of list ?? []) actions.set(a.id, a); };

  // Retrieval-first: knowledge base + deterministic feature pack for the detected intent.
  for (const h of retrieve(i.question, { fy: i.ctx.fy, iso: i.ctx.iso }, 4)) {
    addEvidence([{ id: h.entry.id, label: `${h.entry.provision} — ${h.entry.title}`, href: h.entry.url ?? h.entry.href, authority: AUTHORITY_LABEL[h.entry.authority], text: `${h.entry.passage}\nStatus: ${h.entry.status}; version ${h.entry.version}; ${h.current ? `applies to ${i.ctx.fy}` : `NOT current for ${i.ctx.fy}`}.`, values: [] }]);
  }
  if (i.seed) { addEvidence(evidenceFromReply(i.feature, i.seed)); addActions(i.seed.actions); }
  const attNames = i.host.attachments.filter((a) => (i.attachmentIds ?? []).includes(a.id) || a.contextKey === i.ctx.contextKey).map((a) => `${a.id} = ${a.name} (${a.pages.length} pages)`);
  for (const id of i.attachmentIds ?? []) {
    const a = i.host.attachments.find((x) => x.id === id);
    if (a?.pages[0]) addEvidence([{ id: `doc:${a.id}:p1`, label: `${a.name} p.1`, authority: "Uploaded document (evidence)", text: a.pages[0].text.slice(0, 4000), values: [] }]);
  }

  const messages: WireMessage[] = [...historyMessages(i.thread), { role: "user", content: i.question }];
  const usage = { input: 0, output: 0 };
  let model = "";
  let steps = 0;
  const toolsUsed: string[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    steps += 1;
    i.onProgress?.({ stage: "thinking", detail: step ? `step ${step + 1}` : undefined });
    const body = {
      feature: i.feature,
      profile: PROFILE_FOR[i.feature] ?? "chat",
      lang: i.lang,
      context: contextSummary(i.ctx, attNames),
      messages,
      evidence: [...evidence.values()].slice(0, 60),
      tools: TOOL_DEFS,
      allowedActions: [...actions.values()].map((a) => ({ id: a.id, label: a.label, preview: a.preview })),
    };
    const res = await fetch("/api/ai/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: i.signal });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
      throw new OrchestrationError(err.error ?? "http", err.detail ?? `Model service returned ${res.status}`, res.status);
    }
    const out = (await res.json()) as StepResponse;
    usage.input += out.usage.input; usage.output += out.usage.output; model = out.model;

    if (out.kind === "tool_calls") {
      messages.push(out.assistant);
      for (const call of out.calls) {
        i.onProgress?.({ stage: "tool", detail: call.name });
        toolsUsed.push(call.name);
        const result = executeTool(call.name, call.args, i.host);
        addEvidence(result.evidence);
        addActions(result.actions);
        const payload = { evidenceIds: result.evidence.map((e) => e.id), ...(typeof result.data === "object" && result.data ? (result.data as object) : { data: result.data }) };
        messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: JSON.stringify(payload).slice(0, 8000) });
      }
      continue;
    }

    i.onProgress?.({ stage: "validating" });
    const a = out.answer;
    const cites: Cite[] = a.cites.map((id) => evidence.get(id)).filter((e): e is Evidence => !!e).map((e) => ({ label: e.label, href: e.href }));
    const sections: Section[] = [{ kind: "conclusion", text: a.conclusion }, ...a.sections];
    if (a.missingFacts.length) sections.push({ kind: "gaps", title: a.language === "th" ? "ข้อเท็จจริงที่ยังขาด" : "Facts needed before concluding", items: a.missingFacts });
    const chosen = a.actions.map((id) => actions.get(id)).filter((x): x is ProposedAction => !!x);
    return {
      id: `r-${Date.now().toString(36)}`,
      at: new Date().toISOString(),
      feature: i.feature,
      title: a.title,
      sections,
      cites,
      actions: chosen,
      grounded: out.grounded,
      unsupported: out.unsupported,
      version: i.ctx.calcVersion,
      lang: a.language,
      chips: a.followUps,
      latencyMs: Math.round(performance.now() - t0),
      engine: "llm",
      model,
      steps,
      toolsUsed,
      confidence: a.confidence,
      tokens: usage,
    };
  }
  throw new OrchestrationError("too_many_steps", "The assistant kept requesting tools without answering. Try a narrower question.", 500);
}

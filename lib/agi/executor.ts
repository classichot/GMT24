/**
 * Mission Executor. Plans the release-1 mission as an ordered set of tool
 * calls and runs them until the mission needs a person (information,
 * approval, review) or fails validation. Each step is a checkpoint: pause,
 * cancel and resume work on the recorded steps, never on in-flight state.
 */
import { labelElection } from "../evidenceHistory";
import { eur } from "../format";
import { optionToChanges } from "./elections";
import { decide, nextStep, patchStep, propose, setState, touch, uid } from "./mission";
import { callTool, approvedElections, type ToolCtx } from "./tools";
import type { MissionRecord, ToolResult } from "./types";

export type AdvanceResult = { mission: MissionRecord; ran: { step: string; tool: string; ok: boolean; note: string }[]; stoppedBecause: string };

/** Run tool calls in order until the mission waits, fails, finishes or the step budget is used. */
export function advanceMission(id: string, ctx: ToolCtx, maxSteps = 8): AdvanceResult {
  const ran: AdvanceResult["ran"] = [];
  const loaded = ctx.getMission(id);
  if (!loaded) throw new Error(`Mission ${id} not found`);
  let m: MissionRecord = loaded;
  if (["cancelled", "completed"].includes(m.state)) return { mission: m, ran, stoppedBecause: `Mission is ${m.state}.` };
  if (m.state === "paused") return { mission: m, ran, stoppedBecause: "Mission is paused. Resume it to continue." };
  if (m.state === "draft") { m = setState(touch(m, ctx.client, ctx.actor), "running", ctx.actor, `${ctx.actor} started the mission.`); ctx.saveMission(m); }

  for (let i = 0; i < maxSteps; i++) {
    m = ctx.getMission(id) ?? m;
    if (!["running", "waiting-info", "validation-failed"].includes(m.state)) return { mission: m, ran, stoppedBecause: stopReason(m) };
    const step = nextRunnable(m);
    if (!step) return { mission: m, ran, stoppedBecause: m.state === "validation-failed" ? "Validation failed — every step ran; corrections are proposed and the package lists the outstanding issues." : m.state === "ready-for-review" ? "Ready for review." : "All steps done." };

    if (step.id === "decision") {
      const approved = m.decisions.find((d) => d.kind === "election-package" && d.status === "approved" && d.caseHash === m.case.hash);
      if (approved) {
        m = patchStep(m, "decision", { status: "done", finishedAt: new Date().toISOString(), summary: `Approved by ${approved.decidedBy}: ${approved.options.find((o) => o.id === approved.chosen)?.label}` });
        ctx.saveMission(m);
        ran.push({ step: "decision", tool: "request_approval", ok: true, note: "Election package already approved." });
        continue;
      }
      if (step.status === "blocked" && m.decisions.some((d) => d.kind === "election-package" && d.status === "open")) return { mission: m, ran, stoppedBecause: "Waiting for the election package decision." };
    }
    if (step.id === "readiness" && step.status === "blocked" && m.state === "waiting-info") {
      // Re-check readiness on resume; if still blocked, wait rather than loop.
      const before = m.updatedAt;
      const res = safeCall(step, id, ctx, ran);
      if (!res) return { mission: ctx.getMission(id)!, ran, stoppedBecause: `Step ${step.id} failed.` };
      m = ctx.getMission(id)!;
      if (m.state === "waiting-info" && m.updatedAt !== before) return { mission: m, ran, stoppedBecause: stopReason(m) };
      continue;
    }
    if ((step.status === "blocked" || step.status === "failed") && step.id !== "decision" && step.id !== "pack" && step.id !== "verify") {
      return { mission: m, ran, stoppedBecause: `Step ${step.id} is ${step.status}: ${step.blocker ?? step.summary ?? ""}` };
    }

    const res = safeCall(step, id, ctx, ran);
    if (!res) return { mission: ctx.getMission(id)!, ran, stoppedBecause: `Step ${step.id} failed: ${ran[ran.length - 1]?.note ?? ""}` };
    m = ctx.getMission(id)!;
    if (!["running", "validation-failed"].includes(m.state)) return { mission: m, ran, stoppedBecause: stopReason(m) };
  }
  return { mission: ctx.getMission(id)!, ran, stoppedBecause: "Step budget reached; call run again to continue." };
}

function safeCall(step: MissionRecord["steps"][number], id: string, ctx: ToolCtx, ran: AdvanceResult["ran"]): ToolResult | null {
  try {
    const res = callTool(step.tool, { missionId: id, kind: step.id === "decision" ? "election-package" : undefined }, ctx);
    ran.push({ step: step.id, tool: step.tool, ok: true, note: summaryLine(res) });
    return res;
  } catch (e) {
    ran.push({ step: step.id, tool: step.tool, ok: false, note: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

/**
 * Next step to run. Unlike `nextStep`, a blocked verification does not stop
 * the plan: compliance and the package still run so the reviewer sees the
 * whole picture, and the pack lists the failures as outstanding issues.
 */
function nextRunnable(m: MissionRecord) {
  const satisfied = (id: string) => {
    const s = m.steps.find((x) => x.id === id)!;
    return s.status === "done" || s.status === "skipped" || (id === "verify" && s.status === "blocked");
  };
  for (const s of m.steps) {
    if (s.status === "done" || s.status === "skipped") continue;
    if (s.id === "verify" && s.status === "blocked") continue;
    if (s.id === "pack" && s.status === "blocked") continue;
    if (s.dependsOn.every(satisfied)) return s;
  }
  return null;
}

function stopReason(m: MissionRecord) {
  switch (m.state) {
    case "waiting-info": return "Waiting for information — required datasets are missing.";
    case "waiting-approval": return "Waiting for approval — a person must decide.";
    case "validation-failed": return "Validation failed — corrections are proposed for review.";
    case "ready-for-review": return "Ready for review — the audit package is built.";
    case "paused": return "Paused.";
    case "cancelled": return "Cancelled.";
    case "completed": return "Completed.";
    default: return `State ${m.state}.`;
  }
}

function summaryLine(r: ToolResult) {
  const u = r.unresolved.length ? ` · ${r.unresolved.length} unresolved` : "";
  return `${r.tool} ok${r.calculationIds.length ? ` · ${r.calculationIds.slice(0, 2).join(", ")}` : ""}${u}`;
}

/**
 * A person decided. Records the decision, and for an approved election package
 * turns the chosen option into approved proposals so normal mode can apply it
 * with history. Then the mission goes back to running so the executor can
 * continue from the scenario checkpoint.
 */
export function recordDecision(m: MissionRecord, decisionId: string, verdict: "approved" | "rejected", by: string, chosen?: string, note?: string): MissionRecord {
  const d = m.decisions.find((x) => x.id === decisionId);
  if (!d) throw new Error("Decision not found");
  let next = decide(m, decisionId, verdict, by, chosen, note);
  if (d.kind === "election-package") {
    if (verdict === "approved") {
      const opt = next.options?.options.find((o) => o.id === chosen);
      if (opt) {
        const ch = optionToChanges(opt);
        const ids: string[] = [];
        for (const [k, on] of Object.entries(ch.electionsOn)) {
          if (Boolean(next.case.snapshot.electionsOn[k]) === on) continue;
          const r = propose(next, { kind: "election", title: `${labelElection(k)} → ${on ? "on" : "off"}`, detail: `Part of approved package ${opt.title}.`, target: k, value: on, before: next.case.snapshot.electionsOn[k] ? "on" : "off", reason: `Approved election package: ${opt.title} (FY top-up ${eur(opt.fyTopUp)}).`, proposedBy: "workspace", key: `pkg:${k}:${on}` });
          next = r.mission;
          ids.push(r.proposal.id);
        }
        if (ch.sbieClaim && (next.case.snapshot.sbieClaim[ch.sbieClaim.iso] ?? "max") !== ch.sbieClaim.mode) {
          const r = propose(next, { kind: "sbie", title: `SBIE claim ${ch.sbieClaim.iso} → ${ch.sbieClaim.mode}`, detail: `Part of approved package ${opt.title}.`, target: ch.sbieClaim.iso, value: ch.sbieClaim.mode, before: next.case.snapshot.sbieClaim[ch.sbieClaim.iso] ?? "max", reason: `Approved election package: ${opt.title}.`, proposedBy: "workspace", key: `pkg:sbie:${ch.sbieClaim.iso}:${ch.sbieClaim.mode}` });
          next = r.mission;
          ids.push(r.proposal.id);
        }
        next = {
          ...next,
          proposals: next.proposals.map((p) => (ids.includes(p.id) ? { ...p, status: "approved" as const, decisionId } : p)),
          decisions: next.decisions.map((x) => (x.id === decisionId ? { ...x, proposalIds: [...new Set([...x.proposalIds, ...ids])] } : x)),
        };
      }
      next = patchStep(next, "decision", { status: "done", finishedAt: new Date().toISOString(), summary: `Approved by ${by}: ${opt?.title ?? chosen}` });
    } else {
      next = patchStep(next, "decision", { status: "pending", blocker: undefined, summary: `Rejected by ${by}${note ? `: ${note}` : ""}. A new request is needed.` });
      next = patchStep(next, "options", { status: "pending", summary: "Re-assess after rejection" });
    }
    if (next.state === "waiting-approval") next = setState(next, "running", by, "Decision recorded; mission continues.");
  } else if (d.kind === "completion" && verdict === "approved") {
    // completion is finalised by the caller through mission.complete()
  } else if (next.state === "waiting-approval" && !next.decisions.some((x) => x.status === "open")) {
    next = setState(next, "running", by, "Decision recorded; mission continues.");
  }
  return next;
}

/** Election switches the workspace should apply when the user accepts approved proposals. */
export function applicableChanges(m: MissionRecord) {
  const ap = approvedElections(m);
  const proposals = m.proposals.filter((p) => p.status === "approved" && (p.kind === "election" || p.kind === "sbie"));
  return { electionsOn: ap.electionsOn, proposals };
}

export function newHandoffNote(from: string, to: string) {
  return `${uid("hnd")}: ${from} → ${to}`;
}

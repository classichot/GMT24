import { NextResponse } from "next/server";
import { z } from "zod";
import { advanceMission, recordDecision } from "@/lib/agi/executor";
import { cancel, canMutate, complete, handoff, markApplied, pause, rebase, resume, touch } from "@/lib/agi/mission";
import { summarise } from "@/lib/agi/tools";
import type { AgentClientId } from "@/lib/agi/types";
import { loadCase, loadMission, saveMission, serverToolCtx } from "@/lib/server/agi";
import { failure, isFailure, principalFrom, record, requireWorkspace } from "@/lib/server/agiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ACTIONS = ["run", "pause", "resume", "cancel", "handoff", "decide", "complete", "recheck", "applied"] as const;
type Action = (typeof ACTIONS)[number];

const Body = z.object({
  reason: z.string().max(500).optional(),
  note: z.string().max(1000).optional(),
  to: z.enum(["workspace", "grok-bot", "claude-cowork", "gpt-work"]).optional(),
  decisionId: z.string().optional(),
  verdict: z.enum(["approved", "rejected"]).optional(),
  chosen: z.string().optional(),
  proposalIds: z.array(z.string()).optional(),
  maxSteps: z.number().int().min(1).max(12).optional(),
});

/**
 * Mission controls. `run` advances the mission through the tool plan; the
 * rest are lifecycle controls. Approving, completing, handing off and applying
 * changes are reserved for a person in the workspace.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await params;
  if (!(ACTIONS as readonly string[]).includes(action)) return NextResponse.json({ error: "unknown_action", actions: ACTIONS }, { status: 404 });
  const m = await loadMission(id);
  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const p = await principalFrom(req, m.scope.groupId);
  if (isFailure(p)) return failure(p);
  let body: z.infer<typeof Body> = {};
  try { const raw = await req.text(); body = raw ? Body.parse(JSON.parse(raw)) : {}; } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }

  const act = action as Action;
  if (["decide", "complete", "handoff", "applied"].includes(act)) {
    const ws = requireWorkspace(p, `Action ${act}`);
    if (ws) return failure(ws);
  }
  const own = canMutate(m, p.client);
  if (!own.ok) { await record(p, { missionId: id, action: `missions.${act}`, ok: false, detail: own.reason }); return NextResponse.json({ error: "owned_elsewhere", detail: own.reason, owner: m.owner }, { status: 409 }); }

  try {
    if (act === "run") {
      const { ctx, flush } = await serverToolCtx({ client: p.client, actor: p.actor, groupId: p.groupId, missionIds: [id] });
      const r = advanceMission(id, ctx, body.maxSteps ?? 8);
      await flush();
      await record(p, { missionId: id, action: "missions.run", ok: true, detail: `${r.ran.length} step(s) · ${r.stoppedBecause}` });
      return NextResponse.json({ ok: true, mission: summarise(r.mission), ran: r.ran, stoppedBecause: r.stoppedBecause });
    }
    let next = touch(m, p.client, p.actor);
    switch (act) {
      case "pause": next = pause(next, p.actor); break;
      case "resume": next = resume(next, p.actor); break;
      case "cancel": next = cancel(next, p.actor, body.reason ?? ""); break;
      case "handoff": {
        if (!body.to) return NextResponse.json({ error: "bad_request", detail: "to is required" }, { status: 400 });
        next = handoff(m, body.to as AgentClientId, p.actor, body.note ?? "");
        break;
      }
      case "decide": {
        if (!body.decisionId || !body.verdict) return NextResponse.json({ error: "bad_request", detail: "decisionId and verdict are required" }, { status: 400 });
        next = recordDecision(next, body.decisionId, body.verdict, p.actor, body.chosen, body.note);
        break;
      }
      case "complete": next = complete(next, p.actor, body.note); break;
      case "recheck": {
        const snapshot = await loadCase(m.scope.groupId);
        const r = rebase(next, snapshot, p.actor);
        next = r.mission;
        await saveMission(next);
        await record(p, { missionId: id, action: "missions.recheck", ok: true, detail: r.changes.join(" · ") || "no change" });
        return NextResponse.json({ ok: true, mission: summarise(next), changes: r.changes });
      }
      case "applied": next = markApplied(next, body.proposalIds ?? [], p.actor); break;
    }
    await saveMission(next);
    await record(p, { missionId: id, action: `missions.${act}`, ok: true, detail: `${m.state} → ${next.state}` });
    return NextResponse.json({ ok: true, mission: summarise(next) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await record(p, { missionId: id, action: `missions.${act}`, ok: false, detail: msg });
    return NextResponse.json({ error: "action_failed", detail: msg }, { status: 409 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { callTool, summarise, ToolError } from "@/lib/agi/tools";
import type { MissionRecord } from "@/lib/agi/types";
import { listMissions, loadMission, saveMission, serverToolCtx } from "@/lib/server/agi";
import { failure, isFailure, principalFrom, record, requireWorkspace } from "@/lib/server/agiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List missions for the principal's group. `?full=1` returns whole records (workspace sync). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = await principalFrom(req, url.searchParams.get("groupId"));
  if (isFailure(p)) return failure(p);
  const missions = await listMissions(p.groupId);
  const full = url.searchParams.get("full") === "1" && p.kind === "workspace";
  return NextResponse.json({ groupId: p.groupId, missions: full ? missions : missions.map(summarise) });
}

const Create = z.object({ groupId: z.string().optional(), objective: z.string().max(400).optional(), jurisdictions: z.array(z.string()).optional(), objectives: z.record(z.number()).optional() });

/** Create a mission (same as the create_mission tool). */
export async function POST(req: Request) {
  let body: z.infer<typeof Create>;
  try { body = Create.parse(await req.json()); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const p = await principalFrom(req, body.groupId ?? null);
  if (isFailure(p)) return failure(p);
  const { ctx, flush } = await serverToolCtx({ client: p.client, actor: p.actor, groupId: p.groupId });
  try {
    const res = callTool("create_mission", { ...body, groupId: p.groupId }, ctx);
    await flush();
    await record(p, { tool: "create_mission", missionId: res.missionId, action: "missions.create", ok: true, detail: res.jobId });
    return NextResponse.json(res, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: e instanceof ToolError ? e.status : 500 });
  }
}

/**
 * Workspace sync: the AGI workspace mirrors its mission records here so an
 * external assistant continues the same mission id. Newer `updatedAt` wins.
 */
export async function PUT(req: Request) {
  let m: MissionRecord;
  try { m = (await req.json()) as MissionRecord; } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  if (!m?.id || !m.scope?.groupId || !Array.isArray(m.steps)) return NextResponse.json({ error: "bad_request", detail: "Not a mission record" }, { status: 400 });
  const p = await principalFrom(req, m.scope.groupId);
  if (isFailure(p)) return failure(p);
  const ws = requireWorkspace(p, "Mission sync");
  if (ws) return failure(ws);
  const existing = await loadMission(m.id);
  if (existing && existing.updatedAt > m.updatedAt) return NextResponse.json({ ok: true, kept: "server", mission: existing });
  await saveMission(m);
  return NextResponse.json({ ok: true, kept: "client" });
}

import { NextResponse } from "next/server";
import { callTool, TOOL_CATALOGUE, ToolError } from "@/lib/agi/tools";
import type { ToolName } from "@/lib/agi/types";
import { serverToolCtx } from "@/lib/server/agi";
import { allowTool, failure, isFailure, principalFrom, record } from "@/lib/server/agiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** REST form of the tool catalogue. Same implementation as the MCP endpoint and the AGI workspace. */
export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const tool = TOOL_CATALOGUE.find((t) => t.name === name);
  if (!tool) return NextResponse.json({ error: "unknown_tool", detail: `No tool ${name}`, tools: TOOL_CATALOGUE.map((t) => t.name) }, { status: 404 });
  let args: Record<string, unknown> = {};
  try { const raw = await req.text(); args = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}; } catch { return NextResponse.json({ error: "bad_request", detail: "Body must be JSON" }, { status: 400 }); }
  const p = await principalFrom(req, typeof args.groupId === "string" ? args.groupId : null);
  if (isFailure(p)) return failure(p);
  const denied = allowTool(p, tool.name as ToolName);
  if (denied) return failure(denied);
  if (tool.name === "create_mission" || tool.name === "get_case_context") args.groupId = args.groupId ?? p.groupId;
  const { ctx, flush } = await serverToolCtx({ client: p.client, actor: p.actor, groupId: p.groupId, missionIds: typeof args.missionId === "string" ? [args.missionId] : [] });
  try {
    const res = callTool(tool.name as ToolName, args, ctx);
    await flush();
    await record(p, { tool: tool.name as ToolName, missionId: res.missionId, action: "tools.call", ok: true, detail: res.jobId });
    return NextResponse.json(res);
  } catch (e) {
    await flush();
    const status = e instanceof ToolError ? e.status : 500;
    const msg = e instanceof Error ? e.message : String(e);
    await record(p, { tool: tool.name as ToolName, missionId: typeof args.missionId === "string" ? args.missionId : undefined, action: "tools.call", ok: false, detail: msg });
    return NextResponse.json({ ok: false, tool: tool.name, error: msg }, { status });
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const tool = TOOL_CATALOGUE.find((t) => t.name === name);
  if (!tool) return NextResponse.json({ error: "unknown_tool" }, { status: 404 });
  return NextResponse.json(tool);
}

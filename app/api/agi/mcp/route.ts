import { NextResponse } from "next/server";
import { callTool, TOOL_CATALOGUE, ToolError } from "@/lib/agi/tools";
import type { ToolName } from "@/lib/agi/types";
import { serverToolCtx } from "@/lib/server/agi";
import { allowTool, baseUrl, failure, isFailure, principalFrom, record } from "@/lib/server/agiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PROTOCOL = "2025-03-26";

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

function rpcError(id: Rpc["id"], code: number, message: string, data?: unknown, status = 200) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message, data } }, { status });
}

function rpcResult(id: Rpc["id"], result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}

/** Connector probe: lets a client confirm the endpoint before authenticating. */
export async function GET(req: Request) {
  return NextResponse.json({
    name: "gmt24-agi",
    protocolVersion: PROTOCOL,
    transport: "streamable-http (JSON responses)",
    endpoint: `${baseUrl(req)}/api/agi/mcp`,
    auth: "Authorization: Bearer <gateway key>",
    tools: TOOL_CATALOGUE.map((t) => t.name),
  });
}

/**
 * MCP over HTTP (JSON-RPC 2.0). Remote MCP connectors (Claude Cowork), the
 * GPT Work plugin and Grok Bot connector all speak this. Long-running tools
 * still return synchronously here with a job id; get_mission_status returns
 * the job later if a client was interrupted.
 */
export async function POST(req: Request) {
  let body: Rpc | Rpc[];
  try { body = (await req.json()) as Rpc | Rpc[]; } catch { return rpcError(null, -32700, "Parse error", undefined, 400); }
  if (Array.isArray(body)) return rpcError(null, -32600, "Batch requests are not supported", undefined, 400);
  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") return rpcError(body?.id ?? null, -32600, "Invalid request", undefined, 400);

  if (body.method === "initialize") {
    return rpcResult(body.id, {
      protocolVersion: PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "gmt24-agi", version: "1.0.0" },
      instructions: "GMT24 AGI Mode gateway. Work the release-1 mission in order; never compute tax yourself; propose, do not approve; a mission completes only when GMT24's checks pass.",
    });
  }
  if (body.method === "notifications/initialized" || body.method.startsWith("notifications/")) return new NextResponse(null, { status: 202 });
  if (body.method === "ping") return rpcResult(body.id, {});
  if (body.method === "tools/list") {
    return rpcResult(body.id, { tools: TOOL_CATALOGUE.map((t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: { readOnlyHint: t.scope === "case:read", idempotentHint: true, openWorldHint: false } })) });
  }
  if (body.method !== "tools/call") return rpcError(body.id, -32601, `Method not found: ${body.method}`);

  const p = await principalFrom(req);
  if (isFailure(p)) return rpcError(body.id, -32001, p.detail, { error: p.error }, p.status);
  const params = (body.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
  const name = String(params.name ?? "") as ToolName;
  if (!TOOL_CATALOGUE.some((t) => t.name === name)) return rpcError(body.id, -32602, `Unknown tool ${name}`);
  const denied = allowTool(p, name);
  if (denied) { await record(p, { tool: name, action: "mcp.tools/call", ok: false, detail: denied.detail }); return rpcResult(body.id, { isError: true, content: [{ type: "text", text: denied.detail }] }); }

  const args = { ...(params.arguments ?? {}) } as Record<string, unknown>;
  if (name === "create_mission" || name === "get_case_context") args.groupId = args.groupId ?? p.groupId;
  const { ctx, flush } = await serverToolCtx({ client: p.client, actor: p.actor, groupId: p.groupId, missionIds: typeof args.missionId === "string" ? [args.missionId] : [] });
  try {
    const res = callTool(name, args, ctx);
    await flush();
    await record(p, { tool: name, missionId: res.missionId, action: "mcp.tools/call", ok: true, detail: `${res.jobId}${res.unresolved.length ? ` · ${res.unresolved.length} unresolved` : ""}` });
    return rpcResult(body.id, { content: [{ type: "text", text: JSON.stringify(res) }], structuredContent: res, isError: false });
  } catch (e) {
    await flush();
    const msg = e instanceof Error ? e.message : String(e);
    await record(p, { tool: name, missionId: typeof args.missionId === "string" ? args.missionId : undefined, action: "mcp.tools/call", ok: false, detail: msg });
    return rpcResult(body.id, { isError: true, content: [{ type: "text", text: msg }], structuredContent: { ok: false, tool: name, error: msg, status: e instanceof ToolError ? e.status : 500 } });
  }
}

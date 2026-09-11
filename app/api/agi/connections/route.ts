import { NextResponse } from "next/server";
import { z } from "zod";
import { mintAgentKey, missionInstructions, SCOPE_LABEL } from "@/lib/agi/gateway";
import { AGENT_CLIENTS, ALL_AGENT_SCOPES } from "@/lib/agi/types";
import { SEEDS, isSeededGroup } from "@/lib/seeds";
import { baseUrl, failure, isFailure, principalFrom, record, requireWorkspace } from "@/lib/server/agiAuth";
import { clientKey, rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Connection recipes per client: how each assistant reaches the same gateway. */
export async function GET(req: Request) {
  const base = baseUrl(req);
  const groupId = new URL(req.url).searchParams.get("groupId");
  const groupName = groupId && isSeededGroup(groupId) ? SEEDS[groupId].group.name : "GMT24 case";
  return NextResponse.json({
    gateway: `${base}/api/agi`,
    mcp: `${base}/api/agi/mcp`,
    plugin: `${base}/api/agi/plugin`,
    scopes: ALL_AGENT_SCOPES.map((s) => ({ id: s, label: SCOPE_LABEL[s] })),
    instructions: missionInstructions(base, groupName),
    clients: Object.values(AGENT_CLIENTS).map((c) => ({
      ...c,
      recipe: c.id === "grok-bot"
        ? [`In Grok Bot, add a connector with MCP URL ${base}/api/agi/mcp.`, "Set the Authorization header to `Bearer <gateway key>`.", "Paste the mission instructions into the bot's instruction field.", "Run the connection test below, then ask the bot to start the release-1 mission."]
        : c.id === "claude-cowork"
          ? [`In Claude, open Settings › Connectors › Add custom connector and enter ${base}/api/agi/mcp as the remote MCP URL.`, "Choose header authentication and paste `Bearer <gateway key>`.", "In Cowork, attach the connector to the project and paste the workflow instructions.", "Run the connection test below; Claude then proposes and GMT24 records decisions."]
          : [`In GPT Work, install the GMT24 plugin from ${base}/api/agi/plugin (it declares the MCP connection and instructions).`, "Authenticate with the gateway key when prompted.", "Confirm the tool list shows the 11 GMT24 tools.", "Run the connection test below; structured results and approval handoff are verified."],
    })),
  });
}

const Mint = z.object({
  client: z.enum(["grok-bot", "claude-cowork", "gpt-work"]),
  groupId: z.string().min(1),
  scopes: z.array(z.string()).max(10).optional(),
  days: z.number().int().min(1).max(90).optional(),
  label: z.string().max(80).optional(),
});

/** Issue a scoped gateway key. Only a person in the workspace can issue keys; agents cannot mint access for themselves. */
export async function POST(req: Request) {
  const rl = rateLimit(`agi-mint:${clientKey(req)}`, 30, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited", detail: `Try again in ${Math.ceil(rl.retryAfterS / 60)} minutes.` }, { status: 429 });
  let body: z.infer<typeof Mint>;
  try { body = Mint.parse(await req.json()); } catch { return NextResponse.json({ error: "bad_request", detail: "client, groupId, scopes[], days, label" }, { status: 400 }); }
  if (!isSeededGroup(body.groupId)) return NextResponse.json({ error: "bad_request", detail: "Unknown group" }, { status: 400 });
  const p = await principalFrom(req, body.groupId);
  if (isFailure(p)) return failure(p);
  const ws = requireWorkspace(p, "Issuing gateway keys");
  if (ws) return failure(ws);
  const adminPin = process.env.GMT24_AGENT_ADMIN_PIN;
  if (adminPin && req.headers.get("x-gmt24-admin-pin") !== adminPin) return NextResponse.json({ error: "pin_required", detail: "Gateway key issue is protected by the agent admin PIN on this deployment." }, { status: 403 });
  const scopes = (body.scopes ?? ["case:read", "mission:write", "scenario:run", "change:propose", "approval:request", "pack:build"]).filter((s) => (ALL_AGENT_SCOPES as string[]).includes(s));
  const { key, grant } = await mintAgentKey({ client: body.client, groupId: body.groupId, scopes: scopes as typeof ALL_AGENT_SCOPES, days: body.days, label: body.label });
  await record(p, { action: "connections.issue", ok: true, detail: `${body.client} · ${grant.scopes.join(",")} · until ${new Date(grant.exp).toISOString()}` });
  return NextResponse.json({ key, grant, mcp: `${baseUrl(req)}/api/agi/mcp`, instructions: missionInstructions(baseUrl(req), SEEDS[body.groupId].group.name) });
}

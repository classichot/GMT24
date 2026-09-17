import { NextResponse } from "next/server";
import { missionInstructions } from "@/lib/agi/gateway";
import { TOOL_CATALOGUE } from "@/lib/agi/tools";
import { baseUrl } from "@/lib/server/agiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GPT Work plugin manifest: an MCP connection plus mission instructions.
 * The same manifest doubles as a machine-readable description for any client.
 */
export async function GET(req: Request) {
  const base = baseUrl(req);
  return NextResponse.json({
    schema_version: "v1",
    name_for_human: "GMT24 AGI Mode",
    name_for_model: "gmt24_agi",
    description_for_human: "Run a Pillar Two mission in GMT24: compare eligible elections, verify calculations and compliance, prepare the audit package.",
    description_for_model: "Mission-execution gateway for GMT24 (Pillar Two / GloBE). Use the tools in order and never compute tax yourself; every number must come from GMT24's engine. Propose changes; never approve them. A mission is complete only when GMT24's checks pass.",
    auth: { type: "bearer", instructions: "Paste the gateway key issued in GMT24 › AGI Mode › Agent Connections." },
    mcp: { url: `${base}/api/agi/mcp`, transport: "streamable-http", protocolVersion: "2025-03-26" },
    api: { type: "openapi-lite", discovery: `${base}/api/agi`, tools: TOOL_CATALOGUE.map((t) => ({ name: t.name, endpoint: `${base}/api/agi/tools/${t.name}`, method: "POST", scope: t.scope, inputSchema: t.inputSchema })) },
    instructions: missionInstructions(base, "the connected GMT24 case"),
    contact_email: "hello@7l-advisory.example",
    legal_info_url: `${base}/agi/connections`,
  });
}

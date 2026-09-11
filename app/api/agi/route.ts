import { NextResponse } from "next/server";
import { TOOL_CATALOGUE } from "@/lib/agi/tools";
import { AGENT_CLIENTS, MISSION_STATE_LABEL } from "@/lib/agi/types";
import { AGI_ENGINE } from "@/lib/agi/case";
import { baseUrl } from "@/lib/server/agiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Gateway discovery: what the Agent Gateway offers and where. Public, read-only. */
export async function GET(req: Request) {
  const base = baseUrl(req);
  return NextResponse.json({
    name: "GMT24 Agent Gateway",
    layer: "AGI Mode — mission-execution layer above the normal GMT24 platform",
    engine: AGI_ENGINE,
    release: "review-case-r1",
    mission: "Review this GMT24 case, compare eligible elections, verify the calculations and compliance process, and prepare the audit package.",
    endpoints: {
      mcp: `${base}/api/agi/mcp`,
      tools: `${base}/api/agi/tools/{name}`,
      missions: `${base}/api/agi/missions`,
      jobs: `${base}/api/agi/jobs/{id}`,
      plugin: `${base}/api/agi/plugin`,
      connectionTest: `${base}/api/agi/connections/test`,
    },
    auth: "Authorization: Bearer <gateway key issued in GMT24 › AGI Mode › Agent Connections>",
    clients: Object.values(AGENT_CLIENTS).map((c) => ({ id: c.id, name: c.name, transport: c.transport, integration: c.integration })),
    tools: TOOL_CATALOGUE.map((t) => ({ name: t.name, description: t.description, scope: t.scope, longRunning: t.longRunning, inputSchema: t.inputSchema })),
    missionStates: MISSION_STATE_LABEL,
    controls: [
      "Numbers come only from GMT24's tested engines.",
      "Every figure cites a calculation id, source refs and rule versions.",
      "Domestic law and OECD rules are identified separately with effective dates.",
      "Missing information stays unresolved; agents never estimate.",
      "Agents propose; people approve. Changed inputs void prior approvals.",
      "Completion depends on passed checks and evidence, not on an agent's declaration.",
    ],
  });
}

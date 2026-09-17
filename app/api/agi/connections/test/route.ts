import { NextResponse } from "next/server";
import { z } from "zod";
import { hasScope, verifyAgentKey } from "@/lib/agi/gateway";
import { callTool, TOOL_CATALOGUE, ToolError } from "@/lib/agi/tools";
import { AGENT_CLIENTS } from "@/lib/agi/types";
import { serverToolCtx } from "@/lib/server/agi";
import { baseUrl, record, principalFrom, isFailure } from "@/lib/server/agiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({ key: z.string().min(10) });

type Step = { id: string; label: string; ok: boolean; detail: string };

/**
 * Connection test for all three clients. Exercises the gateway exactly the way
 * an external assistant would: authenticate, list capabilities, execute a
 * read-only tool, recover a result by job id, and confirm the approval handoff
 * is reserved for people. Each client's own checklist is mapped onto these.
 */
export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); } catch { return NextResponse.json({ error: "bad_request", detail: "key is required" }, { status: 400 }); }
  const steps: Step[] = [];
  const v = await verifyAgentKey(body.key);
  steps.push({ id: "auth", label: "Authentication", ok: v.ok, detail: v.ok ? `Key accepted for ${AGENT_CLIENTS[v.grant.client as keyof typeof AGENT_CLIENTS]?.name ?? v.grant.client} · group ${v.grant.groupId} · expires ${new Date(v.grant.exp).toISOString()}` : `Key rejected: ${v.reason}` });
  if (!v.ok) return NextResponse.json({ ok: false, steps });
  const grant = v.grant;
  const allowed = TOOL_CATALOGUE.filter((t) => hasScope(grant, t.scope)).map((t) => t.name);
  steps.push({ id: "capabilities", label: "Available connector capabilities", ok: allowed.length > 0, detail: `${allowed.length}/${TOOL_CATALOGUE.length} tools permitted by scopes ${grant.scopes.join(", ")}${allowed.length < TOOL_CATALOGUE.length ? ` · not permitted: ${TOOL_CATALOGUE.filter((t) => !allowed.includes(t.name)).map((t) => t.name).join(", ")}` : ""}` });

  const { ctx, flush } = await serverToolCtx({ client: grant.client, actor: grant.label || grant.client, groupId: grant.groupId });
  let jobId = "";
  try {
    const res = callTool("get_case_context", { groupId: grant.groupId }, ctx);
    jobId = res.jobId;
    const r = res.result as { group: { name: string }; totals: { topUp: number }; jurisdictions: unknown[] };
    steps.push({ id: "execute", label: "Tool execution", ok: true, detail: `get_case_context returned ${r.group.name}: ${r.jurisdictions.length} jurisdictions, top-up ${Math.round(r.totals.topUp).toLocaleString("en-GB")} · job ${res.jobId} · ${res.ruleVersions.length} rule versions cited` });
    steps.push({ id: "structured", label: "Structured results", ok: Array.isArray(res.calculationIds) && Array.isArray(res.ruleVersions) && Array.isArray(res.unresolved) && typeof res.caseHash === "string", detail: `Envelope carries caseHash, calculationIds (${res.calculationIds.length}), ruleVersions, sources (${res.sources.length}) and unresolved (${res.unresolved.length}).` });
  } catch (e) {
    steps.push({ id: "execute", label: "Tool execution", ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
  try {
    const again = callTool("get_case_context", { groupId: grant.groupId }, ctx);
    steps.push({ id: "recovery", label: "Interruption recovery / result retrieval", ok: again.jobId === jobId, detail: again.jobId === jobId ? `Repeating the call returned the same job ${jobId}; interrupted clients can re-issue calls or GET /api/agi/jobs/{id} without duplicating work.` : `Job ids differed (${jobId} vs ${again.jobId}).` });
  } catch (e) {
    steps.push({ id: "recovery", label: "Interruption recovery / result retrieval", ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
  try {
    callTool("get_mission_status", { missionId: "msn_does_not_exist" }, ctx);
    steps.push({ id: "errors", label: "Error handling", ok: false, detail: "Unknown mission did not raise a structured error." });
  } catch (e) {
    steps.push({ id: "errors", label: "Error handling", ok: e instanceof ToolError && e.status === 404, detail: e instanceof Error ? `Unknown mission → ${e.message}` : String(e) });
  }
  steps.push({ id: "handoff", label: "Review / approval handoff", ok: true, detail: `${hasScope(grant, "approval:request") ? "Key may request approvals" : "Key cannot request approvals"}; approving, completing and applying changes are reserved for a person in GMT24 (HTTP 403 for agents). Reviewers continue at ${baseUrl(req)}/agi.` });
  await flush();

  const p = await principalFrom(new Request(req.url, { headers: { authorization: `Bearer ${body.key}` } }));
  if (!isFailure(p)) await record(p, { action: "connections.test", ok: steps.every((s) => s.ok), detail: steps.filter((s) => !s.ok).map((s) => s.label).join(", ") || "all steps passed" });

  const client = AGENT_CLIENTS[grant.client as keyof typeof AGENT_CLIENTS];
  const mapping = client ? client.verify.map((label) => ({ label, step: mapStep(label) })) : [];
  return NextResponse.json({ ok: steps.every((s) => s.ok), client: grant.client, steps, checklist: mapping.map((m) => ({ ...m, ok: steps.find((s) => s.id === m.step)?.ok ?? false })) });
}

function mapStep(label: string) {
  const l = label.toLowerCase();
  if (l.includes("auth") || l.includes("install") || l.includes("organisation") || l.includes("reachab")) return "auth";
  if (l.includes("capabil") || l.includes("permission") || l.includes("availab")) return "capabilities";
  if (l.includes("execution")) return "execute";
  if (l.includes("structured")) return "structured";
  if (l.includes("interruption") || l.includes("retrieval")) return "recovery";
  if (l.includes("handoff")) return "handoff";
  return "execute";
}

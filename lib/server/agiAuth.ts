import "server-only";

import { NextResponse } from "next/server";
import { hasScope, verifyAgentKey } from "@/lib/agi/gateway";
import { toolByName } from "@/lib/agi/tools";
import type { AgentClientId, AgentGrant, AgentScope, ToolName } from "@/lib/agi/types";
import { isSeededGroup } from "@/lib/seeds";
import { logActivity } from "./agi";

/**
 * Who is calling the gateway.
 *  - External assistants present a scoped Bearer key (client, group, scopes).
 *  - The AGI workspace inside GMT24 calls with `x-gmt24-client: workspace`
 *    and a tenant (group id), following the platform's tenant-scoped record
 *    routes. Only the workspace principal can approve, complete or hand off.
 */
export type Principal =
  | { kind: "agent"; client: Exclude<AgentClientId, "workspace">; actor: string; groupId: string; grant: AgentGrant }
  | { kind: "workspace"; client: "workspace"; actor: string; groupId: string };

export type AuthFailure = { error: string; detail: string; status: number };

export async function principalFrom(req: Request, groupHint?: string | null): Promise<Principal | AuthFailure> {
  const auth = req.headers.get("authorization");
  if (auth) {
    const v = await verifyAgentKey(auth);
    if (!v.ok) return { error: `key_${v.reason}`, detail: v.reason === "missing" ? "Provide a gateway key as a Bearer token." : v.reason === "expired" ? "The gateway key has expired; issue a new one in Agent Connections." : v.reason === "revoked" ? "The gateway key epoch was rotated; issue a new key." : "The gateway key is invalid.", status: 401 };
    if (groupHint && groupHint !== v.grant.groupId) return { error: "group_forbidden", detail: `Key is limited to group ${v.grant.groupId}.`, status: 403 };
    if (v.grant.client === "workspace") return { error: "key_invalid", detail: "Gateway keys are issued to external assistants, not the workspace.", status: 401 };
    return { kind: "agent", client: v.grant.client, actor: v.grant.label || v.grant.client, groupId: v.grant.groupId, grant: v.grant };
  }
  const client = req.headers.get("x-gmt24-client");
  if (client === "workspace") {
    const groupId = groupHint ?? req.headers.get("x-gmt24-tenant");
    if (!groupId || !isSeededGroup(groupId)) return { error: "bad_tenant", detail: "Workspace calls need a known tenant (group id).", status: 400 };
    return { kind: "workspace", client: "workspace", actor: req.headers.get("x-gmt24-actor") || "Workspace user", groupId };
  }
  return { error: "unauthorised", detail: "Present a gateway key (Bearer) or call from the GMT24 workspace.", status: 401 };
}

export function isFailure(p: Principal | AuthFailure): p is AuthFailure {
  return "error" in p;
}

export function failure(f: AuthFailure) {
  return NextResponse.json({ error: f.error, detail: f.detail }, { status: f.status });
}

export function scopeFor(tool: ToolName): AgentScope {
  return toolByName(tool)?.scope ?? "case:read";
}

export function allowTool(p: Principal, tool: ToolName): AuthFailure | null {
  if (p.kind === "workspace") return null;
  const scope = scopeFor(tool);
  if (!hasScope(p.grant, scope)) return { error: "scope_forbidden", detail: `Tool ${tool} needs scope ${scope}; the key carries ${p.grant.scopes.join(", ")}.`, status: 403 };
  return null;
}

export function requireWorkspace(p: Principal, what: string): AuthFailure | null {
  if (p.kind === "workspace") return null;
  return { error: "person_required", detail: `${what} is reserved for a person in GMT24. Agents prepare; GMT24 enforces approval permissions.`, status: 403 };
}

export async function record(p: Principal, e: { tool?: ToolName; missionId?: string; action: string; ok: boolean; detail: string }) {
  try {
    await logActivity({ groupId: p.groupId, client: p.client, actor: p.actor, ...e });
  } catch {
    /* activity log is best effort */
  }
}

export function baseUrl(req: Request) {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

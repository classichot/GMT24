/**
 * Agent Gateway keys. A key is a self-verifying, scoped grant: client, group,
 * scopes, expiry and epoch, signed with HMAC-SHA256 under GMT24_AGENT_SECRET.
 * Rotating AGENT_KEY_EPOCH (or the secret) revokes every outstanding key.
 * Approval scopes never exist — agents prepare, people approve.
 */
import { ALL_AGENT_SCOPES, type AgentClientId, type AgentGrant, type AgentScope } from "./types";

export const AGENT_KEY_EPOCH = 1;
export const AGENT_KEY_PREFIX = "gmt24_agi";
export const DEFAULT_KEY_DAYS = 30;
export const MAX_KEY_DAYS = 90;

function secret() {
  return process.env.GMT24_AGENT_SECRET ?? "gmt24-agent-gateway-dev-secret-change-me";
}

function b64url(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlStr(s: string) {
  return b64url(new TextEncoder().encode(s));
}
function unb64url(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmac(message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return b64url(new Uint8Array(sig));
}

export function clampKeyDays(n: unknown) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return DEFAULT_KEY_DAYS;
  return Math.min(MAX_KEY_DAYS, Math.max(1, Math.round(v)));
}

export function normaliseScopes(scopes: unknown): AgentScope[] {
  if (!Array.isArray(scopes)) return ["case:read"];
  const out = scopes.filter((s): s is AgentScope => (ALL_AGENT_SCOPES as string[]).includes(String(s)));
  return out.length ? [...new Set(out)] : ["case:read"];
}

export async function mintAgentKey(i: { client: Exclude<AgentClientId, "workspace">; groupId: string; scopes: AgentScope[]; days?: number; label?: string }) {
  const now = Date.now();
  const grant: AgentGrant = {
    client: i.client,
    groupId: i.groupId,
    scopes: normaliseScopes(i.scopes),
    issuedAt: now,
    exp: now + clampKeyDays(i.days) * 86_400_000,
    epoch: AGENT_KEY_EPOCH,
    label: String(i.label ?? "").slice(0, 80),
  };
  const body = b64urlStr(JSON.stringify(grant));
  const key = `${AGENT_KEY_PREFIX}.${body}.${await hmac(body)}`;
  return { key, grant };
}

export type VerifiedKey = { ok: true; grant: AgentGrant } | { ok: false; reason: "missing" | "invalid" | "expired" | "revoked" };

export async function verifyAgentKey(raw: string | null | undefined): Promise<VerifiedKey> {
  const token = String(raw ?? "").trim().replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, reason: "missing" };
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== AGENT_KEY_PREFIX) return { ok: false, reason: "invalid" };
  const [, body, sig] = parts;
  if ((await hmac(body)) !== sig) return { ok: false, reason: "invalid" };
  let grant: AgentGrant;
  try { grant = JSON.parse(unb64url(body)) as AgentGrant; } catch { return { ok: false, reason: "invalid" }; }
  if (grant.epoch !== AGENT_KEY_EPOCH) return { ok: false, reason: "revoked" };
  if (Date.now() >= grant.exp) return { ok: false, reason: "expired" };
  return { ok: true, grant: { ...grant, scopes: normaliseScopes(grant.scopes) } };
}

export function hasScope(grant: AgentGrant, scope: AgentScope) {
  return grant.scopes.includes(scope);
}

export const SCOPE_LABEL: Record<AgentScope, string> = {
  "case:read": "Read case, context and mission status",
  "mission:write": "Create missions and run steps",
  "scenario:run": "Run scenarios, verification and compliance review",
  "change:propose": "Propose changes (drafts only)",
  "approval:request": "Ask a person for a decision",
  "pack:build": "Build audit packages",
};

/** Instructions handed to an external assistant alongside its key. Same text for every client; the connection method differs. */
export function missionInstructions(baseUrl: string, groupName: string) {
  return [
    `You are connected to GMT24 (${groupName}) through the Agent Gateway at ${baseUrl}/api/agi.`,
    "Your mission: review the GMT24 case, compare eligible elections, verify the calculations and compliance process, and prepare the audit package.",
    "Order of work: get_case_context → create_mission → check_data_readiness → assess_election_options → request_approval (election-package) → wait for a person to decide in GMT24 → run_scenario → verify_calculation → review_compliance → build_audit_pack → get_mission_status.",
    "Rules you cannot override: every number comes from GMT24's engine (never compute tax yourself); missing information stays unresolved (never estimate); you may propose changes but never approve them; a mission completes only when GMT24's checks pass; OECD and domestic rules are cited separately; audit readiness never guarantees an auditor's conclusion.",
    "Calls are idempotent per case version: repeating a call returns the recorded result and never duplicates a change. If a response reports the case changed, call get_mission_status and continue from the reopened step.",
    "Report to the user with the mission id, state, calculation ids, unresolved items and the GMT24 URL for review.",
  ].join("\n");
}

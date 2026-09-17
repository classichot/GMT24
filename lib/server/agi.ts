import "server-only";

/**
 * Server persistence for AGI mode. Missions live under `agi:mission:<id>`,
 * the per-group index under `agi:missions:<group>`, the pinned live case under
 * `agi:case:<group>`, and the activity log under `agi:activity:<group>`.
 * Same adapter as the rest of GMT24 (memory | file | kv).
 */
import { serverStore } from "./store";
import { seedDefaultSnapshot, buildSnapshot } from "@/lib/agi/case";
import type { ToolCtx } from "@/lib/agi/tools";
import type { ActivityEvent, AgentClientId, CaseSnapshot, MissionRecord } from "@/lib/agi/types";

const g = globalThis as unknown as { __gmt24Agi?: { missions: Map<string, MissionRecord>; index: Map<string, string[]>; cases: Map<string, CaseSnapshot> } };
const mem = g.__gmt24Agi ?? (g.__gmt24Agi = { missions: new Map(), index: new Map(), cases: new Map() });

const K = {
  mission: (id: string) => `agi:mission:${id}`,
  index: (groupId: string) => `agi:missions:${groupId}`,
  kase: (groupId: string) => `agi:case:${groupId}`,
  activity: (groupId: string) => `agi:activity:${groupId}`,
};

export async function loadMission(id: string): Promise<MissionRecord | null> {
  const hit = mem.missions.get(id);
  if (hit) return hit;
  const stored = await serverStore.get<MissionRecord>(K.mission(id));
  if (stored) mem.missions.set(id, stored);
  return stored;
}

export async function saveMission(m: MissionRecord) {
  mem.missions.set(m.id, m);
  const idx = await loadIndex(m.scope.groupId);
  if (!idx.includes(m.id)) {
    const next = [m.id, ...idx].slice(0, 200);
    mem.index.set(m.scope.groupId, next);
    await serverStore.set(K.index(m.scope.groupId), { ids: next });
  }
  await serverStore.set(K.mission(m.id), m);
}

async function loadIndex(groupId: string): Promise<string[]> {
  const hit = mem.index.get(groupId);
  if (hit) return hit;
  const stored = await serverStore.get<{ ids: string[] }>(K.index(groupId));
  const ids = stored?.ids ?? [];
  mem.index.set(groupId, ids);
  return ids;
}

export async function listMissions(groupId: string): Promise<MissionRecord[]> {
  const ids = await loadIndex(groupId);
  const out: MissionRecord[] = [];
  for (const id of ids) { const m = await loadMission(id); if (m) out.push(m); }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** The workspace pins its live case here so external agents work on the same version the user sees. */
export async function pinCase(snapshot: CaseSnapshot) {
  const s = buildSnapshot({ ...snapshot, origin: snapshot.origin ?? "workspace" });
  mem.cases.set(s.groupId, s);
  await serverStore.set(K.kase(s.groupId), s);
  return s;
}

export async function loadCase(groupId: string): Promise<CaseSnapshot> {
  const hit = mem.cases.get(groupId);
  if (hit) return hit;
  const stored = await serverStore.get<CaseSnapshot>(K.kase(groupId));
  if (stored) { mem.cases.set(groupId, stored); return stored; }
  return seedDefaultSnapshot(groupId);
}

export async function logActivity(e: Omit<ActivityEvent, "id" | "at"> & { groupId: string }) {
  const ev: ActivityEvent = { ...e, id: `act_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString() };
  await serverStore.append(K.activity(e.groupId), ev, 500);
  return ev;
}

export async function listActivity(groupId: string, limit = 100) {
  return serverStore.list<ActivityEvent>(K.activity(groupId), limit);
}

/**
 * Build a synchronous ToolCtx over a preloaded working set. Tools are pure and
 * synchronous; the route preloads the missions it needs and flushes writes after.
 */
export async function serverToolCtx(i: { client: AgentClientId; actor: string; groupId: string; missionIds?: string[] }): Promise<{ ctx: ToolCtx; flush: () => Promise<void> }> {
  const missions = new Map<string, MissionRecord>();
  for (const m of await listMissions(i.groupId)) missions.set(m.id, m);
  for (const id of i.missionIds ?? []) { if (!missions.has(id)) { const m = await loadMission(id); if (m) missions.set(id, m); } }
  const snapshot = await loadCase(i.groupId);
  const dirty = new Set<string>();
  const ctx: ToolCtx = {
    client: i.client,
    actor: i.actor,
    grantGroupId: i.groupId,
    snapshotFor: (groupId) => (groupId === i.groupId ? snapshot : seedDefaultSnapshot(groupId)),
    getMission: (id) => missions.get(id) ?? null,
    saveMission: (m) => { missions.set(m.id, m); dirty.add(m.id); },
    listMissions: (groupId) => [...missions.values()].filter((m) => m.scope.groupId === groupId),
  };
  return { ctx, flush: async () => { for (const id of dirty) await saveMission(missions.get(id)!); dirty.clear(); } };
}

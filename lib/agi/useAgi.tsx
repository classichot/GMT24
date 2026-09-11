"use client";

/**
 * AGI workspace state. Runs the same tool catalogue the gateway exposes, but
 * inside the browser against the case the workspace currently shows, and
 * mirrors every mission record to the gateway so an external assistant can
 * continue the same mission id. Nothing here touches normal-mode state
 * except `applyApproved`, which writes approved proposals through the
 * store's own setters (with history) — the only bridge from AGI to normal.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ADVISOR_USER, DATA } from "../model";
import { labelElection } from "../evidenceHistory";
import { useStore } from "../store";
import { buildSnapshot, caseHash } from "./case";
import { advanceMission, applicableChanges, recordDecision, type AdvanceResult } from "./executor";
import { cancel as cancelMission, complete as completeMission, handoff as handoffMission, markApplied, pause as pauseMission, rebase, resume as resumeMission, setObjectives as setMissionObjectives, touch, type CompletionGate, completionGate } from "./mission";
import { callTool, ToolError, type ToolCtx } from "./tools";
import type { AgentClientId, CaseSnapshot, MissionObjectives, MissionRecord, ToolName, ToolResult } from "./types";
import type { SbieMode } from "../electionEngine";

const KEY = (groupId: string) => `gmt24_agi_${groupId}`;
const SEL = (groupId: string) => `gmt24_agi_sel_${groupId}`;

export type AgiApi = {
  ready: boolean;
  groupId: string;
  actor: string;
  /** Case as the workspace shows it right now. */
  live: CaseSnapshot;
  liveHash: string;
  missions: MissionRecord[];
  selected: MissionRecord | null;
  select: (id: string | null) => void;
  busy: string | null;
  lastError: string | null;
  clearError: () => void;
  createMission: (i: { objective?: string; jurisdictions?: string[]; objectives?: Partial<MissionObjectives> }) => MissionRecord | null;
  run: (id: string, maxSteps?: number) => AdvanceResult | null;
  tool: <T = unknown>(name: ToolName, args: Record<string, unknown>) => ToolResult<T> | null;
  pause: (id: string) => void;
  resume: (id: string) => void;
  cancel: (id: string, reason: string) => void;
  decide: (id: string, decisionId: string, verdict: "approved" | "rejected", chosen?: string, note?: string) => boolean;
  complete: (id: string, note?: string) => boolean;
  handoff: (id: string, to: AgentClientId, note: string) => void;
  recheck: (id: string) => string[] | null;
  setObjectives: (id: string, objectives: MissionObjectives) => void;
  /** Write approved election / SBIE proposals into normal mode with history. */
  applyApproved: (id: string) => number;
  gate: (m: MissionRecord) => CompletionGate;
  /** Does the mission's pinned case differ from the live case? */
  drifted: (m: MissionRecord) => boolean;
  remove: (id: string) => void;
  sync: () => Promise<void>;
  syncState: "idle" | "syncing" | "ok" | "offline";
  headers: () => Record<string, string>;
};

const Ctx = createContext<AgiApi | null>(null);

function load(groupId: string): MissionRecord[] {
  try {
    const raw = localStorage.getItem(KEY(groupId));
    const arr = raw ? (JSON.parse(raw) as MissionRecord[]) : [];
    return Array.isArray(arr) ? arr.filter((m) => m && m.id && Array.isArray(m.steps)) : [];
  } catch {
    return [];
  }
}

function persist(groupId: string, missions: MissionRecord[]) {
  try { localStorage.setItem(KEY(groupId), JSON.stringify(missions)); } catch { /* quota / private mode */ }
}

export function AgiProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const { groupId, mode, activeFy, electionsOn, approvedMaps, sbieClaim, scenario, yearRecords, packOverlay, ingestStatus, xray, flash, setElection, setSbieClaim, appendHistory } = store;
  const actor = mode === "advisor" ? ADVISOR_USER.name : DATA.inhouseUser.name;

  const live = useMemo(
    () => buildSnapshot({ groupId, fy: activeFy, electionsOn, approvedMaps, sbieClaim, scenario, yearRecords, packOverlay, ingestStatus, origin: "workspace" }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groupId, activeFy, JSON.stringify(electionsOn), JSON.stringify(approvedMaps), JSON.stringify(sbieClaim), JSON.stringify(scenario), yearRecords, packOverlay, ingestStatus],
  );
  const liveHash = useMemo(() => caseHash(live), [live]);

  const [missions, setMissions] = useState<MissionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<AgiApi["syncState"]>("idle");
  const map = useRef(new Map<string, MissionRecord>());
  const dirty = useRef(new Set<string>());

  const headers = useCallback((): Record<string, string> => ({ "content-type": "application/json", "x-gmt24-client": "workspace", "x-gmt24-tenant": groupId, "x-gmt24-actor": actor }), [groupId, actor]);

  const commit = useCallback(() => {
    const list = [...map.current.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    setMissions(list);
    persist(groupId, list);
  }, [groupId]);

  // Load per group.
  useEffect(() => {
    const list = load(groupId);
    map.current = new Map(list.map((m) => [m.id, m]));
    setMissions([...list].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)));
    try { setSelectedId(localStorage.getItem(SEL(groupId)) || list[0]?.id || null); } catch { setSelectedId(list[0]?.id ?? null); }
    setReady(true);
  }, [groupId]);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    try { if (id) localStorage.setItem(SEL(groupId), id); else localStorage.removeItem(SEL(groupId)); } catch { /* ignore */ }
  }, [groupId]);

  /* ---- gateway mirror ---- */
  const pushDirty = useCallback(async () => {
    const ids = [...dirty.current];
    dirty.current.clear();
    for (const id of ids) {
      const m = map.current.get(id);
      if (!m) continue;
      try {
        const r = await fetch("/api/agi/missions", { method: "PUT", headers: headers(), body: JSON.stringify(m) });
        if (r.ok) {
          const j = (await r.json()) as { kept: "server" | "client"; mission?: MissionRecord };
          if (j.kept === "server" && j.mission) { map.current.set(id, j.mission); }
        }
      } catch { /* offline: local copy stays authoritative until next sync */ }
    }
  }, [headers]);

  const sync = useCallback(async () => {
    setSyncState("syncing");
    try {
      await fetch("/api/agi/case", { method: "PUT", headers: headers(), body: JSON.stringify(live) });
      await pushDirty();
      const r = await fetch(`/api/agi/missions?full=1&groupId=${encodeURIComponent(groupId)}`, { headers: headers() });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { missions: MissionRecord[] };
      let changed = false;
      for (const remote of j.missions ?? []) {
        const local = map.current.get(remote.id);
        if (!local || remote.updatedAt > local.updatedAt) { map.current.set(remote.id, remote); changed = true; }
      }
      if (changed) commit();
      setSyncState("ok");
    } catch {
      setSyncState("offline");
    }
  }, [headers, live, pushDirty, groupId, commit]);

  useEffect(() => {
    if (!ready) return;
    void sync();
    const t = setInterval(() => { void sync(); }, 20_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, liveHash, groupId]);

  /* ---- tool context ---- */
  const ctx = useMemo<ToolCtx>(() => ({
    client: "workspace",
    actor,
    snapshotFor: () => live,
    getMission: (id) => map.current.get(id) ?? null,
    saveMission: (m) => { map.current.set(m.id, m); dirty.current.add(m.id); },
    listMissions: (g) => [...map.current.values()].filter((m) => m.scope.groupId === g),
    xray,
  }), [actor, live, xray]);

  const guarded = useCallback(<T,>(label: string, fn: () => T): T | null => {
    setBusy(label);
    setLastError(null);
    try {
      const r = fn();
      commit();
      void pushDirty();
      return r;
    } catch (e) {
      const msg = e instanceof ToolError || e instanceof Error ? e.message : String(e);
      setLastError(msg);
      commit();
      return null;
    } finally {
      setBusy(null);
    }
  }, [commit, pushDirty]);

  const save = useCallback((m: MissionRecord) => { map.current.set(m.id, m); dirty.current.add(m.id); }, []);
  const get = useCallback((id: string) => { const m = map.current.get(id); if (!m) throw new Error("Mission not found"); return m; }, []);

  const api: AgiApi = {
    ready,
    groupId,
    actor,
    live,
    liveHash,
    missions,
    selected: (selectedId && missions.find((m) => m.id === selectedId)) || null,
    select,
    busy,
    lastError,
    clearError: () => setLastError(null),
    headers,
    sync,
    syncState,
    gate: completionGate,
    drifted: (m) => m.case.hash !== liveHash,
    createMission: (i) => guarded("create_mission", () => {
      const res = callTool("create_mission", { groupId, ...i }, ctx);
      const m = res.missionId ? map.current.get(res.missionId) ?? null : null;
      if (m) select(m.id);
      if (res.unresolved.length) flash(res.unresolved[0]);
      return m;
    }),
    run: (id, maxSteps = 8) => guarded("run", () => {
      const r = advanceMission(id, ctx, maxSteps);
      flash(r.stoppedBecause);
      return r;
    }),
    tool: <T,>(name: ToolName, args: Record<string, unknown>) => guarded(name, () => callTool(name, args, ctx) as ToolResult<T>),
    pause: (id) => { guarded("pause", () => save(pauseMission(touch(get(id), "workspace", actor), actor))); },
    resume: (id) => { guarded("resume", () => save(resumeMission(touch(get(id), "workspace", actor), actor))); },
    cancel: (id, reason) => { guarded("cancel", () => save(cancelMission(touch(get(id), "workspace", actor), actor, reason))); },
    decide: (id, decisionId, verdict, chosen, note) => guarded("decide", () => { save(recordDecision(touch(get(id), "workspace", actor), decisionId, verdict, actor, chosen, note)); return true; }) ?? false,
    complete: (id, note) => guarded("complete", () => { save(completeMission(touch(get(id), "workspace", actor), actor, note)); flash("Mission completed — package approved"); return true; }) ?? false,
    handoff: (id, to, note) => { guarded("handoff", () => { save(handoffMission(get(id), to, actor, note)); flash(`Mission handed to ${to}`); }); },
    recheck: (id) => guarded("recheck", () => {
      const r = rebase(touch(get(id), "workspace", actor), live, actor);
      save(r.mission);
      flash(r.changes.length ? `Case changed: ${r.changes.length} difference(s) — approvals reset` : "No change since the mission's case version");
      return r.changes;
    }),
    setObjectives: (id, objectives) => { guarded("objectives", () => save(setMissionObjectives(touch(get(id), "workspace", actor), objectives, actor))); },
    applyApproved: (id) => guarded("apply", () => {
      const m = get(id);
      const { proposals } = applicableChanges(m);
      const ids: string[] = [];
      for (const p of proposals) {
        if (p.kind === "election" && typeof p.value === "boolean") {
          const err = setElection(p.target, p.value);
          if (err) { flash(err); continue; }
          ids.push(p.id);
        } else if (p.kind === "sbie" && typeof p.value === "string") {
          setSbieClaim(p.target, p.value as SbieMode);
          ids.push(p.id);
        }
      }
      if (ids.length) {
        appendHistory({ kind: "change", title: `AGI mission ${m.id}: ${ids.length} approved change${ids.length === 1 ? "" : "s"} applied`, detail: proposals.filter((p) => ids.includes(p.id)).map((p) => `${p.kind === "election" ? labelElection(p.target) : `SBIE ${p.target}`} → ${String(p.value)}`).join("; "), actor, href: "/agi", ref: m.id, fy: m.scope.fy });
        save(markApplied(m, ids, actor));
        flash(`${ids.length} change(s) applied in normal mode with history`);
      } else flash("No approved changes to apply");
      return ids.length;
    }) ?? 0,
    remove: (id) => { map.current.delete(id); commit(); },
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAgi() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAgi must be used inside AgiProvider");
  return v;
}

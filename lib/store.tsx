"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { THEMES, normalizeTheme, type ThemeKey } from "./format";
import { ADVISOR_USER, GROUPS, INHOUSE_USER, type Group, type ProductMode } from "./model";
import type { AuditNode } from "./engine";
import {
  ENGAGEMENT_KEY,
  draftToGroup,
  nameTaken,
  parseStoredGroups,
  setExtraGroups as registerExtras,
  type EngagementDraft,
} from "./onboard";
import type { Restate, SbieMode } from "./electionEngine";
import { clearInviteSession } from "./invite";
import {
  buildTracks,
  carryForwardElections,
  electionConstraint,
  lastLocked,
  loadGroupLedger,
  lockedFor,
  makeYearRecord,
  nextFy,
  storageKeys,
  type YearRecord,
} from "./yearLedger";
import {
  appendEvent,
  deleteEvent,
  labelElection,
  loadLedger,
  resetLedger,
  saveLedger,
  sessionLabel,
  setImmutable,
  verifyChain,
  type HistoryDraft,
  type HistoryEvent,
  type HistoryLedger,
} from "./evidenceHistory";

type Store = {
  ready: boolean;
  authed: boolean;
  login: (mode: ProductMode, opts?: { invite?: boolean }) => void;
  logout: () => void;
  theme: ThemeKey;
  setTheme: (k: ThemeKey) => void;
  themeVars: Record<string, string>;
  mode: ProductMode;
  setMode: (m: ProductMode) => void;
  groupId: string;
  setGroupId: (id: string) => void;
  groups: Group[];
  group: Group;
  addEngagement: (draft: EngagementDraft) => string | null;
  toast: string | null;
  flash: (m: string) => void;
  navOpen: boolean;
  setNavOpen: (v: boolean) => void;
  copilotOpen: boolean;
  setCopilotOpen: (v: boolean) => void;
  pendingAsk: string | null;
  ask: (q: string) => void;
  consumeAsk: () => string | null;
  audit: AuditNode | null;
  openAudit: (n: AuditNode) => void;
  closeAudit: () => void;
  approvedMaps: Record<string, boolean>;
  approveMap: (account: string) => void;
  scenario: { boiExtend: boolean; payrollTh: number; tpMargin: number };
  setScenario: (p: Partial<Store["scenario"]>) => void;
  workflow: {
    girValidated: boolean;
    girExported: boolean;
    snapshotApproved: boolean;
    sentRequests: Record<string, boolean>;
    reviewerRan: boolean;
  };
  patchWorkflow: (p: Partial<Store["workflow"]>) => void;
  electionsOn: Record<string, boolean>;
  setElection: (key: string, on: boolean) => string | null;
  resetElections: () => void;
  sbieClaim: Record<string, SbieMode>;
  setSbieClaim: (iso: string, mode: SbieMode) => void;
  activeFy: string;
  yearRecords: YearRecord[];
  yearLocked: boolean;
  lockCurrentYear: (restates: Restate[], note?: string) => YearRecord;
  openNextYear: () => string;
  setActiveFy: (fy: string) => void;
  historyEvents: HistoryEvent[];
  historyImmutable: boolean;
  historyChainOk: boolean;
  appendHistory: (draft: HistoryDraft) => HistoryEvent | null;
  setHistoryImmutable: (on: boolean) => void;
  deleteHistoryEvent: (id: string) => string | null;
  resetHistory: (mode: "working" | "seed") => string | null;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [theme, setThemeState] = useState<ThemeKey>("dark");
  const [mode, setModeState] = useState<ProductMode>("inhouse");
  const [groupId, setGroupIdState] = useState("aetherion");
  const [extraGroups, setExtraGroups] = useState<Group[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [pendingAsk, setPendingAsk] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditNode | null>(null);
  const [approvedMaps, setApprovedMaps] = useState<Record<string, boolean>>({});
  const [scenario, setScenarioState] = useState({ boiExtend: false, payrollTh: 0, tpMargin: 3 });
  const [workflow, setWorkflow] = useState({
    girValidated: false,
    girExported: false,
    snapshotApproved: false,
    sentRequests: {} as Record<string, boolean>,
    reviewerRan: false,
  });
  const [electionsOn, setElectionsOn] = useState<Record<string, boolean>>({});
  const [sbieClaim, setSbieClaimState] = useState<Record<string, SbieMode>>({});
  const [activeFy, setActiveFyState] = useState("FY2026");
  const [yearRecords, setYearRecords] = useState<YearRecord[]>([]);
  const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>([]);
  const [historyImmutable, setHistoryImmutableState] = useState(true);
  const ledgerRef = useRef<HistoryLedger>({ version: "2026.2", groupId: "aetherion", immutable: true, events: [] });
  const modeRef = useRef(mode);
  const fyRef = useRef(activeFy);
  modeRef.current = mode;
  fyRef.current = activeFy;

  const applyLedger = useCallback((led: HistoryLedger) => {
    ledgerRef.current = led;
    saveLedger(led);
    setHistoryEvents(led.events);
    setHistoryImmutableState(led.immutable);
  }, []);

  const actorNow = useCallback(() => (modeRef.current === "advisor" ? ADVISOR_USER : INHOUSE_USER), []);

  const appendHistory = useCallback((draft: HistoryDraft) => {
    const actor = actorNow();
    const next = appendEvent(ledgerRef.current, {
      ...draft,
      actor: draft.actor ?? actor.name,
      role: draft.role ?? actor.role,
      fy: draft.fy ?? fyRef.current,
    });
    applyLedger(next);
    return next.events[next.events.length - 1] ?? null;
  }, [actorNow, applyLedger]);

  useEffect(() => {
    setAuthed(localStorage.getItem("gmt24_auth") === "1");
    setThemeState(normalizeTheme(localStorage.getItem("gmt24_theme")));
    const m = localStorage.getItem("gmt24_mode");
    if (m === "advisor" || m === "inhouse") setModeState(m);
    const extras = parseStoredGroups(localStorage.getItem(ENGAGEMENT_KEY));
    setExtraGroups(extras);
    registerExtras(extras);
    const g = localStorage.getItem("gmt24_group");
    const startGroup = g || "aetherion";
    if (g) setGroupIdState(g);
    const loaded = loadGroupLedger(startGroup);
    setActiveFyState(loaded.fy);
    setYearRecords(loaded.records);
    setElectionsOn(loaded.elections);
    setSbieClaimState(loaded.sbie);
    applyLedger(loadLedger(startGroup));
    setReady(true);
  }, [applyLedger]);

  const login = useCallback((m: ProductMode, opts?: { invite?: boolean }) => {
    if (!opts?.invite) clearInviteSession();
    setModeState(m);
    setAuthed(true);
    localStorage.setItem("gmt24_auth", "1");
    localStorage.setItem("gmt24_mode", m);
    const actor = m === "advisor" ? ADVISOR_USER : INHOUSE_USER;
    if (m === "inhouse") {
      setGroupIdState("aetherion");
      localStorage.setItem("gmt24_group", "aetherion");
      const loaded = loadGroupLedger("aetherion");
      setActiveFyState(loaded.fy);
      setYearRecords(loaded.records);
      setElectionsOn(loaded.elections);
      setSbieClaimState(loaded.sbie);
      applyLedger(loadLedger("aetherion"));
    }
    const next = appendEvent(ledgerRef.current, {
      kind: "action",
      title: "Session started",
      detail: `${sessionLabel(m)} · ${actor.name} · ${actor.role}`,
      actor: actor.name,
      role: actor.role,
      fy: fyRef.current,
      href: "/evidence-history",
      ref: "session",
    });
    applyLedger(next);
  }, [applyLedger]);

  const logout = useCallback(() => {
    const actor = actorNow();
    const next = appendEvent(ledgerRef.current, {
      kind: "action",
      title: "Session ended",
      detail: `${actor.name} signed out.`,
      actor: actor.name,
      role: actor.role,
      fy: fyRef.current,
      href: "/evidence-history",
      ref: "session",
    });
    applyLedger(next);
    setAuthed(false);
    localStorage.removeItem("gmt24_auth");
    clearInviteSession();
  }, [actorNow, applyLedger]);

  const setTheme = useCallback((k: ThemeKey) => {
    setThemeState(k);
    localStorage.setItem("gmt24_theme", k);
  }, []);

  const setMode = useCallback((m: ProductMode) => {
    setModeState(m);
    localStorage.setItem("gmt24_mode", m);
    const actor = m === "advisor" ? ADVISOR_USER : INHOUSE_USER;
    const next = appendEvent(ledgerRef.current, {
      kind: "action",
      title: `Operating mode → ${sessionLabel(m)}`,
      detail: `${actor.name} switched the workspace to ${sessionLabel(m)}.`,
      actor: actor.name,
      role: actor.role,
      fy: fyRef.current,
      href: "/settings",
      ref: m,
    });
    applyLedger(next);
  }, [applyLedger]);

  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const groups = useMemo(() => [...GROUPS, ...extraGroups], [extraGroups]);
  const group = groups.find((g) => g.id === groupId) ?? GROUPS[0];

  const setGroupId = useCallback((id: string) => {
    setGroupIdState(id);
    localStorage.setItem("gmt24_group", id);
    const loaded = loadGroupLedger(id);
    setActiveFyState(loaded.fy);
    setYearRecords(loaded.records);
    setElectionsOn(loaded.elections);
    setSbieClaimState(loaded.sbie);
    applyLedger(loadLedger(id));
  }, [applyLedger]);

  const addEngagement = useCallback((draft: EngagementDraft) => {
    if (mode !== "advisor") {
      flash("Switch to Advisor mode to open a new engagement");
      return null;
    }
    const name = draft.name.trim();
    if (!name) {
      flash("Group legal name is required");
      return null;
    }
    if (!draft.upe.trim()) {
      flash("UPE legal name is required");
      return null;
    }
    if (nameTaken(name, extraGroups)) {
      flash("That group is already on the portfolio");
      return null;
    }
    const row = draftToGroup(draft, extraGroups);
    const next = [row, ...extraGroups];
    setExtraGroups(next);
    registerExtras(next);
    localStorage.setItem(ENGAGEMENT_KEY, JSON.stringify(next));
    setGroupIdState(row.id);
    localStorage.setItem("gmt24_group", row.id);
    const loaded = loadGroupLedger(row.id);
    setActiveFyState(loaded.fy);
    setYearRecords(loaded.records);
    setElectionsOn(loaded.elections);
    setSbieClaimState(loaded.sbie);
    applyLedger(loadLedger(row.id));
    const opened = appendEvent(ledgerRef.current, {
      kind: "action",
      title: `Engagement opened · ${row.name}`,
      detail: `UPE ${row.upe}. Chronicle started for this client ledger.`,
      actor: ADVISOR_USER.name,
      role: ADVISOR_USER.role,
      fy: row.fy,
      href: "/onboard",
      ref: row.id,
    });
    applyLedger(opened);
    flash(`${row.name} added. Next: drop the close pack on Data Hub.`);
    return row.id;
  }, [mode, extraGroups, flash, applyLedger]);

  const ask = useCallback((q: string) => {
    setPendingAsk(q);
    setCopilotOpen(true);
  }, []);

  const consumeAsk = useCallback(() => {
    const q = pendingAsk;
    setPendingAsk(null);
    return q;
  }, [pendingAsk]);

  const approveMap = useCallback((account: string) => {
    setApprovedMaps((p) => ({ ...p, [account]: true }));
    appendHistory({
      kind: "change",
      title: `Account mapping approved · ${account}`,
      detail: "Mapping stored for subsequent years. Source trail: Data Hub → mapping → evidence history.",
      href: "/mapping",
      ref: account,
    });
  }, [appendHistory]);

  const setScenario = useCallback((p: Partial<Store["scenario"]>) => {
    setScenarioState((s) => ({ ...s, ...p }));
  }, []);

  const patchWorkflow = useCallback((p: Partial<Store["workflow"]>) => {
    setWorkflow((w) => ({ ...w, ...p, sentRequests: p.sentRequests ? { ...w.sentRequests, ...p.sentRequests } : w.sentRequests }));
    if (p.girValidated) {
      appendHistory({ kind: "action", title: "GIR schema validated", detail: "XML schema passed. Warnings remain on VN DTA.", href: "/gir", ref: "gir-validate" });
    }
    if (p.girExported) {
      appendHistory({ kind: "doc", title: "GIR pack exported", detail: "XML + PDF + evidence zip written to the filing pack.", href: "/gir", ref: "gir-export" });
    }
    if (p.snapshotApproved === true) {
      appendHistory({ kind: "action", title: "FY calculation snapshot approved", detail: "Reviewer lock on the working package. Does not file.", href: "/approvals", ref: "snapshot" });
    }
    if (p.snapshotApproved === false) {
      appendHistory({ kind: "comment", title: "Snapshot returned to preparer", detail: "Reviewer returned the FY package with comments.", href: "/approvals", ref: "snapshot" });
    }
    if (p.reviewerRan) {
      appendHistory({ kind: "action", title: "AI Pillar Two Reviewer run", detail: "Second-level review against the current calculation snapshot.", href: "/issues", ref: "reviewer" });
    }
    if (p.sentRequests) {
      const ids = Object.keys(p.sentRequests).filter((k) => p.sentRequests?.[k]);
      if (ids.length) {
        appendHistory({
          kind: "action",
          title: `Data request sent · ${ids.join(", ")}`,
          detail: "Gap Hunter queued a request. Logged for the evidence chronicle.",
          href: "/requests",
          ref: ids[0],
        });
      }
    }
  }, [appendHistory]);

  const persistYears = useCallback((rows: YearRecord[], gid = groupId) => {
    setYearRecords(rows);
    localStorage.setItem(storageKeys(gid).records, JSON.stringify(rows));
  }, [groupId]);

  const persistElections = useCallback((on: Record<string, boolean>, sbie: Record<string, SbieMode>, gid = groupId) => {
    localStorage.setItem(storageKeys(gid).elections, JSON.stringify(on));
    localStorage.setItem(storageKeys(gid).sbie, JSON.stringify(sbie));
  }, [groupId]);

  const yearLocked = !!lockedFor(yearRecords, activeFy);

  const setElection = useCallback((key: string, on: boolean) => {
    const tracks = buildTracks(yearRecords, { fy: activeFy, electionsOn });
    const gate = electionConstraint(key, on, !!electionsOn[key], activeFy, tracks, false);
    if (!gate.ok) return gate.reason;
    setElectionsOn((p) => {
      const next = { ...p };
      if (!on) delete next[key];
      else next[key] = true;
      persistElections(next, sbieClaim);
      return next;
    });
    appendHistory({
      kind: "change",
      title: `Election ${on ? "on" : "off"} · ${labelElection(key)}`,
      detail: `${key} ${on ? "elected" : "cleared"} on the ${activeFy} working package.`,
      href: "/elections",
      ref: key,
    });
    return null;
  }, [yearRecords, activeFy, electionsOn, persistElections, sbieClaim, appendHistory]);

  const resetElections = useCallback(() => {
    const prior = lastLocked(yearRecords, activeFy);
    const carry = prior
      ? carryForwardElections(prior, activeFy, buildTracks(yearRecords))
      : { electionsOn: {}, sbieClaim: {} as Record<string, SbieMode> };
    setElectionsOn(carry.electionsOn);
    setSbieClaimState(carry.sbieClaim);
    persistElections(carry.electionsOn, carry.sbieClaim);
    appendHistory({
      kind: "change",
      title: "Elections reset to Core",
      detail: prior
        ? `Working package restored to carried locks from ${prior.fy}.`
        : "Working package cleared to GloBE Core (no prior lock).",
      href: "/elections",
      ref: "reset",
    });
  }, [yearRecords, activeFy, persistElections, appendHistory]);

  const setSbieClaim = useCallback((iso: string, mode: SbieMode) => {
    setSbieClaimState((p) => {
      const sbie = { ...p };
      if (mode === "max") delete sbie[iso];
      else sbie[iso] = mode;
      const key = `OECD_5.3.1@${iso}`;
      setElectionsOn((el) => {
        const next = { ...el };
        if (mode === "max") delete next[key];
        else next[key] = true;
        persistElections(next, sbie);
        return next;
      });
      return sbie;
    });
    appendHistory({
      kind: "change",
      title: `SBIE claim · ${iso} → ${mode}`,
      detail: `Art. 5.3.1 substance-based income exclusion claim set to ${mode} for ${iso}.`,
      href: "/sbie",
      ref: `OECD_5.3.1@${iso}`,
    });
  }, [persistElections, appendHistory]);

  const lockCurrentYear = useCallback((restates: Restate[], note = "") => {
    const rec = makeYearRecord({
      fy: activeFy,
      locked: true,
      electionsOn,
      sbieClaim,
      restates,
      groupId,
      note: note || `${activeFy} final close — ${groupId} · calc + elections`,
    });
    persistYears([...yearRecords.filter((r) => r.fy !== activeFy), rec]);
    appendHistory({
      kind: "calc",
      title: `${rec.fy} locked`,
      detail: rec.note,
      href: "/years",
      ref: rec.fy,
      fy: rec.fy,
      amount: rec.groupTopUp,
    });
    return rec;
  }, [activeFy, electionsOn, sbieClaim, yearRecords, persistYears, groupId, appendHistory]);

  const openNextYear = useCallback(() => {
    const lock = lockedFor(yearRecords, activeFy);
    if (!lock) return "";
    const fy = nextFy(activeFy);
    const tracks = buildTracks(yearRecords);
    const carry = carryForwardElections(lock, fy, tracks);
    setActiveFyState(fy);
    localStorage.setItem(storageKeys(groupId).fy, fy);
    setElectionsOn(carry.electionsOn);
    setSbieClaimState(carry.sbieClaim);
    persistElections(carry.electionsOn, carry.sbieClaim);
    appendHistory({
      kind: "action",
      title: `${fy} opened`,
      detail: `Next Fiscal Year opened from the ${activeFy} lock. Five-year and first-GIR elections carried.`,
      href: "/years",
      ref: fy,
      fy,
    });
    return fy;
  }, [yearRecords, activeFy, persistElections, groupId, appendHistory]);

  const setActiveFy = useCallback((fy: string) => {
    setActiveFyState(fy);
    localStorage.setItem(storageKeys(groupId).fy, fy);
    const lock = lockedFor(yearRecords, fy);
    if (lock) {
      setElectionsOn(lock.electionsOn);
      setSbieClaimState(lock.sbieClaim);
      persistElections(lock.electionsOn, lock.sbieClaim);
    }
  }, [yearRecords, persistElections, groupId]);

  const setHistoryImmutable = useCallback((on: boolean) => {
    const actor = actorNow();
    applyLedger(setImmutable(ledgerRef.current, on, { name: actor.name, role: actor.role }, fyRef.current));
  }, [actorNow, applyLedger]);

  const deleteHistoryEvent = useCallback((id: string) => {
    const next = deleteEvent(ledgerRef.current, id);
    if (typeof next === "string") return next;
    applyLedger(next);
    return null;
  }, [applyLedger]);

  const resetHistory = useCallback((mode: "working" | "seed") => {
    const next = resetLedger(ledgerRef.current, mode);
    if (typeof next === "string") return next;
    applyLedger(next);
    return null;
  }, [applyLedger]);

  const historyChainOk = useMemo(() => verifyChain(historyEvents).ok, [historyEvents]);

  const themeVars = THEMES[theme].vars as unknown as Record<string, string>;

  const value = useMemo(
    () => ({
      ready,
      authed,
      login,
      logout,
      theme,
      setTheme,
      themeVars,
      mode,
      setMode,
      groupId,
      setGroupId,
      groups,
      group,
      addEngagement,
      toast,
      flash,
      navOpen,
      setNavOpen,
      copilotOpen,
      setCopilotOpen,
      pendingAsk,
      ask,
      consumeAsk,
      audit,
      openAudit: setAudit,
      closeAudit: () => setAudit(null),
      approvedMaps,
      approveMap,
      scenario,
      setScenario,
      workflow,
      patchWorkflow,
      electionsOn,
      setElection,
      resetElections,
      sbieClaim,
      setSbieClaim,
      activeFy,
      yearRecords,
      yearLocked,
      lockCurrentYear,
      openNextYear,
      setActiveFy,
      historyEvents,
      historyImmutable,
      historyChainOk,
      appendHistory,
      setHistoryImmutable,
      deleteHistoryEvent,
      resetHistory,
    }),
    [ready, authed, login, logout, theme, setTheme, themeVars, mode, setMode, groupId, setGroupId, groups, group, addEngagement, toast, flash, navOpen, copilotOpen, pendingAsk, ask, consumeAsk, audit, approvedMaps, approveMap, scenario, setScenario, workflow, patchWorkflow, electionsOn, setElection, resetElections, sbieClaim, setSbieClaim, activeFy, yearRecords, yearLocked, lockCurrentYear, openNextYear, setActiveFy, historyEvents, historyImmutable, historyChainOk, appendHistory, setHistoryImmutable, deleteHistoryEvent, resetHistory],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("Store missing");
  return s;
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { THEMES, normalizeTheme, type ThemeKey } from "./format";
import type { ProductMode } from "./model";
import type { AuditNode } from "./engine";
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
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [theme, setThemeState] = useState<ThemeKey>("dark");
  const [mode, setModeState] = useState<ProductMode>("inhouse");
  const [groupId, setGroupIdState] = useState("aetherion");
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

  useEffect(() => {
    setAuthed(localStorage.getItem("gmt24_auth") === "1");
    setThemeState(normalizeTheme(localStorage.getItem("gmt24_theme")));
    const m = localStorage.getItem("gmt24_mode");
    if (m === "advisor" || m === "inhouse") setModeState(m);
    const g = localStorage.getItem("gmt24_group");
    const startGroup = g || "aetherion";
    if (g) setGroupIdState(g);
    const loaded = loadGroupLedger(startGroup);
    setActiveFyState(loaded.fy);
    setYearRecords(loaded.records);
    setElectionsOn(loaded.elections);
    setSbieClaimState(loaded.sbie);
    setReady(true);
  }, []);

  const login = useCallback((m: ProductMode, opts?: { invite?: boolean }) => {
    if (!opts?.invite) clearInviteSession();
    setModeState(m);
    setAuthed(true);
    localStorage.setItem("gmt24_auth", "1");
    localStorage.setItem("gmt24_mode", m);
    if (m === "inhouse") {
      setGroupIdState("aetherion");
      localStorage.setItem("gmt24_group", "aetherion");
      const loaded = loadGroupLedger("aetherion");
      setActiveFyState(loaded.fy);
      setYearRecords(loaded.records);
      setElectionsOn(loaded.elections);
      setSbieClaimState(loaded.sbie);
    }
  }, []);

  const logout = useCallback(() => {
    setAuthed(false);
    localStorage.removeItem("gmt24_auth");
    clearInviteSession();
  }, []);

  const setTheme = useCallback((k: ThemeKey) => {
    setThemeState(k);
    localStorage.setItem("gmt24_theme", k);
  }, []);

  const setMode = useCallback((m: ProductMode) => {
    setModeState(m);
    localStorage.setItem("gmt24_mode", m);
  }, []);

  const setGroupId = useCallback((id: string) => {
    setGroupIdState(id);
    localStorage.setItem("gmt24_group", id);
    const loaded = loadGroupLedger(id);
    setActiveFyState(loaded.fy);
    setYearRecords(loaded.records);
    setElectionsOn(loaded.elections);
    setSbieClaimState(loaded.sbie);
  }, []);

  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

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
  }, []);

  const setScenario = useCallback((p: Partial<Store["scenario"]>) => {
    setScenarioState((s) => ({ ...s, ...p }));
  }, []);

  const patchWorkflow = useCallback((p: Partial<Store["workflow"]>) => {
    setWorkflow((w) => ({ ...w, ...p, sentRequests: p.sentRequests ? { ...w.sentRequests, ...p.sentRequests } : w.sentRequests }));
  }, []);

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
    return null;
  }, [yearRecords, activeFy, electionsOn, persistElections, sbieClaim]);

  const resetElections = useCallback(() => {
    const prior = lastLocked(yearRecords, activeFy);
    const carry = prior
      ? carryForwardElections(prior, activeFy, buildTracks(yearRecords))
      : { electionsOn: {}, sbieClaim: {} as Record<string, SbieMode> };
    setElectionsOn(carry.electionsOn);
    setSbieClaimState(carry.sbieClaim);
    persistElections(carry.electionsOn, carry.sbieClaim);
  }, [yearRecords, activeFy, persistElections]);

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
  }, [persistElections]);

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
    return rec;
  }, [activeFy, electionsOn, sbieClaim, yearRecords, persistYears, groupId]);

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
    return fy;
  }, [yearRecords, activeFy, persistElections, groupId]);

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
    }),
    [ready, authed, login, logout, theme, setTheme, themeVars, mode, setMode, groupId, setGroupId, toast, flash, navOpen, copilotOpen, pendingAsk, ask, consumeAsk, audit, approvedMaps, approveMap, scenario, setScenario, workflow, patchWorkflow, electionsOn, setElection, resetElections, sbieClaim, setSbieClaim, activeFy, yearRecords, yearLocked, lockCurrentYear, openNextYear, setActiveFy],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("Store missing");
  return s;
}

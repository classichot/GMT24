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
import type { SbieMode } from "./electionEngine";

type Store = {
  ready: boolean;
  authed: boolean;
  login: (mode: ProductMode) => void;
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
  setElection: (key: string, on: boolean) => void;
  resetElections: () => void;
  sbieClaim: Record<string, SbieMode>;
  setSbieClaim: (iso: string, mode: SbieMode) => void;
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

  useEffect(() => {
    setAuthed(localStorage.getItem("gmt24_auth") === "1");
    setThemeState(normalizeTheme(localStorage.getItem("gmt24_theme")));
    const m = localStorage.getItem("gmt24_mode");
    if (m === "advisor" || m === "inhouse") setModeState(m);
    const g = localStorage.getItem("gmt24_group");
    if (g) setGroupIdState(g);
    setReady(true);
  }, []);

  const login = useCallback((m: ProductMode) => {
    setModeState(m);
    setAuthed(true);
    localStorage.setItem("gmt24_auth", "1");
    localStorage.setItem("gmt24_mode", m);
    if (m === "inhouse") {
      setGroupIdState("aetherion");
      localStorage.setItem("gmt24_group", "aetherion");
    }
  }, []);

  const logout = useCallback(() => {
    setAuthed(false);
    localStorage.removeItem("gmt24_auth");
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

  const setElection = useCallback((key: string, on: boolean) => {
    setElectionsOn((p) => {
      if (!on) {
        const next = { ...p };
        delete next[key];
        return next;
      }
      return { ...p, [key]: true };
    });
  }, []);

  const resetElections = useCallback(() => {
    setElectionsOn({});
    setSbieClaimState({});
  }, []);

  const setSbieClaim = useCallback((iso: string, mode: SbieMode) => {
    setSbieClaimState((p) => {
      if (mode === "max") {
        const next = { ...p };
        delete next[iso];
        return next;
      }
      return { ...p, [iso]: mode };
    });
    const key = `OECD_5.3.1@${iso}`;
    setElectionsOn((p) => {
      if (mode === "max") {
        const next = { ...p };
        delete next[key];
        return next;
      }
      return { ...p, [key]: true };
    });
  }, []);

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
    }),
    [ready, authed, login, logout, theme, setTheme, themeVars, mode, setMode, groupId, setGroupId, toast, flash, navOpen, copilotOpen, pendingAsk, ask, consumeAsk, audit, approvedMaps, approveMap, scenario, setScenario, workflow, patchWorkflow, electionsOn, setElection, resetElections, sbieClaim, setSbieClaim],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("Store missing");
  return s;
}

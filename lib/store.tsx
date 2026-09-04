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
import {
  defaultIngestStatus,
  readIngestStatus,
  runIngestSimulation,
  writeIngestStatus,
  type IngestStatus,
} from "./ingestSim";
import { runXray } from "./xrayEngines";
import {
  mergeProposals,
  overlayFrom,
  proposalsFromRefresh,
  summariseAmendments,
  undecidedIn,
  type PackAmendment,
  type PackAmendmentStatus,
  type PackChangeRecord,
  type PackOverlay,
} from "./packAmendments";
import type { OecdRefresh } from "./oecdCentralRecord";
import {
  activeQuestions,
  emptyResponse,
  missingEvidence,
  type XrayState,
} from "./xray";

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
  ingestStatus: IngestStatus;
  ingestProgress: { current: number; total: number; file: string } | null;
  loadDemoPack: () => Promise<void>;
  resetIngest: () => void;
  noteFileDrop: (name: string) => void;
  packAmendments: PackAmendment[];
  packChanges: PackChangeRecord[];
  packOverlay: PackOverlay;
  scanPacks: (refresh: OecdRefresh) => { changed: number; open: number; recordId: string | null };
  adminReviewPackChange: (id: string) => string | null;
  decidePackAmendment: (id: string, status: Exclude<PackAmendmentStatus, "proposed">) => string | null;
  revertPackAmendment: (id: string) => void;
  clearPackAmendments: () => void;
  xray: XrayState;
  answerXray: (findingId: string, questionId: string, value: string) => void;
  attachXrayEvidence: (findingId: string, kind: string) => void;
  signXray: (findingId: string, role: "preparer" | "reviewer") => string | null;
  resetXray: () => void;
};

const Ctx = createContext<Store | null>(null);

function loadApprovedMaps(groupId: string): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(`gmt24_maps_${groupId}`) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

function packKey(groupId: string) {
  return `gmt24_packs_${groupId}`;
}

function loadPackAmendments(groupId: string): PackAmendment[] {
  try {
    const raw = JSON.parse(localStorage.getItem(packKey(groupId)) ?? "[]");
    return Array.isArray(raw) ? (raw as PackAmendment[]) : [];
  } catch {
    return [];
  }
}

function changeKey(groupId: string) {
  return `gmt24_pack_changes_${groupId}`;
}

function loadPackChanges(groupId: string): PackChangeRecord[] {
  try {
    const raw = JSON.parse(localStorage.getItem(changeKey(groupId)) ?? "[]");
    return Array.isArray(raw) ? (raw as PackChangeRecord[]) : [];
  } catch {
    return [];
  }
}

function xrayKey(groupId: string) {
  return `gmt24_xray_${groupId}`;
}

function loadXray(groupId: string): XrayState {
  try {
    return JSON.parse(localStorage.getItem(xrayKey(groupId)) ?? "{}") as XrayState;
  } catch {
    return {};
  }
}

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
  const [ingestStatus, setIngestStatus] = useState<IngestStatus>("ready");
  const [ingestProgress, setIngestProgress] = useState<Store["ingestProgress"]>(null);
  const [xray, setXray] = useState<XrayState>({});
  const [packAmendments, setPackAmendments] = useState<PackAmendment[]>([]);
  const [packChanges, setPackChanges] = useState<PackChangeRecord[]>([]);
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
    setApprovedMaps(loadApprovedMaps(startGroup));
    applyLedger(loadLedger(startGroup));
    const invite = localStorage.getItem("gmt24_invite_auth") === "1";
    const storedIngest = readIngestStatus(startGroup);
    setIngestStatus(storedIngest ?? defaultIngestStatus(startGroup, invite));
    setReady(true);
  }, [applyLedger]);

  useEffect(() => {
    setXray(loadXray(groupId));
    setPackAmendments(loadPackAmendments(groupId));
    setPackChanges(loadPackChanges(groupId));
  }, [groupId]);

  const applyIngestForGroup = useCallback((gid: string, inviteReview = false) => {
    const stored = readIngestStatus(gid);
    setIngestStatus(stored ?? defaultIngestStatus(gid, inviteReview));
    setIngestProgress(null);
  }, []);

  const login = useCallback((m: ProductMode, opts?: { invite?: boolean }) => {
    if (!opts?.invite) clearInviteSession();
    setModeState(m);
    setAuthed(true);
    localStorage.setItem("gmt24_auth", "1");
    localStorage.setItem("gmt24_mode", m);
    const actor = m === "advisor" ? ADVISOR_USER : INHOUSE_USER;
    if (m === "inhouse" || opts?.invite) {
      setGroupIdState("aetherion");
      localStorage.setItem("gmt24_group", "aetherion");
      const loaded = loadGroupLedger("aetherion");
      setActiveFyState(loaded.fy);
      setYearRecords(loaded.records);
      setElectionsOn(loaded.elections);
      setSbieClaimState(loaded.sbie);
      setApprovedMaps(loadApprovedMaps("aetherion"));
      applyLedger(loadLedger("aetherion"));
      if (opts?.invite) {
        writeIngestStatus("aetherion", "empty");
        setIngestStatus("empty");
        setIngestProgress(null);
      } else {
        applyIngestForGroup("aetherion", false);
      }
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
  }, [applyLedger, applyIngestForGroup]);

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
    setApprovedMaps(loadApprovedMaps(id));
    applyLedger(loadLedger(id));
    applyIngestForGroup(id, false);
  }, [applyLedger, applyIngestForGroup]);

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
    setApprovedMaps(loadApprovedMaps(row.id));
    applyLedger(loadLedger(row.id));
    writeIngestStatus(row.id, "empty");
    setIngestStatus("empty");
    setIngestProgress(null);
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
    setApprovedMaps((p) => {
      const next = { ...p, [account]: true };
      localStorage.setItem(`gmt24_maps_${groupId}`, JSON.stringify(next));
      return next;
    });
    setWorkflow((w) => ({ ...w, girValidated: false, girExported: false }));
    appendHistory({
      kind: "change",
      title: `Account mapping approved · ${account}`,
      detail: "Mapping stored for subsequent years. Source trail: Data Hub → mapping → evidence history.",
      href: "/mapping",
      ref: account,
    });
  }, [appendHistory, groupId]);

  const setScenario = useCallback((p: Partial<Store["scenario"]>) => {
    setScenarioState((s) => ({ ...s, ...p }));
    setWorkflow((w) => ({ ...w, girValidated: false, girExported: false }));
  }, []);

  const patchWorkflow = useCallback((p: Partial<Store["workflow"]>) => {
    setWorkflow((w) => ({ ...w, ...p, sentRequests: p.sentRequests ? { ...w.sentRequests, ...p.sentRequests } : w.sentRequests }));
    if (p.girValidated) {
      appendHistory({ kind: "action", title: "GIR XML preflight passed", detail: "GMT24 population and calculation-to-collection reconciliations passed. Official three-file OECD XSD validation remains a filing-gate step.", href: "/gir", ref: "gir-validate" });
    }
    if (p.girExported) {
      appendHistory({ kind: "doc", title: "GIR XML exported", detail: "Snapshot-driven GLOBEXML v1.0 file downloaded; local filing extensions remain jurisdiction-specific.", href: "/gir", ref: "gir-export" });
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
    setWorkflow((w) => ({ ...w, girValidated: false, girExported: false }));
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
    setWorkflow((w) => ({ ...w, girValidated: false, girExported: false }));
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
    setWorkflow((w) => ({ ...w, girValidated: false, girExported: false }));
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

  const loadDemoPack = useCallback(async () => {
    if (ingestStatus === "running") return;
    setIngestStatus("running");
    writeIngestStatus(groupId, "running");
    setIngestProgress({ current: 0, total: 0, file: "Starting classification…" });
    await runIngestSimulation((current, total, file) => {
      setIngestProgress({ current, total, file });
    });
    setIngestStatus("ready");
    writeIngestStatus(groupId, "ready");
    setIngestProgress(null);
    appendHistory({
      kind: "doc",
      title: "Close pack ingested",
      detail: "Aetherion FY2026 demo pack classified and posted to the canonical model. Next: approve mappings on Account mapping.",
      href: "/data",
      ref: "ingest-pack",
    });
    flash("Close pack ingested · open Account mapping");
  }, [ingestStatus, groupId, appendHistory, flash]);

  const resetIngest = useCallback(() => {
    writeIngestStatus(groupId, "empty");
    setIngestStatus("empty");
    setIngestProgress(null);
    flash("Ingest reset — load the demo pack again");
  }, [groupId, flash]);

  const packOverlay = useMemo(() => overlayFrom(packAmendments), [packAmendments]);

  const persistPacks = useCallback((next: PackAmendment[]) => {
    setPackAmendments(next);
    localStorage.setItem(packKey(groupId), JSON.stringify(next));
    setWorkflow((w) => ({ ...w, girValidated: false, girExported: false }));
  }, [groupId]);

  const persistChanges = useCallback((next: PackChangeRecord[]) => {
    setPackChanges(next);
    localStorage.setItem(changeKey(groupId), JSON.stringify(next));
  }, [groupId]);

  /**
   * One scan: AI proposes, differences are merged into the review queue, and any
   * difference raises a change record that stays open — and keeps alerting —
   * until an administrator reviews it.
   */
  const scanPacks = useCallback((refresh: OecdRefresh) => {
    const rows = proposalsFromRefresh(refresh);
    const merged = mergeProposals(packAmendments, rows);
    persistPacks(merged);
    const open = merged.filter((a) => a.status === "proposed" && !a.guard).length;
    if (!rows.length) {
      appendHistory({
        kind: "action",
        title: "OECD Central Record scan · no differences",
        detail: `Signed pack agrees with the ${refresh.source === "pdf" ? "published PDF" : "Central Record page"}${refresh.asOf ? ` as at ${refresh.asOf}` : ""}.`,
        href: "/jurisdictions",
        ref: "pack-scan",
      });
      return { changed: 0, open, recordId: null };
    }
    const { summary, lines } = summariseAmendments(rows, refresh.asOf, refresh.source);
    const record: PackChangeRecord = {
      id: `PC-${refresh.fetchedAt}`,
      detectedAt: refresh.fetchedAt,
      asOf: refresh.asOf,
      source: refresh.source,
      sourceUrl: refresh.source === "pdf" ? refresh.pdfUrl : refresh.sourceUrl,
      summary,
      lines,
      amendmentIds: rows.map((r) => r.id),
      note: refresh.note,
      adminReviewed: false,
      admin: null,
      reviewedAt: null,
    };
    persistChanges([record, ...packChanges.filter((c) => c.id !== record.id)]);
    appendHistory({
      kind: "action",
      title: `Jurisdiction pack change detected · ${rows.length} field${rows.length === 1 ? "" : "s"}`,
      detail: `${summary} Held on the record until administrator review. ${open} awaiting a reviewer decision; nothing reaches the calculation until accepted.`,
      href: "/jurisdictions",
      ref: record.id,
    });
    return { changed: rows.length, open, recordId: record.id };
  }, [packAmendments, packChanges, persistPacks, persistChanges, appendHistory]);

  /**
   * Administrative sign-off closes the alert. It is refused while any amendment
   * in the record is still undecided, so the record cannot be dismissed to make
   * the banner go away.
   */
  const adminReviewPackChange = useCallback((id: string) => {
    const record = packChanges.find((c) => c.id === id);
    if (!record) return "Change record not found.";
    if (record.adminReviewed) return null;
    const open = undecidedIn(record, packAmendments);
    if (open.length) {
      return `${open.length} amendment${open.length === 1 ? "" : "s"} in this change are still undecided — accept or reject each one before closing the record.`;
    }
    const actor = actorNow();
    persistChanges(packChanges.map((c) => (
      c.id === id ? { ...c, adminReviewed: true, admin: actor.name, reviewedAt: new Date().toISOString() } : c
    )));
    appendHistory({
      kind: "action",
      title: "Jurisdiction pack change reviewed by administrator",
      detail: `${record.summary} Closed by ${actor.name} (${actor.role}). Source: ${record.sourceUrl}.`,
      href: "/jurisdictions",
      ref: record.id,
    });
    return null;
  }, [packChanges, packAmendments, persistChanges, appendHistory, actorNow]);

  /**
   * A reviewer decision is the only route into the calculation. Rows carrying a
   * legal guard can be rejected but never accepted — absence from the Central
   * Record is not a determination that a regime is unqualified.
   */
  const decidePackAmendment = useCallback((id: string, status: Exclude<PackAmendmentStatus, "proposed">) => {
    const row = packAmendments.find((a) => a.id === id);
    if (!row) return "Amendment not found on this snapshot.";
    if (status === "accepted" && row.guard) return row.guard;
    const actor = actorNow();
    persistPacks(packAmendments.map((a) => (
      a.id === id ? { ...a, status, reviewer: actor.name, decidedAt: new Date().toISOString() } : a
    )));
    appendHistory({
      kind: "change",
      title: `Jurisdiction pack ${status} · ${row.name} ${row.field}`,
      detail: `${String(row.current)} → ${String(row.proposed)}. Source: Central Record${row.asOf ? ` as at ${row.asOf}` : ""} · ${row.sourceUrl}. ${actor.name} (${actor.role}).`,
      href: "/jurisdictions",
      ref: row.id,
    });
    return null;
  }, [packAmendments, persistPacks, appendHistory, actorNow]);

  const revertPackAmendment = useCallback((id: string) => {
    const row = packAmendments.find((a) => a.id === id);
    if (!row) return;
    persistPacks(packAmendments.map((a) => (
      a.id === id ? { ...a, status: "proposed", reviewer: null, decidedAt: null } : a
    )));
    appendHistory({
      kind: "change",
      title: `Jurisdiction pack amendment reverted · ${row.name} ${row.field}`,
      detail: `Signed pack value ${String(row.current)} restored to the calculation pending review.`,
      href: "/jurisdictions",
      ref: row.id,
    });
  }, [packAmendments, persistPacks, appendHistory]);

  const clearPackAmendments = useCallback(() => {
    persistPacks([]);
    persistChanges([]);
    appendHistory({
      kind: "change",
      title: "Jurisdiction pack amendments cleared",
      detail: "All proposals and accepted amendments removed. The engine is back on the signed Central Record pack.",
      href: "/jurisdictions",
      ref: "pack-reset",
    });
  }, [persistPacks, persistChanges, appendHistory]);

  const persistXray = useCallback((next: XrayState) => {
    setXray(next);
    localStorage.setItem(xrayKey(groupId), JSON.stringify(next));
    setWorkflow((w) => ({ ...w, girValidated: false, girExported: false }));
  }, [groupId]);

  const answerXray = useCallback((findingId: string, questionId: string, value: string) => {
    const finding = runXray({ electionsOn }).find((f) => f.id === findingId);
    const prev = xray[findingId] ?? emptyResponse();
    const answers = { ...prev.answers, [questionId]: value };
    // A changed answer can retire dependent questions — drop their stale responses
    // so the confirmation cannot be completed on facts that no longer apply.
    if (finding) {
      const live = new Set(activeQuestions(finding, answers).map((q) => q.id));
      for (const k of Object.keys(answers)) if (!live.has(k)) delete answers[k];
    }
    persistXray({
      ...xray,
      [findingId]: { ...prev, answers, preparer: null, reviewer: null, at: "" },
    });
    const q = finding?.questions.find((x) => x.id === questionId);
    appendHistory({
      kind: "change",
      title: `X-Ray confirmation · ${finding?.title ?? findingId}`,
      detail: `${q?.prompt ?? questionId} → ${q?.options.find((o) => o.value === value)?.label ?? value}. Approvals reset for re-review.`,
      href: "/xray/confirm",
      ref: findingId,
    });
  }, [xray, electionsOn, persistXray, appendHistory]);

  const attachXrayEvidence = useCallback((findingId: string, kind: string) => {
    const prev = xray[findingId] ?? emptyResponse();
    if (prev.evidence.includes(kind)) return;
    persistXray({
      ...xray,
      [findingId]: { ...prev, evidence: [...prev.evidence, kind], reviewer: null },
    });
    appendHistory({
      kind: "doc",
      title: `X-Ray evidence attached · ${kind}`,
      detail: `Validated against ${findingId}. Reviewer approval reset.`,
      href: "/xray/confirm",
      ref: findingId,
    });
  }, [xray, persistXray, appendHistory]);

  /**
   * Signing is gated, not advisory. A preparer cannot sign an item whose active
   * questions are unanswered or whose required evidence is absent, and a reviewer
   * cannot sign ahead of the preparer.
   */
  const signXray = useCallback((findingId: string, role: "preparer" | "reviewer") => {
    const finding = runXray({ electionsOn }).find((f) => f.id === findingId);
    if (!finding) return "Finding not found on this snapshot.";
    const prev = xray[findingId] ?? emptyResponse();
    const open = activeQuestions(finding, prev.answers).filter((q) => !prev.answers[q.id]);
    if (open.length) return `${open.length} question${open.length === 1 ? "" : "s"} still unanswered — ${open[0].dept} must respond first.`;
    const missing = missingEvidence(finding, prev);
    if (missing.length) return `Evidence missing — attach ${missing.join(", ")} before signing.`;
    const actor = actorNow();
    if (role === "reviewer" && !prev.preparer) return "Preparer must sign before reviewer approval.";
    if (role === "reviewer" && prev.preparer === actor.name) {
      return "Preparer and reviewer must be different people — switch operating mode to review this item.";
    }
    persistXray({
      ...xray,
      [findingId]: { ...prev, [role]: actor.name, at: new Date().toISOString() },
    });
    appendHistory({
      kind: "action",
      title: `X-Ray ${role} approval · ${finding.title}`,
      detail: `${finding.jurisdiction} · ${finding.article} · ${actor.name} (${actor.role}) signed the confirmation.`,
      href: "/xray/confirm",
      ref: findingId,
    });
    return null;
  }, [xray, electionsOn, persistXray, appendHistory, actorNow]);

  const resetXray = useCallback(() => {
    persistXray({});
    appendHistory({
      kind: "change",
      title: "X-Ray confirmations cleared",
      detail: "All confirmations, evidence links and approvals reset to detection state.",
      href: "/xray",
      ref: "reset",
    });
  }, [persistXray, appendHistory]);

  const noteFileDrop = useCallback((name: string) => {
    appendHistory({
      kind: "doc",
      title: `File received · ${name}`,
      detail: "Prototype classifier queued the drop. Load the full demo pack to post all sources, or continue with sample CSVs.",
      href: "/data",
      ref: name.slice(0, 40),
    });
  }, [appendHistory]);

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
      ingestStatus,
      ingestProgress,
      loadDemoPack,
      resetIngest,
      noteFileDrop,
      packAmendments,
      packChanges,
      packOverlay,
      scanPacks,
      adminReviewPackChange,
      decidePackAmendment,
      revertPackAmendment,
      clearPackAmendments,
      xray,
      answerXray,
      attachXrayEvidence,
      signXray,
      resetXray,
    }),
    [ready, authed, login, logout, theme, setTheme, themeVars, mode, setMode, groupId, setGroupId, groups, group, addEngagement, toast, flash, navOpen, copilotOpen, pendingAsk, ask, consumeAsk, audit, approvedMaps, approveMap, scenario, setScenario, workflow, patchWorkflow, electionsOn, setElection, resetElections, sbieClaim, setSbieClaim, activeFy, yearRecords, yearLocked, lockCurrentYear, openNextYear, setActiveFy, historyEvents, historyImmutable, historyChainOk, appendHistory, setHistoryImmutable, deleteHistoryEvent, resetHistory, ingestStatus, ingestProgress, loadDemoPack, resetIngest, noteFileDrop, packAmendments, packChanges, packOverlay, scanPacks, adminReviewPackChange, decidePackAmendment, revertPackAmendment, clearPackAmendments, xray, answerXray, attachXrayEvidence, signXray, resetXray],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("Store missing");
  return s;
}

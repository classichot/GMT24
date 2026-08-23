import { electionById, type ElectionDuration } from "./elections";
import { money } from "./format";
import { splitSwitch, type Restate, type SbieMode } from "./electionEngine";

export const LOCK_YEARS = 5;

export type YearJurRow = {
  iso: string;
  name: string;
  globe: number;
  covered: number;
  etr: number;
  sbie: number;
  excess: number;
  topUp: number;
  qdmtt: number;
  iir: number;
  utpr: number;
  harbour: boolean;
};

export type YearRecord = {
  fy: string;
  locked: boolean;
  lockedAt: string | null;
  electionsOn: Record<string, boolean>;
  sbieClaim: Record<string, SbieMode>;
  rows: YearJurRow[];
  groupTopUp: number;
  groupCovered: number;
  groupGlobe: number;
  note: string;
};

export type ElectionTrack = {
  key: string;
  id: string;
  iso: string;
  name: string;
  article: string;
  duration: ElectionDuration;
  reelect: "yes" | "no" | "restricted";
  firstFy: string;
  yearsOn: string[];
  revokedFy: string | null;
};

export type ElectionChange = {
  key: string;
  name: string;
  article: string;
  iso: string;
  duration: ElectionDuration;
  prior: boolean;
  current: boolean;
  action: "carried" | "added" | "dropped" | "unchanged";
  consistency: "ok" | "breach" | "review";
  note: string;
};

export type CalcChange = {
  iso: string;
  name: string;
  globe: number;
  globePrior: number;
  covered: number;
  coveredPrior: number;
  etr: number;
  etrPrior: number;
  topUp: number;
  topUpPrior: number;
  dGlobe: number;
  dCovered: number;
  dEtr: number;
  dTopUp: number;
};

export type ConsistencyHit = {
  severity: "block" | "warn" | "ok";
  kind: "must-carry" | "early-revoke" | "no-reelect" | "new-lock" | "annual" | "calc" | "carry";
  key?: string;
  title: string;
  detail: string;
};

export function fyYearNum(fy: string) {
  const n = Number(String(fy || "").replace(/FY/i, ""));
  return Number.isFinite(n) ? n : 2026;
}

export function nextFy(fy: string) {
  return `FY${fyYearNum(fy) + 1}`;
}

export function lockExpiresFy(firstFy: string) {
  return `FY${fyYearNum(firstFy) + LOCK_YEARS - 1}`;
}

export function stillInFiveYearLock(firstFy: string, currentFy: string) {
  return fyYearNum(currentFy) <= fyYearNum(firstFy) + LOCK_YEARS - 1;
}

export function yearsLeftOnLock(firstFy: string, currentFy: string) {
  return Math.max(0, fyYearNum(firstFy) + LOCK_YEARS - fyYearNum(currentFy));
}

function onKeys(on: Record<string, boolean>) {
  return Object.entries(on).filter(([, v]) => v).map(([k]) => k);
}

export function rowsFromRestate(rows: Restate[]): YearJurRow[] {
  return rows.map((r) => ({
    iso: r.iso,
    name: r.name,
    globe: r.globe,
    covered: r.covered,
    etr: r.etr,
    sbie: r.sbie,
    excess: r.excess,
    topUp: r.topUp,
    qdmtt: r.qdmtt,
    iir: r.iir,
    utpr: r.utpr,
    harbour: r.harbour,
  }));
}

export function makeYearRecord({
  fy,
  locked,
  electionsOn,
  sbieClaim,
  restates,
  note = "",
}: {
  fy: string;
  locked: boolean;
  electionsOn: Record<string, boolean>;
  sbieClaim: Record<string, SbieMode>;
  restates: Restate[];
  note?: string;
}): YearRecord {
  const rows = rowsFromRestate(restates);
  return {
    fy,
    locked,
    lockedAt: locked ? new Date().toISOString() : null,
    electionsOn: { ...electionsOn },
    sbieClaim: { ...sbieClaim },
    rows,
    groupTopUp: money(rows.reduce((a, r) => a + r.topUp, 0)),
    groupCovered: money(rows.reduce((a, r) => a + r.covered, 0)),
    groupGlobe: money(rows.reduce((a, r) => a + r.globe, 0)),
    note,
  };
}

export function sortRecords(records: YearRecord[]) {
  return [...records].sort((a, b) => fyYearNum(a.fy) - fyYearNum(b.fy));
}

export function lastLocked(records: YearRecord[], beforeFy?: string) {
  const list = sortRecords(records.filter((r) => r.locked));
  if (!beforeFy) return list[list.length - 1] ?? null;
  const prior = list.filter((r) => fyYearNum(r.fy) < fyYearNum(beforeFy));
  return prior[prior.length - 1] ?? null;
}

export function lockedFor(records: YearRecord[], fy: string) {
  return records.find((r) => r.fy === fy && r.locked) ?? null;
}

export function workingDiffers(lock: YearRecord | null, electionsOn: Record<string, boolean>, sbieClaim: Record<string, SbieMode>) {
  if (!lock) return true;
  const a = onKeys(lock.electionsOn).sort().join("|");
  const b = onKeys(electionsOn).sort().join("|");
  if (a !== b) return true;
  const sa = Object.entries(lock.sbieClaim).sort().join("|");
  const sb = Object.entries(sbieClaim).sort().join("|");
  return sa !== sb;
}

export function buildTracks(records: YearRecord[], working?: { fy: string; electionsOn: Record<string, boolean> }): ElectionTrack[] {
  const seq = sortRecords(records.filter((r) => r.locked));
  if (working && !seq.some((r) => r.fy === working.fy && r.locked)) {
    seq.push({
      fy: working.fy,
      locked: false,
      lockedAt: null,
      electionsOn: working.electionsOn,
      sbieClaim: {},
      rows: [],
      groupTopUp: 0,
      groupCovered: 0,
      groupGlobe: 0,
      note: "",
    });
  }
  const map = new Map<string, ElectionTrack>();
  let prevOn = new Set<string>();
  for (const rec of seq) {
    const on = new Set(onKeys(rec.electionsOn));
    for (const key of on) {
      const [id, iso] = splitSwitch(key);
      const def = electionById(id);
      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          key,
          id,
          iso,
          name: def?.name ?? id,
          article: def?.article ?? id,
          duration: def?.duration ?? "annual",
          reelect: def?.reelect ?? "yes",
          firstFy: rec.fy,
          yearsOn: [rec.fy],
          revokedFy: null,
        });
      } else {
        if (!prev.yearsOn.includes(rec.fy)) prev.yearsOn.push(rec.fy);
        prev.revokedFy = null;
      }
    }
    for (const key of prevOn) {
      if (!on.has(key)) {
        const track = map.get(key);
        if (track && !track.revokedFy) track.revokedFy = rec.fy;
      }
    }
    prevOn = on;
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function carriesIntoNext(defDuration: ElectionDuration, firstFy: string, intoFy: string) {
  if (defDuration === "five-year") return stillInFiveYearLock(firstFy, intoFy);
  if (defDuration === "first-gir") return true;
  return false;
}

export function carryForwardElections(prior: YearRecord, intoFy: string, tracks: ElectionTrack[] = []) {
  const electionsOn: Record<string, boolean> = {};
  for (const key of onKeys(prior.electionsOn)) {
    const [id] = splitSwitch(key);
    const def = electionById(id);
    const track = tracks.find((t) => t.key === key);
    const first = track?.firstFy ?? prior.fy;
    if (def && carriesIntoNext(def.duration, first, intoFy)) electionsOn[key] = true;
  }
  return { electionsOn, sbieClaim: {} as Record<string, SbieMode> };
}

export function electionConstraint(
  key: string,
  nextOn: boolean,
  currentOn: boolean,
  activeFy: string,
  tracks: ElectionTrack[],
  yearIsLocked: boolean,
): { ok: boolean; reason: string } {
  if (yearIsLocked) return { ok: false, reason: `${activeFy} is locked. Open the next Fiscal Year to change elections.` };
  const [id] = splitSwitch(key);
  const def = electionById(id);
  const track = tracks.find((t) => t.key === key);
  if (!def) return { ok: true, reason: "" };
  if (currentOn && !nextOn && def.duration === "five-year" && track && track.firstFy !== activeFy && stillInFiveYearLock(track.firstFy, activeFy)) {
    return { ok: false, reason: `${def.article} is a five-year lock from ${track.firstFy} (through ${lockExpiresFy(track.firstFy)}). Dropping it in ${activeFy} is an early revocation.` };
  }
  if (currentOn && !nextOn && def.duration === "first-gir") {
    return { ok: true, reason: `${def.article} is revocable, but re-election after revocation is NO.` };
  }
  if (!currentOn && nextOn && (def.reelect === "no" || def.duration === "first-gir") && track?.revokedFy) {
    return { ok: false, reason: `${def.article} was revoked in ${track.revokedFy}. Re-elect after revocation is NO.` };
  }
  return { ok: true, reason: "" };
}

export function compareYears(prior: YearRecord, current: { fy: string; electionsOn: Record<string, boolean>; sbieClaim: Record<string, SbieMode>; rows: YearJurRow[] }, tracks: ElectionTrack[]) {
  const keys = [...new Set([...onKeys(prior.electionsOn), ...onKeys(current.electionsOn)])].sort();
  const elections: ElectionChange[] = keys.map((key) => {
    const [id, iso] = splitSwitch(key);
    const def = electionById(id);
    const was = !!prior.electionsOn[key];
    const now = !!current.electionsOn[key];
    const track = tracks.find((t) => t.key === key);
    const duration = def?.duration ?? "annual";
    let action: ElectionChange["action"] = "unchanged";
    if (was && now) action = duration === "annual" ? "unchanged" : "carried";
    else if (!was && now) action = "added";
    else if (was && !now) action = "dropped";
    let consistency: ElectionChange["consistency"] = "ok";
    let note = def?.consistency ?? "";
    if (action === "dropped" && duration === "five-year" && track && stillInFiveYearLock(track.firstFy, current.fy)) {
      consistency = "breach";
      note = `Must carry ${def?.article} through ${lockExpiresFy(track.firstFy)}.`;
    } else if (action === "dropped" && duration === "first-gir") {
      consistency = "review";
      note = "Revocation is allowed. Re-elect later is NO.";
    } else if (action === "added" && track?.revokedFy && (def?.reelect === "no" || duration === "first-gir")) {
      consistency = "breach";
      note = `Revoked in ${track.revokedFy}. Re-election is prohibited.`;
    } else if (action === "added" && duration === "five-year") {
      consistency = "review";
      note = `New five-year lock starts ${current.fy} (through ${lockExpiresFy(current.fy)}).`;
    } else if (action === "dropped" && duration === "annual") {
      note = "Annual — may change year to year.";
    } else if (action === "carried") {
      note = track ? `Carried from ${track.firstFy} · ${yearsLeftOnLock(track.firstFy, current.fy)} year(s) left on the lock.` : "Carried from the prior year.";
    }
    return {
      key,
      name: def?.name ?? id,
      article: def?.article ?? id,
      iso,
      duration,
      prior: was,
      current: now,
      action,
      consistency,
      note,
    };
  });

  const isos = [...new Set([...prior.rows.map((r) => r.iso), ...current.rows.map((r) => r.iso)])];
  const calcs: CalcChange[] = isos.map((iso) => {
    const p = prior.rows.find((r) => r.iso === iso);
    const c = current.rows.find((r) => r.iso === iso);
    const globe = c?.globe ?? 0;
    const covered = c?.covered ?? 0;
    const etr = c?.etr ?? 0;
    const topUp = c?.topUp ?? 0;
    const globePrior = p?.globe ?? 0;
    const coveredPrior = p?.covered ?? 0;
    const etrPrior = p?.etr ?? 0;
    const topUpPrior = p?.topUp ?? 0;
    return {
      iso,
      name: c?.name ?? p?.name ?? iso,
      globe,
      globePrior,
      covered,
      coveredPrior,
      etr,
      etrPrior,
      topUp,
      topUpPrior,
      dGlobe: money(globe - globePrior),
      dCovered: money(covered - coveredPrior),
      dEtr: etr - etrPrior,
      dTopUp: money(topUp - topUpPrior),
    };
  }).filter((r) => r.dGlobe || r.dCovered || r.dTopUp || Math.abs(r.dEtr) > 0.00005 || r.topUp > 0 || r.topUpPrior > 0);

  const hits: ConsistencyHit[] = [];
  for (const e of elections) {
    if (e.consistency === "breach") {
      hits.push({
        severity: "block",
        kind: e.action === "added" ? "no-reelect" : "must-carry",
        key: e.key,
        title: e.article,
        detail: e.note,
      });
    } else if (e.action === "carried") {
      hits.push({ severity: "ok", kind: "carry", key: e.key, title: e.article, detail: e.note });
    } else if (e.action === "added" && e.duration === "five-year") {
      hits.push({ severity: "warn", kind: "new-lock", key: e.key, title: e.article, detail: e.note });
    } else if (e.action === "dropped" || e.action === "added") {
      hits.push({ severity: "ok", kind: "annual", key: e.key, title: e.article, detail: e.note || `${e.action} in ${current.fy}.` });
    }
  }
  const moved = calcs.filter((c) => c.dTopUp || c.dGlobe || c.dCovered);
  if (moved.length) {
    hits.push({
      severity: "warn",
      kind: "calc",
      title: "Calculation movement",
      detail: `${moved.length} jurisdiction(s) moved versus ${prior.fy}. Election overlays and year-to-year restatement are the source — the engine posted the delta.`,
    });
  }
  return { elections, calcs, hits };
}

export function parseRecords(raw: string | null): YearRecord[] {
  try {
    const list = JSON.parse(raw || "[]") as YearRecord[];
    return Array.isArray(list) ? list.filter((r) => r && r.fy) : [];
  } catch {
    return [];
  }
}

import { ADJUSTMENTS, ACTIVITY, FILES, ISSUES, type ProductMode } from "./model";
import { calculateGroup } from "./engine";
import { electionById } from "./elections";
import { splitSwitch } from "./electionEngine";
import { eur } from "./format";

export const EH_GENESIS = "GMT24-EH-v1";
export const EH_VERSION = "2026.2";

export type HistoryKind = "doc" | "change" | "calc" | "action" | "comment";

export const HISTORY_KINDS: { id: HistoryKind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "doc", label: "Docs" },
  { id: "change", label: "Changes" },
  { id: "calc", label: "Calculations" },
  { id: "action", label: "Actions" },
  { id: "comment", label: "Comments" },
];

export type HistoryDraft = {
  kind: HistoryKind;
  title: string;
  detail: string;
  actor?: string;
  role?: string;
  href?: string;
  ref?: string;
  fy?: string;
  amount?: number;
  seed?: boolean;
  at?: string;
  id?: string;
};

export type HistoryEvent = {
  id: string;
  seq: number;
  at: string;
  kind: HistoryKind;
  actor: string;
  role: string;
  title: string;
  detail: string;
  href?: string;
  ref?: string;
  fy: string;
  amount?: number;
  seed?: boolean;
  prevHash: string;
  hash: string;
};

export type HistoryLedger = {
  version: string;
  groupId: string;
  immutable: boolean;
  events: HistoryEvent[];
};

function storageKey(groupId: string) {
  return `gmt24_eh_${groupId}`;
}

/** FNV-1a 64-bit — deterministic integrity stamp for the demo chain (not a HSM). */
export function fnv1a64(s: string): string {
  let h = BigInt("0xcbf29ce484222325");
  const p = BigInt("0x100000001b3");
  const mask = BigInt("0xffffffffffffffff");
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = (h * p) & mask;
  }
  return h.toString(16).padStart(16, "0");
}

function canonical(e: Omit<HistoryEvent, "hash">): string {
  return [
    e.id,
    String(e.seq),
    e.at,
    e.kind,
    e.actor,
    e.role,
    e.title,
    e.detail,
    e.href ?? "",
    e.ref ?? "",
    e.fy,
    e.amount == null ? "" : String(e.amount),
    e.seed ? "1" : "0",
    e.prevHash,
  ].join("|");
}

export function stampHash(prevHash: string, body: Omit<HistoryEvent, "hash">): string {
  return fnv1a64(`${prevHash}>${canonical(body)}`);
}

export function verifyChain(events: HistoryEvent[]): { ok: boolean; brokenAt: number | null } {
  let prev = EH_GENESIS;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const { hash, ...rest } = e;
    if (e.prevHash !== prev || e.seq !== i + 1 || stampHash(prev, rest) !== hash) {
      return { ok: false, brokenAt: i };
    }
    prev = hash;
  }
  return { ok: true, brokenAt: null };
}

function rehash(events: HistoryEvent[]): HistoryEvent[] {
  let prev = EH_GENESIS;
  return events.map((e, i) => {
    const body: Omit<HistoryEvent, "hash"> = { ...e, seq: i + 1, prevHash: prev };
    const hash = stampHash(prev, body);
    prev = hash;
    return { ...body, hash };
  });
}

export function appendEvent(ledger: HistoryLedger, draft: HistoryDraft): HistoryLedger {
  const prev = ledger.events.length ? ledger.events[ledger.events.length - 1].hash : EH_GENESIS;
  const seq = ledger.events.length + 1;
  const body: Omit<HistoryEvent, "hash"> = {
    id: draft.id ?? `eh-${Date.now().toString(36)}-${seq.toString(36)}`,
    seq,
    at: draft.at ?? new Date().toISOString(),
    kind: draft.kind,
    actor: draft.actor ?? "GMT24",
    role: draft.role ?? "system",
    title: draft.title,
    detail: draft.detail,
    href: draft.href,
    ref: draft.ref,
    fy: draft.fy ?? "FY2026",
    amount: draft.amount,
    seed: draft.seed,
    prevHash: prev,
  };
  const event: HistoryEvent = { ...body, hash: stampHash(prev, body) };
  return { ...ledger, events: [...ledger.events, event] };
}

export function deleteEvent(ledger: HistoryLedger, id: string): HistoryLedger | string {
  if (ledger.immutable) return "Log is sealed. Turn immutability off to delete.";
  const next = ledger.events.filter((e) => e.id !== id);
  if (next.length === ledger.events.length) return "Event not found.";
  return { ...ledger, events: rehash(next) };
}

export function resetLedger(ledger: HistoryLedger, mode: "working" | "seed"): HistoryLedger | string {
  if (ledger.immutable) return "Log is sealed. Turn immutability off to reset.";
  if (mode === "working") {
    return { ...ledger, events: rehash(ledger.events.filter((e) => e.seed)) };
  }
  return seedLedger(ledger.groupId, true);
}

export function setImmutable(ledger: HistoryLedger, on: boolean, actor: { name: string; role: string }, fy: string): HistoryLedger {
  if (ledger.immutable === on) return ledger;
  const next = appendEvent({ ...ledger, immutable: on }, {
    kind: "action",
    title: on ? "Immutability turned on" : "Immutability turned off",
    detail: on
      ? "Chronicle is sealed. Existing entries cannot be edited or deleted. New docs, changes, calculations, actions and comments still append."
      : "Chronicle is writable. Entries can be deleted or reset. Integrity hashes are rebuilt after a delete.",
    actor: actor.name,
    role: actor.role,
    fy,
    href: "/evidence-history",
    ref: "immutable",
  });
  return { ...next, immutable: on };
}

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function isoFromLabel(s: string, yearFallback = 2026): string {
  const m = s.match(/(\d{1,2})\s+([A-Za-z]{3})(?:\s+(\d{4}))?(?:,\s*(\d{1,2}):(\d{2}))?/);
  if (!m) return new Date(Date.UTC(yearFallback, 7, 1, 8, 0)).toISOString();
  const day = Number(m[1]);
  const mon = MONTHS[m[2]] ?? 7;
  const year = m[3] ? Number(m[3]) : yearFallback;
  const hh = m[4] ? Number(m[4]) : 9;
  const mm = m[5] ? Number(m[5]) : 0;
  return new Date(Date.UTC(year, mon, day, hh, mm)).toISOString();
}

function emptyLedger(groupId: string, immutable: boolean): HistoryLedger {
  return { version: EH_VERSION, groupId, immutable, events: [] };
}

export function seedLedger(groupId: string, immutable = true): HistoryLedger {
  let led = emptyLedger(groupId, immutable);
  const actor = { name: "GMT24", role: "system" };
  led = appendEvent(led, {
    id: "seed-open",
    seed: true,
    at: "2026-08-06T07:30:00.000Z",
    kind: "action",
    title: "Evidence history opened",
    detail: `Append-only chronicle for this group. Immutability ${immutable ? "on" : "off"} · engine ${EH_VERSION}.`,
    actor: actor.name,
    role: actor.role,
    fy: "FY2026",
    href: "/evidence-history",
    ref: "ledger",
  });
  if (groupId === "aetherion" || groupId === "meridian" || groupId === "helios") {
    FILES.forEach((f, i) => {
      led = appendEvent(led, {
        id: `seed-doc-${f.id}`,
        seed: true,
        at: isoFromLabel(f.uploaded, 2026),
        kind: "doc",
        title: f.name,
        detail: `${f.kind}${f.entity ? ` · ${f.entity}` : " · Group"} · ${f.size}${f.rows ? ` · ${f.rows} rows` : ""} · status ${f.status}. Linked to FY2026 snapshot ${EH_VERSION}.`,
        actor: f.by,
        role: "preparer",
        fy: "FY2026",
        href: "/data",
        ref: f.id,
      });
      void i;
    });
    ADJUSTMENTS.forEach((a) => {
      led = appendEvent(led, {
        id: `seed-adj-${a.id}`,
        seed: true,
        at: a.reviewer ? "2026-08-12T10:20:00.000Z" : "2026-08-13T08:10:00.000Z",
        kind: a.reviewer ? "change" : "comment",
        title: `${a.id} · ${a.category}`,
        detail: `${a.reason} Source ${a.sourceDoc} · account ${a.account} · ${a.status}${a.reviewer ? ` · reviewer ${a.reviewer}` : " · awaiting reviewer"}.`,
        actor: a.reviewer ?? a.preparer,
        role: a.reviewer ? "reviewer" : "preparer",
        fy: "FY2026",
        amount: a.amount,
        href: "/globe-income",
        ref: a.id,
      });
    });
    ISSUES.forEach((iss, i) => {
      led = appendEvent(led, {
        id: `seed-issue-${iss.id}`,
        seed: true,
        at: new Date(Date.UTC(2026, 7, 10, 11, i * 7)).toISOString(),
        kind: "action",
        title: `${iss.id} opened · ${iss.title}`,
        detail: `${iss.severity.toUpperCase()} · ${iss.area}${iss.entity ? ` · ${iss.entity}` : ""} · ${iss.detail}`,
        actor: iss.owner,
        role: "preparer",
        fy: "FY2026",
        href: "/issues",
        ref: iss.id,
      });
    });
    [...ACTIVITY].reverse().forEach((a, i) => {
      led = appendEvent(led, {
        id: `seed-act-${i}`,
        seed: true,
        at: isoFromLabel(a.when, 2026),
        kind: a.text.toLowerCase().includes("calculation") || a.text.toLowerCase().includes("gir") ? "calc" : "action",
        title: a.text,
        detail: `Recorded on the sign-off trail. ${a.who} · ${a.when}.`,
        actor: a.who,
        role: a.who.includes("AI") || a.who.includes("Autopilot") || a.who.includes("Hunter") ? "system" : "reviewer",
        fy: "FY2026",
        href: "/approvals",
      });
    });
    const calcs = calculateGroup(groupId);
    const topUp = calcs.reduce((s, c) => s + c.jurisdictionalTopUp, 0);
    const tu = calcs.filter((c) => c.jurisdictionalTopUp > 0).length;
    led = appendEvent(led, {
      id: "seed-calc-fy2026",
      seed: true,
      at: "2026-08-13T16:50:00.000Z",
      kind: "calc",
      title: "FY2026 engine snapshot",
      detail: `GMT24-CALC ${EH_VERSION} posted group jurisdictional top-up ${eur(topUp, true)} across ${tu} jurisdiction blend${tu === 1 ? "" : "s"}. Amounts are engine-posted, not LLM.`,
      actor: "GMT24-CALC",
      role: "engine",
      fy: "FY2026",
      amount: topUp,
      href: "/top-up",
      ref: "GMT24-CALC-2026.2",
    });
    led = appendEvent(led, {
      id: "seed-comment-vn",
      seed: true,
      at: "2026-08-13T17:05:00.000Z",
      kind: "comment",
      title: "Do not approve Vietnam on estimates",
      detail: "IQ-01 / IQ-02 remain blocks. Recapture and SBIE payroll stay open until source files land. Comment locked to the FY2026 working package.",
      actor: "M. Sato",
      role: "reviewer",
      fy: "FY2026",
      href: "/issues",
      ref: "IQ-01",
    });
  }
  return { ...led, immutable };
}

export function loadLedger(groupId: string): HistoryLedger {
  if (typeof window === "undefined") return seedLedger(groupId, true);
  try {
    const raw = localStorage.getItem(storageKey(groupId));
    if (!raw) {
      const seeded = seedLedger(groupId, true);
      localStorage.setItem(storageKey(groupId), JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as HistoryLedger;
    if (!parsed || !Array.isArray(parsed.events)) {
      const seeded = seedLedger(groupId, true);
      localStorage.setItem(storageKey(groupId), JSON.stringify(seeded));
      return seeded;
    }
    return {
      version: parsed.version || EH_VERSION,
      groupId,
      immutable: parsed.immutable !== false,
      events: parsed.events,
    };
  } catch {
    return seedLedger(groupId, true);
  }
}

export function saveLedger(ledger: HistoryLedger) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(ledger.groupId), JSON.stringify(ledger));
}

export function labelElection(key: string): string {
  const [id, iso] = splitSwitch(key);
  const e = electionById(id);
  if (!e) return key;
  return iso && iso !== id ? `${e.article} ${e.name} · ${iso}` : `${e.article} ${e.name}`;
}

export function sessionLabel(mode: ProductMode): string {
  return mode === "advisor" ? "Advisor" : "In-house";
}

export function kindTag(kind: HistoryKind): { label: string; cls: string } {
  if (kind === "doc") return { label: "Doc", cls: "tag-neutral" };
  if (kind === "change") return { label: "Change", cls: "tag-outline" };
  if (kind === "calc") return { label: "Calc", cls: "tag-accent" };
  if (kind === "comment") return { label: "Comment", cls: "tag-warn" };
  return { label: "Action", cls: "tag-ok" };
}

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

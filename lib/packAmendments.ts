import { JURISDICTION_PACKS } from "./model";
import type { OecdPackRow, OecdRefresh } from "./oecdCentralRecord";

/**
 * AI-assisted jurisdiction pack maintenance.
 *
 * Qualified IIR / QDMTT / QDMTT Safe Harbour status is legal data taken from the
 * OECD Central Record. The extractor reads the live Record and this module turns
 * the differences into field-level amendments a reviewer can accept, so the
 * signed pack stops being a constant that only a code change can move.
 *
 * Three rules make that safe. AI only ever proposes — nothing reaches the
 * calculation without a named reviewer accepting it. Absence from the Record can
 * never propose removing qualified status, because the OECD states that absence
 * is not a determination that a regime is unqualified. And anything that would
 * remove qualified status is marked as a downgrade and priced before acceptance,
 * because losing a QDMTT moves collection to another jurisdiction rather than
 * reducing anyone's tax.
 */

export type JurisdictionPack = (typeof JURISDICTION_PACKS)[number];

export type PackField = "iir" | "qdmtt" | "qdmttSH" | "utpr" | "qualified";

export const FIELD_LABEL: Record<PackField, string> = {
  iir: "Qualified IIR",
  qdmtt: "Qualified QDMTT",
  qdmttSH: "QDMTT Safe Harbour",
  utpr: "UTPR",
  qualified: "Qualified status text",
};

/** What the change does to the group if accepted. */
export type PackDirection = "upgrade" | "downgrade" | "text";

export type PackAmendmentStatus = "proposed" | "accepted" | "rejected";

export type PackAmendment = {
  id: string;
  iso: string;
  name: string;
  field: PackField;
  current: boolean | string;
  proposed: boolean | string;
  direction: PackDirection;
  /** Why the extractor believes the Record says this. */
  rationale: string;
  sourceUrl: string;
  asOf: string | null;
  detectedAt: string;
  status: PackAmendmentStatus;
  reviewer: string | null;
  decidedAt: string | null;
  /** Set when the change is refused on legal grounds rather than merely unreviewed. */
  guard: string | null;
};

export type PackOverlay = Record<string, Partial<JurisdictionPack>>;

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

/** Accepted amendments only. Proposed and rejected rows never reach the engine. */
export function overlayFrom(amendments: PackAmendment[]): PackOverlay {
  const out: PackOverlay = {};
  for (const a of amendments) {
    if (a.status !== "accepted" || a.guard) continue;
    out[a.iso] = { ...(out[a.iso] ?? {}), [a.field]: a.proposed };
  }
  return out;
}

export function effectivePack(iso: string, overlay?: PackOverlay): JurisdictionPack | undefined {
  const base = JURISDICTION_PACKS.find((p) => p.iso === iso);
  if (!base) return undefined;
  const patch = overlay?.[iso];
  return patch ? { ...base, ...patch } : base;
}

export function effectivePacks(overlay?: PackOverlay): JurisdictionPack[] {
  if (!overlay || !Object.keys(overlay).length) return JURISDICTION_PACKS;
  return JURISDICTION_PACKS.map((p) => (overlay[p.iso] ? { ...p, ...overlay[p.iso] } : p));
}

/** True where an accepted amendment currently moves this jurisdiction. */
export function amendedFields(iso: string, amendments: PackAmendment[]): PackField[] {
  return amendments.filter((a) => a.iso === iso && a.status === "accepted" && !a.guard).map((a) => a.field);
}

// ---------------------------------------------------------------------------
// Proposal generation
// ---------------------------------------------------------------------------

const ABSENCE_GUARD =
  "Not listed on the Central Record. The OECD states that absence is not a determination that a regime is unqualified, so this cannot be applied automatically — it needs a legal conclusion on the local instrument.";

function id(iso: string, field: PackField) {
  return `PA-${iso}-${field}`;
}

function boolProposal(
  row: OecdPackRow,
  field: Exclude<PackField, "qualified">,
  current: boolean,
  live: boolean,
  refresh: Pick<OecdRefresh, "asOf" | "sourceUrl" | "fetchedAt">,
): PackAmendment | null {
  if (current === live) return null;
  const upgrade = live && !current;
  // Adding a qualified status needs a positive listing, so silence proposes nothing.
  if (upgrade && !row.oecd.cited) return null;
  // Removing one is surfaced rather than dropped — a jurisdiction falling off the
  // Record is the case a reviewer most needs to see — but it can never be applied
  // automatically, because the OECD states absence is not a determination.
  const guard = !upgrade && !row.oecd.cited ? ABSENCE_GUARD : null;
  return {
    id: id(row.iso, field),
    iso: row.iso,
    name: row.name,
    field,
    current,
    proposed: live,
    direction: upgrade ? "upgrade" : "downgrade",
    rationale: upgrade
      ? `${row.name} appears in the ${FIELD_LABEL[field]} table on the Central Record but the signed pack has it off.`
      : `${row.name} is on the Central Record but was not matched in the ${FIELD_LABEL[field]} table, while the signed pack has it on. Confirm against the Record before lowering a qualified status.`,
    sourceUrl: refresh.sourceUrl,
    asOf: refresh.asOf,
    detectedAt: refresh.fetchedAt,
    status: "proposed",
    reviewer: null,
    decidedAt: null,
    guard,
  };
}

/**
 * Turn one OECD extract into field-level amendments. Only differences produce
 * rows, so a clean refresh proposes nothing.
 */
export function proposalsFromRefresh(refresh: OecdRefresh): PackAmendment[] {
  if (!refresh.ok) return [];
  const out: PackAmendment[] = [];
  for (const row of refresh.rows) {
    const iir = boolProposal(row, "iir", row.pack.iir, row.oecd.iir, refresh);
    if (iir) out.push(iir);
    const qdmtt = boolProposal(row, "qdmtt", row.pack.qdmtt, row.oecd.qdmtt, refresh);
    if (qdmtt) out.push(qdmtt);
    const sh = boolProposal(row, "qdmttSH", row.pack.qdmttSH, row.oecd.qdmttSH, refresh);
    if (sh) out.push(sh);
    if (row.oecd.sbs && !/side-by-side|sbs/i.test(row.pack.qualified)) {
      out.push({
        id: id(row.iso, "qualified"),
        iso: row.iso,
        name: row.name,
        field: "qualified",
        current: row.pack.qualified,
        proposed: `${row.pack.qualified} · Qualified Side-by-Side`,
        direction: "text",
        rationale: `${row.name} appears in the Qualified Side-by-Side table on the Central Record and the pack's qualified-status text does not mention it.`,
        sourceUrl: refresh.sourceUrl,
        asOf: refresh.asOf,
        detectedAt: refresh.fetchedAt,
        status: "proposed",
        reviewer: null,
        decidedAt: null,
        guard: null,
      });
    }
  }
  return out;
}

/**
 * Fold a fresh scan into the stored set. Existing decisions survive unless the
 * Record now proposes a different value, in which case the row reopens for
 * review rather than silently keeping an answer given about older facts.
 */
export function mergeProposals(stored: PackAmendment[], incoming: PackAmendment[]): PackAmendment[] {
  const out = [...stored];
  for (const next of incoming) {
    const i = out.findIndex((a) => a.id === next.id);
    if (i < 0) {
      out.push(next);
      continue;
    }
    const prev = out[i];
    const sameTarget = String(prev.proposed) === String(next.proposed) && String(prev.current) === String(next.current);
    out[i] = sameTarget
      ? { ...prev, asOf: next.asOf, detectedAt: next.detectedAt, guard: next.guard, rationale: next.rationale }
      : next;
  }
  return out;
}

export function pendingCount(amendments: PackAmendment[]): number {
  return amendments.filter((a) => a.status === "proposed" && !a.guard).length;
}

export function blockedCount(amendments: PackAmendment[]): number {
  return amendments.filter((a) => a.guard && a.status !== "rejected").length;
}

export function acceptedAmendments(amendments: PackAmendment[]): PackAmendment[] {
  return amendments.filter((a) => a.status === "accepted" && !a.guard);
}

// ---------------------------------------------------------------------------
// Impact
// ---------------------------------------------------------------------------

export type PackImpact = {
  topUp: number;
  qdmtt: number;
  iir: number;
  utpr: number;
  topUpDelta: number;
  qdmttDelta: number;
  iirDelta: number;
  utprDelta: number;
  /** Plain reading of what moved, for the reviewer rather than the developer. */
  summary: string;
};

export type PackTotals = { topUp: number; qdmtt: number; iir: number; utpr: number };

function money(n: number) {
  return Math.round(n);
}

/**
 * Compare group collection under the candidate overlay against the current one.
 * A qualified QDMTT rarely changes how much top-up arises — it changes which
 * jurisdiction collects it, which is exactly what a reviewer needs to see.
 */
export function impactFrom(base: PackTotals, next: PackTotals): PackImpact {
  const topUpDelta = money(next.topUp - base.topUp);
  const qdmttDelta = money(next.qdmtt - base.qdmtt);
  const iirDelta = money(next.iir - base.iir);
  const utprDelta = money(next.utpr - base.utpr);
  const bits: string[] = [];
  const fmt = (n: number) => `${n > 0 ? "+" : "−"}$${Math.abs(n).toLocaleString("en-GB")}`;
  if (qdmttDelta) bits.push(`QDMTT ${fmt(qdmttDelta)}`);
  if (iirDelta) bits.push(`IIR ${fmt(iirDelta)}`);
  if (utprDelta) bits.push(`UTPR ${fmt(utprDelta)}`);
  let summary: string;
  if (!topUpDelta && !bits.length) summary = "No change to group top-up or to who collects it.";
  else if (!topUpDelta) summary = `Group top-up unchanged — collection moves: ${bits.join(", ")}.`;
  else summary = `Group top-up ${fmt(topUpDelta)}${bits.length ? ` · ${bits.join(", ")}` : ""}.`;
  return {
    topUp: next.topUp,
    qdmtt: next.qdmtt,
    iir: next.iir,
    utpr: next.utpr,
    topUpDelta,
    qdmttDelta,
    iirDelta,
    utprDelta,
    summary,
  };
}

/** Overlay with one candidate amendment layered on, for pricing before acceptance. */
export function overlayWith(overlay: PackOverlay, a: PackAmendment): PackOverlay {
  return { ...overlay, [a.iso]: { ...(overlay[a.iso] ?? {}), [a.field]: a.proposed } };
}

/** Overlay with one accepted amendment removed, for pricing a revert. */
export function overlayWithout(amendments: PackAmendment[], drop: PackAmendment): PackOverlay {
  return overlayFrom(amendments.filter((a) => a.id !== drop.id));
}

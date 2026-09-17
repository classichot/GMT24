/**
 * Case versions. A mission never runs against "whatever the workspace shows
 * right now"; it runs against a pinned snapshot whose content hash identifies
 * the exact inputs. Runs, checks, decisions and packs all cite that hash, so a
 * changed input is visible as a changed version rather than a silent drift.
 */
import { RULES, GROUPS, type Group } from "../model";
import { SEEDS, seedIdFor } from "../seeds";
import { fnv1a64 } from "../evidenceHistory";
import type { CalcInputs } from "../ai/calc";
import type { CaseSnapshot, CaseVersion, RuleVersionRef } from "./types";

export const AGI_ENGINE = "GMT24-CALC 2026.2";

export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}

export function hashOf(v: unknown): string {
  return fnv1a64(stableStringify(v));
}

export function ruleVersionRefs(): RuleVersionRef[] {
  return RULES.filter((r) => r.status === "active").map((r) => ({ id: r.id, version: r.version, jurisdiction: r.jurisdiction }));
}

function groupFor(groupId: string): Group {
  const sid = seedIdFor(groupId);
  return GROUPS.find((g) => g.id === groupId) ?? SEEDS[sid].group;
}

/** The part of a snapshot that changes the engine result. Provenance fields are excluded. */
export function caseHash(s: CaseSnapshot): string {
  return hashOf({
    groupId: s.groupId,
    fy: s.fy,
    electionsOn: s.electionsOn,
    approvedMaps: s.approvedMaps,
    sbieClaim: s.sbieClaim,
    scenario: s.scenario,
    yearLocks: s.yearRecords.filter((r) => r.locked).map((r) => ({ fy: r.fy, electionsOn: r.electionsOn, topUp: r.groupTopUp })),
    packOverlay: s.packOverlay,
    ingestStatus: s.ingestStatus,
    ruleVersions: s.ruleVersions,
  });
}

export function versionOf(snapshot: CaseSnapshot): CaseVersion {
  return { hash: caseHash(snapshot), snapshot };
}

export type SnapshotInputs = Omit<CaseSnapshot, "groupName" | "upeIso" | "jurisdictions" | "entityIds" | "ruleVersions" | "takenAt" | "origin"> & { origin?: CaseSnapshot["origin"] };

/** Build a snapshot from workspace (or gateway-supplied) state. */
export function buildSnapshot(i: SnapshotInputs): CaseSnapshot {
  const sid = seedIdFor(i.groupId);
  const seed = SEEDS[sid];
  const g = groupFor(i.groupId);
  return {
    groupId: i.groupId,
    groupName: g.name,
    fy: i.fy,
    upeIso: g.upeIso,
    jurisdictions: [...new Set(seed.entities.map((e) => e.iso))],
    entityIds: seed.entities.map((e) => e.id),
    electionsOn: i.electionsOn ?? {},
    approvedMaps: i.approvedMaps ?? {},
    sbieClaim: i.sbieClaim ?? {},
    scenario: i.scenario ?? { boiExtend: false, payrollTh: 0, tpMargin: 3 },
    yearRecords: i.yearRecords ?? [],
    packOverlay: i.packOverlay ?? {},
    ingestStatus: i.ingestStatus ?? "ready",
    ruleVersions: ruleVersionRefs(),
    origin: i.origin ?? "workspace",
    takenAt: new Date().toISOString(),
  };
}

/** What the gateway uses when no workspace state has been pinned for the group: the seed's Core baseline. */
export function seedDefaultSnapshot(groupId: string): CaseSnapshot {
  const g = groupFor(groupId);
  return buildSnapshot({
    groupId,
    fy: g.fy,
    electionsOn: {},
    approvedMaps: {},
    sbieClaim: {},
    scenario: { boiExtend: false, payrollTh: 0, tpMargin: 3 },
    yearRecords: [],
    packOverlay: {},
    ingestStatus: "ready",
    origin: "seed-default",
  });
}

export function toCalcInputs(s: CaseSnapshot): CalcInputs {
  return {
    groupId: s.groupId,
    fy: s.fy,
    electionsOn: s.electionsOn,
    approvedMaps: s.approvedMaps,
    yearRecords: s.yearRecords,
    packOverlay: s.packOverlay,
    scenario: s.scenario,
    sbieClaim: s.sbieClaim,
  };
}

export function shortHash(h: string) {
  return h.slice(0, 8);
}

/** Human summary of what differs between two case versions. */
export function describeCaseDiff(a: CaseSnapshot, b: CaseSnapshot): string[] {
  const out: string[] = [];
  const keys = (o: Record<string, boolean>) => Object.entries(o).filter(([, v]) => v).map(([k]) => k).sort();
  const ea = keys(a.electionsOn), eb = keys(b.electionsOn);
  const eOn = eb.filter((k) => !ea.includes(k)), eOff = ea.filter((k) => !eb.includes(k));
  if (eOn.length) out.push(`Elections switched on: ${eOn.join(", ")}`);
  if (eOff.length) out.push(`Elections switched off: ${eOff.join(", ")}`);
  const ma = keys(a.approvedMaps), mb = keys(b.approvedMaps);
  const mOn = mb.filter((k) => !ma.includes(k));
  if (mOn.length) out.push(`Mappings approved: ${mOn.join(", ")}`);
  for (const iso of new Set([...Object.keys(a.sbieClaim), ...Object.keys(b.sbieClaim)])) {
    if ((a.sbieClaim[iso] ?? "max") !== (b.sbieClaim[iso] ?? "max")) out.push(`SBIE claim ${iso}: ${a.sbieClaim[iso] ?? "max"} → ${b.sbieClaim[iso] ?? "max"}`);
  }
  if (stableStringify(a.scenario) !== stableStringify(b.scenario)) out.push(`Simulator assumptions changed (${JSON.stringify(b.scenario)})`);
  if (a.ingestStatus !== b.ingestStatus) out.push(`Data pack ${a.ingestStatus} → ${b.ingestStatus}`);
  if (a.fy !== b.fy) out.push(`Fiscal year ${a.fy} → ${b.fy}`);
  const ra = new Map(a.ruleVersions.map((r) => [r.id, r.version]));
  for (const r of b.ruleVersions) if (ra.get(r.id) && ra.get(r.id) !== r.version) out.push(`Rule ${r.id} ${ra.get(r.id)} → ${r.version}`);
  const la = a.yearRecords.filter((r) => r.locked).length, lb = b.yearRecords.filter((r) => r.locked).length;
  if (la !== lb) out.push(`Locked years ${la} → ${lb}`);
  return out;
}

/**
 * Evidence store for missions. Every item is chained to the previous one with
 * a content hash, so a record cannot be edited or dropped without breaking the
 * chain. Items cite the case version they were produced against plus the rule
 * versions and source documents they rely on.
 */
import { fnv1a64 } from "../evidenceHistory";
import type { AgentClientId, EvidenceItem, EvidenceKind, MissionRecord, RuleVersionRef } from "./types";

export const AGI_EVIDENCE_GENESIS = "GMT24-AGI-EV-v1";

export type EvidenceDraft = {
  kind: EvidenceKind;
  title: string;
  detail: string;
  href?: string;
  refs?: string[];
  ruleVersions?: RuleVersionRef[];
  by: AgentClientId | string;
  supports?: string[];
  caseHash?: string;
  at?: string;
};

function canonical(e: Omit<EvidenceItem, "hash">): string {
  return [
    e.id, String(e.seq), e.at, e.kind, e.title, e.detail, e.href ?? "", e.refs.join(","),
    (e.ruleVersions ?? []).map((r) => `${r.id}:${r.version}`).join(","), e.caseHash, String(e.by), e.supports.join(","), e.prevHash,
  ].join("|");
}

export function stampEvidence(prev: string, body: Omit<EvidenceItem, "hash">): string {
  return fnv1a64(`${prev}>${canonical(body)}`);
}

export function appendEvidence(m: MissionRecord, d: EvidenceDraft): MissionRecord {
  const prev = m.evidence.length ? m.evidence[m.evidence.length - 1].hash : AGI_EVIDENCE_GENESIS;
  const seq = m.evidence.length + 1;
  const body: Omit<EvidenceItem, "hash"> = {
    id: `ev-${m.id}-${seq.toString(36).padStart(3, "0")}`,
    seq,
    kind: d.kind,
    title: d.title,
    detail: d.detail,
    href: d.href,
    refs: [...new Set(d.refs ?? [])],
    ruleVersions: d.ruleVersions,
    caseHash: d.caseHash ?? m.case.hash,
    by: d.by,
    at: d.at ?? new Date().toISOString(),
    prevHash: prev,
    supports: d.supports ?? [],
  };
  const item: EvidenceItem = { ...body, hash: stampEvidence(prev, body) };
  return { ...m, evidence: [...m.evidence, item] };
}

export function verifyEvidence(items: EvidenceItem[]): { ok: boolean; brokenAt: number | null } {
  let prev = AGI_EVIDENCE_GENESIS;
  for (let i = 0; i < items.length; i++) {
    const { hash, ...rest } = items[i];
    if (rest.prevHash !== prev || rest.seq !== i + 1 || stampEvidence(prev, rest) !== hash) return { ok: false, brokenAt: i };
    prev = hash;
  }
  return { ok: true, brokenAt: null };
}

/** Evidence items that support a finding, check, step or decision id. */
export function evidenceFor(m: MissionRecord, id: string): EvidenceItem[] {
  return m.evidence.filter((e) => e.supports.includes(id) || e.refs.includes(id));
}

export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  source: "Source",
  transformation: "Transformation",
  calculation: "Calculation",
  alternative: "Alternative",
  decision: "Decision",
  review: "Review",
  authority: "Authority",
  tool: "Tool call",
};

export function evidenceKindTag(kind: EvidenceKind): string {
  switch (kind) {
    case "calculation": return "tag-accent";
    case "decision": return "tag-ok";
    case "review": return "tag-warn";
    case "authority": return "tag-outline";
    case "alternative": return "tag-neutral";
    case "tool": return "tag-neutral";
    default: return "tag-outline";
  }
}

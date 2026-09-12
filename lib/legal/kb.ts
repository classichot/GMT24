/**
 * Adapter from legal passages to the Co-Pilot knowledge-base entry shape, so
 * the existing `retrieve()` path (Co-Pilot, specialist, search_knowledge tool)
 * reaches the corpus without a second retrieval pipeline.
 */
import type { Authority, KbEntry } from "../ai/types";
import { LEGAL_PASSAGES, legalHref, sourceOf } from "./index";
import type { LegalPassage, LegalSource } from "./types";

function authorityFor(s: LegalSource): Authority {
  if (s.authority === "TH") return "thai-law";
  if (s.authority !== "OECD") return "domestic-law";
  if (s.kind === "model-rules") return "oecd-model";
  if (s.kind === "commentary") return "oecd-commentary";
  return "oecd-ag";
}

function year(iso: string) {
  return Number(iso.slice(0, 4));
}

export function legalKbEntry(p: LegalPassage): KbEntry {
  const s = sourceOf(p);
  const status: KbEntry["status"] = s.status === "superseded" ? "superseded" : p.textKind === "pending" || s.status === "pending" || s.status === "consultation" ? "draft" : p.textKind === "summary" ? "guidance" : "final";
  return {
    id: p.id,
    title: p.heading,
    authority: authorityFor(s),
    provision: `${s.short} ${p.ref}`,
    passage: `${p.text}${p.note ? ` Note: ${p.note}` : ""} (${p.textKind === "pending" ? "instrument not yet issued" : p.textKind === "summary" ? "GMT24 summary" : "GMT24 paraphrase — confirm against the source"}.)`,
    status,
    publishedAt: s.publishedAt,
    effectiveFrom: p.effectiveFrom,
    applicableFrom: year(p.effectiveFrom),
    applicableTo: p.effectiveTo ? year(p.effectiveTo) : null,
    jurisdictions: [p.jurisdiction],
    topics: p.topics,
    ruleIds: p.ruleIds,
    version: s.version,
    versions: [{ version: s.version, publishedAt: s.publishedAt, note: `Legal corpus · ${s.title}` }],
    url: s.url,
    href: legalHref(p),
  };
}

let cache: KbEntry[] | null = null;

/** Every corpus passage as a knowledge-base entry (memoised; the corpus is static). */
export function legalKbEntries(): KbEntry[] {
  if (!cache) cache = LEGAL_PASSAGES.map(legalKbEntry);
  return cache;
}

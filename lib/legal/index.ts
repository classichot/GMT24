/**
 * Legal corpus — passage-level texts behind the rule pack, the Thai instrument
 * list, the election register and the OECD-vs-RD gap review. Pure data plus
 * lookup and retrieval; no engine imports, so it is safe on the client, in the
 * Co-Pilot retrieval path and in the AGI tool layer.
 */
import { LEGAL_SOURCES, legalSourceById } from "./sources";
import { OECD_PASSAGES } from "./passages/oecd";
import { DOMESTIC_PASSAGES } from "./passages/domestic";
import type { LegalAuthority, LegalHit, LegalPassage, LegalSearchOptions, LegalSource } from "./types";

export * from "./types";
export { LEGAL_SOURCES, legalSourceById };

export const LEGAL_PASSAGES: LegalPassage[] = [...OECD_PASSAGES, ...DOMESTIC_PASSAGES];

const BY_ID = new Map(LEGAL_PASSAGES.map((p) => [p.id, p]));
const SOURCE_BY_ID = new Map(LEGAL_SOURCES.map((s) => [s.id, s]));

export function passageById(id: string): LegalPassage | undefined {
  return BY_ID.get(id);
}

export function sourceOf(p: LegalPassage): LegalSource {
  const s = SOURCE_BY_ID.get(p.sourceId);
  if (!s) throw new Error(`Legal passage ${p.id} points at unknown source ${p.sourceId}`);
  return s;
}

export function authorityOf(p: LegalPassage): LegalAuthority {
  return sourceOf(p).authority;
}

export const AUTHORITY_NAME: Record<LegalAuthority, string> = {
  OECD: "OECD / Inclusive Framework",
  TH: "Thailand — Revenue Department",
  IE: "Ireland",
  JP: "Japan",
  US: "United States",
};

export const TEXT_KIND_LABEL: Record<LegalPassage["textKind"], string> = {
  paraphrase: "GMT24 paraphrase — confirm against the source",
  summary: "GMT24 summary of the instrument",
  pending: "Instrument not yet issued",
};

/* ------------------------------------------------------------------ */
/* Keyed lookups                                                       */
/* ------------------------------------------------------------------ */

export function passagesForRule(ruleId: string): LegalPassage[] {
  return LEGAL_PASSAGES.filter((p) => p.ruleIds.includes(ruleId));
}

export function passagesForElection(electionId: string): LegalPassage[] {
  return LEGAL_PASSAGES.filter((p) => p.electionIds.includes(electionId));
}

export function passagesForInstrument(instrumentId: string): LegalPassage[] {
  return LEGAL_PASSAGES.filter((p) => p.instrumentIds.includes(instrumentId));
}

export function passagesForGap(gapId: string): LegalPassage[] {
  return LEGAL_PASSAGES.filter((p) => p.gapIds.includes(gapId));
}

export function passagesForJurisdiction(iso: string): LegalPassage[] {
  return LEGAL_PASSAGES.filter((p) => p.jurisdiction === iso);
}

export function passagesForSource(sourceId: string): LegalPassage[] {
  return LEGAL_PASSAGES.filter((p) => p.sourceId === sourceId);
}

/* ------------------------------------------------------------------ */
/* Effective dating                                                    */
/* ------------------------------------------------------------------ */

/** True when the passage is in force on the given ISO date and its source is not superseded. */
export function inForce(p: LegalPassage, asOf: string): boolean {
  const s = SOURCE_BY_ID.get(p.sourceId);
  if (s?.status === "superseded") return false;
  if (p.textKind === "pending") return false;
  if (p.effectiveFrom > asOf) return false;
  if (p.effectiveTo && p.effectiveTo < asOf) return false;
  return true;
}

/** First day of a fiscal year label such as "FY2026"; falls back to today. */
export function fyStartDate(fy?: string | null): string {
  const y = fy?.match(/\d{4}/)?.[0];
  return y ? `${y}-01-01` : new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Retrieval                                                           */
/* ------------------------------------------------------------------ */

const STOP = new Set(["the", "a", "an", "is", "are", "of", "to", "for", "in", "on", "and", "or", "what", "why", "how", "does", "do", "we", "our", "this", "that", "it", "be", "can", "should", "with", "from", "at", "by", "under", "when", "which", "where"]);
/** Words every Pillar Two passage contains; never enough on their own. */
const GENERIC = new Set(["tax", "taxes", "rate", "rates", "income", "group", "entity", "entities", "rule", "rules", "pillar", "two", "oecd", "globe", "year", "fiscal", "jurisdiction", "jurisdictions", "amount", "percentage", "apply", "applies", "constituent", "top-up", "topup", "art", "article"]);

export function legalTokens(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9%.\u0E00-\u0E7F\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((w) => w && !STOP.has(w) && w.length > 1);
}

/** Article-style pins mentioned in a text: "Art. 4.4.4", "Article 5.3", "s 54", "Section 57", "Notification No. 4", "§2.7". */
export function citationsIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\b(?:art(?:icle)?s?\.?)\s*(\d{1,2}(?:\.\d{1,2}){1,3}(?:\([a-z]\))?)/gi)) out.add(`art ${m[1].toLowerCase()}`);
  for (const m of text.matchAll(/\b(?:s|ss|section|sections)\s*\.?\s*(\d{1,3})/gi)) out.add(`s ${m[1]}`);
  for (const m of text.matchAll(/notification\s+no\.?\s*(\d{1,2})/gi)) out.add(`notification ${m[1]}`);
  for (const m of text.matchAll(/§\s*(\d{1,2}(?:\.\d{1,2})?)/g)) out.add(`§${m[1]}`);
  return [...out];
}

/** Pins a passage answers to: its own `ref` plus any article numbers quoted in it. */
function passagePins(p: LegalPassage): string[] {
  const pins = new Set<string>();
  for (const c of citationsIn(p.ref)) pins.add(c);
  // Ranges such as "Art. 4.4.2–4.4.3" / "ss 54–58" also cover the end of the range and the numbers between.
  for (const m of p.ref.matchAll(/(\d{1,2}(?:\.\d{1,2}){1,3})\s*[–-]\s*(\d{1,2}(?:\.\d{1,2}){1,3})/g)) {
    pins.add(`art ${m[2]}`);
    const a = m[1].split(".").map(Number);
    const b = m[2].split(".").map(Number);
    if (a.length === b.length && a.slice(0, -1).join(".") === b.slice(0, -1).join(".")) {
      for (let i = a[a.length - 1]; i <= b[b.length - 1]; i++) pins.add(`art ${[...a.slice(0, -1), i].join(".")}`);
    }
  }
  for (const m of p.ref.matchAll(/\bss?\s*(\d{1,3})\s*[–-]\s*(\d{1,3})/gi)) {
    for (let i = Number(m[1]); i <= Number(m[2]); i++) pins.add(`s ${i}`);
  }
  return [...pins];
}

/** True when `pin` (e.g. "art 4.4") is the same as or a parent of a passage pin (e.g. "art 4.4.4"). */
function pinMatches(pin: string, passagePin: string) {
  if (pin === passagePin) return true;
  if (pin.startsWith("art ") && passagePin.startsWith("art ")) {
    const la = pin.match(/\(([a-z])\)$/)?.[1];
    const lb = passagePin.match(/\(([a-z])\)$/)?.[1];
    if (la && lb && la !== lb) return false;
    const a = pin.slice(4).replace(/\([a-z]\)$/, "");
    const b = passagePin.slice(4).replace(/\([a-z]\)$/, "");
    return b === a || b.startsWith(`${a}.`) || a.startsWith(`${b}.`);
  }
  return false;
}

/** Passages whose ref covers a citation written in free text, e.g. "Art. 4.4.4" or "s 57". Domestic pins need an authority hint or return every match. */
export function resolveCitation(text: string, authority?: LegalAuthority): LegalPassage[] {
  const pins = citationsIn(text);
  if (!pins.length) return [];
  return LEGAL_PASSAGES.filter((p) => {
    if (authority && authorityOf(p) !== authority) return false;
    const own = passagePins(p);
    return pins.some((pin) => own.some((o) => pinMatches(pin, o)));
  });
}

/**
 * Rank passages against a question. Out-of-force passages are returned with
 * `current = false` so the caller can say "superseded / not yet in force"
 * rather than cite silently. Score: exact topic 3, partial topic 2, body 1,
 * cited article 4, jurisdiction match 1; keyed filters (rule / election /
 * instrument) are hard filters.
 */
export function searchPassages(query: string, opts: LegalSearchOptions = {}): LegalHit[] {
  const toks = legalTokens(query);
  const pins = citationsIn(query);
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10);
  const out: LegalHit[] = [];
  for (const p of LEGAL_PASSAGES) {
    const source = sourceOf(p);
    if (opts.authority === "domestic" ? source.authority === "OECD" : opts.authority && source.authority !== opts.authority) continue;
    if (opts.jurisdiction && p.jurisdiction !== "*" && p.jurisdiction !== opts.jurisdiction) continue;
    if (opts.ruleId && !p.ruleIds.includes(opts.ruleId)) continue;
    if (opts.electionId && !p.electionIds.includes(opts.electionId)) continue;
    if (opts.instrumentId && !p.instrumentIds.includes(opts.instrumentId)) continue;

    let score = 0;
    let hit = 0;
    let topicHit = false;
    const hay = `${p.heading} ${p.ref} ${p.text} ${p.topics.join(" ")} ${source.short}`.toLowerCase();
    for (const t of toks) {
      if (p.topics.some((x) => x === t)) { score += 3; hit += 1; topicHit = true; }
      else if (!GENERIC.has(t) && t.length >= 4 && p.topics.some((x) => x.includes(t) || t.includes(x))) { score += 2; hit += 1; topicHit = true; }
      else if (hay.includes(t)) { score += 1; hit += 1; }
    }
    const own = pins.length ? passagePins(p) : [];
    if (pins.some((pin) => own.some((o) => pinMatches(pin, o)))) { score += 4; topicHit = true; }
    if (opts.jurisdiction && p.jurisdiction === opts.jurisdiction) score += 1;

    const keyed = Boolean(opts.ruleId || opts.electionId || opts.instrumentId);
    const relevant = keyed || (toks.length > 0 && score >= 3 && (topicHit || hit / Math.max(1, toks.length) >= 0.5));
    if (!relevant) continue;
    out.push({ passage: p, source, score, current: inForce(p, asOf) });
  }
  return out
    .sort((a, b) => b.score - a.score || Number(b.current) - Number(a.current) || a.passage.id.localeCompare(b.passage.id))
    .slice(0, opts.limit ?? 6);
}

/* ------------------------------------------------------------------ */
/* Citations and coverage                                              */
/* ------------------------------------------------------------------ */

export function legalHref(p: LegalPassage) {
  return `/legal?p=${encodeURIComponent(p.id)}`;
}

/** Citation label such as "Model Rules Art. 4.4.4" and the in-app link to the passage. */
export function citeLegal(p: LegalPassage): { label: string; href: string; url: string; authority: LegalAuthority } {
  const s = sourceOf(p);
  return { label: `${s.short} ${p.ref}`, href: legalHref(p), url: s.url, authority: s.authority };
}

export type LegalCoverage = {
  passages: number;
  sources: number;
  byAuthority: Record<LegalAuthority, { sources: number; passages: number }>;
  paraphrase: number;
  summary: number;
  pending: number;
  ruleIds: string[];
  electionIds: string[];
  instrumentIds: string[];
  gapIds: string[];
};

export function legalCoverage(): LegalCoverage {
  const byAuthority = { OECD: { sources: 0, passages: 0 }, TH: { sources: 0, passages: 0 }, IE: { sources: 0, passages: 0 }, JP: { sources: 0, passages: 0 }, US: { sources: 0, passages: 0 } } as LegalCoverage["byAuthority"];
  for (const s of LEGAL_SOURCES) byAuthority[s.authority].sources += 1;
  for (const p of LEGAL_PASSAGES) byAuthority[authorityOf(p)].passages += 1;
  const uniq = (xs: string[]) => [...new Set(xs)].sort();
  return {
    passages: LEGAL_PASSAGES.length,
    sources: LEGAL_SOURCES.length,
    byAuthority,
    paraphrase: LEGAL_PASSAGES.filter((p) => p.textKind === "paraphrase").length,
    summary: LEGAL_PASSAGES.filter((p) => p.textKind === "summary").length,
    pending: LEGAL_PASSAGES.filter((p) => p.textKind === "pending").length,
    ruleIds: uniq(LEGAL_PASSAGES.flatMap((p) => p.ruleIds)),
    electionIds: uniq(LEGAL_PASSAGES.flatMap((p) => p.electionIds)),
    instrumentIds: uniq(LEGAL_PASSAGES.flatMap((p) => p.instrumentIds)),
    gapIds: uniq(LEGAL_PASSAGES.flatMap((p) => p.gapIds)),
  };
}

/**
 * Cross-reference check: every id a passage points at must exist in the layer
 * it names. Kept apart from the corpus index because it pulls in the engine
 * via the Thai modules. Surfaced on the /legal coverage panel and run in the
 * build-time smoke test.
 */
import { RULES } from "../model";
import { ELECTIONS } from "../elections";
import { THAI_INSTRUMENTS } from "../thailand";
import { GAP_IDS } from "../thaiGap";
import { LEGAL_PASSAGES, LEGAL_SOURCES, legalSourceById } from "./index";

export type LegalIntegrity = {
  ok: boolean;
  unknownRules: string[];
  unknownElections: string[];
  unknownInstruments: string[];
  unknownGaps: string[];
  unknownSources: string[];
  duplicatePassageIds: string[];
  /** Rule / election / instrument ids that no passage covers. */
  rulesWithoutPassages: string[];
  electionsWithoutPassages: string[];
  instrumentsWithoutPassages: string[];
};

export function legalIntegrity(): LegalIntegrity {
  const rules = new Set(RULES.map((r) => r.id));
  const elections = new Set(ELECTIONS.map((e) => e.id));
  const instruments = new Set(THAI_INSTRUMENTS.map((i) => i.id));
  const gaps = new Set(GAP_IDS);
  const uniq = (xs: string[]) => [...new Set(xs)].sort();

  const seen = new Set<string>();
  const dup: string[] = [];
  for (const p of LEGAL_PASSAGES) { if (seen.has(p.id)) dup.push(p.id); seen.add(p.id); }

  const coveredRules = new Set(LEGAL_PASSAGES.flatMap((p) => p.ruleIds));
  const coveredElections = new Set(LEGAL_PASSAGES.flatMap((p) => p.electionIds));
  const coveredInstruments = new Set([...LEGAL_PASSAGES.flatMap((p) => p.instrumentIds), ...LEGAL_SOURCES.flatMap((s) => s.instrumentIds ?? [])]);

  const out: LegalIntegrity = {
    ok: false,
    unknownRules: uniq(LEGAL_PASSAGES.flatMap((p) => p.ruleIds).filter((id) => !rules.has(id))),
    unknownElections: uniq(LEGAL_PASSAGES.flatMap((p) => p.electionIds).filter((id) => !elections.has(id))),
    unknownInstruments: uniq([...LEGAL_PASSAGES.flatMap((p) => p.instrumentIds), ...LEGAL_SOURCES.flatMap((s) => s.instrumentIds ?? [])].filter((id) => !instruments.has(id))),
    unknownGaps: uniq(LEGAL_PASSAGES.flatMap((p) => p.gapIds).filter((id) => !gaps.has(id))),
    unknownSources: uniq(LEGAL_PASSAGES.map((p) => p.sourceId).filter((id) => !legalSourceById(id))),
    duplicatePassageIds: uniq(dup),
    rulesWithoutPassages: RULES.map((r) => r.id).filter((id) => !coveredRules.has(id)),
    electionsWithoutPassages: ELECTIONS.map((e) => e.id).filter((id) => !coveredElections.has(id)),
    instrumentsWithoutPassages: THAI_INSTRUMENTS.map((i) => i.id).filter((id) => !coveredInstruments.has(id)),
  };
  out.ok = !out.unknownRules.length && !out.unknownElections.length && !out.unknownInstruments.length && !out.unknownGaps.length && !out.unknownSources.length && !out.duplicatePassageIds.length;
  return out;
}

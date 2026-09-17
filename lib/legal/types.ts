/**
 * Legal corpus types. The corpus is the passage-level layer beneath the rule
 * pack (`RULES`), the Thai instrument list (`THAI_INSTRUMENTS`), the election
 * register (`ELECTIONS`) and the OECD-vs-RD gap review (`GAP_ITEMS`): every
 * passage is keyed to the ids those layers already use, so the rulebook, the
 * AGI compliance review and the Co-Pilot resolve to the same text.
 *
 * Passages are GMT24 paraphrases of the instrument, never a substitute for it.
 * Each carries its own effective window so a superseded or not-yet-effective
 * passage is never presented as current law.
 */

export type LegalAuthority = "OECD" | "TH" | "IE" | "JP" | "US";

export type LegalSourceKind =
  | "model-rules"
  | "commentary"
  | "admin-guidance"
  | "safe-harbour"
  | "gir"
  | "central-record"
  | "law"
  | "decree"
  | "notification"
  | "announcement"
  | "guidance";

export type LegalSourceStatus = "in-force" | "superseded" | "pending" | "consultation";

export type LegalSource = {
  id: string;
  authority: LegalAuthority;
  /** Full title as published. */
  title: string;
  /** Short label used in citations, e.g. "Model Rules", "AG Feb 2023", "Decree B.E. 2567". */
  short: string;
  kind: LegalSourceKind;
  url: string;
  publishedAt: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  language: "en" | "th" | "en/th" | "ja";
  version: string;
  status: LegalSourceStatus;
  /** `THAI_INSTRUMENTS` ids this source is the text of. */
  instrumentIds?: string[];
  note?: string;
};

/**
 * `paraphrase` — GMT24 restatement of a specific provision, confirm against the source.
 * `summary`    — GMT24 summary of an instrument or chapter rather than a single provision.
 * `pending`    — the instrument is announced or delegated but its text is not yet issued.
 */
export type LegalTextKind = "paraphrase" | "summary" | "pending";

export type LegalPassage = {
  id: string;
  sourceId: string;
  /** Pin-cite inside the source: "Art. 4.4.4", "s 54", "§2.7", "Notification No. 4 cl. 3". */
  ref: string;
  heading: string;
  text: string;
  textKind: LegalTextKind;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** "*" for the OECD layer; ISO code for a domestic instrument. */
  jurisdiction: "*" | string;
  topics: string[];
  /** `RULES` ids in `lib/model.ts`. */
  ruleIds: string[];
  /** `ELECTIONS` ids in `lib/elections.ts`. */
  electionIds: string[];
  /** `THAI_INSTRUMENTS` ids in `lib/thailand.ts`. */
  instrumentIds: string[];
  /** `GAP_ITEMS` ids in `lib/thaiGap.ts`. */
  gapIds: string[];
  /** GMT24 screen where the provision is applied. */
  href?: string;
  /** Where GMT24's usage, a rule id or the domestic text departs from the cited provision. */
  note?: string;
};

export type LegalSearchOptions = {
  authority?: LegalAuthority | "domestic";
  jurisdiction?: string | null;
  /** ISO date; passages not in force on this date are returned with `current = false`. */
  asOf?: string;
  ruleId?: string;
  electionId?: string;
  instrumentId?: string;
  limit?: number;
};

export type LegalHit = {
  passage: LegalPassage;
  source: LegalSource;
  score: number;
  current: boolean;
};

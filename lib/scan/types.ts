/**
 * GMT24 AI Pillar Two Quick Scan — types.
 *
 * A Quick Scan is a preliminary exposure assessment built from public evidence
 * (official disclosures) matched against a versioned jurisdiction database. It
 * never states a top-up amount the engine has not calculated. Every finding carries
 * its basis (disclosed / inferred / user-confirmed), its reporting period and the
 * passage it came from.
 */
export type Basis = "disclosed" | "inferred" | "user-confirmed";

export type SourceKind = "annual-report" | "financial-statements" | "form-56-1" | "exchange-filing" | "ir-website" | "regulator" | "upload";

export type SourceDoc = {
  id: string;
  title: string;
  kind: SourceKind;
  period: string;
  issuer: string;
  url: string | null;
  retrievedAt: string;
  accessible: boolean;
  inaccessibleReason?: string;
  pages: number | null;
  language: "en" | "th" | "mixed";
  /** Upload-derived documents carry the attachment id so the passage viewer can open the page. */
  attachmentId?: string;
};

export type Passage = {
  docId: string;
  page: number;
  text: string;
  period: string;
  /** Section or note the passage sits in when the document says so. */
  section?: string;
};

export type Relationship = "upe" | "subsidiary" | "associate" | "joint-venture" | "branch" | "investment" | "unresolved";

export type ScanEntity = {
  id: string;
  name: string;
  nameTh?: string;
  formerNames?: string[];
  incorporationIso: string;
  incorporationName: string;
  /** Null until disclosed or confirmed. Incorporation is not proof of residence. */
  taxResidenceIso: string | null;
  taxResidenceBasis: Basis | null;
  relationship: Relationship;
  ownerId: string | null;
  /** Percentage disclosed by the group; null when the link is unresolved. */
  ownership: number | null;
  activity: string;
  /** Scheme ids from the jurisdiction database that the disclosures tie to this entity. */
  incentives: { schemeId: string; basis: Basis; passage?: Passage; period?: { from?: string; to?: string } }[];
  evidence: Passage[];
  basis: Basis;
  period: string;
  /** Set by structure correction. */
  outdated?: boolean;
  correctedBy?: string;
};

export type SchemeKind = "holiday" | "reduced-rate" | "ip-box" | "credit" | "zone" | "exemption";

export type Scheme = {
  id: string;
  iso: string;
  name: string;
  kind: SchemeKind;
  /** Screening description only — not a rate the scan can apply to income. */
  effect: string;
  activities: string[];
  source: string;
  sourceUrl?: string;
  asOf: string;
};

export type RuleStatus = { status: "in-force" | "enacted" | "draft" | "none" | "unknown"; from: string | null; note?: string };

export type JurisdictionRecord = {
  iso: string;
  name: string;
  nameTh?: string;
  statutoryRate: number;
  rateNote?: string;
  rateSource: string;
  rateAsOf: string;
  schemes: Scheme[];
  iir: RuleStatus;
  qdmtt: RuleStatus;
  utpr: RuleStatus;
  /** OECD Central Record listing — dated. Absence is not evidence of non-qualification. */
  centralRecord: { listed: "yes" | "no" | "pending"; asOf: string; url: string };
  supported: boolean;
};

export type JurisdictionDb = {
  version: string;
  asOf: string;
  records: JurisdictionRecord[];
  sources: { label: string; url: string }[];
};

export type Priority = "High" | "Medium" | "Low" | "Undetermined";
export type EvidenceStrength = "Strong" | "Moderate" | "Limited";

export type ExposureFlag = {
  iso: string;
  name: string;
  priority: Priority;
  evidence: EvidenceStrength;
  coverage: { entities: number; entitiesWithFinancials: number; periods: string[]; jurisdictionFinancials: boolean };
  reasons: string[];
  /** Entities that may contribute to low-taxed income in the jurisdiction. */
  contributing: string[];
  /** Where a top-up, if any, would be collected and by which entity — with what remains unconfirmed. */
  collection: { mechanism: string; payerEntityId: string | null; payerNote: string; unconfirmed: string[] };
  passages: Passage[];
  whatWouldChange: { increase: string[]; reduce: string[]; resolve: string[] };
  missing: string[];
  /** Company-disclosed amounts for this jurisdiction when the report gives them. */
  disclosedAmount?: { label: string; amount: string; passage: Passage };
  /** Independent estimate only when inputs allow; always with assumptions. */
  estimate?: { label: string; amountUsd: number; assumptions: string[]; engine: string };
  dbVersion: string;
  screening: { statutoryRate: number; schemesAvailable: number; iir: RuleStatus; qdmtt: RuleStatus; utpr: RuleStatus; centralRecord: JurisdictionRecord["centralRecord"] };
  unsupportedJurisdiction?: boolean;
};

export type ScopeVerdict = "in-scope" | "out-of-scope" | "insufficient";

export type ScopeAssessment = {
  verdict: ScopeVerdict;
  reasons: string[];
  revenue: { period: string; amount: number; currency: string; eurEquivalent: number | null; passage?: Passage; basis: Basis }[];
  fxAssumption: string;
  threshold: string;
  yearsOver: number;
  yearsTested: number;
};

export type DisclosureTopic = "pillar-two-statement" | "top-up-recognised" | "expected-impact" | "uncertainty" | "incentive" | "tax-reconciliation" | "safe-harbour";

export type Disclosure = {
  id: string;
  topic: DisclosureTopic;
  summary: string;
  passage: Passage;
  isos: string[];
};

export type FollowUp = {
  id: string;
  question: string;
  why: string;
  options: { value: string; label: string }[];
  resolves: string[];
  impact: "high" | "medium" | "low";
  entityId?: string;
  iso?: string;
};

export type MissingItem = { id: string; item: string; why: string; kind: "fact" | "document"; iso?: string; entityId?: string };

export type StageId = "resolve" | "sources" | "structure" | "tax" | "match" | "exposure" | "questions";

export type Stage = { id: StageId; label: string; status: "pending" | "running" | "done" | "partial" | "failed"; note?: string };

export type Correction =
  | { kind: "ownership"; entityId: string; ownership: number; relationship: Relationship; by: string; at: string }
  | { kind: "add"; entity: ScanEntity; by: string; at: string }
  | { kind: "outdated"; entityId: string; by: string; at: string }
  | { kind: "residence"; entityId: string; iso: string; by: string; at: string };

export type ResolvedEntity = {
  registryId: string;
  name: string;
  nameTh?: string;
  exchange?: string;
  ticker?: string;
  upeName: string;
  upeIso: string;
  matchedOn: string;
  isUpe: boolean;
  enteredWasSubsidiary?: string;
};

export type ScanResult = {
  id: string;
  query: string;
  startedAt: string;
  completedAt: string | null;
  period: string;
  periodsAvailable: string[];
  dbVersion: string;
  corpusVersion: string;
  resolved: ResolvedEntity | null;
  alternatives: ResolvedEntity[];
  stages: Stage[];
  sources: SourceDoc[];
  scope: ScopeAssessment | null;
  entities: ScanEntity[];
  unresolvedLinks: { entityId: string; reason: string }[];
  exposure: ExposureFlag[];
  watchlist: { entityId: string; reasons: string[]; role: "contributing" | "payer" | "both" }[];
  disclosures: Disclosure[];
  missing: MissingItem[];
  questions: FollowUp[];
  answers: Record<string, { value: string; by: string; at: string }>;
  corrections: Correction[];
  supportedIsos: string[];
  unsupportedIsos: string[];
  notes: string[];
};

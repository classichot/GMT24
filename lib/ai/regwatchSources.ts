/**
 * Default official sources monitored by Regulatory Impact Watch. Shared by the
 * server monitor (which may replace the list via GMT24_REGWATCH_SOURCES) and the
 * client, which shows the list before the first check has run. Last-checked
 * times come from the server state, never from this file.
 */
export type WatchedSource = { id: string; label: string; url: string; cadence: string; jurisdictions: string[] };

/** Structured model summary of a detected change (schema enforced on the server). */
export type RegChangeSummary = {
  title: string;
  summary: string;
  kind: "new-guidance" | "amendment" | "consultation" | "administrative" | "other";
  publicationStatus: "final" | "draft" | "consultation" | "unknown";
  applicableFrom: string | null;
  jurisdictions: string[];
  topics: string[];
  potentialImpacts: string[];
  confidence: "high" | "medium" | "low";
};

/** A change detected by the monitor. Persisted server-side; mirrored in the client cache for the review queue. */
export type RegChange = {
  id: string;
  sourceId: string;
  sourceLabel: string;
  detectedAt: string;
  signal: "amended" | "new-doc";
  url: string;
  title: string;
  excerpt: string;
  previousHash: string | null;
  hash: string;
  summary: RegChangeSummary | null;
  summaryModel: string | null;
  summaryError: string | null;
};

/** Per-source monitor state as exposed to the client (version excerpts omitted). */
export type RegSourceState = {
  id: string;
  label: string;
  url: string;
  cadence: string;
  jurisdictions: string[];
  lastChecked: string | null;
  lastChangedAt: string | null;
  lastStatus: "ok" | "error" | "unchecked";
  lastError: string | null;
  hash: string | null;
  title: string | null;
  isPdf: boolean;
  knownLinks: number;
  versions: { hash: string; at: string; bytes: number }[];
};

export const DEFAULT_WATCHED_SOURCES: WatchedSource[] = [
  { id: "oecd-cr", label: "OECD Central Record — legislation with transitional qualified status (PDF)", url: "https://www.oecd.org/content/dam/oecd/en/topics/policy-sub-issues/global-minimum-tax/updated-central-record-for-purposes-of-the-global-minimum-tax.pdf", cadence: "Weekly", jurisdictions: [] },
  { id: "oecd-gmt", label: "OECD Global minimum tax — publications and administrative guidance", url: "https://www.oecd.org/en/topics/sub-issues/global-minimum-tax.html", cadence: "Weekly", jurisdictions: [] },
  { id: "th-rd-topup", label: "Thai Revenue Department — Top-up Tax Emergency Decree B.E. 2567 and secondary legislation", url: "https://www.rd.go.th/67365.html", cadence: "Weekly", jurisdictions: ["TH"] },
  { id: "th-rd-news", label: "Thai Revenue Department — announcement news (English)", url: "https://www.rd.go.th/english/63.html", cadence: "Weekly", jurisdictions: ["TH"] },
];

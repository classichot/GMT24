/**
 * OECD publication register — the official documents GMT24 keeps on file,
 * recorded by publication date. Each entry points at the copy stored under
 * /public/oecd, the OECD DOI, and the legal-corpus source that paraphrases it,
 * so a citation can be traced from a passage to the page of the PDF it came
 * from. Metadata is taken from the PDF itself (title, author, creation date)
 * and from the approval notice on its copyright page.
 */
import type { LegalAuthority } from "./legal/types";

export type PublicationSeries = "model-rules" | "commentary" | "gir" | "admin-guidance" | "safe-harbour";

export type Publication = {
  id: string;
  authority: LegalAuthority;
  series: PublicationSeries;
  title: string;
  short: string;
  /** Date the Inclusive Framework approved / declassified the text (copyright page). */
  approvedAt: string;
  /** Publication date — the PDF's creation date from OECD Publishing Systems. */
  publishedAt: string;
  pages: number;
  doi: string;
  /** Local copy served from /public. */
  file: string;
  fileBytes: number;
  sha256: string;
  /** Legal-corpus source built from this document. */
  sourceId: string;
  /** Publication this edition replaces, if any. */
  supersedes?: string;
  summary: string;
  /** Where the document bites in GMT24. */
  usedBy: { label: string; href: string }[];
  addedAt: string;
};

export const OECD_PUBLICATIONS: Publication[] = [
  {
    id: "PUB-OECD-MR-2021",
    authority: "OECD",
    series: "model-rules",
    title: "Tax Challenges Arising from the Digitalisation of the Economy — Global Anti-Base Erosion Model Rules (Pillar Two)",
    short: "GloBE Model Rules (Pillar Two)",
    approvedAt: "2021-12-14",
    publishedAt: "2021-12-20",
    pages: 70,
    doi: "10.1787/782bac33-en",
    file: "/oecd/2021-12-20-globe-model-rules-pillar-two.pdf",
    fileBytes: 3_275_454,
    sha256: "796d1a16fad360204a76450f5246e038263ef4bc652356f25d367d4b9389e306",
    sourceId: "OECD-MR-2021",
    summary: "The ten chapters of the Model Rules: scope, charging provisions (IIR, UTPR), GloBE Income or Loss, Adjusted Covered Taxes, ETR and Top-up Tax computation including the Substance-based Income Exclusion, restructurings, tax-neutrality regimes, administration (GIR, safe harbours), transition rules and definitions. Every OECD-* rule in the rule pack and every Model Rules passage in the legal corpus resolves to this text.",
    usedBy: [
      { label: "OECD rulebook", href: "/rulebook" },
      { label: "Legal corpus — Model Rules passages", href: "/legal?source=OECD-MR-2021" },
      { label: "Election register", href: "/elections" },
    ],
    addedAt: "2026-09-12",
  },
  {
    id: "PUB-OECD-COMM-2026",
    authority: "OECD",
    series: "commentary",
    title: "Tax Challenges Arising from the Digitalisation of the Economy — Consolidated Commentary to the Global Anti-Base Erosion Model Rules (2026)",
    short: "Consolidated Commentary (2026)",
    approvedAt: "2026-05-11",
    publishedAt: "2026-05-27",
    pages: 456,
    doi: "10.1787/4377e89f-en",
    file: "/oecd/2026-05-27-consolidated-commentary-2026.pdf",
    fileBytes: 6_154_106,
    sha256: "e98e5459756c0ffb9e7c09fd7d2161e386b6f3f865fdc9e23004ed7f967295a4",
    sourceId: "OECD-COMM-2026",
    supersedes: "Consolidated Commentary (2025)",
    summary: "Article-by-article Commentary to the Model Rules consolidating the Administrative Guidance agreed up to the consolidation date, including the January 2026 Side-by-Side package. This is the interpretive text GMT24 treats as current for FY2026; positions taken under the 2025 consolidation remain documented against that edition.",
    usedBy: [
      { label: "Legal corpus — Commentary source", href: "/legal?source=OECD-COMM-2026" },
      { label: "Regulatory Watch", href: "/regwatch" },
      { label: "AGI Compliance Review", href: "/agi/compliance" },
    ],
    addedAt: "2026-09-12",
  },
  {
    id: "PUB-OECD-GIR-2026-09",
    authority: "OECD",
    series: "gir",
    title: "Tax Challenges Arising from the Digitalisation of the Economy — GloBE Information Return (September 2026)",
    short: "GloBE Information Return (September 2026)",
    approvedAt: "2026-09-02",
    publishedAt: "2026-09-11",
    pages: 115,
    doi: "10.1787/a05ec99a-en",
    file: "/oecd/2026-09-11-globe-information-return-september-2026.pdf",
    fileBytes: 1_897_137,
    sha256: "ce88e0cf14f4ded2458df8317e865bfd438da533aa2ac36894ff3e8774ec0e32",
    sourceId: "OECD-GIR-2026-09",
    supersedes: "GloBE Information Return (January 2025)",
    summary: "Revised standard GIR template: Annex A1 data points and Annex A2 explanatory guidance for the MNE Group section, jurisdictional safe harbours and exclusions and the GloBE computations; Annex B notification that the GIR will be received under exchange of information; Annex C transitional penalty relief. Adds the Side-by-Side Safe Harbour election to the general section (the summary table and parts of the corporate structure are not completed where it applies) and carries forward the Transitional Simplified Jurisdictional Reporting Framework and the central-filing dissemination approach.",
    usedBy: [
      { label: "GIR preflight", href: "/gir" },
      { label: "Legal corpus — GIR source", href: "/legal?source=OECD-GIR-2026-09" },
      { label: "Filings", href: "/filings" },
    ],
    addedAt: "2026-09-12",
  },
];

export const SERIES_LABEL: Record<PublicationSeries, string> = {
  "model-rules": "Model Rules",
  commentary: "Commentary",
  gir: "GloBE Information Return",
  "admin-guidance": "Administrative Guidance",
  "safe-harbour": "Safe harbours",
};

/** Newest publication first. */
export function publicationsByDate(): Publication[] {
  return [...OECD_PUBLICATIONS].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
}

export function publicationById(id: string): Publication | undefined {
  return OECD_PUBLICATIONS.find((p) => p.id === id);
}

export function publicationForSource(sourceId: string): Publication | undefined {
  return OECD_PUBLICATIONS.find((p) => p.sourceId === sourceId);
}

export function doiUrl(p: Publication) {
  return `https://doi.org/${p.doi}`;
}

export function formatBytes(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`;
}

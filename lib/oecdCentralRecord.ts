import { JURISDICTION_PACKS } from "./model";

export const OECD_CENTRAL_RECORD_URL =
  "https://www.oecd.org/en/topics/sub-issues/global-minimum-tax/central-record-of-legislation-with-transitional-qualified-status.html";
export const OECD_GMT_HUB_URL = "https://www.oecd.org/en/topics/sub-issues/global-minimum-tax.html";
export const OECD_CENTRAL_RECORD_PDF =
  "https://www.oecd.org/content/dam/oecd/en/topics/policy-sub-issues/global-minimum-tax/updated-central-record-for-purposes-of-the-global-minimum-tax.pdf";

const ALIASES: { iso: string; names: string[] }[] = [
  { iso: "JP", names: ["Japan"] },
  { iso: "TH", names: ["Thailand"] },
  { iso: "SG", names: ["Singapore"] },
  { iso: "VN", names: ["Vietnam", "Viet Nam"] },
  { iso: "IE", names: ["Ireland"] },
  { iso: "US", names: ["United States of America", "United States"] },
  { iso: "DE", names: ["Germany"] },
  { iso: "FR", names: ["France"] },
  { iso: "GB", names: ["United Kingdom"] },
  { iso: "NL", names: ["Netherlands"] },
  { iso: "HU", names: ["Hungary"] },
  { iso: "AE", names: ["United Arab Emirates"] },
  { iso: "MY", names: ["Malaysia"] },
  { iso: "ID", names: ["Indonesia"] },
];

export type OecdFlags = { iir: boolean; qdmtt: boolean; qdmttSH: boolean; sbs: boolean; cited: boolean };

export type OecdPackRow = {
  iso: string;
  name: string;
  pack: { iir: boolean; qdmtt: boolean; qdmttSH: boolean; utpr: boolean; qualified: string };
  oecd: OecdFlags;
  status: "match" | "changed" | "not-on-record";
  note: string;
};

export type OecdRefresh = {
  fetchedAt: string;
  asOf: string | null;
  sourceUrl: string;
  pdfUrl: string;
  ok: boolean;
  error?: string;
  news: { title: string; href: string }[];
  rows: OecdPackRow[];
};

export function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namedIn(hay: string, names: string[]) {
  const h = hay.toLowerCase();
  return names.some((n) => h.includes(n.toLowerCase()));
}

function sliceSection(text: string, startHeadings: string[], untilHeadings: string[]) {
  const lower = text.toLowerCase();
  let start = -1;
  for (const h of startHeadings) {
    const i = lower.indexOf(h.toLowerCase());
    if (i >= 0 && (start < 0 || i < start)) start = i;
  }
  if (start < 0) return "";
  let end = text.length;
  for (const h of untilHeadings) {
    const i = lower.indexOf(h.toLowerCase(), start + 8);
    if (i >= 0 && i < end) end = i;
  }
  return text.slice(start, end);
}

export function extractAsOf(text: string) {
  const m = text.match(/current as at\s+([0-9]{1,2}\s+[A-Za-z]+\s+20\d{2})/i)
    ?? text.match(/as of\s+([0-9]{1,2}\s+[A-Za-z]+\s+20\d{2})/i)
    ?? text.match(/updated\s+([0-9]{1,2}\s+[A-Za-z]+\s+20\d{2})/i);
  return m?.[1] ?? null;
}

export function extractNews(html: string, base: string) {
  const out: { title: string; href: string }[] = [];
  const re = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const rawHref = m[1];
    const title = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (title.length < 24 || title.length > 180) continue;
    const href = rawHref.startsWith("http") ? rawHref : new URL(rawHref, base).toString();
    if (!/oecd\.org/i.test(href)) continue;
    if (!/global-minimum-tax|pillar-two|globe|gir|central-record|administrative-guidance|qualified/i.test(`${href} ${title}`)) continue;
    if (out.some((x) => x.title === title || x.href === href)) continue;
    out.push({ title, href });
    if (out.length >= 6) break;
  }
  return out;
}

export function extractFlags(text: string): Record<string, OecdFlags> {
  const iir = sliceSection(text, ["Qualified Income Inclusion Rules", "Qualified IIR"], ["Qualified Domestic", "Qualified DMTT", "QDMTT Safe Harbour", "QDMTT Safe Harbor", "Qualified Side-by-Side"]);
  const qdmtt = sliceSection(text, ["Qualified Domestic Minimum", "Qualified DMTT", "Qualified DMTTs"], ["QDMTT Safe Harbour", "QDMTT Safe Harbor", "Qualified Side-by-Side", "Qualified Income Inclusion"]);
  const sh = sliceSection(text, ["QDMTT Safe Harbour", "QDMTT Safe Harbor"], ["Qualified Side-by-Side", "Qualified Income Inclusion", "Qualified Domestic"]);
  const sbs = sliceSection(text, ["Qualified Side-by-Side", "Side-by-Side"], ["Qualified Income Inclusion", "Qualified Domestic", "QDMTT Safe Harbour"]);
  const parsedTables = Boolean(iir || qdmtt || sh || sbs);

  const flags: Record<string, OecdFlags> = {};
  for (const a of ALIASES) {
    const onIir = namedIn(iir, a.names);
    const onQ = namedIn(qdmtt, a.names);
    const onSh = namedIn(sh, a.names);
    const onSbs = namedIn(sbs, a.names);
    flags[a.iso] = {
      iir: onIir,
      qdmtt: onQ,
      qdmttSH: onSh,
      sbs: onSbs,
      cited: parsedTables ? onIir || onQ || onSh || onSbs : namedIn(text, a.names),
    };
  }
  return flags;
}

export function diffPacks(oecd: Record<string, OecdFlags>, asOf: string | null): OecdPackRow[] {
  return JURISDICTION_PACKS.map((p) => {
    const live = oecd[p.iso] ?? { iir: false, qdmtt: false, qdmttSH: false, sbs: false, cited: false };
    const packQdmtt = p.qdmtt;
    const changed =
      live.cited &&
      (live.iir !== p.iir || live.qdmtt !== packQdmtt || (live.qdmttSH && !p.qdmttSH) || (live.sbs && p.iso === "US" && !/SbS/i.test(p.qualified)));
    let status: OecdPackRow["status"] = "match";
    let note = live.cited ? `On Central Record${asOf ? ` (as at ${asOf})` : ""}.` : "Not listed. Absence is not a determination that the rules are unqualified.";
    if (!live.cited) status = "not-on-record";
    else if (changed) {
      status = "changed";
      const bits: string[] = [];
      if (live.iir !== p.iir) bits.push(`IIR OECD ${live.iir ? "Y" : "—"} vs pack ${p.iir ? "Y" : "—"}`);
      if (live.qdmtt !== packQdmtt) bits.push(`QDMTT OECD ${live.qdmtt ? "Y" : "—"} vs pack ${packQdmtt ? "Y" : "—"}`);
      if (live.qdmttSH !== p.qdmttSH) bits.push(`QDMTT SH OECD ${live.qdmttSH ? "Y" : "—"} vs pack ${p.qdmttSH ? "Y" : "—"}`);
      if (live.sbs) bits.push("OECD lists a Qualified SbS regime");
      note = bits.join(" · ") || "OECD listing differs from the signed pack.";
    }
    return {
      iso: p.iso,
      name: p.name,
      pack: { iir: p.iir, qdmtt: p.qdmtt, qdmttSH: p.qdmttSH, utpr: p.utpr, qualified: p.qualified },
      oecd: live,
      status,
      note,
    };
  });
}

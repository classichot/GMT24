import { pdfRows, pdfRuns, type PdfRow } from "./pdfText";
import type { OecdFlags } from "./oecdCentralRecord";

/**
 * Column-aware parse of the OECD Central Record PDF.
 *
 * The Record is three tables. Qualified IIR is presence in the first, Qualified
 * DMTT is presence in the second, and the QDMTT Safe Harbour is a "Yes" in one
 * specific column of that second table — which is why a flat text read cannot
 * tell the two apart, and why jurisdiction names in the surrounding prose look
 * identical to table entries. Reading the geometry solves both: prose does not
 * sit in the jurisdiction column, and a Safe Harbour "Yes" has a known x.
 */

export type RecordTableKind = "iir" | "qdmtt" | "sbs";

export type RecordTable = {
  kind: RecordTableKind;
  page: number;
  y: number;
  /** x of the flag column, when the table has one. */
  flagX: number | null;
  jurisdictions: string[];
  /** Names whose row carries a "Yes" in the flag column. */
  flagged: string[];
};

export type PdfRecordParse = {
  ok: boolean;
  error?: string;
  asOf: string | null;
  tables: RecordTable[];
  flags: Record<string, OecdFlags>;
  /** Every jurisdiction name read out of a table, for diagnostics. */
  names: string[];
};

/** Jurisdiction column sits well left of the legislation column in every table. */
const NAME_COL_MAX_X = 110;
const FLAG_TOLERANCE = 10;

const ALIASES: { iso: string; names: string[] }[] = [
  { iso: "JP", names: ["Japan"] },
  { iso: "TH", names: ["Thailand"] },
  { iso: "SG", names: ["Singapore"] },
  { iso: "VN", names: ["Viet Nam", "Vietnam"] },
  { iso: "IE", names: ["Ireland"] },
  { iso: "US", names: ["United States"] },
  { iso: "DE", names: ["Germany"] },
  { iso: "FR", names: ["France"] },
  { iso: "GB", names: ["United Kingdom"] },
  { iso: "NL", names: ["Netherlands"] },
  { iso: "HU", names: ["Hungary"] },
  { iso: "AE", names: ["United Arab Emirates"] },
  { iso: "MY", names: ["Malaysia"] },
  { iso: "ID", names: ["Indonesia"] },
  { iso: "LU", names: ["Luxembourg"] },
  { iso: "HK", names: ["Hong Kong"] },
];

function documentOrder(rows: PdfRow[]): PdfRow[] {
  return [...rows].sort((a, b) => a.page - b.page || b.y - a.y);
}

/** Column-header rows mark the start of each table. */
function headerRows(rows: PdfRow[]): PdfRow[] {
  return rows.filter((r) => r.cells.some((c) => /^Domestic law/i.test(c.text)));
}

function classify(header: PdfRow, ordered: PdfRow[], index: number): RecordTableKind {
  const flag = header.cells.find((c) => /Safe Harbour|Safe$/i.test(c.text));
  if (!flag) return "iir";
  // The Side-by-Side table repeats a Safe Harbour column, so look back for its
  // section heading rather than relying on the column label alone.
  for (let i = index - 1; i >= 0 && i > index - 12; i--) {
    if (/Qualified SbS Regimes|Side\s*-?\s*by\s*-?\s*Side/i.test(ordered[i].text)) return "sbs";
  }
  return "qdmtt";
}

/** Running headers, footers, page numbers and footnotes also sit in the left margin. */
const NOISE = /TAX CHALLENGES|ADMINISTRATIVE GUIDANCE|MODEL RULES|CENTRAL RECORD|PILLAR TWO|OECD|^Qualified |^The |^This |^Jurisdiction/i;

function nameCell(row: PdfRow) {
  const c = row.cells[0];
  if (!c || c.x > NAME_COL_MAX_X) return null;
  const t = c.text.trim();
  if (!/[A-Za-z]{3}/.test(t)) return null;
  // A jurisdiction name is short; prose and footers are not.
  if (t.length > 40) return null;
  if (NOISE.test(t)) return null;
  // A cell opening with a bracket is the tail of a wrapped name, e.g. "(China)".
  if (t.startsWith("(")) return null;
  return c;
}

export function parseCentralRecordPdf(buf: Buffer): PdfRecordParse {
  const empty: Record<string, OecdFlags> = {};
  for (const a of ALIASES) empty[a.iso] = { iir: false, qdmtt: false, qdmttSH: false, sbs: false, cited: false };

  let ordered: PdfRow[];
  try {
    ordered = documentOrder(pdfRows(pdfRuns(buf)));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "PDF parse failed", asOf: null, tables: [], flags: empty, names: [] };
  }

  const heads = headerRows(ordered);
  if (heads.length < 2) {
    return {
      ok: false,
      error: `Central Record PDF layout not recognised — found ${heads.length} table header row${heads.length === 1 ? "" : "s"}, expected at least two. Not comparing rather than guessing.`,
      asOf: null,
      tables: [],
      flags: empty,
      names: [],
    };
  }

  const tables: RecordTable[] = [];
  for (const [n, header] of heads.entries()) {
    const startIdx = ordered.indexOf(header);
    const endIdx = n + 1 < heads.length ? ordered.indexOf(heads[n + 1]) : ordered.length;
    const kind = classify(header, ordered, startIdx);
    const flagCell = header.cells.find((c) => /Safe Harbour|Safe$/i.test(c.text));
    const flagX = flagCell ? flagCell.x : null;
    const jurisdictions: string[] = [];
    const flagged: string[] = [];
    for (let i = startIdx + 1; i < endIdx; i++) {
      const row = ordered[i];
      const cell = nameCell(row);
      if (!cell) continue;
      jurisdictions.push(cell.text);
      if (flagX !== null && row.cells.some((c) => Math.abs(c.x - flagX) <= FLAG_TOLERANCE && /^Yes\b/i.test(c.text))) {
        flagged.push(cell.text);
      }
    }
    tables.push({ kind, page: header.page, y: header.y, flagX, jurisdictions, flagged });
  }

  const iir = tables.find((t) => t.kind === "iir");
  const qdmtt = tables.find((t) => t.kind === "qdmtt");
  const sbs = tables.find((t) => t.kind === "sbs");
  if (!iir || !qdmtt) {
    return {
      ok: false,
      error: "Could not identify both the Qualified IIR and the Qualified DMTT table in the PDF. Not comparing rather than guessing.",
      asOf: null,
      tables,
      flags: empty,
      names: [],
    };
  }

  // Names wrap across rows ("United" / "Kingdom"), so match against the joined
  // column rather than each cell.
  const joined = (xs: string[]) => xs.join(" ").replace(/\s+/g, " ");
  const inTable = (t: RecordTable | undefined, names: string[]) =>
    Boolean(t) && names.some((n) => joined(t!.jurisdictions).includes(n));
  const flaggedIn = (t: RecordTable | undefined, names: string[]) =>
    Boolean(t) && names.some((n) => joined(t!.flagged).includes(n));

  const flags: Record<string, OecdFlags> = {};
  for (const a of ALIASES) {
    const onIir = inTable(iir, a.names);
    const onQ = inTable(qdmtt, a.names);
    const onSh = flaggedIn(qdmtt, a.names);
    const onSbs = inTable(sbs, a.names);
    flags[a.iso] = {
      iir: onIir,
      qdmtt: onQ,
      qdmttSH: onSh,
      sbs: onSbs,
      cited: onIir || onQ || onSbs,
    };
  }

  const flat = ordered.map((r) => r.text).join(" ");
  return {
    ok: true,
    asOf: extractPdfAsOf(flat),
    tables,
    flags,
    names: [...new Set([...iir.jurisdictions, ...qdmtt.jurisdictions, ...(sbs?.jurisdictions ?? [])])],
  };
}

/**
 * The PDF carries its currency as a plain date rather than the "current as at"
 * phrasing used on the web page, so fall back to the latest date it mentions.
 */
export function extractPdfAsOf(text: string): string | null {
  const phrase = text.match(/current as at\s+([0-9]{1,2}\s+[A-Za-z]+\s+20\d{2})/i)
    ?? text.match(/as of\s+([0-9]{1,2}\s+[A-Za-z]+\s+20\d{2})/i);
  if (phrase) return phrase[1];
  const months = "January|February|March|April|May|June|July|August|September|October|November|December";
  const all = [...text.matchAll(new RegExp(`\\b([0-9]{1,2}\\s+(?:${months})\\s+20\\d{2})\\b`, "g"))].map((m) => m[1]);
  if (!all.length) return null;
  // Prefer the most recent date mentioned — effective dates in the tables are historic.
  const parsed = all
    .map((d) => ({ d, t: Date.parse(d) }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => b.t - a.t);
  return parsed[0]?.d ?? null;
}

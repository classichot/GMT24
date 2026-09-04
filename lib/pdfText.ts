import { inflateRawSync, inflateSync } from "node:zlib";

/**
 * Minimal positional PDF text extraction, no dependencies.
 *
 * Flat text is not enough to read the OECD Central Record: the QDMTT and the
 * QDMTT Safe Harbour live in adjacent columns of one table, and jurisdiction
 * names also appear in the surrounding prose. Reading a "Yes" against the right
 * column needs the coordinates, so this keeps the text matrix and reports an
 * x/y for every run. Rows and columns are then recovered geometrically.
 */

export type PdfRun = {
  /** Content-stream index, which is one page for a linear document. */
  page: number;
  x: number;
  y: number;
  text: string;
};

export type PdfRow = {
  page: number;
  y: number;
  cells: PdfRun[];
  text: string;
};

function contentStreams(buf: Buffer): Buffer[] {
  const out: Buffer[] = [];
  const start = Buffer.from("stream");
  const end = Buffer.from("endstream");
  let i = 0;
  for (;;) {
    const s = buf.indexOf(start, i);
    if (s < 0) break;
    let d = s + start.length;
    if (buf[d] === 0x0d) d++;
    if (buf[d] === 0x0a) d++;
    const e = buf.indexOf(end, d);
    if (e < 0) break;
    out.push(buf.subarray(d, e));
    i = e + end.length;
  }
  return out;
}

function inflate(chunk: Buffer): string {
  for (const fn of [inflateSync, inflateRawSync]) {
    try {
      return fn(chunk).toString("latin1");
    } catch {
      // Not a Flate stream, or an image — skip it.
    }
  }
  return "";
}

function decodeLiteral(raw: string): string {
  return raw
    .slice(1, -1)
    .replace(/\\([nrtbf])/g, " ")
    .replace(/\\([0-7]{1,3})/g, (_, o: string) => String.fromCharCode(parseInt(o, 8)))
    .replace(/\\(.)/g, "$1");
}

/** A large negative kerning adjustment inside a TJ array is a word gap. */
const WORD_GAP = 100;

const NUM = "[-+]?[0-9]*\\.?[0-9]+";

const TOKEN = new RegExp(
  [
    `\\[(?<arr>(?:\\((?:\\\\.|[^\\\\()])*\\)|[^\\]])*)\\]\\s*TJ`,
    `(?<lit>\\((?:\\\\.|[^\\\\()])*\\))\\s*Tj`,
    `(?<tma>${NUM})\\s+(?<tmb>${NUM})\\s+(?<tmc>${NUM})\\s+(?<tmd>${NUM})\\s+(?<tme>${NUM})\\s+(?<tmf>${NUM})\\s+Tm`,
    `(?<tdx>${NUM})\\s+(?<tdy>${NUM})\\s+(?<tdop>TD|Td)`,
    `(?<tl>${NUM})\\s+TL`,
    `(?<star>T\\*)`,
    `(?<bt>BT)`,
  ].join("|"),
  "g",
);

function runsFrom(content: string, page: number): PdfRun[] {
  const out: PdfRun[] = [];
  let x = 0;
  let y = 0;
  let lineX = 0;
  let lineY = 0;
  let leading = 0;

  const push = (text: string) => {
    const t = text.replace(/\s+/g, " ").trim();
    if (t) out.push({ page, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, text: t });
  };

  for (const m of content.matchAll(TOKEN)) {
    const g = m.groups!;
    if (g.arr !== undefined) {
      let s = "";
      for (const e of g.arr.matchAll(/\((?:\\.|[^\\()])*\)|[-+]?[0-9]*\.?[0-9]+/g)) {
        const tok = e[0];
        if (tok.startsWith("(")) s += decodeLiteral(tok);
        else if (parseFloat(tok) <= -WORD_GAP) s += " ";
      }
      push(s);
    } else if (g.lit !== undefined) {
      push(decodeLiteral(g.lit));
    } else if (g.tmf !== undefined) {
      x = parseFloat(g.tme);
      y = parseFloat(g.tmf);
      lineX = x;
      lineY = y;
    } else if (g.tdop !== undefined) {
      if (g.tdop === "TD") leading = -parseFloat(g.tdy);
      lineX += parseFloat(g.tdx);
      lineY += parseFloat(g.tdy);
      x = lineX;
      y = lineY;
    } else if (g.tl !== undefined) {
      leading = parseFloat(g.tl);
    } else if (g.star !== undefined) {
      lineY -= leading;
      x = lineX;
      y = lineY;
    } else if (g.bt !== undefined) {
      x = 0;
      y = 0;
      lineX = 0;
      lineY = 0;
    }
  }
  return out;
}

export function pdfRuns(buf: Buffer): PdfRun[] {
  const out: PdfRun[] = [];
  contentStreams(buf)
    .map(inflate)
    .forEach((content, page) => {
      if (content) out.push(...runsFrom(content, page));
    });
  return out;
}

/**
 * Group runs into visual rows. Runs whose baselines sit within `tolerance`
 * points of each other belong to the same row; cells are ordered left to right.
 */
export function pdfRows(runs: PdfRun[], tolerance = 3): PdfRow[] {
  const byPage = new Map<number, PdfRun[]>();
  for (const r of runs) {
    const list = byPage.get(r.page) ?? [];
    list.push(r);
    byPage.set(r.page, list);
  }
  const rows: PdfRow[] = [];
  for (const [page, list] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...list].sort((a, b) => b.y - a.y || a.x - b.x);
    let current: PdfRun[] = [];
    const flush = () => {
      if (!current.length) return;
      const cells = [...current].sort((a, b) => a.x - b.x);
      rows.push({
        page,
        y: cells[0].y,
        cells,
        text: joinCells(cells),
      });
      current = [];
    };
    for (const run of sorted) {
      if (current.length && Math.abs(current[0].y - run.y) > tolerance) flush();
      current.push(run);
    }
    flush();
  }
  return rows;
}

/**
 * Join a row's cells, inserting a space only where there is a real horizontal
 * gap so a word split across runs by kerning is rebuilt rather than broken.
 */
function joinCells(cells: PdfRun[]): string {
  let out = "";
  let prevEnd: number | null = null;
  for (const c of cells) {
    if (prevEnd !== null && c.x - prevEnd > 1.2) out += " ";
    out += c.text;
    prevEnd = c.x + c.text.length * 1.9;
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Flat reading-order text, for headings and dates rather than table cells. */
export function pdfText(runs: PdfRun[]): string {
  return pdfRows(runs).map((r) => r.text).join("\n");
}

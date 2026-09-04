import {
  OECD_CENTRAL_RECORD_PDF,
  OECD_CENTRAL_RECORD_URL,
  OECD_GMT_HUB_URL,
  diffPacks,
  extractAsOf,
  extractFlags,
  extractNews,
  htmlToText,
  type OecdRefresh,
} from "@/lib/oecdCentralRecord";
import { parseCentralRecordPdf } from "@/lib/oecdRecordPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

async function get(url: string, accept: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: ctrl.signal,
      headers: { Accept: accept, "Accept-Language": "en-GB,en;q=0.9", "User-Agent": UA },
    });
    if (!res.ok) throw new Error(`OECD returned ${res.status}`);
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function fromHtml() {
  const res = await get(OECD_CENTRAL_RECORD_URL, "text/html,application/xhtml+xml");
  const html = await res.text();
  const text = htmlToText(html);
  if (text.length < 400) throw new Error("OECD page returned too little text to extract");
  return { asOf: extractAsOf(text), flags: extractFlags(text) };
}

async function fromPdf() {
  const res = await get(OECD_CENTRAL_RECORD_PDF, "application/pdf");
  const buf = Buffer.from(await res.arrayBuffer());
  const parsed = parseCentralRecordPdf(buf);
  if (!parsed.ok) throw new Error(parsed.error ?? "Central Record PDF could not be parsed");
  return { asOf: parsed.asOf, flags: parsed.flags, tables: parsed.tables };
}

/**
 * The published web page began refusing automated readers, so the authoritative
 * PDF is the working source. HTML is still tried first because it is cheaper to
 * parse; either way the response records which source produced the comparison so
 * a reviewer can see what the proposals rest on.
 */
export async function GET() {
  const fetchedAt = new Date().toISOString();
  const notes: string[] = [];

  let extract: { asOf: string | null; flags: Awaited<ReturnType<typeof fromHtml>>["flags"] } | null = null;
  let source: OecdRefresh["source"] = "html";

  try {
    extract = await fromHtml();
  } catch (e) {
    notes.push(`Central Record page unavailable (${e instanceof Error ? e.message : "fetch failed"}) — fell back to the published PDF.`);
    try {
      const pdf = await fromPdf();
      extract = { asOf: pdf.asOf, flags: pdf.flags };
      source = "pdf";
      notes.push(
        `Read ${pdf.tables.map((t) => `${t.kind.toUpperCase()} table ${t.jurisdictions.length} jurisdictions`).join(", ")} by column position.`,
      );
    } catch (e2) {
      const message = e2 instanceof Error ? e2.message : "PDF fetch failed";
      const body: OecdRefresh = {
        fetchedAt,
        asOf: null,
        sourceUrl: OECD_CENTRAL_RECORD_URL,
        pdfUrl: OECD_CENTRAL_RECORD_PDF,
        source: "none",
        ok: false,
        error: `${notes.join(" ")} The PDF also failed (${message}). No comparison was made — this is not a finding that the signed pack matches the Record.`,
        news: [],
        rows: [],
      };
      return Response.json(body, { status: 200 });
    }
  }

  const news = await get(OECD_GMT_HUB_URL, "text/html")
    .then((r) => r.text())
    .then((h) => extractNews(h, OECD_GMT_HUB_URL))
    .catch(() => [] as { title: string; href: string }[]);

  const body: OecdRefresh = {
    fetchedAt,
    asOf: extract.asOf,
    sourceUrl: OECD_CENTRAL_RECORD_URL,
    pdfUrl: OECD_CENTRAL_RECORD_PDF,
    source,
    ok: true,
    note: notes.join(" ") || undefined,
    news,
    rows: diffPacks(extract.flags, extract.asOf),
  };
  return Response.json(body);
}

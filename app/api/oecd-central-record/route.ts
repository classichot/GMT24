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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getHtml(url: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: ctrl.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "GMT24/0.1 (jurisdiction-pack refresh; public OECD Central Record)",
      },
    });
    if (!res.ok) throw new Error(`OECD returned ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  const fetchedAt = new Date().toISOString();
  try {
    const [recordHtml, hubHtml] = await Promise.all([
      getHtml(OECD_CENTRAL_RECORD_URL),
      getHtml(OECD_GMT_HUB_URL).catch(() => ""),
    ]);
    const text = htmlToText(recordHtml);
    if (text.length < 400) throw new Error("OECD page returned too little text to extract");
    const asOf = extractAsOf(text);
    const flags = extractFlags(text);
    const news = hubHtml ? extractNews(hubHtml, OECD_GMT_HUB_URL) : [];
    const body: OecdRefresh = {
      fetchedAt,
      asOf,
      sourceUrl: OECD_CENTRAL_RECORD_URL,
      pdfUrl: OECD_CENTRAL_RECORD_PDF,
      ok: true,
      news,
      rows: diffPacks(flags, asOf),
    };
    return Response.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "OECD fetch failed";
    const body: OecdRefresh = {
      fetchedAt,
      asOf: null,
      sourceUrl: OECD_CENTRAL_RECORD_URL,
      pdfUrl: OECD_CENTRAL_RECORD_PDF,
      ok: false,
      error: /abort/i.test(message) ? "OECD timed out. Open the Central Record and retry." : message,
      news: [],
      rows: [],
    };
    return Response.json(body, { status: 200 });
  }
}

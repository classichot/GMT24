import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchDocument } from "@/lib/scan/discover";
import { stripInstructions } from "@/lib/ai/documents";
import { clientKey, rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 90;

const Body = z.object({ url: z.string().url().max(2000) });
const MAX_TEXT = 2_500_000;

/** Retrieve one public document and return page-referenced text (instruction-like lines stripped). */
export async function POST(req: Request) {
  const rl = rateLimit(`fetch:${clientKey(req)}`, Number(process.env.GMT24_SCAN_RATE_LIMIT) || 20, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited", detail: `Document limit reached; try again in ${Math.ceil(rl.retryAfterS / 60)} minutes.` }, { status: 429 });
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); } catch { return NextResponse.json({ error: "bad_request", detail: "a valid http(s) url is required" }, { status: 400 }); }
  const u = new URL(body.url);
  if (!/^https?:$/.test(u.protocol) || /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[::1\])/.test(u.hostname)) return NextResponse.json({ error: "bad_request", detail: "only public http(s) sources can be fetched" }, { status: 400 });
  try {
    const doc = await fetchDocument(body.url);
    let stripped = 0;
    let total = 0;
    const pages = doc.pages.map((p) => { const s = stripInstructions(p.text.split("\n")); stripped += s.stripped; const text = s.kept.join("\n"); total += text.length; return { n: p.n, text }; }).filter(() => total <= MAX_TEXT);
    return NextResponse.json({ ...doc, pages, stripped, truncated: total > MAX_TEXT });
  } catch (e) {
    return NextResponse.json({ error: "fetch_failed", detail: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

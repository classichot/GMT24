import { NextResponse } from "next/server";
import { z } from "zod";
import { extractFromPages } from "@/lib/llm/extract";
import { LlmError } from "@/lib/llm/provider";
import { clientKey, rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  pages: z.array(z.object({ n: z.number().int().positive(), text: z.string() })).min(1).max(1500),
  company: z.string().max(160).optional(),
  period: z.string().max(12).optional(),
});

/** Structure a report's pages into entities, revenue, tax disclosures and jurisdiction data, with page-verified quotes. */
export async function POST(req: Request) {
  const rl = rateLimit(`structure:${clientKey(req)}`, Number(process.env.GMT24_SCAN_RATE_LIMIT) || 20, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited", detail: `Analysis limit reached; try again in ${Math.ceil(rl.retryAfterS / 60)} minutes.` }, { status: 429 });
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); } catch (e) { return NextResponse.json({ error: "bad_request", detail: e instanceof Error ? e.message.slice(0, 200) : "invalid body" }, { status: 400 }); }
  try {
    const out = await extractFromPages(body.pages, { company: body.company, period: body.period }, req.signal);
    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof LlmError) return NextResponse.json({ error: e.code, detail: e.message }, { status: e.code === "not_configured" ? 501 : e.code === "timeout" ? 504 : 503 });
    return NextResponse.json({ error: "internal", detail: "Extraction failed." }, { status: 500 });
  }
}

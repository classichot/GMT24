import { NextResponse } from "next/server";
import { z } from "zod";
import { discoverCompany, searchConfig } from "@/lib/scan/discover";
import { clientKey, rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ company: z.string().min(2).max(120) });

/** Find official public sources for a company by name. Rate limited because the public scan page uses it. */
export async function POST(req: Request) {
  const rl = rateLimit(`discover:${clientKey(req)}`, Number(process.env.GMT24_SCAN_RATE_LIMIT) || 20, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited", detail: `Discovery limit reached; try again in ${Math.ceil(rl.retryAfterS / 60)} minutes or upload the report.` }, { status: 429, headers: { "retry-after": String(rl.retryAfterS) } });
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); } catch { return NextResponse.json({ error: "bad_request", detail: "company name required (2–120 characters)" }, { status: 400 }); }
  try {
    const d = await discoverCompany(body.company);
    return NextResponse.json({ ...d, searchConfigured: searchConfig().provider !== "duckduckgo" });
  } catch (e) {
    return NextResponse.json({ error: "discovery_failed", detail: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

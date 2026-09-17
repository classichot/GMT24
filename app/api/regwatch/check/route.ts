import { NextResponse } from "next/server";
import { z } from "zod";
import { checkSources, publicState, sourceStates, storedChanges } from "@/lib/server/regwatch";
import { clientKey, rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Current monitor state: per-source last check / last change, and the stored change records. */
export async function GET() {
  const [sources, changes] = await Promise.all([sourceStates(), storedChanges(200)]);
  return NextResponse.json({ sources: sources.map(publicState), changes });
}

const Body = z.object({ sourceIds: z.array(z.string().min(1).max(60)).max(20).optional(), summarise: z.boolean().optional() });

/** Run the monitor now. Fetches each configured official source, detects amendments and new documents, and summarises them when a model is configured. */
export async function POST(req: Request) {
  const rl = rateLimit(`regwatch:${clientKey(req)}`, Number(process.env.GMT24_REGWATCH_RATE_LIMIT) || 12, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited", detail: `Source checks are limited; try again in ${Math.ceil(rl.retryAfterS / 60)} minutes.` }, { status: 429 });
  let body: z.infer<typeof Body> = {};
  try { const raw = await req.text(); body = raw ? Body.parse(JSON.parse(raw)) : {}; } catch { return NextResponse.json({ error: "bad_request", detail: "sourceIds must be a list of source ids" }, { status: 400 }); }
  try {
    const r = await checkSources({ sourceIds: body.sourceIds, summarise: body.summarise, signal: req.signal });
    const all = await storedChanges(200);
    return NextResponse.json({ checkedAt: r.checkedAt, sources: r.sources.map(publicState), changes: r.changes, allChanges: all, errors: r.errors, model: r.model });
  } catch (e) {
    return NextResponse.json({ error: "check_failed", detail: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

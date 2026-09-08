import { NextResponse } from "next/server";
import { evaluateRehearsalAnswer, RehearsalEvalInputSchema } from "@/lib/llm/rehearsalEval";
import { LlmError } from "@/lib/llm/provider";
import { clientKey, rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 180;

/** Audit Rehearsal: judge the team's answer against the record, surface contradictions, ask the follow-up, draft a grounded response. */
export async function POST(req: Request) {
  const rl = rateLimit(`rehearsal:${clientKey(req)}`, Number(process.env.GMT24_AI_RATE_LIMIT) || 60, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited", detail: `Evaluation limit reached; try again in ${Math.ceil(rl.retryAfterS / 60)} minutes.` }, { status: 429 });
  let body;
  try { body = RehearsalEvalInputSchema.parse(await req.json()); } catch (e) { return NextResponse.json({ error: "bad_request", detail: e instanceof Error ? e.message.slice(0, 200) : "invalid body" }, { status: 400 }); }
  try {
    return NextResponse.json(await evaluateRehearsalAnswer(body, req.signal));
  } catch (e) {
    if (e instanceof LlmError) return NextResponse.json({ error: e.code, detail: e.message }, { status: e.code === "not_configured" ? 501 : e.code === "timeout" ? 504 : 503 });
    return NextResponse.json({ error: "internal", detail: "Answer evaluation failed." }, { status: 500 });
  }
}

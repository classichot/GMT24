import { NextResponse } from "next/server";
import { usageSummary } from "@/lib/llm/telemetry";

export const runtime = "nodejs";

/** Operating-cost monitor: calls, tokens, cost, latency percentiles, recent outcomes. */
export async function GET() {
  return NextResponse.json(usageSummary());
}

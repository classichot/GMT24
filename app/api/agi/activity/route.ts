import { NextResponse } from "next/server";
import { listActivity } from "@/lib/server/agi";
import { failure, isFailure, principalFrom } from "@/lib/server/agiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Gateway activity for a group: every tool call and control action, who made it and whether it succeeded. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = await principalFrom(req, url.searchParams.get("groupId"));
  if (isFailure(p)) return failure(p);
  const limit = Math.min(300, Number(url.searchParams.get("limit")) || 100);
  return NextResponse.json({ groupId: p.groupId, events: await listActivity(p.groupId, limit) });
}

import { NextResponse } from "next/server";
import { summarise } from "@/lib/agi/tools";
import { loadMission } from "@/lib/server/agi";
import { failure, isFailure, principalFrom } from "@/lib/server/agiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One mission. Agents get the summary; the workspace gets the full record (`?full=1`). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await loadMission(id);
  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const p = await principalFrom(req, m.scope.groupId);
  if (isFailure(p)) return failure(p);
  const full = new URL(req.url).searchParams.get("full") === "1" && p.kind === "workspace";
  return NextResponse.json(full ? { mission: m } : { mission: summarise(m) });
}

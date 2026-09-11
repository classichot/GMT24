import { NextResponse } from "next/server";
import { listMissions } from "@/lib/server/agi";
import { failure, isFailure, principalFrom } from "@/lib/server/agiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Retrieve a job by id — how an interrupted client recovers a long-running result. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await principalFrom(req, new URL(req.url).searchParams.get("groupId"));
  if (isFailure(p)) return failure(p);
  for (const m of await listMissions(p.groupId)) {
    const job = m.jobs.find((j) => j.id === id);
    if (job) return NextResponse.json({ job, missionId: m.id, missionState: m.state });
  }
  return NextResponse.json({ error: "not_found", detail: "No job with that id in the granted group. Jobs are kept per mission (last 60)." }, { status: 404 });
}

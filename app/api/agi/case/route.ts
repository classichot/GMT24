import { NextResponse } from "next/server";
import { caseHash, shortHash } from "@/lib/agi/case";
import type { CaseSnapshot } from "@/lib/agi/types";
import { loadCase, pinCase } from "@/lib/server/agi";
import { failure, isFailure, principalFrom, requireWorkspace } from "@/lib/server/agiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The live case version external agents work on for a group. */
export async function GET(req: Request) {
  const p = await principalFrom(req, new URL(req.url).searchParams.get("groupId"));
  if (isFailure(p)) return failure(p);
  const s = await loadCase(p.groupId);
  return NextResponse.json({ groupId: p.groupId, caseHash: caseHash(s), short: shortHash(caseHash(s)), origin: s.origin, takenAt: s.takenAt, fy: s.fy, jurisdictions: s.jurisdictions, electionsOn: Object.keys(s.electionsOn).filter((k) => s.electionsOn[k]), ruleVersions: s.ruleVersions.length });
}

/** Workspace pins its current case so the gateway and the workspace share one version. */
export async function PUT(req: Request) {
  let s: CaseSnapshot;
  try { s = (await req.json()) as CaseSnapshot; } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  if (!s?.groupId || !s.fy) return NextResponse.json({ error: "bad_request", detail: "Not a case snapshot" }, { status: 400 });
  const p = await principalFrom(req, s.groupId);
  if (isFailure(p)) return failure(p);
  const ws = requireWorkspace(p, "Pinning the case");
  if (ws) return failure(ws);
  const pinned = await pinCase(s);
  return NextResponse.json({ ok: true, caseHash: caseHash(pinned), short: shortHash(caseHash(pinned)) });
}

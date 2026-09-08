import { NextResponse } from "next/server";
import { modelFor, publicModelStatus } from "@/lib/llm/config";
import { probe } from "@/lib/llm/provider";
import { serverStore } from "@/lib/server/store";

export const runtime = "nodejs";

/** Model availability for the UI. No credentials, no endpoints. */
export async function GET() {
  const status = publicModelStatus();
  const reach = status.configured ? await probe(modelFor("chat")) : { ok: false, detail: "not configured" };
  return NextResponse.json({ ...status, reachable: reach.ok, detail: reach.detail, store: serverStore.kind, checkedAt: new Date().toISOString() });
}

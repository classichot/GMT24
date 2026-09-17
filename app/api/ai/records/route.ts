import { NextResponse } from "next/server";
import { z } from "zod";
import { serverStore } from "@/lib/server/store";

export const runtime = "nodejs";

const Body = z.object({
  tenant: z.string().min(1).max(64),
  kind: z.enum(["thread", "ticket", "fact", "scenario", "scan", "audit"]),
  id: z.string().min(1).max(120),
  record: z.record(z.unknown()),
});

/**
 * Durable work records. The browser mirrors its working state here so a
 * conversation, ticket or proposed fact survives a device change when a
 * store is configured. Records are namespaced by tenant and never listed
 * across tenants.
 */
export async function PUT(req: Request) {
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  await serverStore.set(`${body.tenant}:${body.kind}:${body.id}`, { ...body.record, savedAt: new Date().toISOString() });
  await serverStore.append(`${body.tenant}:${body.kind}`, { id: body.id, at: new Date().toISOString() }, 500);
  return NextResponse.json({ ok: true, store: serverStore.kind });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tenant = url.searchParams.get("tenant");
  const kind = url.searchParams.get("kind");
  const id = url.searchParams.get("id");
  if (!tenant || !kind) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (id) return NextResponse.json({ record: await serverStore.get(`${tenant}:${kind}:${id}`) });
  return NextResponse.json({ items: await serverStore.list(`${tenant}:${kind}`, 100) });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { AllowedActionSchema, EvidenceSchema, runStep } from "@/lib/llm/orchestrator";
import { LlmError } from "@/lib/llm/provider";

export const runtime = "nodejs";
export const maxDuration = 120;

const ToolCallSchema = z.object({ id: z.string(), name: z.string(), args: z.record(z.unknown()).default({}) });
const MessageSchema = z.union([
  z.object({ role: z.literal("user"), content: z.string() }),
  z.object({ role: z.literal("assistant"), content: z.string(), toolCalls: z.array(ToolCallSchema).optional() }),
  z.object({ role: z.literal("tool"), toolCallId: z.string(), name: z.string(), content: z.string() }),
]);

const Body = z.object({
  feature: z.string().max(40),
  profile: z.enum(["chat", "reasoning", "extraction", "classify"]).default("chat"),
  lang: z.enum(["th", "en"]).default("en"),
  context: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  messages: z.array(MessageSchema).min(1).max(80),
  evidence: z.array(EvidenceSchema).max(60).default([]),
  tools: z.array(z.object({ name: z.string(), description: z.string(), parameters: z.record(z.unknown()) })).max(30).default([]),
  allowedActions: z.array(AllowedActionSchema).max(30).default([]),
});

/**
 * One orchestration step for the Co-Pilot. The browser sends the conversation,
 * the evidence its tools produced and the tools it can run; this returns either
 * tool calls to execute or a schema-validated, grounding-checked answer.
 * Credentials never leave this process.
 */
export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "bad_request", detail: e instanceof Error ? e.message.slice(0, 300) : "invalid body" }, { status: 400 });
  }
  const size = JSON.stringify(body).length;
  if (size > 400_000) return NextResponse.json({ error: "too_large", detail: "Conversation and evidence exceed the request budget; start a new thread or remove attachments." }, { status: 413 });
  try {
    const out = await runStep({ ...body, signal: req.signal });
    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof LlmError) {
      const status = e.code === "not_configured" ? 501 : e.code === "timeout" ? 504 : e.code === "aborted" ? 499 : 503;
      return NextResponse.json({ error: e.code, detail: e.message }, { status });
    }
    console.error("[ai/chat]", e);
    return NextResponse.json({ error: "internal", detail: "Model step failed." }, { status: 500 });
  }
}

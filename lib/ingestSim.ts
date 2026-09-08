import { DATA } from "./model";
import { isSeededGroup } from "./seeds";

export type IngestStatus = "empty" | "running" | "ready";

export function ingestKey(groupId: string) {
  return `gmt24_ingest_${groupId}`;
}

export function readIngestStatus(groupId: string): IngestStatus | null {
  try {
    const v = localStorage.getItem(ingestKey(groupId));
    if (v === "ready" || v === "running" || v === "empty") return v;
    return null;
  } catch {
    return null;
  }
}

export function writeIngestStatus(groupId: string, status: IngestStatus) {
  try {
    localStorage.setItem(ingestKey(groupId), status);
  } catch {
    /* private mode */
  }
}

/** Seeded groups are pre-loaded for normal sign-in; invite reviewers start empty. */
export function defaultIngestStatus(groupId: string, inviteReview: boolean): IngestStatus {
  if (isSeededGroup(groupId) && !inviteReview) return "ready";
  return "empty";
}

export function ingestQueue() {
  return DATA.files.map((f) => ({
    id: f.id,
    name: f.name,
    kind: f.kind,
    entity: f.entity ?? "Group",
  }));
}

export function sampleDownloads() {
  return DATA.demo.samples;
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function runIngestSimulation(
  onTick: (current: number, total: number, fileName: string) => void,
) {
  const queue = ingestQueue();
  const total = queue.length;
  for (let i = 0; i < total; i++) {
    const row = queue[i];
    onTick(i + 1, total, row.name);
    await delay(90 + (i % 3) * 40);
  }
}

export function classifyDroppedName(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("entity") || lower.includes("legal")) return "Legal entity list";
  if (lower.includes("trial") || lower.includes("tb")) return "Trial balance";
  if (lower.includes("consol")) return "Consolidation";
  if (lower.includes("provision") || lower.includes("tax")) return "Tax provision";
  if (lower.includes("cbcr")) return "CbCR";
  if (lower.includes("payroll")) return "Payroll";
  if (lower.includes("deferred")) return "Deferred tax";
  if (lower.includes("boi")) return "BOI certificate";
  if (lower.includes("gir")) return "Previous GIR";
  return "Source file";
}

import { DATA } from "./model";
import { isSeededGroup } from "./seeds";
import { classifyDatasetName } from "./datasetGuideline";

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
/** Seeded demo groups open with the close pack posted, for staff and review-link guests alike; onboarded groups start empty. */
export function defaultIngestStatus(groupId: string, _inviteReview: boolean): IngestStatus {
  if (isSeededGroup(groupId)) return "ready";
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
  return classifyDatasetName(name);
}

export function dropKey(groupId: string) {
  return `gmt24_drops_${groupId}`;
}

export function readQueuedDrops(groupId: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(dropKey(groupId)) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
  } catch {
    return [];
  }
}

export function writeQueuedDrops(groupId: string, names: string[]) {
  try {
    localStorage.setItem(dropKey(groupId), JSON.stringify(names));
  } catch {
    /* private mode */
  }
}

import type { Attachment, AttachmentPage } from "./types";

/**
 * Document processing — shared by the Interviewer (proposed answers with passage
 * references), the Rehearsal (evidence challenge) and the Feedback Collector
 * (screenshots / logs). Extraction runs server-side in /api/ai/extract; this
 * module holds the parts both sides need: instruction stripping, quality
 * scoring and passage search.
 */

/** Text that reads like a prompt to the assistant is evidence about the document, never a command. */
const INSTRUCTION = /\b(ignore (all|any|the)? ?(previous|prior|above) instructions?|you are (now|an?|the) |system prompt|as an ai|disregard (the )?(rules|policy)|grant(s)? (me|the user) (access|permission)|approve (this|the) (snapshot|calculation) (now|automatically)|act as (an? )?(admin|administrator|reviewer))\b/i;

export function stripInstructions(lines: string[]): { kept: string[]; stripped: number } {
  const kept: string[] = [];
  let stripped = 0;
  for (const l of lines) {
    if (INSTRUCTION.test(l)) stripped++;
    else kept.push(l);
  }
  return { kept, stripped };
}

/** 0–100. Penalises empty pages, low alphanumeric density and very short extractions. */
export function extractionQuality(pages: AttachmentPage[]): { quality: number; note: string } {
  const text = pages.map((p) => p.text).join("\n");
  if (!text.trim()) return { quality: 0, note: "No text could be extracted — scanned image or unsupported binary. Provide a text export or CSV." };
  const alnum = (text.match(/[A-Za-z0-9\u0E00-\u0E7F]/g) ?? []).length;
  const density = alnum / Math.max(1, text.length);
  const empty = pages.filter((p) => !p.text.trim()).length;
  let q = Math.round(Math.min(1, density / 0.6) * 80 + Math.min(20, text.length / 200));
  q -= empty * 10;
  q = Math.max(5, Math.min(100, q));
  const note = q >= 80
    ? "Clean text extraction with positional references."
    : q >= 50
      ? `Usable extraction; ${empty ? `${empty} empty page${empty === 1 ? "" : "s"}, ` : ""}some words may be split by kerning.`
      : "Low-quality extraction — treat proposed answers as hints and verify against the original.";
  return { quality: q, note };
}

export type Passage = { page: number; line: number; text: string; score: number };

/** Keyword search over pages; returns cited passages with page / line references. */
export function findPassages(a: Attachment, terms: string[], limit = 3): Passage[] {
  const out: Passage[] = [];
  const toks = terms.map((t) => t.toLowerCase()).filter(Boolean);
  for (const p of a.pages) {
    p.text.split("\n").forEach((line, i) => {
      const l = line.toLowerCase();
      const score = toks.reduce((s, t) => s + (l.includes(t) ? 1 : 0), 0);
      if (score > 0 && line.trim()) out.push({ page: p.n, line: i + 1, text: line.trim().slice(0, 240), score });
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function passageRef(a: Attachment, p: Passage) {
  return `${a.name} · p.${p.page} l.${p.line}`;
}

export function csvRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 400)
    .map((l) => l.split(/,|\t|;/).map((c) => c.trim().replace(/^"|"$/g, "")));
}

/** Client-side upload to the extraction service. */
export async function extractAttachment(file: File, contextKey: string): Promise<Attachment> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/ai/extract", { method: "POST", body: fd });
  if (!res.ok) throw new Error(`Extraction failed (${res.status})`);
  const data = (await res.json()) as { pages: AttachmentPage[]; stripped: number; type: string };
  const { quality, note } = extractionQuality(data.pages);
  return {
    id: `att-${Date.now().toString(36)}`,
    name: file.name,
    size: file.size,
    type: data.type,
    pages: data.pages,
    quality,
    qualityNote: note,
    extractedAt: new Date().toISOString(),
    stripped: data.stripped,
    contextKey,
  };
}

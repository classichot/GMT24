import { buildScan } from "./pipeline";
import { extractUpload } from "./extract";
import { extractionToUpload, periodFromExtraction, resolvedFromExtraction, type WireExtraction } from "./fromExtraction";
import type { ScanResult } from "./types";
import type { Attachment } from "@/lib/ai/types";

/**
 * Browser side of the company-name and upload entry paths. Calls the discovery,
 * fetch and structure services, then runs the deterministic assessment
 * pipeline. Shared by the workspace Quick Scan and the public scan page.
 */

export type ScanProgress = { stage: "discover" | "fetch" | "structure" | "assess"; detail?: string };
export type DiscoveryWire = { query: string; provider: string; searchedAt: string; hits: number; candidates: { url: string; title: string; kind: string; domain: string; isPdf: boolean; period: string | null; official: boolean; score: number; snippet: string }[]; officialDomains: string[]; namesSeen: string[]; notes: string[]; searchConfigured: boolean };
export type DiscoverOutcome =
  | { kind: "scan"; scan: ScanResult; notes: string[] }
  | { kind: "choose"; discovery: DiscoveryWire; reason: string }
  | { kind: "none"; discovery: DiscoveryWire | null; message: string }
  | { kind: "error"; message: string; code: string };

type Common = { period?: string; onProgress?: (p: ScanProgress) => void; signal?: AbortSignal; modelConfigured: boolean };

async function structurePages(pages: { n: number; text: string }[], company: string | undefined, period: string | undefined, signal?: AbortSignal): Promise<WireExtraction> {
  const res = await fetch("/api/scan/structure", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pages, company, period }), signal });
  if (!res.ok) { const e = (await res.json().catch(() => ({}))) as { error?: string; detail?: string }; throw Object.assign(new Error(e.detail ?? `Extraction service returned ${res.status}`), { code: e.error ?? "http" }); }
  return (await res.json()) as WireExtraction;
}

function fail(e: unknown, signal?: AbortSignal): DiscoverOutcome {
  if (signal?.aborted) return { kind: "error", code: "cancelled", message: "Cancelled. Nothing was saved." };
  const code = (e as { code?: string }).code ?? "error";
  return { kind: "error", code, message: code === "not_configured" ? "No language model is configured, so the report cannot be read. Connect a model or use the demonstration corpus." : e instanceof Error ? e.message : String(e) };
}

function heuristicScan(att: Attachment, query: string, period: string | undefined, sourceNote: string[]): DiscoverOutcome {
  const upload = extractUpload(att, period ?? "FY2025");
  const r = buildScan(query, { period, upload });
  r.notes.push(...upload.notes, ...sourceNote, "No language model is configured: the report was read with keyword heuristics only. Connect a model for a full reading.");
  return { kind: "scan", scan: r, notes: [] };
}

export async function scanUpload(att: Attachment, opts: Common & { query?: string }): Promise<DiscoverOutcome> {
  const query = opts.query ?? att.name.replace(/\.[a-z]+$/i, "").replace(/[-_.]+/g, " ");
  if (!att.pages.length) return { kind: "error", code: "no_text", message: `${att.name} has no extractable text (scanned image?). Upload a text PDF.` };
  if (!opts.modelConfigured) return heuristicScan(att, query, opts.period, []);
  try {
    opts.onProgress?.({ stage: "structure", detail: `${att.pages.length} pages` });
    const x = await structurePages(att.pages, query, opts.period, opts.signal);
    const period = opts.period ?? periodFromExtraction(x, "FY2025");
    const { upload, fxNote } = extractionToUpload(x, { attachmentId: att.id, name: att.name, pages: att.pages.length }, period);
    opts.onProgress?.({ stage: "assess" });
    const resolved = resolvedFromExtraction(x, query, {});
    const r = buildScan(query, { period, upload, discovered: { resolved, note: `Read from the uploaded report by ${x.model}; ${x.verification.verified}/${x.verification.checked} quotes verified on their pages.`, source: { kind: "upload", url: null, title: att.name, language: "en" }, discovery: { provider: "upload", searchedAt: new Date().toISOString(), hits: 0, extractionModel: x.model, quotesChecked: x.verification.checked, quotesVerified: x.verification.verified, unverified: x.verification.unverified, fxNote: fxNote ?? undefined } } });
    if (fxNote) r.notes.push(fxNote);
    return { kind: "scan", scan: r, notes: [] };
  } catch (e) {
    return fail(e, opts.signal);
  }
}

export async function scanDiscover(company: string, opts: Common & { url?: string; contextKey: string; onAttachment: (a: Attachment) => void }): Promise<DiscoverOutcome> {
  const name = company.trim();
  if (name.length < 2) return { kind: "error", code: "bad_request", message: "Enter a company name." };
  let discovery: DiscoveryWire | null = null;
  let url = opts.url;
  let title = "";
  let kind = "annual-report";
  try {
    if (!url) {
      opts.onProgress?.({ stage: "discover", detail: name });
      const res = await fetch("/api/scan/discover", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ company: name }), signal: opts.signal });
      if (!res.ok) { const e = (await res.json().catch(() => ({}))) as { detail?: string; error?: string }; return { kind: "error", code: e.error ?? "http", message: e.detail ?? `Discovery service returned ${res.status}` }; }
      discovery = (await res.json()) as DiscoveryWire;
      const docs = discovery.candidates.filter((c) => c.isPdf && ["annual-report", "form-56-1", "financial-statements"].includes(c.kind));
      if (!discovery.candidates.length) return { kind: "none", discovery, message: discovery.notes[0] ?? `No official disclosures found for "${name}".` };
      if (!docs.length) return { kind: "choose", discovery, reason: "Official pages were found but no report PDF; pick a source or upload the report." };
      const first = name.toLowerCase().split(" ")[0];
      if (discovery.namesSeen.length > 1 && !discovery.namesSeen.every((n) => n.toLowerCase().includes(first))) return { kind: "choose", discovery, reason: `More than one company matched "${name}". Choose the right source.` };
      url = docs[0].url; title = docs[0].title; kind = docs[0].kind;
    }
    opts.onProgress?.({ stage: "fetch", detail: url });
    const fres = await fetch("/api/scan/fetch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }), signal: opts.signal });
    if (!fres.ok) { const e = (await fres.json().catch(() => ({}))) as { detail?: string; error?: string }; return { kind: "error", code: e.error ?? "http", message: `Source could not be retrieved (${e.detail ?? fres.status}). Upload the report to continue.` }; }
    const doc = (await fres.json()) as { url: string; finalUrl: string; title: string; pages: { n: number; text: string }[]; stripped: number; bytes: number; isPdf: boolean; notes: string[] };
    if (!doc.pages.length) return { kind: "error", code: "no_text", message: doc.notes[0] ?? "The document has no extractable text. Upload a text PDF." };
    const att: Attachment = { id: `web-${Date.now().toString(36)}`, name: title || doc.title || url, size: doc.bytes, type: doc.isPdf ? "pdf" : "html", pages: doc.pages, quality: 100, qualityNote: `Retrieved from ${new URL(url).hostname}`, extractedAt: new Date().toISOString(), stripped: doc.stripped, contextKey: opts.contextKey };
    opts.onAttachment(att);
    if (!opts.modelConfigured) return heuristicScan(att, name, opts.period, [`Source: ${url}`]);
    opts.onProgress?.({ stage: "structure", detail: `${doc.pages.length} pages` });
    const x = await structurePages(doc.pages, name, opts.period, opts.signal);
    const period = opts.period ?? periodFromExtraction(x, "FY2025");
    const { upload, fxNote } = extractionToUpload(x, { attachmentId: att.id, name: att.name, pages: doc.pages.length }, period);
    opts.onProgress?.({ stage: "assess" });
    const resolved = resolvedFromExtraction(x, name, { exchange: discovery?.officialDomains.find((d) => /set\.or\.th|sgx|hkex|sec\.gov|asx|idx|bursa/.test(d)) ?? null });
    const r = buildScan(name, { period, upload, discovered: { resolved, note: `Resolved from public sources (${discovery?.provider ?? "given URL"}): ${title || doc.title}. Read by ${x.model}; ${x.verification.verified}/${x.verification.checked} quotes verified on their pages.`, source: { kind: kind as ScanResult["sources"][number]["kind"], url, title: title || doc.title, language: "en" }, discovery: { provider: discovery?.provider ?? "url", searchedAt: discovery?.searchedAt ?? new Date().toISOString(), hits: discovery?.hits ?? 0, extractionModel: x.model, quotesChecked: x.verification.checked, quotesVerified: x.verification.verified, unverified: x.verification.unverified, fxNote: fxNote ?? undefined } } });
    if (fxNote) r.notes.push(fxNote);
    if (discovery && discovery.candidates.length > 1) r.notes.push(`Other sources found: ${discovery.candidates.slice(1, 4).map((c) => `${c.title} (${c.domain})`).join("; ")}.`);
    return { kind: "scan", scan: r, notes: [] };
  } catch (e) {
    return fail(e, opts.signal);
  }
}

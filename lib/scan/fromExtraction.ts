import type { CorpusEntity } from "./corpus";
import type { UploadExtract } from "./pipeline";
import type { Relationship, ResolvedEntity } from "./types";

/**
 * Turn a page-verified model extraction into the pipeline's document shape.
 * Amounts stay labelled as disclosed; the only transformation is a stated
 * screening FX conversion into THB million so the €750m test can run.
 */

export type WireExtraction = {
  company: { name: string; ultimateParent: string; parentCountryIso: string | null; exchange: string; ticker: string; reportingPeriod: string; currency: string; unit: string };
  entities: { name: string; countryIso: string | null; relationship: Relationship; ownershipPct: number | null; activity: string; page: number; quote: string }[];
  revenue: { period: string; amount: number; currency: string; unit: string; page: number; quote: string }[];
  disclosures: { topic: UploadExtract["disclosures"][number]["topic"]; countryIsos: (string | null)[]; page: number; quote: string; summary: string }[];
  jurisdictionData: { countryIso: string | null; profitBeforeTax: number | null; incomeTax: number | null; currency: string; unit: string; page: number; quote: string }[];
  notes: string[];
  verification: { checked: number; verified: number; unverified: { kind: string; page: number; quote: string }[] };
  chunks: number;
  pagesRead: number[];
  model: string;
};

/** Screening rates to THB (approximate annual averages). Stated on every scope assessment that uses them. */
export const FX_TO_THB: Record<string, number> = { THB: 1, USD: 36, EUR: 38.5, GBP: 45, SGD: 27, JPY: 0.24, IDR: 0.0022, MYR: 8, AUD: 24, HKD: 4.6, CNY: 5, INR: 0.43, VND: 0.0014, PHP: 0.63, KRW: 0.027, TWD: 1.12, CHF: 41, CAD: 26.5 };

function unitMultiplier(u: string): number {
  switch (u) { case "thousand": return 1e3; case "million": return 1e6; case "billion": return 1e9; default: return 1; }
}

export function toThbMillion(amount: number, currency: string, unit: string, fallbackCurrency: string): { thbM: number; note: string | null } {
  const cur = (currency || fallbackCurrency || "THB").toUpperCase();
  const rate = FX_TO_THB[cur];
  const raw = amount * unitMultiplier(unit);
  if (!rate) return { thbM: 0, note: `Currency ${cur} has no screening rate; amount kept as disclosed only.` };
  return { thbM: Math.round((raw * rate) / 1e6), note: cur === "THB" ? null : `Converted from ${cur} at a screening rate of ${rate} THB/${cur}; replace with the actual average before relying on the threshold test.` };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "company";

export function periodFromExtraction(x: WireExtraction, fallback: string): string {
  const p = x.company.reportingPeriod || x.revenue.map((r) => r.period).sort().reverse()[0] || "";
  const y = p.match(/20\d\d/)?.[0];
  return y ? `FY${y}` : fallback;
}

export function extractionToUpload(x: WireExtraction, doc: { attachmentId: string; name: string; pages: number }, period: string): { upload: UploadExtract; fxNote: string | null } {
  const docId = `upload-${doc.attachmentId}`;
  const notes: string[] = [...x.notes];
  const unverified = new Set(x.verification.unverified.map((u) => `${u.page}:${u.quote.slice(0, 40)}`));
  const isUnverified = (page: number, quote: string) => unverified.has(`${page}:${quote.slice(0, 160).slice(0, 40)}`);
  const entities: CorpusEntity[] = [];
  const idFor = new Map<string, string>();
  x.entities.forEach((e, i) => {
    const iso = (e.countryIso ?? "").toUpperCase();
    if (!iso) { notes.push(`Entity "${e.name}" (p.${e.page}) has no disclosed country; listed as unresolved.`); }
    const id = `x${i + 1}-${slug(e.name).slice(0, 18)}`;
    idFor.set(e.name.toLowerCase(), id);
    entities.push({ id, name: e.name, iso: iso || "??", relationship: e.relationship, ownerId: null, ownership: e.ownershipPct, activity: e.activity || "Not disclosed", page: e.page, text: `${isUnverified(e.page, e.quote) ? "[quote not verified on page] " : ""}${e.quote}` });
  });
  const upeName = x.company.ultimateParent || x.company.name;
  const upeIdx = entities.findIndex((e) => e.relationship === "upe");
  if (upeIdx === -1 && upeName) {
    entities.unshift({ id: "x0-upe", name: upeName, iso: (x.company.parentCountryIso ?? "").toUpperCase() || "??", relationship: "upe", ownerId: null, ownership: null, activity: "Ultimate parent (as named in the report)", page: x.entities[0]?.page ?? 1, text: "Ultimate parent named by the report's cover / basis of consolidation." });
  }
  const upeId = entities.find((e) => e.relationship === "upe")?.id ?? null;
  for (const e of entities) if (e.relationship !== "upe" && !e.ownerId) e.ownerId = upeId;

  let fxNote: string | null = null;
  const revenue: UploadExtract["revenue"] = [];
  for (const r of x.revenue) {
    const c = toThbMillion(r.amount, r.currency, r.unit || x.company.unit, x.company.currency);
    if (c.note) fxNote = fxNote ?? c.note;
    if (!c.thbM) { notes.push(`Revenue ${r.period} kept as disclosed only (${r.amount} ${r.currency || x.company.currency} ${r.unit}).`); continue; }
    const yr = r.period.match(/20\d\d/)?.[0];
    revenue.push({ period: yr ? `FY${yr}` : r.period, amountThbMillion: c.thbM, page: r.page, docId });
  }
  const disclosures: UploadExtract["disclosures"] = x.disclosures.map((d) => ({ topic: d.topic, docId, page: d.page, text: `${isUnverified(d.page, d.quote) ? "[quote not verified on page] " : ""}${d.quote}${d.summary ? ` — ${d.summary}` : ""}`, isos: d.countryIsos.filter((i): i is string => !!i).map((i) => i.toUpperCase()) }));
  const jurisdictionData: UploadExtract["jurisdictionData"] = [];
  for (const j of x.jurisdictionData) {
    const iso = (j.countryIso ?? "").toUpperCase();
    if (!iso) continue;
    const pbt = j.profitBeforeTax != null ? toThbMillion(j.profitBeforeTax, j.currency, j.unit || x.company.unit, x.company.currency) : null;
    const tax = j.incomeTax != null ? toThbMillion(j.incomeTax, j.currency, j.unit || x.company.unit, x.company.currency) : null;
    if (pbt?.note) fxNote = fxNote ?? pbt.note;
    jurisdictionData.push({ iso, docId, page: j.page, text: j.quote, profitBeforeTaxThbM: pbt?.thbM, incomeTaxThbM: tax?.thbM });
  }
  if (x.verification.unverified.length) notes.push(`${x.verification.unverified.length} of ${x.verification.checked} extracted quotes could not be matched to the cited page and are marked as not verified.`);
  return { upload: { attachmentId: doc.attachmentId, name: doc.name, period, entities, revenue, disclosures, jurisdictionData, notes, pages: doc.pages }, fxNote };
}

export function resolvedFromExtraction(x: WireExtraction, query: string, source: { exchange?: string | null }): ResolvedEntity {
  const name = x.company.name || query;
  const upe = x.company.ultimateParent || name;
  return { registryId: `discovered:${slug(name)}`, name, exchange: x.company.exchange || source.exchange || undefined, ticker: x.company.ticker || undefined, upeName: upe, upeIso: (x.company.parentCountryIso ?? "").toUpperCase() || "??", matchedOn: "public sources", isUpe: upe.toLowerCase() === name.toLowerCase(), enteredWasSubsidiary: upe.toLowerCase() !== name.toLowerCase() ? query : undefined };
}

import type { Attachment } from "../ai/types";
import type { CorpusEntity } from "./corpus";
import { ISO_BY_NAME, JURISDICTION_DB, UNSUPPORTED_HINTS, jur } from "./jurisdictionDb";
import type { UploadExtract } from "./pipeline";

/**
 * Reads an uploaded annual report / financial statements (already extracted to
 * page text by the documents API) and proposes entities, revenue history, tax
 * disclosures and jurisdiction-level data — every item with a page reference and
 * the basis "inferred". Nothing here is confirmed; the scan labels it as proposed.
 */
const REL_WORDS: [RegExp, CorpusEntity["relationship"]][] = [
  [/joint\s*venture|jointly\s*controlled/i, "joint-venture"],
  [/associate/i, "associate"],
  [/branch/i, "branch"],
  [/subsidiar/i, "subsidiary"],
  [/investment/i, "investment"],
];

const NAME_SUFFIX = /(public company limited|company limited|co\.,? ?ltd\.?|pte\.? ltd\.?|sdn\.? bhd\.?|limited|ltd\.?|inc\.?|gmbh|b\.v\.|plc|pcl|llc|s\.a\.|corp\.?|corporation|co\.)/i;

const ALL_NAMES: [string, string][] = Object.entries(ISO_BY_NAME).filter(([n]) => n.length > 2).sort((a, b) => b[0].length - a[0].length);
for (const [iso, name] of Object.entries(UNSUPPORTED_HINTS)) ALL_NAMES.push([name.toLowerCase(), iso]);

function isoIn(line: string): { iso: string; name: string } | null {
  const l = line.toLowerCase();
  for (const [n, iso] of ALL_NAMES) if (new RegExp(`(^|[^a-z])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(l)) return { iso, name: jur(iso)?.name ?? UNSUPPORTED_HINTS[iso] ?? iso };
  return null;
}

export function extractUpload(a: Attachment, period: string): UploadExtract {
  const entities: CorpusEntity[] = [];
  const revenue: UploadExtract["revenue"] = [];
  const disclosures: UploadExtract["disclosures"] = [];
  const jurisdictionData: UploadExtract["jurisdictionData"] = [];
  const notes: string[] = [];
  const docId = `upload-${a.id}`;
  const seen = new Set<string>();
  let upeSet = false;

  for (const p of a.pages) {
    const lines = p.text.split(/\n/).map((x) => x.trim()).filter(Boolean);
    for (const line of lines) {
      // Entity rows: a corporate name, a jurisdiction and a percentage on one line (subsidiary tables).
      const pctM = line.match(/(\d{1,3}(?:\.\d{1,2})?)\s?%/);
      const j = isoIn(line);
      if (NAME_SUFFIX.test(line) && j && line.length < 220) {
        const nameM = line.match(new RegExp(`([A-Z][A-Za-z0-9&'().,\\- ]{2,80}?\\s${NAME_SUFFIX.source})`, "i"));
        const name = (nameM?.[1] ?? line.split(/\s{2,}|\t|\|/)[0]).replace(/\s+/g, " ").trim();
        const key = name.toLowerCase();
        if (name.length > 4 && !seen.has(key)) {
          seen.add(key);
          const rel = REL_WORDS.find(([re]) => re.test(line))?.[1] ?? (pctM ? (Number(pctM[1]) > 50 ? "subsidiary" : Number(pctM[1]) >= 20 ? "associate" : "investment") : "unresolved");
          const activity = line.replace(name, "").replace(/\d{1,3}(?:\.\d{1,2})?\s?%/g, "").replace(new RegExp(j.name, "i"), "").replace(/[|\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Not stated";
          entities.push({ id: `u-${entities.length + 1}`, name, iso: j.iso, relationship: rel, ownerId: upeSet ? "u-upe" : null, ownership: pctM ? Number(pctM[1]) : null, activity, page: p.n, text: line.slice(0, 240) });
        }
      }
      // Incentive keywords.
      if (/tax holiday|board of investment|\bBOI\b|promotional privilege|pioneer status|preferential (tax )?rate|tax incentive|exempt(ion)? from (corporate )?income tax|knowledge development box|patent box|innovation box/i.test(line)) {
        const j2 = isoIn(line) ?? { iso: "TH", name: "Thailand" };
        const target = entities.find((e) => line.toLowerCase().includes(e.name.toLowerCase().slice(0, 12))) ?? [...entities].reverse().find((e) => e.iso === j2.iso);
        const schemeId = /knowledge development/i.test(line) ? "IE-kdb" : /patent box/i.test(line) ? "GB-patent" : /innovation box/i.test(line) ? "NL-innobox" : /pioneer/i.test(line) ? "MY-pioneer" : /board of investment|\bBOI\b|promotional privilege/i.test(line) ? "TH-boi-holiday" : j2.iso === "VN" ? "VN-high-tech" : `${j2.iso}-${JURISDICTION_DB.records.find((r) => r.iso === j2.iso)?.schemes[0]?.id.split("-").slice(1).join("-") ?? "incentive"}`;
        if (target) target.incentives = [...(target.incentives ?? []), { schemeId, page: p.n, text: line.slice(0, 300) }];
        disclosures.push({ topic: "incentive", docId, page: p.n, text: line.slice(0, 300), isos: [j2.iso] });
      }
      // Pillar Two statements.
      if (/pillar two|pillar 2|global minimum tax|top-up tax|globe rules/i.test(line)) {
        const isos = [...new Set(ALL_NAMES.filter(([n]) => line.toLowerCase().includes(n)).map(([, iso]) => iso))];
        const topic = /recogni[sz]ed|current tax expense of/i.test(line) ? "top-up-recognised" : /expect|estimate|anticipat/i.test(line) ? "expected-impact" : /uncertain|subject to/i.test(line) ? "uncertainty" : /safe harbou?r/i.test(line) ? "safe-harbour" : "pillar-two-statement";
        disclosures.push({ topic, docId, page: p.n, text: line.slice(0, 400), isos });
      }
      if (/effective tax rate|reconciliation of (the )?(income )?tax/i.test(line) && /\d/.test(line)) disclosures.push({ topic: "tax-reconciliation", docId, page: p.n, text: line.slice(0, 400), isos: [] });
      // Revenue history: "Revenue 2025 33,105" or "Total revenue ... 33,105 31,240".
      const revM = line.match(/(total )?revenues?[^0-9]{0,40}((?:\d{1,3}(?:,\d{3})+(?:\.\d+)?\s*){1,4})/i);
      if (revM && /revenue/i.test(line) && !/segment|cost/i.test(line)) {
        const nums = revM[2].trim().split(/\s+/).map((n) => Number(n.replace(/,/g, ""))).filter((n) => n > 100);
        const years = [...line.matchAll(/20\d{2}/g)].map((m) => m[0]);
        const y0 = Number(period.replace(/\D/g, "")) || new Date().getFullYear() - 1;
        nums.slice(0, 4).forEach((n, i) => { const per = years[i] ? `FY${years[i]}` : `FY${y0 - i}`; if (!revenue.some((r) => r.period === per)) revenue.push({ period: per, amountThbMillion: n > 1_000_000 ? Math.round(n / 1_000_000) : n > 100_000 ? Math.round(n / 1000) : n, page: p.n, docId }); });
      }
      // Jurisdiction-level PBT / tax lines.
      const jm = line.match(/profit before (income )?tax[^0-9-]{0,30}(-?\d{1,3}(?:,\d{3})*)/i);
      const tm = line.match(/income tax (expense)?[^0-9-]{0,30}(-?\d{1,3}(?:,\d{3})*)/i);
      if (j && jm && tm) jurisdictionData.push({ iso: j.iso, docId, page: p.n, text: line.slice(0, 300), profitBeforeTaxThbM: Number(jm[2].replace(/,/g, "")), incomeTaxThbM: Number(tm[2].replace(/,/g, "")) });
    }
    if (!upeSet && /ultimate parent|parent company|holding company of the group/i.test(p.text)) upeSet = true;
  }
  if (!entities.length) notes.push("No subsidiary table recognised — the document may be scanned without a text layer, or the table may be an image. Ownership diagrams are not read in this build; enter entities manually with Structure correction.");
  if (a.quality < 60) notes.push(`Extraction quality ${a.quality}% (${a.qualityNote}). Verify every page reference against the original.`);
  if (a.stripped) notes.push(`${a.stripped} instruction-like line${a.stripped === 1 ? "" : "s"} ignored — the document was read as evidence only.`);
  if (!revenue.length) notes.push("No consolidated revenue history recognised; the scope test needs four years of revenue.");
  return { attachmentId: a.id, name: a.name, period, entities, revenue, disclosures, jurisdictionData, notes, pages: a.pages.length };
}

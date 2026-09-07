import { entityName, explainFlag } from "../scan/pipeline";
import type { ExposureFlag, ScanResult } from "../scan/types";
import { ISO_BY_NAME } from "../scan/jurisdictionDb";
import { propose } from "./actions";
import type { Reply, Section, WorkContext } from "./types";

/**
 * Quick Scan in the Co-Pilot thread: summarise the latest scan, explain one flag,
 * say what would change it, or hand the user to the scan page. Never rates a
 * jurisdiction on its own — every line comes from the scan result.
 */
function reply(ctx: WorkContext, title: string, sections: Section[], cites: Reply["cites"], actions: Reply["actions"], unsupported: string[] = []): Reply {
  return { id: `r-${Date.now().toString(36)}`, at: new Date().toISOString(), feature: "quickscan", title, sections, cites, actions, grounded: true, unsupported, version: ctx.calcVersion, lang: ctx.lang };
}

export function findFlag(q: string, scan: ScanResult): ExposureFlag | null {
  const l = q.toLowerCase();
  for (const f of scan.exposure) if (l.includes(f.name.toLowerCase()) || l.includes(f.iso.toLowerCase() + " ")) return f;
  for (const [name, iso] of Object.entries(ISO_BY_NAME)) if (name.length > 3 && l.includes(name)) return scan.exposure.find((f) => f.iso === iso) ?? null;
  return null;
}

export function flagLine(f: ExposureFlag) {
  return `${f.name} — ${f.priority} review priority | ${f.evidence} evidence | ${f.coverage.entities} entit${f.coverage.entities === 1 ? "y" : "ies"}${f.coverage.jurisdictionFinancials ? ", jurisdictional financials found" : ", no jurisdictional financials"}`;
}

export function quickscanReply(q: string, scan: ScanResult | null, ctx: WorkContext, justRan: boolean): Reply {
  const goScan = propose("navigate", { href: "/quickscan" }, ctx, { label: "Open Quick Scan" });
  if (!scan) {
    return reply(ctx, "Quick Scan", [
      { kind: "text", text: "No scan has been run yet. Give me a company name (Thai or English, ticker, former name or a subsidiary) and I will identify the ultimate parent, read its official disclosures and build a preliminary exposure map — or upload an annual report on the Quick Scan page." },
      { kind: "list", title: "Demonstration corpus", items: ["Siam Verdant Foods PCL (food; Vietnam, Cambodia, Singapore incentives)", "Chao Phraya Industrial Holdings PCL (electronics; recognised top-up)", "Lanna Digital Group PCL (scope insufficient; IP in Ireland; unresolved BVI link)", "Aetherion Holdings PCL (the workspace demo group)"] },
    ], [], [goScan]);
  }
  const l = q.toLowerCase();
  const f = findFlag(q, scan);
  if (f && /what would change|what changes|how (could|would) (this|it) (change|move)|reduce|increase|จะเปลี่ยน/i.test(l)) {
    return reply(ctx, `What would change the ${f.name} assessment`, [
      { kind: "text", text: flagLine(f) },
      { kind: "list", title: "Would raise it", items: f.whatWouldChange.increase },
      { kind: "list", title: "Would lower it", items: f.whatWouldChange.reduce },
      { kind: "next", title: "Would settle it", items: f.whatWouldChange.resolve },
      { kind: "warning", text: "These are the levers the GloBE rules make relevant to this jurisdiction. None of them has been tested — the scan has not seen the entity-level data." },
    ], f.passages.slice(0, 3).map((p) => ({ label: `${p.docId} p.${p.page}` })), [goScan, propose("navigate", { href: "/xray" }, ctx, { label: `Start X-Ray for ${f.name}` })]);
  }
  if (f && /explain|why|อธิบาย|ทำไม/i.test(l)) {
    const ex = explainFlag(f, scan);
    return reply(ctx, `Why ${f.name} is flagged`, [
      { kind: "text", text: flagLine(f) },
      { kind: "steps", title: "Chain", items: ex.steps },
      { kind: "facts", title: "Passages", items: ex.passages.slice(0, 4).map((p) => `${p.docId} p.${p.page}: "${p.text.length > 220 ? `${p.text.slice(0, 217)}…` : p.text}"`) },
      f.disclosedAmount ? { kind: "text", title: "Company-disclosed amount", text: `${f.disclosedAmount.label}: ${f.disclosedAmount.amount} (${f.disclosedAmount.passage.docId} p.${f.disclosedAmount.passage.page}). Disclosed by the company — not calculated by GMT24.` } : { kind: "warning", text: "No company-disclosed amount for this jurisdiction. GMT24 does not estimate a top-up from screening indicators alone." },
      { kind: "next", title: "Collection", items: [`${f.collection.mechanism}. Payer: ${entityName(scan, f.collection.payerEntityId)}.`, ...f.collection.unconfirmed.map((u) => `Unconfirmed: ${u}`)] },
    ], ex.passages.slice(0, 4).map((p) => ({ label: `${p.docId} p.${p.page}` })), [goScan]);
  }
  const high = scan.exposure.filter((x) => x.priority === "High");
  const und = scan.exposure.filter((x) => x.priority === "Undetermined");
  const sections: Section[] = [
    { kind: "conclusion", text: `${scan.resolved?.name ?? scan.query} · ${scan.period} · scope ${scan.scope?.verdict ?? "not assessed"}${scan.scope ? ` (${scan.scope.yearsOver} of ${scan.scope.yearsTested} disclosed years ≥ €750m)` : ""}. ${scan.entities.length} disclosed entities across ${scan.exposure.length} jurisdictions; ${high.length} High priority, ${und.length} Undetermined.${justRan ? " Stages: " + scan.stages.map((s) => `${s.label.split(" ")[0].toLowerCase()} ${s.status}`).join(", ") + "." : ""}` },
    { kind: "table", title: "Exposure map", head: ["Jurisdiction", "Review priority", "Evidence", "Coverage", "Collection"], rows: scan.exposure.map((x) => [x.name, x.priority, x.evidence, `${x.coverage.entities} ent · ${x.coverage.jurisdictionFinancials ? "financials" : "no financials"}`, x.collection.mechanism.split(" (")[0]]) },
    { kind: "facts", title: "Company's own disclosures", items: scan.disclosures.slice(0, 3).map((d) => `[${d.topic}] ${d.summary} (${d.passage.docId} p.${d.passage.page})`) },
    { kind: "gaps", title: "Missing", items: scan.missing.slice(0, 5).map((m) => m.item) },
    { kind: "next", title: "Next", items: scan.questions.slice(0, 3).map((x) => x.question).concat(["Answer the follow-up questions or correct the structure on the Quick Scan page; then create the workspace to hand everything to X-Ray as proposed data."]) },
  ];
  if (scan.notes.some((n) => n.startsWith("Demonstration corpus"))) sections.push({ kind: "warning", text: "Demonstration corpus — modelled on Thai-listed disclosure patterns, labelled as such. Upload the real annual report to scan an actual group." });
  const cites = scan.sources.filter((s) => s.accessible).map((s) => ({ label: s.title }));
  const actions = [goScan];
  if (scan.exposure.length) actions.push(propose("onboard-scan", { scanId: scan.id }, ctx));
  return reply(ctx, `Quick Scan — ${scan.resolved?.name ?? scan.query}`, sections, cites, actions);
}

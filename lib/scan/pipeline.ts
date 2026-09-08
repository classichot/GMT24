import { RULES } from "../model";
import { CORPUS, CORPUS_VERSION, FX_NOTE, REGISTRY, corpusFor, passage, resolvedFromRegistry, thbMillionToEur, type CorpusEntity, type CorpusPeriod, type RegistryEntry } from "./corpus";
import { JURISDICTION_DB, UNSUPPORTED_HINTS, jur, schemeById } from "./jurisdictionDb";
import type { Basis, Correction, Disclosure, EvidenceStrength, ExposureFlag, FollowUp, MissingItem, Passage, Priority, ResolvedEntity, ScanEntity, ScanResult, ScopeAssessment, SourceDoc, Stage, StageId } from "./types";

/**
 * Quick Scan pipeline. Pure functions: resolve → sources → structure → tax
 * disclosures → match → exposure → questions. `assess` re-derives exposure,
 * watchlist, questions and missing items from the entities, corrections and
 * answers, so a user-confirmed fact or a structure correction changes the result
 * without re-reading the documents.
 */
const THB_PER_USD = 34;
/** Same minimum rate parameter the calculation engine uses (rule OECD-GloBE-15). */
const MIN_RATE = Number(RULES.find((r) => r.id === "OECD-GloBE-15")!.parameters.minimumRate);

export const STAGE_LABEL: Record<StageId, string> = {
  resolve: "Identify legal entity and ultimate parent",
  sources: "Find official disclosures",
  structure: "Build disclosed group structure",
  tax: "Read tax disclosures",
  match: "Match jurisdictions to tax intelligence",
  exposure: "Generate exposure map",
  questions: "Select follow-up questions",
};

export const STAGE_ORDER: StageId[] = ["resolve", "sources", "structure", "tax", "match", "exposure", "questions"];

function norm(s: string) { return s.toLowerCase().replace(/[\s.,()\-–—]+/g, " ").replace(/\b(public company limited|pcl|plc|co ltd|co|ltd|limited|company|จำกัด|มหาชน|บริษัท)\b/g, "").replace(/\s+/g, " ").trim(); }

export type Resolution = { resolved: ResolvedEntity | null; alternatives: ResolvedEntity[]; ambiguous: boolean; note: string };

export function resolveEntity(query: string): Resolution {
  const q = norm(query);
  if (!q) return { resolved: null, alternatives: [], ambiguous: false, note: "Enter a company name." };
  const hits: { r: RegistryEntry; score: number; on: string; sub?: string }[] = [];
  for (const r of REGISTRY) {
    const cands: [string, string][] = [[r.name, "legal name"], ...(r.nameTh ? [[r.nameTh, "Thai name"] as [string, string]] : []), ...r.aliases.map((a) => [a, "alias"] as [string, string]), ...(r.formerNames ?? []).map((a) => [a, "former name"] as [string, string]), ...(r.ticker ? [[r.ticker, "ticker"] as [string, string]] : [])];
    for (const [c, on] of cands) {
      const n = norm(c);
      if (!n) continue;
      if (n === q) hits.push({ r, score: 1, on });
      else if (n.includes(q) || q.includes(n)) hits.push({ r, score: Math.min(n.length, q.length) / Math.max(n.length, q.length), on });
    }
    for (const s of r.subsidiaryNames) {
      const n = norm(s);
      if (n === q || n.includes(q) || (q.length > 6 && q.includes(n))) hits.push({ r, score: 0.9, on: "subsidiary name", sub: s });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  const byId = new Map<string, typeof hits[number]>();
  for (const h of hits) if (!byId.has(h.r.id)) byId.set(h.r.id, h);
  const list = [...byId.values()];
  if (!list.length) return { resolved: null, alternatives: [], ambiguous: false, note: `No legal entity matching "${query}" in the GMT24 registry (${CORPUS_VERSION}). Private groups and groups outside the corpus can be scanned from an uploaded annual report or audited financial statements.` };
  const top = list[0];
  const ambiguous = list.length > 1 && list[1].score >= top.score - 0.15 && top.score < 1;
  const resolved = resolvedFromRegistry(top.r, top.on, top.sub);
  return { resolved: ambiguous ? null : resolved, alternatives: list.map((h) => resolvedFromRegistry(h.r, h.on, h.sub)), ambiguous, note: ambiguous ? "Several groups match — choose the one you meant." : top.sub ? `"${top.sub}" is a subsidiary. The scan runs on the ultimate parent, ${top.r.name}.` : `Matched on ${top.on}.` };
}

export type UploadExtract = {
  attachmentId: string;
  name: string;
  period: string;
  entities: CorpusEntity[];
  revenue: CorpusPeriod["revenue"];
  disclosures: CorpusPeriod["disclosures"];
  jurisdictionData: NonNullable<CorpusPeriod["jurisdictionData"]>;
  notes: string[];
  pages: number;
};

export type DiscoveredSource = { resolved: ResolvedEntity; note: string; source: { kind: SourceDoc["kind"]; url: string | null; title: string; language: SourceDoc["language"] }; discovery: NonNullable<ScanResult["discovery"]> };
export type ScanOptions = { period?: string; registryId?: string; upload?: UploadExtract; now?: string; /** Company resolved from real public sources (not the registry). */ discovered?: DiscoveredSource };

export function periodsFor(registryId: string | null): string[] {
  const c = registryId ? corpusFor(registryId) : undefined;
  return c ? c.periods.map((p) => p.period).sort().reverse() : [];
}

function toDoc(d: Omit<SourceDoc, "retrievedAt">, now: string): SourceDoc { return { ...d, retrievedAt: now }; }

function toEntity(e: CorpusEntity, period: string, docId: string, basis: Basis = "disclosed"): ScanEntity {
  const rec = jur(e.iso);
  return {
    id: e.id, name: e.name, nameTh: e.nameTh, formerNames: e.formerNames, incorporationIso: e.iso, incorporationName: rec?.name ?? UNSUPPORTED_HINTS[e.iso] ?? e.iso,
    taxResidenceIso: e.taxResidenceIso ?? null, taxResidenceBasis: e.taxResidenceIso ? "disclosed" : null,
    relationship: e.relationship, ownerId: e.ownerId, ownership: e.ownership, activity: e.activity,
    incentives: (e.incentives ?? []).map((i) => ({ schemeId: i.schemeId, basis: "disclosed" as Basis, passage: passage(docId, i.page, i.text, period), period: { from: i.from, to: i.to } })),
    evidence: [passage(docId, e.page, e.text, period)], basis, period,
  };
}

export function buildScan(query: string, opts: ScanOptions = {}): ScanResult {
  const now = opts.now ?? new Date().toISOString();
  const res: Resolution = opts.discovered ? { resolved: opts.discovered.resolved, alternatives: [], ambiguous: false, note: opts.discovered.note } : opts.registryId ? { resolved: resolvedFromRegistry(REGISTRY.find((r) => r.id === opts.registryId)!, "selected"), alternatives: [], ambiguous: false, note: "Selected by user." } : resolveEntity(query);
  const stages: Stage[] = STAGE_ORDER.map((id) => ({ id, label: STAGE_LABEL[id], status: "pending" }));
  const set = (id: StageId, status: Stage["status"], note?: string) => { const s = stages.find((x) => x.id === id)!; s.status = status; s.note = note; };
  const result: ScanResult = {
    id: `scan-${Date.now().toString(36)}`, query, startedAt: now, completedAt: null, period: opts.period ?? "", periodsAvailable: [], dbVersion: JURISDICTION_DB.version, corpusVersion: CORPUS_VERSION,
    resolved: res.resolved, alternatives: res.alternatives, stages, sources: [], scope: null, entities: [], unresolvedLinks: [], exposure: [], watchlist: [], disclosures: [], missing: [], questions: [], answers: {}, corrections: [], supportedIsos: [], unsupportedIsos: [], notes: [res.note],
  };

  // Stage 1 — resolve.
  if (!res.resolved && !opts.upload) {
    set("resolve", res.ambiguous ? "partial" : "failed", res.note);
    for (const id of STAGE_ORDER.slice(1)) set(id, "pending", "Waiting for entity resolution or an uploaded report.");
    result.completedAt = now;
    return result;
  }
  set("resolve", "done", res.resolved ? `${res.resolved.name}${res.resolved.enteredWasSubsidiary ? ` (entered: ${res.resolved.enteredWasSubsidiary})` : ""}` : `Uploaded report: ${opts.upload!.name}`);

  // Stage 2 — sources.
  const corpus = res.resolved ? corpusFor(res.resolved.registryId) : undefined;
  result.periodsAvailable = corpus ? corpus.periods.map((p) => p.period).sort().reverse() : opts.upload ? [opts.upload.period] : [];
  const period = opts.period && result.periodsAvailable.includes(opts.period) ? opts.period : result.periodsAvailable[0] ?? opts.upload?.period ?? "";
  result.period = period;
  const cp = corpus?.periods.find((p) => p.period === period);
  const docs: SourceDoc[] = [];
  if (cp) docs.push(...cp.docs.map((d) => toDoc(d, now)));
  if (opts.upload) docs.push({ id: `upload-${opts.upload.attachmentId}`, title: opts.discovered?.source.title ?? opts.upload.name, kind: opts.discovered?.source.kind ?? "upload", period: opts.upload.period, issuer: res.resolved?.name ?? query, url: opts.discovered?.source.url ?? null, retrievedAt: now, accessible: true, pages: opts.upload.pages, language: opts.discovered?.source.language ?? "en", attachmentId: opts.upload.attachmentId });
  if (opts.discovered) result.discovery = opts.discovered.discovery;
  result.sources = docs;
  const inaccessible = docs.filter((d) => !d.accessible);
  if (!docs.length) { set("sources", "failed", "No official disclosures found. Upload the annual report or audited statements."); }
  else set("sources", inaccessible.length ? "partial" : "done", `${docs.filter((d) => d.accessible).length} accessible source${docs.length === 1 ? "" : "s"}${inaccessible.length ? `; ${inaccessible.length} inaccessible` : ""} · reporting period ${period}`);
  if (inaccessible.length) result.notes.push(...inaccessible.map((d) => `Inaccessible: ${d.title} — ${d.inaccessibleReason}`));
  if (res.resolved && REGISTRY.find((r) => r.id === res.resolved!.registryId)?.demo) result.notes.push("Demonstration corpus: disclosures modelled on the reporting pattern of Thai-listed groups. Verify against the original filings before relying on any finding.");

  // Stage 3 — structure.
  const primaryDoc = cp?.docs.find((d) => d.kind === "form-56-1" || d.kind === "annual-report")?.id ?? cp?.docs[0]?.id ?? `upload-${opts.upload?.attachmentId}`;
  const entities: ScanEntity[] = [];
  if (cp) entities.push(...cp.entities.map((e) => toEntity(e, period, primaryDoc)));
  if (opts.upload) {
    const uDoc = `upload-${opts.upload.attachmentId}`;
    for (const e of opts.upload.entities) if (!entities.some((x) => norm(x.name) === norm(e.name))) entities.push(toEntity(e, opts.upload.period, uDoc, "inferred"));
  }
  result.entities = entities;
  result.unresolvedLinks = entities.filter((e) => e.relationship === "unresolved" || (e.ownerId && !entities.some((x) => x.id === e.ownerId))).map((e) => ({ entityId: e.id, reason: e.relationship === "unresolved" ? "Relationship to the group not stated in the disclosures." : `Owner ${e.ownerId} not found among disclosed entities.` }));
  if (!entities.length) set("structure", "failed", "No entities extracted.");
  else set("structure", result.unresolvedLinks.length ? "partial" : "done", `${entities.length} entities · ${result.unresolvedLinks.length} unresolved link${result.unresolvedLinks.length === 1 ? "" : "s"}`);

  // Stage 4 — tax disclosures + scope.
  const disclosures: Disclosure[] = [];
  const dsrc = [...(cp?.disclosures ?? []), ...(opts.upload?.disclosures ?? [])];
  dsrc.forEach((d, i) => disclosures.push({ id: `d${i}`, topic: d.topic, summary: d.text.length > 180 ? `${d.text.slice(0, 177)}…` : d.text, passage: passage(d.docId, d.page, d.text, period, d.section), isos: d.isos }));
  result.disclosures = disclosures;
  result.scope = scopeAssessment([...(cp?.revenue ?? []), ...(opts.upload?.revenue ?? [])], period, disclosures);
  set("tax", disclosures.length ? "done" : "partial", `${disclosures.length} tax disclosure${disclosures.length === 1 ? "" : "s"} · scope: ${result.scope.verdict}`);

  // Stage 5 — match.
  const isos = [...new Set(entities.map((e) => e.incorporationIso))];
  result.supportedIsos = isos.filter((i) => jur(i)?.supported);
  result.unsupportedIsos = isos.filter((i) => !jur(i)?.supported);
  set("match", result.unsupportedIsos.length ? "partial" : "done", `${result.supportedIsos.length} of ${isos.length} jurisdictions in ${JURISDICTION_DB.version}${result.unsupportedIsos.length ? ` · unsupported: ${result.unsupportedIsos.join(", ")}` : ""}`);

  // Stages 6–7 — exposure and questions (re-derivable).
  const jd = [...(cp?.jurisdictionData ?? []), ...(opts.upload?.jurisdictionData ?? [])];
  const da = cp?.disclosedAmounts ?? [];
  if (opts.upload?.jurisdictionData.length) result.extraJurisdictionData = opts.upload.jurisdictionData;
  const assessed = assess({ ...result, notes: result.notes }, { jurisdictionData: jd, disclosedAmounts: da });
  assessed.completedAt = new Date().toISOString();
  return assessed;
}

export function scopeAssessment(revenue: CorpusPeriod["revenue"], period: string, disclosures: Disclosure[]): ScopeAssessment {
  const rows = revenue.map((r) => ({ period: r.period, amount: r.amountThbMillion * 1_000_000, currency: "THB", eurEquivalent: thbMillionToEur(r.amountThbMillion), passage: passage(r.docId, r.page, `Total revenue ${r.period}: THB ${r.amountThbMillion.toLocaleString()} million`, period), basis: "disclosed" as Basis })).sort((a, b) => a.period.localeCompare(b.period));
  const y = Number(period.replace(/\D/g, "")) || 2025;
  const tested = `FY${y + 1}`;
  const window = [y - 3, y - 2, y - 1, y].map((n) => `FY${n}`);
  const inWindow = rows.filter((r) => window.includes(r.period));
  const over = inWindow.filter((r) => (r.eurEquivalent ?? 0) >= 750_000_000);
  const reasons: string[] = [];
  let verdict: ScopeAssessment["verdict"];
  if (over.length >= 2) { verdict = "in-scope"; reasons.push(`Consolidated revenue ≥ €750m in ${over.length} of the ${inWindow.length} disclosed years preceding ${tested} (${over.map((r) => r.period).join(", ")}).`); }
  else if (inWindow.length === 4) { verdict = "out-of-scope"; reasons.push(`Only ${over.length} of the four preceding years reach €750m.`); }
  else { verdict = "insufficient"; reasons.push(`Only ${inWindow.length} of the four preceding years are disclosed in the sources read; ${over.length} over the threshold so far. Two are required (Art. 1.1).`); }
  const stmt = disclosures.find((d) => d.topic === "pillar-two-statement");
  if (stmt) reasons.push(`Management statement found: "${stmt.summary}"`);
  else reasons.push("No management Pillar Two scope statement found in the sources read.");
  reasons.push("Scope also depends on excluded-entity status and the consolidation basis of the UPE's financial statements, which the disclosures do not settle.");
  return { verdict, reasons, revenue: rows, fxAssumption: FX_NOTE, threshold: `€750m in ≥ 2 of the 4 fiscal years preceding ${tested} (OECD Model Rules Art. 1.1)`, yearsOver: over.length, yearsTested: inWindow.length };
}

type AssessExtra = { jurisdictionData: NonNullable<CorpusPeriod["jurisdictionData"]>; disclosedAmounts: NonNullable<CorpusPeriod["disclosedAmounts"]> };

const ACTIVITY_KEYS: Record<string, string[]> = { manufacturing: ["manufactur", "processing", "production", "components", "ems", "electronics", "precision"], electronics: ["electronic", "pcb", "ems"], software: ["software", "digital", "platform", "development"], IP: ["ip", "licens", "intellectual"], holding: ["holding"], treasury: ["treasury", "financing"], trading: ["trading", "procurement", "distribution"], headquarters: ["headquarters", "regional"], "R&D": ["r&d", "research", "labs"], export: ["export"], services: ["services"], "high-tech": ["high-tech", "technology"], logistics: ["logistic"], agriculture: ["farm", "agri", "rice", "aqua"], tourism: [], energy: ["energy", "power"], pharma: ["pharma"], BPO: ["bpo"], IT: ["software", "it "], "shared services": ["shared"], leasing: ["leasing"], biotech: ["bio"], automotive: ["automotive"], aviation: [], medical: ["medical"], refining: [], infrastructure: [], hydropower: [], "high-tech ": [] };

function activityMatches(activity: string, schemeActivities: string[]) {
  const a = activity.toLowerCase();
  return schemeActivities.some((s) => (ACTIVITY_KEYS[s] ?? [s.toLowerCase()]).some((k) => k && a.includes(k)));
}

function periodOverlaps(p: { from?: string; to?: string } | undefined, period: string) {
  if (!p) return true;
  const y = Number(period.replace(/\D/g, ""));
  if (p.to && Number(p.to.slice(0, 4)) < y) return false;
  if (p.from && Number(p.from.slice(0, 4)) > y) return false;
  return true;
}

export function applyCorrections(entities: ScanEntity[], corrections: Correction[]): ScanEntity[] {
  let out = entities.map((e) => ({ ...e }));
  for (const c of corrections) {
    if (c.kind === "add") out.push({ ...c.entity, basis: "user-confirmed", correctedBy: c.by });
    else if (c.kind === "outdated") out = out.map((e) => (e.id === c.entityId ? { ...e, outdated: true, correctedBy: c.by } : e));
    else if (c.kind === "ownership") out = out.map((e) => (e.id === c.entityId ? { ...e, ownership: c.ownership, relationship: c.relationship, basis: "user-confirmed", correctedBy: c.by } : e));
    else if (c.kind === "residence") out = out.map((e) => (e.id === c.entityId ? { ...e, taxResidenceIso: c.iso, taxResidenceBasis: "user-confirmed", correctedBy: c.by } : e));
  }
  return out;
}

const CE_RELATIONSHIPS = new Set(["upe", "subsidiary", "branch"]);

export function assess(r: ScanResult, extra?: AssessExtra): ScanResult {
  const ents = applyCorrections(r.entities, r.corrections).filter((e) => !e.outdated);
  const upe = ents.find((e) => e.relationship === "upe") ?? null;
  const jd = extra?.jurisdictionData ?? [];
  const da = extra?.disclosedAmounts ?? [];
  const isos = [...new Set(ents.filter((e) => e.relationship !== "associate" && e.relationship !== "investment").map((e) => e.taxResidenceIso ?? e.incorporationIso))];
  const flags: ExposureFlag[] = [];
  const missing: MissingItem[] = [];
  const questions: FollowUp[] = [];
  const watch = new Map<string, { reasons: string[]; role: "contributing" | "payer" | "both" }>();
  const addWatch = (id: string, reason: string, role: "contributing" | "payer") => { const w = watch.get(id) ?? { reasons: [], role }; if (!w.reasons.includes(reason)) w.reasons.push(reason); if (w.role !== role) w.role = "both"; watch.set(id, w); };
  const ans = (id: string) => r.answers[id]?.value;
  const upeRec = upe ? jur(upe.incorporationIso) : undefined;
  const y = Number(r.period.replace(/\D/g, "")) || 2025;
  const active = (s: { status: string; from: string | null }) => s.status === "in-force" && !!s.from && Number(s.from.slice(0, 4)) <= y;

  for (const iso of isos) {
    const rec = jur(iso);
    const inIso = ents.filter((e) => (e.taxResidenceIso ?? e.incorporationIso) === iso && e.relationship !== "associate" && e.relationship !== "investment");
    const ces = inIso.filter((e) => CE_RELATIONSHIPS.has(e.relationship));
    const jvs = inIso.filter((e) => e.relationship === "joint-venture");
    const name = rec?.name ?? UNSUPPORTED_HINTS[iso] ?? iso;
    const reasons: string[] = [];
    const passages: Passage[] = [];
    const flagMissing: string[] = [];
    if (!rec) {
      flags.push({ iso, name, priority: "Undetermined", evidence: "Limited", coverage: { entities: inIso.length, entitiesWithFinancials: 0, periods: [r.period], jurisdictionFinancials: false }, reasons: [`${name} is not in ${r.dbVersion}. No screening indicators applied; the entities are listed for completeness.`], contributing: inIso.map((e) => e.id), collection: { mechanism: "Unknown", payerEntityId: null, payerNote: "Cannot assess without a jurisdiction record.", unconfirmed: ["Implementation status", "Statutory rate", "Incentive regimes"] }, passages: inIso.flatMap((e) => e.evidence), whatWouldChange: { increase: [], reduce: [], resolve: [`Add ${name} to the jurisdiction database with sourced rates and rule status.`] }, missing: [`Jurisdiction record for ${name}`], dbVersion: r.dbVersion, screening: { statutoryRate: NaN, schemesAvailable: 0, iir: { status: "unknown", from: null }, qdmtt: { status: "unknown", from: null }, utpr: { status: "unknown", from: null }, centralRecord: { listed: "pending", asOf: "", url: "" } }, unsupportedJurisdiction: true });
      missing.push({ id: `jdb-${iso}`, item: `Jurisdiction record for ${name}`, why: "Not in the controlled dataset used by this scan.", kind: "fact", iso });
      continue;
    }
    // Signals.
    const incentiveEnts = inIso.filter((e) => e.incentives.some((i) => periodOverlaps(i.period, r.period) && ans(`inc-${e.id}`) !== "expired" && ans(`inc-${e.id}`) !== "none"));
    const expiredByUser = inIso.filter((e) => e.incentives.length && (ans(`inc-${e.id}`) === "expired" || ans(`inc-${e.id}`) === "none"));
    const jdata = jd.find((x) => x.iso === iso);
    const disclosed = da.filter((x) => x.iso === iso);
    const recognised = r.disclosures.filter((d) => (d.topic === "top-up-recognised" || d.topic === "expected-impact") && d.isos.includes(iso));
    const mentioned = r.disclosures.filter((d) => d.isos.includes(iso));
    const lowStatutory = rec.statutoryRate < MIN_RATE;
    const schemesMatched = rec.schemes.filter((s) => inIso.some((e) => activityMatches(e.activity, s.activities)));
    const bookEtr = jdata && jdata.profitBeforeTaxThbM ? (jdata.incomeTaxThbM ?? 0) / jdata.profitBeforeTaxThbM : null;
    const shAnswer = ans(`sh-${iso}`);
    const dataAnswer = ans(`data-${iso}`);

    for (const e of incentiveEnts) for (const i of e.incentives) {
      const s = schemeById(i.schemeId);
      reasons.push(`${e.name}: ${s?.name ?? i.schemeId} disclosed${i.period?.to ? ` (to ${i.period.to})` : ""} — ${i.basis}. ${s ? s.effect : ""}`);
      if (i.passage) passages.push(i.passage);
      addWatch(e.id, `Incentive disclosed: ${s?.name ?? i.schemeId}`, "contributing");
    }
    for (const e of expiredByUser) reasons.push(`${e.name}: incentive reported ${ans(`inc-${e.id}`) === "expired" ? "expired" : "not benefiting"} in ${r.period} — user-confirmed.`);
    if (lowStatutory) { reasons.push(`Statutory rate ${(rec.statutoryRate * 100).toFixed(1)}% is below 15% (${rec.rateSource}, as of ${rec.rateAsOf}) — a screening indicator only; it does not establish GloBE ETR.`); for (const e of ces) addWatch(e.id, `Incorporated in a sub-15% statutory-rate jurisdiction (${(rec.statutoryRate * 100).toFixed(1)}%)`, "contributing"); }
    if (!incentiveEnts.length && schemesMatched.length) reasons.push(`${schemesMatched.length} scheme${schemesMatched.length === 1 ? "" : "s"} available in ${name} match the disclosed activities (${schemesMatched.map((s) => s.name).join("; ")}) — no disclosure ties them to these entities.`);
    if (bookEtr != null) reasons.push(`Disclosed ${name} data: PBT THB ${jdata!.profitBeforeTaxThbM!.toLocaleString()}m, income tax THB ${(jdata!.incomeTaxThbM ?? 0).toLocaleString()}m → book rate ${(bookEtr * 100).toFixed(1)}% (screening; not GloBE ETR).`);
    if (bookEtr != null) passages.push(passage(jdata!.docId, jdata!.page, jdata!.text, r.period));
    for (const d of recognised) { reasons.push(`Company disclosure (${d.topic.replace("-", " ")}): ${d.summary}`); passages.push(d.passage); }
    if (jvs.length) reasons.push(`${jvs.map((j) => j.name).join(", ")}: joint venture — assessed separately under Art. 6.4, not blended with the constituent entities.`);
    if (!inIso.some((e) => e.taxResidenceIso)) { flagMissing.push(`Tax residence of ${ces.map((e) => e.name).join(", ") || inIso.map((e) => e.name).join(", ")} (incorporation is disclosed; residence is not).`); }
    if (shAnswer === "yes") reasons.push("User-confirmed: transitional CbCR safe harbour expected to apply — reduces review priority pending the CbCR test.");

    // Priority and evidence — kept separate.
    let priority: Priority;
    if (!ces.length && !jvs.length) { priority = "Undetermined"; reasons.push(`No constituent entity confirmed in ${name} — the disclosed link is unresolved. Resolve the relationship before rating.`); }
    else if (disclosed.length || recognised.some((d) => d.topic === "top-up-recognised")) priority = "High";
    else if (incentiveEnts.length || (bookEtr != null && bookEtr < MIN_RATE)) priority = "High";
    else if (lowStatutory) priority = ces.some((e) => /holding|financ|treasury/i.test(e.activity)) && !ces.some((e) => !/holding|financ|treasury/i.test(e.activity)) ? "Medium" : "High";
    else if (schemesMatched.length && ces.length) priority = "Medium";
    else if (bookEtr != null && bookEtr >= MIN_RATE) priority = "Low";
    else if (expiredByUser.length && !incentiveEnts.length && !schemesMatched.length) priority = "Low";
    else priority = "Undetermined";
    if (shAnswer === "yes" && priority === "High") priority = "Medium";
    if (priority === "Undetermined" && (ces.length || jvs.length)) reasons.push(`Statutory ${(rec.statutoryRate * 100).toFixed(1)}%, no incentive disclosed, no jurisdictional financial information in the sources — cannot rate. Undetermined is not a low-risk rating.`);
    if (priority === "Low") reasons.push("Low priority rests on positive evidence (disclosed data or user confirmation), not on the absence of information.");
    let evidence: EvidenceStrength = "Limited";
    if (jdata || disclosed.length || recognised.some((d) => d.topic === "top-up-recognised")) evidence = "Strong";
    else if (incentiveEnts.length || mentioned.length) evidence = "Moderate";

    // Collection — separate from contribution.
    const payerLocal = ces.find((e) => !/holding|financ/i.test(e.activity)) ?? ces[0] ?? null;
    const unconfirmed: string[] = [];
    let mechanism: string; let payerEntityId: string | null; let payerNote: string;
    if (active(rec.qdmtt)) {
      mechanism = `QDMTT in ${name} (${rec.qdmtt.status} from ${rec.qdmtt.from})`;
      payerEntityId = payerLocal?.id ?? null;
      payerNote = payerLocal ? `${payerLocal.name} would pay the domestic top-up locally; the UPE's IIR applies only to any residual.` : "Local constituent entity not identified.";
      unconfirmed.push(`Qualified status: OECD Central Record listing "${rec.centralRecord.listed}" as of ${rec.centralRecord.asOf} — absence from the Record is not itself non-qualification.`);
      unconfirmed.push("QDMTT safe harbour availability for the period.");
      if (payerLocal) addWatch(payerLocal.id, `Potential QDMTT payer in ${name}`, "payer");
    } else if (upe && upeRec && active(upeRec.iir) && iso !== upe.incorporationIso) {
      mechanism = `IIR at the UPE in ${upeRec.name} (${upeRec.iir.status} from ${upeRec.iir.from})`;
      payerEntityId = upe.id;
      payerNote = `${upe.name} would pay under the IIR for its allocable share; ${name} has no domestic minimum tax in force for ${r.period}.`;
      unconfirmed.push("Ownership chain — an intermediate parent in an IIR jurisdiction could take precedence (Art. 2.1.4).");
      unconfirmed.push(`Allocable share for ${ces.filter((e) => (e.ownership ?? 100) < 100).map((e) => `${e.name} (${e.ownership}%)`).join(", ") || "wholly owned entities (100%)"}.`);
      addWatch(upe.id, `Potential IIR payer for ${name}`, "payer");
    } else if (upe && iso === upe.incorporationIso && upeRec && active(upeRec.qdmtt)) {
      mechanism = `QDMTT in ${name} (UPE jurisdiction)`; payerEntityId = upe.id; payerNote = `${upe.name} pays the domestic top-up on its own jurisdiction.`;
      unconfirmed.push(`Qualified status per OECD Central Record: "${rec.centralRecord.listed}" as of ${rec.centralRecord.asOf}.`);
    } else {
      mechanism = "UTPR in implementing jurisdictions, if any residual"; payerEntityId = null; payerNote = "Neither a local QDMTT nor a UPE IIR is in force for the period; a residual could be allocated under UTPR to group entities in implementing jurisdictions.";
      unconfirmed.push("Which group jurisdictions have UTPR in force and the employee/asset allocation key (Art. 2.6).");
    }
    if (payerEntityId && ces.some((e) => e.id !== payerEntityId) && (incentiveEnts.length || lowStatutory)) payerNote += ` Note: the entity contributing to low-taxed income (${(incentiveEnts[0] ?? ces[0]).name}) and the entity responsible for paying or reporting may differ.`;

    // Disclosed amount and independent estimate.
    const disclosedAmount = disclosed[0] ? { label: disclosed[0].label, amount: disclosed[0].amount, passage: passage(disclosed[0].docId, disclosed[0].page, disclosed[0].text, r.period) } : undefined;
    let estimate: ExposureFlag["estimate"];
    if (bookEtr != null && bookEtr < MIN_RATE && jdata?.profitBeforeTaxThbM) {
      const topUpThb = (MIN_RATE - bookEtr) * jdata.profitBeforeTaxThbM * 1_000_000;
      estimate = { label: `Screening estimate — ${name} ${r.period}`, amountUsd: Math.round(topUpThb / THB_PER_USD), assumptions: ["Disclosed profit before tax used as a proxy for Net GloBE Income (no Art. 3.2 adjustments).", "Disclosed income tax expense used as a proxy for Adjusted Covered Taxes (no deferred-tax recast, no Art. 4.1 adjustments).", "No substance-based income exclusion deducted — the estimate is an upper bound before SBIE.", `THB converted at ${THB_PER_USD} THB/USD for display.`, "No safe harbour applied."], engine: `GMT24-CALC Art. 5.2 chain: (15% − book rate) × profit. Upper-bound screen, not an engine run on entity data.` };
    }

    const coverage = { entities: inIso.length, entitiesWithFinancials: jdata ? ces.length : 0, periods: [r.period], jurisdictionFinancials: !!jdata };
    if (!jdata && dataAnswer !== "available") flagMissing.push(`Jurisdictional GloBE income and Adjusted Covered Taxes for ${name}, ${r.period}.`);
    if (incentiveEnts.length) flagMissing.push(`Incentive certificates for ${incentiveEnts.map((e) => e.name).join(", ")}: dates, cap and income covered.`);
    if (!jdata) flagMissing.push(`CbCR rows for ${name} (revenue, PBT, taxes paid/accrued) for the transitional safe harbour test.`);
    flagMissing.push(`Payroll and tangible asset figures for ${name} entities (SBIE).`);
    const wwc = {
      increase: [
        incentiveEnts.length ? "Confirmation that the incentive is active for the full period and covers most of the entity's income." : "Evidence that an available incentive is in fact used by a group entity here.",
        "Jurisdictional profit large relative to local payroll and tangible assets (small SBIE).",
        "Deferred tax not recast at 15%, or covered taxes reduced by refundable credits classified as non-qualified.",
      ],
      reduce: [
        "Substance-based income exclusion covering most of the jurisdiction's income (payroll + tangible assets).",
        `Transitional CbCR safe harbour: simplified ETR ≥ ${y >= 2026 ? "17" : "16"}% or routine-profits test passed for ${r.period}.`,
        incentiveEnts.length ? "Incentive expired, capped or applying to a small part of income; credit classified as QRTC." : "De minimis (revenue < €10m and profit < €1m) in this jurisdiction.",
        active(rec.qdmtt) ? "QDMTT safe harbour — top-up paid locally, nothing at UPE level." : "Local QDMTT enacted for the period (would move collection, not exposure).",
      ],
      resolve: [
        `Jurisdictional GloBE income and covered taxes for ${r.period}.`,
        "Tax residence confirmation for each entity (incorporation is not proof).",
        incentiveEnts.length ? "Incentive certificate with dates, cap and conditions." : "Written confirmation that no incentive is claimed.",
        "CbCR jurisdiction rows for the safe harbour test.",
      ],
    };
    flags.push({ iso, name, priority, evidence, coverage, reasons, contributing: [...incentiveEnts, ...ces.filter((e) => lowStatutory)].map((e) => e.id).filter((v, i, a) => a.indexOf(v) === i), collection: { mechanism, payerEntityId, payerNote, unconfirmed }, passages, whatWouldChange: wwc, missing: flagMissing, disclosedAmount, estimate, dbVersion: r.dbVersion, screening: { statutoryRate: rec.statutoryRate, schemesAvailable: rec.schemes.length, iir: rec.iir, qdmtt: rec.qdmtt, utpr: rec.utpr, centralRecord: rec.centralRecord } });

    // Questions.
    for (const e of incentiveEnts) if (!ans(`inc-${e.id}`)) questions.push({ id: `inc-${e.id}`, question: `Is ${e.name} actually benefiting from the disclosed ${schemeById(e.incentives[0].schemeId)?.name ?? "incentive"} in ${r.period}?`, why: `Drives the ${name} High flag. The disclosure shows the scheme was granted; it does not show the income covered this period.`, options: [{ value: "yes", label: "Yes, for most of its income" }, { value: "partial", label: "Yes, for part of its income" }, { value: "expired", label: "Expired or capped before this period" }, { value: "none", label: "Not claimed" }], resolves: [iso], impact: "high", entityId: e.id, iso });
    if (!jdata && !dataAnswer && priority !== "Low") questions.push({ id: `data-${iso}`, question: `Is jurisdictional financial data (GloBE income, covered taxes) available for ${name} for ${r.period}?`, why: "Without it the exposure cannot move from a flag to a supported conclusion.", options: [{ value: "available", label: "Yes — can upload" }, { value: "cbcr", label: "CbCR rows only" }, { value: "no", label: "Not yet" }], resolves: [iso], impact: priority === "High" ? "high" : "medium", iso });
    if (!shAnswer && priority === "High" && active(rec.qdmtt) === false && y <= 2026) questions.push({ id: `sh-${iso}`, question: `Does the group expect the transitional CbCR safe harbour to apply to ${name} for ${r.period}?`, why: "A passed safe-harbour test sets the top-up to nil for the period.", options: [{ value: "yes", label: "Yes, expected to pass" }, { value: "no", label: "No" }, { value: "unknown", label: "Not tested" }], resolves: [iso], impact: "medium", iso });
    for (const e of ces.filter((x) => !x.taxResidenceIso && (lowStatutory || /holding|financ|treasury|ip/i.test(x.activity)))) if (!ans(`res-${e.id}`)) questions.push({ id: `res-${e.id}`, question: `Is ${e.name} tax resident in ${name}, where it is incorporated?`, why: "Residence, not incorporation, decides the jurisdiction whose ETR it enters; holding and financing vehicles are often managed elsewhere.", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No — resident elsewhere" }, { value: "unknown", label: "Unknown" }], resolves: [iso], impact: "medium", entityId: e.id, iso });
  }

  // Scope question and unresolved links.
  if (r.scope?.verdict === "insufficient" && !ans("scope")) questions.unshift({ id: "scope", question: "Was consolidated revenue at least €750m in two of the four fiscal years preceding the tested year?", why: "The disclosed revenue history does not cover four years. This decides whether Pillar Two applies at all.", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unknown", label: "Need to check" }], resolves: [], impact: "high" });
  for (const u of r.unresolvedLinks) {
    if (ans(`rel-${u.entityId}`)) continue;
    const e = ents.find((x) => x.id === u.entityId);
    if (!e) continue;
    questions.push({ id: `rel-${e.id}`, question: `What is the group's relationship with ${e.name} (${e.incorporationName})?`, why: u.reason, options: [{ value: "subsidiary", label: "Subsidiary (consolidated)" }, { value: "joint-venture", label: "Joint venture" }, { value: "associate", label: "Associate / investment" }, { value: "none", label: "Not a group entity" }], resolves: [e.incorporationIso], impact: "medium", entityId: e.id });
    addWatch(e.id, "Unresolved ownership link", "contributing");
  }
  for (const e of ents.filter((x) => /ip|licens/i.test(x.activity))) addWatch(e.id, "IP holding / licensing activity", "contributing");

  // Missing-information checklist.
  for (const f of flags) if (!f.unsupportedJurisdiction) for (const m of f.missing) missing.push({ id: `m-${f.iso}-${missing.length}`, item: m, why: `${f.name} · ${f.priority} priority · ${f.evidence} evidence`, kind: /certificate|CbCR|figures|data/i.test(m) ? "document" : "fact", iso: f.iso });
  if (r.scope && r.scope.yearsTested < 4) missing.push({ id: "m-rev", item: "Consolidated revenue for the four fiscal years preceding the tested year", why: "Scope test (Art. 1.1).", kind: "fact" });
  for (const d of r.sources.filter((s) => !s.accessible)) missing.push({ id: `m-doc-${d.id}`, item: d.title, why: d.inaccessibleReason ?? "Inaccessible source.", kind: "document" });
  if (!r.disclosures.some((d) => d.topic === "pillar-two-statement")) missing.push({ id: "m-p2", item: "Management's Pillar Two statement (notes to the financial statements)", why: "Not found in the sources read.", kind: "document" });

  const order: Record<Priority, number> = { High: 0, Medium: 1, Undetermined: 2, Low: 3 };
  flags.sort((a, b) => order[a.priority] - order[b.priority] || a.name.localeCompare(b.name));
  const impactOrder = { high: 0, medium: 1, low: 2 };
  questions.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);
  const stages = r.stages.map((s) => (s.id === "exposure" ? { ...s, status: "done" as const, note: `${flags.filter((f) => f.priority === "High").length} High · ${flags.filter((f) => f.priority === "Medium").length} Medium · ${flags.filter((f) => f.priority === "Undetermined").length} Undetermined · ${flags.filter((f) => f.priority === "Low").length} Low` } : s.id === "questions" ? { ...s, status: "done" as const, note: `${questions.length} question${questions.length === 1 ? "" : "s"} ranked by consequence` } : s));
  return { ...r, stages, exposure: flags, missing, questions, watchlist: [...watch.entries()].map(([entityId, w]) => ({ entityId, reasons: w.reasons, role: w.role })) };
}

/** Re-run exposure after an answer or correction. Jurisdiction data is re-read from the corpus for the same period. */
export function reassess(r: ScanResult): ScanResult {
  const cp = r.resolved ? corpusFor(r.resolved.registryId)?.periods.find((p) => p.period === r.period) : undefined;
  return assess(r, { jurisdictionData: [...(cp?.jurisdictionData ?? []), ...(r.extraJurisdictionData ?? [])], disclosedAmounts: cp?.disclosedAmounts ?? [] });
}

export type ScanDiff = {
  from: string; to: string;
  newEntities: ScanEntity[]; removedEntities: ScanEntity[];
  ownershipChanges: { entity: ScanEntity; from: number | null; to: number | null }[];
  newIncentives: { entity: ScanEntity; scheme: string }[];
  newDisclosures: Disclosure[];
  scopeChange: string | null;
  priorityChanges: { iso: string; name: string; from: Priority | "—"; to: Priority | "—" }[];
};

export function compareScans(a: ScanResult, b: ScanResult): ScanDiff {
  const [older, newer] = a.period <= b.period ? [a, b] : [b, a];
  const key = (e: ScanEntity) => norm(e.name);
  const oldMap = new Map(older.entities.map((e) => [key(e), e]));
  const newMap = new Map(newer.entities.map((e) => [key(e), e]));
  const newEntities = newer.entities.filter((e) => !oldMap.has(key(e)));
  const removedEntities = older.entities.filter((e) => !newMap.has(key(e)));
  const ownershipChanges = newer.entities.filter((e) => oldMap.has(key(e)) && oldMap.get(key(e))!.ownership !== e.ownership).map((e) => ({ entity: e, from: oldMap.get(key(e))!.ownership, to: e.ownership }));
  const newIncentives = newer.entities.flatMap((e) => e.incentives.filter((i) => !(oldMap.get(key(e))?.incentives ?? []).some((o) => o.schemeId === i.schemeId)).map((i) => ({ entity: e, scheme: schemeById(i.schemeId)?.name ?? i.schemeId })));
  const newDisclosures = newer.disclosures.filter((d) => !older.disclosures.some((o) => o.topic === d.topic && o.isos.join() === d.isos.join()));
  const scopeChange = older.scope?.verdict !== newer.scope?.verdict ? `${older.scope?.verdict ?? "—"} → ${newer.scope?.verdict ?? "—"}` : null;
  const isos = [...new Set([...older.exposure, ...newer.exposure].map((f) => f.iso))];
  const priorityChanges = isos.map((iso) => ({ iso, name: (newer.exposure.find((f) => f.iso === iso) ?? older.exposure.find((f) => f.iso === iso))!.name, from: older.exposure.find((f) => f.iso === iso)?.priority ?? ("—" as const), to: newer.exposure.find((f) => f.iso === iso)?.priority ?? ("—" as const) })).filter((x) => x.from !== x.to);
  return { from: older.period, to: newer.period, newEntities, removedEntities, ownershipChanges, newIncentives, newDisclosures, scopeChange, priorityChanges };
}

/** Explain one flag: chain from passage → indicator → rating. */
export function explainFlag(f: ExposureFlag, r: ScanResult): { steps: string[]; passages: Passage[] } {
  const steps: string[] = [];
  steps.push(`1. Structure: ${f.coverage.entities} disclosed entit${f.coverage.entities === 1 ? "y" : "ies"} in ${f.name} for ${r.period} (${r.entities.filter((e) => (e.taxResidenceIso ?? e.incorporationIso) === f.iso).map((e) => e.name).join(", ")}).`);
  steps.push(`2. Screening (${f.dbVersion}): statutory ${Number.isNaN(f.screening.statutoryRate) ? "n/a" : `${(f.screening.statutoryRate * 100).toFixed(1)}%`}; ${f.screening.schemesAvailable} incentive scheme${f.screening.schemesAvailable === 1 ? "" : "s"} on record; IIR ${f.screening.iir.status}${f.screening.iir.from ? ` from ${f.screening.iir.from}` : ""}, QDMTT ${f.screening.qdmtt.status}${f.screening.qdmtt.from ? ` from ${f.screening.qdmtt.from}` : ""}; Central Record listing "${f.screening.centralRecord.listed}" as of ${f.screening.centralRecord.asOf}.`);
  f.reasons.forEach((x, i) => steps.push(`${i + 3}. ${x}`));
  steps.push(`${f.reasons.length + 3}. Rating: review priority ${f.priority} because ${f.priority === "High" ? "a disclosed indicator points to income taxed below 15% in the period" : f.priority === "Medium" ? "an indicator is available but not tied to these entities by disclosure" : f.priority === "Low" ? "positive evidence supports taxation at or above 15%" : "the sources do not contain enough to rate it"}; evidence ${f.evidence} because ${f.evidence === "Strong" ? "the company disclosed jurisdiction-level tax data or an amount" : f.evidence === "Moderate" ? "an incentive or management statement names this jurisdiction but no jurisdictional financials were found" : "only the entity list and incorporation were found"}.`);
  steps.push(`${f.reasons.length + 4}. Collection: ${f.collection.mechanism}. ${f.collection.payerNote}`);
  return { steps, passages: f.passages };
}

export function entityName(r: ScanResult, id: string | null) { return id ? r.entities.find((e) => e.id === id)?.name ?? id : "—"; }

export function scanMarkdown(r: ScanResult): string {
  const L: string[] = [];
  L.push(`# GMT24 Quick Scan — ${r.resolved?.name ?? r.query}`);
  L.push(`Reporting period ${r.period} · jurisdiction DB ${r.dbVersion} · corpus ${r.corpusVersion} · run ${r.startedAt.slice(0, 16).replace("T", " ")}`);
  L.push("", "**Preliminary exposure assessment from public evidence. Not a calculation. Every finding carries its basis and source.**", "");
  if (r.scope) { L.push(`## Scope: ${r.scope.verdict}`); r.scope.reasons.forEach((x) => L.push(`- ${x}`)); L.push(`- Threshold: ${r.scope.threshold}`); L.push(`- FX: ${r.scope.fxAssumption}`); L.push(""); }
  L.push("## Group structure"); L.push("| Entity | Jurisdiction | Relationship | Ownership | Activity | Basis | Source |"); L.push("|---|---|---|---|---|---|---|");
  for (const e of applyCorrections(r.entities, r.corrections)) L.push(`| ${e.name}${e.outdated ? " (outdated)" : ""} | ${e.incorporationName} | ${e.relationship} | ${e.ownership ?? "—"} | ${e.activity} | ${e.basis} | ${e.evidence[0] ? `${e.evidence[0].docId} p.${e.evidence[0].page}` : "—"} |`);
  L.push("", "## Jurisdiction exposure map");
  for (const f of r.exposure) {
    L.push(`### ${f.name} — ${f.priority} review priority | ${f.evidence} evidence`);
    L.push(`Coverage: ${f.coverage.entities} entities, jurisdictional financials ${f.coverage.jurisdictionFinancials ? "found" : "not found"}, period ${f.coverage.periods.join(", ")}.`);
    f.reasons.forEach((x) => L.push(`- ${x}`));
    L.push(`- Potentially relevant entities: ${f.contributing.map((id) => entityName(r, id)).join(", ") || "—"}`);
    L.push(`- Collection: ${f.collection.mechanism}; payer ${entityName(r, f.collection.payerEntityId)}. Unconfirmed: ${f.collection.unconfirmed.join("; ")}`);
    if (f.disclosedAmount) L.push(`- Company-disclosed amount: ${f.disclosedAmount.label} — ${f.disclosedAmount.amount} (${f.disclosedAmount.passage.docId} p.${f.disclosedAmount.passage.page})`);
    if (f.estimate) L.push(`- ${f.estimate.label}: ≈ USD ${f.estimate.amountUsd.toLocaleString()} — assumptions: ${f.estimate.assumptions.join(" ")}`);
    L.push(`- Next step: ${f.whatWouldChange.resolve.join("; ")}`);
    L.push("");
  }
  L.push("## Company's own disclosures"); for (const d of r.disclosures) L.push(`- [${d.topic}] ${d.passage.docId} p.${d.passage.page}${d.passage.section ? ` (${d.passage.section})` : ""}: "${d.passage.text}"`);
  L.push("", "## Missing information"); for (const m of r.missing) L.push(`- [${m.kind}] ${m.item} — ${m.why}`);
  L.push("", "## Follow-up questions"); for (const q of r.questions) L.push(`- (${q.impact}) ${q.question} — ${q.why}${r.answers[q.id] ? ` → answered: ${r.answers[q.id].value} by ${r.answers[q.id].by}` : ""}`);
  L.push("", "## Sources"); for (const s of r.sources) L.push(`- ${s.title} (${s.kind}, ${s.period}) — ${s.accessible ? `retrieved ${s.retrievedAt.slice(0, 10)}` : `inaccessible: ${s.inaccessibleReason}`}${s.url ? ` — ${s.url}` : ""}`);
  L.push("", "## Notes"); r.notes.forEach((n) => L.push(`- ${n}`));
  return L.join("\n");
}

export function registryList() { return REGISTRY; }
export function corpusList() { return CORPUS; }

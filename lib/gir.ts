import type { JurCalc } from "./engine";
import { totals } from "./engine";
import { DATA, type Entity, type Group } from "./model";
import { isSeededGroup } from "./seeds";
import { effectivePack, type PackOverlay } from "./packAmendments";
import { utprAllocation } from "./utpr";
import { entityPopulation, type PopulationRecord } from "./population";
import {
  annexBNotifications,
  applicableRules,
  ceByCe,
  dissemination,
  girEditionFor,
  penaltyRelief,
  reportableDifferences,
  safeHarbourCoding,
  sbsElection,
  simplifiedEtrBlock,
  stishBlock,
  summaryRow,
  tinType,
  GIR_XML_NAMESPACE,
  type CeByCe,
  type Dissemination,
  type GirEdition,
  type Notification,
  type PenaltyRelief,
  type ReportableDifferences,
  type SbsElection,
  type ShCoding,
  type SimplifiedEtrBlock,
  type StishBlock,
  type SummaryRow,
} from "./gir2026";

export type GirValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checks: { label: string; pass: boolean; detail: string }[];
};

/** Everything GMT24 derives for one jurisdictional section of the September 2026 return. */
export type GirJurisdiction = {
  calc: JurCalc;
  coding: ShCoding;
  setr: SimplifiedEtrBlock;
  stish: StishBlock;
  reportable: ReportableDifferences;
  ceByCe: CeByCe;
  summary: SummaryRow;
  /** Section 2/3 emitted (false where the Side-by-Side election suppresses it). */
  emitted: boolean;
};

export type GirPackage = {
  xml: string;
  validation: GirValidation;
  fieldCount: number;
  provisionalCount: number;
  jurisdictionCount: number;
  entityCount: number;
  messageRefId: string;
  schema: string;
  edition: GirEdition;
  sbs: SbsElection;
  jurisdictions: GirJurisdiction[];
  summaryRows: SummaryRow[];
  dissemination: Dissemination[];
  notifications: Notification[];
  penaltyRelief: PenaltyRelief;
};

/** Namespace for September 2026 data points the v1.0 exchange schema has no element for yet. */
export const GIR26_NS = "urn:gmt24:gir:2026-09:provisional";

const esc = (value: string | number | boolean) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const amount = (value: number) => Math.round(value);
const percent = (value: number) => Math.max(0, Math.min(1, value)).toFixed(4);
const country = (iso: string) => iso === "XX" ? "X5" : iso;

function wellFormed(xml: string) {
  const stack: string[] = [];
  for (const match of xml.matchAll(/<(\/?)([A-Za-z][\w:.-]*)(?:\s[^>]*)?>/g)) {
    const [, closing, name] = match;
    if (match[0].endsWith("/>")) continue;
    if (!closing) stack.push(name);
    else if (stack.pop() !== name) return false;
  }
  return stack.length === 0;
}

function statusCode(entity: Entity) {
  if (entity.equityMethod) return "GIR313";
  if (entity.type === "PE") return "GIR305";
  if (entity.type === "Investment") return "GIR310";
  if (entity.type === "MOCE") return "GIR309";
  if (entity.type === "Tax-transparent") return "GIR302";
  if (entity.type === "Excluded") return "GIR316";
  return "GIR301";
}

function rulesXml(iso: string, indent: string, overlay?: PackOverlay) {
  return applicableRules(iso, overlay)
    .map((rule) => rule.provisional
      ? `${indent}  <gir26:Rules option="${rule.code === "GIR206" ? "v" : "vi"}">${rule.code}</gir26:Rules>`
      : `${indent}  <globe:Rules>${rule.code}</globe:Rules>`)
    .join("\n");
}

function idXml(entity: Entity, group: Group, indent = "        ", overlay?: PackOverlay, sbsApplies = false) {
  const tin = tinType(entity, group);
  return `${indent}<globe:ID>
${indent}  <globe:Name>${esc(entity.name)}</globe:Name>
${indent}  <globe:ResCountryCode>${country(entity.iso)}</globe:ResCountryCode>
${indent}  <globe:TIN issuedBy="${country(entity.iso)}" TypeOfTIN="${tin.code}">${esc(tin.value)}</globe:TIN>
${rulesXml(entity.iso, indent, overlay)}
${indent}  <globe:GloBEStatus>${statusCode(entity)}</globe:GloBEStatus>${sbsApplies ? `
${indent}  <gir26:Suppressed>1.3.1.7-1.3.1.9</gir26:Suppressed>` : ""}
${indent}</globe:ID>`;
}

function nonMaterialIdXml(entity: PopulationRecord, indent = "        ", overlay?: PackOverlay) {
  return `${indent}<globe:ID>
${indent}  <globe:Name>${esc(entity.name)}</globe:Name>
${indent}  <globe:ResCountryCode>${country(entity.iso)}</globe:ResCountryCode>
${indent}  <globe:TIN issuedBy="${country(entity.iso)}" TypeOfTIN="GIR3002">${esc(entity.code)}</globe:TIN>
${rulesXml(entity.iso, indent, overlay)}
${indent}  <globe:GloBEStatus>GIR315</globe:GloBEStatus>
${indent}</globe:ID>`;
}

function setrXml(block: SimplifiedEtrBlock) {
  return `      <gir26:SimplifiedETR ref="2.2.1.2(b)">
${block.points.map((p) => `        <gir26:Point key="${p.key}"${p.gap ? ' gap="true"' : ""}>${p.value === null ? "" : p.key === "N" ? percent(p.value) : amount(p.value)}</gir26:Point>`).join("\n")}
${block.crossFill.map((c) => `        <gir26:CrossFill from="${c.from}" to="${c.to}"/>`).join("\n")}
      </gir26:SimplifiedETR>`;
}

function stishXml(block: StishBlock) {
  return `      <gir26:STISH ref="2.2.1.2(c)">
        <gir26:PayrollCap currency="USD" rate="0.055">${amount(block.payrollCap)}</gir26:PayrollCap>
        <gir26:DepreciationCap currency="USD" rate="0.055" gap="true"/>
        <gir26:CarryingValueCap currency="USD" rate="0.01" elected="${block.carryingValueElected}">${amount(block.carryingValueCap)}</gir26:CarryingValueCap>
        <gir26:QRTC_MTTC currency="USD">${amount(block.qrtcMttc)}</gir26:QRTC_MTTC>
        <gir26:OtherQTI currency="USD">${amount(block.otherQti)}</gir26:OtherQTI>
        <gir26:TotalQTI currency="USD" withinCap="${block.withinCap}">${amount(block.totalQti)}</gir26:TotalQTI>
${block.rows.map((r) => `        <gir26:Incentive ref="2.2.1.2(d)" id="${esc(r.incentiveId)}" entity="${esc(r.entityId)}" eligible="${r.sbtishEligible}"><gir26:Name>${esc(r.name)}</gir26:Name><gir26:QualifyingExpenditure currency="USD">${amount(r.qualifyingExpenditure)}</gir26:QualifyingExpenditure><gir26:QTI currency="USD">${amount(r.qtiProxy)}</gir26:QTI></gir26:Incentive>`).join("\n")}
      </gir26:STISH>`;
}

function jurisdictionXml(j: GirJurisdiction) {
  const { calc, coding, reportable } = j;
  const safe = calc.exposure === "Safe harbour";
  const optionD = coding.reported.includes("d");
  const optionF = coding.reported.includes("f");
  return `    <globe:JurisdictionSection>
      <globe:RecJurCode>${country(calc.iso)}</globe:RecJurCode>
      <globe:Jurisdiction>
        <globe:JurisdictionCode>${country(calc.iso)}</globe:JurisdictionCode>
        <globe:JurisdictionName>${esc(calc.name)}</globe:JurisdictionName>
      </globe:Jurisdiction>
      <globe:Subgroup>${esc(calc.blendKind)}</globe:Subgroup>
      <globe:SafeHarbour>
        <globe:Applied>${safe}</globe:Applied>
        <globe:Outcome>${esc(calc.sh.outcome)}</globe:Outcome>
${coding.reported.length ? coding.reported.map((code) => `        <gir26:Option ref="2.2.1.1.1"${code === coding.primary ? ' primary="true"' : ""}>${code}</gir26:Option>`).join("\n") : `        <gir26:Option ref="2.2.1.1.1">none</gir26:Option>`}
      </globe:SafeHarbour>
      <gir26:ReportableDifferences ref="2.1.5">${reportable.answer}</gir26:ReportableDifferences>
${optionD ? setrXml(j.setr) + "\n" : ""}${optionF ? stishXml(j.stish) + "\n" : ""}      <globe:GLoBETax>
        <globe:NetGloBEIncome currency="USD">${amount(calc.globeIncome)}</globe:NetGloBEIncome>
        <globe:AdjustedCoveredTaxes currency="USD">${amount(calc.coveredTax)}</globe:AdjustedCoveredTaxes>
        <globe:ETR>${percent(calc.etr)}</globe:ETR>
        <globe:SBIE currency="USD">${amount(calc.sbie)}</globe:SBIE>
        <globe:ExcessProfit currency="USD">${amount(calc.excess)}</globe:ExcessProfit>
        <globe:TopUpTaxPercentage>${percent(calc.topUpRate)}</globe:TopUpTaxPercentage>
        <globe:AdditionalCurrentTopUpTax currency="USD">${amount(calc.additionalCurrentTopUp)}</globe:AdditionalCurrentTopUpTax>
        <globe:JurisdictionalTopUpTax currency="USD">${amount(calc.jurisdictionalTopUp)}</globe:JurisdictionalTopUpTax>
        <globe:QDMTT currency="USD">${amount(calc.collection.qdmtt)}</globe:QDMTT>
        <globe:IIR currency="USD">${amount(calc.collection.iir)}</globe:IIR>
        <globe:UTPR currency="USD">${amount(calc.collection.utpr)}</globe:UTPR>
      </globe:GLoBETax>
${j.ceByCe.required ? `      <gir26:CEDetail ref="3" reason="${esc(j.ceByCe.reason)}">
${j.ceByCe.rows.map((r) => `        <gir26:CE code="${esc(r.code)}"><gir26:Name>${esc(r.name)}</gir26:Name><gir26:FANIL currency="USD">${amount(r.fanil)}</gir26:FANIL><gir26:Adjustments currency="USD" count="${r.adjustmentCount}">${amount(r.adjustments)}</gir26:Adjustments><gir26:CurrentTax currency="USD">${amount(r.currentTax)}</gir26:CurrentTax><gir26:DeferredTax currency="USD">${amount(r.deferredTax)}</gir26:DeferredTax><gir26:Payroll currency="USD">${amount(r.payroll)}</gir26:Payroll><gir26:TangibleAssets currency="USD">${amount(r.tangible)}</gir26:TangibleAssets></gir26:CE>`).join("\n")}
      </gir26:CEDetail>
` : ""}    </globe:JurisdictionSection>`;
}

function summaryRowXml(row: SummaryRow) {
  return `      <gir26:Row ref="1.4" jurisdiction="${country(row.iso)}">
        <gir26:Rules>${row.rules.map((r) => r.code).join(" ")}</gir26:Rules>
        <gir26:SafeHarbourOption>${row.safeHarbour ?? "none"}</gir26:SafeHarbourOption>
        <gir26:ETRBand>${esc(row.etrBand)}</gir26:ETRBand>
        <gir26:TopUpBand currency="USD">${esc(row.topUpBand)}</gir26:TopUpBand>
        <gir26:SBIEExceedsNGI>${row.sbieExceedsNgi}</gir26:SBIEExceedsNGI>
        <gir26:QTIBand ref="1.4.10">${esc(row.qtiBand)}</gir26:QTIBand>
        <gir26:QDMTTPayable>${row.qdmttPayable}</gir26:QDMTTPayable>
        <gir26:ReportableDifferences>${row.reportableDifferences}</gir26:ReportableDifferences>
      </gir26:Row>`;
}

export function validateGirPackage(opts: {
  xml: string;
  group: Group;
  calcs: JurCalc[];
  entityCount: number;
  edition: GirEdition;
  sbs: SbsElection;
  jurisdictions: GirJurisdiction[];
}): GirValidation {
  const { xml, group, calcs, entityCount, edition, sbs, jurisdictions } = opts;
  const t = totals(calcs);
  const emitted = jurisdictions.filter((j) => j.emitted);
  const codingIssues = jurisdictions.flatMap((j) => j.coding.issues);
  const sbsBlocking = sbs.issues.filter((i) => i.includes("cannot be made") || i.includes("no jurisdiction-level SbS option"));
  const utprIssues = codingIssues.filter((i) => /UTPR Safe Harbour/.test(i));
  const reportableYes = jurisdictions.filter((j) => j.reportable.answer === "Yes");
  const ceRequired = jurisdictions.filter((j) => j.ceByCe.required);
  const provisional = (xml.match(/<gir26:[A-Za-z_][^/>\s]*/g) ?? []).length;
  const checks = [
    { label: "Well-formed XML", pass: wellFormed(xml), detail: "balanced elements and single document root" },
    { label: "OECD namespace", pass: xml.includes(`xmlns:globe="${GIR_XML_NAMESPACE}"`), detail: GIR_XML_NAMESPACE },
    { label: "Schema target", pass: xml.includes(edition.schema.xsd), detail: `${edition.schema.xsd} · ${edition.schema.status === "pending" ? "revised schema pending" : "published"}` },
    { label: "Template edition", pass: xml.includes(`<gir26:Edition>${edition.id}</gir26:Edition>`), detail: `${edition.short} governs FYs commencing ${edition.appliesFrom === "2025-12-31" ? "on/after 31 Dec 2025" : "before 31 Dec 2025"} · FY starts ${group.fyStart}` },
    { label: "Message header", pass: xml.includes("<globe:MessageTypeIndic>GIR101</globe:MessageTypeIndic>"), detail: "new information message" },
    { label: "Reporting period", pass: xml.includes(`<globe:ReportingPeriod>${group.fyEnd}</globe:ReportingPeriod>`), detail: group.fyEnd },
    { label: "Entity population", pass: ((xml.match(/<globe:CE>/g) ?? []).length + 1) === entityCount, detail: `${entityCount} UPE/CE/JV records in snapshot` },
    { label: "Side-by-Side election (1.3.1.6)", pass: sbsBlocking.length === 0, detail: sbs.applies ? `elected · ${sbs.upeRegime} · summary table and non-QDMTT sections suppressed` : sbs.eligible ? "available, not elected — full return" : `not available (${sbs.upeRegime})` },
    { label: "Summary table (1.4)", pass: sbs.applies ? !xml.includes("<globe:Summary>") : (xml.match(/<gir26:Row ref="1.4"/g) ?? []).length === calcs.length, detail: sbs.applies ? "suppressed by the Side-by-Side election" : `${calcs.length} banded rows · ETR 2.5-point bands · QTI band 1.4.10` },
    { label: "Jurisdiction population", pass: (xml.match(/<globe:JurisdictionSection>/g) ?? []).length === emitted.length, detail: sbs.applies ? `${emitted.length} QDMTT jurisdictional sections (Side-by-Side)` : `${emitted.length} jurisdictional blends` },
    { label: "Safe-harbour option coding (2.2.1.1.1)", pass: codingIssues.length === 0, detail: codingIssues.length ? codingIssues[0] : `${jurisdictions.filter((j) => j.coding.primary).length} jurisdictions report an option letter (a)–(k)` },
    { label: "Transitional UTPR SH window", pass: utprIssues.length === 0, detail: utprIssues[0] ?? "UPE-jurisdiction only · FY begins ≤ 31 Dec 2025 · ends ≤ 3 Jan 2027 · ≤ 12 months" },
    { label: "Reportable differences → Sections 2 & 3", pass: reportableYes.every((j) => j.emitted), detail: reportableYes.length ? `${reportableYes.map((j) => j.calc.name).join(", ")} answer Yes — full jurisdictional sections completed` : "no jurisdiction reports a domestic divergence" },
    { label: "CE-by-CE Section 3", pass: ceRequired.every((j) => j.ceByCe.rows.length === j.calc.entities.length), detail: ceRequired.length ? `${ceRequired.map((j) => j.calc.name).join(", ")} allocate Top-up Tax across several CEs — entity rows emitted` : "aggregate reporting under the transitional framework for every jurisdiction" },
    { label: "Top-up reconciliation", pass: xml.includes(`<globe:TotalTopUpTax currency="USD">${amount(t.topUp)}</globe:TotalTopUpTax>`) || sbs.applies, detail: `USD ${amount(t.topUp)}` },
    { label: "Collection reconciliation", pass: amount(t.qdmtt + t.iir + t.utpr) === amount(t.topUp), detail: `QDMTT + IIR + UTPR = USD ${amount(t.qdmtt + t.iir + t.utpr)}` },
  ];
  const errors = checks.filter((c) => !c.pass).map((c) => `${c.label}: ${c.detail}`);
  const warnings = [
    "GMT24 preflight is not a substitute for validation against the three official XSD files (GLOBEXML, OECD types and ISO types).",
    "Domestic filing portals may impose local extensions beyond the OECD exchange schema.",
    edition.schema.status === "pending"
      ? `${provisional} September 2026 data points (Side-by-Side election, rule options (v)/(vi), safe-harbour letters, Simplified ETR, STISH, banded summary, reportable differences, CE detail) are carried in the gir26 provisional namespace until the OECD publishes the revised schema and its cut-off date; the globe v1.0 elements are unchanged.`
      : `${provisional} provisional elements.`,
    ...sbs.issues.filter((i) => !sbsBlocking.includes(i)),
    ...jurisdictions.filter((j) => j.coding.reported.includes("d")).map((j) => `${j.calc.name}: Simplified ETR data points [H], [M], [N] cross-fill 3.2.1.1 / 3.2.1.2 / 3.2.2.1 — do not key Section 3 separately.`),
    ...jurisdictions.filter((j) => j.coding.reported.includes("f")).map((j) => `${j.calc.name}: STISH depreciation base is not on the dataset; the payroll cap is used until the fixed-asset register is loaded.`),
    `${(xml.match(/<globe:GloBEStatus>GIR315<\/globe:GloBEStatus>/g) ?? []).length} Non-Material Constituent Entity records use identity-level simplified reporting and do not create invented jurisdictional calculations.`,
  ];
  return { valid: errors.length === 0, errors, warnings, checks };
}

export function buildGirPackage(opts: {
  group: Group;
  calcs: JurCalc[];
  electionsOn?: Record<string, boolean>;
  activeFy?: string;
  packOverlay?: PackOverlay;
  /** Evidence events sealed for the year — feeds the Annex C penalty-relief test. */
  evidenceCount?: number;
}): GirPackage {
  const { group, calcs, electionsOn = {}, activeFy = group.fy, packOverlay, evidenceCount = 0 } = opts;
  const t = totals(calcs);
  const edition = girEditionFor(group.fyStart);
  const sbs = sbsElection(group, electionsOn, calcs, packOverlay);
  const entities = isSeededGroup(group.id) ? DATA.entities : DATA.entities.slice(0, Math.min(DATA.entities.length, group.entities));
  const population = isSeededGroup(group.id) ? entityPopulation() : entities.map((entity) => ({
    id: entity.id,
    code: entity.code,
    name: entity.name,
    iso: entity.iso,
    jurisdiction: entity.jurisdiction,
    detail: "calculation" as const,
    source: "Entity register",
  }));
  const nonMaterial = population.filter((entity) => entity.detail === "non-material");
  const upe = entities.find((e) => e.type === "UPE") ?? DATA.entities[0];
  const year = group.fyEnd.slice(0, 4);
  const messageRefId = `${country(group.upeIso)}${year}${country(group.upeIso)}GMT24${activeFy.replace(/\D/g, "")}`;
  const elections = Object.entries(electionsOn).filter(([, on]) => on).map(([key]) => key);
  const utprRows = utprAllocation(t.utpr).filter((r) => r.amount > 0);
  const timestamp = `${group.fyEnd}T09:45:30`;

  const jurisdictions: GirJurisdiction[] = calcs.map((calc) => {
    const coding = safeHarbourCoding(calc, group, electionsOn, packOverlay);
    const setr = simplifiedEtrBlock(calc);
    const stish = stishBlock(calc, electionsOn);
    const reportable = reportableDifferences(calc, group, packOverlay);
    const ce = ceByCe(calc, group);
    return { calc, coding, setr, stish, reportable, ceByCe: ce, summary: summaryRow(calc, coding, stish, reportable, packOverlay), emitted: sbs.jurisdictionSectionsFor.includes(calc.iso) };
  });
  const summaryRows = jurisdictions.map((j) => j.summary);
  const diss = dissemination(group, calcs, packOverlay);
  const notifications = annexBNotifications(group, entities, calcs, packOverlay, true);
  const relief = penaltyRelief(group, calcs, true, evidenceCount);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<globe:GLOBE_OECD
  xmlns:globe="${GIR_XML_NAMESPACE}"
  xmlns:gir26="${GIR26_NS}"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${GIR_XML_NAMESPACE} ${edition.schema.xsd}"
  version="${edition.schema.version.split(" ")[0]}">
  <globe:MessageSpec>
    <globe:SendingEntityIN>${esc(upe.code)}</globe:SendingEntityIN>
    <globe:TransmittingCountry>${country(group.upeIso)}</globe:TransmittingCountry>
    <globe:ReceivingCountry>${country(group.upeIso)}</globe:ReceivingCountry>
    <globe:MessageType>GIR</globe:MessageType>
    <globe:MessageRefID>${messageRefId}</globe:MessageRefID>
    <globe:MessageTypeIndic>GIR101</globe:MessageTypeIndic>
    <globe:ReportingPeriod>${group.fyEnd}</globe:ReportingPeriod>
    <globe:Timestamp>${timestamp}</globe:Timestamp>
    <gir26:Edition>${edition.id}</gir26:Edition>
    <gir26:EditionRule>FY commencing ${group.fyStart} · ${edition.short} (§36.1)</gir26:EditionRule>
  </globe:MessageSpec>
  <globe:GLOBEBody>
    <globe:FilingInfo>
      <globe:FilingCE>
        <globe:ResCountryCode>${country(upe.iso)}</globe:ResCountryCode>
        <globe:Name>${esc(upe.name)}</globe:Name>
        <globe:TIN issuedBy="${country(upe.iso)}" TypeOfTIN="${tinType(upe, group).code}">${esc(tinType(upe, group).value)}</globe:TIN>
        <globe:Role>GIR401</globe:Role>
      </globe:FilingCE>
      <globe:AccountingInfo>
        <globe:CFSofUPE>GIR501</globe:CFSofUPE>
        <globe:FAS>${esc(upe.gaap)}</globe:FAS>
        <globe:Currency>USD</globe:Currency>
      </globe:AccountingInfo>
      <globe:Period>
        <globe:Start>${group.fyStart}</globe:Start>
        <globe:End>${group.fyEnd}</globe:End>
      </globe:Period>
      <globe:NameMNE>${esc(group.name)}</globe:NameMNE>
    </globe:FilingInfo>
    <globe:GeneralSection>
      <globe:RecJurCode>${country(group.upeIso)}</globe:RecJurCode>
      <gir26:SideBySideElection ref="1.3.1.6" eligible="${sbs.eligible}" elected="${sbs.elected}" applies="${sbs.applies}">
        <gir26:UPEJurisdiction>${country(sbs.upeIso)}</gir26:UPEJurisdiction>
        <gir26:UPERegime>${esc(sbs.upeRegime)}</gir26:UPERegime>
${sbs.suppressed.map((s) => `        <gir26:Suppressed>${esc(s)}</gir26:Suppressed>`).join("\n")}
      </gir26:SideBySideElection>
      <globe:CorporateStructure>
        <globe:UPE>
          <globe:OtherUPE>
${idXml(upe, group, "            ", packOverlay, sbs.applies)}
          </globe:OtherUPE>
        </globe:UPE>
${entities.filter((entity) => entity.id !== upe.id).map((entity) => `        <globe:CE>
${idXml(entity, group, "          ", packOverlay, sbs.applies)}
        </globe:CE>`).join("\n")}
${nonMaterial.map((entity) => `        <globe:CE>
${nonMaterialIdXml(entity, "          ", packOverlay)}
        </globe:CE>`).join("\n")}
      </globe:CorporateStructure>
    </globe:GeneralSection>
${sbs.applies ? `    <gir26:SummarySuppressed ref="1.4">Side-by-Side Safe Harbour election applies</gir26:SummarySuppressed>` : `    <globe:Summary>
      <globe:TotalGloBEIncome currency="USD">${amount(calcs.reduce((sum, c) => sum + c.globeIncome, 0))}</globe:TotalGloBEIncome>
      <globe:TotalAdjustedCoveredTaxes currency="USD">${amount(calcs.reduce((sum, c) => sum + c.coveredTax, 0))}</globe:TotalAdjustedCoveredTaxes>
      <globe:TotalTopUpTax currency="USD">${amount(t.topUp)}</globe:TotalTopUpTax>
      <globe:TotalQDMTT currency="USD">${amount(t.qdmtt)}</globe:TotalQDMTT>
      <globe:TotalIIR currency="USD">${amount(t.iir)}</globe:TotalIIR>
      <globe:TotalUTPR currency="USD">${amount(t.utpr)}</globe:TotalUTPR>
${summaryRows.map(summaryRowXml).join("\n")}
    </globe:Summary>`}
${jurisdictions.filter((j) => j.emitted).map(jurisdictionXml).join("\n")}
    <globe:Elections>
${elections.length ? elections.map((key) => `      <globe:Election><globe:ElectionID>${esc(key)}</globe:ElectionID><globe:Elected>true</globe:Elected></globe:Election>`).join("\n") : "      <globe:NoElection>true</globe:NoElection>"}
    </globe:Elections>
${utprRows.map((row) => `    <globe:UTPRAttribution>
      <globe:JurisdictionCode>${country(row.iso)}</globe:JurisdictionCode>
      <globe:Employees>${row.employees}</globe:Employees>
      <globe:TangibleAssets currency="USD">${amount(row.assets)}</globe:TangibleAssets>
      <globe:UTPRPercentage>${percent(row.percentage)}</globe:UTPRPercentage>
      <globe:AllocatedTopUpTax currency="USD">${amount(row.amount)}</globe:AllocatedTopUpTax>
    </globe:UTPRAttribution>`).join("\n")}
    <gir26:Dissemination>
${diss.map((d) => `      <gir26:Jurisdiction code="${country(d.iso)}" category="${d.category}">${d.receives.map((r) => `<gir26:Receives>${esc(r)}</gir26:Receives>`).join("")}</gir26:Jurisdiction>`).join("\n")}
    </gir26:Dissemination>
  </globe:GLOBEBody>
</globe:GLOBE_OECD>`;

  const fieldCount = (xml.match(/<globe:[A-Za-z][^/>]*>/g) ?? []).length;
  const provisionalCount = (xml.match(/<gir26:[A-Za-z_][^/>\s]*/g) ?? []).length;
  const validation = validateGirPackage({ xml, group, calcs, entityCount: population.length, edition, sbs, jurisdictions });
  return {
    xml,
    validation,
    fieldCount,
    provisionalCount,
    jurisdictionCount: jurisdictions.filter((j) => j.emitted).length,
    entityCount: population.length,
    messageRefId,
    schema: `${edition.short} template · OECD GIR XML Schema ${edition.schema.version} (${GIR_XML_NAMESPACE}) · September 2026 data points in gir26 provisional namespace · GMT24 population/reconciliation preflight`,
    edition,
    sbs,
    jurisdictions,
    summaryRows,
    dissemination: diss,
    notifications,
    penaltyRelief: relief,
  };
}

export function downloadGir(pkg: GirPackage, filename: string) {
  downloadText(pkg.xml, filename, "application/xml;charset=utf-8");
}

export function downloadText(text: string, filename: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

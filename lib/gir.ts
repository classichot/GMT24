import type { JurCalc } from "./engine";
import { totals } from "./engine";
import { ENTITIES, JURISDICTION_PACKS, type Entity, type Group } from "./model";
import { utprAllocation } from "./utpr";
import { entityPopulation, type PopulationRecord } from "./population";

export type GirValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checks: { label: string; pass: boolean; detail: string }[];
};

export type GirPackage = {
  xml: string;
  validation: GirValidation;
  fieldCount: number;
  jurisdictionCount: number;
  entityCount: number;
  messageRefId: string;
  schema: string;
};

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

function idXml(entity: Entity, indent = "        ") {
  const pack = JURISDICTION_PACKS.find((p) => p.iso === entity.iso);
  const rules = [
    ...(pack?.iir ? ["GIR201"] : []),
    ...(pack?.utpr ? ["GIR203"] : []),
    ...(pack?.qdmtt ? ["GIR204"] : []),
  ];
  return `${indent}<globe:ID>
${indent}  <globe:Name>${esc(entity.name)}</globe:Name>
${indent}  <globe:ResCountryCode>${country(entity.iso)}</globe:ResCountryCode>
${indent}  <globe:TIN issuedBy="${country(entity.iso)}" TypeOfTIN="GIR3002">${esc(entity.code)}</globe:TIN>
${(rules.length ? rules : ["GIR205"]).map((rule) => `${indent}  <globe:Rules>${rule}</globe:Rules>`).join("\n")}
${indent}  <globe:GloBEStatus>${statusCode(entity)}</globe:GloBEStatus>
${indent}</globe:ID>`;
}

function nonMaterialIdXml(entity: PopulationRecord, indent = "        ") {
  const pack = JURISDICTION_PACKS.find((p) => p.iso === entity.iso);
  const rules = [
    ...(pack?.iir ? ["GIR201"] : []),
    ...(pack?.utpr ? ["GIR203"] : []),
    ...(pack?.qdmtt ? ["GIR204"] : []),
  ];
  return `${indent}<globe:ID>
${indent}  <globe:Name>${esc(entity.name)}</globe:Name>
${indent}  <globe:ResCountryCode>${country(entity.iso)}</globe:ResCountryCode>
${indent}  <globe:TIN issuedBy="${country(entity.iso)}" TypeOfTIN="GIR3002">${esc(entity.code)}</globe:TIN>
${(rules.length ? rules : ["GIR205"]).map((rule) => `${indent}  <globe:Rules>${rule}</globe:Rules>`).join("\n")}
${indent}  <globe:GloBEStatus>GIR315</globe:GloBEStatus>
${indent}</globe:ID>`;
}

function jurisdictionXml(calc: JurCalc) {
  const safe = calc.exposure === "Safe harbour";
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
      </globe:SafeHarbour>
      <globe:GLoBETax>
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
    </globe:JurisdictionSection>`;
}

export function validateGirPackage(opts: {
  xml: string;
  group: Group;
  calcs: JurCalc[];
  entityCount: number;
}): GirValidation {
  const { xml, group, calcs, entityCount } = opts;
  const t = totals(calcs);
  const checks = [
    { label: "Well-formed XML", pass: wellFormed(xml), detail: "balanced elements and single document root" },
    { label: "OECD namespace", pass: xml.includes('xmlns:globe="urn:oecd:ties:globe:v2"'), detail: "urn:oecd:ties:globe:v2" },
    { label: "Schema target", pass: xml.includes("GLOBEXML_v1.0.xsd"), detail: "OECD GIR XML Schema v1.0" },
    { label: "Message header", pass: xml.includes("<globe:MessageTypeIndic>GIR101</globe:MessageTypeIndic>"), detail: "new information message" },
    { label: "Reporting period", pass: xml.includes(`<globe:ReportingPeriod>${group.fyEnd}</globe:ReportingPeriod>`), detail: group.fyEnd },
    { label: "Entity population", pass: ((xml.match(/<globe:CE>/g) ?? []).length + 1) === entityCount, detail: `${entityCount} UPE/CE/JV records in snapshot` },
    { label: "Jurisdiction population", pass: (xml.match(/<globe:JurisdictionSection>/g) ?? []).length === calcs.length, detail: `${calcs.length} jurisdictional blends` },
    { label: "Top-up reconciliation", pass: xml.includes(`<globe:TotalTopUpTax currency="USD">${amount(t.topUp)}</globe:TotalTopUpTax>`), detail: `USD ${amount(t.topUp)}` },
    { label: "Collection reconciliation", pass: amount(t.qdmtt + t.iir + t.utpr) === amount(t.topUp), detail: `QDMTT + IIR + UTPR = USD ${amount(t.qdmtt + t.iir + t.utpr)}` },
  ];
  const errors = checks.filter((c) => !c.pass).map((c) => `${c.label}: ${c.detail}`);
  const warnings = [
    "GMT24 preflight is not a substitute for validation against the three official XSD files (GLOBEXML, OECD types and ISO types).",
    "Domestic filing portals may impose local extensions beyond the OECD exchange schema.",
    "June 2026 first-filing guidance workarounds must be rechecked when the OECD publishes the next schema version.",
    `${(xml.match(/<globe:GloBEStatus>GIR315<\/globe:GloBEStatus>/g) ?? []).length} Non-Material Constituent Entity records use identity-level simplified reporting and do not create invented jurisdictional calculations.`,
  ];
  return { valid: errors.length === 0, errors, warnings, checks };
}

export function buildGirPackage(opts: {
  group: Group;
  calcs: JurCalc[];
  electionsOn?: Record<string, boolean>;
  activeFy?: string;
}): GirPackage {
  const { group, calcs, electionsOn = {}, activeFy = group.fy } = opts;
  const t = totals(calcs);
  const entities = group.id === "aetherion" ? ENTITIES : ENTITIES.slice(0, Math.min(ENTITIES.length, group.entities));
  const population = group.id === "aetherion" ? entityPopulation() : entities.map((entity) => ({
    id: entity.id,
    code: entity.code,
    name: entity.name,
    iso: entity.iso,
    jurisdiction: entity.jurisdiction,
    detail: "calculation" as const,
    source: "Entity register",
  }));
  const nonMaterial = population.filter((entity) => entity.detail === "non-material");
  const upe = entities.find((e) => e.type === "UPE") ?? ENTITIES[0];
  const year = group.fyEnd.slice(0, 4);
  const messageRefId = `${country(group.upeIso)}${year}${country(group.upeIso)}GMT24${activeFy.replace(/\D/g, "")}`;
  const elections = Object.entries(electionsOn).filter(([, on]) => on).map(([key]) => key);
  const utprRows = utprAllocation(t.utpr).filter((r) => r.amount > 0);
  const timestamp = `${group.fyEnd}T09:45:30`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<globe:GLOBE_OECD
  xmlns:globe="urn:oecd:ties:globe:v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="urn:oecd:ties:globe:v2 GLOBEXML_v1.0.xsd"
  version="1.0">
  <globe:MessageSpec>
    <globe:SendingEntityIN>${esc(upe.code)}</globe:SendingEntityIN>
    <globe:TransmittingCountry>${country(group.upeIso)}</globe:TransmittingCountry>
    <globe:ReceivingCountry>${country(group.upeIso)}</globe:ReceivingCountry>
    <globe:MessageType>GIR</globe:MessageType>
    <globe:MessageRefID>${messageRefId}</globe:MessageRefID>
    <globe:MessageTypeIndic>GIR101</globe:MessageTypeIndic>
    <globe:ReportingPeriod>${group.fyEnd}</globe:ReportingPeriod>
    <globe:Timestamp>${timestamp}</globe:Timestamp>
  </globe:MessageSpec>
  <globe:GLOBEBody>
    <globe:FilingInfo>
      <globe:FilingCE>
        <globe:ResCountryCode>${country(upe.iso)}</globe:ResCountryCode>
        <globe:Name>${esc(upe.name)}</globe:Name>
        <globe:TIN issuedBy="${country(upe.iso)}" TypeOfTIN="GIR3002">${esc(upe.code)}</globe:TIN>
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
      <globe:CorporateStructure>
        <globe:UPE>
          <globe:OtherUPE>
${idXml(upe, "            ")}
          </globe:OtherUPE>
        </globe:UPE>
${entities.filter((entity) => entity.id !== upe.id).map((entity) => `        <globe:CE>
${idXml(entity, "          ")}
        </globe:CE>`).join("\n")}
${nonMaterial.map((entity) => `        <globe:CE>
${nonMaterialIdXml(entity, "          ")}
        </globe:CE>`).join("\n")}
      </globe:CorporateStructure>
    </globe:GeneralSection>
    <globe:Summary>
      <globe:TotalGloBEIncome currency="USD">${amount(calcs.reduce((sum, c) => sum + c.globeIncome, 0))}</globe:TotalGloBEIncome>
      <globe:TotalAdjustedCoveredTaxes currency="USD">${amount(calcs.reduce((sum, c) => sum + c.coveredTax, 0))}</globe:TotalAdjustedCoveredTaxes>
      <globe:TotalTopUpTax currency="USD">${amount(t.topUp)}</globe:TotalTopUpTax>
      <globe:TotalQDMTT currency="USD">${amount(t.qdmtt)}</globe:TotalQDMTT>
      <globe:TotalIIR currency="USD">${amount(t.iir)}</globe:TotalIIR>
      <globe:TotalUTPR currency="USD">${amount(t.utpr)}</globe:TotalUTPR>
    </globe:Summary>
${calcs.map(jurisdictionXml).join("\n")}
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
  </globe:GLOBEBody>
</globe:GLOBE_OECD>`;

  const fieldCount = (xml.match(/<globe:[A-Za-z][^/>]*>/g) ?? []).length;
  const validation = validateGirPackage({ xml, group, calcs, entityCount: population.length });
  return {
    xml,
    validation,
    fieldCount,
    jurisdictionCount: calcs.length,
    entityCount: population.length,
    messageRefId,
    schema: "OECD GIR XML Schema v1.0 target · namespace v2 · GMT24 population/reconciliation preflight",
  };
}

export function downloadGir(pkg: GirPackage, filename: string) {
  const blob = new Blob([pkg.xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

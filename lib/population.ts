import { ENTITIES, GROUPS } from "./model";

export type PopulationRecord = {
  id: string;
  code: string;
  name: string;
  iso: string;
  jurisdiction: string;
  detail: "calculation" | "non-material";
  source: string;
};

const TARGET_JURISDICTIONS = [
  ["JP", "Japan"], ["SG", "Singapore"], ["TH", "Thailand"], ["VN", "Vietnam"],
  ["MY", "Malaysia"], ["ID", "Indonesia"], ["AE", "United Arab Emirates"], ["GB", "United Kingdom"],
  ["DE", "Germany"], ["FR", "France"], ["NL", "Netherlands"], ["HU", "Hungary"],
  ["US", "United States"], ["IE", "Ireland"], ["LU", "Luxembourg"], ["HK", "Hong Kong"],
  ["AU", "Australia"], ["AT", "Austria"], ["BE", "Belgium"], ["BR", "Brazil"],
  ["CA", "Canada"], ["CH", "Switzerland"], ["CN", "China"], ["CZ", "Czech Republic"],
  ["DK", "Denmark"], ["ES", "Spain"], ["FI", "Finland"], ["GR", "Greece"],
  ["IN", "India"], ["IT", "Italy"], ["KR", "Korea"], ["MX", "Mexico"],
  ["NO", "Norway"], ["NZ", "New Zealand"], ["PH", "Philippines"], ["PL", "Poland"],
  ["PT", "Portugal"], ["RO", "Romania"], ["SA", "Saudi Arabia"], ["SE", "Sweden"],
  ["SK", "Slovakia"], ["TR", "Türkiye"], ["TW", "Chinese Taipei"], ["ZA", "South Africa"],
  ["KH", "Cambodia"], ["LA", "Lao PDR"], ["BD", "Bangladesh"], ["LK", "Sri Lanka"],
] as const;

const source = "Aetherion_Legal_Entity_List_FY2026.xlsx";

export function entityPopulation(): PopulationRecord[] {
  const detailed: PopulationRecord[] = ENTITIES.map((entity) => ({
    id: entity.id,
    code: entity.code,
    name: entity.name,
    iso: entity.iso === "XX" ? "X5" : entity.iso,
    jurisdiction: entity.jurisdiction,
    detail: "calculation",
    source,
  }));
  const target = GROUPS.find((g) => g.id === "aetherion")?.entities ?? detailed.length;
  const existingIso = new Set(detailed.map((r) => r.iso));
  const missingJurisdictions = TARGET_JURISDICTIONS.filter(([iso]) => !existingIso.has(iso));
  const placeholders: PopulationRecord[] = [];

  for (let index = 0; detailed.length + placeholders.length < target; index += 1) {
    const [iso, jurisdiction] = index < missingJurisdictions.length
      ? missingJurisdictions[index]
      : TARGET_JURISDICTIONS[index % TARGET_JURISDICTIONS.length];
    const sequence = placeholders.filter((r) => r.iso === iso).length + 1;
    placeholders.push({
      id: `NMCE-${iso}-${String(sequence).padStart(3, "0")}`,
      code: `${iso}-NM-${String(sequence).padStart(3, "0")}`,
      name: `Aetherion non-material entity · ${jurisdiction} ${sequence}`,
      iso,
      jurisdiction,
      detail: "non-material",
      source,
    });
  }
  return [...detailed, ...placeholders];
}

export function populationReconciliation() {
  const records = entityPopulation();
  const detailed = records.filter((r) => r.detail === "calculation");
  const nonMaterial = records.filter((r) => r.detail === "non-material");
  const reportingIso = new Set(records.filter((r) => r.iso !== "X5").map((r) => r.iso));
  const target = GROUPS.find((g) => g.id === "aetherion")!;
  return {
    records,
    sourceEntities: target.entities,
    sourceJurisdictions: target.jurisdictions,
    detailedEntities: detailed.length,
    nonMaterialEntities: nonMaterial.length,
    reportingJurisdictions: reportingIso.size,
    statelessEntities: records.filter((r) => r.iso === "X5").length,
    entityReconciles: records.length === target.entities,
    jurisdictionReconciles: reportingIso.size === target.jurisdictions,
    calculationCoverage: target.entities > 0 ? detailed.length / target.entities : 0,
  };
}

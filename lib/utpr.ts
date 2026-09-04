import { money } from "./format";
import { ENTITIES, FINANCIALS, JURISDICTION_PACKS } from "./model";

export type UtprFactor = {
  iso: string;
  name: string;
  employees: number;
  assets: number;
  employeeShare: number;
  assetShare: number;
  percentage: number;
  amount: number;
  entityIds: string[];
};

const excluded = new Set(["Investment", "Excluded", "JV", "JV Sub"]);

/**
 * Article 2.6 factors. Investment Entities and JV Group members do not enter the
 * MNE's UTPR key. Callers pass the effective pack list so a reviewer-accepted
 * UTPR amendment changes which jurisdictions share the residual.
 */
export function utprAllocation(totalUtpr = 0, packs = JURISDICTION_PACKS): UtprFactor[] {
  const eligible = packs.filter((p) => p.utpr && p.iso !== "XX");
  const rows = eligible.map((pack) => {
    const entities = ENTITIES.filter(
      (e) => e.iso === pack.iso && !excluded.has(e.type) && !e.equityMethod,
    );
    const financials = entities
      .map((e) => FINANCIALS.find((f) => f.entityId === e.id))
      .filter((f): f is NonNullable<typeof f> => Boolean(f));
    return {
      iso: pack.iso,
      name: pack.name,
      employees: financials.reduce((sum, f) => sum + f.employees, 0),
      assets: money(financials.reduce((sum, f) => sum + f.tangibleEligible, 0)),
      entityIds: entities.map((e) => e.id),
    };
  }).filter((r) => r.employees > 0 || r.assets > 0);

  const allEmployees = rows.reduce((sum, r) => sum + r.employees, 0);
  const allAssets = rows.reduce((sum, r) => sum + r.assets, 0);
  let allocated = 0;

  return rows.map((r, index) => {
    const employeeShare = allEmployees > 0 ? r.employees / allEmployees : 0;
    const assetShare = allAssets > 0 ? r.assets / allAssets : 0;
    const percentage = (employeeShare + assetShare) / 2;
    const amount = index === rows.length - 1
      ? money(Math.max(0, totalUtpr - allocated))
      : money(totalUtpr * percentage);
    allocated = money(allocated + amount);
    return { ...r, employeeShare, assetShare, percentage, amount };
  });
}

export function utprFactorTotals(rows = utprAllocation()) {
  return {
    employees: rows.reduce((sum, r) => sum + r.employees, 0),
    assets: money(rows.reduce((sum, r) => sum + r.assets, 0)),
    percentage: rows.reduce((sum, r) => sum + r.percentage, 0),
    amount: money(rows.reduce((sum, r) => sum + r.amount, 0)),
  };
}

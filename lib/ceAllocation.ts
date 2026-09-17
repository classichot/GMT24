import type { Entity } from "./model";
import { money } from "./format";

type AuditNode = {
  id: string;
  label: string;
  amount?: number;
  kind: "result" | "formula" | "rule" | "entity" | "account" | "source" | "test";
  detail: string;
  ruleId?: string;
  ruleVersion?: string;
  sourceFile?: string;
  children?: AuditNode[];
};

const MIN_RATE = 0.15;

export type CeAllocBasis = "globe-income" | "deemed-globe" | "single-ce" | "nil";

export type CeAllocRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  globeIncome: number;
  coveredTax: number;
  /** Art. 5.2.5 deemed GloBE Income = −ACT ÷ 15% when this CE has no Net GloBE Income and a negative ACT. */
  deemedGlobe: number;
  shareBase: number;
  share: number;
  rateTopUp: number;
  acttt: number;
  topUp: number;
};

export type CeAllocation = {
  blendKey: string;
  iso: string;
  name: string;
  basis: CeAllocBasis;
  basisLabel: string;
  rateTopUp: number;
  additionalCurrentTopUp: number;
  jurisdictionalTopUp: number;
  shareBase: number;
  rows: CeAllocRow[];
  reconciling: boolean;
  remainder: number;
};

function lastPenny(rows: CeAllocRow[], field: "rateTopUp" | "acttt" | "topUp", target: number) {
  const posted = money(rows.reduce((s, r) => s + r[field], 0));
  const diff = money(target - posted);
  if (diff === 0 || rows.length === 0) return;
  const i = rows.reduce((best, r, idx) => (r.shareBase > rows[best].shareBase ? idx : best), 0);
  rows[i] = { ...rows[i], [field]: money(rows[i][field] + diff) };
}

/**
 * Art. 5.2.4 / 5.2.5 — allocate Jurisdictional Top-up Tax to each Constituent Entity
 * in the blend, in proportion to GloBE Income (or deemed GloBE Income when the
 * jurisdiction has no Net GloBE Income and Additional Current Top-up Tax arises).
 *
 * Rate top-up (Top-up % × Excess) is allocated on actual GloBE Income of CEs with
 * GloBE Income > 0. ACTTT is allocated on the same basis when the blend has Net
 * GloBE Income; otherwise on deemed GloBE Income = −ACT ÷ 15% of CEs with
 * negative Adjusted Covered Taxes (Art. 5.2.5).
 */
export function allocateTopUpToCes(input: {
  blendKey: string;
  iso: string;
  name: string;
  entities: Entity[];
  globeOf: (id: string) => number;
  coveredOf: (id: string) => number;
  rateTopUp: number;
  additionalCurrentTopUp: number;
  jurisdictionalTopUp: number;
}): CeAllocation {
  const { blendKey, iso, name, entities, rateTopUp, additionalCurrentTopUp, jurisdictionalTopUp } = input;
  const globeBy = entities.map((e) => ({ e, globe: money(input.globeOf(e.id)), covered: money(input.coveredOf(e.id)) }));
  const netGlobe = money(globeBy.reduce((s, r) => s + r.globe, 0));
  const positiveGlobe = money(globeBy.filter((r) => r.globe > 0).reduce((s, r) => s + r.globe, 0));
  const deemedBy = globeBy.map((r) => ({
    ...r,
    deemed: r.globe <= 0 && r.covered < 0 ? money((-r.covered) / MIN_RATE) : 0,
  }));
  const deemedTotal = money(deemedBy.reduce((s, r) => s + r.deemed, 0));

  let basis: CeAllocBasis = "nil";
  let basisLabel = "No Top-up Tax to allocate.";
  if (jurisdictionalTopUp <= 0) {
    basis = "nil";
  } else if (entities.length === 1) {
    basis = "single-ce";
    basisLabel = `Single Constituent Entity ${entities[0].code} carries the whole Jurisdictional Top-up Tax of ${jurisdictionalTopUp.toLocaleString("en-GB")}.`;
  } else if (netGlobe > 0 && positiveGlobe > 0) {
    basis = "globe-income";
    basisLabel = `Art. 5.2.4 — allocated in proportion to GloBE Income of Constituent Entities with GloBE Income > 0 (${positiveGlobe.toLocaleString("en-GB")}).`;
  } else if (additionalCurrentTopUp > 0 && deemedTotal > 0) {
    basis = "deemed-globe";
    basisLabel = `Art. 5.2.5 — no Net GloBE Income; Additional Current Top-up Tax ${additionalCurrentTopUp.toLocaleString("en-GB")} allocated on deemed GloBE Income = −ACT ÷ 15% (${deemedTotal.toLocaleString("en-GB")}).`;
  } else {
    basis = "globe-income";
    basisLabel = "Art. 5.2.4 — no positive GloBE Income and no deemed GloBE Income; residual allocated equally so the last penny still posts.";
  }

  const equalFallback = jurisdictionalTopUp > 0 && basis !== "nil" && basis !== "single-ce"
    && ((basis === "deemed-globe" && deemedTotal === 0) || (basis === "globe-income" && positiveGlobe === 0));

  const shareOf = (r: (typeof deemedBy)[number]) => {
    if (basis === "nil") return 0;
    if (basis === "single-ce") return 1;
    if (equalFallback) return 1;
    if (basis === "deemed-globe") return r.deemed;
    return r.globe > 0 ? r.globe : 0;
  };
  const shareBase = money(deemedBy.reduce((s, r) => s + shareOf(r), 0));

  const rows: CeAllocRow[] = deemedBy.map((r) => {
    const raw = shareOf(r);
    const share = shareBase > 0 ? raw / shareBase : 0;
    const rate = money(rateTopUp * share);
    const acttt = money(additionalCurrentTopUp * share);
    return {
      id: r.e.id,
      code: r.e.code,
      name: r.e.name,
      type: r.e.type,
      globeIncome: r.globe,
      coveredTax: r.covered,
      deemedGlobe: r.deemed,
      shareBase: raw,
      share,
      rateTopUp: rate,
      acttt,
      topUp: money(rate + acttt),
    };
  });

  lastPenny(rows, "rateTopUp", rateTopUp);
  lastPenny(rows, "acttt", additionalCurrentTopUp);
  for (const row of rows) row.topUp = money(row.rateTopUp + row.acttt);
  lastPenny(rows, "topUp", jurisdictionalTopUp);

  const posted = money(rows.reduce((s, r) => s + r.topUp, 0));
  return {
    blendKey,
    iso,
    name,
    basis,
    basisLabel,
    rateTopUp,
    additionalCurrentTopUp,
    jurisdictionalTopUp,
    shareBase,
    rows,
    reconciling: posted === jurisdictionalTopUp,
    remainder: money(jurisdictionalTopUp - posted),
  };
}

export function ceAllocAudit(alloc: CeAllocation, parentId: string): AuditNode {
  return {
    id: `${parentId}-cealloc`,
    label: "Art. 5.2.4 / 5.2.5 CE allocation",
    amount: alloc.jurisdictionalTopUp,
    kind: "formula",
    detail: alloc.basisLabel,
    ruleId: alloc.basis === "deemed-globe" ? "OECD-GloBE-15" : "OECD-GloBE-15",
    ruleVersion: "2026.1",
    children: alloc.rows.map((r) => ({
      id: `${parentId}-cealloc-${r.id}`,
      label: `${r.code} · ${r.name}`,
      amount: r.topUp,
      kind: "result" as const,
      detail: alloc.basis === "deemed-globe"
        ? `Deemed GloBE ${r.deemedGlobe.toLocaleString("en-GB")} (${(r.share * 100).toFixed(2)}%) · ACTTT ${r.acttt.toLocaleString("en-GB")}`
        : `GloBE ${r.globeIncome.toLocaleString("en-GB")} (${(r.share * 100).toFixed(2)}%) · rate top-up ${r.rateTopUp.toLocaleString("en-GB")} + ACTTT ${r.acttt.toLocaleString("en-GB")}`,
      ruleId: "OECD-GloBE-15",
      ruleVersion: "2026.1",
    })),
  };
}

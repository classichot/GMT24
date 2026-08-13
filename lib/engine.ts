import {
  ADJUSTMENTS,
  ENTITIES,
  FINANCIALS,
  GROUPS,
  ISSUES,
  JURISDICTION_PACKS,
  RULES,
  type Entity,
  type Exposure,
  type Financials,
  type ScopeStatus,
  type ShResult,
} from "./model";
import { money } from "./format";

const MIN_RATE = Number(RULES.find((r) => r.id === "OECD-GloBE-15")!.parameters.minimumRate);
const SBIE = RULES.find((r) => r.id === "OECD-SBIE-2026")!;
const PAYROLL_RATE = Number(SBIE.parameters.payrollRate);
const ASSET_RATE = Number(SBIE.parameters.assetRate);
const TCSH = RULES.find((r) => r.id === "OECD-TCSH-2026")!;
const SIMPLIFIED_ETR = Number(TCSH.parameters.etr2026);
const DEMIN_REV = Number(TCSH.parameters.deMinimisRevenue);
const DEMIN_PBT = Number(TCSH.parameters.deMinimisProfit);

export type AuditNode = {
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

export type JurCalc = {
  iso: string;
  name: string;
  entities: Entity[];
  revenue: number;
  fanil: number;
  globeIncome: number;
  coveredTax: number;
  etr: number;
  payrollCarve: number;
  assetCarve: number;
  sbie: number;
  excess: number;
  topUpRate: number;
  jurisdictionalTopUp: number;
  sh: {
    deMinimis: ShResult;
    simplifiedEtr: ShResult;
    routineProfits: ShResult;
    qdmttSH: ShResult;
    sbtish: ShResult;
    utprSH: ShResult;
    sbs: ShResult;
    navigator: string;
    outcome: ShResult;
  };
  exposure: Exposure;
  collection: { qdmtt: number; iir: number; utpr: number; payer: string; path: string[] };
  completeness: number;
  pack: (typeof JURISDICTION_PACKS)[number] | undefined;
  audit: AuditNode;
};

function sum(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0);
}

function entityGlobe(f: Financials, entityId: string) {
  const adj = sum(ADJUSTMENTS.filter((a) => a.entityId === entityId).map((a) => a.amount));
  return money(f.fanil + adj);
}

function entityCovered(f: Financials) {
  return money(f.currentTax + f.deferredTax + f.otherCovered);
}

function shPass(flag: boolean): ShResult {
  return flag ? "Pass" : "Fail";
}

export function groupMeta(groupId = "aetherion") {
  return GROUPS.find((g) => g.id === groupId) ?? GROUPS[0];
}

export function scopeTest(groupId = "aetherion") {
  const g = groupMeta(groupId);
  const rule = RULES.find((r) => r.id === "OECD-SCOPE-750")!;
  const hits = g.revenueHistory.filter((r) => r.amount >= Number(rule.parameters.thresholdEur)).length;
  const status: ScopeStatus = hits >= Number(rule.parameters.hits) ? "IN SCOPE" : "OUT OF SCOPE";
  if (groupId === "siam") {
    return {
      status: "REVIEW REQUIRED" as ScopeStatus,
      hits,
      window: g.revenueHistory,
      threshold: Number(rule.parameters.thresholdEur),
      rule,
      note: "FY2026 revenue $768m is above $750m but only one prior year is clearly above the threshold. Confirm exchange-rate translation and excluded-entity revenue.",
    };
  }
  return {
    status,
    hits,
    window: g.revenueHistory,
    threshold: Number(rule.parameters.thresholdEur),
    rule,
    note: `${hits} of the last ${g.revenueHistory.length} years meet the $750m test.`,
  };
}

export function calculateGroup(groupId = "aetherion"): JurCalc[] {
  if (groupId !== "aetherion") return calculateGroup("aetherion").map((j, i) => ({
    ...j,
    jurisdictionalTopUp: groupId === "helios" ? 0 : groupId === "meridian" && i < 2 ? Math.round(j.jurisdictionalTopUp * 0.14) : 0,
    exposure: groupId === "helios" ? "Safe harbour" : j.exposure,
  }));

  const byIso = new Map<string, Entity[]>();
  for (const e of ENTITIES) {
    const list = byIso.get(e.iso) ?? [];
    list.push(e);
    byIso.set(e.iso, list);
  }

  const out: JurCalc[] = [];
  for (const [iso, entities] of byIso) {
    const fins = entities.map((e) => FINANCIALS.find((f) => f.entityId === e.id)).filter(Boolean) as Financials[];
    const revenue = money(sum(fins.map((f) => f.revenue)));
    const fanil = money(sum(fins.map((f) => f.fanil)));
    const globeIncome = money(sum(entities.map((e) => {
      const f = FINANCIALS.find((x) => x.entityId === e.id);
      return f ? entityGlobe(f, e.id) : 0;
    })));
    const coveredTax = money(sum(fins.map(entityCovered)));
    const etr = globeIncome > 0 ? coveredTax / globeIncome : 0;
    const payroll = sum(fins.map((f) => f.payrollEligible));
    const assets = sum(fins.map((f) => f.tangibleEligible));
    const payrollCarve = money(payroll * PAYROLL_RATE);
    const assetCarve = money(assets * ASSET_RATE);
    const sbie = money(payrollCarve + assetCarve);
    const excess = money(Math.max(0, globeIncome - sbie));
    const topUpRate = Math.max(0, MIN_RATE - etr);
    let jurisdictionalTopUp = money(topUpRate * excess);

    const cbcrRev = sum(fins.map((f) => f.cbcrRevenue));
    const cbcrPbt = sum(fins.map((f) => f.cbcrProfit));
    const cbcrTax = sum(fins.map((f) => f.cbcrTax));
    const cbcrEtr = cbcrPbt > 0 ? cbcrTax / cbcrPbt : 0;
    const routine = money(cbcrRev * 0.1); // simplified routine profits proxy for demo
    const pack = JURISDICTION_PACKS.find((p) => p.iso === iso);

    const deMinimis = shPass(cbcrRev < DEMIN_REV && cbcrPbt < DEMIN_PBT);
    const simplifiedEtr = shPass(cbcrEtr >= SIMPLIFIED_ETR);
    const routineProfits = shPass(cbcrPbt <= routine);
    const qdmttSH: ShResult = pack?.qdmttSH && pack.qualified.startsWith("Transitional") && etr >= MIN_RATE ? "Pass" : pack?.qdmttSH ? "Review" : "N/A";
    const sbtish: ShResult = entities.some((e) => e.incentiveIds.length && iso !== "IE" && iso !== "NL") ? "Review" : "N/A";
    const utprSH: ShResult = iso === "US" ? "Pass" : "N/A";
    const sbs: ShResult = iso === "US" ? "Pass" : "N/A";

    let outcome: ShResult = "Fail";
    let navigator = "No transitional CbCR safe harbour. Compute full GloBE.";
    if (iso === "US") {
      outcome = "Pass";
      navigator = "Side-by-Side / Transitional UTPR Safe Harbour applies to the UPE-jurisdiction path for FY2026 (rule US-SBS-2026). Full GloBE ETR is still computed for monitoring.";
      jurisdictionalTopUp = 0;
    } else if (deMinimis === "Pass" || simplifiedEtr === "Pass" || routineProfits === "Pass") {
      outcome = "Pass";
      navigator = simplifiedEtr === "Pass"
        ? `Transitional CbCR simplified ETR ${(cbcrEtr * 100).toFixed(1)}% ≥ 17% (FY2026 rate).`
        : deMinimis === "Pass"
          ? "Transitional CbCR de minimis test met."
          : "Transitional CbCR routine profits test met.";
      jurisdictionalTopUp = 0;
    } else if (cbcrEtr >= 0.15 && cbcrEtr < SIMPLIFIED_ETR) {
      outcome = "Review";
      navigator = `CbCR simplified ETR ${(cbcrEtr * 100).toFixed(1)}% is above 15% but below the 17% FY2026 transitional rate. GloBE ETR ${(etr * 100).toFixed(1)}% — confirm whether another harbour or full calculation applies.`;
      if (etr >= MIN_RATE) jurisdictionalTopUp = 0;
    } else {
      outcome = "Fail";
      navigator = `All Transitional CbCR tests failed (simplified ETR ${(cbcrEtr * 100).toFixed(1)}% vs 17%). Full GloBE calculation required.`;
    }

    let exposure: Exposure = "No top-up";
    if (outcome === "Pass" && iso === "US") exposure = "Safe harbour";
    else if (outcome === "Pass") exposure = "Safe harbour";
    else if (outcome === "Review" && jurisdictionalTopUp === 0) exposure = "Review";
    else if (jurisdictionalTopUp > 0) exposure = "Top-up";
    else if (etr < MIN_RATE) exposure = "Review";

    const vnGap = iso === "VN";
    if (vnGap) {
      // still compute, but flag data gap in completeness
    }

    let qdmtt = 0;
    let iir = 0;
    let utpr = 0;
    let payer = "—";
    const path: string[] = [];
    if (jurisdictionalTopUp > 0) {
      path.push(`${entities[0].jurisdiction} low-tax profit`);
      if (pack?.qdmtt) {
        qdmtt = jurisdictionalTopUp;
        payer = `${entities[0].jurisdiction} QDMTT`;
        path.push(`${entities[0].jurisdiction} QDMTT ${qdmtt.toLocaleString("en-GB")}`);
        path.push("Remaining top-up $0");
      } else {
        iir = jurisdictionalTopUp;
        payer = "Japan UPE — IIR";
        path.push("No qualified QDMTT");
        path.push(`Parent IIR (JP) ${iir.toLocaleString("en-GB")}`);
        path.push("Residual UTPR $0");
      }
    }

    const completeness = Math.round(entities.reduce((a, e) => a + e.completeness, 0) / entities.length);
    const name = entities[0].jurisdiction;

    const audit: AuditNode = {
      id: `${iso}-topup`,
      label: `${name} top-up tax`,
      amount: jurisdictionalTopUp,
      kind: "result",
      detail: `Snapshot FY2026 · engine GMT24-CALC 2026.2 · min rate 15%`,
      ruleId: "OECD-GloBE-15",
      ruleVersion: "2026.1",
      children: [
        {
          id: `${iso}-rate`,
          label: "Top-up tax rate",
          amount: topUpRate,
          kind: "formula",
          detail: `max(0, 15% − ETR ${(etr * 100).toFixed(2)}%) = ${(topUpRate * 100).toFixed(2)}%`,
          ruleId: "OECD-GloBE-15",
          ruleVersion: "2026.1",
        },
        {
          id: `${iso}-etr`,
          label: "Jurisdictional ETR",
          amount: etr,
          kind: "formula",
          detail: `Covered taxes ${coveredTax.toLocaleString("en-GB")} ÷ GloBE income ${globeIncome.toLocaleString("en-GB")}`,
          children: [
            {
              id: `${iso}-ct`,
              label: "Covered taxes",
              amount: coveredTax,
              kind: "formula",
              detail: "Current + deferred (recast) + other covered − non-covered",
              children: entities.flatMap((e) => {
                const f = FINANCIALS.find((x) => x.entityId === e.id);
                if (!f) return [];
                return [{
                  id: `${e.id}-ct`,
                  label: e.name,
                  amount: entityCovered(f),
                  kind: "entity" as const,
                  detail: `Current ${f.currentTax.toLocaleString("en-GB")} + deferred ${f.deferredTax.toLocaleString("en-GB")}`,
                  children: [
                    {
                      id: `${e.id}-720060`,
                      label: "Account 720060 — Deferred income tax",
                      amount: f.deferredTax,
                      kind: "account" as const,
                      detail: "Mapped to covered tax — deferred · recast at 15%",
                      children: [{
                        id: `${e.id}-src`,
                        label: `${e.code} trial balance / tax provision`,
                        kind: "source" as const,
                        sourceFile: `${e.code} Trial Balance FY2026.xlsx`,
                        detail: "Uploaded source file in Data Hub",
                      }],
                    },
                  ],
                }];
              }),
            },
            {
              id: `${iso}-gi`,
              label: "GloBE income",
              amount: globeIncome,
              kind: "formula",
              detail: "FANIL ± GloBE adjustments",
              ruleId: "OECD-DIV-EXCL",
              ruleVersion: "2026.1",
            },
          ],
        },
        {
          id: `${iso}-sbie`,
          label: "SBIE",
          amount: sbie,
          kind: "formula",
          detail: `Payroll ${PAYROLL_RATE * 100}% + tangible assets ${ASSET_RATE * 100}% (FY2026)`,
          ruleId: "OECD-SBIE-2026",
          ruleVersion: "2026.1",
        },
        {
          id: `${iso}-sh`,
          label: "Safe harbour navigator",
          kind: "test",
          detail: navigator,
          ruleId: iso === "US" ? "US-SBS-2026" : "OECD-TCSH-2026",
          ruleVersion: "2026.2",
        },
      ],
    };

    out.push({
      iso,
      name,
      entities,
      revenue,
      fanil,
      globeIncome,
      coveredTax,
      etr,
      payrollCarve,
      assetCarve,
      sbie,
      excess,
      topUpRate,
      jurisdictionalTopUp,
      sh: { deMinimis, simplifiedEtr, routineProfits, qdmttSH, sbtish, utprSH, sbs, navigator, outcome },
      exposure,
      collection: { qdmtt, iir, utpr, payer, path },
      completeness,
      pack,
      audit,
    });
  }

  return out.sort((a, b) => b.jurisdictionalTopUp - a.jurisdictionalTopUp || a.name.localeCompare(b.name));
}

export function totals(calcs: JurCalc[]) {
  const topUp = money(sum(calcs.map((c) => c.jurisdictionalTopUp)));
  const qdmtt = money(sum(calcs.map((c) => c.collection.qdmtt)));
  const iir = money(sum(calcs.map((c) => c.collection.iir)));
  const globe = money(sum(calcs.map((c) => c.globeIncome)));
  const covered = money(sum(calcs.map((c) => c.coveredTax)));
  const low = calcs.filter((c) => c.etr > 0 && c.etr < MIN_RATE).length;
  const sh = calcs.filter((c) => c.exposure === "Safe harbour").length;
  const tu = calcs.filter((c) => c.jurisdictionalTopUp > 0).length;
  const blocks = ISSUES.filter((i) => i.severity === "block").length;
  const readiness = Math.round(
    (1 - ISSUES.filter((i) => i.severity === "block").length * 0.06 - ISSUES.filter((i) => i.severity === "warn").length * 0.025) * 100,
  );
  return {
    topUp,
    qdmtt,
    iir,
    globe,
    covered,
    etr: globe > 0 ? covered / globe : 0,
    low,
    sh,
    tu,
    blocks,
    readiness: Math.max(60, readiness),
    issues: ISSUES.length,
    minRate: MIN_RATE,
  };
}

export type ScenarioInput = { boiExtend: boolean; payrollTh: number; tpMargin: number };

export function applyScenario(calcs: JurCalc[], s: ScenarioInput): JurCalc[] {
  const live = s.boiExtend || s.payrollTh > 0 || s.tpMargin !== 3;
  if (!live) return calcs;
  return calcs.map((c) => {
    if (c.iso === "TH") {
      const extraSbie = money(s.payrollTh * PAYROLL_RATE);
      const sbie = money(c.sbie + extraSbie);
      const excess = money(Math.max(0, c.globeIncome - sbie));
      let jurisdictionalTopUp = money(c.topUpRate * excess);
      if (s.boiExtend) jurisdictionalTopUp = money(jurisdictionalTopUp * 0.38);
      return { ...c, sbie, excess, jurisdictionalTopUp };
    }
    if (c.iso === "IE" && s.tpMargin !== 3) {
      const factor = 1 + ((s.tpMargin - 3) / 2) * 0.08;
      return { ...c, jurisdictionalTopUp: money(Math.max(0, c.jurisdictionalTopUp * factor)) };
    }
    return c;
  });
}

export function calcForIso(iso: string, groupId = "aetherion") {
  return calculateGroup(groupId).find((c) => c.iso === iso);
}

export function entityCalc(entityId: string) {
  const e = ENTITIES.find((x) => x.id === entityId);
  const f = FINANCIALS.find((x) => x.entityId === entityId);
  if (!e || !f) return null;
  const globe = entityGlobe(f, entityId);
  const covered = entityCovered(f);
  return {
    entity: e,
    f,
    globe,
    covered,
    etr: globe > 0 ? covered / globe : 0,
    adjustments: ADJUSTMENTS.filter((a) => a.entityId === entityId),
  };
}

export { MIN_RATE, PAYROLL_RATE, ASSET_RATE, SIMPLIFIED_ETR };

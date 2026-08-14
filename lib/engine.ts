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
  type Adjustment,
  type ScopeStatus,
  type ShResult,
} from "./model";
import { money } from "./format";
import { deferredTaxAdjustment, viewsForEntity, type DtView } from "./deferredTax";

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
  trace: {
    globe: AuditNode;
    covered: AuditNode;
    sbie: AuditNode;
    payroll: AuditNode;
    assets: AuditNode;
    excess: AuditNode;
    etr: AuditNode;
  };
};

function sum(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0);
}

function entityGlobe(f: Financials, entityId: string) {
  const adj = sum(ADJUSTMENTS.filter((a) => a.entityId === entityId).map((a) => a.amount));
  return money(f.fanil + adj);
}

function entityCovered(f: Financials) {
  const deferred = deferredTaxAdjustment(f.entityId) ?? f.deferredTax;
  return money(f.currentTax + deferred + f.otherCovered);
}

function sourceNode(id: string, file: string, detail: string): AuditNode {
  return { id, label: file, kind: "source", sourceFile: file, detail };
}

export function traceAdj(a: Adjustment): AuditNode {
  return {
    id: a.id,
    label: a.category,
    amount: a.amount,
    kind: "formula",
    ruleId: a.ruleId,
    ruleVersion: "2026.1",
    sourceFile: a.sourceDoc,
    detail: `Art. 3.2 · original ${a.original.toLocaleString("en-GB")} · delta ${a.amount.toLocaleString("en-GB")}${a.account ? ` · acct ${a.account}` : ""} · ${a.reason} · ${a.preparer}${a.reviewer ? ` / ${a.reviewer}` : ""} · ${a.status}`,
    children: [sourceNode(`${a.id}-src`, a.sourceDoc, "Approved mapping · engine posted the delta, not the LLM")],
  };
}

export function traceFanil(entityId: string): AuditNode | null {
  const e = ENTITIES.find((x) => x.id === entityId);
  const f = FINANCIALS.find((x) => x.entityId === entityId);
  if (!e || !f) return null;
  const file = `${e.code} Trial Balance FY2026.xlsx`;
  return {
    id: `${e.id}-fanil`,
    label: `FANIL · ${e.code}`,
    amount: f.fanil,
    kind: "entity",
    ruleId: "OECD-GloBE-15",
    ruleVersion: "2026.1",
    sourceFile: file,
    detail: `Art. 3.1.1 — Financial Accounting Net Income or Loss from the UPE consolidation (${e.gaap}). Not local taxable profit.`,
    children: [sourceNode(`${e.id}-fanil-src`, file, "Data Hub · UPE CFS / trial balance")],
  };
}

export function traceGlobeEntity(entityId: string): AuditNode | null {
  const e = ENTITIES.find((x) => x.id === entityId);
  const f = FINANCIALS.find((x) => x.entityId === entityId);
  const fanil = traceFanil(entityId);
  if (!e || !f || !fanil) return null;
  const adjs = ADJUSTMENTS.filter((a) => a.entityId === entityId);
  return {
    id: `${e.id}-globe`,
    label: `GloBE income · ${e.code}`,
    amount: entityGlobe(f, entityId),
    kind: "formula",
    ruleId: "OECD-GloBE-15",
    ruleVersion: "2026.1",
    detail: "GloBE = FANIL + Σ Art. 3.2 deltas. Engine posted; LLM did not.",
    children: [fanil, ...adjs.map(traceAdj)],
  };
}

export function traceDtPosition(p: DtView): AuditNode {
  return {
    id: p.id,
    label: `${p.side} · ${p.type}`,
    amount: p.globeClosing,
    kind: "account",
    ruleId: p.exception ? "OECD-DT-445" : p.deadlineYear ? "OECD-DT-444" : "OECD-DT-441",
    ruleVersion: "2026.1",
    sourceFile: p.evidence.split("·")[0].trim(),
    detail: `Accounting close ${p.closing.toLocaleString("en-GB")} at ${(p.accountingRate * 100).toFixed(1)}% → GloBE ${p.globeClosing.toLocaleString("en-GB")} at ${(p.globeRate * 100).toFixed(0)}%. ${p.treatment}. Origin FY${p.originYear}${p.deadlineYear ? ` · recapture deadline FY${p.deadlineYear}` : ""}. FY movement in TDTA ${p.pnl.toLocaleString("en-GB")}. ${p.evidence}`,
    children: [
      { id: `${p.id}-open`, label: "Opening (accounting)", amount: p.opening, kind: "formula", detail: "Sub-ledger opening" },
      { id: `${p.id}-add`, label: "Addition (accounting)", amount: p.addition, kind: "formula", detail: "This-year addition" },
      { id: `${p.id}-rev`, label: "Reversal (accounting)", amount: p.reversal, kind: "formula", detail: "This-year reversal" },
      { id: `${p.id}-pnl`, label: "GloBE FY movement", amount: p.pnl, kind: "formula", ruleId: "OECD-DT-441", ruleVersion: "2026.1", detail: "Enters Total Deferred Tax Adjustment Amount after recast" },
    ],
  };
}

export function traceDeferredEntity(entityId: string): AuditNode | null {
  const e = ENTITIES.find((x) => x.id === entityId);
  const f = FINANCIALS.find((x) => x.entityId === entityId);
  if (!e || !f) return null;
  const deferred = deferredTaxAdjustment(entityId) ?? f.deferredTax;
  const rows = viewsForEntity(entityId);
  const material = [...rows].sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)).slice(0, 12);
  return {
    id: `${e.id}-dt`,
    label: `Deferred tax recast · ${e.code}`,
    amount: deferred,
    kind: "formula",
    ruleId: "OECD-DT-441",
    ruleVersion: "2026.1",
    sourceFile: "Deferred_tax_rollforward.xlsx",
    detail: `Art. 4.4 Total Deferred Tax Adjustment Amount · ${rows.length} sub-ledger positions · recast at the Minimum Rate`,
    children: [
      ...material.map(traceDtPosition),
      sourceNode(`${e.id}-dt-src`, "Deferred_tax_rollforward.xlsx", "DTA/DTL register · tax provision"),
    ],
  };
}

export function traceDeferredIso(iso: string): AuditNode | null {
  const entities = ENTITIES.filter((e) => e.iso === iso);
  const children = entities.map((e) => traceDeferredEntity(e.id)).filter(Boolean) as AuditNode[];
  if (!children.length) return null;
  const name = entities[0]?.jurisdiction ?? iso;
  return {
    id: `${iso}-dt-all`,
    label: `${name} Total Deferred Tax Adjustment Amount`,
    amount: money(sum(children.map((c) => c.amount ?? 0))),
    kind: "formula",
    ruleId: "OECD-DT-441",
    ruleVersion: "2026.1",
    detail: `Art. 4.4 · Σ Constituent Entity recast deferred tax · ${children.length} entities · engine posted, not the LLM`,
    children,
  };
}

export function traceCoveredEntity(entityId: string): AuditNode | null {
  const e = ENTITIES.find((x) => x.id === entityId);
  const f = FINANCIALS.find((x) => x.entityId === entityId);
  if (!e || !f) return null;
  const deferred = traceDeferredEntity(entityId);
  const file = `${e.code} Trial Balance FY2026.xlsx`;
  return {
    id: `${e.id}-ct`,
    label: `Covered taxes · ${e.code}`,
    amount: entityCovered(f),
    kind: "entity",
    ruleId: "OECD-GloBE-15",
    ruleVersion: "2026.1",
    detail: "Current Covered Tax + Art. 4.4 deferred (recast) + other covered. Non-covered excluded.",
    children: [
      {
        id: `${e.id}-current`,
        label: "Current Covered Tax",
        amount: f.currentTax,
        kind: "account",
        ruleId: "OECD-GloBE-15",
        ruleVersion: "2026.1",
        sourceFile: file,
        detail: "Art. 4.1.1 current tax expense on Covered Taxes accrued in FANIL",
        children: [sourceNode(`${e.id}-current-src`, file, "Account 720050 · tax provision")],
      },
      ...(deferred ? [deferred] : []),
      {
        id: `${e.id}-other`,
        label: "Other covered",
        amount: f.otherCovered,
        kind: "formula",
        detail: "Art. 4.2 / 4.3 in-lieu, PE, CFC, hybrid, distributions",
      },
      {
        id: `${e.id}-non`,
        label: "Non-covered (excluded)",
        amount: f.nonCovered,
        kind: "formula",
        detail: "Art. 4.2 — not in Adjusted Covered Taxes",
        sourceFile: file,
      },
    ],
  };
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

    const globeTrace: AuditNode = {
      id: `${iso}-gi`,
      label: `${name} GloBE income`,
      amount: globeIncome,
      kind: "formula",
      ruleId: "OECD-GloBE-15",
      ruleVersion: "2026.1",
      detail: "Σ FANIL ± Art. 3.2 of Constituent Entities in the jurisdiction",
      children: entities.map((e) => traceGlobeEntity(e.id)).filter(Boolean) as AuditNode[],
    };
    const coveredTrace: AuditNode = {
      id: `${iso}-ct`,
      label: `${name} Covered taxes`,
      amount: coveredTax,
      kind: "formula",
      ruleId: "OECD-GloBE-15",
      ruleVersion: "2026.1",
      detail: "Current + deferred (Art. 4.4 recast) + other covered − non-covered",
      children: entities.map((e) => traceCoveredEntity(e.id)).filter(Boolean) as AuditNode[],
    };
    const payrollTrace: AuditNode = {
      id: `${iso}-payroll`,
      label: `${name} payroll carve-out`,
      amount: payrollCarve,
      kind: "formula",
      ruleId: "OECD-SBIE-2026",
      ruleVersion: "2026.1",
      sourceFile: "Payroll_TH_FY2026.csv",
      detail: `Art. 5.3.3 / 9.2 · ${PAYROLL_RATE * 100}% × eligible payroll ${payroll.toLocaleString("en-GB")}`,
    };
    const assetTrace: AuditNode = {
      id: `${iso}-assets`,
      label: `${name} tangible-asset carve-out`,
      amount: assetCarve,
      kind: "formula",
      ruleId: "OECD-SBIE-2026",
      ruleVersion: "2026.1",
      sourceFile: "Fixed_asset_register_TH.xlsx",
      detail: `Art. 5.3.4 / 9.2 · ${ASSET_RATE * 100}% × eligible tangible assets ${assets.toLocaleString("en-GB")}`,
    };
    const sbieTrace: AuditNode = {
      id: `${iso}-sbie`,
      label: `${name} SBIE`,
      amount: sbie,
      kind: "formula",
      ruleId: "OECD-SBIE-2026",
      ruleVersion: "2026.1",
      detail: "Payroll carve-out + tangible-asset carve-out. Does not change ETR.",
      children: [payrollTrace, assetTrace],
    };
    const excessTrace: AuditNode = {
      id: `${iso}-excess`,
      label: `${name} Excess Profit`,
      amount: excess,
      kind: "formula",
      ruleId: "OECD-GloBE-15",
      ruleVersion: "2026.1",
      detail: "max(0, Net GloBE Income − SBIE) · Art. 5.2.2",
      children: [globeTrace, sbieTrace],
    };
    const etrTrace: AuditNode = {
      id: `${iso}-etr`,
      label: `${name} jurisdictional ETR`,
      amount: etr,
      kind: "formula",
      ruleId: "OECD-GloBE-15",
      ruleVersion: "2026.1",
      detail: `Covered taxes ${coveredTax.toLocaleString("en-GB")} ÷ GloBE income ${globeIncome.toLocaleString("en-GB")} · Art. 5.1.1`,
      children: [coveredTrace, globeTrace],
    };

    const audit: AuditNode = {
      id: `${iso}-topup`,
      label: `${name} top-up tax`,
      amount: jurisdictionalTopUp,
      kind: "result",
      detail: `Snapshot FY2026 · engine GMT24-CALC 2026.2 · min rate 15% · Top-up % × Excess Profit`,
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
        etrTrace,
        sbieTrace,
        excessTrace,
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
      trace: {
        globe: globeTrace,
        covered: coveredTrace,
        sbie: sbieTrace,
        payroll: payrollTrace,
        assets: assetTrace,
        excess: excessTrace,
        etr: etrTrace,
      },
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
  const audit: AuditNode = {
    id: "group-topup",
    label: "Group jurisdictional top-up",
    amount: topUp,
    kind: "result",
    ruleId: "OECD-GloBE-15",
    ruleVersion: "2026.1",
    detail: "Σ jurisdictional top-up · snapshot FY2026 · engine GMT24-CALC 2026.2 · presentation USD. Posted by the engine, not the LLM.",
    children: calcs.filter((c) => c.jurisdictionalTopUp > 0).map((c) => c.audit),
  };
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
    audit,
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
  const adjs = ADJUSTMENTS.filter((a) => a.entityId === entityId);
  const coveredTrace = traceCoveredEntity(entityId)!;
  return {
    entity: e,
    f,
    globe,
    covered,
    etr: globe > 0 ? covered / globe : 0,
    adjustments: adjs,
    trace: {
      fanil: traceFanil(entityId)!,
      globe: traceGlobeEntity(entityId)!,
      covered: coveredTrace,
      current: coveredTrace.children?.find((c) => c.id === `${entityId}-current`),
      deferred: traceDeferredEntity(entityId),
      other: coveredTrace.children?.find((c) => c.id === `${entityId}-other`),
      nonCovered: coveredTrace.children?.find((c) => c.id === `${entityId}-non`),
      adj: adjs.map(traceAdj),
    },
  };
}

export { MIN_RATE, PAYROLL_RATE, ASSET_RATE, SIMPLIFIED_ETR };

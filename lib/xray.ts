import { money } from "./format";
import { RULES } from "./model";
import type { JurCalc } from "./engine";

const MIN_RATE = Number(RULES.find((r) => r.id === "OECD-GloBE-15")!.parameters.minimumRate);

/**
 * Pillar Two X-Ray — Data Confirmation & Calculation Assurance.
 *
 * Sits between ingestion and the calculation engine. A trial balance can carry an
 * amount but never the legal characteristics the GloBE rules turn on: whether a
 * dividend is an Excluded Dividend, where an employee actually worked, whether an
 * asset sits in the jurisdiction claiming it. X-Ray detects those blind spots,
 * converts each into a routed confirmation with required evidence, prices the
 * answer against the live calculation, and refuses final approval while material
 * items stay unproven.
 */

export type XrayEngineId =
  | "dividend"
  | "payroll"
  | "asset"
  | "boi"
  | "deferred"
  | "covered"
  | "entity"
  | "election";

/** Calculation area a finding puts at risk — drives the confidence table. */
export type XrayArea =
  | "GloBE income"
  | "Covered taxes"
  | "Deferred tax"
  | "Payroll SBIE"
  | "Tangible asset SBIE"
  | "Incentives"
  | "Entity & ownership"
  | "Elections";

export const XRAY_AREAS: XrayArea[] = [
  "GloBE income",
  "Covered taxes",
  "Deferred tax",
  "Payroll SBIE",
  "Tangible asset SBIE",
  "Incentives",
  "Entity & ownership",
  "Elections",
];

/** Material items hard-stop the close. Significant and observation do not. */
export type XraySeverity = "material" | "significant" | "observation";

/** Department the confirmation is routed to. */
export type XrayDept =
  | "Finance"
  | "Tax"
  | "HR"
  | "Legal"
  | "Treasury"
  | "Fixed assets"
  | "BOI / project"
  | "Local subsidiary";

export const EVIDENCE_KINDS = [
  "Share register",
  "Dividend voucher",
  "Investment ledger",
  "Employment records",
  "Secondment agreement",
  "Payroll report",
  "Work-location / travel data",
  "Fixed-asset register",
  "Lease agreement",
  "BOI certificate",
  "Tax return",
  "Tax-provision workpaper",
  "Deferred-tax schedule",
  "Corporate structure document",
] as const;

export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export type XrayOption = { value: string; label: string };

export type XrayQuestion = {
  id: string;
  prompt: string;
  dept: XrayDept;
  options: XrayOption[];
  /** Conditional display — question only applies when the parent answer matches. */
  dependsOn?: { questionId: string; value: string };
};

/**
 * Treatment and calculation effect of one answer to the finding's primary question.
 * Deltas are applied to the jurisdiction's live figures, so the priced impact moves
 * with the calculation rather than being a stored number.
 */
export type XrayBranch = {
  value: string;
  label: string;
  treatment: string;
  globeIncomeDelta: number;
  coveredTaxDelta: number;
  sbieDelta: number;
};

export type XrayFinding = {
  id: string;
  engine: XrayEngineId;
  area: XrayArea;
  severity: XraySeverity;
  title: string;
  /** What the detector saw in the source data. */
  detected: string;
  /** What the source data cannot prove. */
  missing: string;
  /** Amount affected — the balance or transaction under question. */
  amount: number;
  entityId: string;
  entityCode: string;
  entityName: string;
  iso: string;
  jurisdiction: string;
  account?: string;
  adjustmentId?: string;
  ruleId: string;
  article: string;
  owner: string;
  dept: XrayDept;
  sourceDoc: string;
  evidence: EvidenceKind[];
  questions: XrayQuestion[];
  branches: XrayBranch[];
  /** How the Revenue Department would frame the same gap in an audit. */
  rdChallenge: string;
  href: string;
};

export type XrayResponse = {
  answers: Record<string, string>;
  evidence: string[];
  preparer: string | null;
  reviewer: string | null;
  at: string;
};

export type XrayState = Record<string, XrayResponse>;

export type XrayStatus =
  | "unconfirmed"
  | "inconsistent"
  | "unsupported"
  | "awaiting-review"
  | "resolved";

export const STATUS_LABEL: Record<XrayStatus, string> = {
  unconfirmed: "Unconfirmed",
  inconsistent: "Partly answered",
  unsupported: "Evidence missing",
  "awaiting-review": "Awaiting reviewer",
  resolved: "Confirmed",
};

export const SEVERITY_LABEL: Record<XraySeverity, string> = {
  material: "Material",
  significant: "Significant",
  observation: "Observation",
};

export const ENGINE_META: Record<XrayEngineId, { name: string; blurb: string }> = {
  dividend: {
    name: "Dividend DNA",
    blurb: "Ownership percentage, economic holding period and instrument symmetry behind every excluded dividend.",
  },
  payroll: {
    name: "Payroll Eligibility & Location",
    blurb: "Employee versus contractor, jurisdiction of work, and the local-work percentage behind the payroll carve-out.",
  },
  asset: {
    name: "Tangible Asset Eligibility & Location",
    blurb: "Carrying-value bridge from the consolidated accounts, asset situs, and lease treatment.",
  },
  boi: {
    name: "BOI Privilege X-Ray",
    blurb: "Certificate components, cap base, rate calendar and whether a credit qualifies as a QRTC or MTTC.",
  },
  deferred: {
    name: "Deferred Tax X-Ray",
    blurb: "Composition by temporary difference, origination vintage and reversal profile for the five-year recapture test.",
  },
  covered: {
    name: "Covered Tax Classification",
    blurb: "Which taxes qualify, where they are allocated, and whether tax follows income out of the calculation.",
  },
  entity: {
    name: "Entity & Ownership Classification",
    blurb: "Constituent entity status, permanent establishments, transparency and the jurisdiction that owns the result.",
  },
  election: {
    name: "Election & Historical Attribute Check",
    blurb: "Election authority and filing evidence, plus the prior-year attributes carried into this Fiscal Year.",
  },
};

export function emptyResponse(): XrayResponse {
  return { answers: {}, evidence: [], preparer: null, reviewer: null, at: "" };
}

/**
 * Conditional question set. A question with `dependsOn` only applies while its
 * parent answer matches, so confirming "this is not a dividend" retires the
 * remaining dividend questions instead of asking them anyway.
 */
export function activeQuestions(f: XrayFinding, answers: Record<string, string>): XrayQuestion[] {
  return f.questions.filter((q) => {
    if (!q.dependsOn) return true;
    return answers[q.dependsOn.questionId] === q.dependsOn.value;
  });
}

export function primaryQuestion(f: XrayFinding): XrayQuestion | undefined {
  return f.questions[0];
}

/** Branch selected by the answer to the primary question, if any. */
export function selectedBranch(f: XrayFinding, answers: Record<string, string>): XrayBranch | null {
  const q = primaryQuestion(f);
  if (!q) return null;
  const v = answers[q.id];
  if (!v) return null;
  return f.branches.find((b) => b.value === v) ?? null;
}

export function findingStatus(f: XrayFinding, r: XrayResponse | undefined): XrayStatus {
  if (!r) return "unconfirmed";
  const active = activeQuestions(f, r.answers);
  const answered = active.filter((q) => r.answers[q.id]);
  if (!answered.length) return "unconfirmed";
  if (answered.length < active.length) return "inconsistent";
  const missing = f.evidence.filter((e) => !r.evidence.includes(e));
  if (missing.length) return "unsupported";
  if (!r.preparer || !r.reviewer) return "awaiting-review";
  return "resolved";
}

export function missingEvidence(f: XrayFinding, r: XrayResponse | undefined): EvidenceKind[] {
  return f.evidence.filter((e) => !r?.evidence.includes(e));
}

export function isResolved(f: XrayFinding, state: XrayState): boolean {
  return findingStatus(f, state[f.id]) === "resolved";
}

// ---------------------------------------------------------------------------
// Live impact engine
// ---------------------------------------------------------------------------

export type BranchImpact = {
  globeIncome: number;
  coveredTax: number;
  sbie: number;
  etr: number;
  topUpRate: number;
  topUp: number;
  etrDelta: number;
  topUpDelta: number;
  globeIncomeDelta: number;
};

/**
 * Reprice one answer against the jurisdiction's live figures using the same
 * Art. 5.1/5.2 chain as the engine, so the number a preparer sees when deciding
 * whether to chase a confirmation is the number the close would actually move by.
 */
export function branchImpact(calc: JurCalc, b: XrayBranch): BranchImpact {
  const globeIncome = money(calc.globeIncome + b.globeIncomeDelta);
  const coveredTax = money(calc.coveredTax + b.coveredTaxDelta);
  const sbie = money(Math.max(0, calc.sbie + b.sbieDelta));
  const etr = globeIncome > 0 ? coveredTax / globeIncome : 0;
  const topUpRate = globeIncome > 0 ? Math.max(0, MIN_RATE - Math.max(0, etr)) : 0;
  const excess = money(Math.max(0, globeIncome - sbie));
  const topUp = money(topUpRate * excess + calc.additionalCurrentTopUp);
  return {
    globeIncome,
    coveredTax,
    sbie,
    etr,
    topUpRate,
    topUp,
    etrDelta: etr - calc.etr,
    topUpDelta: money(topUp - calc.jurisdictionalTopUp),
    globeIncomeDelta: b.globeIncomeDelta,
  };
}

/**
 * Widest top-up swing across the finding's branches — the amount of top-up tax
 * that genuinely depends on the answer, and the number used to prioritise work.
 */
export function amountAtRisk(f: XrayFinding, calcs: JurCalc[]): number {
  const calc = calcFor(f, calcs);
  if (!calc) return 0;
  const tops = f.branches.map((b) => branchImpact(calc, b).topUp);
  if (!tops.length) return 0;
  return money(Math.max(...tops) - Math.min(...tops));
}

export function calcFor(f: XrayFinding, calcs: JurCalc[]): JurCalc | undefined {
  return (
    calcs.find((c) => c.entities.some((e) => e.id === f.entityId))
    ?? calcs.find((c) => c.iso === f.iso && c.blendKind === "main")
    ?? calcs.find((c) => c.iso === f.iso)
  );
}

/** Top-up currently exposed by unresolved findings. */
export function openExposure(findings: XrayFinding[], state: XrayState, calcs: JurCalc[]): number {
  return money(
    findings
      .filter((f) => !isResolved(f, state))
      .reduce((a, f) => a + amountAtRisk(f, calcs), 0),
  );
}

// ---------------------------------------------------------------------------
// Calculation confidence
// ---------------------------------------------------------------------------

const SEVERITY_WEIGHT: Record<XraySeverity, number> = {
  material: 14,
  significant: 7,
  observation: 2,
};

/** Progress through the confirmation workflow reduces the penalty it carries. */
const STATUS_FACTOR: Record<XrayStatus, number> = {
  unconfirmed: 1,
  inconsistent: 0.75,
  unsupported: 0.5,
  "awaiting-review": 0.25,
  resolved: 0,
};

export type ConfidenceRow = {
  key: string;
  label: string;
  score: number;
  open: number;
  total: number;
  atRisk: number;
  findings: XrayFinding[];
};

function penaltyFor(f: XrayFinding, state: XrayState, calcs: JurCalc[], base: number): number {
  const factor = STATUS_FACTOR[findingStatus(f, state[f.id])];
  if (!factor) return 0;
  const risk = amountAtRisk(f, calcs);
  const materiality = base > 0 ? Math.min(1, Math.max(risk, f.amount) / base) : 1;
  return SEVERITY_WEIGHT[f.severity] * (0.5 + 0.5 * materiality) * factor;
}

/**
 * Score one bucket of findings out of 100. Deterministic: severity weight, scaled
 * by the finding's materiality against the bucket's own magnitude, discounted by
 * how far the confirmation has progressed.
 */
export function scoreBucket(
  findings: XrayFinding[],
  state: XrayState,
  calcs: JurCalc[],
  base: number,
): ConfidenceRow["score"] {
  const penalty = findings.reduce((a, f) => a + penaltyFor(f, state, calcs, base), 0);
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

export function groupConfidence(
  findings: XrayFinding[],
  state: XrayState,
  calcs: JurCalc[],
  keyFn: (f: XrayFinding) => string,
  labelFn: (f: XrayFinding) => string,
  baseFn?: (rows: XrayFinding[]) => number,
): ConfidenceRow[] {
  const keys: string[] = [];
  const byKey = new Map<string, XrayFinding[]>();
  for (const f of findings) {
    const k = keyFn(f);
    if (!byKey.has(k)) {
      byKey.set(k, []);
      keys.push(k);
    }
    byKey.get(k)!.push(f);
  }
  return keys.map((k) => {
    const rows = byKey.get(k)!;
    const base = baseFn ? baseFn(rows) : rows.reduce((a, f) => a + Math.abs(f.amount), 0);
    return {
      key: k,
      label: labelFn(rows[0]),
      score: scoreBucket(rows, state, calcs, base),
      open: rows.filter((f) => !isResolved(f, state)).length,
      total: rows.length,
      atRisk: money(rows.filter((f) => !isResolved(f, state)).reduce((a, f) => a + amountAtRisk(f, calcs), 0)),
      findings: rows,
    };
  });
}

/** Confidence by calculation area, in the canonical area order. */
export function confidenceByArea(
  findings: XrayFinding[],
  state: XrayState,
  calcs: JurCalc[],
): ConfidenceRow[] {
  const rows = groupConfidence(findings, state, calcs, (f) => f.area, (f) => f.area, areaBase(calcs));
  return XRAY_AREAS.filter((a) => rows.some((r) => r.key === a)).map((a) => rows.find((r) => r.key === a)!);
}

/**
 * Magnitude of each area on the live calculation, so a $1.8m question against
 * $44m of GloBE income does not score the same as against $180k.
 */
function areaBase(calcs: JurCalc[]): (rows: XrayFinding[]) => number {
  const abs = (n: number) => Math.abs(n);
  const totals = {
    globe: calcs.reduce((a, c) => a + abs(c.globeIncome), 0),
    covered: calcs.reduce((a, c) => a + abs(c.coveredTax), 0),
    payroll: calcs.reduce((a, c) => a + abs(c.payrollCarve), 0),
    asset: calcs.reduce((a, c) => a + abs(c.assetCarve), 0),
    topUp: calcs.reduce((a, c) => a + abs(c.jurisdictionalTopUp), 0),
  };
  return (rows) => {
    switch (rows[0]?.area) {
      case "GloBE income":
        return totals.globe;
      case "Covered taxes":
      case "Deferred tax":
        return totals.covered;
      case "Payroll SBIE":
        return totals.payroll;
      case "Tangible asset SBIE":
        return totals.asset;
      default:
        return Math.max(totals.topUp, rows.reduce((a, f) => a + Math.abs(f.amount), 0));
    }
  };
}

export function confidenceByJurisdiction(findings: XrayFinding[], state: XrayState, calcs: JurCalc[]) {
  return groupConfidence(findings, state, calcs, (f) => f.iso, (f) => f.jurisdiction);
}

export function confidenceByEntity(findings: XrayFinding[], state: XrayState, calcs: JurCalc[]) {
  return groupConfidence(findings, state, calcs, (f) => f.entityId, (f) => `${f.entityCode} · ${f.entityName}`);
}

export function confidenceByEngine(findings: XrayFinding[], state: XrayState, calcs: JurCalc[]) {
  return groupConfidence(findings, state, calcs, (f) => f.engine, (f) => ENGINE_META[f.engine].name);
}

export function confidenceByAdjustment(findings: XrayFinding[], state: XrayState, calcs: JurCalc[]) {
  const tagged = findings.filter((f) => f.adjustmentId || f.account);
  return groupConfidence(
    tagged,
    state,
    calcs,
    (f) => f.adjustmentId ?? `acct-${f.account}`,
    (f) => f.adjustmentId ?? `Account ${f.account}`,
  );
}

/**
 * Overall confidence in the final calculation. Weighted by each area's magnitude
 * so an unproven $4.2m dividend matters more than an unproven $90k asset base.
 */
export function overallConfidence(rows: ConfidenceRow[]): number {
  if (!rows.length) return 100;
  const weights = rows.map((r) => Math.max(1, r.findings.reduce((a, f) => a + Math.abs(f.amount), 0)));
  const total = weights.reduce((a, b) => a + b, 0);
  const weighted = rows.reduce((a, r, i) => a + r.score * weights[i], 0);
  return Math.round(weighted / total);
}

// ---------------------------------------------------------------------------
// Hard-stop control
// ---------------------------------------------------------------------------

export type HardStopReason = {
  findingId: string;
  title: string;
  jurisdiction: string;
  status: XrayStatus;
  reason: string;
  atRisk: number;
};

export type HardStop = {
  blocked: boolean;
  material: number;
  open: number;
  exposure: number;
  reasons: HardStopReason[];
  label: string;
};

function reasonText(status: XrayStatus): string {
  switch (status) {
    case "unconfirmed":
      return "Unconfirmed — no response from the responsible team";
    case "inconsistent":
      return "Inconsistently classified — conditional questions part-answered";
    case "unsupported":
      return "Unsupported — required evidence not attached";
    case "awaiting-review":
      return "Missing reviewer approval";
    default:
      return "";
  }
}

/**
 * Final approval is refused while any material finding is unconfirmed,
 * unsupported, inconsistently classified or missing reviewer approval. A
 * provisional calculation still runs, but it must be labelled as preliminary.
 */
export function hardStop(findings: XrayFinding[], state: XrayState, calcs: JurCalc[]): HardStop {
  const material = findings.filter((f) => f.severity === "material");
  const reasons: HardStopReason[] = material
    .map((f) => ({ f, status: findingStatus(f, state[f.id]) }))
    .filter((r) => r.status !== "resolved")
    .map(({ f, status }) => ({
      findingId: f.id,
      title: f.title,
      jurisdiction: f.jurisdiction,
      status,
      reason: reasonText(status),
      atRisk: amountAtRisk(f, calcs),
    }));
  const open = findings.filter((f) => !isResolved(f, state)).length;
  const n = reasons.length;
  return {
    blocked: n > 0,
    material: material.length,
    open,
    exposure: openExposure(findings, state, calcs),
    reasons,
    label: n
      ? `Preliminary calculation — contains ${n} unresolved material assumption${n === 1 ? "" : "s"}.`
      : "Calculation assurance complete — all material items confirmed, supported and reviewed.",
  };
}

// ---------------------------------------------------------------------------
// RD Audit mode
// ---------------------------------------------------------------------------

export type XrayMode = "corporate" | "rd";

export const MODE_META: Record<XrayMode, { name: string; question: string; blurb: string }> = {
  corporate: {
    name: "Corporate / Advisory",
    question: "What must we confirm?",
    blurb: "Prevention. Find the missing facts, route them to the responsible team, validate the evidence and prepare an audit-ready package.",
  },
  rd: {
    name: "RD Audit",
    question: "What did the taxpayer fail to prove?",
    blurb: "Detection. Identify figures resting on the trial balance alone, test the carve-outs and incentive treatment, and generate the audit questions.",
  },
};

export type AuditQuestion = {
  findingId: string;
  jurisdiction: string;
  entity: string;
  article: string;
  question: string;
  proof: string;
  atRisk: number;
  proven: boolean;
};

/** Audit challenges generated from the same detections, framed from the RD side. */
export function auditQuestions(findings: XrayFinding[], state: XrayState, calcs: JurCalc[]): AuditQuestion[] {
  return findings
    .map((f) => ({
      findingId: f.id,
      jurisdiction: f.jurisdiction,
      entity: `${f.entityCode} · ${f.entityName}`,
      article: f.article,
      question: f.rdChallenge,
      proof: f.evidence.join(", "),
      atRisk: amountAtRisk(f, calcs),
      proven: isResolved(f, state),
    }))
    .sort((a, b) => Number(a.proven) - Number(b.proven) || b.atRisk - a.atRisk);
}

/** Audit risk score — the inverse of calculation confidence. */
export function rdRiskScore(rows: ConfidenceRow[]): number {
  return 100 - overallConfidence(rows);
}

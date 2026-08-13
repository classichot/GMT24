import { ENTITIES, FINANCIALS, JURISDICTION_PACKS, RULES } from "./model";
import { money } from "./format";

export const DT_FY = 2026;
export const DT_HORIZON = [2026, 2027, 2028, 2029, 2030, 2031] as const;
export const MIN_RATE = Number(RULES.find((r) => r.id === "OECD-GloBE-15")!.parameters.minimumRate);

/** Domestic CIT used to recast accounting deferred tax into GloBE amounts. */
export const CIT_RATE: Record<string, number> = {
  JP: 0.3062,
  SG: 0.17,
  TH: 0.2,
  VN: 0.2,
  MY: 0.24,
  ID: 0.22,
  AE: 0.09,
  GB: 0.25,
  DE: 0.298,
  FR: 0.258,
  NL: 0.258,
  HU: 0.09,
  US: 0.21,
  IE: 0.125,
};

export type RecaptureExceptionCode =
  | "4.4.5(a)"
  | "4.4.5(b)"
  | "4.4.5(c)"
  | "4.4.5(d)"
  | "4.4.5(e)"
  | "4.4.5(f)"
  | "4.4.5(g)"
  | "4.4.5(h)"
  | "4.4.5(i)";

export const EXCEPTION_LABEL: Record<RecaptureExceptionCode, string> = {
  "4.4.5(a)": "Cost recovery on tangible assets",
  "4.4.5(b)": "Government licence / natural-resource right",
  "4.4.5(c)": "Research and development expenses",
  "4.4.5(d)": "Decommissioning and remediation",
  "4.4.5(e)": "Fair-value accounting on unrealised net gains",
  "4.4.5(f)": "Foreign-currency exchange net gains",
  "4.4.5(g)": "Insurance reserves / deferred acquisition costs",
  "4.4.5(h)": "Reinvested gains on in-jurisdiction tangible property",
  "4.4.5(i)": "Accounting-principle change on an excepted item",
};

export type DtSide = "DTA" | "DTL";

export type DtPosition = {
  id: string;
  entityId: string;
  iso: string;
  type: string;
  side: DtSide;
  opening: number;
  addition: number;
  reversal: number;
  accountingRate: number;
  originYear: number;
  expectedReversalYear: number | null;
  exception: RecaptureExceptionCode | null;
  globeRelevant: boolean;
  deemed?: boolean;
  deemedGlobe?: number;
  excludedReason?: string;
  evidence: string;
};

export type DtView = DtPosition & {
  closing: number;
  globeRate: number;
  globeOpening: number;
  globeAddition: number;
  globeReversal: number;
  globeClosing: number;
  recastHaircut: number;
  tempDiff: number;
  pnl: number;
  deadlineYear: number | null;
  recaptureException: boolean;
  treatment: string;
};

export type RecaptureStatus = "exception" | "dta" | "reversed" | "outstanding" | "approaching" | "recapture";

export type TimeMachineYear = {
  year: number;
  reversed: number;
  exception: number;
  outstanding: number;
  approaching: number;
  recapture: number;
};

function globeRate(accountingRate: number) {
  if (accountingRate <= 0) return 0;
  return Math.min(accountingRate, MIN_RATE);
}

export function recastAmount(accounting: number, accountingRate: number) {
  if (accountingRate <= 0) return 0;
  return money(accounting * (globeRate(accountingRate) / accountingRate));
}

function closingOf(p: DtPosition) {
  return money(p.opening + p.addition - p.reversal);
}

export function enrich(p: DtPosition): DtView {
  const closing = closingOf(p);
  const rate = p.accountingRate;
  const gOpen = recastAmount(p.opening, rate);
  const gAdd = recastAmount(p.addition, rate);
  const gRev = recastAmount(p.reversal, rate);
  const gClose = recastAmount(closing, rate);
  const net = money(gAdd - gRev);
  const pnl = !p.globeRelevant || p.deemed ? 0 : p.side === "DTL" ? net : money(-net);
  const recaptureException = p.side === "DTL" && p.exception !== null;
  const deadlineYear = p.side === "DTL" && p.globeRelevant && !recaptureException ? p.originYear + 5 : null;
  const tempDiff = rate > 0 ? money(closing / rate) : 0;
  let treatment = "Monitored DTL — Art. 4.4.4 clock";
  if (!p.globeRelevant && p.deemed) treatment = "Deemed GloBE DTA — held";
  else if (!p.globeRelevant) treatment = "Art. 4.4 exclusion";
  else if (p.side === "DTA") treatment = "DTA — loss / timing alignment";
  else if (recaptureException) treatment = `Recapture Exception ${p.exception}`;
  return {
    ...p,
    closing,
    globeRate: globeRate(rate),
    globeOpening: gOpen,
    globeAddition: gAdd,
    globeReversal: gRev,
    globeClosing: gClose,
    recastHaircut: money(closing - gClose),
    tempDiff,
    pnl,
    deadlineYear,
    recaptureException,
    treatment,
  };
}

export function statusAt(p: DtView, asOfYear = DT_FY): RecaptureStatus {
  if (p.side === "DTA") return "dta";
  if (!p.globeRelevant) return "reversed";
  const remaining = remainingAt(p, asOfYear);
  if (remaining <= 0) return "reversed";
  if (p.recaptureException || p.exception) return "exception";
  if (p.deadlineYear !== null && asOfYear >= p.deadlineYear) return "recapture";
  if (p.deadlineYear !== null && asOfYear + 1 >= p.deadlineYear) return "approaching";
  return "outstanding";
}

/** GloBE DTL still outstanding at the end of `asOfYear`, after expected reversals. */
export function remainingAt(p: DtView, asOfYear: number) {
  if (p.side !== "DTL" || !p.globeRelevant) return 0;
  if (p.expectedReversalYear !== null && p.expectedReversalYear <= asOfYear) return 0;
  if (asOfYear < DT_FY) return p.globeOpening;
  return p.globeClosing;
}

function pos(
  partial: Omit<DtPosition, "accountingRate" | "globeRelevant" | "evidence"> & {
    accountingRate?: number;
    globeRelevant?: boolean;
    evidence?: string;
  },
): DtPosition {
  const rate = partial.accountingRate ?? CIT_RATE[partial.iso] ?? MIN_RATE;
  return {
    globeRelevant: true,
    evidence: `${partial.entityId} tax provision / deferred-tax roll-forward FY${DT_FY}`,
    accountingRate: rate,
    ...partial,
  };
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TH_TEMPLATES: { type: string; side: DtSide; exception: RecaptureExceptionCode | null; originBias: number }[] = [
  { type: "Plant & machinery — accelerated tax depreciation", side: "DTL", exception: "4.4.5(a)", originBias: 2024 },
  { type: "Buildings — tax vs accounting depreciation", side: "DTL", exception: "4.4.5(a)", originBias: 2023 },
  { type: "Moulds & tools — cost recovery", side: "DTL", exception: "4.4.5(a)", originBias: 2025 },
  { type: "R&D expenditure — tax super-deduction timing", side: "DTL", exception: "4.4.5(c)", originBias: 2026 },
  { type: "Warranty provision", side: "DTA", exception: null, originBias: 2026 },
  { type: "Employee benefit accrual", side: "DTA", exception: null, originBias: 2025 },
  { type: "Inventory NRV / other provision", side: "DTA", exception: null, originBias: 2026 },
  { type: "Revenue recognition timing", side: "DTL", exception: null, originBias: 2026 },
  { type: "Accrued expenses not yet deductible", side: "DTA", exception: null, originBias: 2026 },
  { type: "Unrealised fair-value gain on derivatives", side: "DTL", exception: "4.4.5(e)", originBias: 2026 },
  { type: "FX on intra-group THB/EUR funding", side: "DTL", exception: "4.4.5(f)", originBias: 2026 },
  { type: "Site remediation obligation — Rayong", side: "DTL", exception: "4.4.5(d)", originBias: 2024 },
];

function buildThailand(): DtPosition[] {
  const out: DtPosition[] = [
    pos({
      id: "DTL-92381",
      entityId: "TH-CE",
      iso: "TH",
      type: "Fixed asset depreciation — plant & machinery",
      side: "DTL",
      opening: 80_000,
      addition: 240_000,
      reversal: 40_000,
      originYear: 2024,
      expectedReversalYear: 2032,
      exception: "4.4.5(a)",
      evidence: "Fixed_asset_register_TH.xlsx · TH tax provision FY2026.xlsx",
    }),
    pos({
      id: "DTL-92382",
      entityId: "TH-CE",
      iso: "TH",
      type: "Other temporary difference — non-excepted",
      side: "DTL",
      opening: 160_000,
      addition: 48_000,
      reversal: 28_000,
      originYear: 2026,
      expectedReversalYear: 2032,
      exception: null,
      evidence: "TH tax provision FY2026.xlsx",
    }),
    pos({
      id: "DTL-92201",
      entityId: "TH-CE",
      iso: "TH",
      type: "Other temporary difference — origin FY2022",
      side: "DTL",
      opening: 640_000,
      addition: 0,
      reversal: 80_000,
      originYear: 2022,
      expectedReversalYear: null,
      exception: null,
      evidence: "Deferred_tax_rollforward.xlsx · prior GIR FY2025.xml",
    }),
    pos({
      id: "DTA-TH-LOSS",
      entityId: "TH-CE",
      iso: "TH",
      type: "Tax loss carry-forward",
      side: "DTA",
      opening: 800_000,
      addition: 0,
      reversal: 320_000,
      originYear: 2024,
      expectedReversalYear: 2028,
      exception: null,
      evidence: "TH tax provision FY2026.xlsx · CIT loss memorandum",
    }),
    pos({
      id: "DTA-TH-PROV",
      entityId: "TH-CE",
      iso: "TH",
      type: "Warranty and legal provisions",
      side: "DTA",
      opening: 320_000,
      addition: 60_000,
      reversal: 40_000,
      originYear: 2025,
      expectedReversalYear: 2028,
      exception: null,
      evidence: "TH tax provision FY2026.xlsx",
    }),
    pos({
      id: "DTL-TH-RD",
      entityId: "TH-CE",
      iso: "TH",
      type: "R&D expenditure",
      side: "DTL",
      opening: 20_000,
      addition: 120_000,
      reversal: 16_000,
      originYear: 2026,
      expectedReversalYear: 2030,
      exception: "4.4.5(c)",
      evidence: "TH tax provision FY2026.xlsx · R&D project register",
    }),
    pos({
      id: "DTL-TH-DECOM",
      entityId: "TH-CE",
      iso: "TH",
      type: "Decommissioning / remediation — Rayong",
      side: "DTL",
      opening: 40_000,
      addition: 36_000,
      reversal: 4_000,
      originYear: 2024,
      expectedReversalYear: 2035,
      exception: "4.4.5(d)",
      evidence: "TH tax provision FY2026.xlsx",
    }),
    pos({
      id: "DTL-TH-FV",
      entityId: "TH-CE",
      iso: "TH",
      type: "Fair-value accounting — unrealised net gains",
      side: "DTL",
      opening: 0,
      addition: 52_000,
      reversal: 0,
      originYear: 2026,
      expectedReversalYear: 2028,
      exception: "4.4.5(e)",
      evidence: "TH001 Trial Balance FY2026.xlsx",
    }),
    pos({
      id: "DTL-TH-REV",
      entityId: "TH-CE",
      iso: "TH",
      type: "Revenue recognition timing",
      side: "DTL",
      opening: 0,
      addition: 80_000,
      reversal: 12_000,
      originYear: 2026,
      expectedReversalYear: 2027,
      exception: null,
      evidence: "TH tax provision FY2026.xlsx",
    }),
    pos({
      id: "DTL-TH-EXCL-DIV",
      entityId: "TH-CE",
      iso: "TH",
      type: "Deferred tax on excluded dividends",
      side: "DTL",
      opening: 0,
      addition: 48_000,
      reversal: 0,
      originYear: 2026,
      expectedReversalYear: null,
      exception: null,
      globeRelevant: false,
      excludedReason: "Art. 4.4.1 — deferred tax attributable to excluded GloBE income (Art. 3.2.1(b) dividends) is stripped from the Total Deferred Tax Adjustment Amount.",
      evidence: "TH001 Trial Balance FY2026.xlsx · account 810020",
    }),
    pos({
      id: "DTL-TH-PE-PPE",
      entityId: "TH-PE",
      iso: "TH",
      type: "Rayong PE — tangible asset cost recovery",
      side: "DTL",
      opening: 0,
      addition: 14_000,
      reversal: 0,
      originYear: 2026,
      expectedReversalYear: 2033,
      exception: "4.4.5(a)",
      evidence: "Fixed_asset_register_TH.xlsx",
    }),
    pos({
      id: "DTA-TH-PE-ACC",
      entityId: "TH-PE",
      iso: "TH",
      type: "Rayong PE — accrued expenses",
      side: "DTA",
      opening: 0,
      addition: 5_333,
      reversal: 0,
      originYear: 2026,
      expectedReversalYear: 2027,
      exception: null,
      evidence: "TH tax provision FY2026.xlsx",
    }),
  ];

  const rand = rng(20260814);
  const need = 147 - out.length - 2;
  for (let i = 0; i < need; i++) {
    const t = TH_TEMPLATES[i % TH_TEMPLATES.length];
    const entityId = i % 17 === 0 ? "TH-PE" : "TH-CE";
    const add = money(4_000 + rand() * 18_000);
    const rev = money(rand() * add * 0.35);
    const open = t.side === "DTL" && t.exception ? money(rand() * 6_000) : 0;
    out.push(
      pos({
        id: `DT-TH-${String(92400 + i)}`,
        entityId,
        iso: "TH",
        type: t.type,
        side: t.side,
        opening: open,
        addition: add,
        reversal: rev,
        originYear: t.originBias,
        expectedReversalYear: t.exception ? 2032 + (i % 4) : 2027 + (i % 5),
        exception: t.exception,
        evidence: t.exception === "4.4.5(a)" ? "Fixed_asset_register_TH.xlsx" : "TH tax provision FY2026.xlsx",
      }),
    );
  }
  return out;
}

function buildOther(): DtPosition[] {
  return [
    pos({
      id: "DTL-JP-PPE",
      entityId: "JP-UPE",
      iso: "JP",
      type: "Tangible asset cost recovery",
      side: "DTL",
      opening: 4_200_000,
      addition: 1_860_000,
      reversal: 420_000,
      originYear: 2024,
      expectedReversalYear: 2034,
      exception: "4.4.5(a)",
    }),
    pos({
      id: "DTA-JP-LOSS",
      entityId: "JP-UPE",
      iso: "JP",
      type: "Tax loss / credit carry-forward",
      side: "DTA",
      opening: 4_200_000,
      addition: 0,
      reversal: 1_100_000,
      originYear: 2023,
      expectedReversalYear: 2029,
      exception: null,
    }),
    pos({
      id: "DTL-JP-OTHER",
      entityId: "JP-UPE",
      iso: "JP",
      type: "Other temporary difference",
      side: "DTL",
      opening: 1_900_000,
      addition: 280_000,
      reversal: 190_000,
      originYear: 2025,
      expectedReversalYear: 2030,
      exception: null,
    }),
    pos({
      id: "DTL-IE-PPE",
      entityId: "IE-CE",
      iso: "IE",
      type: "Tangible asset cost recovery",
      side: "DTL",
      opening: 1_200_000,
      addition: 640_000,
      reversal: 80_000,
      originYear: 2024,
      expectedReversalYear: 2033,
      exception: "4.4.5(a)",
    }),
    pos({
      id: "DTL-IE-IP",
      entityId: "IE-CE",
      iso: "IE",
      type: "KDB / IP-related timing (monitored)",
      side: "DTL",
      opening: 640_000,
      addition: 220_000,
      reversal: 40_000,
      originYear: 2025,
      expectedReversalYear: 2031,
      exception: null,
      evidence: "IE_KDB_election.pdf · IE001 tax provision FY2026.xlsx",
    }),
    pos({
      id: "DTA-IE-SBC",
      entityId: "IE-CE",
      iso: "IE",
      type: "Share-based payment timing",
      side: "DTA",
      opening: 210_000,
      addition: 40_000,
      reversal: 90_000,
      originYear: 2025,
      expectedReversalYear: 2028,
      exception: null,
    }),
    pos({
      id: "DTL-VN-PPE",
      entityId: "VN-CE",
      iso: "VN",
      type: "Tangible asset cost recovery",
      side: "DTL",
      opening: 310_000,
      addition: 480_000,
      reversal: 40_000,
      originYear: 2025,
      expectedReversalYear: 2033,
      exception: "4.4.5(a)",
    }),
    pos({
      id: "DTA-VN-DEEMED",
      entityId: "VN-CE",
      iso: "VN",
      type: "Tax loss carry-forward — deemed GloBE DTA",
      side: "DTA",
      opening: 0,
      addition: 0,
      reversal: 0,
      originYear: 2025,
      expectedReversalYear: 2030,
      exception: null,
      deemed: true,
      deemedGlobe: 210_000,
      globeRelevant: false,
      excludedReason: "Accounting DTA not recognised; opening balance missing (IQ-01). Deemed GloBE DTA cannot be posted until the loss memorandum is in evidence.",
      evidence: "Data request — Local Tax VN",
    }),
    pos({
      id: "DTL-DE-PPE",
      entityId: "DE-CE",
      iso: "DE",
      type: "Tangible asset cost recovery",
      side: "DTL",
      opening: 3_100_000,
      addition: 980_000,
      reversal: 210_000,
      originYear: 2024,
      expectedReversalYear: 2034,
      exception: "4.4.5(a)",
    }),
    pos({
      id: "DTA-DE-PENS",
      entityId: "DE-CE",
      iso: "DE",
      type: "Pension / other provisions",
      side: "DTA",
      opening: 2_400_000,
      addition: 180_000,
      reversal: 320_000,
      originYear: 2023,
      expectedReversalYear: 2031,
      exception: null,
    }),
  ];
}

function plugToTarget(rows: DtPosition[], entityId: string, target: number): DtPosition[] {
  const entityRows = rows.filter((r) => r.entityId === entityId);
  const current = entityRows.reduce((a, r) => a + enrich(r).pnl, 0);
  const gap = money(target - current);
  if (gap === 0) return rows;
  const iso = ENTITIES.find((e) => e.id === entityId)?.iso ?? "TH";
  const rate = CIT_RATE[iso] ?? MIN_RATE;
  const accounting = money(Math.abs(gap) / (globeRate(rate) / rate || 1));
  const asDtl = gap > 0;
  rows.push(
    pos({
      id: `DT-PLUG-${entityId}`,
      entityId,
      iso,
      type: asDtl ? "Other temporary difference — provision plug" : "Valuation / other DTA movement",
      side: asDtl ? "DTL" : "DTA",
      opening: 0,
      addition: accounting,
      reversal: 0,
      originYear: DT_FY,
      expectedReversalYear: DT_FY + 2,
      exception: null,
      evidence: "Deferred_tax_rollforward.xlsx — residual to FANIL deferred tax",
    }),
  );
  return rows;
}

let CACHE: DtPosition[] | null = null;

export function deferredTaxRegister(): DtPosition[] {
  if (CACHE) return CACHE;
  let rows = [...buildThailand(), ...buildOther()];
  const withLedger = new Set(rows.map((r) => r.entityId));
  for (const f of FINANCIALS) {
    if (withLedger.has(f.entityId)) {
      rows = plugToTarget(rows, f.entityId, f.deferredTax);
    }
  }
  CACHE = rows;
  return rows;
}

export function viewsForIso(iso: string): DtView[] {
  return deferredTaxRegister()
    .filter((r) => r.iso === iso)
    .map(enrich);
}

export function viewsForEntity(entityId: string): DtView[] {
  return deferredTaxRegister()
    .filter((r) => r.entityId === entityId)
    .map(enrich);
}

/** Article 4.4 Total Deferred Tax Adjustment Amount for an entity (FY movement, recast). */
export function deferredTaxAdjustment(entityId: string): number | null {
  const rows = viewsForEntity(entityId);
  if (rows.length === 0) return null;
  return money(rows.reduce((a, r) => a + r.pnl, 0));
}

export type DtJurisdiction = {
  iso: string;
  name: string;
  fx: string;
  citRate: number;
  globeRate: number;
  positions: DtView[];
  count: number;
  accountingClose: number;
  globeClose: number;
  haircut: number;
  pnl: number;
  exceptionClose: number;
  monitoredClose: number;
  approaching: number;
  recapture: number;
  dtaClose: number;
  dtlClose: number;
  deemedCount: number;
  excludedCount: number;
  dtaUtilised: number;
};

export function jurisdictionDt(iso: string): DtJurisdiction {
  const positions = viewsForIso(iso);
  const pack = JURISDICTION_PACKS.find((p) => p.iso === iso);
  const cit = CIT_RATE[iso] ?? MIN_RATE;
  const approaching = money(
    positions.filter((p) => statusAt(p) === "approaching").reduce((a, p) => a + remainingAt(p, DT_FY), 0),
  );
  const recapture = money(
    positions.filter((p) => statusAt(p) === "recapture").reduce((a, p) => a + remainingAt(p, DT_FY), 0),
  );
  const exceptionClose = money(positions.filter((p) => p.recaptureException).reduce((a, p) => a + p.globeClosing, 0));
  const monitoredClose = money(
    positions.filter((p) => p.side === "DTL" && !p.recaptureException && p.globeRelevant).reduce((a, p) => a + p.globeClosing, 0),
  );
  const globeClose = money(positions.reduce((a, p) => a + (p.side === "DTL" ? p.globeClosing : -p.globeClosing), 0));
  const accountingClose = money(positions.reduce((a, p) => a + (p.side === "DTL" ? p.closing : -p.closing), 0));
  return {
    iso,
    name: pack?.name ?? iso,
    fx: pack?.fx ?? "USD",
    citRate: cit,
    globeRate: globeRate(cit),
    positions,
    count: positions.length,
    accountingClose,
    globeClose,
    haircut: money(accountingClose - globeClose),
    pnl: money(positions.reduce((a, p) => a + p.pnl, 0)),
    exceptionClose,
    monitoredClose,
    approaching,
    recapture,
    dtaClose: money(positions.filter((p) => p.side === "DTA").reduce((a, p) => a + p.globeClosing, 0)),
    dtlClose: money(positions.filter((p) => p.side === "DTL").reduce((a, p) => a + p.globeClosing, 0)),
    deemedCount: positions.filter((p) => p.deemed).length,
    excludedCount: positions.filter((p) => !p.globeRelevant && !p.deemed).length,
    dtaUtilised: money(positions.filter((p) => p.side === "DTA").reduce((a, p) => a + p.globeReversal, 0)),
  };
}

export function timeMachine(iso: string): TimeMachineYear[] {
  const positions = viewsForIso(iso).filter((p) => p.side === "DTL" && p.globeRelevant);
  return DT_HORIZON.map((year) => {
    let reversed = 0;
    let exception = 0;
    let outstanding = 0;
    let approaching = 0;
    let recapture = 0;
    for (const p of positions) {
      const left = remainingAt(p, year);
      const reversedThisStock = money(p.globeClosing - left);
      const fyReversal = year === DT_FY ? p.globeReversal : 0;
      reversed += fyReversal + reversedThisStock;
      if (left <= 0) continue;
      const st = statusAt(p, year);
      if (st === "exception") exception += left;
      else if (st === "recapture") recapture += left;
      else if (st === "approaching") approaching += left;
      else outstanding += left;
    }
    return {
      year,
      reversed: money(reversed),
      exception: money(exception),
      outstanding: money(outstanding),
      approaching: money(approaching),
      recapture: money(recapture),
    };
  });
}

export function recaptureImpact(args: {
  coveredTax: number;
  globeIncome: number;
  sbie: number;
  currentTopUp: number;
  recaptureAmount: number;
}) {
  const newCovered = money(args.coveredTax - Math.max(0, args.recaptureAmount));
  const newEtr = args.globeIncome > 0 ? newCovered / args.globeIncome : 0;
  const newRate = Math.max(0, MIN_RATE - newEtr);
  const excess = money(Math.max(0, args.globeIncome - args.sbie));
  const newTopUp = money(newRate * excess);
  return {
    newCovered,
    newEtr,
    newTopUp,
    incremental: money(newTopUp - args.currentTopUp),
  };
}

/** Textbook Art. 4.4.1 recast — timing vs permanent undertaxation. Figures are a unit example, not USD. */
export const RECAST_LESSON = {
  globeIncome: 100,
  taxableIncome: 20,
  citRate: 0.2,
  currentTax: 4,
  tempDiff: 80,
  accountingDtl: 16,
  globeDtl: 12,
  currentOnlyEtr: 0.04,
  globeEtr: 0.16,
  topUpIfCurrentOnly: 0.11,
};

export type OriginSnapshot = {
  iso: string;
  fy: number;
  globeIncome: number;
  coveredTax: number;
  sbie: number;
  source: string;
};

export const ORIGIN_SNAPSHOTS: OriginSnapshot[] = [
  {
    iso: "TH",
    fy: 2022,
    globeIncome: 24_706_000,
    coveredTax: 3_805_000,
    sbie: 5_200_000,
    source: "Deferred_tax_rollforward.xlsx · reconstructed origin-year GloBE file",
  },
];

export type RecaptureClock = {
  originYear: number;
  deadlineYear: number;
  iso: string;
  credited: number;
  remaining: number;
  status: RecaptureStatus;
  positions: DtView[];
  snapshot: OriginSnapshot | null;
};

export function recaptureClocks(iso: string, asOfYear = DT_FY): RecaptureClock[] {
  const monitored = viewsForIso(iso).filter((p) => p.side === "DTL" && p.globeRelevant && !p.recaptureException);
  const byOrigin = new Map<number, DtView[]>();
  for (const p of monitored) {
    const list = byOrigin.get(p.originYear) ?? [];
    list.push(p);
    byOrigin.set(p.originYear, list);
  }
  return [...byOrigin.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([originYear, positions]) => {
      const deadlineYear = originYear + 5;
      const remaining = money(positions.reduce((a, p) => a + remainingAt(p, asOfYear), 0));
      const credited = money(positions.reduce((a, p) => a + p.globeOpening + p.globeAddition, 0));
      const worst: RecaptureStatus = positions.some((p) => statusAt(p, asOfYear) === "recapture")
        ? "recapture"
        : positions.some((p) => statusAt(p, asOfYear) === "approaching")
          ? "approaching"
          : remaining <= 0
            ? "reversed"
            : "outstanding";
      return {
        originYear,
        deadlineYear,
        iso,
        credited,
        remaining,
        status: worst,
        positions,
        snapshot: ORIGIN_SNAPSHOTS.find((s) => s.iso === iso && s.fy === originYear) ?? null,
      };
    })
    .filter((c) => c.remaining > 0 || c.status === "recapture" || c.status === "approaching");
}

export function originRecompute(clock: RecaptureClock) {
  const snap = clock.snapshot;
  if (!snap) return null;
  const beforeTopUp = money(Math.max(0, MIN_RATE - (snap.globeIncome > 0 ? snap.coveredTax / snap.globeIncome : 0)) * Math.max(0, snap.globeIncome - snap.sbie));
  return recaptureImpact({
    coveredTax: snap.coveredTax,
    globeIncome: snap.globeIncome,
    sbie: snap.sbie,
    currentTopUp: beforeTopUp,
    recaptureAmount: clock.remaining,
  });
}

export type DtaTrack = {
  id: string;
  entityId: string;
  type: string;
  deemed: boolean;
  blocked: boolean;
  originYear: number;
  expectedReversalYear: number | null;
  accounting: { opening: number; addition: number; reversal: number; closing: number };
  globe: { opening: number; addition: number; reversal: number; closing: number };
  deemedGlobe: number;
  steps: { year: number; label: string; globe: number }[];
};

export function dtaTracks(iso: string): DtaTrack[] {
  return viewsForIso(iso)
    .filter((p) => p.side === "DTA")
    .sort((a, b) => Number(b.deemed) - Number(a.deemed) || b.globeClosing - a.globeClosing)
    .map((p) => {
      const deemedGlobe = p.deemedGlobe ?? 0;
      const steps: DtaTrack["steps"] = [
        { year: p.originYear, label: p.deemed ? "Deemed GloBE DTA" : "Recognised", globe: p.deemed ? deemedGlobe : p.globeOpening || p.globeAddition },
      ];
      if (p.globeReversal) steps.push({ year: DT_FY, label: "Utilised against profits", globe: -p.globeReversal });
      if (p.globeClosing > 0 && !p.deemed) {
        steps.push({ year: p.expectedReversalYear ?? DT_FY + 2, label: "Remaining carry-forward", globe: p.globeClosing });
      }
      if (p.deemed) steps.push({ year: DT_FY, label: "Held — recognition criteria / missing evidence", globe: 0 });
      return {
        id: p.id,
        entityId: p.entityId,
        type: p.type,
        deemed: Boolean(p.deemed),
        blocked: Boolean(p.deemed || !p.globeRelevant),
        originYear: p.originYear,
        expectedReversalYear: p.expectedReversalYear,
        accounting: { opening: p.opening, addition: p.addition, reversal: p.reversal, closing: p.closing },
        globe: { opening: p.globeOpening, addition: p.globeAddition, reversal: p.globeReversal, closing: p.globeClosing },
        deemedGlobe,
        steps,
      };
    });
}

export type FlowStep = {
  n: string;
  title: string;
  body: string;
  amount?: number;
  href: string;
  refs: string[];
};

export function intelligenceFlow(dt: DtJurisdiction, coveredTax: number, globeIncome: number, topUp: number): FlowStep[] {
  return [
    { n: "01", title: "Tax provision / DTA-DTL register", body: "Positions from the deferred-tax roll-forward and FAR.", amount: dt.count, href: "/data", refs: ["Art. 4.4.1"] },
    { n: "02", title: "Identify temporary differences", body: "Permanent differences stay out. Temporary differences become DTA or DTL.", href: "/deferred-tax", refs: ["Art. 4.4"] },
    { n: "03", title: "Map accounting DTA / DTL", body: `Domestic CIT ${(dt.citRate * 100).toFixed(dt.citRate >= 0.2 ? 0 : 1)}% on the accounting close.`, amount: dt.accountingClose, href: "/mapping", refs: ["Art. 4.4.1"] },
    { n: "04", title: "GloBE-relevant?", body: `${dt.excludedCount} Art. 4.4 exclusions stripped. ${dt.deemedCount} deemed DTA held pending evidence.`, href: "/deferred-tax", refs: ["Art. 4.4.1"] },
    { n: "05", title: "Recast to 15%", body: dt.citRate > MIN_RATE ? "Haircut so a high CIT rate cannot inflate ETR." : "Applicable rate is at or below the Minimum Rate — no upward recast.", amount: dt.globeClose, href: "/deferred-tax", refs: ["Art. 4.4.1"] },
    { n: "06", title: "Article 4.4.5 exception?", body: "Excepted DTLs leave the five-year clock. The rest are monitored.", amount: dt.exceptionClose, href: "/deferred-tax", refs: ["Art. 4.4.5"] },
    { n: "07", title: "Total Deferred Tax Adjustment", body: "FY movement, recast, after exclusions.", amount: dt.pnl, href: "/covered-taxes", refs: ["Art. 4.4.1"] },
    { n: "08", title: "Adjusted Covered Taxes", body: "Current Covered Tax + Art. 4.4 deferred. Numerator of the ETR.", amount: coveredTax, href: "/covered-taxes", refs: ["Art. 4.1.1"] },
    { n: "09", title: "Jurisdictional ETR", body: "Covered Taxes ÷ GloBE income from the FANIL engine.", amount: globeIncome, href: "/etr", refs: ["Art. 5.1.1"] },
    { n: "10", title: "Top-up Tax", body: "If ETR < 15%, Top-up % × Excess Profit (after SBIE).", amount: topUp, href: "/top-up", refs: ["Art. 5.2"] },
    { n: "11", title: "Track future reversals", body: "Non-excepted DTLs stay on the five-year recapture clock.", amount: dt.approaching + dt.recapture, href: "/deferred-tax", refs: ["Art. 4.4.4"] },
  ];
}

export function dtJurisdictions() {
  const isos = [...new Set(deferredTaxRegister().map((r) => r.iso))];
  return isos.map(jurisdictionDt);
}

import type { JurCalc } from "./engine";
import { totals } from "./engine";
import { NO_ETR, etrPct, eur, money, pct } from "./format";
import { DATA } from "./model";

export type ReviewPhase = {
  id: string;
  n: string;
  title: string;
  body: string;
};

export const REVIEW_PHASES: ReviewPhase[] = [
  {
    id: "ingest",
    n: "01",
    title: "Ingest the close pack",
    body: "Drop sample CSVs or load the full FY2026 demo pack for the open group. Classification runs before mapping; the engine does not calculate until maps are approved.",
  },
  {
    id: "map",
    n: "02",
    title: "Approve AI mappings",
    body: "Account → financial category → GloBE rule → computed posting. Hold anything under 80% confidence. Approve the held FX account (830010) to see the Art. 3.2 delta post live.",
  },
  {
    id: "calc",
    n: "03",
    title: "Verify calculation anchors",
    body: "Compare live engine output to the anchor table below. Every amount is clickable — rule id, entity, account and source file are in the audit trail.",
  },
  {
    id: "trace",
    n: "04",
    title: "Trace logic and collection",
    body: "Walk Thailand BOI → low ETR → top-up → QDMTT. Check Art. 2.6 UTPR keys, Art. 4.3 covered-tax push-down, shipping exclusion (Art. 3.4) and deferred-tax recapture.",
  },
  {
    id: "close",
    n: "05",
    title: "Review, GIR and lock",
    body: "Run the AI Pillar Two Reviewer, preflight GIR XML, read Evidence history, then approve or return the snapshot.",
  },
];

export type ReviewCheck = {
  id: string;
  phase: string;
  title: string;
  hint: string;
  href: string;
  hrefLabel: string;
  ok: boolean;
  actual: string;
  expected: string;
};

export type ReviewCtx = {
  calcs: JurCalc[];
  ingestReady: boolean;
  pendingMaps: number;
  approvedMaps: number;
  reviewerRan: boolean;
  girValidated: boolean;
  snapshotApproved: boolean;
};

const TOL = 0.015;

function near(a: number, b: number) {
  if (b === 0) return Math.abs(a) < 1;
  return Math.abs(a - b) / Math.abs(b) <= TOL;
}

type Anchors = {
  groupTopUp: number;
  th: { etr: number; topUp: number; etrHint: string; topUpHint: string };
  largest: { iso: string; title: string; hint: string; href: string; topUp: number };
  special: (calcs: JurCalc[]) => Omit<ReviewCheck, "phase">;
  gap: { iso: string; title: string; hint: string; topUp: number };
  lowCount: number;
};

/** Reviewer anchors per demo seed. Numbers are the posted engine output (GMT24-CALC 2026.2) for that pack. */
const ANCHORS: Record<string, Anchors> = {
  aetherion: {
    groupTopUp: 18_472_335,
    th: { etr: 0.1102, topUp: 1_721_990, etrHint: "BOI holiday drives sub-15% ETR on Thai blend", topUpHint: "After SBIE · Thai QDMTT collects" },
    largest: { iso: "IE", title: "Ireland top-up (largest)", hint: "KDB IP box · not SBTISH-eligible", href: "/globe-income", topUp: 12_629_581 },
    special: (calcs) => {
      const hk = calcs.find((c) => c.iso === "HK");
      return {
        id: "hk-ente",
        title: "Hong Kong ENTE (not 30% Top-up %)",
        hint: "OECD AG Feb 2023 — Excess Negative Tax Expense is mandatory; Top-up % stays at 15%",
        href: "/etr?iso=HK",
        hrefLabel: "Hong Kong ETR",
        ok: hk != null && hk.topUpRate <= 0.15001 && hk.etr >= 0 && hk.enteOriginated > 0,
        actual: hk ? `${pct(hk.topUpRate, 2)} · ETR ${pct(hk.etr, 2)} · CF ${eur(hk.enteCarryforward, true)}` : "—",
        expected: "15.00% · ETR 0.00% · CF $120k",
      };
    },
    gap: { iso: "VN", title: "Vietnam top-up with data blocks", hint: "IQ-01 / IQ-02 block lock — top-up still calculates with estimates", topUp: 623_943 },
    lowCount: 7,
  },
  thaicoal: {
    groupTopUp: 18_609_959,
    th: { etr: 0.1046, topUp: 9_962_364, etrHint: "BOI solar holiday at NextGen Energy + excluded dividends drive the sub-15% Thai blend", topUpHint: "After SBIE · Thai QDMTT collects; POPE IIR on China is separate" },
    largest: { iso: "SG", title: "Singapore top-up (largest foreign)", hint: "GTP 10% trading hub · Singapore DTT collects, Thai IIR residual $0", href: "/etr?iso=SG", topUp: 5_688_242 },
    special: (calcs) => {
      const au = calcs.find((c) => c.iso === "AU");
      return {
        id: "au-loss",
        title: "Australia Net GloBE Loss (no ETR, no ACTTT)",
        hint: "Art. 5.1.2 — no ETR on a loss; Art. 4.1.5 ACTTT only if Covered Taxes are more negative than 15% of the loss",
        href: "/etr?iso=AU",
        hrefLabel: "Australia ETR",
        ok: au != null && !au.etrComputed && au.additionalCurrentTopUp === 0 && au.jurisdictionalTopUp === 0,
        actual: au ? `ETR ${etrPct(au, 2)} · ACTTT ${eur(au.additionalCurrentTopUp, true)} · top-up ${eur(au.jurisdictionalTopUp, true)}` : "—",
        expected: `ETR ${NO_ETR} · ACTTT $0 · top-up $0`,
      };
    },
    gap: { iso: "VN", title: "Vietnam JV top-up with data estimates", hint: "Art. 6.4 JV blend · payroll and CbCR sources incomplete — top-up still calculates", topUp: 2_537_500 },
    lowCount: 5,
  },
};

export function reviewChecks(ctx: ReviewCtx): ReviewCheck[] {
  const t = totals(ctx.calcs);
  const A = ANCHORS[DATA.group.id] ?? ANCHORS.aetherion;
  const th = ctx.calcs.find((c) => c.iso === "TH" && c.blendKind === "main");
  const big = ctx.calcs.find((c) => c.iso === A.largest.iso && c.blendKind === "main");
  const gap = ctx.calcs.find((c) => c.iso === A.gap.iso);
  const autoApproved = DATA.accounts.filter((a) => a.approved).length;
  const held = DATA.accounts.filter((a) => !a.approved).sort((a, b) => a.confidence - b.confidence)[0];
  const collected = money(t.qdmtt + t.iir + t.utpr);

  return [
    {
      id: "ingest-pack",
      phase: "ingest",
      title: "Close pack ingested",
      hint: "Data Hub shows classified sources",
      href: "/data",
      hrefLabel: "Data Hub",
      ok: ctx.ingestReady,
      actual: ctx.ingestReady ? `${DATA.files.length} files · Mapped / Validated` : "Empty pack",
      expected: `${DATA.files.length} files posted`,
    },
    {
      id: "map-pending",
      phase: "map",
      title: "Low-confidence map held",
      hint: held ? `Account ${held.account} ${held.name} at ${held.confidence}% — reviewer must approve` : "Every map is approved",
      href: "/mapping",
      hrefLabel: "Mapping",
      ok: ctx.pendingMaps >= 1,
      actual: `${ctx.pendingMaps} pending · ${ctx.approvedMaps + autoApproved} approved`,
      expected: held ? `≥ 1 pending (${held.account})` : "≥ 1 pending",
    },
    {
      id: "group-topup",
      phase: "calc",
      title: "Group jurisdictional top-up",
      hint: "Dashboard headline · engine GMT24-CALC 2026.2",
      href: "/overview",
      hrefLabel: "Dashboard",
      ok: near(t.topUp, A.groupTopUp),
      actual: eur(t.topUp, true),
      expected: eur(A.groupTopUp, true),
    },
    {
      id: "th-etr",
      phase: "calc",
      title: "Thailand blended ETR",
      hint: A.th.etrHint,
      href: "/etr",
      hrefLabel: "ETR",
      ok: th != null && near(th.etr, A.th.etr),
      actual: th ? etrPct(th, 2) : "—",
      expected: pct(A.th.etr, 2),
    },
    {
      id: "th-topup",
      phase: "calc",
      title: "Thailand jurisdictional top-up",
      hint: A.th.topUpHint,
      href: "/top-up",
      hrefLabel: "Top-up",
      ok: th != null && near(th.jurisdictionalTopUp, A.th.topUp),
      actual: th ? eur(th.jurisdictionalTopUp, true) : "—",
      expected: eur(A.th.topUp, true),
    },
    {
      id: `${A.largest.iso.toLowerCase()}-topup`,
      phase: "calc",
      title: A.largest.title,
      hint: A.largest.hint,
      href: A.largest.href,
      hrefLabel: big?.name ?? A.largest.iso,
      ok: big != null && near(big.jurisdictionalTopUp, A.largest.topUp),
      actual: big ? eur(big.jurisdictionalTopUp, true) : "—",
      expected: eur(A.largest.topUp, true),
    },
    { phase: "calc", ...A.special(ctx.calcs) },
    {
      id: `${A.gap.iso.toLowerCase()}-gap`,
      phase: "calc",
      title: A.gap.title,
      hint: A.gap.hint,
      href: "/quality",
      hrefLabel: "Data quality",
      ok: gap != null && near(gap.jurisdictionalTopUp, A.gap.topUp),
      actual: gap ? eur(gap.jurisdictionalTopUp, true) : "—",
      expected: eur(A.gap.topUp, true),
    },
    {
      id: "low-count",
      phase: "calc",
      title: "Low-ETR jurisdiction count",
      hint: "ETR map violet diamonds",
      href: "/etr-map",
      hrefLabel: "ETR map",
      ok: t.low === A.lowCount,
      actual: String(t.low),
      expected: String(A.lowCount),
    },
    {
      id: "collection",
      phase: "trace",
      title: "Collection reconciles to top-up",
      hint: "Art. 2 order · QDMTT first, then IIR, residual UTPR (Art. 2.6 key is computed even at $0)",
      href: "/allocation",
      hrefLabel: "Allocation",
      ok: near(collected, t.topUp),
      actual: `QDMTT ${eur(t.qdmtt, true)} · IIR ${eur(t.iir, true)} · UTPR ${eur(t.utpr, true)}`,
      expected: `= ${eur(t.topUp, true)}`,
    },
    {
      id: "reviewer",
      phase: "close",
      title: "AI Pillar Two Reviewer run",
      hint: "Second-level review on Issues page",
      href: "/issues",
      hrefLabel: "Issues",
      ok: ctx.reviewerRan,
      actual: ctx.reviewerRan ? "Run complete" : "Not run",
      expected: "Run complete",
    },
    {
      id: "gir",
      phase: "close",
      title: "GIR XML preflight",
      hint: "Population / reconciliation checks before export",
      href: "/gir",
      hrefLabel: "GIR",
      ok: ctx.girValidated,
      actual: ctx.girValidated ? "Preflight passed" : "Not validated",
      expected: "Preflight passed",
    },
  ];
}

export function reviewScore(checks: ReviewCheck[]) {
  const done = checks.filter((c) => c.ok).length;
  return { done, total: checks.length, pct: checks.length ? Math.round((done / checks.length) * 100) : 0 };
}

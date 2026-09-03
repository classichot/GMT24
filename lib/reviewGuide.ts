import type { JurCalc } from "./engine";
import { totals } from "./engine";
import { eur, pct } from "./format";
import { ACCOUNTS, FILES } from "./model";

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
    body: "Drop sample CSVs or load the full Aetherion FY2026 demo pack. Classification runs before mapping; the engine does not calculate until maps are approved.",
  },
  {
    id: "map",
    n: "02",
    title: "Approve AI mappings",
    body: "Account → financial category → GloBE rule → computed posting. Hold anything under 80% confidence. Approve account 830010 (FX gain, 62%) to see the Art. 3.2 delta post live.",
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

export function reviewChecks(ctx: ReviewCtx): ReviewCheck[] {
  const t = totals(ctx.calcs);
  const th = ctx.calcs.find((c) => c.iso === "TH");
  const ie = ctx.calcs.find((c) => c.iso === "IE");
  const vn = ctx.calcs.find((c) => c.iso === "VN");
  const hk = ctx.calcs.find((c) => c.iso === "HK");
  const autoApproved = ACCOUNTS.filter((a) => a.approved).length;

  return [
    {
      id: "ingest-pack",
      phase: "ingest",
      title: "Close pack ingested",
      hint: "Data Hub shows classified sources",
      href: "/data",
      hrefLabel: "Data Hub",
      ok: ctx.ingestReady,
      actual: ctx.ingestReady ? `${FILES.length} files · Mapped / Validated` : "Empty pack",
      expected: `${FILES.length} files posted`,
    },
    {
      id: "map-pending",
      phase: "map",
      title: "Low-confidence map held",
      hint: "Account 830010 FX gain at 62% — reviewer must approve",
      href: "/mapping",
      hrefLabel: "Mapping",
      ok: ctx.pendingMaps >= 1,
      actual: `${ctx.pendingMaps} pending · ${ctx.approvedMaps + autoApproved} approved`,
      expected: "≥ 1 pending (830010)",
    },
    {
      id: "group-topup",
      phase: "calc",
      title: "Group jurisdictional top-up",
      hint: "Dashboard headline · engine GMT24-CALC 2026.2",
      href: "/overview",
      hrefLabel: "Dashboard",
      ok: near(t.topUp, 18_472_335),
      actual: eur(t.topUp, true),
      expected: eur(18_472_335, true),
    },
    {
      id: "th-etr",
      phase: "calc",
      title: "Thailand blended ETR",
      hint: "BOI holiday drives sub-15% ETR on Thai blend",
      href: "/etr",
      hrefLabel: "ETR",
      ok: th != null && near(th.etr, 0.1102),
      actual: th ? pct(th.etr, 2) : "—",
      expected: "11.02%",
    },
    {
      id: "th-topup",
      phase: "calc",
      title: "Thailand jurisdictional top-up",
      hint: "After SBIE · QDMTT collects in Ireland path separately",
      href: "/top-up",
      hrefLabel: "Top-up",
      ok: th != null && near(th.jurisdictionalTopUp, 1_721_990),
      actual: th ? eur(th.jurisdictionalTopUp, true) : "—",
      expected: eur(1_721_990, true),
    },
    {
      id: "ie-topup",
      phase: "calc",
      title: "Ireland top-up (largest)",
      hint: "KDB IP box · not SBTISH-eligible",
      href: "/globe-income",
      hrefLabel: "GloBE income",
      ok: ie != null && near(ie.jurisdictionalTopUp, 12_629_581),
      actual: ie ? eur(ie.jurisdictionalTopUp, true) : "—",
      expected: eur(12_629_581, true),
    },
    {
      id: "hk-ente",
      phase: "calc",
      title: "Hong Kong ENTE (not 30% Top-up %)",
      hint: "OECD AG Feb 2023 — Excess Negative Tax Expense is mandatory; Top-up % stays at 15%",
      href: "/etr?iso=HK",
      hrefLabel: "Hong Kong ETR",
      ok: hk != null && hk.topUpRate <= 0.15001 && hk.etr >= 0 && hk.enteOriginated > 0,
      actual: hk ? `${pct(hk.topUpRate, 2)} · ETR ${pct(hk.etr, 2)} · CF ${eur(hk.enteCarryforward, true)}` : "—",
      expected: "15.00% · ETR 0.00% · CF $120k",
    },
    {
      id: "vn-gap",
      phase: "calc",
      title: "Vietnam top-up with data blocks",
      hint: "IQ-01 / IQ-02 block lock — top-up still calculates with estimates",
      href: "/quality",
      hrefLabel: "Data quality",
      ok: vn != null && near(vn.jurisdictionalTopUp, 623_943),
      actual: vn ? eur(vn.jurisdictionalTopUp, true) : "—",
      expected: eur(623_943, true),
    },
    {
      id: "low-count",
      phase: "calc",
      title: "Low-ETR jurisdiction count",
      hint: "ETR map violet diamonds",
      href: "/etr-map",
      hrefLabel: "ETR map",
      ok: t.low === 7,
      actual: String(t.low),
      expected: "7",
    },
    {
      id: "utpr",
      phase: "trace",
      title: "UTPR allocation present",
      hint: "Art. 2.6 · 50% employees / 50% tangible assets",
      href: "/allocation",
      hrefLabel: "Allocation",
      ok: t.utpr > 0,
      actual: eur(t.utpr, true),
      expected: "> $0",
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

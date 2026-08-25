import { money } from "./format";
import { originRecompute, recaptureClocks, DT_FY } from "./deferredTax";
import type { YearJurRow, YearRecord } from "./yearLedger";

export type RecapturePosting = {
  iso: string;
  originYear: number;
  deadlineYear: number;
  remaining: number;
  originEtrBefore: number;
  originEtrAfter: number;
  incrementalTopUp: number;
  acttt: number;
  treatment: string;
  ruleId: string;
};

/**
 * Art. 4.4.4 — when a non-excepted DTL hits the five-year deadline,
 * reopen the origin-year ETR and post Additional Current Top-up Tax into the recapture year close.
 */
export function recapturePostings(asOfYear = DT_FY): RecapturePosting[] {
  const isos = ["TH", "JP", "IE", "VN", "DE", "SG"];
  const out: RecapturePosting[] = [];
  for (const iso of isos) {
    for (const clock of recaptureClocks(iso, asOfYear)) {
      if (clock.status !== "recapture" && !(clock.status === "approaching" && asOfYear >= clock.deadlineYear)) {
        // Demo: treat approaching clocks that mature in FY2027 as staged; post when asOf >= deadline.
        if (!(clock.status === "approaching" && asOfYear + 1 >= clock.deadlineYear && asOfYear >= 2026)) continue;
      }
      if (clock.remaining <= 0) continue;
      const impact = originRecompute(clock);
      if (!impact) continue;
      const acttt = money(Math.max(0, impact.incremental));
      out.push({
        iso,
        originYear: clock.originYear,
        deadlineYear: clock.deadlineYear,
        remaining: clock.remaining,
        originEtrBefore: clock.snapshot && clock.snapshot.globeIncome > 0
          ? clock.snapshot.coveredTax / clock.snapshot.globeIncome
          : 0,
        originEtrAfter: impact.newEtr,
        incrementalTopUp: impact.incremental,
        acttt,
        treatment: acttt > 0
          ? `Art. 4.4.4 recapture — origin FY${clock.originYear} reopened; ACTTT ${acttt.toLocaleString("en-GB")} posts in FY${asOfYear}`
          : `Art. 4.4.4 clock FY${clock.originYear} — no incremental top-up after recompute`,
        ruleId: "OECD-DT-444",
      });
    }
  }
  return out;
}

/** Merge recapture ACTTT into year-ledger jurisdiction rows for the close. */
export function applyRecaptureToRows(rows: YearJurRow[], asOfYear = DT_FY): {
  rows: YearJurRow[];
  postings: RecapturePosting[];
  totalActtt: number;
} {
  const postings = recapturePostings(asOfYear);
  const byIso = new Map<string, number>();
  for (const p of postings) byIso.set(p.iso, money((byIso.get(p.iso) ?? 0) + p.acttt));

  const next = rows.map((r) => {
    const add = byIso.get(r.iso) ?? 0;
    if (!add || r.harbour) return r;
    return {
      ...r,
      additionalCurrent: money((r.additionalCurrent ?? 0) + add),
      topUp: money(r.topUp + add),
      qdmtt: r.qdmtt > 0 || add > 0 ? money(r.qdmtt + add) : r.qdmtt,
    };
  });
  return {
    rows: next,
    postings,
    totalActtt: money([...byIso.values()].reduce((a, b) => a + b, 0)),
  };
}

export function recaptureNoteForRecord(rec: Pick<YearRecord, "fy" | "rows">): string {
  const year = Number(rec.fy.replace(/\D/g, "")) || DT_FY;
  const { postings, totalActtt } = applyRecaptureToRows(rec.rows, year);
  if (!postings.length) return "No Art. 4.4.4 recapture ACTTT on this close.";
  return `Art. 4.4.4: ${postings.length} origin-year reopen(s); ACTTT ${totalActtt.toLocaleString("en-GB")} posted into ${rec.fy}.`;
}

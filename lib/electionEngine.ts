import { money } from "./format";
import type { AuditNode, JurCalc } from "./engine";
import { totals } from "./engine";
import {
  ELECTIONS,
  REALISATION_FV,
  STOCK_COMP,
  type ElectionDef,
  type ElectionFamily,
} from "./elections";

export type EligStatus = "available" | "unavailable" | "review" | "locked" | "n/a";

export type EligibilityRow = {
  election: ElectionDef;
  iso: string;
  name: string;
  status: EligStatus;
  reason: string;
  boundEntities: string[];
};

export type Restate = {
  iso: string;
  name: string;
  globe: number;
  covered: number;
  sbie: number;
  excess: number;
  etr: number;
  topUp: number;
  qdmtt: number;
  iir: number;
  utpr: number;
  harbour: boolean;
  note: string;
};

export type OptScenario = {
  id: string;
  title: string;
  elections: string[];
  family: string;
  fyTopUp: number;
  fyQdmtt: number;
  fyIir: number;
  fyUtpr: number;
  fy5: number;
  etrNote: string;
  compliance: "full" | "harbour" | "mixed";
  audit: "low" | "medium" | "high";
  lockYears: number;
  bookable: boolean;
  why: string;
  rows: Restate[];
};

export type OptRec = { id: string; label: string; scenario: OptScenario };

const MIN = 0.15;

function collect(c: JurCalc, topUp: number, harbour: boolean) {
  if (harbour || topUp <= 0) return { qdmtt: 0, iir: 0, utpr: 0 };
  if (c.pack?.qdmtt) return { qdmtt: topUp, iir: 0, utpr: 0 };
  if (c.pack?.iir) return { qdmtt: 0, iir: topUp, utpr: 0 };
  return { qdmtt: 0, iir: 0, utpr: topUp };
}

function restated(c: JurCalc, globeAdj: number, sbieMode: "max" | "partial" | "none", forceZero: boolean, note: string): Restate {
  const keepHarbour = c.exposure === "Safe harbour";
  const harbour = forceZero || keepHarbour;
  const globe = money(Math.max(1, c.globeIncome + globeAdj));
  const covered = c.coveredTax;
  const sbie = sbieMode === "none" ? 0 : sbieMode === "partial" ? money(c.sbie * 0.5) : c.sbie;
  const excess = money(Math.max(0, globe - sbie));
  const etr = globe > 0 ? covered / globe : 0;
  const topUp = harbour ? 0 : money(Math.max(0, MIN - etr) * excess);
  const pay = collect(c, topUp, harbour);
  return { iso: c.iso, name: c.name, globe, covered, sbie, excess, etr, topUp, harbour, note, ...pay };
}

function stockDelta(iso: string) {
  const rows = STOCK_COMP.filter((r) => r.iso === iso);
  return money(rows.reduce((a, r) => a + (r.book - r.tax), 0));
}

function realisationDelta(iso: string) {
  return -(REALISATION_FV.find((r) => r.iso === iso)?.amount ?? 0);
}

export function stockCompByIso(iso: string) {
  return STOCK_COMP.filter((r) => r.iso === iso);
}

export function eligibilityEngine(calcs: JurCalc[]): EligibilityRow[] {
  const out: EligibilityRow[] = [];
  for (const e of ELECTIONS) {
    if (e.scope === "GROUP" || e.scope === "ALL_JURISDICTIONS") {
      const status: EligStatus = e.id === "SETR_QRTC" ? "unavailable" : e.family === "setr" ? "review" : "available";
      out.push({
        election: e,
        iso: "GROUP",
        name: "Aetherion Group",
        status,
        reason:
          e.id === "SETR_QRTC"
            ? "Thai QRTC is not enacted. Do not book. Group SETR QRTC/MTTC remains a coverage exception."
            : e.family === "setr"
              ? "Simplified ETR inner elections are available only if the SETR Safe Harbour itself is elected for a tested jurisdiction. Five-year opt-outs survive a later return to full GloBE."
              : "Group-wide timing elections bind every jurisdiction. Not a single-country switch.",
        boundEntities: calcs.map((c) => c.iso),
      });
      continue;
    }

    if (e.scope === "UPE_JURISDICTION") {
      const jp = calcs.find((c) => c.iso === "JP");
      const us = calcs.find((c) => c.iso === "US");
      if (e.id === "SH_UTPR" || e.id === "SH_UPE") {
        out.push({
          election: e,
          iso: "US",
          name: us?.name ?? "United States",
          status: us?.sh.utprSH === "Pass" || us?.sh.sbs === "Pass" ? "available" : "review",
          reason: us?.sh.navigator ?? "UPE-jurisdiction harbour path.",
          boundEntities: ["US-CE"],
        });
        out.push({
          election: e,
          iso: "JP",
          name: jp?.name ?? "Japan",
          status: "review",
          reason: "Japan is the UPE jurisdiction. UTPR SH / UPE SH must be confirmed against the Central Record for the year.",
          boundEntities: ["JP-UPE"],
        });
      }
      continue;
    }

    if (e.id === "SETR_QRTC") {
      out.push({
        election: e,
        iso: "TH",
        name: "Thailand",
        status: "unavailable",
        reason: "Thai QRTC is not enacted. Do not book. Accounting tax-reduction treatment stays; do not gross-up Simplified Income.",
        boundEntities: ["TH001", "TH-PE1"],
      });
      continue;
    }

    const start = out.length;
    for (const c of calcs) {
      const entities = c.entities.map((x) => x.code);
      let status: EligStatus = "n/a";
      let reason = "No triggering fact on this snapshot.";

      if (e.id === "OECD_3.2.2") {
        const rows = stockCompByIso(c.iso);
        if (rows.length) {
          const tax = rows.reduce((a, r) => a + r.tax, 0);
          const book = rows.reduce((a, r) => a + r.book, 0);
          status = "available";
          reason =
            tax > book
              ? `Tax deduction ${tax.toLocaleString("en-GB")} exceeds book ${book.toLocaleString("en-GB")}. Election would reduce GloBE income. Binds ${rows.map((r) => r.name).join(" and ")} — not one entity.`
              : `Tax deduction ${tax.toLocaleString("en-GB")} is below book ${book.toLocaleString("en-GB")}. Election is legally available but would increase GloBE income. Optimizer will not recommend it.`;
        }
      } else if (e.id === "OECD_3.2.5") {
        const fv = REALISATION_FV.find((r) => r.iso === c.iso);
        if (fv) {
          status = "available";
          reason = fv.note;
        }
      } else if (e.id === "OECD_5.3.1") {
        status = c.sbie > 0 ? "available" : "n/a";
        reason = "Model max / partial / none. Opt-out is annual. Default in Core is maximum SBIE.";
      } else if (e.id === "OECD_5.5" || e.id === "SH_TCSH_DM") {
        status = c.sh.deMinimis === "Pass" ? "available" : "unavailable";
        reason = c.sh.navigator;
      } else if (e.id === "SH_TCSH" || e.id === "SH_TCSH_ETR" || e.id === "SH_TCSH_RP") {
        status = c.sh.outcome === "Pass" ? "available" : c.sh.outcome === "Review" ? "review" : "unavailable";
        reason = c.sh.navigator;
      } else if (e.id === "SH_QDMTT") {
        status = c.pack?.qdmttSH ? (c.sh.qdmttSH === "Pass" ? "available" : "review") : "unavailable";
        reason = "Qualified status is read from the OECD Central Record, not a hard-coded list.";
      } else if (e.id === "SH_SBTI" || e.id === "SETR_SBTI") {
        status = c.sh.sbtish === "Review" ? "review" : c.sh.sbtish === "Pass" ? "available" : "unavailable";
        reason = c.sh.sbtish === "Review" ? "Substance-based incentive present. Qualifying expenditure is not fully traced — do not elect on this snapshot." : "No SBTI candidate.";
      } else if (e.id === "SH_SETR" || e.id === "SETR_APPLY") {
        status = c.sh.outcome === "Fail" && c.etr < MIN ? "review" : c.etr >= MIN ? "n/a" : "review";
        reason = "Simplified ETR SH is a 2026 package route. Inner elections can lock five years. Not a substitute for Thai QDMTT.";
      } else if (e.id === "SH_SBS") {
        status = c.sh.sbs === "Pass" ? "available" : "unavailable";
        reason = c.sh.navigator;
      } else if (e.id === "OECD_4.5" || e.id === "SETR_4.5") {
        status = c.globeIncome < 0 ? "available" : "unavailable";
        reason = c.globeIncome < 0
          ? "First GIR for the jurisdiction. Revocable YES. Re-elect after revocation: NO."
          : "No GloBE loss in this jurisdiction this year.";
      } else if (e.id === "OECD_QDMTT_FX") {
        status = c.iso === "TH" && c.pack?.qdmtt ? "available" : "n/a";
        reason = c.iso === "TH" ? "Thai QDMTT computes in THB (Notification No. 6). Core remains USD. 5-year currency election where the AG permits." : "No QDMTT currency issue flagged.";
      } else if (e.id === "OECD_3.2.1b") {
        status = c.iso === "TH" ? "available" : "n/a";
        reason = c.iso === "TH" ? "TH001 excluded dividends $1.84M already posted under Art. 3.2.1(b) ≥10% ownership. Portfolio (<10%) election is a separate 5-year CE election." : "No portfolio-dividend fact.";
      } else if (e.id === "OECD_4.4.7_a" || e.id === "OECD_4.4.7_5") {
        status = c.iso === "TH" ? "review" : "n/a";
        reason = c.iso === "TH" ? "IQ-07 FY2022 DTL approaching five-year recapture. Annual vs five-year unclaimed-accrual tracking is a DTL-item / GL-category choice — not a jurisdiction toggle." : "No recapture clock flagged.";
      } else if (e.id === "SETR_PE") {
        status = c.iso === "TH" ? "review" : "n/a";
        reason = "Rayong PE is blended in Thailand. PE simplification is annual with continuation rules if a PE loss was absorbed in the main entity.";
      } else if (e.id === "OECD_7.5" || e.id === "OECD_7.6") {
        status = c.iso === "SG" ? "review" : "n/a";
        reason = "SG-JV is a 50% JV, not an Investment Entity on this snapshot. Art. 7.5 / 7.6 stay dark until IE facts exist.";
      } else if (e.family === "globe" || e.family === "setr") {
        continue;
      } else if (e.family === "harbour") {
        status = c.sh.outcome === "Pass" ? "available" : "unavailable";
        reason = c.sh.navigator;
      }

      if (status === "n/a") continue;
      out.push({ election: e, iso: c.iso, name: c.name, status, reason, boundEntities: entities });
    }
    if (out.length === start) {
      out.push({
        election: e,
        iso: "GROUP",
        name: "Aetherion Group",
        status: "review",
        reason:
          e.family === "setr"
            ? "Simplified ETR inner election — only if SETR SH is on. Five-year opt-outs survive a later return to full GloBE."
            : "No automatic fact trigger on this snapshot. Confirm eligibility before anyone toggles it. A JURISDICTION election still binds every CE in that country.",
        boundEntities: [],
      });
    }
  }
  return out;
}

export function applyPackage(calcs: JurCalc[], flags: {
  stock?: string[];
  realisation?: string[];
  sbie?: "max" | "partial" | "none";
  harbourIso?: string[];
}): Restate[] {
  const sbie = flags.sbie ?? "max";
  return calcs.map((c) => {
    let globeAdj = 0;
    const notes: string[] = [];
    if (flags.stock?.includes(c.iso)) {
      globeAdj += stockDelta(c.iso);
      notes.push("Art. 3.2.2 stock-comp");
    }
    if (flags.realisation?.includes(c.iso)) {
      globeAdj += realisationDelta(c.iso);
      notes.push("Art. 3.2.5 realisation");
    }
    if (sbie === "none") notes.push("SBIE none");
    if (sbie === "partial") notes.push("SBIE partial");
    const zero = flags.harbourIso?.includes(c.iso) ?? false;
    if (zero) notes.push("Safe harbour deemed zero");
    return restated(c, globeAdj, sbie, zero, notes.join(" · ") || "Default");
  });
}

function pack(id: string, title: string, elections: string[], calcs: JurCalc[], flags: Parameters<typeof applyPackage>[1], extra: Omit<OptScenario, "id" | "title" | "elections" | "fyTopUp" | "fy5" | "fyQdmtt" | "fyIir" | "fyUtpr" | "rows" | "etrNote"> & { etrNote?: string }): OptScenario {
  const rows = applyPackage(calcs, flags);
  const fyTopUp = money(rows.reduce((a, r) => a + r.topUp, 0));
  const fyQdmtt = money(rows.reduce((a, r) => a + r.qdmtt, 0));
  const fyIir = money(rows.reduce((a, r) => a + r.iir, 0));
  const fyUtpr = money(rows.reduce((a, r) => a + r.utpr, 0));
  const th = rows.find((r) => r.iso === "TH");
  return {
    id,
    title,
    elections,
    fyTopUp,
    fyQdmtt,
    fyIir,
    fyUtpr,
    fy5: money(fyTopUp * 5),
    rows,
    etrNote: extra.etrNote ?? (th ? `Thai ETR ${(th.etr * 100).toFixed(1)}% · top-up ${th.topUp.toLocaleString("en-GB")}` : ""),
    family: extra.family,
    compliance: extra.compliance,
    audit: extra.audit,
    lockYears: extra.lockYears,
    bookable: extra.bookable,
    why: extra.why,
  };
}

export function optimizeGlobe(calcs: JurCalc[]) {
  const elig = eligibilityEngine(calcs);
  const avail = (id: string, iso: string) => elig.some((r) => r.election.id === id && r.iso === iso && r.status === "available");
  const review = (id: string, iso: string) => elig.some((r) => r.election.id === id && r.iso === iso && r.status === "review");

  const base = pack("BASE", "Baseline — default treatment", [], calcs, {}, {
    family: "globe", compliance: "full", audit: "low", lockYears: 0, bookable: true,
    why: "Core GloBE. No elective overlays. This is the number GMT24 already posts.",
  });
  const a = pack("A", "Thailand Art. 3.2.2 stock compensation", ["OECD_3.2.2@TH"], calcs, { stock: ["TH"] }, {
    family: "globe", compliance: "full", audit: "medium", lockYears: 5, bookable: avail("OECD_3.2.2", "TH"),
    why: "Five-year jurisdiction election. Binds TH001 and the Rayong PE together. Substitutes local tax deduction for book expense.",
  });
  const b = pack("B", "TH stock-comp + realisation principle", ["OECD_3.2.2@TH", "OECD_3.2.5@TH"], calcs, { stock: ["TH"], realisation: ["TH"] }, {
    family: "globe", compliance: "full", audit: "medium", lockYears: 5, bookable: avail("OECD_3.2.2", "TH") && avail("OECD_3.2.5", "TH"),
    why: "Two five-year locks. Realisation may be limited to tangible assets. Do not flip for one factory.",
  });
  const cMax = pack("C", "B + maximum SBIE (Core default)", ["OECD_3.2.2@TH", "OECD_3.2.5@TH", "SBIE_MAX"], calcs, { stock: ["TH"], realisation: ["TH"], sbie: "max" }, {
    family: "globe", compliance: "full", audit: "medium", lockYears: 5, bookable: true,
    why: "SBIE is annual. Core already claims the maximum. This is B with max SBIE.",
  });
  const cPart = pack("C2", "B + partial SBIE", ["OECD_3.2.2@TH", "OECD_3.2.5@TH", "SBIE_PARTIAL"], calcs, { stock: ["TH"], realisation: ["TH"], sbie: "partial" }, {
    family: "globe", compliance: "full", audit: "medium", lockYears: 5, bookable: true,
    why: "An MNE does not have to claim the maximum SBIE. Partial claim can change Excess Profit without changing ETR.",
  });
  const cNone = pack("C3", "B + SBIE opt-out", ["OECD_3.2.2@TH", "OECD_3.2.5@TH", "OECD_5.3.1@TH"], calcs, { stock: ["TH"], realisation: ["TH"], sbie: "none" }, {
    family: "globe", compliance: "full", audit: "medium", lockYears: 5, bookable: true,
    why: "Art. 5.3.1 annual election not to apply SBIE. Usually increases top-up. Shown so SBIE is not a silent YES.",
  });
  const ieSbc = pack("IE", "Ireland Art. 3.2.2 (available, not recommended)", ["OECD_3.2.2@IE"], calcs, { stock: ["IE"] }, {
    family: "globe", compliance: "full", audit: "high", lockYears: 5, bookable: avail("OECD_3.2.2", "IE"),
    why: "Election is legally available but tax deduction is below book. It would increase Irish GloBE income. Five-year lock.",
  });
  const d = pack("D", "Transitional CbCR Safe Harbour on Thailand", ["SH_TCSH@TH"], calcs, { harbourIso: avail("SH_TCSH", "TH") ? ["TH"] : [] }, {
    family: "harbour", compliance: "harbour", audit: "low", lockYears: 0, bookable: avail("SH_TCSH", "TH"),
    why: avail("SH_TCSH", "TH")
      ? "If more than one qualifying TCSH test exists, GIR requires the group to identify the test elected."
      : "Thailand fails all Transitional CbCR tests on this snapshot. Harbour cannot be elected. Lowest-compliance path is not available here.",
  });
  const e = pack("E", "Simplified ETR Safe Harbour on Thailand", ["SH_SETR@TH"], calcs, { harbourIso: review("SH_SETR", "TH") ? [] : [] }, {
    family: "harbour", compliance: "harbour", audit: "high", lockYears: 5, bookable: false,
    why: "SETR SH is Review, not Pass. Inner elections (FX, pension, PE, group timing) can lock five years and survive a return to full GloBE. Do not treat Review as a $0 election.",
  });
  const f = pack("F", "Simplified ETR + SBTI on Thailand", ["SH_SETR@TH", "SH_SBTI@TH"], calcs, {}, {
    family: "harbour", compliance: "harbour", audit: "high", lockYears: 5, bookable: false,
    why: "SBTISH is Review — BOI is substance-based but qualifying expenditure is not traced. Do not book.",
  });

  const scenarios = [base, a, b, cMax, cPart, cNone, ieSbc, d, e, f];
  const bookable = scenarios.filter((s) => s.bookable);
  const lowestFy = bookable.reduce((m, s) => (s.fyTopUp < m.fyTopUp ? s : m));
  const lowest5 = bookable.reduce((m, s) => {
    const score = (x: OptScenario) => x.fy5 + x.lockYears * 200_000;
    return score(s) < score(m) ? s : m;
  });
  const lowestComp = bookable.find((s) => s.compliance === "harbour") ?? bookable.reduce((m, s) => (s.audit === "low" && s.lockYears < m.lockYears ? s : m), base);
  const lowestRisk = bookable.filter((s) => s.audit === "low").sort((x, y) => x.fyTopUp - y.fyTopUp)[0] ?? base;
  const recommended = bookable
    .filter((s) => s.id !== "IE" && s.id !== "C3")
    .sort((x, y) => x.fyTopUp - y.fyTopUp || x.lockYears - y.lockYears)[0] ?? base;

  const thBase = calcs.find((c) => c.iso === "TH")!;
  const thA = a.rows.find((r) => r.iso === "TH")!;
  const stock = stockCompByIso("TH");
  const audit: AuditNode = {
    id: "ELEC-opt",
    label: "Optimized group top-up (recommended bookable package)",
    amount: recommended.fyTopUp,
    kind: "result",
    ruleId: "OECD-ELEC-2026",
    ruleVersion: "2026.2",
    detail: `${recommended.title}. Engine restated from GloBE Core. LLM does not post the overlay.`,
    children: [thBase.audit],
  };

  return {
    elig,
    scenarios,
    counts: countElig(elig),
    recs: [
      { id: "01", label: "Lowest FY2026 tax", scenario: lowestFy },
      { id: "02", label: "Lowest 5-year tax", scenario: lowest5 },
      { id: "03", label: "Lowest compliance burden", scenario: lowestComp },
      { id: "04", label: "Lowest audit / regulatory risk", scenario: lowestRisk },
      { id: "05", label: "Recommended balanced position", scenario: recommended },
    ],
    stock,
    thBase,
    thA,
    groupBase: totals(calcs).topUp,
    audit,
  };
}

export const ELIG_TAG: Record<EligStatus, string> = {
  available: "tag-ok",
  review: "tag-warn",
  unavailable: "tag-hot",
  locked: "tag-accent",
  "n/a": "tag-neutral",
};

export const ELIG_LABEL: Record<EligStatus, string> = {
  available: "Available",
  review: "Review",
  unavailable: "Unavailable",
  locked: "Locked",
  "n/a": "No fact",
};

export function familyLabel(f: ElectionFamily) {
  return f === "globe" ? "GloBE election" : f === "harbour" ? "Safe harbour" : "Simplified ETR inner";
}

const RANK: Record<EligStatus, number> = { available: 0, locked: 1, review: 2, unavailable: 3, "n/a": 4 };

export function rollupElig(elig: EligibilityRow[]) {
  const map = new Map<string, EligibilityRow[]>();
  for (const r of elig) {
    const rows = map.get(r.election.id) ?? [];
    rows.push(r);
    map.set(r.election.id, rows);
  }
  return ELECTIONS.map((e) => {
    const rows = (map.get(e.id) ?? []).slice().sort((a, b) => RANK[a.status] - RANK[b.status]);
    return { election: e, status: rows[0]?.status ?? ("n/a" as EligStatus), reason: rows[0]?.reason ?? "", rows };
  });
}

export function countElig(elig: EligibilityRow[]) {
  const rolled = rollupElig(elig);
  return {
    available: rolled.filter((r) => r.status === "available").length,
    review: rolled.filter((r) => r.status === "review").length,
    unavailable: rolled.filter((r) => r.status === "unavailable").length,
    fiveYear: ELECTIONS.filter((e) => e.duration === "five-year").length,
    total: ELECTIONS.length,
  };
}

export function lifecycleOf(e: ElectionDef, fy = 2026) {
  const earliest =
    e.duration === "five-year" ? String(fy + 5)
    : e.duration === "annual" ? String(fy + 1)
    : e.duration === "first-gir" ? "After the first GIR for the jurisdiction"
    : e.duration === "transaction" ? "That transfer only"
    : "When the condition ends";
  const consequence =
    e.reelect === "no"
      ? "Revocation is final. Re-election after revocation is prohibited (GIR XML)."
      : e.reelect === "restricted"
        ? "Re-election is restricted. A five-year clock typically restarts."
        : "Annual — may be made or not made in a later year without a re-election bar.";
  const harbour =
    e.family === "harbour"
      ? "This is a safe-harbour election. If more than one qualifying test exists, GIR requires the MNE to identify the test used."
      : e.family === "setr"
        ? "Inner Simplified ETR election. Five-year opt-outs continue even if the group later returns to full GloBE."
        : "Chapter 3 elections can also apply inside Simplified ETR if that harbour is used.";
  return { electionYear: fy, earliestRevocation: earliest, revocationConsequence: consequence, harbour };
}

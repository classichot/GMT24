/**
 * Method & Compliance Review. Walks a requirement register and records, for
 * each requirement that applies to the scoped jurisdictions and period,
 * whether the case meets it, has a gap, or rests on a judgment. OECD Model
 * Rules and domestic law are identified separately with their effective dates;
 * where they diverge, the domestic instrument is shown alongside the OECD text.
 */
import type { JurCalc } from "../engine";
import { DATA, GROUPS, RULES } from "../model";
import { girEditionFor, penaltyRelief, safeHarbourCoding, sbsElection, utprShWindow } from "../gir2026";
import { reviewOecdRdGap } from "../thaiGap";
import { eur, etrPct, pct } from "../format";
import { eligibilityEngine, splitSwitch } from "../electionEngine";
import { electionById } from "../elections";
import { passagesForGap, passagesForRule, passagesForJurisdiction, resolveCitation } from "../legal";
import type { CaseSnapshot, CheckResult, ComplianceFinding } from "./types";

type Req = {
  id: string;
  authority: "OECD" | string;
  instrument: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  title: string;
  href?: string;
  /** Legal-corpus passage ids behind the requirement. */
  passages?: string[];
  test: (ctx: Ctx) => { status: ComplianceFinding["status"]; finding: string; evidence: string[]; iso?: string }[];
};

type Ctx = { s: CaseSnapshot; calcs: JurCalc[]; scoped: JurCalc[]; checks: CheckResult[]; jurisdictions: string[] };

const fyStart = (s: CaseSnapshot) => `${s.fy.replace("FY", "")}-01-01`;

const OECD_REQS: Req[] = [
  {
    id: "OECD-1.1", authority: "OECD", instrument: "GloBE Model Rules Art. 1.1 (Dec 2021) · Commentary 2023", effectiveFrom: "2024-01-01", effectiveTo: null, passages: ["LP-MR-1.1", "LP-MR-1.2-1.3"],
    title: "Group in scope: consolidated revenue ≥ EUR 750m in two of the four preceding years", href: "/scope",
    test: ({ s }) => [{ status: "met", finding: `${s.groupName} passes the Art. 1.1 revenue window on the UPE presentation currency (rule OECD-SCOPE-750).`, evidence: ["OECD-SCOPE-750"] }],
  },
  {
    id: "OECD-3", authority: "OECD", instrument: "GloBE Model Rules Art. 3.1–3.5", effectiveFrom: "2024-01-01", effectiveTo: null, passages: ["LP-MR-3.1", "LP-MR-3.2.1", "LP-MR-3.2.3", "LP-MR-3.4", "LP-MR-3.5"],
    title: "GloBE Income computed from FANIL with Art. 3.2 adjustments per constituent entity", href: "/globe-income",
    test: ({ scoped, checks }) => scoped.map((c) => {
      const gap = checks.find((k) => k.id === `rev-recon-${c.blendKey}` && k.status !== "pass");
      return { status: gap ? "judgment" as const : "met" as const, iso: c.iso, finding: gap ? `${c.name}: FANIL plus listed adjustments does not bridge to GloBE income (${gap.actual}). The residual must be explained by an engine-level adjustment before filing.` : `${c.name}: FANIL ${eur(c.fanil)} → GloBE income ${eur(c.globeIncome)} with traced Art. 3.2 adjustments.`, evidence: [c.trace.globe.id, "OECD-GloBE-Income"] };
    }),
  },
  {
    id: "OECD-4", authority: "OECD", instrument: "GloBE Model Rules Art. 4.1–4.6 · AG Feb 2023 (deferred tax recast)", effectiveFrom: "2024-01-01", effectiveTo: null, passages: ["LP-MR-4.1", "LP-MR-4.1.5", "LP-MR-4.2", "LP-MR-4.4.1", "LP-MR-4.4.4", "LP-AG23-02-2.7"],
    title: "Adjusted Covered Taxes: current tax, deferred tax recast at 15%, Art. 4.1.5 expected-tax test", href: "/covered-taxes",
    test: ({ scoped }) => scoped.map((c) => ({
      status: c.coveredTax < 0 && c.globeIncome > 0 && !c.enteOriginated ? "gap" as const : "met" as const,
      iso: c.iso,
      finding: c.etrComputed
        ? `${c.name}: Adjusted Covered Taxes ${eur(c.coveredTax)}${c.enteOriginated ? ` · ENTE ${eur(c.enteOriginated)} originated (Art. 4.1.5 / 5.2.1 procedure)` : ""}.`
        : `${c.name}: Net GloBE Loss — Art. 4.1.5 expected-tax test ${c.additionalCurrentTopUp ? `produced Additional Current Top-up ${eur(c.additionalCurrentTopUp)}` : "produced no Additional Current Top-up"}. ${c.actttReason}`,
      evidence: [c.trace.covered.id, "OECD-CT-Deferred-15"],
    })),
  },
  {
    id: "OECD-5", authority: "OECD", instrument: "GloBE Model Rules Art. 5.1–5.3", effectiveFrom: "2024-01-01", effectiveTo: null, passages: ["LP-MR-5.1", "LP-MR-5.2", "LP-MR-5.3", "LP-MR-9.2"],
    title: "Jurisdictional ETR, Top-up Tax Percentage, SBIE and Excess Profit computed per jurisdiction", href: "/etr",
    test: ({ scoped }) => scoped.map((c) => ({
      status: "met" as const,
      iso: c.iso,
      finding: c.etrComputed
        ? `${c.name}: ETR ${etrPct(c)} · Top-up % ${pct(c.topUpRate, 2)} · SBIE ${eur(c.sbie)} (payroll ${eur(c.payrollCarve)} + assets ${eur(c.assetCarve)}) · Excess Profit ${eur(c.excess)} · top-up ${eur(c.jurisdictionalTopUp)}.`
        : `${c.name}: Art. 5.1.2 — no ETR is computed for a Net GloBE Loss year; no rate-based top-up. SBIE ${eur(c.sbie)} recorded for the record.`,
      evidence: [c.trace.etr.id, c.trace.sbie.id, "OECD-SBIE-2026"],
    })),
  },
  {
    id: "OECD-SH", authority: "OECD", instrument: "Safe Harbours and Penalty Relief (Dec 2022) · AG Dec 2023 · GIR Sep 2026 §2.2.1.1.1", effectiveFrom: "2024-01-01", effectiveTo: "2028-12-31", passages: ["LP-MR-8.2", "LP-SH22-1", "LP-AG23-12-1", "LP-SBS26-2", "LP-GIR26-2.2.1.1.1"],
    title: "Transitional CbCR Safe Harbour tested where elected; elected test identified in the GIR", href: "/safe-harbours",
    test: ({ scoped }) => scoped.map((c) => ({
      status: c.exposure === "Safe harbour" ? "met" as const : c.sh.outcome === "Review" ? "judgment" as const : c.sh.outcome === "Not tested" && c.jurisdictionalTopUp > 0 ? "gap" as const : "n/a" as const,
      iso: c.iso,
      finding: `${c.name}: navigator ${c.sh.navigator} · outcome ${c.sh.outcome}${c.sh.barred ? " · once-out-always-out bar applies" : ""}${c.sh.tcshUsed ? " · TCSH relied on" : ""}.`,
      evidence: ["OECD-TCSH-2026"],
    })),
  },
  {
    id: "OECD-ELEC", authority: "OECD", instrument: "GloBE Model Rules Art. 1.5 / 3.2 / 5.3.1 / 7.x elections · GIR Part 2", effectiveFrom: "2024-01-01", effectiveTo: null, passages: ["LP-MR-1.5", "LP-MR-3.2.2", "LP-MR-5.3", "LP-MR-7.5-7.6", "LP-GIR25-1"],
    title: "Every election on the working package is eligible, recorded and consistent with prior-year five-year locks", href: "/elections",
    test: ({ s, calcs, jurisdictions }) => {
      const elig = eligibilityEngine(calcs);
      const keys = Object.entries(s.electionsOn).filter(([, v]) => v).map(([k]) => k).filter((k) => { const [, iso] = splitSwitch(k); return iso === "GROUP" || jurisdictions.includes(iso); });
      if (!keys.length) return [{ status: "met", finding: "No elections switched on inside the scope. Core GloBE treatment applies; the GIR election section reports none.", evidence: ["Election register"] }];
      return keys.map((k) => {
        const [id, iso] = splitSwitch(k);
        const row = elig.find((r) => r.election.id === id && r.iso === iso);
        const e = electionById(id);
        const st: ComplianceFinding["status"] = !row ? "judgment" : row.status === "available" || row.status === "locked" ? "met" : row.status === "review" ? "judgment" : "gap";
        return { status: st, iso: iso === "GROUP" ? undefined : iso, finding: `${e?.article ?? id} ${e?.name ?? ""} @ ${iso}: eligibility ${row?.status ?? "unknown"}${row ? ` — ${row.reason}` : ""}${e?.duration === "five-year" ? " · five-year election, lock tracked in the Year Ledger" : ""}.`, evidence: [k, "Election register"] };
      });
    },
  },
  {
    id: "OECD-8.1", authority: "OECD", instrument: "GloBE Model Rules Art. 8.1 · GIR (Sep 2026) · GIR XML Schema v1.0", effectiveFrom: "2024-01-01", effectiveTo: null, passages: ["LP-MR-8.1", "LP-MR-9.4", "LP-GIR26-1", "LP-GIRXML-1"],
    title: "GloBE Information Return prepared per jurisdiction; first-year filing 18 months after FY end, then 15 months", href: "/gir",
    test: ({ s, checks }) => [{
      status: checks.some((c) => c.status === "fail" && c.severity === "block") ? "gap" : "met",
      finding: checks.some((c) => c.status === "fail" && c.severity === "block")
        ? `Blocking verification failures remain; the GIR for ${s.fy} cannot be validated until they are corrected.`
        : `Calculation passed verification; GIR preflight can run for ${s.fy} (deadline ${Number(s.fy.replace("FY", "")) + 1}-06-30 first year / 15 months thereafter).`,
      evidence: ["OECD-GIR-XML-1.0"],
    }],
  },
  {
    id: "OECD-GIR-2026", authority: "OECD", instrument: "GIR (Sep 2026) §36.1 · 1.3.1.6 · 1.3.1 options (v)–(vi) · 2.2.1.1.1 options (a)–(k)", effectiveFrom: "2025-12-31", effectiveTo: null, passages: ["LP-GIR26-36.1", "LP-GIR26-1.3.1.6", "LP-GIR26-1.3.1", "LP-GIR26-2.2.1.1.1"],
    title: "Return drafted on the September 2026 template: edition matches the Reporting Fiscal Year, Side-by-Side election consistent with the UPE regime, one safe-harbour option letter per jurisdiction, Transitional UTPR SH only inside its window", href: "/gir",
    test: ({ s, calcs, scoped }) => {
      const group = groupOf(s);
      const edition = girEditionFor(group.fyStart);
      const sbs = sbsElection(group, s.electionsOn, calcs, s.packOverlay);
      const window = utprShWindow(group);
      const out: ReturnType<Req["test"]> = [{
        status: edition.id === "GIR-2026-09" ? "met" : "judgment",
        finding: edition.id === "GIR-2026-09"
          ? `FY commences ${group.fyStart} — on or after 31 Dec 2025, so the ${edition.short} template governs; the XML schema revision is ${edition.schema.status} (${edition.schema.cutOff ? `cut-off ${edition.schema.cutOff}` : "no cut-off date yet"}).`
          : `FY commences ${group.fyStart} — before 31 Dec 2025, so the January 2025 template still governs this Reporting Fiscal Year; the September 2026 guidance notes still apply where not Side-by-Side specific.`,
        evidence: [edition.id, "OECD-GIR-XML"],
      }];
      const blocking = sbs.issues;
      out.push({
        status: blocking.length ? "gap" : (sbs.eligible && !sbs.elected) || sbs.notes.length ? "judgment" : "met",
        finding: blocking[0] ?? sbs.notes[0] ?? (sbs.applies
          ? `Side-by-Side election made in 1.3.1.6 (${sbs.upeRegime}); summary table 1.4 and 1.3.1.7–1.3.1.9 not completed; Sections 2–3 only for QDMTT jurisdictions (${sbs.jurisdictionSectionsFor.join(", ") || "none"}).`
          : sbs.eligible
            ? `${sbs.upeIso} is a Qualified Side-by-Side Regime but SH_SBS is not switched on — decide whether to make the 1.3.1.6 election; the full return is populated meanwhile.`
            : `UPE jurisdiction ${sbs.upeIso} (${sbs.upeRegime}) is not a Qualified Side-by-Side Regime; the 1.3.1.6 election is not available and the full return is populated.`),
        evidence: ["SH_SBS", `Central Record ${sbs.upeIso}`],
      });
      for (const c of scoped) {
        const coding = safeHarbourCoding(c, group, s.electionsOn, s.packOverlay);
        out.push({
          status: coding.issues.length ? "gap" : coding.notes.length ? "judgment" : "met",
          iso: c.iso,
          finding: coding.issues[0] ?? coding.notes[0] ?? (coding.primary
            ? `${c.name}: option (${coding.primary}) reported in 2.2.1.1.1${coding.reported.length > 1 ? ` with (${coding.reported.filter((x) => x !== coding.primary).join("), (")})` : ""}.`
            : `${c.name}: no safe harbour — full GloBE computation reported in Sections 2–3.`),
          evidence: coding.reported.map((code) => `2.2.1.1.1(${code})`),
        });
      }
      if (scoped.some((c) => c.iso === s.upeIso)) {
        out.push({ status: window.open ? "met" : "judgment", iso: s.upeIso, finding: `Transitional UTPR Safe Harbour (option j): ${window.reason}`, evidence: ["SH_UTPR"] });
      }
      return out;
    },
  },
  {
    id: "OECD-GIR-ANNEX-C", authority: "OECD", instrument: "GIR (Sep 2026) Annex C — transitional penalty relief", effectiveFrom: "2024-01-01", effectiveTo: "2028-06-30", passages: ["LP-GIR26-ANNEX-C"],
    title: "Transitional penalty relief: reasonable measures documented for the GIR during the transition period", href: "/gir",
    test: ({ s, calcs }) => {
      const relief = penaltyRelief(groupOf(s), calcs, true, s.origin === "seed-default" ? 0 : 1);
      const open = relief.conditions.filter((c) => !c.met);
      return [{
        status: relief.status,
        finding: relief.transitionYear
          ? open.length ? `Transition year; open conditions — ${open.map((c) => c.label).join("; ")}.` : "Transition year; audit trail, dissemination register and sealed evidence support a reasonable-measures position."
          : "Outside the transition period — ordinary domestic penalty regime applies to GIR errors.",
        evidence: ["Annex C", "Evidence history"],
      }];
    },
  },
];

function groupOf(s: CaseSnapshot) {
  return GROUPS.find((g) => g.id === s.groupId) ?? DATA.group;
}

function domesticReqs(iso: string, s: CaseSnapshot): Req[] {
  const rules = RULES.filter((r) => r.jurisdiction === iso && r.status === "active");
  return rules.map((r) => ({
    id: r.id,
    authority: iso,
    instrument: `${r.source} · v${r.version}`,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
    title: `${iso} domestic: ${r.ruleType.replace(/-/g, " ")} — ${r.formula}`,
    href: "/rules",
    passages: passagesForRule(r.id).map((p) => p.id),
    test: ({ scoped }) => {
      const c = scoped.find((x) => x.iso === iso);
      const applies = r.effectiveFrom <= fyStart(s) && (!r.effectiveTo || r.effectiveTo >= fyStart(s));
      return [{
        status: applies ? "met" : "n/a",
        iso,
        finding: applies
          ? `${r.id} applies from ${r.effectiveFrom}${r.effectiveTo ? ` to ${r.effectiveTo}` : ""}. Engine parameters: ${Object.entries(r.parameters).map(([k, v]) => `${k}=${String(v)}`).join(", ") || "—"}.${c ? ` Jurisdiction posts ${eur(c.jurisdictionalTopUp)} top-up.` : ""}`
          : `${r.id} is not in force for ${s.fy}.`,
        evidence: [r.id],
      }];
    },
  }));
}

function packReq(c: JurCalc, s: CaseSnapshot): Req | null {
  const p = c.pack;
  if (!p) return null;
  return {
    id: `PACK-${c.iso}`,
    authority: c.iso,
    instrument: `${p.name} domestic Pillar Two law · effective ${p.from} · ${p.qualified}`,
    effectiveFrom: p.from,
    effectiveTo: null,
    title: `${p.name}: charging provisions in force (IIR ${p.iir ? "yes" : "no"} · QDMTT ${p.qdmtt ? "yes" : "no"}${p.qdmttSH ? " (QDMTT safe harbour)" : ""} · UTPR ${p.utpr ? "yes" : "no"})`,
    href: "/oecd-central-record",
    passages: ["LP-CR-1", ...passagesForJurisdiction(c.iso).filter((x) => x.textKind === "summary" || x.ref.startsWith("ss 9")).map((x) => x.id)],
    test: () => [{
      status: s.packOverlay[c.iso] ? "judgment" : "met",
      iso: c.iso,
      finding: `${p.filing}. FX ${p.fx}. ${p.notes}${s.packOverlay[c.iso] ? " Reviewer-accepted amendment overlays the signed Central Record — confirm the source before filing." : ""}`,
      evidence: [`Central Record ${c.iso}`],
    }],
  };
}

export function reviewComplianceFor(s: CaseSnapshot, calcs: JurCalc[], checks: CheckResult[], jurisdictions: string[]): ComplianceFinding[] {
  const scoped = calcs.filter((c) => jurisdictions.includes(c.iso));
  const ctx: Ctx = { s, calcs, scoped, checks, jurisdictions };
  const reqs: Req[] = [...OECD_REQS];
  for (const iso of jurisdictions) reqs.push(...domesticReqs(iso, s));
  for (const c of scoped) { const r = packReq(c, s); if (r) reqs.push(r); }

  const out: ComplianceFinding[] = [];
  for (const r of reqs) {
    const applies = r.effectiveFrom <= fyStart(s) && (!r.effectiveTo || r.effectiveTo >= fyStart(s));
    const results = r.test(ctx);
    results.forEach((res, i) => {
      out.push({
        id: `${r.id}${results.length > 1 ? `-${res.iso ?? i}` : ""}`,
        requirementId: r.id,
        authority: r.authority,
        instrument: r.instrument,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo,
        applies,
        status: applies ? res.status : "n/a",
        title: r.title,
        finding: res.finding,
        evidence: res.evidence,
        href: r.href,
        iso: res.iso,
        passages: r.passages,
      });
    });
  }

  // Thailand: OECD vs Revenue Department overlay from the shared gap engine.
  const th = scoped.find((c) => c.iso === "TH");
  if (th) {
    const gap = reviewOecdRdGap(th);
    for (const g of gap.items) {
      out.push({
        id: `TH-${g.id}`,
        requirementId: g.id,
        authority: "TH",
        instrument: `${g.rdCite} vs ${g.oecdCite}`,
        effectiveFrom: "2025-01-01",
        effectiveTo: null,
        applies: true,
        status: g.kind === "aligned" ? "met" : g.kind === "diverge" || g.kind === "calc-gap" ? "gap" : g.kind === "pending" ? "judgment" : "judgment",
        title: `Thailand ${g.area}: ${g.kind === "aligned" ? "aligned with OECD" : g.kind === "overlay" ? "domestic overlay on OECD" : g.kind === "diverge" ? "diverges from OECD" : g.kind === "pending" ? "pending domestic guidance" : "calculation gap"}`,
        finding: `${g.finding ?? g.ground} OECD: ${g.oecd} · RD: ${g.rd} · Action: ${g.action}`,
        evidence: g.refs.map((ref) => `${ref.label} ${ref.pin}`),
        href: g.href,
        iso: "TH",
        passages: [...new Set([...passagesForGap(g.id), ...resolveCitation(g.rdCite, "TH"), ...resolveCitation(g.oecdCite, "OECD")].map((p) => p.id))],
      });
    }
  }
  return out;
}

export function complianceSummary(rows: ComplianceFinding[]) {
  const applicable = rows.filter((r) => r.applies);
  return {
    total: applicable.length,
    met: applicable.filter((r) => r.status === "met").length,
    gap: applicable.filter((r) => r.status === "gap").length,
    judgment: applicable.filter((r) => r.status === "judgment").length,
    oecd: applicable.filter((r) => r.authority === "OECD").length,
    domestic: applicable.filter((r) => r.authority !== "OECD").length,
  };
}

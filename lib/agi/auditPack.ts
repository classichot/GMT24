/**
 * Deliverable Builder — the audit package. Assembles the executive summary,
 * election register, calculation summary, compliance findings, evidence index
 * and outstanding issues from the mission record. It never invents a number:
 * every figure is read from a recorded calculation run and every entry cites
 * evidence ids. Audit readiness describes the file, not the auditor's
 * conclusion.
 */
import { eur, pct } from "../format";
import { MISSION_STATE_LABEL, type AuditPack, type MissionRecord, type PackSection } from "./types";
import { shortHash } from "./case";
import { checkSummary } from "./verify";
import { complianceSummary } from "./compliance";
import { completionGate, openBlockers, openDecisions, uid } from "./mission";
import { labelElection } from "../evidenceHistory";

export function latestRun(m: MissionRecord) {
  return [...m.runs].reverse().find((r) => r.caseHash === m.case.hash) ?? m.runs[m.runs.length - 1];
}

export function buildAuditPack(m: MissionRecord): AuditPack {
  const run = latestRun(m);
  const s = m.case.snapshot;
  const cs = checkSummary(m.checks);
  const comp = complianceSummary(m.compliance);
  const gate = completionGate(m);
  const pkgDecision = m.decisions.find((d) => d.kind === "election-package" && d.status === "approved" && d.caseHash === m.case.hash);
  const chosen = pkgDecision && m.options?.options.find((o) => o.id === pkgDecision.chosen);
  const scopedRows = run ? run.rows.filter((r) => m.scope.jurisdictions.includes(r.iso)) : [];

  const sections: PackSection[] = [
    {
      id: "exec",
      title: "Executive summary",
      body: [
        `${s.groupName} · ${s.fy} · scope ${m.scope.jurisdictions.join(", ")} · case version ${shortHash(m.case.hash)} (mission ${m.id}, version ${m.version}).`,
        run ? `Engine ${run.engine} posts group jurisdictional top-up ${eur(run.totals.topUp)} (QDMTT ${eur(run.totals.qdmtt)} · IIR ${eur(run.totals.iir)} · UTPR ${eur(run.totals.utpr)}) from run ${run.id}.` : "No calculation run recorded on this case version.",
        chosen ? `Election package approved: ${chosen.title} (${pkgDecision.decidedBy}, ${pkgDecision.decidedAt}). FY top-up ${eur(chosen.fyTopUp)}; five-year signal ${eur(chosen.fy5)}.` : "Election package decision not yet approved on this case version.",
        `Verification: ${cs.passes} passed · ${cs.fails} failed (${cs.blocking} blocking) · ${cs.warns} warnings${m.verifiedAgainst === m.case.hash ? " — passed against the current case version." : " — not yet passed against the current case version."}`,
        `Compliance: ${comp.met} met · ${comp.gap} gaps · ${comp.judgment} judgments across ${comp.oecd} OECD and ${comp.domestic} domestic requirements.`,
        `Mission state: ${MISSION_STATE_LABEL[m.state]}. ${gate.ok ? "Completion gate satisfied." : `Completion gate open: ${gate.reasons.join(" ")}`}`,
        "This package describes the file GMT24 assembled. It does not predict or guarantee an auditor's or tax authority's conclusion.",
      ],
    },
    {
      id: "elections",
      title: "Election register",
      body: [
        m.options ? `${m.options.options.length} alternatives compared by ${m.options.method}` : "Election alternatives were not assessed.",
        ...(m.options ? m.options.options.filter((o) => o.rejectedBecause && o.id !== m.options!.recommendedId).map((o) => `Rejected — ${o.title}: ${o.rejectedBecause}`) : []),
      ],
      table: {
        head: ["Election", "Status", "Decision", "Case"],
        rows: [
          ...Object.entries(s.electionsOn).filter(([, v]) => v).map(([k]) => [labelElection(k), "on (working package)", "—", shortHash(m.case.hash)]),
          ...m.proposals.filter((p) => p.kind === "election" || p.kind === "sbie").map((p) => [p.title, p.status, p.decisionId ? `decision ${p.decisionId}` : "—", shortHash(p.caseHash)]),
        ],
      },
    },
    {
      id: "calc",
      title: "Calculation summary",
      body: run ? [`Run ${run.id} · inputs ${shortHash(run.inputsHash)} · ${run.inputs.ruleVersions.length} rule versions · ${run.ranAt}.`] : ["No run."],
      table: {
        head: ["Jurisdiction", "GloBE income", "Covered taxes", "ETR", "SBIE", "Top-up", "Collection"],
        rows: scopedRows.map((r) => [r.name, eur(r.globeIncome), eur(r.coveredTax), r.etrComputed ? pct(r.etr) : "n/a · loss", eur(r.sbie), eur(r.jurisdictionalTopUp), `Q ${eur(r.qdmtt)} · I ${eur(r.iir)} · U ${eur(r.utpr)}`]),
      },
    },
    {
      id: "checks",
      title: "Verification checks",
      body: [`${cs.total} checks. Failures list the concrete correction; warnings need a reviewer's judgment.`],
      table: {
        head: ["Check", "Status", "Expected", "Actual", "Rule"],
        rows: m.checks.filter((c) => c.status !== "pass").concat(m.checks.filter((c) => c.status === "pass")).map((c) => [c.title, `${c.status}${c.severity === "block" ? " (blocking)" : ""}`, c.expected, c.actual, c.rule ?? ""]),
      },
    },
    {
      id: "compliance",
      title: "Compliance findings",
      body: ["OECD Model Rules and domestic instruments are listed separately with effective dates. Where they differ, both are shown."],
      table: {
        head: ["Authority", "Instrument", "Effective", "Requirement", "Status", "Finding"],
        rows: m.compliance.filter((r) => r.applies).map((r) => [r.authority, r.instrument, `${r.effectiveFrom}${r.effectiveTo ? ` → ${r.effectiveTo}` : ""}`, r.title, r.status, r.finding]),
      },
    },
    {
      id: "decisions",
      title: "Decisions and approvals",
      body: m.decisions.length ? [] : ["No decisions recorded."],
      table: {
        head: ["Decision", "Requested by", "Status", "Chosen", "Decided by", "Case"],
        rows: m.decisions.map((d) => [d.title, d.requestedBy, d.status, d.options.find((o) => o.id === d.chosen)?.label ?? "—", d.decidedBy ? `${d.decidedBy} · ${d.decidedAt}` : "—", shortHash(d.caseHash)]),
      },
    },
  ];

  const outstanding = [
    ...openBlockers(m).map((b) => `${b.kind}: ${b.title} — ${b.detail}`),
    ...openDecisions(m).map((d) => `approval: ${d.title}`),
    ...m.checks.filter((c) => c.status === "fail").map((c) => `check failed: ${c.title}${c.correction ? ` — ${c.correction}` : ""}`),
    ...m.compliance.filter((r) => r.applies && r.status === "gap").map((r) => `compliance gap: ${r.title}`),
    ...m.proposals.filter((p) => p.status === "approved").map((p) => `approved, not yet applied in normal mode: ${p.title}`),
  ];

  const version = m.packs.filter((p) => p.missionId === m.id).length + 1;
  return {
    id: uid("pack"),
    missionId: m.id,
    caseHash: m.case.hash,
    builtAt: new Date().toISOString(),
    version,
    status: "draft",
    sections,
    evidenceIndex: m.evidence.map((e) => ({ id: e.id, kind: e.kind, title: e.title, hash: e.hash, refs: e.refs })),
    outstanding,
  };
}

export function packToMarkdown(p: AuditPack, m: MissionRecord): string {
  const lines: string[] = [`# GMT24 audit package · ${m.case.snapshot.groupName} ${m.case.snapshot.fy}`, "", `Mission ${m.id} · case ${p.caseHash} · pack v${p.version} (${p.status}) · built ${p.builtAt}`, ""];
  for (const s of p.sections) {
    lines.push(`## ${s.title}`, "");
    for (const b of s.body) lines.push(`- ${b}`);
    if (s.table) {
      lines.push("", `| ${s.table.head.join(" | ")} |`, `| ${s.table.head.map(() => "---").join(" | ")} |`);
      for (const r of s.table.rows) lines.push(`| ${r.map((c) => String(c).replace(/\|/g, "/")).join(" | ")} |`);
    }
    lines.push("");
  }
  lines.push("## Evidence index", "", "| # | Kind | Title | Hash | Refs |", "| --- | --- | --- | --- | --- |");
  p.evidenceIndex.forEach((e, i) => lines.push(`| ${i + 1} | ${e.kind} | ${e.title.replace(/\|/g, "/")} | ${e.hash} | ${e.refs.join(", ")} |`));
  lines.push("", "## Outstanding issues", "");
  if (!p.outstanding.length) lines.push("- None.");
  for (const o of p.outstanding) lines.push(`- ${o}`);
  return lines.join("\n");
}

/**
 * AGI wow-feature helpers: audit challenge, missing-evidence recovery,
 * automatic impact analysis, regulatory radar and mission replay.
 * None of these write approved numbers — they mark, challenge and propose.
 */
import { DATA } from "../model";
import { reviewDataset } from "../datasetGuideline";
import { describeCaseDiff } from "./case";
import { radarHits } from "./director";
import type { CaseSnapshot, CheckResult, MissionRecord } from "./types";

export type ChallengeFinding = {
  id: string;
  question: string;
  target: string;
  severity: "block" | "warn" | "info";
  status: "open" | "answered";
  evidence: string[];
  gap: string;
  href?: string;
};

export function auditChallenge(m: MissionRecord): ChallengeFinding[] {
  const out: ChallengeFinding[] = [];
  const s = m.case.snapshot;
  const classesNeed = s.entityIds.length > 0;
  if (classesNeed) {
    out.push({
      id: "ch-class",
      question: "What supports this classification?",
      target: "Entity test / GloBE class",
      severity: "warn",
      status: m.steps.find((x) => x.id === "context")?.status === "done" ? "answered" : "open",
      evidence: m.evidence.filter((e) => e.supports.includes("context")).map((e) => e.id),
      gap: "Each POPE, MOCE, JV and excluded entity needs the look-through chain and the article test.",
      href: "/entities",
    });
  }
  for (const el of m.scope.electionSet) {
    out.push({
      id: `ch-el-${el}`,
      question: "Does this election apply to this period?",
      target: el,
      severity: "info",
      status: m.options ? "answered" : "open",
      evidence: m.evidence.filter((e) => e.supports.includes("options")).map((e) => e.id),
      gap: "Eligibility, duration, revocation and GIR coding must be in force for the Fiscal Year.",
      href: "/elections",
    });
  }
  const failed = m.checks.filter((c) => c.status === "fail" && c.severity === "block");
  for (const c of failed.slice(0, 8)) {
    out.push({
      id: `ch-ck-${c.id}`,
      question: "Can this adjustment be traced to the underlying records?",
      target: c.title,
      severity: "block",
      status: "open",
      evidence: [],
      gap: c.correction ?? `${c.expected} vs ${c.actual}`,
      href: c.href,
    });
  }
  if (!m.packs.length) {
    out.push({
      id: "ch-pack",
      question: "Is the evidence package complete for material conclusions?",
      target: "Audit package",
      severity: "warn",
      status: "open",
      evidence: m.evidence.map((e) => e.id),
      gap: "Build the audit package and link evidence to every material number.",
      href: "/agi/audit-file",
    });
  }
  return out;
}

export type EvidenceClass = "verified" | "candidate" | "assumption" | "missing";

export type EvidenceGap = {
  id: string;
  title: string;
  klass: EvidenceClass;
  detail: string;
  request?: string;
  href?: string;
};

export function recoverEvidence(m: MissionRecord): EvidenceGap[] {
  const s = m.case.snapshot;
  const review = reviewDataset(s.ingestStatus === "ready" ? DATA.files : null, [], DATA.issues);
  const gaps: EvidenceGap[] = [];
  for (const item of review.items.filter((i) => i.status !== "posted")) {
    gaps.push({
      id: `ev-${item.slot.id}`,
      title: item.slot.title,
      klass: item.status === "queued" ? "candidate" : item.status === "incomplete" ? "assumption" : "missing",
      detail: item.note,
      request: item.status === "missing" ? `Please provide ${item.slot.title} for ${s.fy} (${s.groupName}).` : undefined,
      href: "/data",
    });
  }
  for (const c of m.checks.filter((x) => x.status === "fail")) {
    gaps.push({
      id: `ev-ck-${c.id}`,
      title: c.title,
      klass: "missing",
      detail: c.correction ?? `${c.expected} vs ${c.actual}`,
      request: `Source document or mapping that supports: ${c.title}.`,
      href: c.href,
    });
  }
  if (!gaps.length) {
    gaps.push({ id: "ev-ok", title: "Required slots posted", klass: "verified", detail: review.headline, href: "/data" });
  }
  return gaps;
}

export type ImpactReport = {
  drifted: boolean;
  changes: string[];
  reopen: string[];
  specialists: string[];
  note: string;
};

export function impactAnalysis(m: MissionRecord, live: CaseSnapshot): ImpactReport {
  const changes = describeCaseDiff(m.case.snapshot, live);
  const reopen: string[] = [];
  const specialists: string[] = [];
  if (changes.some((c) => /election/i.test(c))) { reopen.push("options", "scenario", "verify"); specialists.push("harbours", "topup"); }
  if (changes.some((c) => /map|data|ingest/i.test(c))) { reopen.push("readiness", "verify"); specialists.push("data", "globe"); }
  if (changes.some((c) => /rule|pack/i.test(c))) { reopen.push("compliance", "verify"); specialists.push("rules", "review"); }
  if (changes.length && !reopen.length) { reopen.push("verify", "compliance"); specialists.push("review"); }
  return {
    drifted: changes.length > 0,
    changes,
    reopen,
    specialists: [...new Set(specialists)],
    note: changes.length
      ? `Live case differs in ${changes.length} way(s). Dependent outputs need refresh; closed results stay on the pinned version until you rebase.`
      : "Live case matches the pinned version. No rerun required.",
  };
}

export function replayInputs(m: MissionRecord) {
  const run = m.runs[m.runs.length - 1];
  return {
    missionId: m.id,
    caseHash: m.case.hash,
    engine: run?.engine ?? "GMT24-CALC",
    fy: m.scope.fy,
    electionsOn: run?.inputs.electionsOn ?? m.case.snapshot.electionsOn,
    ruleVersions: run?.inputs.ruleVersions ?? m.case.snapshot.ruleVersions,
    dataVersion: run?.inputs.dataVersion ?? m.case.hash,
    reproduced: Boolean(run),
    note: "Exact reproduction applies to the calculation. Regenerated AI wording may differ.",
  };
}

export function checksOutstanding(checks: CheckResult[]) {
  return checks.filter((c) => c.status === "fail" && c.severity === "block");
}

export { radarHits };

import type { PackAmendment } from "../packAmendments";
import { activeQuestions, findingStatus, type XrayFinding, type XrayState } from "../xray";
import type { Fact, FactStatus } from "./types";

/**
 * Evidence and fact registry.
 *
 * A fact is one answered X-Ray question (or a manually / document-derived
 * statement) scoped to entity, period and topic. Facts are shared: the
 * Interviewer records them, the Specialist and Reviewer read them, the Rehearsal
 * challenges them and the Briefing counts them. A fact is only "confirmed" when
 * an accountable person has signed the finding; an answer alone is "proposed".
 */
export type FactInput = {
  findings: XrayFinding[];
  xray: XrayState;
  fy: string;
  manual: Fact[];
  packAmendments: PackAmendment[];
};

export function factKey(engine: string, questionId: string, entityId: string, fy: string) {
  return `${engine}:${questionId}:${entityId}:${fy}`;
}

function dependentsFor(f: XrayFinding) {
  return [f.area, `${f.jurisdiction} ETR`, `${f.jurisdiction} top-up`, f.id];
}

export function factsFromXray(findings: XrayFinding[], xray: XrayState, fy: string, packAmendments: PackAmendment[]): Fact[] {
  const out: Fact[] = [];
  for (const f of findings) {
    const r = xray[f.id];
    const answers = r?.answers ?? {};
    const status = findingStatus(f, r);
    for (const q of activeQuestions(f, answers)) {
      const v = answers[q.id];
      const opt = f.questions.find((x) => x.id === q.id)?.options.find((o) => o.value === v);
      let st: FactStatus = v ? (r?.preparer ? "confirmed" : "proposed") : "open";
      let reason: string | undefined;
      // A later change to the jurisdiction's pack after the fact was recorded means the
      // dependent calculation moved under it — flag for reassessment, do not drop.
      const packMoved = packAmendments.some((a) => a.status === "accepted" && a.iso === f.iso && a.decidedAt && r?.at && a.decidedAt > r.at);
      if (st === "confirmed" && packMoved) {
        st = "reassess";
        reason = `Jurisdiction pack for ${f.jurisdiction} changed after this fact was confirmed.`;
      }
      out.push({
        id: factKey(f.engine, q.id, f.entityId, fy),
        topic: f.area,
        engine: f.engine,
        questionId: q.id,
        entityId: f.entityId,
        entityCode: f.entityCode,
        iso: f.iso,
        fy,
        statement: q.prompt,
        value: opt?.label ?? v ?? "",
        status: st,
        owner: f.owner,
        confirmedBy: r?.preparer ?? null,
        reviewedBy: r?.reviewer ?? null,
        at: r?.at ?? "",
        evidence: r?.evidence ?? [],
        source: "xray",
        dependents: dependentsFor(f),
        findingId: f.id,
        href: `/xray/confirm?finding=${f.id}`,
        reason: reason ?? (status === "unsupported" ? "Required evidence not attached." : undefined),
      });
    }
  }
  return out;
}

export function allFacts(i: FactInput): Fact[] {
  const derived = factsFromXray(i.findings, i.xray, i.fy, i.packAmendments);
  const manual = i.manual.map((m) => (m.fy !== i.fy ? { ...m, status: "expired" as FactStatus, reason: `Recorded for ${m.fy}; the working year is ${i.fy}.` } : m));
  return [...derived, ...manual];
}

/**
 * Reuse: a confirmed answer to the same question for the same entity and year is
 * valid for any other finding that asks it — the user is not asked twice.
 */
export function reusableAnswer(facts: Fact[], engine: string, questionId: string, entityId: string, fy: string): Fact | null {
  const hit = facts.find((f) => f.id === factKey(engine, questionId, entityId, fy) && f.status === "confirmed");
  return hit ?? null;
}

export function factSummary(facts: Fact[]) {
  const by = (s: FactStatus) => facts.filter((f) => f.status === s).length;
  return {
    total: facts.length,
    confirmed: by("confirmed"),
    proposed: by("proposed"),
    open: by("open"),
    expired: by("expired"),
    reassess: by("reassess"),
  };
}

export function factsFor(facts: Fact[], filter: { iso?: string | null; entityId?: string | null; topic?: string | null }) {
  return facts.filter((f) =>
    (!filter.iso || f.iso === filter.iso)
    && (!filter.entityId || f.entityId === filter.entityId)
    && (!filter.topic || f.topic === filter.topic),
  );
}

export const FACT_LABEL: Record<FactStatus, string> = {
  confirmed: "Confirmed",
  proposed: "Answered · unsigned",
  open: "Open",
  expired: "Expired",
  reassess: "Reassess",
};

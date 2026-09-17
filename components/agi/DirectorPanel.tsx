"use client";

import { useMemo } from "react";
import { planOf } from "@/lib/agi/director";
import { AUTONOMY_LABEL, WORK_MODE_LABEL } from "@/lib/agi/specialists";
import type { MissionRecord } from "@/lib/agi/types";

export function useDirectorPlan(m: MissionRecord) {
  return useMemo(() => planOf(m), [m]);
}

export function ModeTags({ m }: { m: MissionRecord }) {
  const plan = useDirectorPlan(m);
  return (
    <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
      <span className="tag tag-accent">{WORK_MODE_LABEL[plan.mode].label}</span>
      <span className="tag tag-outline">{AUTONOMY_LABEL[plan.autonomy].label}</span>
      <span className="tag tag-neutral">cap {plan.agentCap}</span>
    </span>
  );
}

export function Briefing({ m }: { m: MissionRecord }) {
  const plan = useDirectorPlan(m);
  return (
    <div className="callout">
      <strong>Mission Director.</strong> {plan.briefing}
      {plan.blockers.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          {plan.blockers.map((b) => <li key={b}>{b}</li>)}
        </ul>
      )}
    </div>
  );
}

export function TeamTable({ m }: { m: MissionRecord }) {
  const plan = useDirectorPlan(m);
  return (
    <table className="table">
      <thead><tr><th>Specialist</th><th>Objective</th><th>Output</th><th>Depends</th><th>Reviewer</th><th>Why</th></tr></thead>
      <tbody>
        {plan.cards.map((c) => (
          <tr key={c.id}>
            <td>
              <strong>{c.title}</strong>
              <div className="agi-mono" style={{ color: "var(--color-neutral-600)" }}>{c.id} · {c.role}</div>
            </td>
            <td>{c.objective}</td>
            <td>{c.output}</td>
            <td className="agi-mono">{c.dependencies.join(", ") || "—"}</td>
            <td>{c.reviewer}</td>
            <td>{c.why}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CompletionList({ m }: { m: MissionRecord }) {
  const plan = useDirectorPlan(m);
  return (
    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
      {plan.completion.map((c) => <li key={c}>{c}</li>)}
    </ul>
  );
}


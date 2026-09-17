"use client";

import { OBJECTIVE_LABEL } from "@/lib/agi/mission";
import type { MissionObjectives } from "@/lib/agi/types";

const KEYS = Object.keys(OBJECTIVE_LABEL) as (keyof MissionObjectives)[];

/** Company objective weights (0–5). The ranking reflects these; the engine figures never change with them. */
export function ObjectiveSliders({ value, onChange, disabled }: { value: MissionObjectives; onChange: (v: MissionObjectives) => void; disabled?: boolean }) {
  return (
    <div className="agi-weights">
      {KEYS.map((k) => (
        <label key={k} className="agi-weight">
          <span>
            <strong>{OBJECTIVE_LABEL[k].label}</strong>
            <span style={{ display: "block", color: "var(--color-neutral-600)", fontSize: 11 }}>{OBJECTIVE_LABEL[k].hint}</span>
          </span>
          <input type="range" min={0} max={5} step={1} value={value[k]} disabled={disabled} onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) })} aria-label={OBJECTIVE_LABEL[k].label} />
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, textAlign: "right" }}>{value[k]}</span>
        </label>
      ))}
    </div>
  );
}

export function ScoreBars({ s }: { s: { taxCash: number; complianceEffort: number; evidenceSupport: number; uncertainty: number; futureRestriction: number } }) {
  return (
    <span className="agi-score" title={KEYS.map((k) => `${OBJECTIVE_LABEL[k].label} ${(s[k] * 100).toFixed(0)}`).join(" · ")}>
      {KEYS.map((k) => <i key={k} className={s[k] >= 0.7 ? "hi" : ""} style={{ height: `${Math.max(2, Math.round(s[k] * 14))}px` }} />)}
    </span>
  );
}

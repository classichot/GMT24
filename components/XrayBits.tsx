"use client";

import { SEVERITY_LABEL, STATUS_LABEL, type XraySeverity, type XrayStatus } from "@/lib/xray";

/** Confidence bar. Colour follows the score, not the severity of any one finding. */
export function ScoreBar({ score, width = 120 }: { score: number; width?: number }) {
  const tone = score >= 90 ? "var(--color-ok)" : score >= 75 ? "var(--color-warn)" : "var(--color-hot)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span className="bar-track" style={{ width, flex: "none" }}>
        <span className="bar-fill" style={{ width: `${Math.max(2, score)}%`, background: tone, display: "block", height: "100%" }} />
      </span>
      <span className="mono" style={{ fontWeight: 800, minWidth: 38, textAlign: "right" }}>{score}%</span>
    </span>
  );
}

export function StatusTag({ status }: { status: XrayStatus }) {
  const cls = status === "resolved"
    ? "tag tag-accent"
    : status === "awaiting-review"
      ? "tag tag-warn"
      : "tag tag-outline";
  return <span className={cls} style={{ whiteSpace: "nowrap" }}>{STATUS_LABEL[status]}</span>;
}

export function SeverityTag({ severity }: { severity: XraySeverity }) {
  const cls = severity === "material" ? "tag tag-hot" : severity === "significant" ? "tag tag-warn" : "tag tag-neutral";
  return <span className={cls} style={{ whiteSpace: "nowrap" }}>{SEVERITY_LABEL[severity]}</span>;
}

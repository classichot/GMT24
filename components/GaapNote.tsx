"use client";

import Link from "next/link";
import type { Entity } from "@/lib/model";
import { gaapSummary } from "@/lib/gaapMark";

/**
 * Jurisdiction-level GAAP mark: which accounting standard FANIL is computed on
 * (UPE CFS Art. 3.1.1 vs acceptable local GAAP Art. 3.1.3).
 */
export function GaapNote({
  entities,
  electionsOn,
  compact,
}: {
  entities: Entity[];
  electionsOn?: Record<string, boolean>;
  compact?: boolean;
}) {
  const s = gaapSummary(entities, electionsOn);
  return (
    <div className="text-muted" style={{ fontSize: compact ? 11 : 12, display: "flex", flexWrap: "wrap", gap: compact ? 6 : 10, alignItems: "center" }}>
      <span className={`tag ${s.used === "upe" ? "tag-outline" : "tag-accent"}`} style={{ fontSize: 10 }}>GAAP</span>
      <span title={s.rows.map((r) => `${r.code}: ${r.gaap} · ${r.detail}`).join("\n")}>{s.label}</span>
      <Link href="/fx">{s.localAvailable && s.localUsed === 0 ? "Elect Art. 3.1.3" : "FANIL GAAP"}</Link>
    </div>
  );
}

export function gaapShort(entities: Entity[], electionsOn?: Record<string, boolean>) {
  const s = gaapSummary(entities, electionsOn);
  return s.standards.join(" / ") || "—";
}

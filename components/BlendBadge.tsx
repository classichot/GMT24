"use client";

import type { BlendKind } from "@/lib/entityClass";

const META: Record<string, { label: string; color: string; title: string }> = {
  mosg: { label: "MOSG", color: "var(--color-accent-400)", title: "Minority-Owned Subgroup — blended separately from majority CEs (Art. 5.1.3)" },
  moce: { label: "MOCE", color: "var(--color-accent-400)", title: "Minority-Owned Constituent Entity — separate blend, UPE ownership ≤ 30% (Art. 5.1.3)" },
  jv:   { label: "JV",   color: "#7c6ee0",                title: "Joint Venture Group — treated as a separate MNE for ETR (Art. 6.4)" },
  stateless: { label: "Stateless", color: "#c0852a",       title: "Stateless CE — each is its own jurisdiction (Art. 10.1 definition)" },
  investment: { label: "IE",  color: "#2a8c6e",            title: "Investment Entity — separate ETR computation (Art. 7.5 / 7.6)" },
};

type BlendLike = { iso: string; blendKey: string; blendKind: BlendKind; name: string; entities: { code: string }[] };

/** Every ETR group (blend) the engine posts for this jurisdiction, main first. */
export function blendsForIso<T extends BlendLike>(calcs: T[], iso: string): T[] {
  return calcs.filter((c) => c.iso === iso).sort((a, b) => Number(b.blendKind === "main") - Number(a.blendKind === "main"));
}

export function blendSplitText(calcs: BlendLike[], iso: string): string {
  return blendsForIso(calcs, iso).map((c) => `${c.name} (${c.entities.map((e) => e.code).join(", ") || "no CE"})`).join(" · ");
}

/**
 * Shown on the main blend when a jurisdiction is split into several ETR groups
 * (majority CEs, JV Group, Investment Entity, MOCE / MOSG, Stateless) so country-level
 * views make the Art. 5.1 / 6.4 / 7.5 separation visible.
 */
export function EtrGroupsBadge({ calc, calcs }: { calc: BlendLike; calcs: BlendLike[] }) {
  const rows = blendsForIso(calcs, calc.iso);
  if (rows.length < 2 || calc.blendKind !== "main") return null;
  return (
    <span
      title={`${rows.length} separate ETR groups in ${calc.iso} — not blended: ${blendSplitText(calcs, calc.iso)}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "2px 6px",
        borderRadius: 3,
        border: "1px solid var(--color-accent)",
        color: "var(--color-accent)",
        marginLeft: 6,
        verticalAlign: "middle",
        lineHeight: 1.4,
        cursor: "default",
        whiteSpace: "nowrap",
      }}
    >
      {rows.length} ETR groups
    </span>
  );
}

export function BlendBadge({ blendKind }: { blendKind: BlendKind }) {
  const m = META[blendKind];
  if (!m) return null;
  return (
    <span
      title={m.title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "2px 6px",
        borderRadius: 3,
        background: m.color,
        color: "#fff",
        marginLeft: 6,
        verticalAlign: "middle",
        lineHeight: 1.4,
        cursor: "default",
      }}
    >
      {m.label}
    </span>
  );
}

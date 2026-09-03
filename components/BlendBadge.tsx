"use client";

import type { BlendKind } from "@/lib/entityClass";

const META: Record<string, { label: string; color: string; title: string }> = {
  mosg: { label: "MOSG", color: "var(--color-accent-400)", title: "Minority-Owned Subgroup — blended separately from majority CEs (Art. 5.1.3)" },
  moce: { label: "MOCE", color: "var(--color-accent-400)", title: "Minority-Owned Constituent Entity — separate blend, UPE ownership ≤ 30% (Art. 5.1.3)" },
  jv:   { label: "JV",   color: "#7c6ee0",                title: "Joint Venture Group — treated as a separate MNE for ETR (Art. 6.4)" },
  stateless: { label: "Stateless", color: "#c0852a",       title: "Stateless CE — each is its own jurisdiction (Art. 10.1 definition)" },
  investment: { label: "IE",  color: "#2a8c6e",            title: "Investment Entity — separate ETR computation (Art. 7.5 / 7.6)" },
};

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

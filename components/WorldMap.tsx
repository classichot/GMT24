"use client";

import { useId } from "react";
import { WORLD_BORDERS, WORLD_LAND } from "@/lib/world-paths";

export function WorldMap() {
  const uid = useId().replace(/:/g, "");
  const ocean = `${uid}-ocean`;
  const vignette = `${uid}-vignette`;

  return (
    <svg className="world-map" viewBox="0 0 360 180" preserveAspectRatio="none" aria-hidden>
      <defs>
        <radialGradient id={ocean} cx="48%" cy="42%" r="68%">
          <stop offset="0%" stopColor="var(--color-surface)" />
          <stop offset="100%" stopColor="var(--color-bg)" />
        </radialGradient>
        <radialGradient id={vignette} cx="50%" cy="46%" r="72%">
          <stop offset="40%" stopColor="transparent" />
          <stop offset="100%" stopColor="var(--color-bg)" />
        </radialGradient>
      </defs>
      <rect width="360" height="180" fill={`url(#${ocean})`} />
      <g className="world-land" fillRule="evenodd">
        {WORLD_LAND.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g className="world-borders">
        {WORLD_BORDERS.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <rect width="360" height="180" fill={`url(#${vignette})`} pointerEvents="none" />
    </svg>
  );
}

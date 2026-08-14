"use client";

import { useStore } from "@/lib/store";
import { eur, pct } from "@/lib/format";
import type { AuditNode } from "@/lib/engine";

export function Amount({
  n,
  audit,
  compact,
  className,
}: {
  n: number;
  audit?: AuditNode;
  compact?: boolean;
  className?: string;
}) {
  const { openAudit } = useStore();
  const label = n !== 0 && Math.abs(n) <= 1 && Math.abs(n) > 0 && n < 2 ? pct(n, 2) : eur(n, compact);
  if (!audit) return <span className={className}>{label}</span>;
  return (
    <button
      type="button"
      className={`amt ${className ?? ""}`}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        openAudit(audit);
      }}
      title="Open audit trail — rule → entity → account → source"
    >
      {label}
    </button>
  );
}

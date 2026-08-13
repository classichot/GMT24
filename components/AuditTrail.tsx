"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { eur, pct } from "@/lib/format";
import type { AuditNode } from "@/lib/engine";

function Step({ node, depth = 0 }: { node: AuditNode; depth?: number }) {
  const value =
    node.amount == null
      ? null
      : node.amount <= 1 && node.amount > 0 && node.kind === "formula" && node.label.toLowerCase().includes("etr")
        ? pct(node.amount, 2)
        : node.amount <= 1 && node.amount >= 0 && node.label.toLowerCase().includes("rate")
          ? pct(node.amount, 2)
          : eur(node.amount);
  return (
    <div className="audit-step" style={{ marginLeft: depth ? 8 : 0 }}>
      <div className="audit-k" style={{ fontSize: 13 }}>{node.label}{value != null ? ` · ${value}` : ""}</div>
      <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>{node.detail}</div>
      {(node.ruleId || node.sourceFile) && (
        <div style={{ marginTop: 6, fontSize: 11 }}>
          {node.ruleId && <Link href="/rulebook" className="tag tag-accent mono" onClick={(e) => e.stopPropagation()}>Rule {node.ruleId} · {node.ruleVersion}</Link>}
          {node.sourceFile && <Link href="/data" className="tag tag-neutral" style={{ marginLeft: 6 }} onClick={(e) => e.stopPropagation()}>{node.sourceFile}</Link>}
        </div>
      )}
      {node.children?.map((c) => <Step key={c.id} node={c} depth={depth + 1} />)}
    </div>
  );
}

export function AuditTrail() {
  const { audit, closeAudit } = useStore();
  if (!audit) return null;
  return (
    <div className="drawer-shell no-print" onClick={closeAudit}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-accent)" }}>One-click audit trail</div>
            <h4 style={{ margin: 0 }}>{audit.label}</h4>
          </div>
          <button className="icon-btn" onClick={closeAudit} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="panel-body">
          <p className="text-muted" style={{ fontSize: 13 }}>
            Click any euro amount in GMT24 to walk from the result to the ledger and the uploaded source file. The engine is deterministic — this is not an LLM estimate.
          </p>
          <Step node={audit} />
        </div>
      </div>
    </div>
  );
}

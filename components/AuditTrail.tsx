"use client";

import { Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useAi } from "@/components/AiProvider";
import { eur, pct } from "@/lib/format";
import type { AuditNode, JurCalc } from "@/lib/engine";

function Step({ node, depth = 0, onExplain }: { node: AuditNode; depth?: number; onExplain: (n: AuditNode) => void }) {
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
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div className="audit-k" style={{ fontSize: 13, flex: 1 }}>{node.label}{value != null ? ` · ${value}` : ""}</div>
        {node.amount != null && depth > 0 && <button className="btn btn-ghost" style={{ fontSize: 11, padding: "0 4px" }} title="Explain this number with the Co-Pilot" onClick={(e) => { e.stopPropagation(); onExplain(node); }}><Sparkles size={11} /> Explain</button>}
      </div>
      <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>{node.detail}</div>
      {(node.ruleId || node.sourceFile) && (
        <div style={{ marginTop: 6, fontSize: 11 }}>
          {node.ruleId && <Link href="/rulebook" className="tag tag-accent mono" onClick={(e) => e.stopPropagation()}>Rule {node.ruleId} · {node.ruleVersion}</Link>}
          {node.sourceFile && <Link href="/data" className="tag tag-neutral" style={{ marginLeft: 6 }} onClick={(e) => e.stopPropagation()}>{node.sourceFile}</Link>}
        </div>
      )}
      {node.children?.map((c) => <Step key={c.id} node={c} depth={depth + 1} onExplain={onExplain} />)}
    </div>
  );
}

export function AuditTrail() {
  const { audit, closeAudit, setCopilotOpen } = useStore();
  const ai = useAi();
  if (!audit) return null;
  const calc: JurCalc | undefined = ai.calcs.find((c) => c.audit === audit) ?? ai.calcs.find((c) => contains(c.audit, audit.id));
  const explain = (n: AuditNode) => { ai.explain(n, calc); setCopilotOpen(true); };
  return (
    <div className="drawer-shell no-print" onClick={closeAudit}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-accent)" }}>One-click audit trail</div>
            <h4 style={{ margin: 0 }}>{audit.label}</h4>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button className="btn btn-secondary" style={{ fontSize: 12 }} title="Ask the Co-Pilot to explain this amount: inputs, rules applied, sources, what would change it" onClick={() => explain(audit)}><Sparkles size={13} /> Explain this number</button>
            <button className="icon-btn" onClick={closeAudit} aria-label="Close"><X size={18} /></button>
          </div>
        </div>
        <div className="panel-body">
          <p className="text-muted" style={{ fontSize: 13 }}>
            Every GMT24 amount is posted by the deterministic engine. This trail walks the amount → OECD rule (id + version) → entity → account → uploaded source file. The LLM never posts FANIL, GloBE income, Covered Taxes, or ETR.
          </p>
          <Step node={audit} onExplain={explain} />
        </div>
      </div>
    </div>
  );
}

function contains(n: AuditNode, id: string): boolean {
  if (n.id === id) return true;
  return (n.children ?? []).some((c) => contains(c, id));
}

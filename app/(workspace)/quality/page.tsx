"use client";

import { ISSUES, ACCOUNTS } from "@/lib/model";
import { useStore } from "@/lib/store";
import Link from "next/link";
import { useCalc } from "@/lib/useCalc";

export default function QualityPage() {
  const { approvedMaps } = useStore();
  const { t } = useCalc();
  const mapped = ACCOUNTS.filter((a) => a.approved || approvedMaps[a.account]).length;
  const readiness = Math.min(99, t.readiness + mapped);
  return (
    <div>
      <div className="grid-score" style={{ marginBottom: 24 }}>
        <div className="panel" style={{ padding: 24, textAlign: "center" }}>
          <div className="kpi-label">Pillar Two Data Readiness</div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 72, lineHeight: 1, margin: "12px 0 4px" }}>{readiness}%</div>
          <p className="text-muted">{ISSUES.filter((i) => i.severity === "block").length} issues must be resolved before lock. {mapped}/{ACCOUNTS.length} sample accounts mapped.</p>
        </div>
        <div className="panel">
          <div className="panel-head"><h4>Validation engine</h4><div className="stack-actions"><Link href="/mapping" className="btn btn-ghost">Mapping</Link><Link href="/requests" className="btn btn-ghost">Gap Hunter</Link></div></div>
          <div>
            {ISSUES.map((i) => (
              <div key={i.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--color-divider)" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span className={i.severity === "block" ? "tag tag-hot" : i.severity === "warn" ? "tag tag-warn" : "tag tag-neutral"}>{i.severity}</span>
                  <strong>{i.title}</strong>
                </div>
                <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>{i.detail}</div>
                <div style={{ fontSize: 11, marginTop: 6 }}>{i.area} · {i.jurisdiction} · owner {i.owner}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

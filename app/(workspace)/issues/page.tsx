"use client";

import { ISSUES } from "@/lib/model";
import { useStore } from "@/lib/store";
import Link from "next/link";

export default function IssuesPage() {
  const { flash, workflow, patchWorkflow } = useStore();
  const reviewer = [
    { t: "Ireland KDB vs SBTISH", d: "AI Reviewer: KDB is an IP box, not a substance-based incentive. Do not elect SBTISH. Unusual vs Hungary development allowance." },
    { t: "Vietnam ETR movement", d: "Covered tax −4% vs FY2025 GIR with no deferred-tax opening balance. Unexplained movement." },
    { t: "Singapore harbour", d: "Simplified ETR 16% sits between 15% GloBE min and 17% transitional CbCR rate. Inconsistent to treat as a clean pass." },
    { t: "Hong Kong negative tax", d: "AI Reviewer: Bare Art. 5.2.1 on −$120k / $800k is a −15% ETR and 30% Top-up %. That is not the filing answer. OECD Feb 2023 AG requires Excess Negative Tax Expense — ETR 0%, Top-up % 15%, $120k carry-forward. 15% is the Minimum Rate, not a second layer on a negative ETR." },
  ];
  return (
    <div className="grid-split">
      <div className="panel">
        <div className="panel-head"><h4>Open issues</h4><Link href="/requests" className="btn btn-ghost">Send requests</Link></div>
        {ISSUES.map((i) => (
          <div key={i.id} style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-divider)" }}>
            <span className={i.severity === "block" ? "tag tag-hot" : i.severity === "warn" ? "tag tag-warn" : "tag-neutral tag"}>{i.severity}</span>{" "}
            <strong>{i.title}</strong>
            <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>{i.detail}</div>
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="panel-head"><h4>AI Pillar Two Reviewer</h4><button className="btn btn-secondary" onClick={() => { patchWorkflow({ reviewerRan: true }); flash("Second-level review re-run against current snapshot"); }}>Re-run</button></div>
        {workflow.reviewerRan && <div className="text-muted" style={{ padding: "8px 16px", fontSize: 12 }}>Last run against current calculation snapshot.</div>}
        {reviewer.map((r) => (
          <div key={r.t} style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-divider)" }}>
            <strong>{r.t}</strong>
            <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>{r.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

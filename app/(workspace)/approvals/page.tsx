"use client";

import { useStore } from "@/lib/store";

const STEPS = ["Imported", "Mapped", "Validated", "Calculated", "Prepared", "Reviewed", "Approved", "Filed", "Locked"];

export default function ApprovalsPage() {
  const { mode, flash } = useStore();
  const current = 5;
  return (
    <div>
      <div className="callout" style={{ marginBottom: 16 }}>
        GMT24 behaves like professional tax software. Preparer / reviewer segregation is on.
        {mode === "advisor" ? " Advisor signs as engagement reviewer; client preparer remains on the entity." : " Group Tax Director is reviewer; local tax is preparer."}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {STEPS.map((s, i) => (
          <span key={s} className={i <= current ? "status-in" : "status-out"}>{s}</span>
        ))}
      </div>
      <div className="stack-actions">
        <button className="btn btn-secondary" onClick={() => flash("Returned to preparer with comments")}>Return</button>
        <button className="btn btn-primary" onClick={() => flash("FY2026 calculation approved (reviewer lock)")}>Approve snapshot</button>
      </div>
    </div>
  );
}

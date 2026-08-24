"use client";

import { useState } from "react";
import Link from "next/link";
import { ThaiPackBar } from "@/components/ThaiPackBar";
import { THAI_CLASSIFICATIONS } from "@/lib/thailand";
import { useStore } from "@/lib/store";

const TREE = [
  { n: "01", title: "Located in Thailand?", body: "Place of creation, or PE in Thailand, or dual-resident tie-breaker." },
  { n: "02", title: "Constituent Entity?", body: "Included in UPE consolidation, or excluded solely on size / materiality / fair-value grounds." },
  { n: "03", title: "Permanent establishment category", body: "Four PE categories under Notification No. 3 — fixed place, construction, agency, deemed." },
  { n: "04", title: "Dual residence?", body: "Treaty tie-breaker. If the treaty does not resolve, covered-tax-paid test, then SBIE-based tie-breaker." },
  { n: "05", title: "Flow-through / tax-transparent?", body: "Allocate to owners unless the entity is treated as a CE in its location." },
  { n: "06", title: "Excluded Entity? (No. 7)", body: "Government, international organisation, non-profit, pension, investment entity / insurance IE." },
  { n: "07", title: "Special (No. 8)", body: "MOCE (UPE ownership ≤ 30%, separate ETR), investment entity, stateless CE, JV and JV subsidiaries (Art. 6.4), multi-parent, POPE (IIR first × Inclusion Ratio)." },
];

export default function ThaiEntitiesPage() {
  const { ask } = useStore();
  const [id, setId] = useState(THAI_CLASSIFICATIONS[0].id);
  const row = THAI_CLASSIFICATIONS.find((c) => c.id === id) ?? THAI_CLASSIFICATIONS[0];

  return (
    <div>
      <ThaiPackBar />
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Thai Entity Classification and Situs Engine.</strong> More than an ownership chart. Every result stores the effective period, facts, evidence, Thai provision, OECD interpretation and reviewer approval. DG Notifications No. 3, 7 and 8.
        </div>
        <div className="stack-actions">
          <Link href="/entities" className="btn btn-secondary">Group entities</Link>
          <Link href="/graph" className="btn btn-secondary">Ownership graph</Link>
          <button className="btn btn-primary" onClick={() => ask("How is the Rayong PE classified for Thai Pillar Two?")}>Ask GMT24</button>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {TREE.map((s) => (
          <div key={s.n} className="panel">
            <div className="panel-body">
              <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-accent)", fontWeight: 700 }}>{s.n}</div>
              <h4 style={{ margin: "8px 0 6px" }}>{s.title}</h4>
              <p className="text-muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      <select className="input" style={{ maxWidth: 480, marginBottom: 16 }} value={id} onChange={(e) => setId(e.target.value)}>
        {THAI_CLASSIFICATIONS.map((c) => <option key={c.id} value={c.id}>{c.result}</option>)}
      </select>

      <div className="panel">
        <div className="panel-head">
          <h4>{row.result}</h4>
          <span className={`tag ${row.status === "Reviewed" ? "tag-ok" : "tag-warn"}`}>{row.status}</span>
        </div>
        <div className="panel-body waterfall">
          <div className="wf-row"><span>Effective period</span><span>{row.period}</span></div>
          <div className="wf-row"><span>Facts relied upon</span><span style={{ maxWidth: 520, textAlign: "right" }}>{row.facts}</span></div>
          <div className="wf-row"><span>Evidence</span><span>{row.evidence}</span></div>
          <div className="wf-row"><span>Thai legal provision</span><span>{row.thai}</span></div>
          <div className="wf-row"><span>OECD interpretation</span><span>{row.oecd}</span></div>
          <div className="wf-row"><span>Reviewer</span><span>{row.reviewer}</span></div>
        </div>
      </div>
    </div>
  );
}

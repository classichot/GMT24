"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { INCENTIVES, ENTITIES } from "@/lib/model";
import { useStore } from "@/lib/store";

export default function IncentivesPage() {
  const { ask, setScenario } = useStore();
  const router = useRouter();
  return (
    <div>
      <div className="callout" style={{ marginBottom: 16 }}>
        Upload a BOI certificate. GMT24 extracts type, dates, holiday / reduced rate, conditions and credits, then decides which tax and accounting inputs feed Pillar Two. The 2026 package adds the Substance-based Tax Incentive Safe Harbour — incentive records are therefore versioned.
      </div>
      {INCENTIVES.map((i) => {
        const e = ENTITIES.find((x) => x.id === i.entityId);
        return (
          <div key={i.id} className="panel" style={{ marginBottom: 12 }}>
            <div className="panel-head">
              <div>
                <h4 style={{ margin: 0 }}>{i.name}</h4>
                <div className="text-muted" style={{ fontSize: 12 }}>{e?.name} · {i.type} · {i.start} → {i.end}</div>
              </div>
              <span className={`tag ${i.sbtishEligible ? "tag-ok" : "tag-warn"}`}>{i.sbtishEligible ? "SBTISH candidate" : "Not SBTISH"}</span>
            </div>
            <div className="panel-body">
              <div className="wf-row"><span>Rate</span><span>{i.rate}</span></div>
              <div className="wf-row"><span>Conditions</span><span>{i.conditions}</span></div>
              <div className="wf-row"><span>Extracted from</span><span>{i.extractedFrom}</span></div>
              <div className="stack-actions" style={{ marginTop: 12 }}>
                <button className="btn btn-primary" onClick={() => { setScenario({ boiExtend: true }); router.push("/simulator"); }}>Open simulator</button>
                <button className="btn btn-secondary" onClick={() => ask("What happens if the BOI tax holiday expires?")}>Ask GMT24</button>
                <Link href="/safe-harbours" className="btn btn-secondary">Safe harbours</Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { calculateGroup } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { Amount } from "@/components/Amount";
import { eur } from "@/lib/format";

export default function AuditPage() {
  const { groupId } = useStore();
  const calcs = calculateGroup(groupId).filter((c) => c.jurisdictionalTopUp > 0);
  return (
    <div>
      <div className="callout" style={{ marginBottom: 16 }}>
        Every calculated amount in GMT24 is clickable. The trail walks amount → OECD rule (id + version) → entity → account → uploaded source file. The engine posts the number; the LLM does not.
      </div>
      {calcs.map((c) => (
        <div key={c.iso} className="panel" style={{ marginBottom: 12 }}>
          <div className="panel-head">
            <h4 style={{ margin: 0 }}>{c.name}</h4>
            <Amount n={c.jurisdictionalTopUp} audit={c.audit} />
          </div>
          <div className="panel-body waterfall">
            <div className="wf-row"><span>GloBE income</span><Amount n={c.globeIncome} audit={c.trace.globe} compact /></div>
            <div className="wf-row"><span>Covered taxes</span><Amount n={c.coveredTax} audit={c.trace.covered} compact /></div>
            <div className="wf-row"><span>ETR</span><Amount n={c.etr} audit={c.trace.etr} compact /></div>
            <div className="wf-row"><span>SBIE</span><Amount n={c.sbie} audit={c.trace.sbie} compact /></div>
            <div className="wf-row"><span>Excess profit</span><Amount n={c.excess} audit={c.trace.excess} compact /></div>
            <div className="wf-row total"><span>Top-up</span><Amount n={c.jurisdictionalTopUp} audit={c.audit} compact /></div>
            <p className="text-muted" style={{ fontSize: 13, margin: "12px 0 0" }}>
              {c.audit.detail} · QDMTT {eur(c.collection.qdmtt)} · IIR {eur(c.collection.iir)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

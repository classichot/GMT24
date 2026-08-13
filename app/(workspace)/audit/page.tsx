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
        Killer feature: click any final number and travel back to the ledger and source document. Every step cites rule id + version.
      </div>
      {calcs.map((c) => (
        <div key={c.iso} className="panel" style={{ marginBottom: 12 }}>
          <div className="panel-head">
            <h4 style={{ margin: 0 }}>{c.name}</h4>
            <Amount n={c.jurisdictionalTopUp} audit={c.audit} />
          </div>
          <div className="panel-body text-muted" style={{ fontSize: 13 }}>
            {c.audit.detail} · QDMTT {eur(c.collection.qdmtt)} · IIR {eur(c.collection.iir)}
          </div>
        </div>
      ))}
    </div>
  );
}

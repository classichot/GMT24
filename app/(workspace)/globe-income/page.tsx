"use client";

import { useState } from "react";
import { ENTITIES } from "@/lib/model";
import { entityCalc } from "@/lib/engine";
import { eur } from "@/lib/format";
import { Amount } from "@/components/Amount";
import { calculateGroup } from "@/lib/engine";
import { useStore } from "@/lib/store";

export default function GlobeIncomePage() {
  const { groupId } = useStore();
  const [id, setId] = useState("TH-CE");
  const row = entityCalc(id);
  const jur = calculateGroup(groupId).find((c) => c.iso === row?.entity.iso);
  if (!row) return null;
  const f = row.f;
  return (
    <div>
      <div className="callout" style={{ marginBottom: 16 }}>
        Financial Accounting Net Income/Loss is the starting point. Every adjustment carries original amount, delta, reason, rule, source document, preparer and reviewer. Categories are configurable — not hard-coded — because OECD treatment continues to evolve.
      </div>
      <select className="input" style={{ maxWidth: 420, marginBottom: 16 }} value={id} onChange={(e) => setId(e.target.value)}>
        {ENTITIES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      <div className="panel">
        <div className="panel-head"><h4>GloBE income waterfall · {row.entity.code}</h4></div>
        <div className="panel-body waterfall">
          <div className="wf-row"><span>FANIL (accounting)</span><span>{eur(f.fanil)}</span></div>
          {row.adjustments.map((a) => (
            <div className="wf-row" key={a.id}>
              <span>
                {a.category}
                <div className="text-muted" style={{ fontSize: 12 }}>{a.reason} · {a.ruleId} · {a.sourceDoc} · {a.preparer}{a.reviewer ? ` / ${a.reviewer}` : ""}</div>
              </span>
              <span>{eur(a.amount)}</span>
            </div>
          ))}
          <div className="wf-row total">
            <span>GloBE income</span>
            <Amount n={row.globe} audit={jur?.audit} />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { FINANCIALS, ENTITIES } from "@/lib/model";
import { calculateGroup } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { eur } from "@/lib/format";
import { Amount } from "@/components/Amount";

export default function CoveredTaxesPage() {
  const { groupId } = useStore();
  const calcs = calculateGroup(groupId);
  return (
    <div>
      <p className="text-muted">Current, deferred, covered vs non-covered, recast, PE allocation and recapture are multi-year state — Pillar Two is not an isolated annual calc.</p>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Entity</th><th className="num">Current</th><th className="num">Deferred</th><th className="num">Other covered</th><th className="num">Non-covered</th><th className="num">Prior DTA</th><th className="num">Prior DTL</th><th className="num">Covered taxes</th>
              </tr>
            </thead>
            <tbody>
              {FINANCIALS.map((f) => {
                const e = ENTITIES.find((x) => x.id === f.entityId)!;
                const c = calcs.find((x) => x.iso === e.iso);
                return (
                  <tr key={f.entityId}>
                    <td>{e.name}</td>
                    <td className="num">{eur(f.currentTax, true)}</td>
                    <td className="num">{eur(f.deferredTax, true)}</td>
                    <td className="num">{eur(f.otherCovered, true)}</td>
                    <td className="num">{eur(f.nonCovered, true)}</td>
                    <td className="num">{eur(f.priorDta, true)}</td>
                    <td className="num">{eur(f.priorDtl, true)}</td>
                    <td className="num"><Amount n={f.currentTax + f.deferredTax + f.otherCovered} audit={c?.audit} compact /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

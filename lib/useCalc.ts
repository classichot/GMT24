"use client";

import { useMemo } from "react";
import { applyScenario, calculateGroup, totals } from "@/lib/engine";
import { lastLocked } from "@/lib/yearLedger";
import { useStore } from "@/lib/store";

export function useCalc() {
  const { groupId, scenario, electionsOn, yearRecords, activeFy, approvedMaps } = useStore();
  return useMemo(() => {
    const prior = lastLocked(yearRecords, activeFy);
    const calcs = applyScenario(
      calculateGroup(groupId, {
        fy: activeFy,
        electionsOn,
        approvedMaps,
        tcshPrior: prior
          ? prior.rows.map((r) => ({
            blendKey: r.blendKey ?? r.iso,
            iso: r.iso,
            fy: prior.fy,
            tcshUsed: r.tcshUsed,
            tcshFailed: r.tcshFailed,
          }))
          : [],
      }),
      scenario,
    );
    return { calcs, t: totals(calcs), groupId, scenario };
  }, [groupId, scenario, electionsOn, yearRecords, activeFy, approvedMaps]);
}

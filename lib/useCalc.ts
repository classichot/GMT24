"use client";

import { useMemo } from "react";
import { applyScenario, calculateGroup, totals } from "@/lib/engine";
import { useStore } from "@/lib/store";

export function useCalc() {
  const { groupId, scenario } = useStore();
  return useMemo(() => {
    const calcs = applyScenario(calculateGroup(groupId), scenario);
    return { calcs, t: totals(calcs), groupId, scenario };
  }, [groupId, scenario]);
}

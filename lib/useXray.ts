"use client";

import { useMemo } from "react";
import { useStore } from "./store";
import { useCalc } from "./useCalc";
import { runXray } from "./xrayEngines";
import {
  auditQuestions,
  confidenceByArea,
  confidenceByEngine,
  confidenceByEntity,
  confidenceByJurisdiction,
  findingStatus,
  hardStop,
  overallConfidence,
  rdRiskScore,
} from "./xray";

/**
 * Binds the detection engines to the live calculation so every score, priced
 * impact and hard-stop reason moves with the current snapshot rather than a
 * stored result.
 */
export function useXray() {
  const { xray, xrayMode, electionsOn } = useStore();
  const { calcs, t } = useCalc();

  return useMemo(() => {
    const findings = runXray({ electionsOn });
    const areas = confidenceByArea(findings, xray, calcs);
    const statuses = Object.fromEntries(findings.map((f) => [f.id, findingStatus(f, xray[f.id])]));
    return {
      findings,
      state: xray,
      mode: xrayMode,
      statuses,
      areas,
      byJurisdiction: confidenceByJurisdiction(findings, xray, calcs),
      byEntity: confidenceByEntity(findings, xray, calcs),
      byEngine: confidenceByEngine(findings, xray, calcs),
      overall: overallConfidence(areas),
      riskScore: rdRiskScore(areas),
      stop: hardStop(findings, xray, calcs),
      audit: auditQuestions(findings, xray, calcs),
      calcs,
      t,
    };
  }, [electionsOn, xray, xrayMode, calcs, t]);
}

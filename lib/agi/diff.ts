/**
 * "Why did this number change?" Attributes the movement between two case
 * versions to data, mappings, adjustments (Central Record amendments),
 * elections, assumptions and rule versions by re-running the engine along a
 * sequential path from the old snapshot to the new one. What the path cannot
 * explain is reported as unexplained rather than hidden.
 */
import { money } from "../format";
import { stableStringify } from "./case";
import { workingCalc } from "./run";
import type { Attribution, CaseSnapshot, RunDiff } from "./types";

type Stage = { driver: Attribution["driver"]; label: string; apply: (s: CaseSnapshot, to: CaseSnapshot) => CaseSnapshot; changed: (a: CaseSnapshot, b: CaseSnapshot) => boolean; detail: (a: CaseSnapshot, b: CaseSnapshot) => string };

const on = (o: Record<string, boolean>) => Object.entries(o).filter(([, v]) => v).map(([k]) => k).sort();

const STAGES: Stage[] = [
  {
    driver: "data", label: "Source data and locked years",
    apply: (s, to) => ({ ...s, yearRecords: to.yearRecords, ingestStatus: to.ingestStatus, fy: to.fy }),
    changed: (a, b) => a.fy !== b.fy || a.ingestStatus !== b.ingestStatus || stableStringify(a.yearRecords.filter((r) => r.locked).map((r) => r.fy)) !== stableStringify(b.yearRecords.filter((r) => r.locked).map((r) => r.fy)),
    detail: (a, b) => `Fiscal year ${a.fy} → ${b.fy}; data pack ${a.ingestStatus} → ${b.ingestStatus}; locked years ${a.yearRecords.filter((r) => r.locked).length} → ${b.yearRecords.filter((r) => r.locked).length} (prior-year TCSH and ENTE carry-forwards).`,
  },
  {
    driver: "mappings", label: "Account mappings approved",
    apply: (s, to) => ({ ...s, approvedMaps: to.approvedMaps }),
    changed: (a, b) => stableStringify(on(a.approvedMaps)) !== stableStringify(on(b.approvedMaps)),
    detail: (a, b) => { const add = on(b.approvedMaps).filter((k) => !on(a.approvedMaps).includes(k)); const rem = on(a.approvedMaps).filter((k) => !on(b.approvedMaps).includes(k)); return `${add.length ? `approved ${add.join(", ")}` : ""}${add.length && rem.length ? "; " : ""}${rem.length ? `un-approved ${rem.join(", ")}` : ""}`; },
  },
  {
    driver: "adjustments", label: "Central Record pack amendments",
    apply: (s, to) => ({ ...s, packOverlay: to.packOverlay }),
    changed: (a, b) => stableStringify(a.packOverlay) !== stableStringify(b.packOverlay),
    detail: (a, b) => `Jurisdiction packs amended: ${[...new Set([...Object.keys(a.packOverlay), ...Object.keys(b.packOverlay)])].join(", ") || "—"}.`,
  },
  {
    driver: "elections", label: "Elections switched",
    apply: (s, to) => ({ ...s, electionsOn: to.electionsOn }),
    changed: (a, b) => stableStringify(on(a.electionsOn)) !== stableStringify(on(b.electionsOn)),
    detail: (a, b) => { const add = on(b.electionsOn).filter((k) => !on(a.electionsOn).includes(k)); const rem = on(a.electionsOn).filter((k) => !on(b.electionsOn).includes(k)); return `${add.length ? `on: ${add.join(", ")}` : ""}${add.length && rem.length ? "; " : ""}${rem.length ? `off: ${rem.join(", ")}` : ""}`; },
  },
  {
    driver: "assumptions", label: "SBIE claim and simulator assumptions",
    apply: (s, to) => ({ ...s, sbieClaim: to.sbieClaim, scenario: to.scenario }),
    changed: (a, b) => stableStringify(a.sbieClaim) !== stableStringify(b.sbieClaim) || stableStringify(a.scenario) !== stableStringify(b.scenario),
    detail: (a, b) => `SBIE claim ${JSON.stringify(a.sbieClaim)} → ${JSON.stringify(b.sbieClaim)}; simulator ${JSON.stringify(a.scenario)} → ${JSON.stringify(b.scenario)}.`,
  },
];

function totalOf(s: CaseSnapshot) {
  const w = workingCalc(s);
  return { total: w.totals.topUp, byIso: new Map(w.rows.map((r) => [r.blendKey, { iso: r.iso, name: r.name, topUp: r.jurisdictionalTopUp }])) };
}

export function diffCases(from: CaseSnapshot, to: CaseSnapshot, fromId: string, toId: string): RunDiff {
  const start = totalOf(from);
  const end = totalOf(to);
  const attribution: Attribution[] = [];
  let cur = from;
  let curTotal = start.total;
  for (const st of STAGES) {
    if (!st.changed(from, to)) continue;
    const next = st.apply(cur, to);
    const t = totalOf(next).total;
    attribution.push({ driver: st.driver, label: st.label, delta: money(t - curTotal), detail: st.detail(from, to) });
    cur = next;
    curTotal = t;
  }
  const ra = new Map(from.ruleVersions.map((r) => [r.id, r.version]));
  const ruleChanges = to.ruleVersions.filter((r) => ra.has(r.id) && ra.get(r.id) !== r.version);
  if (ruleChanges.length) attribution.push({ driver: "rules", label: "Rule versions", delta: 0, detail: `Changed: ${ruleChanges.map((r) => `${r.id} ${ra.get(r.id)} → ${r.version}`).join(", ")}. Prior versions cannot be re-run; the residual below carries their effect.` });
  const explained = attribution.reduce((a, x) => a + x.delta, 0);
  const residual = money(end.total - start.total - explained);
  if (Math.abs(residual) > 1) attribution.push({ driver: "unexplained", label: "Unexplained residual", delta: residual, detail: "Movement the sequential path could not attribute to a single driver (interaction between drivers or a rule-version change)." });

  const byJurisdiction = [...new Set([...start.byIso.keys(), ...end.byIso.keys()])].map((k) => {
    const a = start.byIso.get(k), b = end.byIso.get(k);
    return { iso: (b ?? a)!.iso, name: (b ?? a)!.name, from: a?.topUp ?? 0, to: b?.topUp ?? 0, delta: money((b?.topUp ?? 0) - (a?.topUp ?? 0)) };
  }).filter((r) => r.delta !== 0).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

  return { fromId, toId, totalDelta: money(end.total - start.total), byJurisdiction, attribution };
}

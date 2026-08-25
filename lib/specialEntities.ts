import { ENTITIES, FINANCIALS, type Entity } from "./model";
import { money } from "./format";
import { classFor, lookThroughToUpe, ownershipOf } from "./entityClass";

/**
 * Art. 7 / 10.2 special-entity charging beyond the seed:
 * - Art. 7.5 Investment Entity tax transparency → owners
 * - Art. 7.6 taxable-distribution method
 * - Tax-transparent UPE / flow-through
 * - Intermediate Parent Entity (IPE) that is not a POPE
 */

export type SpecialCharge = {
  id: string;
  kind: "7.5-owner" | "7.5-ie" | "7.6" | "transparent-upe" | "ipe-iir";
  fromId: string;
  toId: string | null;
  isoFrom: string;
  isoTo: string | null;
  globeMove: number;
  coveredMove: number;
  inclusionRatio: number;
  detail: string;
  ruleId: string;
};

export function investmentEntities(): Entity[] {
  return ENTITIES.filter((e) => e.type === "Investment");
}

export function transparentEntities(): Entity[] {
  return ENTITIES.filter((e) => e.type === "Tax-transparent");
}

/** Intermediate Parent that owns LTCEs but outsiders ≤ 20% (not a POPE). */
export function intermediateParents(): Entity[] {
  return ENTITIES.filter((e) => {
    const cls = classFor(e.id);
    if (cls.upe || cls.pope || cls.excluded || cls.jv) return false;
    if (!cls.parentEntity) return false;
    return cls.upeOwnership > 80; // group-owned intermediate — IPE, not POPE
  });
}

export function specialCharges(opts?: { elect75?: boolean; elect76?: boolean }): SpecialCharge[] {
  const out: SpecialCharge[] = [];
  const elect75 = opts?.elect75 ?? false;
  const elect76 = opts?.elect76 ?? false;

  for (const ie of investmentEntities()) {
    const f = FINANCIALS.find((x) => x.entityId === ie.id);
    if (!f) continue;
    const owner = ENTITIES.find((e) => e.id === ie.parentId);
    if (elect75 && owner) {
      const share = ie.ownership / 100;
      out.push({
        id: `75-${ie.id}`,
        kind: "7.5-ie",
        fromId: ie.id,
        toId: owner.id,
        isoFrom: ie.iso,
        isoTo: owner.iso,
        globeMove: money(-f.fanil),
        coveredMove: money(-(f.currentTax + f.deferredTax)),
        inclusionRatio: share * 100,
        detail: `Art. 7.5 — ${ie.code} transparent; FANIL moved to ${owner.code}`,
        ruleId: "OECD-IE-75",
      });
      out.push({
        id: `75o-${ie.id}`,
        kind: "7.5-owner",
        fromId: ie.id,
        toId: owner.id,
        isoFrom: ie.iso,
        isoTo: owner.iso,
        globeMove: money(f.fanil * share),
        coveredMove: money((f.currentTax + f.deferredTax) * share),
        inclusionRatio: share * 100,
        detail: `Art. 7.5 — owner ${owner.code} picks up IE income × ${ie.ownership}%`,
        ruleId: "OECD-IE-75",
      });
    } else if (elect76) {
      const retained = money(f.fanil * 0.7);
      out.push({
        id: `76-${ie.id}`,
        kind: "7.6",
        fromId: ie.id,
        toId: owner?.id ?? null,
        isoFrom: ie.iso,
        isoTo: owner?.iso ?? null,
        globeMove: money(-retained),
        coveredMove: 0,
        inclusionRatio: ie.ownership,
        detail: `Art. 7.6 — taxable-distribution method; retained ${retained.toLocaleString("en-GB")} out of IE ETR`,
        ruleId: "OECD-IE-76",
      });
    }
  }

  for (const te of transparentEntities()) {
    const f = FINANCIALS.find((x) => x.entityId === te.id);
    const owner = ENTITIES.find((e) => e.id === te.parentId);
    if (!f || !owner) continue;
    out.push({
      id: `tt-${te.id}`,
      kind: "transparent-upe",
      fromId: te.id,
      toId: owner.id,
      isoFrom: te.iso,
      isoTo: owner.iso,
      globeMove: money(f.fanil),
      coveredMove: money(f.currentTax + f.deferredTax),
      inclusionRatio: lookThroughToUpe(te.id),
      detail: `Tax-transparent ${te.code} — attributes flow to ${owner.code} (Art. 10.2)`,
      ruleId: "OECD-FT-102",
    });
  }

  for (const ipe of intermediateParents()) {
    const children = ENTITIES.filter((e) => e.parentId === ipe.id && e.type !== "Excluded");
    for (const child of children) {
      const ratio = ownershipOf(ipe.id, child.id);
      if (ratio <= 0) continue;
      out.push({
        id: `ipe-${ipe.id}-${child.id}`,
        kind: "ipe-iir",
        fromId: child.id,
        toId: ipe.id,
        isoFrom: child.iso,
        isoTo: ipe.iso,
        globeMove: 0,
        coveredMove: 0,
        inclusionRatio: ratio,
        detail: `IPE ${ipe.code} (not POPE) — Inclusion Ratio ${ratio}% in ${child.code} for top-down IIR coordination`,
        ruleId: "OECD-IPE-21",
      });
    }
  }

  return out;
}

export function specialAdjForIso(iso: string, opts?: { elect75?: boolean; elect76?: boolean }) {
  const charges = specialCharges(opts);
  let globeAdj = 0;
  let coveredAdj = 0;
  const notes: string[] = [];
  for (const c of charges) {
    if (c.kind === "7.5-ie" && c.isoFrom === iso) {
      globeAdj += c.globeMove;
      coveredAdj += c.coveredMove;
      notes.push(c.detail);
    }
    if (c.kind === "7.5-owner" && c.isoTo === iso) {
      globeAdj += c.globeMove;
      coveredAdj += c.coveredMove;
      notes.push(c.detail);
    }
    if (c.kind === "7.6" && c.isoFrom === iso) {
      globeAdj += c.globeMove;
      notes.push(c.detail);
    }
    if (c.kind === "transparent-upe" && c.isoTo === iso) {
      globeAdj += c.globeMove;
      coveredAdj += c.coveredMove;
      notes.push(c.detail);
    }
  }
  return { globeAdj: money(globeAdj), coveredAdj: money(coveredAdj), notes, charges };
}

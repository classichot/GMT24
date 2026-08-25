import { ENTITIES, type Entity, type EntityType } from "./model";

/** Art. 10.1 / 5.1.3 — UPE Ownership Interests of 30% or less. */
export const MOCE_UPE_MAX = 30;
/** Art. 2.1.4 / 10.1 — more than 20% of the Parent held by persons that are not Group Entities. */
export const POPE_OUTSIDER_MIN = 20;

export type BlendKind = "main" | "moce" | "mosg" | "jv" | "investment" | "stateless" | "excluded";

export type ClassTest = {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
};

export type GlobeClass = {
  id: string;
  iso: string;
  type: EntityType;
  upeOwnership: number;
  outsiderPct: number;
  excluded: boolean;
  jv: boolean;
  investment: boolean;
  stateless: boolean;
  parentEntity: boolean;
  moce: boolean;
  mosg: boolean;
  mopeId: string | null;
  pope: boolean;
  upe: boolean;
  blendKind: BlendKind;
  blendKey: string;
  blendLabel: string;
  tag: string;
  tests: ClassTest[];
};

export const ENTITY_TEST_STEPS = [
  { n: "01", title: "Constituent Entity?", body: "Included in the UPE consolidation, or left out solely on size / materiality / fair-value grounds. PE, HoldCo and JV are still CEs unless an exclusion applies." },
  { n: "02", title: "Excluded Entity?", body: "Art. 1.5 / Notification No. 7: government, international organisation, non-profit, pension, investment entity / insurance investment entity. Excluded Entities are out of GloBE blending." },
  { n: "03", title: "Look-through UPE ownership", body: "Multiply Ownership Interests up the chain to the UPE. Direct % on the legal-entity row is not enough when a HoldCo sits in between." },
  { n: "04", title: "MOCE? (≤ 30%)", body: "Art. 5.1.3 / 10.1: a CE whose UPE Ownership Interests are 30% or less is a Minority-Owned Constituent Entity. It does not blend with majority CEs in the same jurisdiction." },
  { n: "05", title: "MOSG?", body: "MOCEs owned by a Minority-Owned Parent Entity (UPE ownership of that parent also ≤ 30%) form a Minority-Owned Subgroup and blend with each other — still separate from majority CEs." },
  { n: "06", title: "Parent Entity?", body: "A CE that owns an Ownership Interest in another CE of the same MNE Group. UPE, HoldCo and an operating CE that owns a PE can all be Parent Entities." },
  { n: "07", title: "POPE? (outsiders > 20%)", body: "Art. 2.1.4 / 10.1: a Parent Entity that is not the UPE, where persons that are not Group Entities hold more than 20% (group ownership of the parent < 80%). IIR applies at the POPE first, with its Inclusion Ratio." },
  { n: "08", title: "JV / Investment / Stateless", body: "Art. 6.4 JV Group is a separate MNE for ETR. Art. 7 Investment Entities are out of the jurisdictional blend. Each Stateless CE is treated as its own jurisdiction." },
  { n: "09", title: "Blend key for ETR", body: "Valuation groups by jurisdiction + blend (majority / MOSG / standalone MOCE / JV / Investment). The engine posts one ETR per blend — it does not mix them." },
  { n: "10", title: "IIR Inclusion Ratio", body: "Art. 2.2.2: Parent IIR = Top-up × Inclusion Ratio (Ownership Interests the Parent holds in the LTCE). QDMTT still collects first. Residual after POPE IIR goes to the UPE, then UTPR." },
];

const byId = Object.fromEntries(ENTITIES.map((e) => [e.id, e]));

export function lookThroughToUpe(entityId: string): number {
  const e = byId[entityId];
  if (!e) return 0;
  if (e.type === "UPE" || !e.parentId) return 100;
  let pct = 1;
  let cur: Entity | undefined = e;
  const seen = new Set<string>();
  while (cur && cur.parentId) {
    if (seen.has(cur.id)) break;
    seen.add(cur.id);
    pct *= cur.ownership / 100;
    cur = byId[cur.parentId];
  }
  return Math.round(pct * 10000) / 100;
}

/** Ownership Interests the ancestor holds in the descendant (look-through). */
export function ownershipOf(ancestorId: string, descendantId: string): number {
  if (ancestorId === descendantId) return 100;
  let pct = 1;
  let cur: Entity | undefined = byId[descendantId];
  const seen = new Set<string>();
  while (cur && cur.id !== ancestorId) {
    if (seen.has(cur.id)) return 0;
    seen.add(cur.id);
    pct *= cur.ownership / 100;
    if (!cur.parentId) return 0;
    cur = byId[cur.parentId];
  }
  return cur ? Math.round(pct * 10000) / 100 : 0;
}

/** Art. 10.1 Joint Venture: equity method in the UPE CFS and UPE Ownership Interests of at least 50%. Type label is not the test. */
export const JV_UPE_MIN = 50;

function isJvRoot(e: Entity | undefined): boolean {
  if (!e || e.type === "Excluded") return false;
  if (e.type === "JV") return lookThroughToUpe(e.id) >= JV_UPE_MIN;
  return Boolean(e.equityMethod) && lookThroughToUpe(e.id) >= JV_UPE_MIN;
}

function jvRootId(e: Entity): string {
  let cur: Entity | undefined = e;
  const seen = new Set<string>();
  let found: string | null = null;
  while (cur) {
    if (isJvRoot(cur)) found = cur.id;
    if (!cur.parentId || seen.has(cur.id)) break;
    seen.add(cur.id);
    cur = byId[cur.parentId];
  }
  return found ?? e.id;
}

function isJvMember(e: Entity): boolean {
  if (e.type === "JV Sub") return true;
  const root = byId[jvRootId(e)];
  return isJvRoot(e) || isJvRoot(root);
}

function hasCeChild(id: string) {
  return ENTITIES.some((x) => x.parentId === id && x.type !== "Excluded");
}

function classifyOne(e: Entity, mopeIds: Set<string>): GlobeClass {
  const upeOwnership = lookThroughToUpe(e.id);
  const outsiderPct = Math.round((100 - upeOwnership) * 100) / 100;
  const excluded = e.type === "Excluded" || Boolean(e.excludedReason);
  const jv = !excluded && isJvMember(e);
  const investment = e.type === "Investment";
  const stateless = e.type === "Stateless";
  const upe = e.type === "UPE";
  const parentEntity = !excluded && hasCeChild(e.id);
  const moce =
    !excluded && !upe && !jv && !investment && !stateless && upeOwnership > 0 && upeOwnership <= MOCE_UPE_MAX;
  const ancestorMope = (() => {
    let cur: Entity | undefined = e.parentId ? byId[e.parentId] : undefined;
    while (cur) {
      if (mopeIds.has(cur.id)) return cur.id;
      cur = cur.parentId ? byId[cur.parentId] : undefined;
    }
    return null;
  })();
  const mosg = moce && Boolean(ancestorMope);
  const pope = !excluded && !upe && parentEntity && outsiderPct > POPE_OUTSIDER_MIN;

  let blendKind: BlendKind = "main";
  if (excluded) blendKind = "excluded";
  else if (stateless) blendKind = "stateless";
  else if (investment) blendKind = "investment";
  else if (jv) blendKind = "jv";
  else if (mosg) blendKind = "mosg";
  else if (moce) blendKind = "moce";

  const mopeId = ancestorMope;
  const blendKey =
    blendKind === "excluded" ? `excl:${e.id}`
    : blendKind === "stateless" ? `stateless:${e.id}`
    : blendKind === "investment" ? `${e.iso}:ie:${e.id}`
    : blendKind === "jv" ? `${e.iso}:jv:${jvRootId(e)}`
    : blendKind === "mosg" ? `${e.iso}:mosg:${mopeId}`
    : blendKind === "moce" ? `${e.iso}:moce:${e.id}`
    : `${e.iso}:main`;

  const blendLabel =
    blendKind === "jv" ? `${e.jurisdiction} · JV (Art. 6.4)`
    : blendKind === "moce" ? `${e.jurisdiction} · MOCE`
    : blendKind === "mosg" ? `${e.jurisdiction} · MOSG`
    : blendKind === "investment" ? `${e.jurisdiction} · Investment Entity`
    : blendKind === "stateless" ? `Stateless · ${e.code}`
    : e.jurisdiction;

  const tag = excluded ? "Excluded"
    : upe ? "UPE"
    : pope ? "POPE"
    : moce ? "MOCE"
    : jv ? (e.type === "JV Sub" ? "JV Sub" : "JV")
    : investment ? "Investment"
    : stateless ? "Stateless"
    : e.type;

  const tests: ClassTest[] = [
    { id: "ce", label: "Constituent Entity", pass: !excluded, detail: excluded ? (e.excludedReason ?? "Excluded Entity") : `${e.type} is in the UPE consolidation.` },
    { id: "upe-own", label: "UPE ownership (look-through)", pass: true, detail: `${upeOwnership}% of Ownership Interests held by the UPE.` },
    { id: "moce", label: `MOCE (UPE ≤ ${MOCE_UPE_MAX}%)`, pass: moce, detail: moce ? `UPE ownership ${upeOwnership}% ≤ ${MOCE_UPE_MAX}% — separate ETR from majority CEs in ${e.jurisdiction}.` : `UPE ownership ${upeOwnership}% > ${MOCE_UPE_MAX}% — not a MOCE.` },
    { id: "mosg", label: "MOSG member", pass: mosg, detail: mosg ? `Blended with other MOCEs under Minority-Owned Parent ${mopeId}.` : "No Minority-Owned Parent Entity on the chain — standalone MOCE or majority CE." },
    { id: "parent", label: "Parent Entity", pass: parentEntity, detail: parentEntity ? "Owns an Ownership Interest in another CE of the group." : "No CE subsidiary — not a Parent Entity." },
    { id: "pope", label: `POPE (outsiders > ${POPE_OUTSIDER_MIN}%)`, pass: pope, detail: pope ? `${outsiderPct}% held outside the group — IIR applies here first with Inclusion Ratio (Art. 2.1.4).` : upe ? "This is the UPE — POPE is a non-UPE Parent." : !parentEntity ? "Not a Parent Entity." : `Outsiders hold ${outsiderPct}% (need more than ${POPE_OUTSIDER_MIN}%). Not a POPE.` },
    { id: "jv", label: "JV Group (Art. 6.4 / 10.1)", pass: jv, detail: jv ? `Equity-accounted in the UPE CFS and UPE ownership ${upeOwnership}% ≥ ${JV_UPE_MIN}% — separate MNE for ETR, not blended with majority CEs.` : `Not a Joint Venture (need equity method in the UPE CFS and UPE ownership ≥ ${JV_UPE_MIN}%).` },
    { id: "ie", label: "Investment Entity (Art. 7)", pass: investment, detail: investment ? "Investment Entity is out of the jurisdictional blend — own ETR (Art. 7)." : "Not an Investment Entity." },
    { id: "stateless", label: "Stateless CE (Art. 10.3.4)", pass: stateless, detail: stateless ? "Each Stateless CE is treated as located in a separate jurisdiction." : "Located in a jurisdiction." },
  ];

  return {
    id: e.id,
    iso: e.iso,
    type: e.type,
    upeOwnership,
    outsiderPct,
    excluded,
    jv,
    investment,
    stateless,
    parentEntity,
    moce,
    mosg,
    mopeId,
    pope,
    upe,
    blendKind,
    blendKey,
    blendLabel,
    tag,
    tests,
  };
}

function mopeSet(): Set<string> {
  const ids = new Set<string>();
  for (const e of ENTITIES) {
    if (e.type === "UPE" || e.type === "Excluded") continue;
    const own = lookThroughToUpe(e.id);
    if (own > 0 && own <= MOCE_UPE_MAX && hasCeChild(e.id)) ids.add(e.id);
  }
  return ids;
}

let cache: GlobeClass[] | null = null;

export function classifyAll(): GlobeClass[] {
  if (cache) return cache;
  const mopes = mopeSet();
  cache = ENTITIES.map((e) => classifyOne(e, mopes));
  return cache;
}

export function classFor(entityId: string): GlobeClass {
  return classifyAll().find((c) => c.id === entityId) ?? classifyOne(byId[entityId], mopeSet());
}

export function nearestPope(entityId: string): GlobeClass | null {
  const classes = classifyAll();
  const start = byId[entityId];
  let cur: Entity | undefined = start?.parentId ? byId[start.parentId] : undefined;
  while (cur) {
    const cls = classes.find((c) => c.id === cur!.id);
    if (cls?.pope) return cls;
    cur = cur.parentId ? byId[cur.parentId] : undefined;
  }
  return null;
}

export function popeForEntities(entities: Entity[]): GlobeClass | null {
  for (const e of entities) {
    const p = nearestPope(e.id);
    if (p) return p;
  }
  return null;
}

export function inclusionRatio(parentId: string, entities: Entity[]): number {
  if (!entities.length) return 0;
  const weights = entities.map((e) => Math.max(ownershipOf(parentId, e.id), 0));
  const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
  return Math.round(avg * 100) / 100;
}

export function upeEntity(): Entity {
  return ENTITIES.find((e) => e.type === "UPE") ?? ENTITIES[0];
}

import { AETHERION } from "./aetherion";
import { THAICOAL } from "./thaicoal";
import type { GroupSeed } from "./types";

export type { GroupSeed, JurisdictionPack, SeedUser } from "./types";

export const SEEDS: Record<string, GroupSeed> = {
  aetherion: AETHERION,
  thaicoal: THAICOAL,
};

export const DEFAULT_SEED_ID = "aetherion";

/** Groups without their own dataset (advisor placeholders, onboarded drafts) fall back to the default seed. */
export function seedIdFor(groupId: string | null | undefined): string {
  return groupId && groupId in SEEDS ? groupId : DEFAULT_SEED_ID;
}

export function seedFor(groupId: string | null | undefined): GroupSeed {
  return SEEDS[seedIdFor(groupId)];
}

export function isSeededGroup(groupId: string | null | undefined): boolean {
  return Boolean(groupId && groupId in SEEDS);
}

let activeId = DEFAULT_SEED_ID;

/** The store calls this whenever the working group changes; every data reader follows. */
export function setActiveSeed(groupId: string | null | undefined) {
  activeId = seedIdFor(groupId);
}

export function activeSeed(): GroupSeed {
  return SEEDS[activeId];
}

export function activeSeedId(): string {
  return activeId;
}

/** Facts keyed by seed id. Groups with no entry read the default seed's facts only when `fallback` says so. */
export type BySeed<T> = Partial<Record<string, T>>;

function pickFacts<T>(bySeed: BySeed<T>, empty: T): T {
  return bySeed[activeId] ?? empty;
}

/**
 * A read-only array whose contents follow the active seed. Domain modules keep
 * exporting a constant (`export const FACTS = seedFacts({ aetherion: [...], thaicoal: [...] })`)
 * and every read — map, filter, find, length, index, spread — resolves against
 * the group that is currently open. Seeds without an entry read as empty.
 */
export function seedFacts<T>(bySeed: BySeed<readonly T[]>): readonly T[] {
  const current = () => pickFacts<readonly T[]>(bySeed, []);
  return new Proxy([] as T[], {
    get(_target, prop) {
      const cur = current();
      const value = Reflect.get(cur, prop, cur);
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(cur) : value;
    },
    has: (_target, prop) => Reflect.has(current(), prop),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor(_target, prop) {
      const d = Reflect.getOwnPropertyDescriptor(current(), prop);
      if (!d) return undefined;
      return prop === "length" ? { ...d, configurable: false } : { ...d, configurable: true };
    },
  });
}

/** Object form of `seedFacts` for single-record facts. Seeds without an entry read the `empty` record. */
export function seedFact<T extends object>(bySeed: BySeed<T>, empty: T): T {
  const current = () => pickFacts(bySeed, empty);
  return new Proxy({} as T, {
    get(_target, prop) {
      const cur = current();
      const value = Reflect.get(cur, prop, cur);
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(cur) : value;
    },
    has: (_target, prop) => Reflect.has(current(), prop),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor(_target, prop) {
      const d = Reflect.getOwnPropertyDescriptor(current(), prop);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}

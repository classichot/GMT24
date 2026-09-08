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

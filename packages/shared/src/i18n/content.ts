import type { MissionId } from "../missions";
import type { SensitiveCategory } from "../moderation";
import type { CareKind } from "../mood";
import type { Gender, Interest, PetSpecies } from "../onboarding";
import type { RelationshipTier } from "../relationships";
import type { TreasureRarity } from "../treasures";
import type { TranslationKey } from "./en";

/**
 * Keys for the game's own vocabulary — species, interests, treasures, missions,
 * bond unlocks, friendship tiers.
 *
 * These live in the constant tables in `onboarding.ts`, `bond.ts` and friends,
 * which keep their English `label` fields: those are what the server puts in AI
 * prompts and what the admin panel shows, and both of those are English by
 * design. What the *app* shows comes from here instead.
 *
 * The point of doing it with functions rather than lookup maps is the return
 * type. `` `species.${PetSpecies}.label` `` expands over the whole union, so it
 * only satisfies `TranslationKey` when every species has a key — adding a fifth
 * companion without its wording stops the build instead of rendering
 * `species.axolotl.label` to somebody.
 */

export function speciesLabelKey(value: PetSpecies): TranslationKey {
  return `species.${value}.label`;
}

/** How this companion gets around: "Flies", "Hops". */
export function speciesMovesKey(value: PetSpecies): TranslationKey {
  return `species.${value}.moves`;
}

export function interestKey(value: Interest): TranslationKey {
  return `interest.${value}`;
}

export function genderKey(value: Gender): TranslationKey {
  return `gender.${value}`;
}

export function tierLabelKey(value: RelationshipTier): TranslationKey {
  return `tier.${value}.label`;
}

export function tierBlurbKey(value: RelationshipTier): TranslationKey {
  return `tier.${value}.blurb`;
}

export function rarityKey(value: TreasureRarity): TranslationKey {
  return `rarity.${value}`;
}

export function missionLabelKey(value: MissionId): TranslationKey {
  return `mission.${value}.label`;
}

export function missionHintKey(value: MissionId): TranslationKey {
  return `mission.${value}.hint`;
}

export function careVerbKey(value: CareKind): TranslationKey {
  return `care.${value}.verb`;
}

export function careDoneKey(value: CareKind): TranslationKey {
  return `care.${value}.done`;
}

export function categoryLabelKey(value: SensitiveCategory): TranslationKey {
  return `category.${value}.label`;
}

export function categoryBlurbKey(value: SensitiveCategory): TranslationKey {
  return `category.${value}.blurb`;
}

export function unlockKindKey(value: "expression" | "collection" | "cosmetic" | "range" | "title"): TranslationKey {
  return `unlockKind.${value}`;
}

/**
 * Treasure ids are typed as plain strings — the table is data, and new finds are
 * expected — so this is the one family that can't be proved complete at compile
 * time. A missing key renders as `treasure.whatever`, which is legible enough to
 * catch in review, and `translate` already falls back that way.
 */
export function treasureKey(id: string): TranslationKey {
  return `treasure.${id}` as TranslationKey;
}

/**
 * Bond unlocks are keyed by level number, which isn't a union either, so the
 * same caveat applies. `MAX_LEVEL` bounds it in practice.
 */
export function unlockKey(level: number): TranslationKey {
  return `unlock.${level}` as TranslationKey;
}

/**
 * Things a pet brings home from wandering.
 *
 * A collection motive that rewards letting the pet roam somewhere new, tied to
 * actual places rather than abstract points. Kept deliberately small and
 * cosmetic: finding nothing is the common case, and nothing here gates a
 * feature or is ever purchasable.
 */

export const TREASURE_RARITIES = [
  { id: "common", label: "Common", weight: 70 },
  { id: "uncommon", label: "Uncommon", weight: 22 },
  { id: "rare", label: "Rare", weight: 7 },
  { id: "legendary", label: "Legendary", weight: 1 },
] as const;

export type TreasureRarity = (typeof TREASURE_RARITIES)[number]["id"];

export type TreasureKind = {
  id: string;
  label: string;
  rarity: TreasureRarity;
  /** Place categories this can be found at; empty means anywhere. */
  near: string[];
};

export const TREASURES: TreasureKind[] = [
  { id: "bottle-cap", label: "Bottle cap", rarity: "common", near: [] },
  { id: "smooth-pebble", label: "Smooth pebble", rarity: "common", near: [] },
  { id: "lost-button", label: "Lost button", rarity: "common", near: [] },
  { id: "ticket-stub", label: "Ticket stub", rarity: "common", near: ["cinema", "theatre"] },
  { id: "coffee-sleeve", label: "Coffee sleeve", rarity: "common", near: ["cafe"] },
  { id: "bright-feather", label: "Bright feather", rarity: "uncommon", near: ["park"] },
  { id: "sea-glass", label: "Sea glass", rarity: "uncommon", near: ["beach"] },
  { id: "pressed-flower", label: "Pressed flower", rarity: "uncommon", near: ["park", "garden"] },
  { id: "old-postcard", label: "Old postcard", rarity: "uncommon", near: [] },
  { id: "tiny-key", label: "Tiny key", rarity: "rare", near: [] },
  { id: "fossil-chip", label: "Fossil chip", rarity: "rare", near: ["beach", "park"] },
  { id: "brass-compass", label: "Brass compass", rarity: "legendary", near: [] },
];

export const TREASURE_BY_ID = new Map(TREASURES.map((t) => [t.id, t]));

/** Most trips find nothing — that's what makes finding something feel like anything. */
export const FIND_CHANCE = 0.18;

export function rarityLabel(rarity: string): string {
  return TREASURE_RARITIES.find((r) => r.id === rarity)?.label ?? rarity;
}

/**
 * Picks a find for a wander that ended near `placeCategory`, or null.
 * Candidates matching the place are preferred, so a beach turns up sea glass
 * rather than a cinema ticket.
 *
 * `rarities` is the bond ladder's half of this: levels 2, 5 and 9 widen what a pet
 * can find at all. Filtering the pool rather than re-weighting it keeps the odds
 * *within* what you've unlocked unchanged — reaching level 9 adds legendary finds
 * without quietly making pebbles rarer.
 */
export function rollTreasure(
  placeCategory: string | null,
  rng: () => number = Math.random,
  /** Live-tunable; defaults to the shipped constant. */
  findChance: number = FIND_CHANCE,
  /** Rarities unlocked at the pet's bond level. Defaults to all of them. */
  rarities: readonly TreasureRarity[] = TREASURE_RARITIES.map((r) => r.id),
): TreasureKind | null {
  if (rng() > findChance) return null;

  const allowed = (t: TreasureKind) => rarities.includes(t.rarity);
  const local = placeCategory
    ? TREASURES.filter((t) => t.near.includes(placeCategory) && allowed(t))
    : [];
  const anywhere = TREASURES.filter((t) => t.near.length === 0 && allowed(t));
  const pool = local.length > 0 && rng() < 0.6 ? local : anywhere;
  // A level that has unlocked nothing findable here comes home empty, which is
  // already the common outcome and needs no special case downstream.
  if (pool.length === 0) return null;

  const weights = pool.map((t) => TREASURE_RARITIES.find((r) => r.id === t.rarity)!.weight);
  let roll = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return pool[i]!;
  }
  return pool[pool.length - 1] ?? null;
}

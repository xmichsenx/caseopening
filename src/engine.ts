import type { Rarity, Skin, Wear } from "./types";
import {
  RARITY_WEIGHTS,
  ROULETTE_ITEM_COUNT,
  WINNER_INDEX,
  SELL_PRICE_RANGES,
  WEAR_MULTIPLIERS,
  WEAR_WEIGHTS,
  STATTRAK_CHANCE,
  STATTRAK_MULTIPLIER,
} from "./constants";
import { getSkinsByRarity } from "./api";

export function computeSkinPrice(skin: Skin, index: number): number {
  const range = SELL_PRICE_RANGES[skin.rarity.name] ?? [0.03, 0.5];
  const [min, max] = range;
  let h = index;
  for (let i = 0; i < skin.id.length; i++) {
    h = ((h << 5) - h + skin.id.charCodeAt(i)) | 0;
  }
  const t = (Math.abs(h) % 10000) / 10000;
  return Math.round((min + t * (max - min)) * 100) / 100;
}

/** Compute the full price incorporating wear + StatTrak multipliers. */
export function computeFullPrice(
  basePrice: number,
  wear: Wear,
  isStatTrak: boolean,
): number {
  let price = basePrice * (WEAR_MULTIPLIERS[wear] ?? 1);
  if (isStatTrak) price *= STATTRAK_MULTIPLIER;
  return Math.round(price * 100) / 100;
}

/** Roll a random wear tier based on weighted probabilities. */
export function rollWear(): Wear {
  const total = WEAR_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [wear, weight] of WEAR_WEIGHTS) {
    r -= weight;
    if (r <= 0) return wear as Wear;
  }
  return "Field-Tested";
}

/** Roll whether a skin is StatTrak. */
export function rollStatTrak(): boolean {
  return Math.random() * 100 < STATTRAK_CHANCE;
}

function weightedRandomRarity(weights: Record<string, number>): string {
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (const [rarity, weight] of entries) {
    random -= weight;
    if (random <= 0) return rarity;
  }

  return entries[0][0];
}

function pickRandomSkin(skins: Skin[], rarity: string): Skin {
  const pool = getSkinsByRarity(skins, rarity);
  if (pool.length === 0) {
    // Fallback: pick any skin
    return skins[Math.floor(Math.random() * skins.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export interface RouletteResult {
  strip: Skin[];
  winner: Skin;
  winnerIndex: number;
}

export function generateRouletteStrip(
  skins: Skin[],
  _isFreeCase: boolean,
  rarityFilter?: Rarity[],
  customWeights?: Record<string, number>,
): RouletteResult {
  // Build weights: custom overrides > rarity filter > defaults
  let weights: Record<string, number>;
  if (customWeights && Object.keys(customWeights).length > 0) {
    weights = customWeights;
  } else if (rarityFilter && rarityFilter.length > 0) {
    weights = {};
    for (const r of rarityFilter) {
      if (RARITY_WEIGHTS[r] != null) weights[r] = RARITY_WEIGHTS[r];
    }
    // Fallback if filter matched nothing
    if (Object.keys(weights).length === 0) weights = RARITY_WEIGHTS;
  } else {
    weights = RARITY_WEIGHTS;
  }

  // Filter out rarities that have no skins in the pool
  const filteredWeights: Record<string, number> = {};
  for (const [rarity, weight] of Object.entries(weights)) {
    if (getSkinsByRarity(skins, rarity).length > 0) {
      filteredWeights[rarity] = weight;
    }
  }
  if (Object.keys(filteredWeights).length > 0) {
    weights = filteredWeights;
  }

  const strip: Skin[] = [];

  for (let i = 0; i < ROULETTE_ITEM_COUNT; i++) {
    const rarity = weightedRandomRarity(weights);
    strip.push(pickRandomSkin(skins, rarity));
  }

  // The winner is at WINNER_INDEX (47, i.e., 48th item)
  const winnerRarity = weightedRandomRarity(weights);
  const winner = pickRandomSkin(skins, winnerRarity);
  strip[WINNER_INDEX] = winner;

  return {
    strip,
    winner,
    winnerIndex: WINNER_INDEX,
  };
}

export function generateSellPrice(rarityName: string): number {
  const range = SELL_PRICE_RANGES[rarityName] ?? [0.03, 0.5];
  const [min, max] = range;
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

// ── Skin Roulette ────────────────────────────────────
import type { SkinRouletteResult } from "./types";
import { SKIN_ROULETTE_SEGMENTS } from "./constants";

/** Spin the roulette wheel — uniform random across all 15 segments. */
export function spinSkinRoulette(): SkinRouletteResult {
  const idx = Math.floor(Math.random() * SKIN_ROULETTE_SEGMENTS.length);
  return {
    winningSegment: SKIN_ROULETTE_SEGMENTS[idx],
    winningIndex: idx,
  };
}

// ── Upgrader ─────────────────────────────────────────

const UPGRADER_HOUSE_EDGE = 0.05;

/**
 * Roll an upgrade attempt. Success chance = (1 / multiplier) × (1 - houseEdge).
 * @param multiplier Target multiplier (>=1). At 2× real chance is 47.5%.
 * @returns true if upgrade succeeds.
 */
export function rollUpgrade(multiplier: number): boolean {
  if (multiplier <= 1) return true;
  const chance = (1 / multiplier) * (1 - UPGRADER_HOUSE_EDGE);
  return Math.random() < chance;
}

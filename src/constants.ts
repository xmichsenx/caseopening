export const RARITY_COLORS: Record<string, string> = {
  "Mil-Spec Grade": "#4b69ff",
  Restricted: "#8847ff",
  Classified: "#d32ce6",
  Covert: "#eb4b4b",
  Extraordinary: "#caab05",
};

export const RARITY_WEIGHTS: Record<string, number> = {
  "Mil-Spec Grade": 79.92,
  Restricted: 15.98,
  Classified: 3.19,
  Covert: 0.64,
  Extraordinary: 0.26,
};

export const SELL_PRICE_RANGES: Record<string, [number, number]> = {
  "Mil-Spec Grade": [0.05, 1.5],
  Restricted: [0.5, 5.0],
  Classified: [3.0, 25.0],
  Covert: [15.0, 150.0],
  Extraordinary: [100.0, 2000.0],
};

/** Wear multipliers — Factory New is the most valuable, Battle-Scarred the least. */
export const WEAR_MULTIPLIERS: Record<string, number> = {
  "Factory New": 2.5,
  "Minimal Wear": 1.6,
  "Field-Tested": 1.0,
  "Well-Worn": 0.7,
  "Battle-Scarred": 0.45,
};

/** Weighted probabilities for each wear tier (must sum to 100). */
export const WEAR_WEIGHTS: [string, number][] = [
  ["Factory New", 3],
  ["Minimal Wear", 15],
  ["Field-Tested", 45],
  ["Well-Worn", 25],
  ["Battle-Scarred", 12],
];

/** Chance (%) that a dropped skin is StatTrak. */
export const STATTRAK_CHANCE = 10;

/** Price multiplier for StatTrak skins. */
export const STATTRAK_MULTIPLIER = 3.0;

export const SKINS_API_URL =
  "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json";

/** Max skins per rarity inside a single case (mirrors real CS2 case sizes). */
export const CASE_POOL_LIMITS: Record<string, number> = {
  "Mil-Spec Grade": 7,
  Restricted: 5,
  Classified: 3,
  Covert: 2,
  Extraordinary: 1,
};

export const ROULETTE_ITEM_COUNT = 50;
export const WINNER_INDEX = 47; // 0-indexed, so 48th item
export const STARTING_BALANCE = 0;
export const LEVEL_UP_BONUS = 1.0;

// ── Skin Roulette (Red / Black / Green) ─────────────
import type { RouletteColor, RouletteSegment } from "./types";

/** 15 segments: 7 Red, 7 Black, 1 Green — ordered for visual alternation. */
export const SKIN_ROULETTE_SEGMENTS: RouletteSegment[] = [
  { color: "red", number: 0 },
  { color: "black", number: 1 },
  { color: "red", number: 2 },
  { color: "black", number: 3 },
  { color: "red", number: 4 },
  { color: "black", number: 5 },
  { color: "green", number: 6 },
  { color: "red", number: 7 },
  { color: "black", number: 8 },
  { color: "red", number: 9 },
  { color: "black", number: 10 },
  { color: "red", number: 11 },
  { color: "black", number: 12 },
  { color: "red", number: 13 },
  { color: "black", number: 14 },
];

export const SKIN_ROULETTE_PAYOUTS: Record<RouletteColor, number> = {
  red: 2,
  black: 2,
  green: 14,
};

export const SKIN_ROULETTE_COLORS: Record<RouletteColor, string> = {
  red: "#e74c3c",
  black: "#2c3e50",
  green: "#27ae60",
};

// ── Crash ────────────────────────────────────────────

/** House edge for the Crash game mode (2%). */
export const CRASH_HOUSE_EDGE = 0.02;

/** Maximum multiplier before forced cash-out. */
export const CRASH_MAX_MULTIPLIER = 100;

/** Tick interval in ms — 20 updates/sec for smooth animation. */
export const CRASH_TICK_INTERVAL_MS = 50;

/** Controls how fast the multiplier accelerates. */
export const CRASH_SPEED_FACTOR = 0.00006;

/** Minimum ms before the crash check activates — ensures visible animation. */
export const CRASH_GRACE_MS = 500;

// ── Rocket (Hold-to-Fly) ────────────────────────────

/** Tick interval in ms — 20 updates/sec. */
export const ROCKET_TICK_INTERVAL_MS = 50;

/** Controls how fast the rocket multiplier accelerates. */
export const ROCKET_SPEED_FACTOR = 0.00007;

/** Maximum multiplier before the rocket auto-explodes. */
export const ROCKET_MAX_MULTIPLIER = 100;

/** Minimum ms before the rocket crash check activates — ensures visible animation. */
export const ROCKET_CRASH_GRACE_MS = 500;

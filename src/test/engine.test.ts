import { describe, it, expect } from "vitest";
import type { Skin } from "../types";
import {
  generateRouletteStrip,
  generateSellPrice,
  spinSkinRoulette,
  rollUpgrade,
} from "../engine";
import {
  ROULETTE_ITEM_COUNT,
  WINNER_INDEX,
  SELL_PRICE_RANGES,
  SKIN_ROULETTE_SEGMENTS,
} from "../constants";

const mockSkins: Skin[] = [
  {
    id: "1",
    name: "AK-47 | Redline",
    description: "A red skin",
    weapon: { id: "ak47", name: "AK-47" },
    category: { id: "rifle", name: "Rifle" },
    rarity: { id: "milspec", name: "Mil-Spec Grade", color: "#4b69ff" },
    image: "https://example.com/ak47.png",
  },
  {
    id: "2",
    name: "M4A4 | Dragon King",
    description: "A purple skin",
    weapon: { id: "m4a4", name: "M4A4" },
    category: { id: "rifle", name: "Rifle" },
    rarity: { id: "restricted", name: "Restricted", color: "#8847ff" },
    image: "https://example.com/m4a4.png",
  },
  {
    id: "3",
    name: "AWP | Hyper Beast",
    description: "A pink skin",
    weapon: { id: "awp", name: "AWP" },
    category: { id: "rifle", name: "Rifle" },
    rarity: { id: "classified", name: "Classified", color: "#d32ce6" },
    image: "https://example.com/awp.png",
  },
  {
    id: "4",
    name: "AK-47 | Fire Serpent",
    description: "A red skin",
    weapon: { id: "ak47", name: "AK-47" },
    category: { id: "rifle", name: "Rifle" },
    rarity: { id: "covert", name: "Covert", color: "#eb4b4b" },
    image: "https://example.com/ak47_fire.png",
  },
  {
    id: "5",
    name: "Knife | Crimson Web",
    description: "A gold skin",
    weapon: { id: "knife", name: "Knife" },
    category: { id: "knife", name: "Knife" },
    rarity: { id: "extraordinary", name: "Extraordinary", color: "#caab05" },
    image: "https://example.com/knife.png",
  },
];

describe("generateRouletteStrip", () => {
  it("returns a strip of ROULETTE_ITEM_COUNT (50) items", () => {
    const result = generateRouletteStrip(mockSkins, false);
    expect(result.strip).toHaveLength(ROULETTE_ITEM_COUNT);
  });

  it("places the winner at WINNER_INDEX (47)", () => {
    const result = generateRouletteStrip(mockSkins, false);
    expect(result.winnerIndex).toBe(WINNER_INDEX);
    expect(result.strip[WINNER_INDEX]).toBe(result.winner);
  });

  it("only drops Mil-Spec Grade or Restricted for welcome case", () => {
    const allowedRarities = new Set(["Mil-Spec Grade", "Restricted"]);

    // Run multiple times to increase confidence
    for (let i = 0; i < 20; i++) {
      const result = generateRouletteStrip(mockSkins, true, [
        "Mil-Spec Grade",
        "Restricted",
      ]);
      expect(allowedRarities.has(result.winner.rarity.name)).toBe(true);
    }
  });

  it("returns strip items that are valid Skin objects", () => {
    const result = generateRouletteStrip(mockSkins, false);
    for (const skin of result.strip) {
      expect(skin).toHaveProperty("id");
      expect(skin).toHaveProperty("name");
      expect(skin).toHaveProperty("rarity");
      expect(skin).toHaveProperty("image");
      expect(typeof skin.id).toBe("string");
      expect(typeof skin.name).toBe("string");
      expect(typeof skin.image).toBe("string");
      expect(skin.rarity).toHaveProperty("name");
    }
  });

  it("skips rarities with no skins in the pool", () => {
    // Only blue and purple skins available
    const limitedSkins = mockSkins.filter(
      (s) =>
        s.rarity.name === "Mil-Spec Grade" || s.rarity.name === "Restricted",
    );
    const allowedRarities = new Set(["Mil-Spec Grade", "Restricted"]);

    for (let i = 0; i < 20; i++) {
      const result = generateRouletteStrip(limitedSkins, false);
      expect(allowedRarities.has(result.winner.rarity.name)).toBe(true);
      for (const skin of result.strip) {
        expect(allowedRarities.has(skin.rarity.name)).toBe(true);
      }
    }
  });
});

describe("generateSellPrice", () => {
  it.each(Object.entries(SELL_PRICE_RANGES))(
    "returns a value within range for %s",
    (rarity, [min, max]) => {
      for (let i = 0; i < 50; i++) {
        const price = generateSellPrice(rarity);
        expect(price).toBeGreaterThanOrEqual(min);
        expect(price).toBeLessThanOrEqual(max);
      }
    },
  );

  it("falls back to default range for unknown rarity", () => {
    const price = generateSellPrice("Unknown");
    expect(price).toBeGreaterThanOrEqual(0.03);
    expect(price).toBeLessThanOrEqual(0.5);
  });
});

describe("spinSkinRoulette", () => {
  it("returns a valid segment from SKIN_ROULETTE_SEGMENTS", () => {
    for (let i = 0; i < 50; i++) {
      const result = spinSkinRoulette();
      expect(result.winningIndex).toBeGreaterThanOrEqual(0);
      expect(result.winningIndex).toBeLessThan(SKIN_ROULETTE_SEGMENTS.length);
      expect(result.winningSegment).toBe(
        SKIN_ROULETTE_SEGMENTS[result.winningIndex],
      );
    }
  });

  it("returns a segment with a valid color", () => {
    const validColors = new Set(["red", "black", "green"]);
    for (let i = 0; i < 50; i++) {
      const result = spinSkinRoulette();
      expect(validColors.has(result.winningSegment.color)).toBe(true);
    }
  });

  it("hits all three colors over many spins", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      seen.add(spinSkinRoulette().winningSegment.color);
      if (seen.size === 3) break;
    }
    expect(seen.size).toBe(3);
  });
});

describe("rollUpgrade", () => {
  it("returns a boolean", () => {
    const result = rollUpgrade(2);
    expect(typeof result).toBe("boolean");
  });

  it("always succeeds at multiplier 1", () => {
    for (let i = 0; i < 100; i++) {
      expect(rollUpgrade(1)).toBe(true);
    }
  });

  it("succeeds approximately 47.5% at 2× over many rolls", () => {
    let wins = 0;
    const trials = 5000;
    for (let i = 0; i < trials; i++) {
      if (rollUpgrade(2)) wins++;
    }
    const rate = wins / trials;
    // Expected 47.5%, allow ±5% tolerance
    expect(rate).toBeGreaterThan(0.4);
    expect(rate).toBeLessThan(0.55);
  });

  it("almost never succeeds at 100×", () => {
    let wins = 0;
    const trials = 5000;
    for (let i = 0; i < trials; i++) {
      if (rollUpgrade(100)) wins++;
    }
    // Expected 0.95%, should be well under 3%
    expect(wins / trials).toBeLessThan(0.03);
  });
});

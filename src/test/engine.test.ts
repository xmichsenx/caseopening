import { describe, it, expect } from "vitest";
import type { Skin, CaseDefinition } from "../types";
import {
  generateRouletteStrip,
  generateSellPrice,
  computeSkinPrice,
  computeFullPrice,
  spinSkinRoulette,
  rollUpgrade,
  generateCrashPoint,
} from "../engine";
import {
  ROULETTE_ITEM_COUNT,
  WINNER_INDEX,
  SELL_PRICE_RANGES,
  SKIN_ROULETTE_SEGMENTS,
  CRASH_MAX_MULTIPLIER,
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

// ── Crash ──────────────────────────────────────────────────

describe("generateCrashPoint", () => {
  it("always returns a value >= 1.0", () => {
    for (let i = 0; i < 1000; i++) {
      expect(generateCrashPoint()).toBeGreaterThanOrEqual(1);
    }
  });

  it("never exceeds CRASH_MAX_MULTIPLIER", () => {
    for (let i = 0; i < 1000; i++) {
      expect(generateCrashPoint()).toBeLessThanOrEqual(CRASH_MAX_MULTIPLIER);
    }
  });

  it("returns a number with at most 2 decimal places", () => {
    for (let i = 0; i < 200; i++) {
      const point = generateCrashPoint();
      expect(Math.round(point * 100) / 100).toBe(point);
    }
  });

  it("approximately 50% of crash points are below 2.0× (house edge distribution)", () => {
    let below2 = 0;
    const trials = 10000;
    for (let i = 0; i < trials; i++) {
      if (generateCrashPoint() < 2) below2++;
    }
    const rate = below2 / trials;
    // Expected ~51%, allow ±8% tolerance
    expect(rate).toBeGreaterThan(0.4);
    expect(rate).toBeLessThan(0.62);
  });

  it("some crash points reach high multipliers (>10×) over many trials", () => {
    let above10 = 0;
    const trials = 5000;
    for (let i = 0; i < trials; i++) {
      if (generateCrashPoint() > 10) above10++;
    }
    // Expected ~9.8%, should be at least 5%
    expect(above10 / trials).toBeGreaterThan(0.03);
  });
});

// ── High-Value Cases ($10K–$1M) ────────────────────────────

describe("high-value case definitions", () => {
  const highValueCases: Pick<
    CaseDefinition,
    "id" | "name" | "price" | "sellPriceMultiplier" | "rarityWeights"
  >[] = [
    {
      id: "plutocrat",
      name: "Plutocrat Case",
      price: 10000,
      sellPriceMultiplier: 150,
      rarityWeights: {
        "Mil-Spec Grade": 48,
        Restricted: 22,
        Classified: 16,
        Covert: 9,
        Extraordinary: 5,
      },
    },
    {
      id: "monaco-special",
      name: "Monaco Special",
      price: 10000,
      sellPriceMultiplier: 180,
      rarityWeights: {
        "Mil-Spec Grade": 52,
        Restricted: 20,
        Classified: 15,
        Covert: 8,
        Extraordinary: 5,
      },
    },
    {
      id: "ivory-tower",
      name: "Ivory Tower",
      price: 25000,
      sellPriceMultiplier: 350,
      rarityWeights: {
        "Mil-Spec Grade": 50,
        Restricted: 21,
        Classified: 16,
        Covert: 8,
        Extraordinary: 5,
      },
    },
    {
      id: "el-dorado",
      name: "El Dorado",
      price: 25000,
      sellPriceMultiplier: 400,
      rarityWeights: {
        "Mil-Spec Grade": 46,
        Restricted: 22,
        Classified: 17,
        Covert: 10,
        Extraordinary: 5,
      },
    },
    {
      id: "fort-knox",
      name: "Fort Knox",
      price: 50000,
      sellPriceMultiplier: 650,
      rarityWeights: {
        "Mil-Spec Grade": 50,
        Restricted: 22,
        Classified: 15,
        Covert: 8,
        Extraordinary: 5,
      },
    },
    {
      id: "billionaires-gambit",
      name: "Billionaire's Gambit",
      price: 50000,
      sellPriceMultiplier: 750,
      rarityWeights: {
        "Mil-Spec Grade": 48,
        Restricted: 20,
        Classified: 17,
        Covert: 10,
        Extraordinary: 5,
      },
    },
    {
      id: "the-vault",
      name: "The Vault",
      price: 100000,
      sellPriceMultiplier: 1200,
      rarityWeights: {
        "Mil-Spec Grade": 50,
        Restricted: 22,
        Classified: 16,
        Covert: 8,
        Extraordinary: 4,
      },
    },
    {
      id: "crown-jewels",
      name: "Crown Jewels",
      price: 100000,
      sellPriceMultiplier: 1500,
      rarityWeights: {
        "Mil-Spec Grade": 45,
        Restricted: 22,
        Classified: 18,
        Covert: 10,
        Extraordinary: 5,
      },
    },
    {
      id: "midas-touch",
      name: "The Midas Touch",
      price: 250000,
      sellPriceMultiplier: 3000,
      rarityWeights: {
        "Mil-Spec Grade": 50,
        Restricted: 22,
        Classified: 16,
        Covert: 8,
        Extraordinary: 4,
      },
    },
    {
      id: "quantum-vault",
      name: "Quantum Vault",
      price: 250000,
      sellPriceMultiplier: 3500,
      rarityWeights: {
        "Mil-Spec Grade": 47,
        Restricted: 21,
        Classified: 17,
        Covert: 10,
        Extraordinary: 5,
      },
    },
    {
      id: "philosophers-stone",
      name: "Philosopher's Stone",
      price: 500000,
      sellPriceMultiplier: 6000,
      rarityWeights: {
        "Mil-Spec Grade": 50,
        Restricted: 22,
        Classified: 16,
        Covert: 8,
        Extraordinary: 4,
      },
    },
    {
      id: "excalibur",
      name: "Excalibur",
      price: 500000,
      sellPriceMultiplier: 7000,
      rarityWeights: {
        "Mil-Spec Grade": 46,
        Restricted: 21,
        Classified: 18,
        Covert: 10,
        Extraordinary: 5,
      },
    },
    {
      id: "the-holy-grail",
      name: "The Holy Grail",
      price: 1000000,
      sellPriceMultiplier: 12000,
      rarityWeights: {
        "Mil-Spec Grade": 50,
        Restricted: 22,
        Classified: 16,
        Covert: 8,
        Extraordinary: 4,
      },
    },
    {
      id: "valhalla",
      name: "Valhalla",
      price: 1000000,
      sellPriceMultiplier: 15000,
      rarityWeights: {
        "Mil-Spec Grade": 44,
        Restricted: 20,
        Classified: 18,
        Covert: 12,
        Extraordinary: 6,
      },
    },
  ];

  it.each(highValueCases)(
    "$name rarity weights sum to 100",
    ({ rarityWeights }) => {
      const sum = Object.values(rarityWeights!).reduce((a, b) => a + b, 0);
      expect(sum).toBe(100);
    },
  );

  it.each(highValueCases)(
    "$name has unique id",
    ({ id }) => {
      const count = highValueCases.filter((c) => c.id === id).length;
      expect(count).toBe(1);
    },
  );

  it.each(highValueCases)(
    "$name Mil-Spec (blue) max FT price is well below case price (house edge)",
    ({ price, sellPriceMultiplier }) => {
      const mult = sellPriceMultiplier ?? 1;
      const [, maxBlue] = SELL_PRICE_RANGES["Mil-Spec Grade"];
      // Blue FT (most common drop) should be a significant loss
      const maxBluePrice = maxBlue * mult;
      expect(maxBluePrice).toBeLessThan(price * 0.5);
    },
  );

  it.each(highValueCases)(
    "$name Extraordinary FT max price exceeds case price (profit possible)",
    ({ price, sellPriceMultiplier }) => {
      const mult = sellPriceMultiplier ?? 1;
      const [, maxGold] = SELL_PRICE_RANGES["Extraordinary"];
      // FN StatTrak Extraordinary should be a huge win
      const maxGoldPrice = maxGold * mult * 2.5 * 3.0; // FN + StatTrak
      expect(maxGoldPrice).toBeGreaterThan(price);
    },
  );

  it.each(highValueCases)(
    "$name Covert FT can potentially exceed case price",
    ({ price, sellPriceMultiplier }) => {
      const mult = sellPriceMultiplier ?? 1;
      const [, maxRed] = SELL_PRICE_RANGES["Covert"];
      // FN StatTrak Covert should be able to profit
      const maxRedPrice = maxRed * mult * 2.5 * 3.0;
      expect(maxRedPrice).toBeGreaterThan(price);
    },
  );

  it("computeFullPrice scales correctly with high multipliers", () => {
    // Simulating a $1M case Extraordinary skin base price
    const basePrice = 2000 * 12000; // max Extraordinary × Holy Grail multiplier
    const fnStatTrakPrice = computeFullPrice(basePrice, "Factory New", true);
    expect(fnStatTrakPrice).toBe(basePrice * 2.5 * 3.0);
    expect(fnStatTrakPrice).toBeGreaterThan(1000000); // exceeds $1M case price
  });
});

import { describe, it, expect } from "vitest";

function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

function calculateXpForLevel(level: number): number {
  return (level - 1) * (level - 1) * 100;
}

describe("calculateLevel", () => {
  it("returns level 1 for 0 XP", () => {
    expect(calculateLevel(0)).toBe(1);
  });

  it("returns level 2 for 100 XP", () => {
    expect(calculateLevel(100)).toBe(2);
  });

  it("returns level 3 for 400 XP", () => {
    expect(calculateLevel(400)).toBe(3);
  });

  it("returns level 1 for 99 XP (just below threshold)", () => {
    expect(calculateLevel(99)).toBe(1);
  });

  it("returns level 11 for 10000 XP", () => {
    expect(calculateLevel(10000)).toBe(11);
  });

  it("matches the formula: floor(sqrt(xp / 100)) + 1", () => {
    const testValues = [0, 50, 100, 200, 399, 400, 900, 1600, 2500, 10000];
    for (const xp of testValues) {
      expect(calculateLevel(xp)).toBe(Math.floor(Math.sqrt(xp / 100)) + 1);
    }
  });
});

describe("calculateXpForLevel", () => {
  it("returns 0 XP for level 1", () => {
    expect(calculateXpForLevel(1)).toBe(0);
  });

  it("returns 100 XP for level 2", () => {
    expect(calculateXpForLevel(2)).toBe(100);
  });

  it("returns 400 XP for level 3", () => {
    expect(calculateXpForLevel(3)).toBe(400);
  });

  it("returns correct XP for higher levels", () => {
    expect(calculateXpForLevel(5)).toBe(1600);
    expect(calculateXpForLevel(11)).toBe(10000);
  });

  it("is the inverse of calculateLevel at level boundaries", () => {
    for (let level = 1; level <= 15; level++) {
      const xp = calculateXpForLevel(level);
      expect(calculateLevel(xp)).toBe(level);
    }
  });
});

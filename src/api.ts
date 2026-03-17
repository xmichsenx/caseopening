import type { Skin } from "./types";
import { SKINS_API_URL, CASE_POOL_LIMITS } from "./constants";

interface RawSkin {
  id: string;
  name: string;
  description: string | null;
  weapon: {
    id: string;
    name: string;
  };
  category: {
    id: string;
    name: string;
  };
  rarity: {
    id: string;
    name: string;
    color: string;
  };
  image: string | null;
}

let skinsCache: Skin[] | null = null;

export async function fetchSkins(): Promise<Skin[]> {
  if (skinsCache) return skinsCache;

  const response = await fetch(SKINS_API_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch skins: ${response.status}`);
  }

  const rawSkins: RawSkin[] = await response.json();

  // Filter to only skins that have images and valid rarity
  const validRarities = new Set([
    "Mil-Spec Grade",
    "Restricted",
    "Classified",
    "Covert",
    "Extraordinary",
  ]);

  skinsCache = rawSkins
    .filter(
      (s): s is RawSkin & { image: string; description: string } =>
        s.image !== null &&
        s.rarity !== undefined &&
        validRarities.has(s.rarity.name),
    )
    .map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      weapon: s.weapon,
      category: s.category,
      rarity: s.rarity,
      image: s.image,
    }));

  return skinsCache;
}

export function getSkinsByRarity(skins: Skin[], rarity: string): Skin[] {
  return skins.filter((s) => s.rarity.name === rarity);
}

export function getSkinsForCategories(
  allSkins: Skin[],
  categories: string[],
): Skin[] {
  const allowed = new Set(categories.map((c) => c.toLowerCase()));
  return allSkins.filter((s) => allowed.has(s.category.name.toLowerCase()));
}

export function clearSkinsCache(): void {
  skinsCache = null;
}

/**
 * Deterministically select a limited skin pool for a specific case.
 * Uses the case ID as a seed so each case always shows the same items.
 */
export function limitSkinPoolForCase(
  skins: Skin[],
  caseId: string,
  limits?: Record<string, number>,
): Skin[] {
  const poolLimits = limits ?? CASE_POOL_LIMITS;

  // Simple hash for deterministic seeding
  let seed = 0;
  for (let i = 0; i < caseId.length; i++) {
    seed = ((seed << 5) - seed + caseId.charCodeAt(i)) | 0;
  }
  seed = Math.abs(seed);

  const result: Skin[] = [];

  for (const [rarity, maxCount] of Object.entries(poolLimits)) {
    const pool = getSkinsByRarity(skins, rarity);
    if (pool.length <= maxCount) {
      result.push(...pool);
      continue;
    }

    // Deterministic selection via LCG seeded per case
    const indices = new Set<number>();
    let h = seed ^ (rarity.length * 31); // Mix rarity into seed
    while (indices.size < maxCount) {
      h = ((h * 1103515245 + 12345) | 0) >>> 0;
      const idx = h % pool.length;
      indices.add(idx);
    }
    for (const idx of indices) {
      result.push(pool[idx]);
    }
  }

  return result;
}

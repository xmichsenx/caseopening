export type Rarity =
  | "Mil-Spec Grade"
  | "Restricted"
  | "Classified"
  | "Covert"
  | "Extraordinary";

export type Wear =
  | "Factory New"
  | "Minimal Wear"
  | "Field-Tested"
  | "Well-Worn"
  | "Battle-Scarred";

export interface Skin {
  id: string;
  name: string;
  description: string;
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
  image: string;
}

export interface InventoryItem {
  id: string; // unique inventory entry id
  skin: Skin;
  wonAt: number; // timestamp
  sellPrice: number; // randomized sell price
  wear: Wear;
  isStatTrak: boolean;
}

export interface CaseDefinition {
  id: string;
  name: string;
  price: number;
  image: string;
  xpReward: number;
  description: string;
  rarityFilter?: Rarity[]; // if set, only these rarities can drop
  levelRequired?: number; // minimum level to open this case
  rarityWeights?: Record<string, number>; // custom odds override
  sellPriceMultiplier?: number; // scales sell price (default 1)
  weaponCategories?: string[]; // filter skins by weapon category (e.g. "Pistols", "Rifles")
}

export interface GameState {
  balance: number;
  xp: number;
  level: number;
  inventory: InventoryItem[];
  totalCasesOpened: number;
}

// ── Skin Roulette ────────────────────────────────────

export type RouletteColor = "red" | "black" | "green";

export interface RouletteSegment {
  color: RouletteColor;
  number: number; // 0-14
}

export interface SkinRouletteResult {
  winningSegment: RouletteSegment;
  winningIndex: number; // index within SKIN_ROULETTE_SEGMENTS
}

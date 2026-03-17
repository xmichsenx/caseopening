import { useState, useCallback, useMemo } from "react";
import type { CaseDefinition, InventoryItem, Skin } from "./types";
import { WINNER_INDEX } from "./constants";
import { getSkinsForCategories, limitSkinPoolForCase } from "./api";
import { useGameState } from "./hooks/useGameState";
import { useSkins } from "./hooks/useSkins";
import { computeSkinPrice, generateRouletteStrip } from "./engine";
import { Dashboard } from "./components/Dashboard";
import { CaseSelector } from "./components/CaseSelector";
import { OpeningModal } from "./components/OpeningModal";
import { CaseBattle } from "./components/CaseBattle";
import { Inventory } from "./components/Inventory";
import { CaseDetailModal } from "./components/CaseDetailModal";

const CASES: CaseDefinition[] = [
  // ── Free Tier ($0) ─────────────────────────────────────
  {
    id: "welcome",
    name: "Welcome Case",
    price: 0,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_2021_2_png.png",
    xpReward: 0,
    description: "Free starter — Blues & Purples only",
    rarityFilter: ["Mil-Spec Grade", "Restricted"],
  },
  {
    id: "recruit-drop",
    name: "Recruit Drop",
    price: 0,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_1_png.png",
    xpReward: 0,
    description: "Unlocks at Level 5 — Up to Pinks",
    rarityFilter: ["Mil-Spec Grade", "Restricted", "Classified"],
    levelRequired: 5,
  },
  {
    id: "veteran-drop",
    name: "Veteran Drop",
    price: 0,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_2_png.png",
    xpReward: 0,
    description: "Unlocks at Level 10 — Up to Reds",
    rarityFilter: ["Mil-Spec Grade", "Restricted", "Classified", "Covert"],
    levelRequired: 10,
  },
  {
    id: "elite-drop",
    name: "Elite Drop",
    price: 0,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_2020_1_png.png",
    xpReward: 0,
    description: "Unlocks at Level 15 — All rarities",
    levelRequired: 15,
  },
  {
    id: "legendary-drop",
    name: "Legendary Drop",
    price: 0,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_2019_png.png",
    xpReward: 0,
    description: "Unlocks at Level 20 — Boosted rare odds",
    levelRequired: 20,
    rarityWeights: {
      "Mil-Spec Grade": 70,
      Restricted: 20,
      Classified: 6,
      Covert: 3,
      Extraordinary: 1,
    },
  },
  // ── $2 Tier ──────────────────────────────────────────
  {
    id: "dusty-crate",
    name: "Dusty Crate",
    price: 2,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_2024_png.png",
    xpReward: 100,
    description: "$2 — Cheap thrills, all weapons",
    sellPriceMultiplier: 1,
  },
  {
    id: "pistol-pop",
    name: "Pistol Pop",
    price: 2,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_2023_png.png",
    xpReward: 100,
    description: "$2 — Sidearm specials only",
    sellPriceMultiplier: 1,
    weaponCategories: ["Pistols"],
  },
  {
    id: "spray-control",
    name: "Spray Control",
    price: 2,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_2021_1_png.png",
    xpReward: 100,
    description: "$2 — SMG skins galore",
    sellPriceMultiplier: 1,
    weaponCategories: ["SMGs"],
  },
  // ── $5 Tier ──────────────────────────────────────────
  {
    id: "rifle-rush",
    name: "Rifle Rush",
    price: 5,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_2022_png.png",
    xpReward: 200,
    description: "$5 — Rifles only, better drops",
    sellPriceMultiplier: 2.5,
    weaponCategories: ["Rifles"],
    rarityWeights: {
      "Mil-Spec Grade": 75,
      Restricted: 19,
      Classified: 5,
      Covert: 0.75,
      Extraordinary: 0.25,
    },
  },
  {
    id: "field-tested",
    name: "Field Tested",
    price: 5,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_2020_2_png.png",
    xpReward: 200,
    description: "$5 — All weapons, improved odds",
    sellPriceMultiplier: 2.5,
    rarityWeights: {
      "Mil-Spec Grade": 75,
      Restricted: 19,
      Classified: 5,
      Covert: 0.75,
      Extraordinary: 0.25,
    },
  },
  // ── $10 Tier ─────────────────────────────────────────
  {
    id: "shadow-cache",
    name: "Shadow Cache",
    price: 10,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_2021_png.png",
    xpReward: 400,
    description: "$10 — Dark treasures await",
    sellPriceMultiplier: 4,
    rarityWeights: {
      "Mil-Spec Grade": 70,
      Restricted: 20,
      Classified: 7.74,
      Covert: 2,
      Extraordinary: 0.26,
    },
  },
  {
    id: "snipers-nest",
    name: "Sniper's Nest",
    price: 10,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_esports_2013_png.png",
    xpReward: 400,
    description: "$10 — Precision pays off",
    sellPriceMultiplier: 4,
    weaponCategories: ["Rifles"],
    rarityWeights: {
      "Mil-Spec Grade": 70,
      Restricted: 20,
      Classified: 7.74,
      Covert: 2,
      Extraordinary: 0.26,
    },
  },
  // ── $20 Tier ─────────────────────────────────────────
  {
    id: "neon-vault",
    name: "Neon Vault",
    price: 20,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_3_png.png",
    xpReward: 700,
    description: "$20 — Glowing with potential",
    sellPriceMultiplier: 7,
    rarityWeights: {
      "Mil-Spec Grade": 65,
      Restricted: 22,
      Classified: 10,
      Covert: 2.74,
      Extraordinary: 0.26,
    },
  },
  {
    id: "phantom-case",
    name: "Phantom Case",
    price: 20,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_5_png.png",
    xpReward: 700,
    description: "$20 — Now you see it...",
    sellPriceMultiplier: 7,
    rarityWeights: {
      "Mil-Spec Grade": 65,
      Restricted: 22,
      Classified: 10,
      Covert: 2.74,
      Extraordinary: 0.26,
    },
  },
  // ── $50 Tier ─────────────────────────────────────────
  {
    id: "dragons-hoard",
    name: "Dragon's Hoard",
    price: 50,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_8_png.png",
    xpReward: 1500,
    description: "$50 — Rare treasures inside",
    sellPriceMultiplier: 12,
    rarityWeights: {
      "Mil-Spec Grade": 60,
      Restricted: 24,
      Classified: 12,
      Covert: 3.5,
      Extraordinary: 0.5,
    },
  },
  {
    id: "golden-armory",
    name: "Golden Armory",
    price: 50,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_10_png.png",
    xpReward: 1500,
    description: "$50 — Premium arsenal",
    sellPriceMultiplier: 12,
    rarityWeights: {
      "Mil-Spec Grade": 60,
      Restricted: 24,
      Classified: 12,
      Covert: 3.5,
      Extraordinary: 0.5,
    },
  },
  // ── $100 Tier ────────────────────────────────────────
  {
    id: "obsidian-vault",
    name: "Obsidian Vault",
    price: 100,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_13_png.png",
    xpReward: 3000,
    description: "$100 — Elite-tier drops",
    sellPriceMultiplier: 25,
    rarityWeights: {
      "Mil-Spec Grade": 50,
      Restricted: 28,
      Classified: 16,
      Covert: 5.74,
      Extraordinary: 0.26,
    },
  },
  {
    id: "titans-chest",
    name: "Titan's Chest",
    price: 100,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_16_png.png",
    xpReward: 3000,
    description: "$100 — Massive jackpots await",
    sellPriceMultiplier: 25,
    rarityWeights: {
      "Mil-Spec Grade": 50,
      Restricted: 28,
      Classified: 16,
      Covert: 5.74,
      Extraordinary: 0.26,
    },
  },
  // ── $200 Tier ────────────────────────────────────────
  {
    id: "diamond-case",
    name: "Diamond Case",
    price: 200,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_17_png.png",
    xpReward: 5000,
    description: "$200 — The ultimate gamble",
    sellPriceMultiplier: 30,
    rarityWeights: {
      "Mil-Spec Grade": 45,
      Restricted: 28,
      Classified: 18,
      Covert: 8.5,
      Extraordinary: 0.5,
    },
  },
  // ── NEW: $3 Tier ─────────────────────────────────────
  {
    id: "scrapyard",
    name: "Scrapyard",
    price: 3,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_4_png.png",
    xpReward: 120,
    description: "$3 — Junkyard finds",
    sellPriceMultiplier: 1.2,
  },
  {
    id: "budget-blitz",
    name: "Budget Blitz",
    price: 3,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_6_png.png",
    xpReward: 120,
    description: "$3 — Bargain bin bonanza",
    sellPriceMultiplier: 1.2,
    weaponCategories: ["Pistols", "SMGs"],
  },
  // ── NEW: $7 Tier ─────────────────────────────────────
  {
    id: "midnight-run",
    name: "Midnight Run",
    price: 7,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_7_png.png",
    xpReward: 280,
    description: "$7 — Late-night loot",
    sellPriceMultiplier: 3,
    rarityWeights: {
      "Mil-Spec Grade": 73,
      Restricted: 20,
      Classified: 5.5,
      Covert: 1.25,
      Extraordinary: 0.25,
    },
  },
  // ── NEW: $15 Tier ────────────────────────────────────
  {
    id: "urban-warfare",
    name: "Urban Warfare",
    price: 15,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_9_png.png",
    xpReward: 550,
    description: "$15 — Street fighter specials",
    sellPriceMultiplier: 5.5,
    weaponCategories: ["Rifles", "SMGs"],
    rarityWeights: {
      "Mil-Spec Grade": 68,
      Restricted: 21,
      Classified: 8,
      Covert: 2.5,
      Extraordinary: 0.5,
    },
  },
  {
    id: "tactical-drop",
    name: "Tactical Drop",
    price: 15,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_11_png.png",
    xpReward: 550,
    description: "$15 — Operators only",
    sellPriceMultiplier: 5.5,
    rarityWeights: {
      "Mil-Spec Grade": 68,
      Restricted: 21,
      Classified: 8,
      Covert: 2.74,
      Extraordinary: 0.26,
    },
  },
  // ── NEW: $25 Tier ────────────────────────────────────
  {
    id: "crimson-cache",
    name: "Crimson Cache",
    price: 25,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_12_png.png",
    xpReward: 800,
    description: "$25 — Blood-red profits",
    sellPriceMultiplier: 8,
    rarityWeights: {
      "Mil-Spec Grade": 63,
      Restricted: 23,
      Classified: 10,
      Covert: 3.5,
      Extraordinary: 0.5,
    },
  },
  // ── NEW: $35 Tier ────────────────────────────────────
  {
    id: "cyber-vault",
    name: "Cyber Vault",
    price: 35,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_14_png.png",
    xpReward: 1100,
    description: "$35 — Digital contraband",
    sellPriceMultiplier: 10,
    rarityWeights: {
      "Mil-Spec Grade": 62,
      Restricted: 23,
      Classified: 11,
      Covert: 3.5,
      Extraordinary: 0.5,
    },
  },
  // ── NEW: $75 Tier ────────────────────────────────────
  {
    id: "inferno-box",
    name: "Inferno Box",
    price: 75,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_community_15_png.png",
    xpReward: 2200,
    description: "$75 — Forged in fire",
    sellPriceMultiplier: 18,
    rarityWeights: {
      "Mil-Spec Grade": 55,
      Restricted: 26,
      Classified: 14,
      Covert: 4.5,
      Extraordinary: 0.5,
    },
  },
  {
    id: "arctic-arsenal",
    name: "Arctic Arsenal",
    price: 75,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_esports_2013_winter_png.png",
    xpReward: 2200,
    description: "$75 — Ice-cold precision, Rifles only",
    sellPriceMultiplier: 18,
    weaponCategories: ["Rifles"],
    rarityWeights: {
      "Mil-Spec Grade": 55,
      Restricted: 26,
      Classified: 14,
      Covert: 4.5,
      Extraordinary: 0.5,
    },
  },
  // ── NEW: $150 Tier ───────────────────────────────────
  {
    id: "viper-case",
    name: "Viper Case",
    price: 150,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_esports_2014_summer_png.png",
    xpReward: 4000,
    description: "$150 — Venomous rewards",
    sellPriceMultiplier: 28,
    rarityWeights: {
      "Mil-Spec Grade": 48,
      Restricted: 28,
      Classified: 16,
      Covert: 7.5,
      Extraordinary: 0.5,
    },
  },
  // ── NEW: $300 Tier ───────────────────────────────────
  {
    id: "royal-treasury",
    name: "Royal Treasury",
    price: 300,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_sticker_pack_kat2015_legends_png.png",
    xpReward: 7000,
    description: "$300 — Crown jewels of CS2",
    sellPriceMultiplier: 40,
    rarityWeights: {
      "Mil-Spec Grade": 42,
      Restricted: 28,
      Classified: 20,
      Covert: 9,
      Extraordinary: 1,
    },
  },
  {
    id: "warzone-crate",
    name: "Warzone Crate",
    price: 300,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_sticker_pack_kat2015_challengers_png.png",
    xpReward: 7000,
    description: "$300 — Battlefield bounty, Rifles only",
    sellPriceMultiplier: 40,
    weaponCategories: ["Rifles"],
    rarityWeights: {
      "Mil-Spec Grade": 42,
      Restricted: 28,
      Classified: 20,
      Covert: 9,
      Extraordinary: 1,
    },
  },
  // ── NEW: $500 Tier ───────────────────────────────────
  {
    id: "black-market",
    name: "Black Market",
    price: 500,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_sticker_pack_cologne2015_legends_png.png",
    xpReward: 10000,
    description: "$500 — Illicit goods, huge risk",
    sellPriceMultiplier: 55,
    rarityWeights: {
      "Mil-Spec Grade": 38,
      Restricted: 28,
      Classified: 22,
      Covert: 10.5,
      Extraordinary: 1.5,
    },
  },
  {
    id: "pandoras-box",
    name: "Pandora's Box",
    price: 500,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_sticker_pack_cologne2015_challengers_png.png",
    xpReward: 10000,
    description: "$500 — Should you open it?",
    sellPriceMultiplier: 55,
    rarityWeights: {
      "Mil-Spec Grade": 35,
      Restricted: 30,
      Classified: 22,
      Covert: 11.5,
      Extraordinary: 1.5,
    },
  },
  // ── NEW: $1000 "High Roller" Tier ────────────────────
  // Lots of Reds & Golds in the pool but Blues dominate drops
  // EV: Blue ~$2-6, Purple ~$8-24, Pink ~$30-180, Red ~$150-1050, Gold ~$1500-15000
  // ~58% chance of Blue ($2-6) = devastating loss on a $1000 case
  {
    id: "high-roller",
    name: "High Roller",
    price: 1000,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_sticker_pack_cluj2015_legends_png.png",
    xpReward: 18000,
    description: "$1000 — Fortune favors the bold",
    sellPriceMultiplier: 30,
    rarityWeights: {
      "Mil-Spec Grade": 58,
      Restricted: 22,
      Classified: 12,
      Covert: 6,
      Extraordinary: 2,
    },
  },
  {
    id: "whale-case",
    name: "Whale Case",
    price: 1000,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_sticker_pack_cluj2015_challengers_png.png",
    xpReward: 18000,
    description: "$1000 — Big spender, bigger losses",
    sellPriceMultiplier: 35,
    rarityWeights: {
      "Mil-Spec Grade": 55,
      Restricted: 24,
      Classified: 13,
      Covert: 6,
      Extraordinary: 2,
    },
  },
  // ── NEW: $2500 "Mega" Tier ───────────────────────────
  // ~50% Blue ($5-10), ~22% Purple ($20-53) = total wipeout most opens
  // Only Red (5%) and Gold (2%) can recoup the cost
  {
    id: "megalodon",
    name: "Megalodon",
    price: 2500,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_sticker_pack_mlg2016_legends_png.png",
    xpReward: 30000,
    description: "$2500 — Apex predator stakes",
    sellPriceMultiplier: 50,
    rarityWeights: {
      "Mil-Spec Grade": 50,
      Restricted: 22,
      Classified: 18,
      Covert: 7,
      Extraordinary: 3,
    },
  },
  // ── NEW: $5000 "Legendary" Tier ──────────────────────
  // ~45% Blue ($7-20), ~20% Purple ($30-80) = catastrophic loss
  // ~18% Pink ($100-600), 10% Red ($500-3500), 7% Gold ($5000-50000)
  // Only Gold is a guaranteed profit; Red breaks even sometimes
  {
    id: "the-last-gamble",
    name: "The Last Gamble",
    price: 5000,
    image:
      "https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/weapon_cases/crate_sticker_pack_mlg2016_challengers_png.png",
    xpReward: 50000,
    description: "$5000 — All or nothing",
    sellPriceMultiplier: 100,
    rarityWeights: {
      "Mil-Spec Grade": 45,
      Restricted: 20,
      Classified: 18,
      Covert: 10,
      Extraordinary: 7,
    },
  },
];

export function App() {
  const {
    state,
    addXp,
    addToInventory,
    sellItem,
    spendBalance,
    resetGame,
    xpProgress,
  } = useGameState();
  const { skins, loading, error } = useSkins();

  const [selectedCase, setSelectedCase] = useState<CaseDefinition>(CASES[0]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStrips, setModalStrips] = useState<Skin[][]>([]);
  const [battleOpen, setBattleOpen] = useState(false);

  // Get skins specific to the selected case (filtered by weapon category, then limited to case pool)
  const caseSkins = useMemo(() => {
    if (skins.length === 0) return skins;
    let pool = skins;
    if (
      selectedCase.weaponCategories &&
      selectedCase.weaponCategories.length > 0
    ) {
      const filtered = getSkinsForCategories(
        skins,
        selectedCase.weaponCategories,
      );
      if (filtered.length > 0) pool = filtered;
    }
    return limitSkinPoolForCase(pool, selectedCase.id);
  }, [skins, selectedCase]);

  // Find the most expensive skin in this case's pool for display
  const featuredSkin = useMemo(() => {
    if (caseSkins.length === 0) return null;
    const mult = selectedCase.sellPriceMultiplier ?? 1;
    let best = caseSkins[0];
    let bestPrice = computeSkinPrice(best, 0) * mult;
    for (let i = 1; i < caseSkins.length; i++) {
      const price = computeSkinPrice(caseSkins[i], 0) * mult;
      if (price > bestPrice) {
        best = caseSkins[i];
        bestPrice = price;
      }
    }
    return best;
  }, [caseSkins, selectedCase.sellPriceMultiplier]);

  const handleSelectCase = useCallback((c: CaseDefinition) => {
    setSelectedCase(c);
    setDetailOpen(true);
  }, []);

  const handleOpen = useCallback(
    (count: number) => {
      if (modalOpen) return;
      const totalCost = selectedCase.price * count;
      const meetsLevel =
        !selectedCase.levelRequired ||
        state.level >= selectedCase.levelRequired;
      const canOpen =
        caseSkins.length > 0 &&
        meetsLevel &&
        (selectedCase.price === 0 || state.balance >= totalCost);
      if (!canOpen) return;

      if (selectedCase.price > 0) {
        spendBalance(totalCost);
      }

      const isFree = selectedCase.price === 0;
      const strips: Skin[][] = [];
      for (let i = 0; i < count; i++) {
        const result = generateRouletteStrip(
          caseSkins,
          isFree,
          selectedCase.rarityFilter,
          selectedCase.rarityWeights,
        );
        strips.push(result.strip);
      }
      setModalStrips(strips);
      setDetailOpen(false);
      setModalOpen(true);
    },
    [
      modalOpen,
      selectedCase,
      state.level,
      state.balance,
      caseSkins,
      spendBalance,
    ],
  );

  const [recentWonItems, setRecentWonItems] = useState<InventoryItem[]>([]);

  const handleSpinsComplete = useCallback(
    (winners: Skin[]) => {
      const multiplier = selectedCase.sellPriceMultiplier ?? 1;
      const items: InventoryItem[] = [];
      for (const winner of winners) {
        const price = computeSkinPrice(winner, WINNER_INDEX) * multiplier;
        items.push(addToInventory(winner, multiplier, price));
      }
      setRecentWonItems(items);
      if (selectedCase.price > 0) {
        addXp(selectedCase.xpReward * winners.length);
      }
    },
    [addToInventory, addXp, selectedCase],
  );

  const handleBattleComplete = useCallback(
    (wonSkins: Skin[], _totalValue: number) => {
      const multiplier = selectedCase.sellPriceMultiplier ?? 1;
      const items: InventoryItem[] = [];
      for (const skin of wonSkins) {
        const price = computeSkinPrice(skin, WINNER_INDEX) * multiplier;
        items.push(addToInventory(skin, multiplier, price));
      }
      setRecentWonItems(items);
      if (selectedCase.price > 0) {
        addXp(selectedCase.xpReward);
      }
    },
    [addToInventory, addXp, selectedCase],
  );

  const handleStartBattle = useCallback(() => {
    const meetsLevel =
      !selectedCase.levelRequired || state.level >= selectedCase.levelRequired;
    if (!meetsLevel || caseSkins.length === 0) return;
    setDetailOpen(false);
    setBattleOpen(true);
  }, [selectedCase, state.level, caseSkins.length]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-white/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm uppercase tracking-wider">
            Loading skins data...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 max-w-md text-center">
          <p className="text-red-400 font-bold mb-2">Failed to load skins</p>
          <p className="text-gray-400 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      {/* Title */}
      <header className="text-center mb-8 pt-2">
        <h1
          className="text-4xl md:text-5xl font-black text-white tracking-tight"
          style={{ textShadow: "0 0 40px rgba(75,105,255,0.3)" }}
        >
          GLOBAL OFFENSIVE
        </h1>
        <p className="text-xs text-gray-500 uppercase tracking-[0.4em] mt-2 font-medium">
          Case Simulator 4.6
        </p>
      </header>

      {/* Dashboard */}
      <Dashboard
        balance={state.balance}
        level={state.level}
        xp={state.xp}
        xpProgress={xpProgress}
        totalCasesOpened={state.totalCasesOpened}
        onReset={resetGame}
      />

      {/* Case Selector */}
      <CaseSelector
        cases={CASES}
        selectedCase={selectedCase}
        onSelectCase={handleSelectCase}
        balance={state.balance}
        level={state.level}
        skins={skins}
      />

      {/* Case Detail Modal */}
      <CaseDetailModal
        isOpen={detailOpen}
        selectedCase={selectedCase}
        skins={caseSkins}
        balance={state.balance}
        level={state.level}
        featuredSkin={featuredSkin}
        onClose={() => setDetailOpen(false)}
        onOpen={handleOpen}
        onBattle={handleStartBattle}
      />

      {/* Opening Modal */}
      <OpeningModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setRecentWonItems([]);
        }}
        strips={modalStrips}
        onAllSpinsComplete={handleSpinsComplete}
        caseName={selectedCase.name}
        caseImage={featuredSkin?.image ?? selectedCase.image}
        wonItems={recentWonItems}
        onSellItem={sellItem}
      />

      {/* Case Battle Modal */}
      <CaseBattle
        isOpen={battleOpen}
        onClose={() => {
          setBattleOpen(false);
          setRecentWonItems([]);
        }}
        selectedCase={selectedCase}
        skins={caseSkins}
        onBattleComplete={handleBattleComplete}
        balance={state.balance}
        wonItems={recentWonItems}
        onSellItem={sellItem}
        onSpend={spendBalance}
      />

      {/* Inventory */}
      <Inventory items={state.inventory} onSell={sellItem} />
    </div>
  );
}

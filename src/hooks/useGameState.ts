import { useState, useEffect, useCallback } from "react";
import type { GameState, InventoryItem, Skin } from "../types";
import {
  STARTING_BALANCE,
  LEVEL_UP_BONUS,
  SELL_PRICE_RANGES,
} from "../constants";
import { rollWear, rollStatTrak, computeFullPrice } from "../engine";

const STORAGE_KEY = "cs2-case-sim-state";

function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

function calculateXpForLevel(level: number): number {
  return (level - 1) * (level - 1) * 100;
}

function generateSellPrice(rarityName: string): number {
  const range = SELL_PRICE_RANGES[rarityName] ?? [0.03, 0.5];
  const [min, max] = range;
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function loadState(): GameState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as GameState;
      // Migrate old inventory items that lack wear/isStatTrak
      for (const item of parsed.inventory) {
        if (!item.wear) item.wear = "Field-Tested";
        if (item.isStatTrak == null) item.isStatTrak = false;
      }
      return {
        ...parsed,
        level: calculateLevel(parsed.xp),
      };
    }
  } catch {
    // Ignore parse errors
  }
  return {
    balance: STARTING_BALANCE,
    xp: 0,
    level: 1,
    inventory: [],
    totalCasesOpened: 0,
  };
}

function saveState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors
  }
}

export function useGameState() {
  const [state, setState] = useState<GameState>(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const addXp = useCallback((amount: number) => {
    setState((prev) => {
      const newXp = prev.xp + amount;
      const newLevel = calculateLevel(newXp);
      const leveledUp = newLevel > prev.level;
      return {
        ...prev,
        xp: newXp,
        level: newLevel,
        balance: leveledUp ? prev.balance + LEVEL_UP_BONUS : prev.balance,
      };
    });
  }, []);

  const addToInventory = useCallback(
    (skin: Skin, sellPriceMultiplier = 1, explicitSellPrice?: number) => {
      const wear = rollWear();
      const isStatTrak = rollStatTrak();
      const basePrice =
        explicitSellPrice != null
          ? explicitSellPrice
          : generateSellPrice(skin.rarity.name) * sellPriceMultiplier;
      const finalPrice = computeFullPrice(basePrice, wear, isStatTrak);
      const item: InventoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        skin,
        wonAt: Date.now(),
        sellPrice: finalPrice,
        wear,
        isStatTrak,
      };
      setState((prev) => ({
        ...prev,
        inventory: [item, ...prev.inventory],
        totalCasesOpened: prev.totalCasesOpened + 1,
      }));
      return item;
    },
    [],
  );

  const sellItem = useCallback((itemId: string) => {
    setState((prev) => {
      const item = prev.inventory.find((i) => i.id === itemId);
      if (!item) return prev;
      return {
        ...prev,
        balance: Math.round((prev.balance + item.sellPrice) * 100) / 100,
        inventory: prev.inventory.filter((i) => i.id !== itemId),
      };
    });
  }, []);

  const spendBalance = useCallback((amount: number): boolean => {
    let success = false;
    setState((prev) => {
      if (prev.balance < amount) {
        success = false;
        return prev;
      }
      success = true;
      return {
        ...prev,
        balance: Math.round((prev.balance - amount) * 100) / 100,
      };
    });
    return success;
  }, []);

  const resetGame = useCallback(() => {
    const fresh: GameState = {
      balance: STARTING_BALANCE,
      xp: 0,
      level: 1,
      inventory: [],
      totalCasesOpened: 0,
    };
    setState(fresh);
  }, []);

  const xpForCurrentLevel = calculateXpForLevel(state.level);
  const xpForNextLevel = calculateXpForLevel(state.level + 1);
  const xpProgress =
    xpForNextLevel > xpForCurrentLevel
      ? (state.xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)
      : 0;

  return {
    state,
    addXp,
    addToInventory,
    sellItem,
    spendBalance,
    resetGame,
    xpProgress,
    xpForNextLevel,
  };
}

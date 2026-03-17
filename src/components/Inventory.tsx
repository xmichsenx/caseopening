import { useState } from "react";
import type { InventoryItem } from "../types";
import { RARITY_COLORS } from "../constants";

interface InventoryProps {
  items: InventoryItem[];
  onSell: (itemId: string) => void;
}

type SortMode = "newest" | "price-high" | "price-low" | "rarity";

const RARITY_ORDER: Record<string, number> = {
  Extraordinary: 5,
  Covert: 4,
  Classified: 3,
  Restricted: 2,
  "Mil-Spec Grade": 1,
};

export function Inventory({ items, onSell }: InventoryProps) {
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  const sortedItems = [...items].sort((a, b) => {
    switch (sortMode) {
      case "newest":
        return b.wonAt - a.wonAt;
      case "price-high":
        return b.sellPrice - a.sellPrice;
      case "price-low":
        return a.sellPrice - b.sellPrice;
      case "rarity":
        return (
          (RARITY_ORDER[b.skin.rarity.name] ?? 0) -
          (RARITY_ORDER[a.skin.rarity.name] ?? 0)
        );
      default:
        return 0;
    }
  });

  const totalValue = items.reduce((sum, item) => sum + item.sellPrice, 0);

  return (
    <div className="w-full mt-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-black text-white uppercase tracking-wider">
            Inventory
          </h2>
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10">
            <span className="text-xs text-gray-400">{items.length} items</span>
            <span className="text-xs text-gray-600">·</span>
            <span className="text-xs text-green-400 font-bold">
              ${totalValue.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex gap-1.5">
          {(
            [
              ["newest", "Newest"],
              ["price-high", "Price ↓"],
              ["price-low", "Price ↑"],
              ["rarity", "Rarity"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`
                px-3 py-1 text-[10px] uppercase tracking-wider rounded-lg border transition-all cursor-pointer font-bold
                ${
                  sortMode === mode
                    ? "bg-white/10 border-white/20 text-white"
                    : "bg-white/[0.02] border-white/5 text-gray-500 hover:text-white hover:border-white/15"
                }
              `}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {items.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-white/10">
          <p className="text-lg mb-1 text-gray-500 font-medium">
            Your inventory is empty
          </p>
          <p className="text-sm text-gray-600">
            Open some cases to get started!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {sortedItems.map((item) => {
            const rarityColor = RARITY_COLORS[item.skin.rarity.name] ?? "#666";
            const isHighValue = (RARITY_ORDER[item.skin.rarity.name] ?? 0) >= 4;

            return (
              <div
                key={item.id}
                className={`group relative flex flex-col items-center p-3 rounded-xl border transition-all duration-300 overflow-hidden
                  hover:scale-[1.03] hover:-translate-y-0.5`}
                style={{
                  borderColor: rarityColor + "33",
                  background: `linear-gradient(170deg, ${rarityColor}08 0%, rgba(0,0,0,0.3) 100%)`,
                  boxShadow: `0 4px 15px rgba(0,0,0,0.2)`,
                  ["--glow-color" as string]: rarityColor + "44",
                }}
              >
                {/* Top rarity bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-0.5"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${rarityColor}, transparent)`,
                  }}
                />

                {/* Hover glow */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: `radial-gradient(ellipse at 50% 30%, ${rarityColor}15 0%, transparent 70%)`,
                  }}
                />

                {/* High-value shimmer */}
                {isHighValue && (
                  <div
                    className="absolute inset-0 opacity-30 animate-shimmer pointer-events-none"
                    style={{
                      background: `linear-gradient(90deg, transparent 0%, ${rarityColor}20 50%, transparent 100%)`,
                      backgroundSize: "200% 100%",
                    }}
                  />
                )}

                {/* Skin image */}
                <img
                  src={item.skin.image}
                  alt={item.skin.name}
                  className="relative w-full h-20 object-contain mb-2 transition-transform duration-300 group-hover:scale-110 drop-shadow-lg"
                  loading="lazy"
                />

                {/* Skin name */}
                <span
                  className="relative text-xs font-bold text-center truncate w-full mb-0.5"
                  style={{ color: rarityColor }}
                >
                  {item.isStatTrak && (
                    <span className="text-orange-400">ST™ </span>
                  )}
                  {item.skin.name.length > 18
                    ? item.skin.name.slice(0, 15) + "..."
                    : item.skin.name}
                </span>

                {/* Wear label */}
                <span className="text-[9px] text-gray-400 mb-0.5">
                  {item.wear}
                </span>

                {/* Rarity label */}
                <span className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">
                  {item.skin.rarity.name}
                </span>

                {/* Sell price */}
                <span className="relative text-sm text-green-400 font-black tabular-nums mb-2">
                  ${item.sellPrice.toFixed(2)}
                </span>

                {/* Sell button */}
                <button
                  onClick={() => onSell(item.id)}
                  className="relative w-full py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0"
                  style={{
                    background: `linear-gradient(135deg, ${rarityColor}30, ${rarityColor}15)`,
                    color: rarityColor,
                    border: `1px solid ${rarityColor}40`,
                  }}
                >
                  Sell
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

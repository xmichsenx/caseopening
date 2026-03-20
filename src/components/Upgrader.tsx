import { useState, useCallback, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import type { InventoryItem } from "../types";
import { RARITY_COLORS } from "../constants";
import { rollUpgrade } from "../engine";
import { playTick } from "../audio";

interface UpgraderProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  onRemoveItems: (itemIds: string[]) => void;
  onAddBalance: (amount: number) => void;
  onAddXp: (amount: number) => void;
}

type SortMode = "price-high" | "price-low" | "rarity";

const RARITY_ORDER: Record<string, number> = {
  Extraordinary: 5,
  Covert: 4,
  Classified: 3,
  Restricted: 2,
  "Mil-Spec Grade": 1,
};

const PRESET_MULTIPLIERS = [2, 5, 10, 25, 50] as const;
const HOUSE_EDGE = 0.05;

function getSuccessChance(multiplier: number): number {
  if (multiplier <= 1) return 100;
  return (1 / multiplier) * (1 - HOUSE_EDGE) * 100;
}

function getChanceColor(chance: number): string {
  if (chance >= 40) return "#27ae60";
  if (chance >= 20) return "#f39c12";
  if (chance >= 5) return "#e67e22";
  return "#e74c3c";
}

export function Upgrader({
  isOpen,
  onClose,
  inventory,
  onRemoveItems,
  onAddBalance,
  onAddXp,
}: UpgraderProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [multiplier, setMultiplier] = useState(2);
  const [upgrading, setUpgrading] = useState(false);
  const [result, setResult] = useState<{
    won: boolean;
    payout: number;
  } | null>(null);
  const [meterValue, setMeterValue] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>("price-high");

  // Reset state on open/close
  useEffect(() => {
    if (!isOpen) {
      setSelectedId(null);
      setMultiplier(2);
      setUpgrading(false);
      setResult(null);
      setMeterValue(0);
    }
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !upgrading) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, upgrading, onClose]);

  const sortedInventory = useMemo(() => {
    return [...inventory].sort((a, b) => {
      switch (sortMode) {
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
  }, [inventory, sortMode]);

  const selectedItem = useMemo(
    () => inventory.find((i) => i.id === selectedId) ?? null,
    [inventory, selectedId],
  );

  const successChance = getSuccessChance(multiplier);
  const targetValue = selectedItem
    ? Math.round(selectedItem.sellPrice * multiplier * 100) / 100
    : 0;

  const handleSelect = useCallback(
    (id: string) => {
      if (upgrading) return;
      setSelectedId((prev) => (prev === id ? null : id));
      setResult(null);
      setMeterValue(0);
    },
    [upgrading],
  );

  const handleUpgrade = useCallback(() => {
    if (upgrading || !selectedItem) return;

    setResult(null);
    setUpgrading(true);

    const won = rollUpgrade(multiplier);
    const chance = successChance / 100;

    // Determine meter landing position:
    // Success zone is [0, chance]. Fail zone is (chance, 1].
    // On win, land randomly inside success zone. On lose, land randomly in fail zone.
    const landing = won
      ? Math.random() * chance
      : chance + Math.random() * (1 - chance);

    setMeterValue(landing);

    // Tick sounds during animation
    let tickCount = 0;
    const tickInterval = setInterval(() => {
      tickCount++;
      if (tickCount < 20) {
        playTick(0.8 + Math.random() * 0.4);
      } else {
        clearInterval(tickInterval);
      }
    }, 120);

    setTimeout(() => {
      clearInterval(tickInterval);
      setUpgrading(false);
      setResult({ won, payout: won ? targetValue : 0 });

      const xpGain = Math.min(
        500,
        Math.max(10, Math.floor(selectedItem.sellPrice * 5)),
      );
      onAddXp(xpGain);

      if (won) {
        onAddBalance(targetValue);
      } else {
        onRemoveItems([selectedItem.id]);
        setSelectedId(null);
      }
    }, 2500);
  }, [
    upgrading,
    selectedItem,
    multiplier,
    successChance,
    targetValue,
    onAddBalance,
    onAddXp,
    onRemoveItems,
  ]);

  if (!isOpen) return null;

  const chanceColor = getChanceColor(successChance);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Upgrader"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={upgrading ? undefined : onClose}
      />

      {/* Main Panel */}
      <div className="relative z-10 w-full max-w-5xl max-h-[90vh] flex flex-col bg-[#0d0d0d] border border-white/10 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-white uppercase tracking-wider">
              Upgrader
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
              Risk &amp; Reward
            </span>
          </div>
          {!upgrading && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors text-xl font-bold cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* Left: Skin Picker */}
          <div className="lg:w-[300px] border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">
                  Select a Skin
                </span>
                <span className="text-xs text-gray-500">
                  {selectedId ? "1 selected" : "None"}
                </span>
              </div>
              <div className="flex gap-1 justify-end">
                {(
                  [
                    ["price-high", "$$↓"],
                    ["price-low", "$$↑"],
                    ["rarity", "★"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => setSortMode(mode)}
                    className={`px-2 py-1 text-[9px] rounded border transition-all cursor-pointer font-bold ${
                      sortMode === mode
                        ? "bg-white/10 border-white/20 text-white"
                        : "bg-white/[0.02] border-white/5 text-gray-500 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 max-h-[200px] lg:max-h-[unset]">
              {inventory.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">Inventory empty</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Open cases to get skins!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
                  {sortedInventory.map((item) => {
                    const selected = selectedId === item.id;
                    const rarityColor =
                      RARITY_COLORS[item.skin.rarity.name] ?? "#666";
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item.id)}
                        disabled={upgrading}
                        className={`relative flex flex-col items-center p-2 rounded-lg border transition-all cursor-pointer disabled:cursor-not-allowed ${
                          selected
                            ? "border-orange-400/60 bg-orange-400/10 scale-[1.02]"
                            : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/5"
                        }`}
                      >
                        {selected && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-orange-400 flex items-center justify-center text-[8px] text-black font-black">
                            ✓
                          </div>
                        )}
                        <img
                          src={item.skin.image}
                          alt={item.skin.name}
                          className="w-full h-12 object-contain mb-1"
                          loading="lazy"
                        />
                        <span
                          className="text-[9px] font-bold truncate w-full text-center"
                          style={{ color: rarityColor }}
                        >
                          {item.isStatTrak && (
                            <span className="text-orange-400">ST™ </span>
                          )}
                          {item.skin.name.length > 16
                            ? item.skin.name.slice(0, 13) + "..."
                            : item.skin.name}
                        </span>
                        <span className="text-[10px] text-green-400 font-bold">
                          ${item.sellPrice.toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Center: Upgrade Meter + Info */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5 overflow-y-auto">
            {/* Selected skin info */}
            {selectedItem ? (
              <div className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.03] border border-white/10 w-full max-w-md">
                <img
                  src={selectedItem.skin.image}
                  alt={selectedItem.skin.name}
                  className="w-16 h-16 object-contain"
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-bold truncate"
                    style={{
                      color:
                        RARITY_COLORS[selectedItem.skin.rarity.name] ?? "#fff",
                    }}
                  >
                    {selectedItem.isStatTrak && (
                      <span className="text-orange-400">ST™ </span>
                    )}
                    {selectedItem.skin.name}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {selectedItem.wear} · {selectedItem.skin.rarity.name}
                  </p>
                  <p className="text-green-400 font-black text-sm mt-0.5">
                    ${selectedItem.sellPrice.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider">
                    Target
                  </p>
                  <p className="text-lg font-black text-yellow-400 tabular-nums">
                    ${targetValue.toFixed(2)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-dashed border-white/10 text-center w-full max-w-md">
                <p className="text-gray-500 text-sm">
                  Select a skin to upgrade
                </p>
              </div>
            )}

            {/* Upgrade Meter */}
            <div className="relative w-full max-w-md h-16 rounded-xl overflow-hidden border border-white/10 bg-[#1a1a1a]">
              {/* Success zone (from left) */}
              <div
                className="absolute top-0 left-0 h-full transition-all duration-300"
                style={{
                  width: `${successChance}%`,
                  background: `linear-gradient(90deg, ${chanceColor}40, ${chanceColor}20)`,
                  borderRight: `2px solid ${chanceColor}`,
                }}
              />

              {/* Zone labels */}
              <div
                className="absolute top-1 left-1 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{
                  color: chanceColor,
                  backgroundColor: chanceColor + "20",
                }}
              >
                WIN
              </div>
              <div className="absolute top-1 right-1 text-[8px] font-bold uppercase tracking-wider text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
                LOSE
              </div>

              {/* Animated pointer */}
              <motion.div
                className="absolute top-0 h-full w-1 bg-white shadow-lg shadow-white/50 z-10"
                initial={{ left: "0%" }}
                animate={{ left: `${meterValue * 100}%` }}
                transition={
                  upgrading
                    ? { duration: 2.5, ease: [0.15, 0.85, 0.25, 1] }
                    : { duration: 0 }
                }
              />

              {/* Chance percentage centered */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span
                  className="text-2xl font-black tabular-nums"
                  style={{ color: chanceColor }}
                >
                  {successChance.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Result Banner */}
            {result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`px-6 py-3 rounded-xl border text-center w-full max-w-md ${
                  result.won
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-red-500/10 border-red-500/30"
                }`}
              >
                {result.won ? (
                  <div>
                    <p className="text-green-400 font-black text-lg">
                      UPGRADE SUCCESS!
                    </p>
                    <p className="text-green-300 text-sm">
                      +${result.payout.toFixed(2)} added to balance
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-red-400 font-black text-lg">DESTROYED</p>
                    <p className="text-red-300 text-sm">Skin has been lost</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Multiplier Selector */}
            <div className="flex flex-col items-center gap-3 w-full max-w-md">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                Multiplier
              </span>

              {/* Preset buttons */}
              <div className="flex gap-2 w-full">
                {PRESET_MULTIPLIERS.map((m) => {
                  const isActive = multiplier === m;
                  const chance = getSuccessChance(m);
                  const color = getChanceColor(chance);
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        if (!upgrading) {
                          setMultiplier(m);
                          setResult(null);
                          setMeterValue(0);
                        }
                      }}
                      disabled={upgrading}
                      className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-xl border-2 transition-all cursor-pointer disabled:cursor-not-allowed ${
                        isActive
                          ? "scale-105 shadow-lg"
                          : "opacity-50 hover:opacity-80"
                      }`}
                      style={{
                        backgroundColor: isActive
                          ? color + "20"
                          : "transparent",
                        borderColor: isActive ? color : "rgba(255,255,255,0.1)",
                      }}
                    >
                      <span className="text-white text-sm font-black">
                        {m}×
                      </span>
                      <span className="text-[9px] font-bold" style={{ color }}>
                        {chance.toFixed(1)}%
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom slider */}
              <div className="w-full flex items-center gap-3">
                <span className="text-[10px] text-gray-500 font-bold w-8">
                  2×
                </span>
                <input
                  type="range"
                  min={2}
                  max={50}
                  step={1}
                  value={multiplier}
                  onChange={(e) => {
                    if (!upgrading) {
                      setMultiplier(Number(e.target.value));
                      setResult(null);
                      setMeterValue(0);
                    }
                  }}
                  disabled={upgrading}
                  className="flex-1 accent-orange-500 h-2 cursor-pointer disabled:cursor-not-allowed"
                />
                <span className="text-[10px] text-gray-500 font-bold w-8 text-right">
                  50×
                </span>
              </div>

              {/* Current multiplier display */}
              <div className="flex items-center gap-4 text-center">
                <div>
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider">
                    Multiplier
                  </p>
                  <p className="text-xl font-black text-white">{multiplier}×</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider">
                    Chance
                  </p>
                  <p
                    className="text-xl font-black"
                    style={{ color: chanceColor }}
                  >
                    {successChance.toFixed(1)}%
                  </p>
                </div>
                {selectedItem && (
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">
                      Target Value
                    </p>
                    <p className="text-xl font-black text-yellow-400 tabular-nums">
                      ${targetValue.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Upgrade Button */}
            <button
              onClick={handleUpgrade}
              disabled={upgrading || !selectedItem}
              className="w-full max-w-md py-4 rounded-xl font-black text-lg uppercase tracking-wider transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background:
                  selectedItem && !upgrading
                    ? `linear-gradient(135deg, ${chanceColor}80, ${chanceColor}40)`
                    : "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))",
                color: "white",
                border: `2px solid ${selectedItem && !upgrading ? chanceColor + "60" : "rgba(255,255,255,0.1)"}`,
              }}
            >
              {upgrading
                ? "Upgrading..."
                : !selectedItem
                  ? "Select a skin"
                  : `UPGRADE — ${multiplier}× for $${targetValue.toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

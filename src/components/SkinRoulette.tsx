import { useState, useCallback, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import type { InventoryItem, RouletteColor } from "../types";
import {
  SKIN_ROULETTE_SEGMENTS,
  SKIN_ROULETTE_PAYOUTS,
  SKIN_ROULETTE_COLORS,
  RARITY_COLORS,
} from "../constants";
import { spinSkinRoulette } from "../engine";
import { playTick } from "../audio";

interface SkinRouletteProps {
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

const SEGMENT_COUNT = SKIN_ROULETTE_SEGMENTS.length;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;

export function SkinRoulette({
  isOpen,
  onClose,
  inventory,
  onRemoveItems,
  onAddBalance,
  onAddXp,
}: SkinRouletteProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [betColor, setBetColor] = useState<RouletteColor | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{
    won: boolean;
    payout: number;
    color: RouletteColor;
  } | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [history, setHistory] = useState<RouletteColor[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("price-high");

  // Reset state when opening/closing
  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set());
      setBetColor(null);
      setSpinning(false);
      setResult(null);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !spinning) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, spinning, onClose]);

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

  const totalBetValue = useMemo(() => {
    let sum = 0;
    for (const item of inventory) {
      if (selectedIds.has(item.id)) sum += item.sellPrice;
    }
    return Math.round(sum * 100) / 100;
  }, [inventory, selectedIds]);

  const toggleSkin = useCallback(
    (id: string) => {
      if (spinning) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setResult(null);
    },
    [spinning],
  );

  const selectAll = useCallback(() => {
    if (spinning) return;
    setSelectedIds(new Set(inventory.map((i) => i.id)));
    setResult(null);
  }, [inventory, spinning]);

  const clearSelection = useCallback(() => {
    if (spinning) return;
    setSelectedIds(new Set());
    setResult(null);
  }, [spinning]);

  const handleSpin = useCallback(() => {
    if (spinning || selectedIds.size === 0 || !betColor) return;

    setResult(null);
    setSpinning(true);

    const spinResult = spinSkinRoulette();
    const winningColor = spinResult.winningSegment.color;
    const won = winningColor === betColor;
    const payout = won
      ? Math.round(totalBetValue * SKIN_ROULETTE_PAYOUTS[betColor] * 100) / 100
      : 0;

    // Calculate rotation: land on winning segment
    // The wheel uses `rotate: -wheelRotation` (counter-clockwise), so the fixed
    // pointer sweeps clockwise across segments.  For the pointer to land inside
    // segment `i` we need: wheelRotation % 360 ∈ [i*SEG_ANGLE, (i+1)*SEG_ANGLE)
    const baseRotations = 5 + Math.floor(Math.random() * 3); // 5-7 full spins
    const finalAngle =
      spinResult.winningIndex * SEGMENT_ANGLE +
      SEGMENT_ANGLE * 0.1 +
      Math.random() * SEGMENT_ANGLE * 0.8; // land within the segment
    // Minimum rotation = current position + enough full spins
    const minRotation = wheelRotation + baseRotations * 360;
    // Advance from minRotation to the nearest angle that equals finalAngle (mod 360)
    const targetRotation =
      minRotation + ((finalAngle - (minRotation % 360) + 360) % 360);

    setWheelRotation(targetRotation);

    // Tick sounds during spin
    let tickCount = 0;
    const tickInterval = setInterval(() => {
      tickCount++;
      if (tickCount < 40) {
        playTick(0.8 + Math.random() * 0.4);
      } else {
        clearInterval(tickInterval);
      }
    }, 100);

    // Result after animation
    setTimeout(() => {
      clearInterval(tickInterval);
      setSpinning(false);
      setResult({ won, payout, color: winningColor });
      setHistory((prev) => [winningColor, ...prev].slice(0, 20));

      // XP based on bet value
      const xpGain = Math.min(
        500,
        Math.max(10, Math.floor(totalBetValue * 10)),
      );
      onAddXp(xpGain);

      if (won) {
        onAddBalance(payout);
      } else {
        onRemoveItems(Array.from(selectedIds));
        setSelectedIds(new Set());
      }
    }, 5000);
  }, [
    spinning,
    selectedIds,
    betColor,
    totalBetValue,
    wheelRotation,
    onAddBalance,
    onAddXp,
    onRemoveItems,
  ]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Skin Roulette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={spinning ? undefined : onClose}
      />

      {/* Main Panel */}
      <div className="relative z-10 w-full max-w-6xl max-h-[90vh] flex flex-col bg-[#0d0d0d] border border-white/10 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-white uppercase tracking-wider">
              Skin Roulette
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-green-500/20 text-green-400 border border-green-500/30">
              Red/Black/Green
            </span>
          </div>
          {!spinning && (
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
          <div className="lg:w-[340px] border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">
                  Select Skins to Bet
                </span>
                <span className="text-xs text-gray-500">
                  {selectedIds.size} selected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <button
                    onClick={selectAll}
                    disabled={spinning}
                    className="px-2 py-1 text-[9px] uppercase tracking-wider rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer disabled:opacity-30 font-bold border border-white/5"
                  >
                    All
                  </button>
                  <button
                    onClick={clearSelection}
                    disabled={spinning}
                    className="px-2 py-1 text-[9px] uppercase tracking-wider rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer disabled:opacity-30 font-bold border border-white/5"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex gap-1">
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
            </div>

            {/* Scrollable skin list */}
            <div className="flex-1 overflow-y-auto p-3 max-h-[240px] lg:max-h-[unset]">
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
                    const selected = selectedIds.has(item.id);
                    const rarityColor =
                      RARITY_COLORS[item.skin.rarity.name] ?? "#666";
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleSkin(item.id)}
                        disabled={spinning}
                        className={`relative flex flex-col items-center p-2 rounded-lg border transition-all cursor-pointer disabled:cursor-not-allowed ${
                          selected
                            ? "border-yellow-400/60 bg-yellow-400/10 scale-[1.02]"
                            : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/5"
                        }`}
                      >
                        {selected && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center text-[8px] text-black font-black">
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

            {/* Bet total */}
            <div className="px-4 py-3 border-t border-white/5 bg-white/[0.02] shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">
                  Total Bet
                </span>
                <span className="text-lg text-green-400 font-black tabular-nums">
                  ${totalBetValue.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Center/Right: Wheel + Controls */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 overflow-y-auto">
            {/* History */}
            {history.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-gray-500 uppercase tracking-wider mr-2 font-bold">
                  Last
                </span>
                {history.map((color, i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded-full border border-white/10"
                    style={{
                      backgroundColor: SKIN_ROULETTE_COLORS[color],
                      opacity: 1 - i * 0.04,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Wheel */}
            <div className="relative">
              {/* Pointer */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-yellow-400 drop-shadow-lg" />

              {/* Wheel container */}
              <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl">
                {/* SVG wheel */}
                <motion.svg
                  viewBox="0 0 100 100"
                  className="absolute inset-0 w-full h-full"
                  animate={{ rotate: -wheelRotation }}
                  transition={
                    spinning
                      ? { duration: 5, ease: [0.15, 0.85, 0.25, 1] }
                      : { duration: 0 }
                  }
                >
                  {SKIN_ROULETTE_SEGMENTS.map((seg, i) => {
                    const startAngle = i * SEGMENT_ANGLE;
                    const endAngle = (i + 1) * SEGMENT_ANGLE;
                    const r = 50;
                    const x1 =
                      50 + r * Math.cos((startAngle - 90) * (Math.PI / 180));
                    const y1 =
                      50 + r * Math.sin((startAngle - 90) * (Math.PI / 180));
                    const x2 =
                      50 + r * Math.cos((endAngle - 90) * (Math.PI / 180));
                    const y2 =
                      50 + r * Math.sin((endAngle - 90) * (Math.PI / 180));
                    const labelR = r * 0.65;
                    const lx =
                      50 +
                      labelR *
                        Math.cos(
                          ((startAngle + endAngle) / 2 - 90) * (Math.PI / 180),
                        );
                    const ly =
                      50 +
                      labelR *
                        Math.sin(
                          ((startAngle + endAngle) / 2 - 90) * (Math.PI / 180),
                        );

                    return (
                      <g key={i}>
                        <path
                          d={`M 50 50 L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`}
                          fill={SKIN_ROULETTE_COLORS[seg.color]}
                          stroke="rgba(0,0,0,0.3)"
                          strokeWidth="0.3"
                        />
                        <text
                          x={lx}
                          y={ly}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="white"
                          fontSize="4"
                          fontWeight="bold"
                        >
                          {seg.number}
                        </text>
                      </g>
                    );
                  })}
                </motion.svg>

                {/* Center circle */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-[#1a1a1a] border-2 border-white/20 flex items-center justify-center shadow-xl">
                    {result ? (
                      <span
                        className="text-xs font-black uppercase"
                        style={{ color: SKIN_ROULETTE_COLORS[result.color] }}
                      >
                        {result.color}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500 font-bold">
                        SPIN
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Result Banner */}
            {result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`px-6 py-3 rounded-xl border text-center ${
                  result.won
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-red-500/10 border-red-500/30"
                }`}
              >
                {result.won ? (
                  <div>
                    <p className="text-green-400 font-black text-lg">
                      YOU WON!
                    </p>
                    <p className="text-green-300 text-sm">
                      +${result.payout.toFixed(2)} added to balance
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-red-400 font-black text-lg">YOU LOST</p>
                    <p className="text-red-300 text-sm">
                      Skins removed from inventory
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Bet Color Buttons */}
            <div className="flex flex-col items-center gap-3 w-full max-w-md">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                Pick a color
              </span>
              <div className="flex gap-3 w-full">
                {(["red", "black", "green"] as const).map((color) => {
                  const payout = SKIN_ROULETTE_PAYOUTS[color];
                  const potential =
                    Math.round(totalBetValue * payout * 100) / 100;
                  const isSelected = betColor === color;
                  const count = SKIN_ROULETTE_SEGMENTS.filter(
                    (s) => s.color === color,
                  ).length;

                  return (
                    <button
                      key={color}
                      onClick={() => {
                        if (!spinning) {
                          setBetColor(color);
                          setResult(null);
                        }
                      }}
                      disabled={spinning}
                      className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-all cursor-pointer disabled:cursor-not-allowed ${
                        isSelected
                          ? "scale-105 shadow-lg"
                          : "opacity-60 hover:opacity-90"
                      }`}
                      style={{
                        backgroundColor: SKIN_ROULETTE_COLORS[color] + "20",
                        borderColor: isSelected
                          ? SKIN_ROULETTE_COLORS[color]
                          : SKIN_ROULETTE_COLORS[color] + "40",
                        boxShadow: isSelected
                          ? `0 0 20px ${SKIN_ROULETTE_COLORS[color]}30`
                          : undefined,
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-full border-2 border-white/20"
                        style={{
                          backgroundColor: SKIN_ROULETTE_COLORS[color],
                        }}
                      />
                      <span className="text-white text-xs font-black uppercase">
                        {color}
                      </span>
                      <span className="text-gray-400 text-[9px]">
                        {count}/{SEGMENT_COUNT} · {payout}×
                      </span>
                      {totalBetValue > 0 && (
                        <span className="text-green-400 text-[10px] font-bold">
                          Win ${potential.toFixed(2)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Spin Button */}
            <button
              onClick={handleSpin}
              disabled={spinning || selectedIds.size === 0 || !betColor}
              className="w-full max-w-md py-4 rounded-xl font-black text-lg uppercase tracking-wider transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background:
                  betColor && !spinning
                    ? `linear-gradient(135deg, ${SKIN_ROULETTE_COLORS[betColor]}80, ${SKIN_ROULETTE_COLORS[betColor]}40)`
                    : "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))",
                color: "white",
                border: `2px solid ${betColor && !spinning ? SKIN_ROULETTE_COLORS[betColor] + "60" : "rgba(255,255,255,0.1)"}`,
              }}
            >
              {spinning
                ? "Spinning..."
                : selectedIds.size === 0
                  ? "Select skins to bet"
                  : !betColor
                    ? "Pick a color"
                    : `SPIN — Risk $${totalBetValue.toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

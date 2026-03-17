import { useRef, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import type { InventoryItem, Skin, CaseDefinition } from "../types";
import { RARITY_COLORS, WINNER_INDEX } from "../constants";
import { computeSkinPrice, generateRouletteStrip } from "../engine";
import { playTick, playWinSound } from "../audio";

const BOT_NAMES = ["Bot_Alpha", "Bot_Bravo", "Bot_Charlie"];

const ITEM_WIDTH = 160;
const ITEM_GAP = 8;
const ITEM_TOTAL = ITEM_WIDTH + ITEM_GAP;

interface CaseBattleProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCase: CaseDefinition;
  skins: Skin[];
  onBattleComplete: (wonSkins: Skin[], totalValue: number) => void;
  balance: number;
  wonItems?: InventoryItem[];
  onSellItem?: (itemId: string) => void;
  onSpend?: (amount: number) => void;
}

function BattleStrip({
  strip,
  label,
  labelColor,
  isPlayer,
  onComplete,
  index,
}: {
  strip: Skin[];
  label: string;
  labelColor: string;
  isPlayer: boolean;
  onComplete: (winner: Skin, index: number) => void;
  index: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const lastTickIndex = useRef(-1);
  const rafId = useRef(0);

  useEffect(() => {
    // Small delay to let DOM render
    const timer = setTimeout(() => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const winnerCenter = WINNER_INDEX * ITEM_TOTAL + ITEM_WIDTH / 2;
        const jitter = (Math.random() - 0.5) * (ITEM_WIDTH * 0.6);
        setOffset(-(winnerCenter - containerWidth / 2 + jitter));
        setStarted(true);
        lastTickIndex.current = -1;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Tick tracking for player strip only
  useEffect(() => {
    if (!started || !isPlayer) return;
    const trackTicks = () => {
      if (stripRef.current && containerRef.current) {
        const stripX = new DOMMatrix(
          getComputedStyle(stripRef.current).transform,
        ).m41;
        const containerCenter = containerRef.current.offsetWidth / 2;
        const currentIndex = Math.floor(
          (containerCenter - stripX - 16) / ITEM_TOTAL,
        );
        if (currentIndex > lastTickIndex.current && currentIndex >= 0) {
          lastTickIndex.current = currentIndex;
          const progress = currentIndex / (WINNER_INDEX + 2);
          playTick(0.8 + progress * 0.5);
        }
      }
      rafId.current = requestAnimationFrame(trackTicks);
    };
    rafId.current = requestAnimationFrame(trackTicks);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [started, isPlayer]);

  const handleComplete = useCallback(() => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    if (!done && started) {
      setDone(true);
      onComplete(strip[WINNER_INDEX], index);
    }
  }, [done, started, strip, index, onComplete]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: labelColor }}
        >
          {label}
        </span>
        {done && (
          <span className="text-xs text-gray-400">
            — {strip[WINNER_INDEX].name}
          </span>
        )}
      </div>
      <div className="relative bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-yellow-400 z-20" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
          <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-yellow-400" />
        </div>
        <div ref={containerRef} className="relative h-28 overflow-hidden">
          <motion.div
            ref={stripRef}
            className="absolute top-0 left-0 flex items-center h-full gap-2 px-4"
            initial={{ x: 0 }}
            animate={{ x: started ? offset : 0 }}
            transition={
              started
                ? { duration: 5, ease: [0.15, 0.85, 0.25, 1] }
                : { duration: 0 }
            }
            onAnimationComplete={handleComplete}
          >
            {strip.map((skin, i) => {
              const isWinner = done && i === WINNER_INDEX;
              const rarityColor = RARITY_COLORS[skin.rarity.name] ?? "#666";
              return (
                <div
                  key={`${skin.id}-${i}`}
                  className={`flex-shrink-0 flex flex-col items-center justify-center rounded-lg p-1.5 transition-all duration-300
                    ${isWinner ? "ring-2 ring-yellow-400 scale-105 bg-white/10" : "bg-white/5"}`}
                  style={{
                    width: ITEM_WIDTH,
                    borderBottom: `3px solid ${rarityColor}`,
                  }}
                >
                  <img
                    src={skin.image}
                    alt={skin.name}
                    className="w-14 h-10 object-contain mb-0.5"
                    loading="lazy"
                  />
                  <span
                    className="text-[10px] font-medium text-center truncate w-full"
                    style={{ color: rarityColor }}
                  >
                    {skin.name.length > 18
                      ? skin.name.slice(0, 15) + "..."
                      : skin.name}
                  </span>
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export function CaseBattle({
  isOpen,
  onClose,
  selectedCase,
  skins,
  onBattleComplete,
  balance,
  wonItems,
  onSellItem,
  onSpend,
}: CaseBattleProps) {
  const [botCount, setBotCount] = useState(1);
  const [battleStarted, setBattleStarted] = useState(false);
  const [allStrips, setAllStrips] = useState<Skin[][]>([]);
  const [results, setResults] = useState<(Skin | null)[]>([]);
  const [allDone, setAllDone] = useState(false);
  const [winnerIdx, setWinnerIdx] = useState(-1);
  const [soldIds, setSoldIds] = useState<Set<string>>(new Set());
  const completedRef = useRef(0);

  const totalParticipants = botCount + 1;
  const playerCost = selectedCase.price;
  const canAfford = balance >= playerCost;

  const participantLabels = ["YOU", ...BOT_NAMES.slice(0, botCount)];
  const participantColors = ["#4ade80", "#ef4444", "#f59e0b", "#8b5cf6"];

  const startBattle = useCallback(() => {
    if (!canAfford && selectedCase.price > 0) return;

    if (selectedCase.price > 0 && onSpend) {
      onSpend(playerCost);
    }

    const isFree = selectedCase.price === 0;
    const strips: Skin[][] = [];
    for (let i = 0; i < totalParticipants; i++) {
      const result = generateRouletteStrip(
        skins,
        isFree,
        selectedCase.rarityFilter,
      );
      strips.push(result.strip);
    }
    setAllStrips(strips);
    setResults(new Array(totalParticipants).fill(null));
    setAllDone(false);
    setWinnerIdx(-1);
    completedRef.current = 0;
    setBattleStarted(true);
  }, [canAfford, selectedCase, skins, totalParticipants, onSpend, playerCost]);

  const handleStripComplete = useCallback(
    (winner: Skin, index: number) => {
      setResults((prev) => {
        const next = [...prev];
        next[index] = winner;
        return next;
      });
      completedRef.current += 1;

      if (completedRef.current >= allStrips.length) {
        // Determine winner by skin value (deterministic, matches displayed prices)
        const values = allStrips.map((s) =>
          computeSkinPrice(s[WINNER_INDEX], WINNER_INDEX),
        );
        let bestIdx = 0;
        for (let i = 1; i < values.length; i++) {
          if (values[i] > values[bestIdx]) bestIdx = i;
        }
        setWinnerIdx(bestIdx);
        setAllDone(true);
        playWinSound();

        if (bestIdx === 0) {
          // Player wins — collect ALL skins
          const wonSkins = allStrips.map((s) => s[WINNER_INDEX]);
          const totalValue = values.reduce((a, b) => a + b, 0);
          onBattleComplete(wonSkins, Math.round(totalValue * 100) / 100);
        } else {
          // Bot wins — player gets nothing
          onBattleComplete([], 0);
        }
      }
    },
    [allStrips, onBattleComplete],
  );

  const handleClose = useCallback(() => {
    setBattleStarted(false);
    setAllStrips([]);
    setResults([]);
    setAllDone(false);
    setWinnerIdx(-1);
    setSoldIds(new Set());
    completedRef.current = 0;
    setBotCount(1);
    onClose();
  }, [onClose]);

  // Close on Escape when not mid-battle
  useEffect(() => {
    if (!isOpen) return;
    const canClose = !battleStarted || allDone;
    if (!canClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, battleStarted, allDone, handleClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-lg"
      role="dialog"
      aria-modal="true"
      aria-label="Case Battle"
    >
      <div className="relative w-full max-w-5xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={handleClose}
          disabled={battleStarted && !allDone}
          className={`absolute -top-2 -right-2 z-30 w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-all cursor-pointer
            ${!battleStarted || allDone ? "bg-white/10 hover:bg-white/20 text-white" : "bg-white/5 text-gray-600 cursor-not-allowed"}`}
        >
          ×
        </button>

        {!battleStarted ? (
          /* Setup screen */
          <div className="flex flex-col items-center py-8">
            <h2 className="text-2xl font-black text-white uppercase tracking-wider mb-6">
              ⚔️ Case Battle
            </h2>

            <img
              src={selectedCase.image}
              alt={selectedCase.name}
              className="w-24 h-24 object-contain mb-2"
            />
            <p className="text-white font-semibold mb-6">{selectedCase.name}</p>

            {/* Bot count selector */}
            <div className="flex flex-col items-center gap-3 mb-6">
              <span className="text-xs text-gray-400 uppercase tracking-wider">
                Opponents
              </span>
              <div className="flex gap-2">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => setBotCount(n)}
                    className={`px-4 py-2 rounded-lg font-bold text-sm border transition-colors cursor-pointer
                      ${
                        botCount === n
                          ? "bg-yellow-400/20 border-yellow-400 text-yellow-400"
                          : "bg-white/5 border-white/10 text-gray-400 hover:border-white/30"
                      }`}
                  >
                    1 vs {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Participants preview */}
            <div className="flex gap-4 mb-6">
              {participantLabels.map((label, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold mb-1"
                    style={{
                      backgroundColor: participantColors[i] + "22",
                      color: participantColors[i],
                    }}
                  >
                    {label === "YOU" ? "👤" : "🤖"}
                  </div>
                  <span
                    className="text-xs font-bold"
                    style={{ color: participantColors[i] }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Cost */}
            <div className="text-center mb-6">
              <span className="text-xs text-gray-400 uppercase">Your Cost</span>
              <p
                className={`text-2xl font-bold ${canAfford || selectedCase.price === 0 ? "text-green-400" : "text-red-400"}`}
              >
                {selectedCase.price === 0
                  ? "FREE"
                  : `$${playerCost.toFixed(2)}`}
              </p>
              {selectedCase.price > 0 && (
                <span className="text-xs text-gray-500">
                  Bots pay for their own cases
                </span>
              )}
            </div>

            <button
              onClick={startBattle}
              disabled={!canAfford && selectedCase.price > 0}
              className={`px-8 py-3 rounded-lg font-bold uppercase tracking-wider transition-all cursor-pointer
                ${
                  canAfford || selectedCase.price === 0
                    ? "bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/30"
                    : "bg-gray-600 text-gray-400 cursor-not-allowed"
                }`}
            >
              Start Battle
            </button>
          </div>
        ) : (
          /* Battle in progress */
          <div className="py-4">
            <h2 className="text-xl font-black text-white text-center uppercase tracking-wider mb-4">
              ⚔️ Case Battle — {selectedCase.name}
            </h2>

            <div className="flex flex-col gap-3">
              {allStrips.map((strip, i) => (
                <BattleStrip
                  key={i}
                  strip={strip}
                  label={participantLabels[i]}
                  labelColor={participantColors[i]}
                  isPlayer={i === 0}
                  onComplete={handleStripComplete}
                  index={i}
                />
              ))}
            </div>

            {/* Battle result */}
            {allDone && (
              <div className="mt-6 text-center">
                <p
                  className="text-3xl font-black uppercase tracking-wider mb-3"
                  style={{ color: winnerIdx === 0 ? "#4ade80" : "#ef4444" }}
                >
                  {winnerIdx === 0
                    ? "🏆 YOU WIN!"
                    : `💀 ${participantLabels[winnerIdx]} WINS`}
                </p>

                {/* Show all results */}
                <div className="flex flex-wrap justify-center gap-3 mb-4">
                  {results.map((skin, i) => {
                    if (!skin) return null;
                    const item = winnerIdx === 0 ? wonItems?.[i] : undefined;
                    const isSold = item ? soldIds.has(item.id) : false;
                    return (
                      <div
                        key={i}
                        className={`flex flex-col items-center p-3 rounded-xl border-2 transition-opacity ${isSold ? "opacity-40" : ""} ${i === winnerIdx ? "bg-yellow-400/10" : "bg-white/5"}`}
                        style={{
                          borderColor:
                            i === winnerIdx
                              ? "#facc15"
                              : (RARITY_COLORS[skin.rarity.name] ?? "#666"),
                        }}
                      >
                        <span
                          className="text-xs font-bold mb-1"
                          style={{ color: participantColors[i] }}
                        >
                          {participantLabels[i]}
                        </span>
                        <img
                          src={skin.image}
                          alt={skin.name}
                          className="w-16 h-12 object-contain mb-1"
                        />
                        <span
                          className="text-xs font-bold"
                          style={{
                            color: RARITY_COLORS[skin.rarity.name] ?? "#fff",
                          }}
                        >
                          {skin.name.length > 20
                            ? skin.name.slice(0, 17) + "..."
                            : skin.name}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {skin.rarity.name}
                        </span>
                        {item && (
                          <span className="text-[10px] text-gray-400">
                            {item.isStatTrak && (
                              <span className="text-orange-400">ST™ </span>
                            )}
                            {item.wear}
                          </span>
                        )}
                        {item && !isSold && onSellItem && (
                          <button
                            onClick={() => {
                              onSellItem(item.id);
                              setSoldIds((prev) => new Set(prev).add(item.id));
                            }}
                            className="mt-2 px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400 text-xs font-bold rounded-lg transition-colors cursor-pointer border border-yellow-500/30"
                          >
                            Sell ${item.sellPrice.toFixed(2)}
                          </button>
                        )}
                        {isSold && (
                          <span className="mt-2 text-xs text-gray-500 italic">
                            Sold
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg uppercase text-sm tracking-wider transition-colors cursor-pointer"
                >
                  {winnerIdx === 0 ? "Collect & Close" : "Close"}
                </button>

                {/* Quick sell buttons for player wins */}
                {winnerIdx === 0 &&
                  wonItems &&
                  onSellItem &&
                  wonItems.length > 0 &&
                  (() => {
                    const unsold = wonItems.filter((it) => !soldIds.has(it.id));
                    if (unsold.length === 0) return null;
                    const totalSellValue = unsold.reduce(
                      (sum, it) => sum + it.sellPrice,
                      0,
                    );
                    return (
                      <button
                        onClick={() => {
                          for (const it of unsold) {
                            onSellItem(it.id);
                          }
                          handleClose();
                        }}
                        className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg uppercase text-sm tracking-wider transition-colors cursor-pointer"
                      >
                        Sell All ${totalSellValue.toFixed(2)}
                      </button>
                    );
                  })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

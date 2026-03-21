import { useRef, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import type { InventoryItem, Skin } from "../types";
import { RARITY_COLORS, WINNER_INDEX } from "../constants";
import { playTick, playWinSound } from "../audio";

interface OpeningModalProps {
  isOpen: boolean;
  onClose: () => void;
  strips: Skin[][];
  onAllSpinsComplete: (winners: Skin[]) => void;
  caseName: string;
  caseImage: string;
  wonItems?: InventoryItem[];
  onSellItem?: (itemId: string) => void;
}

const ITEM_WIDTH = 160;
const ITEM_GAP = 8;
const ITEM_TOTAL = ITEM_WIDTH + ITEM_GAP;

function SingleStrip({
  strip,
  index,
  total,
  onComplete,
  isTickTracker,
}: {
  strip: Skin[];
  index: number;
  total: number;
  onComplete: (winner: Skin, index: number) => void;
  isTickTracker: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const lastTickIndex = useRef(-1);
  const rafId = useRef(0);

  const height = total === 1 ? "h-48" : "h-32";

  useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const winnerCenter = WINNER_INDEX * ITEM_TOTAL + ITEM_WIDTH / 2;
      const jitter = (Math.random() - 0.5) * (ITEM_WIDTH * 0.6);
      setOffset(-(winnerCenter - containerWidth / 2 + jitter));
      setStarted(true);
      lastTickIndex.current = -1;
    }
  }, []);

  // Tick tracking for first strip only
  useEffect(() => {
    if (!started || !isTickTracker) return;

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
  }, [started, isTickTracker]);

  const handleComplete = useCallback(() => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    if (!done && started) {
      setDone(true);
      onComplete(strip[WINNER_INDEX], index);
    }
  }, [done, started, strip, index, onComplete]);

  return (
    <div className="relative bg-white/5 rounded-xl border border-white/10 overflow-hidden">
      {/* Center marker */}
      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-yellow-400 z-20" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-yellow-400" />
      </div>

      <div ref={containerRef} className={`relative ${height} overflow-hidden`}>
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
            const itemSize = total === 1 ? "w-24 h-18" : "w-16 h-12";

            return (
              <div
                key={`${skin.id}-${i}`}
                className={`
                  flex-shrink-0 flex flex-col items-center justify-center rounded-lg p-2 transition-all duration-300
                  ${isWinner ? "ring-2 ring-yellow-400 scale-105 bg-white/10" : "bg-white/5"}
                `}
                style={{
                  width: ITEM_WIDTH,
                  borderBottom: `3px solid ${rarityColor}`,
                }}
              >
                <img
                  src={skin.image}
                  alt={skin.name}
                  className={`${itemSize} object-contain mb-1`}
                  loading="lazy"
                />
                <span
                  className="text-xs font-medium text-center truncate w-full"
                  style={{ color: rarityColor }}
                >
                  {skin.name.length > 20
                    ? skin.name.slice(0, 17) + "..."
                    : skin.name}
                </span>
              </div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}

export function OpeningModal({
  isOpen,
  onClose,
  strips,
  onAllSpinsComplete,
  caseName,
  caseImage,
  wonItems,
  onSellItem,
}: OpeningModalProps) {
  const [winners, setWinners] = useState<(Skin | null)[]>([]);
  const [allDone, setAllDone] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [soldIds, setSoldIds] = useState<Set<string>>(new Set());
  const completedRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      setWinners(new Array(strips.length).fill(null));
      setAllDone(false);
      setShowResults(false);
      setSoldIds(new Set());
      completedRef.current = 0;
    }
  }, [isOpen, strips.length]);

  // Delay showing results after all spins finish
  useEffect(() => {
    if (!allDone) return;
    const timer = setTimeout(() => setShowResults(true), 1200);
    return () => clearTimeout(timer);
  }, [allDone]);

  // Close on Escape when results are shown
  useEffect(() => {
    if (!isOpen || !showResults) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, showResults, onClose]);

  const handleStripComplete = useCallback(
    (winner: Skin, index: number) => {
      setWinners((prev) => {
        const next = [...prev];
        next[index] = winner;
        return next;
      });
      completedRef.current += 1;
      if (completedRef.current >= strips.length) {
        setAllDone(true);
        playWinSound();
        // Collect all winners
        const allWinners = strips.map((s) => s[WINNER_INDEX]);
        onAllSpinsComplete(allWinners);
      }
    },
    [strips, onAllSpinsComplete],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-lg"
      role="dialog"
      aria-modal="true"
      aria-label={`Opening ${caseName}`}
    >
      <div className="relative w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={!showResults}
          className={`
            absolute -top-2 -right-2 z-30 w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-all cursor-pointer
            ${
              showResults
                ? "bg-white/10 hover:bg-white/20 text-white"
                : "bg-white/5 text-gray-600 cursor-not-allowed"
            }
          `}
        >
          ×
        </button>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-center gap-3 mb-4">
          <img
            src={caseImage}
            alt={caseName}
            className="w-12 h-12 object-contain"
          />
          <h2 className="text-xl font-bold text-white uppercase tracking-wider">
            {caseName}
            {strips.length > 1 && (
              <span className="text-yellow-400 ml-2">×{strips.length}</span>
            )}
          </h2>
        </div>

        {/* Scrollable middle area */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Strips */}
          <div className="flex flex-col gap-3">
            {strips.map((strip, i) => (
              <SingleStrip
                key={i}
                strip={strip}
                index={i}
                total={strips.length}
                onComplete={handleStripComplete}
                isTickTracker={i === 0}
              />
            ))}
          </div>

          {/* Winners display */}
          {showResults && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {winners.map((w, i) => {
                if (!w) return null;
                const item = wonItems?.[i];
                const isSold = item ? soldIds.has(item.id) : false;
                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center p-3 rounded-xl border-2 transition-opacity ${isSold ? "opacity-40" : "bg-white/5"}`}
                    style={{
                      borderColor: RARITY_COLORS[w.rarity.name] ?? "#666",
                    }}
                  >
                    <img
                      src={w.image}
                      alt={w.name}
                      className="w-20 h-14 object-contain mb-1"
                    />
                    <span
                      className="text-xs font-bold text-center max-w-[120px] truncate"
                      style={{ color: RARITY_COLORS[w.rarity.name] ?? "#fff" }}
                    >
                      {w.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {w.rarity.name}
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
          )}
        </div>
        {/* end scrollable middle area */}

        {/* Sell All + Close – pinned at bottom */}
        {showResults && (
          <div className="flex-shrink-0 text-center pt-4 pb-2 flex flex-wrap items-center justify-center gap-3">
            {wonItems &&
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
                      onClose();
                    }}
                    className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg uppercase text-sm tracking-wider transition-colors cursor-pointer"
                  >
                    Sell All ${totalSellValue.toFixed(2)}
                  </button>
                );
              })()}
            <button
              onClick={onClose}
              className="px-6 py-2 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg uppercase text-sm tracking-wider transition-colors cursor-pointer"
            >
              Collect & Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

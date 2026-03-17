import { useRef, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import type { Skin } from "../types";
import { RARITY_COLORS, WINNER_INDEX } from "../constants";
import { playTick, playWinSound } from "../audio";

interface RouletteProps {
  strip: Skin[];
  onSpinComplete: (winner: Skin) => void;
  spinning: boolean;
  onStartSpin: () => void;
  canSpin: boolean;
  selectedCaseName: string;
  selectedCasePrice: number;
}

const ITEM_WIDTH = 160;
const ITEM_GAP = 8;
const ITEM_TOTAL = ITEM_WIDTH + ITEM_GAP;

export function Roulette({
  strip,
  onSpinComplete,
  spinning,
  onStartSpin,
  canSpin,
  selectedCaseName,
  selectedCasePrice,
}: RouletteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [winner, setWinner] = useState<Skin | null>(null);
  const lastTickIndex = useRef(-1);
  const rafId = useRef(0);

  const calculateOffset = useCallback(() => {
    if (!containerRef.current) return 0;
    const containerWidth = containerRef.current.offsetWidth;
    // Center the winner item in the container
    const winnerCenter = WINNER_INDEX * ITEM_TOTAL + ITEM_WIDTH / 2;
    // Add some random sub-pixel offset for realism
    const jitter = (Math.random() - 0.5) * (ITEM_WIDTH * 0.6);
    return -(winnerCenter - containerWidth / 2 + jitter);
  }, []);

  useEffect(() => {
    if (spinning && strip.length > 0) {
      setShowResult(false);
      setWinner(null);
      const newOffset = calculateOffset();
      setOffset(newOffset);
      lastTickIndex.current = -1;

      // Start tracking item positions for tick sounds
      const trackTicks = () => {
        if (stripRef.current && containerRef.current) {
          const stripX = new DOMMatrix(
            getComputedStyle(stripRef.current).transform,
          ).m41;
          const containerCenter = containerRef.current.offsetWidth / 2;
          // Which item index is currently at the center?
          const currentIndex = Math.floor(
            (containerCenter - stripX - 16) / ITEM_TOTAL,
          ); // 16 = px-4 padding
          if (currentIndex > lastTickIndex.current && currentIndex >= 0) {
            lastTickIndex.current = currentIndex;
            // Pitch slightly higher as we slow down near the end
            const progress = currentIndex / (WINNER_INDEX + 2);
            playTick(0.8 + progress * 0.5);
          }
        }
        rafId.current = requestAnimationFrame(trackTicks);
      };
      rafId.current = requestAnimationFrame(trackTicks);
    }

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [spinning, strip, calculateOffset]);

  const handleAnimationComplete = useCallback(() => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    if (spinning && strip.length > 0) {
      const w = strip[WINNER_INDEX];
      setWinner(w);
      setShowResult(true);
      playWinSound();
      onSpinComplete(w);
    }
  }, [spinning, strip, onSpinComplete]);

  return (
    <div className="w-full mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-white uppercase tracking-wider">
          {selectedCaseName}
        </h2>
        <button
          onClick={onStartSpin}
          disabled={!canSpin || spinning}
          className={`
            px-6 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer
            ${
              canSpin && !spinning
                ? "bg-green-500 hover:bg-green-400 text-black shadow-lg shadow-green-500/30"
                : "bg-gray-600 text-gray-400 cursor-not-allowed"
            }
          `}
        >
          {spinning
            ? "Opening..."
            : selectedCasePrice === 0
              ? "Open Free Case"
              : `Open ($${selectedCasePrice.toFixed(2)})`}
        </button>
      </div>

      {/* Roulette Container */}
      <div className="relative bg-white/5 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
        {/* Center marker */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-yellow-400 z-20" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
          <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-yellow-400" />
        </div>

        {/* Scrollable strip */}
        <div ref={containerRef} className="relative h-48 overflow-hidden">
          <motion.div
            ref={stripRef}
            className="absolute top-0 left-0 flex items-center h-full gap-2 px-4"
            initial={{ x: 0 }}
            animate={{ x: spinning ? offset : 0 }}
            transition={
              spinning
                ? {
                    duration: 5,
                    ease: [0.15, 0.85, 0.25, 1],
                  }
                : { duration: 0 }
            }
            onAnimationComplete={handleAnimationComplete}
          >
            {strip.map((skin, i) => {
              const isWinner = showResult && i === WINNER_INDEX;
              const rarityColor = RARITY_COLORS[skin.rarity.name] ?? "#666";

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
                    className="w-24 h-18 object-contain mb-1"
                    loading="lazy"
                  />
                  <span
                    className="text-xs font-medium text-center truncate w-full"
                    style={{ color: rarityColor }}
                  >
                    {skin.name.length > 25
                      ? skin.name.slice(0, 22) + "..."
                      : skin.name}
                  </span>
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* Winner display */}
      {showResult && winner && (
        <div className="mt-4 flex items-center justify-center">
          <div
            className="flex items-center gap-3 px-5 py-3 rounded-xl border-2 bg-white/5 backdrop-blur-sm"
            style={{
              borderColor: RARITY_COLORS[winner.rarity.name] ?? "#666",
            }}
          >
            <img
              src={winner.image}
              alt={winner.name}
              className="w-16 h-12 object-contain"
            />
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 uppercase">You won!</span>
              <span
                className="font-bold"
                style={{ color: RARITY_COLORS[winner.rarity.name] ?? "#fff" }}
              >
                {winner.name}
              </span>
              <span className="text-xs text-gray-500">
                {winner.rarity.name}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

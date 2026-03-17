import { useMemo, useState, useCallback, useEffect } from "react";
import type { CaseDefinition, Skin } from "../types";
import { RARITY_WEIGHTS, RARITY_COLORS } from "../constants";
import { getSkinsByRarity } from "../api";
import { computeSkinPrice } from "../engine";

interface CaseDetailModalProps {
  isOpen: boolean;
  selectedCase: CaseDefinition;
  skins: Skin[];
  balance: number;
  level: number;
  featuredSkin: Skin | null;
  onClose: () => void;
  onOpen: (count: number) => void;
  onBattle: () => void;
}

const RARITY_ORDER = [
  "Extraordinary",
  "Covert",
  "Classified",
  "Restricted",
  "Mil-Spec Grade",
];

const RARITY_LABELS: Record<string, string> = {
  "Mil-Spec Grade": "Mil-Spec (Blue)",
  Restricted: "Restricted (Purple)",
  Classified: "Classified (Pink)",
  Covert: "Covert (Red)",
  Extraordinary: "Extraordinary (Gold)",
};

function computeEffectiveOdds(
  c: CaseDefinition,
): { rarity: string; pct: number }[] {
  let weights: Record<string, number>;

  if (c.rarityWeights && Object.keys(c.rarityWeights).length > 0) {
    weights = c.rarityWeights;
  } else if (c.rarityFilter && c.rarityFilter.length > 0) {
    weights = {};
    for (const r of c.rarityFilter) {
      if (RARITY_WEIGHTS[r] != null) weights[r] = RARITY_WEIGHTS[r];
    }
    if (Object.keys(weights).length === 0) weights = RARITY_WEIGHTS;
  } else {
    weights = RARITY_WEIGHTS;
  }

  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  return RARITY_ORDER.filter((r) => weights[r] != null).map((r) => ({
    rarity: r,
    pct: (weights[r] / total) * 100,
  }));
}

export function CaseDetailModal({
  isOpen,
  selectedCase,
  skins,
  balance,
  level,
  featuredSkin,
  onClose,
  onOpen,
  onBattle,
}: CaseDetailModalProps) {
  const [openCount, setOpenCount] = useState(1);

  const odds = useMemo(
    () => computeEffectiveOdds(selectedCase),
    [selectedCase],
  );

  const skinsByRarity = useMemo(() => {
    const map = new Map<string, Skin[]>();
    for (const { rarity } of odds) {
      map.set(rarity, getSkinsByRarity(skins, rarity));
    }
    return map;
  }, [odds, skins]);

  // Filter out rarities with no skins and recalculate percentages
  const effectiveOdds = useMemo(() => {
    const available = odds.filter(
      ({ rarity }) => (skinsByRarity.get(rarity)?.length ?? 0) > 0,
    );
    const total = available.reduce((sum, { pct }) => sum + pct, 0);
    if (total === 0) return available;
    return available.map(({ rarity, pct }) => ({
      rarity,
      pct: (pct / total) * 100,
    }));
  }, [odds, skinsByRarity]);

  const meetsLevel =
    !selectedCase.levelRequired || level >= selectedCase.levelRequired;
  const totalCost = selectedCase.price * openCount;
  const canOpen =
    skins.length > 0 &&
    meetsLevel &&
    (selectedCase.price === 0 || balance >= totalCost);

  // Reset count when case changes
  useEffect(() => {
    setOpenCount(1);
  }, [selectedCase.id]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const handleOpen = useCallback(() => {
    if (!canOpen) return;
    onOpen(openCount);
  }, [canOpen, openCount, onOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-6 pb-6 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={selectedCase.name}
    >
      <div
        className="relative w-full max-w-4xl mx-4 rounded-2xl border border-white/10 overflow-hidden"
        style={{
          background: "linear-gradient(170deg, #141420 0%, #0a0a12 100%)",
        }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#141420]/95 backdrop-blur-md">
          <div className="flex items-center gap-4 p-5">
            <img
              src={featuredSkin?.image ?? selectedCase.image}
              alt={featuredSkin?.name ?? selectedCase.name}
              className="w-16 h-16 object-contain drop-shadow-lg"
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black text-white truncate">
                {selectedCase.name}
              </h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {selectedCase.description}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer text-lg flex-shrink-0"
            >
              ✕
            </button>
          </div>

          {/* Action bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 px-5 pb-4">
            {/* Quantity selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-[0.2em]">
                Qty
              </span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setOpenCount(n)}
                    className={`w-8 h-8 rounded-lg font-bold text-sm transition-all duration-200 cursor-pointer
                      ${
                        openCount === n
                          ? "bg-yellow-400/20 border border-yellow-400 text-yellow-400 shadow-md shadow-yellow-400/20"
                          : "bg-white/5 border border-white/10 text-gray-500 hover:text-white hover:border-white/30"
                      }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Open button */}
            <button
              onClick={handleOpen}
              disabled={!canOpen}
              className={`relative px-8 py-2.5 rounded-xl font-black uppercase tracking-wider text-sm transition-all duration-300 cursor-pointer overflow-hidden
                ${
                  canOpen
                    ? "text-black shadow-xl"
                    : "bg-gray-800 text-gray-600 cursor-not-allowed border border-white/5"
                }`}
              style={
                canOpen
                  ? {
                      background: "linear-gradient(135deg, #4ade80, #22c55e)",
                      boxShadow:
                        "0 0 25px rgba(74,222,128,0.3), 0 8px 20px rgba(0,0,0,0.3)",
                    }
                  : undefined
              }
            >
              {canOpen && (
                <div
                  className="absolute inset-0 animate-shimmer pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)",
                    backgroundSize: "200% 100%",
                  }}
                />
              )}
              <span className="relative z-10">
                {selectedCase.price === 0
                  ? `Open${openCount > 1 ? ` ×${openCount}` : ""} Free`
                  : `Open${openCount > 1 ? ` ×${openCount}` : ""} — $${totalCost.toFixed(2)}`}
              </span>
            </button>

            {/* Battle button */}
            <button
              onClick={onBattle}
              disabled={!meetsLevel || skins.length === 0}
              className={`px-5 py-2.5 rounded-xl font-black uppercase tracking-wider text-sm transition-all duration-300 cursor-pointer
                ${
                  meetsLevel && skins.length > 0
                    ? "text-white"
                    : "bg-gray-800 text-gray-600 cursor-not-allowed border border-white/5"
                }`}
              style={
                meetsLevel && skins.length > 0
                  ? {
                      background: "linear-gradient(135deg, #ef4444, #dc2626)",
                      boxShadow:
                        "0 0 20px rgba(239,68,68,0.25), 0 8px 20px rgba(0,0,0,0.3)",
                    }
                  : undefined
              }
            >
              ⚔️ Case Battle
            </button>

            {!meetsLevel && (
              <span className="text-xs text-yellow-400/80 font-semibold">
                🔒 Requires Level {selectedCase.levelRequired}
              </span>
            )}
          </div>
        </div>

        {/* Odds & skins content */}
        <div className="p-5 space-y-6">
          {effectiveOdds.map(({ rarity, pct }) => {
            const color = RARITY_COLORS[rarity] ?? "#666";
            const pool = skinsByRarity.get(rarity) ?? [];
            const perSkinPct = pool.length > 0 ? pct / pool.length : 0;

            return (
              <div key={rarity}>
                {/* Rarity header with bar */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{
                      background: color,
                      boxShadow: `0 0 8px ${color}`,
                    }}
                  />
                  <span
                    className="text-base font-bold flex-shrink-0"
                    style={{ color }}
                  >
                    {RARITY_LABELS[rarity] ?? rarity}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(pct, 0.5)}%`,
                        background: `linear-gradient(90deg, ${color}cc, ${color}55)`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-mono text-gray-300 flex-shrink-0">
                    {pct < 1 ? pct.toFixed(2) : pct.toFixed(1)}%
                  </span>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    ({pool.length} skins)
                  </span>
                </div>

                {/* Skin grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {pool.map((skin) => {
                    const price =
                      computeSkinPrice(skin, 0) *
                      (selectedCase.sellPriceMultiplier ?? 1);
                    return (
                      <div
                        key={skin.id}
                        className="flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors hover:border-white/20"
                        style={{
                          borderColor: `${color}22`,
                          background: `linear-gradient(135deg, ${color}08 0%, transparent 100%)`,
                        }}
                      >
                        <img
                          src={skin.image}
                          alt={skin.name}
                          className="w-14 h-10 object-contain flex-shrink-0 drop-shadow-md"
                          loading="lazy"
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs font-semibold text-gray-200 truncate leading-tight">
                            {skin.name}
                          </span>
                          <span className="text-[11px] font-mono text-green-400 mt-0.5">
                            ${price.toFixed(2)}
                          </span>
                          <span
                            className="text-[10px] font-mono mt-0.5"
                            style={{ color }}
                          >
                            {perSkinPct < 0.01
                              ? perSkinPct.toFixed(4)
                              : perSkinPct < 0.1
                                ? perSkinPct.toFixed(3)
                                : perSkinPct.toFixed(2)}
                            %
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

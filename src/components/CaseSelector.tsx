import { useMemo } from "react";
import type { CaseDefinition, Skin } from "../types";
import { RARITY_COLORS } from "../constants";
import { getSkinsForCategories, limitSkinPoolForCase } from "../api";
import { computeSkinPrice } from "../engine";

interface CaseSelectorProps {
  cases: CaseDefinition[];
  selectedCase: CaseDefinition | null;
  onSelectCase: (c: CaseDefinition) => void;
  balance: number;
  level: number;
  skins: Skin[];
}

function getTierInfo(price: number): {
  label: string;
  color: string;
  glow: string;
  badge: string;
} {
  if (price === 0)
    return {
      label: "FREE",
      color: "#4ade80",
      glow: "rgba(74,222,128,0.25)",
      badge: "bg-green-500/20 text-green-400 border-green-500/40",
    };
  if (price <= 2)
    return {
      label: "$2",
      color: "#4b69ff",
      glow: "rgba(75,105,255,0.25)",
      badge: "tier-standard text-white",
    };
  if (price <= 5)
    return {
      label: "$5",
      color: "#8847ff",
      glow: "rgba(136,71,255,0.3)",
      badge: "tier-premium text-white",
    };
  if (price <= 10)
    return {
      label: "$10",
      color: "#d32ce6",
      glow: "rgba(211,44,230,0.3)",
      badge: "tier-elite text-white",
    };
  if (price <= 20)
    return {
      label: `$${price}`,
      color: "#eb4b4b",
      glow: "rgba(235,75,75,0.35)",
      badge: "tier-legendary text-white",
    };
  if (price <= 50)
    return {
      label: `$${price}`,
      color: "#caab05",
      glow: "rgba(202,171,5,0.4)",
      badge: "tier-mythic text-white",
    };
  if (price <= 100)
    return {
      label: `$${price}`,
      color: "#ff6b35",
      glow: "rgba(255,107,53,0.45)",
      badge: "bg-orange-500/30 text-orange-300 border-orange-500/50",
    };
  return {
    label: `$${price}`,
    color: "#ff2d55",
    glow: "rgba(255,45,85,0.5)",
    badge: "bg-pink-500/30 text-pink-200 border-pink-400/60",
  };
}

export function getFeaturedSkin(
  c: CaseDefinition,
  allSkins: Skin[],
): Skin | null {
  if (allSkins.length === 0) return null;
  // Get category-filtered skins if weaponCategories is set
  let pool =
    c.weaponCategories && c.weaponCategories.length > 0
      ? getSkinsForCategories(allSkins, c.weaponCategories)
      : allSkins;
  if (pool.length === 0) pool = allSkins;
  // Apply rarity filter so the featured skin actually belongs to this case
  if (c.rarityFilter && c.rarityFilter.length > 0) {
    const allowed = new Set<string>(c.rarityFilter);
    const filtered = pool.filter((s) => allowed.has(s.rarity.name));
    if (filtered.length > 0) pool = filtered;
  }
  // Limit to the case's curated pool
  pool = limitSkinPoolForCase(pool, c.id);
  if (pool.length === 0) return null;
  // Pick the skin with the highest deterministic price (applying case multiplier)
  const mult = c.sellPriceMultiplier ?? 1;
  let best = pool[0];
  let bestPrice = computeSkinPrice(best, 0) * mult;
  for (let i = 1; i < pool.length; i++) {
    const price = computeSkinPrice(pool[i], 0) * mult;
    if (price > bestPrice) {
      best = pool[i];
      bestPrice = price;
    }
  }
  return best;
}

export function CaseSelector({
  cases,
  selectedCase,
  onSelectCase,
  balance,
  level,
  skins,
}: CaseSelectorProps) {
  // Memoize featured skins so they don't change on every render
  const featuredSkins = useMemo(() => {
    const map = new Map<string, Skin | null>();
    for (const c of cases) {
      map.set(c.id, getFeaturedSkin(c, skins));
    }
    return map;
  }, [cases, skins]);
  // Group cases by tier
  const freeCases = cases.filter((c) => c.price === 0);
  const standardCases = cases.filter((c) => c.price > 0 && c.price <= 2);
  const premiumCases = cases.filter((c) => c.price > 2);

  const renderCaseCard = (c: CaseDefinition) => {
    const isSelected = selectedCase?.id === c.id;
    const isLocked = (c.levelRequired ?? 0) > level;
    const canAfford = c.price === 0 || balance >= c.price;
    const isDisabled = isLocked || !canAfford;
    const tier = getTierInfo(c.price);
    const featured = featuredSkins.get(c.id) ?? null;
    const featuredColor = featured
      ? (RARITY_COLORS[featured.rarity.name] ?? "#666")
      : null;

    return (
      <button
        key={c.id}
        onClick={() => onSelectCase(c)}
        disabled={isDisabled}
        className={`
          group relative flex flex-col items-center p-4 pb-3 rounded-2xl border-2 transition-all duration-300 cursor-pointer overflow-hidden
          ${
            isSelected
              ? "border-yellow-400 scale-[1.03]"
              : "border-white/5 hover:border-white/20 hover:scale-[1.02]"
          }
          ${isDisabled ? "opacity-40 cursor-not-allowed grayscale" : ""}
        `}
        style={{
          background: isSelected
            ? `linear-gradient(170deg, ${tier.glow} 0%, rgba(0,0,0,0.6) 60%)`
            : `linear-gradient(170deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.4) 100%)`,
          boxShadow: isSelected
            ? `0 0 20px ${tier.glow}, 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)`
            : "0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        {/* Background shine effect on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${tier.glow} 0%, transparent 70%)`,
          }}
        />

        {/* Lock overlay */}
        {isLocked && (
          <div className="absolute inset-0 rounded-2xl bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <span className="text-3xl mb-1">🔒</span>
            <span className="text-xs font-bold text-gray-300">
              Level {c.levelRequired}
            </span>
          </div>
        )}

        {/* Price tier badge */}
        <div
          className={`absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${tier.badge}`}
        >
          {tier.label}
        </div>

        {/* Featured skin image (or fallback case image) */}
        <div className="relative w-28 h-28 mb-2 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-60 transition-opacity duration-500 blur-xl"
            style={{ background: featuredColor ?? tier.color }}
          />
          <img
            src={featured?.image ?? c.image}
            alt={featured?.name ?? c.name}
            className="relative max-w-full max-h-full object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1"
            onError={(e) => {
              (e.target as HTMLImageElement).src = c.image;
            }}
          />
          {/* Rarity indicator dot */}
          {featured && (
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-10 rounded-full opacity-80"
              style={{ background: featuredColor ?? "#666" }}
            />
          )}
        </div>

        {/* Case name */}
        <span className="text-sm font-bold text-white text-center mb-0.5 relative z-10">
          {c.name}
        </span>

        {/* Description */}
        <span className="text-[11px] text-gray-400 text-center leading-tight relative z-10">
          {c.description}
        </span>

        {/* Selected indicator */}
        {isSelected && (
          <>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg shadow-yellow-400/50 z-20">
              <span className="text-black text-xs font-black">✓</span>
            </div>
            <div
              className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl"
              style={{
                background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)`,
              }}
            />
          </>
        )}
      </button>
    );
  };

  return (
    <div className="w-full mb-6">
      {/* Free Cases Section */}
      {freeCases.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-glow-pulse" />
            <h2 className="text-sm font-bold text-green-400 uppercase tracking-wider">
              Free Cases
            </h2>
            <div className="flex-1 h-px bg-gradient-to-r from-green-400/30 to-transparent" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {freeCases.map(renderCaseCard)}
          </div>
        </div>
      )}

      {/* Standard Cases Section */}
      {standardCases.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#4b69ff] animate-glow-pulse" />
            <h2 className="text-sm font-bold text-[#4b69ff] uppercase tracking-wider">
              Standard Cases — $2
            </h2>
            <div className="flex-1 h-px bg-gradient-to-r from-[#4b69ff]/30 to-transparent" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {standardCases.map(renderCaseCard)}
          </div>
        </div>
      )}

      {/* Premium Cases Section */}
      {premiumCases.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#d32ce6] animate-glow-pulse" />
            <h2 className="text-sm font-bold text-[#d32ce6] uppercase tracking-wider">
              Premium Cases
            </h2>
            <div className="flex-1 h-px bg-gradient-to-r from-[#d32ce6]/30 to-transparent" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {premiumCases.map(renderCaseCard)}
          </div>
        </div>
      )}
    </div>
  );
}

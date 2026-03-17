import { RARITY_COLORS } from "../constants";

interface DashboardProps {
  balance: number;
  level: number;
  xp: number;
  xpProgress: number;
  totalCasesOpened: number;
  onReset: () => void;
}

export function Dashboard({
  balance,
  level,
  xp,
  xpProgress,
  totalCasesOpened,
  onReset,
}: DashboardProps) {
  return (
    <div
      className="w-full rounded-2xl border border-white/10 p-6 mb-6 backdrop-blur-xl relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(10,10,20,0.8) 0%, rgba(20,15,35,0.8) 100%)",
      }}
    >
      {/* Subtle ambient glow */}
      <div
        className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: RARITY_COLORS["Mil-Spec Grade"] }}
      />

      <div className="relative flex flex-wrap items-center justify-between gap-6">
        {/* Balance */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1">
            Balance
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className="text-3xl font-black text-green-400 tabular-nums"
              style={{ textShadow: "0 0 20px rgba(74,222,128,0.4)" }}
            >
              ${balance.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Level - with ring indicator */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1">
            Level
          </span>
          <div
            className="relative w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: `conic-gradient(${RARITY_COLORS["Classified"]} ${xpProgress * 360}deg, rgba(255,255,255,0.05) 0deg)`,
              boxShadow: `0 0 15px ${RARITY_COLORS["Classified"]}44`,
            }}
          >
            <div className="w-11 h-11 rounded-full bg-[#0a0a0f] flex items-center justify-center">
              <span
                className="text-xl font-black tabular-nums"
                style={{ color: RARITY_COLORS["Classified"] }}
              >
                {level}
              </span>
            </div>
          </div>
        </div>

        {/* XP Bar */}
        <div className="flex flex-col flex-1 min-w-[200px]">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
              Experience
            </span>
            <span className="text-xs text-gray-400 tabular-nums font-medium">
              {xp} XP
            </span>
          </div>
          <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out relative"
              style={{
                width: `${Math.min(xpProgress * 100, 100)}%`,
                background: `linear-gradient(90deg, ${RARITY_COLORS["Mil-Spec Grade"]}, ${RARITY_COLORS["Classified"]})`,
                boxShadow: `0 0 12px ${RARITY_COLORS["Classified"]}66`,
              }}
            >
              {/* Shimmer effect on XP bar */}
              <div
                className="absolute inset-0 animate-shimmer"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)",
                  backgroundSize: "200% 100%",
                }}
              />
            </div>
          </div>
        </div>

        {/* Cases Opened */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1">
            Opened
          </span>
          <span className="text-2xl font-black text-white tabular-nums">
            {totalCasesOpened}
          </span>
        </div>

        {/* Reset */}
        <button
          onClick={onReset}
          className="px-3 py-1.5 text-[10px] uppercase tracking-wider bg-red-500/10 hover:bg-red-500/30 text-red-400/70 hover:text-red-400 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-all cursor-pointer"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

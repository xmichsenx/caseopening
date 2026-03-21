import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { generateCrashPoint } from "../engine";
import {
  CRASH_MAX_MULTIPLIER,
  CRASH_TICK_INTERVAL_MS,
  CRASH_SPEED_FACTOR,
} from "../constants";

interface CrashProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  onSpendBalance: (amount: number) => boolean;
  onAddBalance: (amount: number) => void;
  onAddXp: (amount: number) => void;
}

type GamePhase = "idle" | "running" | "crashed" | "cashedOut";

const QUICK_BETS = [1, 5, 10, 25, 50] as const;
const AUTO_CASHOUT_PRESETS = [1.5, 2, 3, 5, 10] as const;

/** Convert multiplier to graph Y position (0-1 range). */
function multiplierToY(m: number): number {
  // Log scale so high multipliers don't blow out the chart
  return Math.min(1, Math.log(m) / Math.log(CRASH_MAX_MULTIPLIER));
}

function getMultiplierColor(phase: GamePhase, multiplier: number): string {
  if (phase === "crashed") return "#e74c3c";
  if (phase === "cashedOut") return "#caab05";
  if (multiplier >= 10) return "#27ae60";
  if (multiplier >= 3) return "#2ecc71";
  return "#27ae60";
}

function formatMultiplier(m: number): string {
  return m >= 10 ? m.toFixed(1) : m.toFixed(2);
}

export function Crash({
  isOpen,
  onClose,
  balance,
  onSpendBalance,
  onAddBalance,
  onAddXp,
}: CrashProps) {
  // ── Bet inputs ─────────────────────────
  const [betInput, setBetInput] = useState("5.00");
  const [autoCashOut, setAutoCashOut] = useState("");

  // ── Game state ─────────────────────────
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(0);
  const [cashOutMultiplier, setCashOutMultiplier] = useState(0);
  const [betAmount, setBetAmount] = useState(0);

  // ── History ────────────────────────────
  const [history, setHistory] = useState<number[]>([]);

  // ── Graph points ───────────────────────
  const [graphPoints, setGraphPoints] = useState<[number, number][]>([]);

  // ── Timing refs ────────────────────────
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const phaseLockRef = useRef(false);

  // Clean up interval on unmount or close
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── Multiplier calculation ─────────────
  const calcMultiplier = useCallback((elapsed: number): number => {
    // Exponential growth: 1 + elapsed * SPEED * (1 + elapsed * 0.001)
    const m = 1 + elapsed * CRASH_SPEED_FACTOR * (1 + elapsed * 0.001);
    return Math.min(Math.floor(m * 100) / 100, CRASH_MAX_MULTIPLIER);
  }, []);

  // ── Start game ─────────────────────────
  const handleBet = useCallback(() => {
    const bet = parseFloat(betInput);
    if (isNaN(bet) || bet <= 0 || bet > balance) return;
    if (phase !== "idle") return;

    const success = onSpendBalance(bet);
    if (!success) return;

    const point = generateCrashPoint();
    setBetAmount(bet);
    setCrashPoint(point);
    setCashOutMultiplier(0);
    setCurrentMultiplier(1.0);
    setGraphPoints([[0, 0]]);
    setPhase("running");
    phaseLockRef.current = false;
    startTimeRef.current = performance.now();

    intervalRef.current = setInterval(() => {
      if (phaseLockRef.current) return;
      const elapsed = performance.now() - startTimeRef.current;
      const m = 1 + elapsed * CRASH_SPEED_FACTOR * (1 + elapsed * 0.001);
      const mult = Math.min(Math.floor(m * 100) / 100, CRASH_MAX_MULTIPLIER);

      setCurrentMultiplier(mult);

      // Build graph points — normalize elapsed to 0-1 for SVG
      const maxTime = 15000; // ~15s visual window
      const x = Math.min(elapsed / maxTime, 1);
      const y = multiplierToY(mult);
      setGraphPoints((prev) => [...prev, [x, y]]);

      if (mult >= point) {
        // CRASH
        phaseLockRef.current = true;
        if (intervalRef.current) clearInterval(intervalRef.current);
        setCurrentMultiplier(point);
        setPhase("crashed");
        setHistory((prev) => [point, ...prev].slice(0, 15));
        // XP even on loss
        const xpGain = Math.min(500, Math.max(10, Math.floor(bet * 10)));
        onAddXp(xpGain);
      }
    }, CRASH_TICK_INTERVAL_MS);
  }, [betInput, balance, phase, onSpendBalance, onAddXp, calcMultiplier]);

  // ── Cash out ───────────────────────────
  const handleCashOut = useCallback(() => {
    if (phase !== "running" || phaseLockRef.current) return;
    phaseLockRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);

    const payout = Math.round(betAmount * currentMultiplier * 100) / 100;
    setCashOutMultiplier(currentMultiplier);
    onAddBalance(payout);
    setPhase("cashedOut");
    setHistory((prev) => [crashPoint, ...prev].slice(0, 15));

    const xpGain = Math.min(500, Math.max(10, Math.floor(betAmount * 10)));
    onAddXp(xpGain);
  }, [phase, betAmount, currentMultiplier, crashPoint, onAddBalance, onAddXp]);

  // ── Auto cash out ──────────────────────
  useEffect(() => {
    if (phase !== "running") return;
    const target = parseFloat(autoCashOut);
    if (isNaN(target) || target <= 1) return;
    if (currentMultiplier >= target && !phaseLockRef.current) {
      handleCashOut();
    }
  }, [phase, currentMultiplier, autoCashOut, handleCashOut]);

  // ── Reset to idle ──────────────────────
  const handleNewRound = useCallback(() => {
    setPhase("idle");
    setCurrentMultiplier(1.0);
    setCrashPoint(0);
    setCashOutMultiplier(0);
    setBetAmount(0);
    setGraphPoints([]);
  }, []);

  // Auto-reset after result shown for 2.5s
  useEffect(() => {
    if (phase === "crashed" || phase === "cashedOut") {
      const timer = setTimeout(handleNewRound, 2500);
      return () => clearTimeout(timer);
    }
  }, [phase, handleNewRound]);

  // ── Quick bet helpers ──────────────────
  const setHalfBet = useCallback(() => {
    setBetInput((Math.floor((balance / 2) * 100) / 100).toFixed(2));
  }, [balance]);

  const setMaxBet = useCallback(() => {
    setBetInput(balance.toFixed(2));
  }, [balance]);

  if (!isOpen) return null;

  const bet = parseFloat(betInput);
  const canBet = phase === "idle" && !isNaN(bet) && bet > 0 && bet <= balance;

  // SVG graph path
  const svgWidth = 400;
  const svgHeight = 200;
  const pathD =
    graphPoints.length > 1
      ? graphPoints
          .map(([x, y], i) => {
            const px = x * svgWidth;
            const py = svgHeight - y * svgHeight;
            return i === 0 ? `M${px},${py}` : `L${px},${py}`;
          })
          .join(" ")
      : "";

  const payout =
    phase === "cashedOut" && cashOutMultiplier > 0
      ? Math.round(betAmount * cashOutMultiplier * 100) / 100
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={phase === "idle" ? onClose : undefined}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-white/10 overflow-hidden"
        style={{ background: "#1a1a2e" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <span>🚀</span> Crash
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              Balance:{" "}
              <span className="text-green-400 font-bold">
                ${balance.toFixed(2)}
              </span>
            </span>
            <button
              onClick={phase === "idle" ? onClose : undefined}
              className="text-gray-400 hover:text-white transition-colors text-2xl leading-none cursor-pointer disabled:opacity-30"
              disabled={phase !== "idle"}
            >
              ×
            </button>
          </div>
        </div>

        {/* History bar */}
        {history.length > 0 && (
          <div className="flex gap-1.5 px-4 py-2 overflow-x-auto border-b border-white/5">
            {history.map((point, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded text-xs font-bold shrink-0"
                style={{
                  background:
                    point < 2
                      ? "#e74c3c20"
                      : point >= 10
                        ? "#27ae6020"
                        : "#ffffff10",
                  color:
                    point < 2 ? "#e74c3c" : point >= 10 ? "#27ae60" : "#aaa",
                }}
              >
                {formatMultiplier(point)}×
              </span>
            ))}
          </div>
        )}

        {/* Graph area */}
        <div
          className="relative mx-4 mt-4 rounded-xl overflow-hidden"
          style={{ background: "#0d0d1a" }}
        >
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full"
            style={{ height: 200 }}
            preserveAspectRatio="none"
          >
            {/* Grid lines */}
            {[0.25, 0.5, 0.75].map((y) => (
              <line
                key={y}
                x1={0}
                y1={svgHeight * (1 - y)}
                x2={svgWidth}
                y2={svgHeight * (1 - y)}
                stroke="#ffffff08"
                strokeWidth={1}
              />
            ))}

            {/* Graph line */}
            {pathD && (
              <>
                {/* Glow */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={getMultiplierColor(phase, currentMultiplier)}
                  strokeWidth={4}
                  opacity={0.3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Main line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={getMultiplierColor(phase, currentMultiplier)}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}
          </svg>

          {/* Multiplier overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {phase === "running" && (
                <motion.div
                  key="running"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center"
                >
                  <div
                    className="text-5xl font-black tabular-nums"
                    style={{
                      color: getMultiplierColor(phase, currentMultiplier),
                    }}
                  >
                    {formatMultiplier(currentMultiplier)}×
                  </div>
                </motion.div>
              )}
              {phase === "crashed" && (
                <motion.div
                  key="crashed"
                  initial={{ scale: 1.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center"
                >
                  <div className="text-5xl font-black text-red-500">
                    CRASHED
                  </div>
                  <div className="text-lg text-red-400 mt-1">
                    {formatMultiplier(crashPoint)}× — Lost $
                    {betAmount.toFixed(2)}
                  </div>
                </motion.div>
              )}
              {phase === "cashedOut" && (
                <motion.div
                  key="cashedOut"
                  initial={{ scale: 1.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center"
                >
                  <div
                    className="text-5xl font-black"
                    style={{ color: "#caab05" }}
                  >
                    {formatMultiplier(cashOutMultiplier)}×
                  </div>
                  <div className="text-lg mt-1" style={{ color: "#27ae60" }}>
                    +${payout.toFixed(2)}
                  </div>
                </motion.div>
              )}
              {phase === "idle" && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center"
                >
                  <div className="text-3xl font-black text-gray-600">
                    Place your bet
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 space-y-3">
          {/* Cash out button (during running phase) */}
          {phase === "running" && (
            <motion.button
              onClick={handleCashOut}
              className="w-full py-4 rounded-xl font-black text-xl uppercase tracking-wider cursor-pointer border-2"
              animate={{
                scale: [1, 1.02, 1],
                boxShadow: [
                  "0 0 0px #27ae60",
                  "0 0 20px #27ae60",
                  "0 0 0px #27ae60",
                ],
              }}
              transition={{ duration: 0.8, repeat: Infinity }}
              style={{
                background: "linear-gradient(135deg, #27ae60, #2ecc71)",
                borderColor: "#27ae6080",
                color: "#fff",
              }}
            >
              Cash Out ${(betAmount * currentMultiplier).toFixed(2)}
            </motion.button>
          )}

          {/* Bet controls (idle phase) */}
          {(phase === "idle" ||
            phase === "crashed" ||
            phase === "cashedOut") && (
            <div className="space-y-3">
              {/* Bet amount row */}
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">
                  Bet Amount
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
                      $
                    </span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={betInput}
                      onChange={(e) => setBetInput(e.target.value)}
                      disabled={phase !== "idle"}
                      className="w-full pl-7 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white font-bold text-sm focus:outline-none focus:border-green-500/50 disabled:opacity-50"
                    />
                  </div>
                  <button
                    onClick={setHalfBet}
                    disabled={phase !== "idle"}
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs font-bold hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-30"
                  >
                    ½
                  </button>
                  <button
                    onClick={setMaxBet}
                    disabled={phase !== "idle"}
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs font-bold hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-30"
                  >
                    MAX
                  </button>
                </div>
                {/* Quick bet row */}
                <div className="flex gap-1.5 mt-2">
                  {QUICK_BETS.map((qb) => (
                    <button
                      key={qb}
                      onClick={() => setBetInput(qb.toFixed(2))}
                      disabled={phase !== "idle"}
                      className="flex-1 py-1.5 rounded-md bg-white/5 border border-white/10 text-gray-400 text-xs font-bold hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-30"
                    >
                      ${qb}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto cashout row */}
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">
                  Auto Cash Out
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="1.01"
                      step="0.1"
                      placeholder="Disabled"
                      value={autoCashOut}
                      onChange={(e) => setAutoCashOut(e.target.value)}
                      disabled={phase !== "idle"}
                      className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white font-bold text-sm focus:outline-none focus:border-green-500/50 disabled:opacity-50 placeholder-gray-600"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">
                      ×
                    </span>
                  </div>
                  {AUTO_CASHOUT_PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setAutoCashOut(p.toString())}
                      disabled={phase !== "idle"}
                      className="px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs font-bold hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-30"
                    >
                      {p}×
                    </button>
                  ))}
                </div>
              </div>

              {/* Bet button */}
              <button
                onClick={handleBet}
                disabled={!canBet}
                className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all cursor-pointer border-2 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.01]"
                style={{
                  background: canBet
                    ? "linear-gradient(135deg, #27ae60, #2ecc71)"
                    : "#ffffff08",
                  borderColor: canBet ? "#27ae6080" : "#ffffff10",
                  color: canBet ? "#fff" : "#666",
                }}
              >
                {!canBet && (isNaN(bet) || bet <= 0)
                  ? "Enter a bet"
                  : !canBet && bet > balance
                    ? "Insufficient balance"
                    : phase !== "idle"
                      ? "Round in progress…"
                      : `Bet $${(bet || 0).toFixed(2)}`}
              </button>

              {/* Info */}
              <div className="flex justify-between text-xs text-gray-600 px-1">
                <span>House edge: 2%</span>
                <span>Max: {CRASH_MAX_MULTIPLIER}×</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

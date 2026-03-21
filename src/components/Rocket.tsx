import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { generateCrashPoint } from "../engine";
import {
  ROCKET_MAX_MULTIPLIER,
  ROCKET_TICK_INTERVAL_MS,
  ROCKET_SPEED_FACTOR,
  ROCKET_CRASH_GRACE_MS,
} from "../constants";
import {
  playRocketEngine,
  playExplosion,
  playCashOut,
  type RocketEngineHandle,
} from "../audio";

interface RocketProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  onSpendBalance: (amount: number) => boolean;
  onAddBalance: (amount: number) => void;
  onAddXp: (amount: number) => void;
}

type GamePhase = "idle" | "holding" | "crashed" | "cashedOut";

const QUICK_BETS = [1, 5, 10, 25, 50] as const;

/** Map multiplier to a 0–1 altitude for the rocket scene. */
function multiplierToAltitude(m: number): number {
  return Math.min(1, Math.log(m) / Math.log(ROCKET_MAX_MULTIPLIER));
}

function getMultiplierColor(phase: GamePhase, multiplier: number): string {
  if (phase === "crashed") return "#e74c3c";
  if (phase === "cashedOut") return "#caab05";
  if (multiplier >= 10) return "#27ae60";
  if (multiplier >= 3) return "#2ecc71";
  return "#3b82f6";
}

function formatMultiplier(m: number): string {
  return m >= 10 ? m.toFixed(1) : m.toFixed(2);
}

/** Deterministic star positions so they don't re-render. */
const STARS = Array.from({ length: 40 }, (_, i) => ({
  left: (i * 73 + 17) % 100,
  top: (i * 41 + 29) % 100,
  size: (i % 3) + 1,
  opacity: 0.2 + (i % 5) * 0.1,
}));

const ALTITUDE_MARKERS = [2, 5, 10, 25, 50, 100] as const;

export function Rocket({
  isOpen,
  onClose,
  balance,
  onSpendBalance,
  onAddBalance,
  onAddXp,
}: RocketProps) {
  // ── Bet input ──────────────────────────
  const [betInput, setBetInput] = useState("5.00");

  // ── Game state ─────────────────────────
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(0);
  const [cashOutMultiplier, setCashOutMultiplier] = useState(0);
  const [betAmount, setBetAmount] = useState(0);

  // ── History ────────────────────────────
  const [history, setHistory] = useState<number[]>([]);

  // ── Trail points (altitude values over time) ──
  const [trail, setTrail] = useState<number[]>([]);

  // ── Refs ────────────────────────────────
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const phaseLockRef = useRef(false);
  const crashPointRef = useRef(0);
  const betAmountRef = useRef(0);
  const engineSoundRef = useRef<RocketEngineHandle | null>(null);
  const holdStartTimeRef = useRef(0);
  const windowCleanupRef = useRef<(() => void) | null>(null);
  const currentMultiplierRef = useRef(1.0);
  const crashPointStateRef = useRef(0);
  /** Whether the current hold was initiated via touch (vs mouse). */
  const isTouchHoldRef = useRef(false);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      engineSoundRef.current?.stop();
      windowCleanupRef.current?.();
    };
  }, []);

  // ── Cleanup window listeners helper ────
  const cleanupWindowListeners = useCallback(() => {
    windowCleanupRef.current?.();
    windowCleanupRef.current = null;
  }, []);

  // ── Ref-based hold end (uses refs so it works from synchronous listeners) ──
  const doHoldEnd = useCallback(
    (forceRefund: boolean) => {
      if (phaseLockRef.current) return;
      phaseLockRef.current = true;

      if (intervalRef.current) clearInterval(intervalRef.current);
      engineSoundRef.current?.stop();
      cleanupWindowListeners();

      if (forceRefund) {
        // Quick click — return the bet at 1.0× (no profit, no loss)
        playCashOut();
        const payout = betAmountRef.current;
        setCashOutMultiplier(1.0);
        onAddBalance(payout);
        setPhase("cashedOut");
        setHistory((prev) =>
          [crashPointStateRef.current, ...prev].slice(0, 15),
        );
      } else {
        playCashOut();
        const mult = currentMultiplierRef.current;
        const payout = Math.round(betAmountRef.current * mult * 100) / 100;
        setCashOutMultiplier(mult);
        onAddBalance(payout);
        setPhase("cashedOut");
        setHistory((prev) =>
          [crashPointStateRef.current, ...prev].slice(0, 15),
        );
        const xpGain = Math.min(
          500,
          Math.max(10, Math.floor(betAmountRef.current * 10)),
        );
        onAddXp(xpGain);
      }
    },
    [onAddBalance, onAddXp, cleanupWindowListeners],
  );

  // ── Handle hold START (mouseDown / touchStart) ─────
  const handleHoldStart = useCallback(() => {
    if (phase !== "idle") return;

    let bet = parseFloat(betInput);
    // Auto-correct empty / invalid input to a sensible default
    if (isNaN(bet) || bet <= 0) {
      bet = 5;
      setBetInput("5.00");
    }
    if (bet > balance) return;

    const success = onSpendBalance(bet);
    if (!success) return;

    const point = generateCrashPoint();
    setBetAmount(bet);
    betAmountRef.current = bet;
    setCrashPoint(point);
    crashPointRef.current = point;
    crashPointStateRef.current = point;
    setCashOutMultiplier(0);
    setCurrentMultiplier(1.0);
    currentMultiplierRef.current = 1.0;
    setTrail([0]);
    setPhase("holding");
    phaseLockRef.current = false;
    startTimeRef.current = performance.now();
    holdStartTimeRef.current = Date.now();

    // Start engine sound
    engineSoundRef.current?.stop();
    engineSoundRef.current = playRocketEngine();

    // ── Register window listeners IMMEDIATELY (not in useEffect) ──
    // This prevents the bug where a quick click's mouseup fires before
    // useEffect registers its listeners, leaving the user stuck.
    cleanupWindowListeners(); // clear any stale ones

    const isTouch = isTouchHoldRef.current;

    const onRelease = () => {
      const elapsed = Date.now() - holdStartTimeRef.current;
      if (elapsed < 200) {
        // Quick click — auto refund at 1.0×
        doHoldEnd(true);
      } else {
        doHoldEnd(false);
      }
    };

    // On mobile, blur fires spuriously during long-press (e.g. address bar
    // appearing, OS notification). Only treat blur as cash-out for mouse.
    const onBlur = () => {
      if (!isTouchHoldRef.current) doHoldEnd(false);
    };
    const onVisibility = () => {
      if (document.hidden) doHoldEnd(false);
    };
    const onContext = (e: Event) => {
      e.preventDefault();
      // On mobile, long-press context menu shouldn't end the game
      if (!isTouchHoldRef.current) doHoldEnd(false);
    };

    // Prevent touch-move from scrolling the page underneath the hold
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
    };

    if (isTouch) {
      // Touch: only listen for touchend + touchcancel (NOT mouseup)
      window.addEventListener("touchend", onRelease);
      window.addEventListener("touchcancel", onRelease);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
    } else {
      // Mouse: only listen for mouseup (NOT touchend)
      window.addEventListener("mouseup", onRelease);
    }
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("contextmenu", onContext);

    windowCleanupRef.current = () => {
      window.removeEventListener("mouseup", onRelease);
      window.removeEventListener("touchend", onRelease);
      window.removeEventListener("touchcancel", onRelease);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("contextmenu", onContext);
    };

    intervalRef.current = setInterval(() => {
      if (phaseLockRef.current) return;
      const elapsed = performance.now() - startTimeRef.current;
      const m = 1 + elapsed * ROCKET_SPEED_FACTOR * (1 + elapsed * 0.001);
      const mult = Math.min(Math.floor(m * 100) / 100, ROCKET_MAX_MULTIPLIER);

      setCurrentMultiplier(mult);
      currentMultiplierRef.current = mult;
      setTrail((prev) => [...prev, multiplierToAltitude(mult)]);

      // Grace period: skip crash check for the first N ms so the rocket
      // animation is always visible and quick-click refunds can fire
      // before the crash beats the mouseup.
      if (elapsed < ROCKET_CRASH_GRACE_MS) return;

      if (mult >= crashPointRef.current) {
        // EXPLODED
        phaseLockRef.current = true;
        if (intervalRef.current) clearInterval(intervalRef.current);
        engineSoundRef.current?.stop();
        cleanupWindowListeners();
        playExplosion();
        setCurrentMultiplier(crashPointRef.current);
        setPhase("crashed");
        setHistory((prev) => [crashPointRef.current, ...prev].slice(0, 15));
        const xpGain = Math.min(
          500,
          Math.max(10, Math.floor(betAmountRef.current * 10)),
        );
        onAddXp(xpGain);
      }
    }, ROCKET_TICK_INTERVAL_MS);
  }, [
    betInput,
    balance,
    phase,
    onSpendBalance,
    onAddXp,
    doHoldEnd,
    cleanupWindowListeners,
  ]);

  // Clean up window listeners when phase leaves "holding" (safety net)
  useEffect(() => {
    if (phase !== "holding") {
      cleanupWindowListeners();
    }
  }, [phase, cleanupWindowListeners]);

  // ── Reset to idle after result ─────────
  const handleNewRound = useCallback(() => {
    setPhase("idle");
    setCurrentMultiplier(1.0);
    setCrashPoint(0);
    setCashOutMultiplier(0);
    setBetAmount(0);
    setTrail([]);
  }, []);

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
  // canBet is true when idle + balance > 0. Empty input is allowed because
  // handleHoldStart auto-corrects NaN/empty to $5.00.
  const canBet =
    phase === "idle" &&
    balance > 0 &&
    (isNaN(bet) || bet <= 0 || bet <= balance);

  // Compute altitude for rocket position
  const altitude = multiplierToAltitude(currentMultiplier);
  const payout =
    phase === "cashedOut" && cashOutMultiplier > 0
      ? Math.round(betAmount * cashOutMultiplier * 100) / 100
      : 0;

  // Scene dimensions for the SVG trail
  const sceneHeight = 280;
  const sceneWidth = 400;
  const rocketY = sceneHeight - altitude * (sceneHeight - 40) - 20; // 20px padding top/bottom

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={phase === "idle" ? onClose : undefined}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-white/10 overflow-hidden max-h-[95vh] overflow-y-auto"
        style={{ background: "#1a1a2e" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-white/10">
          <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
            <span>🚀</span> Rocket
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm text-gray-400">
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
          <div className="flex gap-1.5 px-3 sm:px-4 py-2 overflow-x-auto border-b border-white/5">
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

        {/* Rocket Scene */}
        <div
          className="relative mx-3 sm:mx-4 mt-3 sm:mt-4 rounded-xl overflow-hidden select-none"
          style={{ background: "#0a0a1a", height: sceneHeight }}
        >
          {/* Stars */}
          {STARS.map((star, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: `${star.left}%`,
                top: `${star.top}%`,
                width: star.size,
                height: star.size,
                opacity: star.opacity,
              }}
            />
          ))}

          {/* Altitude markers */}
          {ALTITUDE_MARKERS.map((m) => {
            const markerY =
              sceneHeight - multiplierToAltitude(m) * (sceneHeight - 40) - 20;
            return (
              <div
                key={m}
                className="absolute left-0 right-0 flex items-center"
                style={{ top: markerY }}
              >
                <div
                  className="flex-1 border-t border-dashed"
                  style={{ borderColor: "#ffffff0a" }}
                />
                <span
                  className="text-[10px] font-bold px-1.5 shrink-0"
                  style={{ color: "#ffffff20" }}
                >
                  {m}×
                </span>
              </div>
            );
          })}

          {/* Trail line */}
          {trail.length > 1 &&
            (phase === "holding" ||
              phase === "crashed" ||
              phase === "cashedOut") && (
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox={`0 0 ${sceneWidth} ${sceneHeight}`}
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="trailGrad" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#555555" stopOpacity="0.1" />
                    <stop
                      offset="100%"
                      stopColor={
                        phase === "crashed"
                          ? "#e74c3c"
                          : phase === "cashedOut"
                            ? "#caab05"
                            : "#3b82f6"
                      }
                      stopOpacity="0.6"
                    />
                  </linearGradient>
                </defs>
                <polyline
                  points={trail
                    .map((alt) => {
                      const x = sceneWidth / 2;
                      const y = sceneHeight - alt * (sceneHeight - 40) - 20;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="url(#trailGrad)"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
                {/* Glow layer */}
                <polyline
                  points={trail
                    .map((alt) => {
                      const x = sceneWidth / 2;
                      const y = sceneHeight - alt * (sceneHeight - 40) - 20;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="url(#trailGrad)"
                  strokeWidth={8}
                  strokeLinecap="round"
                  opacity={0.2}
                />
              </svg>
            )}

          {/* Rocket */}
          <AnimatePresence mode="wait">
            {phase === "holding" && (
              <motion.div
                key="rocket-fly"
                className="absolute left-1/2 -translate-x-1/2 text-3xl sm:text-4xl"
                style={{
                  top: rocketY - 20,
                  filter: "drop-shadow(0 0 8px #3b82f680)",
                }}
                animate={{ x: [0, -2, 2, -1, 1, 0] }}
                transition={{ duration: 0.4, repeat: Infinity }}
              >
                🚀
              </motion.div>
            )}
            {phase === "crashed" && (
              <motion.div
                key="explosion"
                className="absolute left-1/2 -translate-x-1/2"
                style={{ top: rocketY - 24 }}
                initial={{ scale: 0.5, opacity: 1 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                <div
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle, #ff6b3580, #e74c3c60, transparent)",
                  }}
                />
              </motion.div>
            )}
            {phase === "cashedOut" && (
              <motion.div
                key="rocket-safe"
                className="absolute left-1/2 -translate-x-1/2 text-3xl sm:text-4xl"
                style={{ top: rocketY - 20 }}
                initial={{ opacity: 1 }}
                animate={{ opacity: 0.4, y: -20 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              >
                🪂
              </motion.div>
            )}
          </AnimatePresence>

          {/* Multiplier overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <AnimatePresence mode="wait">
              {phase === "holding" && (
                <motion.div
                  key="holding"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center"
                >
                  <div
                    className="text-4xl sm:text-5xl font-black tabular-nums"
                    style={{
                      color: getMultiplierColor(phase, currentMultiplier),
                      textShadow: `0 0 20px ${getMultiplierColor(phase, currentMultiplier)}40`,
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
                  <div className="text-4xl sm:text-5xl font-black text-red-500">
                    EXPLODED
                  </div>
                  <div className="text-sm sm:text-lg text-red-400 mt-1">
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
                    className="text-4xl sm:text-5xl font-black"
                    style={{ color: "#caab05" }}
                  >
                    {formatMultiplier(cashOutMultiplier)}×
                  </div>
                  <div
                    className="text-sm sm:text-lg mt-1"
                    style={{ color: "#27ae60" }}
                  >
                    +${payout.toFixed(2)}
                  </div>
                </motion.div>
              )}
              {phase === "idle" && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center px-4"
                >
                  <div className="text-2xl sm:text-3xl font-black text-gray-600">
                    Hold to fly
                  </div>
                  <div className="text-xs sm:text-sm text-gray-700 mt-1">
                    Release to cash out
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Controls */}
        <div className="p-3 sm:p-4 space-y-3">
          {/* HOLD button (during holding phase) — release is handled by
              the global window mouseup/touchend listener, so no onMouseUp here */}
          {phase === "holding" && (
            <motion.button
              className="w-full py-5 sm:py-6 rounded-xl font-black text-lg sm:text-xl uppercase tracking-wider cursor-pointer border-2 select-none touch-none"
              animate={{
                scale: [1, 1.02, 1],
                boxShadow: [
                  "0 0 0px #3b82f6",
                  "0 0 30px #3b82f6",
                  "0 0 0px #3b82f6",
                ],
              }}
              transition={{ duration: 0.6, repeat: Infinity }}
              style={{
                background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                borderColor: "#3b82f680",
                color: "#fff",
              }}
            >
              ✋ HOLDING — ${(betAmount * currentMultiplier).toFixed(2)}
            </motion.button>
          )}

          {/* Bet controls (idle / result phase) */}
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
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      value={betInput}
                      onChange={(e) => setBetInput(e.target.value)}
                      onBlur={() => {
                        const v = parseFloat(betInput);
                        if (isNaN(v) || v <= 0) setBetInput("0.01");
                        else setBetInput(v.toFixed(2));
                      }}
                      disabled={phase !== "idle"}
                      className="w-full pl-7 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white font-bold text-sm focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
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

              {/* HOLD TO FLY button */}
              <button
                onMouseDown={
                  phase === "idle"
                    ? () => {
                        isTouchHoldRef.current = false;
                        handleHoldStart();
                      }
                    : undefined
                }
                onTouchStart={
                  phase === "idle"
                    ? (e) => {
                        e.preventDefault();
                        isTouchHoldRef.current = true;
                        handleHoldStart();
                      }
                    : undefined
                }
                disabled={!canBet}
                className="w-full py-4 sm:py-5 rounded-xl font-black text-sm sm:text-base uppercase tracking-wider transition-all cursor-pointer border-2 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.01] select-none touch-none"
                style={{
                  background: canBet
                    ? "linear-gradient(135deg, #2563eb, #3b82f6)"
                    : "#ffffff08",
                  borderColor: canBet ? "#3b82f680" : "#ffffff10",
                  color: canBet ? "#fff" : "#666",
                }}
              >
                {phase !== "idle"
                  ? "Round in progress…"
                  : balance <= 0
                    ? "Insufficient balance"
                    : !isNaN(bet) && bet > balance
                      ? "Insufficient balance"
                      : `🚀 Hold to Fly — $${(!isNaN(bet) && bet > 0 ? bet : 5).toFixed(2)}`}
              </button>

              {/* Info */}
              <div className="flex justify-between text-xs text-gray-600 px-1">
                <span>House edge: 2%</span>
                <span>Release to cash out</span>
                <span>Max: {ROCKET_MAX_MULTIPLIER}×</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

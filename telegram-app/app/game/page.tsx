"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTelegramBack } from "@/hooks/useTelegramBack";
import { haptic } from "@/lib/telegram-ui";
import { getTelegramInitData } from "@/lib/telegram";
import { useWalletStore } from "@/hooks/useStore";
import { getTierForBalance } from "@/config/tiers";
import {
  PRIMARY_CUSTOM_ASSET_CODE,
  PRIMARY_CUSTOM_ASSET_LABEL,
} from "@/lib/constants";
import WalletGuard from "@/components/WalletGuard";
import TrustlineChecker from "@/components/TrustlineChecker";
import BottomNav from "@/components/BottomNav";
import ModePicker, { type QuizMode } from "@/components/quiz/ModePicker";
import QuizSession from "@/components/quiz/QuizSession";
import ResultScreen from "@/components/quiz/ResultScreen";
import SlotMachine from "@/components/SlotMachine";
import ScratchCard from "@/components/ScratchCard";

const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_BYPASS === "true";

type GameView =
  | "hub"
  | "lucky"
  | "slot"
  | "scratch"
  | "quiz-pick"
  | "quiz"
  | "quiz-result";

// ── Lucky Draw ────────────────────────────────────────────────────────────────
interface Prize {
  label: string;
  emoji: string;
  color: string;
  weight: number;
  isWNSAFL?: boolean;
  isWXLM?: boolean;
  isWXRP?: boolean;
  isWUSDC?: boolean;
  amount?: number;
}

function isAssetPrize(p: Prize): boolean {
  return !!(p.isWNSAFL || p.isWXLM || p.isWXRP || p.isWUSDC);
}

function getAssetSymbol(p: Prize): string {
  if (p.isWXLM) return "wXLM";
  if (p.isWNSAFL) return "wNSAFL";
  if (p.isWXRP) return "wXRP";
  return "wUSDC";
}

// Weighted prize table — asset prizes ~35%, free spin ~25%, better luck ~35%, +2 spins ~5%
// Total weight: 1000
const PRIZES: Prize[] = [
  {
    label: "100 wXLM",
    emoji: "💎",
    color: "#0a3d62",
    weight: 15,
    isWXLM: true,
    amount: 100,
  },
  {
    label: "50 wXLM",
    emoji: "✨",
    color: "#1e6091",
    weight: 20,
    isWXLM: true,
    amount: 50,
  },
  {
    label: "20 wXLM",
    emoji: "🌟",
    color: "#1a4a6a",
    weight: 30,
    isWXLM: true,
    amount: 20,
  },
  {
    label: "5000 wNSAFL",
    emoji: "🏆",
    color: "#b7791f",
    weight: 10,
    isWNSAFL: true,
    amount: 5000,
  },
  {
    label: "2500 wNSAFL",
    emoji: "🥇",
    color: "#D4AF37",
    weight: 25,
    isWNSAFL: true,
    amount: 2500,
  },
  {
    label: "1000 wNSAFL",
    emoji: "🥈",
    color: "#c8a030",
    weight: 50,
    isWNSAFL: true,
    amount: 1000,
  },
  {
    label: "50 wXRP",
    emoji: "🔷",
    color: "#1a4060",
    weight: 50,
    isWXRP: true,
    amount: 50,
  },
  {
    label: "100 wUSDC",
    emoji: "💵",
    color: "#0a4a2a",
    weight: 50,
    isWUSDC: true,
    amount: 100,
  },
  { label: "+2 Spins", emoji: "🎱", color: "#145c3a", weight: 50 },
  { label: "Free Spin", emoji: "🔄", color: "#1a4a8a", weight: 250 },
  { label: "Better Luck", emoji: "💨", color: "#1a202c", weight: 450 },
];

function pickPrize(): number {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < PRIZES.length; i++) {
    r -= PRIZES[i].weight;
    if (r <= 0) return i;
  }
  return PRIZES.length - 1;
}

function LuckyDraw({
  onBack,
  stellarAddress,
  onSpinComplete,
  initialCanSpin,
  initialSpinsRemaining,
  initialDailyLimit,
  initialBonusSpins,
  tierLabel,
}: {
  onBack: () => void;
  stellarAddress: string | null;
  onSpinComplete: (
    onFresh: (can: boolean, remaining: number, bonus: number) => void,
  ) => Promise<void>;
  initialCanSpin: boolean;
  initialSpinsRemaining: number;
  initialDailyLimit: number;
  initialBonusSpins: number;
  tierLabel: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const angleRef = useRef(0);
  const targetAngleRef = useRef(0);
  const targetPrizeIdxRef = useRef(0);
  const winSentRef = useRef(false);
  const segCount = PRIZES.length;
  const segAngle = (Math.PI * 2) / segCount;

  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Prize | null>(null);
  const [freeSpin, setFreeSpin] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [winCode, setWinCode] = useState<string | null>(null);
  const [recentWins, setRecentWins] = useState<
    { telegram_id: number; prize: string; created_at: string }[]
  >([]);

  useEffect(() => {
    fetch("/api/game/wins")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setRecentWins(j.data);
      })
      .catch(() => null);
  }, []);

  // Spin state — server is authoritative; props reflect latest server fetch
  const [canSpin, setCanSpin] = useState(initialCanSpin);
  const [spinsRemaining, setSpinsRemaining] = useState(initialSpinsRemaining);
  const [dailySpinLimit] = useState(initialDailyLimit);
  const [bonusSpinsLeft, setBonusSpinsLeft] = useState(initialBonusSpins);
  const [processing, setProcessing] = useState(false); // true while POSTing + refetching

  const spinStatusLoaded = true;
  const usingBonus = spinsRemaining === 0 && bonusSpinsLeft > 0;

  // ── Canvas wheel draw ─────────────────────────────────────────────────────
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = Math.min(wrapRef.current?.clientWidth ?? 340, 340);
    canvas.width = size;
    canvas.height = size;
    const cx = size / 2,
      cy = size / 2,
      r = size / 2 - 8;

    ctx.clearRect(0, 0, size, size);

    // rim
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    const rimGrad = ctx.createLinearGradient(0, 0, size, size);
    rimGrad.addColorStop(0, "#f0d060");
    rimGrad.addColorStop(0.5, "#D4AF37");
    rimGrad.addColorStop(1, "#8a6520");
    ctx.fillStyle = rimGrad;
    ctx.fill();

    PRIZES.forEach((prize, i) => {
      const start = angleRef.current + i * segAngle;
      const end = start + segAngle;

      const grad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
      const hex = prize.color;
      grad.addColorStop(0, hex + "cc");
      grad.addColorStop(1, hex + "ff");

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // emoji + label text
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + segAngle / 2);
      ctx.textAlign = "right";

      // emoji (outer)
      ctx.font = `${Math.max(12, size * 0.038)}px serif`;
      ctx.fillText(prize.emoji, r - 8, -6);

      // prize label (inner, smaller)
      const fontSize = Math.max(8, size * 0.028);
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 3;
      ctx.fillText(prize.label, r - 8, 8);
      ctx.shadowBlur = 0;

      ctx.restore();
    });

    // centre hub
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    const hubGrad = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, 22);
    hubGrad.addColorStop(0, "#f0d060");
    hubGrad.addColorStop(1, "#8a6520");
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = "#0A0E1A";
    ctx.lineWidth = 2;
    ctx.stroke();

    // pointer triangle at top
    const px = cx,
      py = cy - r - 8;
    ctx.beginPath();
    ctx.moveTo(px, py + 18);
    ctx.lineTo(px - 9, py);
    ctx.lineTo(px + 9, py);
    ctx.closePath();
    ctx.fillStyle = "#D4AF37";
    ctx.fill();
  }, [segAngle]);

  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  // spin animation
  useEffect(() => {
    if (!spinning) return;
    const startAngle = angleRef.current;
    const startTime = Date.now();
    const duration = 3800;

    function step() {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      angleRef.current =
        startAngle + eased * (targetAngleRef.current - startAngle);
      drawWheel();
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        angleRef.current = targetAngleRef.current;
        drawWheel();
        setSpinning(false);
        setResult(PRIZES[targetPrizeIdxRef.current]);
      }
    }
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [spinning, drawWheel]);

  const handleSpin = useCallback(async () => {
    if (spinning || processing) return;
    if (!canSpin && !freeSpin) return;

    // Server-verify spin count before allowing (prevents client state drift)
    if (!DEV_BYPASS && !freeSpin) {
      const check = await fetch("/api/game/win", {
        headers: { "x-telegram-init-data": getTelegramInitData() },
      })
        .then((r) => r.json())
        .catch(() => null);
      const serverCanSpin = check?.data?.canSpin ?? check?.canSpin ?? false;
      if (!serverCanSpin) {
        setCanSpin(false);
        setSpinsRemaining(0);
        return;
      }
    }

    winSentRef.current = false;
    setResult(null);
    setWinCode(null);
    setAutoSent(false);
    setAutoSentTxHash(null);
    setFreeSpin(false);

    const idx = pickPrize();
    targetPrizeIdxRef.current = idx;
    const fullRotations = (5 + Math.floor(Math.random() * 4)) * Math.PI * 2;
    // Place winning segment centre under the pointer (top = -π/2 in canvas coords)
    const targetOffset = -(idx * segAngle + segAngle / 2) - Math.PI / 2;
    targetAngleRef.current =
      angleRef.current +
      fullRotations +
      targetOffset -
      (angleRef.current % (Math.PI * 2));
    setSpinning(true);
    haptic.medium();
  }, [canSpin, spinning, processing, freeSpin, segAngle]);

  // result effects
  useEffect(() => {
    if (!result) return;
    if (winSentRef.current) return;
    winSentRef.current = true;
    setClaimed(false); // reset claim button for new win

    if (result.label === "Free Spin") {
      // Free Spin — doesn't consume a spin, no POST, just auto-spin
      haptic.success();
      // Reset ref BEFORE clearing result so next spin's result effect runs correctly
      setTimeout(() => {
        winSentRef.current = false;
        setFreeSpin(true);
        setResult(null);
      }, 2200);
      return;
    }

    // All other prizes: POST to server (consumes spin, records win, handles +2 Spins increment)
    const isAsset = isAssetPrize(result);
    let code: string | undefined;
    if (isAsset) {
      const tag = `${result.amount}${getAssetSymbol(result)}`;
      code = `SPIN-${tag}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      setWinCode(code);
    }

    if (isAsset || result.label === "+2 Spins") {
      haptic.success();
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
    } else {
      haptic.warning();
    }

    setProcessing(true);
    setAutoSent(false);
    setAutoSentTxHash(null);
    fetch("/api/game/win", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-init-data": getTelegramInitData(),
      },
      body: JSON.stringify({
        prize: result.label,
        amount: result.amount ?? null,
        code,
        wallet: stellarAddress,
      }),
      keepalive: true,
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.autoSent) {
          setAutoSent(true);
          setAutoSentTxHash(j.data.txHash ?? null);
        }
      })
      .catch(() => null)
      .finally(async () => {
        // Refresh server state after spin is fully recorded; update local display
        await onSpinComplete((can, remaining, bonus) => {
          setCanSpin(can);
          setSpinsRemaining(remaining);
          setBonusSpinsLeft(bonus);
        });
        setProcessing(false);
      });
  }, [result, stellarAddress, onSpinComplete]);

  const isWin =
    result &&
    result.label !== "Free Spin" &&
    (isAssetPrize(result) || result.label === "+2 Spins");

  const [claimed, setClaimed] = useState(false);
  const [claimSending, setClaimSending] = useState(false);
  const [autoSent, setAutoSent] = useState(false);
  const [autoSentTxHash, setAutoSentTxHash] = useState<string | null>(null);
  const handleClaimViaBot = useCallback(async () => {
    if (!winCode || claimed || claimSending) return;
    setClaimSending(true);
    try {
      await fetch("/api/game/notify-trustlines", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": getTelegramInitData(),
        },
        body: JSON.stringify({ prize: result?.label, winCode }),
      });
    } catch {
      /* ignore — fallback to deep link */
    }
    setClaimed(true);
    setClaimSending(false);
  }, [winCode, claimed, claimSending, result]);

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-y-auto"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.08) 0%, #0A0E1A 60%)",
      }}
    >
      <style>{`
        @keyframes result-pop {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes spin-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>

      {/* header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-2 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-white/20 active:scale-95 transition"
          style={{
            backdropFilter: "blur(12px)",
            background: "rgba(255,255,255,0.07)",
          }}
        >
          <span className="material-symbols-outlined text-white text-base">
            arrow_back
          </span>
          <span className="text-white text-xs font-semibold">Hub</span>
        </button>
        <div className="text-center">
          <p
            className="text-[#D4AF37] font-bold text-xl tracking-wide"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Lucky Draw
          </p>
          <p className="text-white/40 text-[10px] mt-0.5">
            {!spinStatusLoaded
              ? "⏳ Checking…"
              : freeSpin
                ? "🔄 Free spin ready!"
                : usingBonus
                  ? `🎁 ${bonusSpinsLeft} bonus spin${bonusSpinsLeft !== 1 ? "s" : ""} available`
                  : canSpin
                    ? `${spinsRemaining} spin${spinsRemaining !== 1 ? "s" : ""} remaining today`
                    : "⏳ No spins left — resets at midnight UTC"}
          </p>
        </div>
        <div className="w-16" />
      </div>

      {/* recent winners ticker */}
      {recentWins.length > 0 && (
        <div className="px-4 mb-1 flex-shrink-0">
          <div
            className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-[#D4AF37]/20"
            style={{ background: "rgba(212,175,55,0.06)" }}
          >
            <span className="text-[9px] text-[#D4AF37] font-bold whitespace-nowrap">
              🏆 LATEST WIN
            </span>
            <p className="text-[9px] text-gray-400 truncate flex-1">
              {recentWins[0].prize} ·{" "}
              {new Date(recentWins[0].created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}

      {/* wheel */}
      <div
        ref={wrapRef}
        className="flex items-center justify-center px-1 py-2 relative"
      >
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 320,
            height: 320,
            background:
              "radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)",
            filter: "blur(24px)",
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            touchAction: "none",
            display: "block",
            position: "relative",
            zIndex: 1,
          }}
        />
      </div>

      {/* confetti */}
      {showConfetti && (
        <div
          className="fixed inset-0 pointer-events-none overflow-hidden"
          style={{ zIndex: 100 }}
        >
          {[...Array(10)].map((_, i) => {
            const colors = [
              "#D4AF37",
              "#f0d060",
              "#4ade80",
              "#60a5fa",
              "#f472b6",
              "#a78bfa",
              "#fb923c",
              "#34d399",
            ];
            const color = colors[i % colors.length];
            const left = 5 + i * 9.5;
            const size = 8 + (i % 3) * 4;
            const delay = (i * 0.18).toFixed(2);
            const duration = (1.8 + (i % 4) * 0.25).toFixed(2);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  top: 0,
                  width: size,
                  height: size,
                  borderRadius: i % 2 === 0 ? "50%" : "2px",
                  background: color,
                  animation: `confetti-fall ${duration}s ease-in ${delay}s both`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* result banner */}
      {result && result.label !== "Try Again" && (
        <div
          className="px-4 mb-2 flex-shrink-0"
          style={{
            animation: "result-pop 0.3s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          <div
            className={`rounded-3xl px-5 py-4 border text-center ${isWin ? "border-[#D4AF37]/60" : "border-white/10"}`}
            style={{
              background: isWin
                ? "rgba(212,175,55,0.12)"
                : "rgba(255,255,255,0.03)",
              boxShadow: isWin ? "0 0 32px rgba(212,175,55,0.2)" : "none",
            }}
          >
            <p className="text-4xl mb-1">{result.emoji}</p>
            <p
              className={`text-lg font-bold ${isWin ? "text-[#D4AF37]" : "text-gray-400"}`}
            >
              {result.label}
            </p>
            {result.label === "Free Spin" && (
              <p className="text-xs text-[#D4AF37]/70 mt-1">
                Bonus spin — doesn&apos;t count against your daily limit!
              </p>
            )}
            {result.label === "+2 Spins" && (
              <p className="text-xs text-green-400/80 mt-1">
                Added to your spin balance 🎱
              </p>
            )}
            {isAssetPrize(result) && (
              <div className="mt-3 space-y-3 text-left">
                {winCode && (
                  <div
                    className="px-3 py-2 rounded-xl border border-[#D4AF37]/40 text-[11px] text-[#D4AF37] font-mono font-bold tracking-widest text-center"
                    style={{ background: "rgba(212,175,55,0.08)" }}
                  >
                    {winCode}
                  </div>
                )}

                {/* Auto-sent: show tx confirmation */}
                {autoSent ? (
                  <div
                    className="rounded-xl border border-green-500/30 px-4 py-3 text-center space-y-1"
                    style={{ background: "rgba(74,222,128,0.06)" }}
                  >
                    <p className="text-sm font-bold text-green-400">
                      ✅ Prize sent to your wallet!
                    </p>
                    <p className="text-[10px] text-gray-500">
                      Check your Stellar wallet — the {getAssetSymbol(result)}{" "}
                      is on its way.
                    </p>
                    {autoSentTxHash && (
                      <p className="text-[9px] text-gray-600 font-mono break-all">
                        {autoSentTxHash}
                      </p>
                    )}
                  </div>
                ) : processing ? (
                  <div
                    className="rounded-xl border border-white/10 px-4 py-3 text-center"
                    style={{ background: "rgba(255,255,255,0.03)" }}
                  >
                    <p className="text-xs text-gray-400">
                      ⏳ Sending prize to your wallet…
                    </p>
                  </div>
                ) : (
                  /* Auto-send failed (e.g. no trustline) — show trustline checker + bot fallback */
                  <>
                    {stellarAddress && (
                      <TrustlineChecker
                        stellarAddress={stellarAddress}
                        requiredCodes={["wXLM", "wNSAFL", "wXRP", "wUSDC"]}
                      />
                    )}
                    <button
                      onClick={handleClaimViaBot}
                      disabled={claimed || claimSending}
                      className="w-full py-2.5 rounded-xl text-sm font-bold text-black active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5"
                      style={{
                        background:
                          "linear-gradient(135deg, #D4AF37 0%, #f0d060 100%)",
                      }}
                    >
                      {claimSending ? (
                        <>
                          <span className="material-symbols-outlined text-sm leading-none animate-spin">
                            progress_activity
                          </span>
                          <span>Sending…</span>
                        </>
                      ) : claimed ? (
                        <span>✅ Instructions sent — check Telegram</span>
                      ) : (
                        <span>🤖 Send Claim Instructions via Bot</span>
                      )}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* spin button */}
      <div className="px-4 pb-8 flex-shrink-0 space-y-2">
        {canSpin || freeSpin ? (
          <button
            onClick={handleSpin}
            disabled={spinning || processing || !spinStatusLoaded}
            className="w-full py-4 rounded-2xl text-base font-bold text-black active:scale-95 transition disabled:opacity-50"
            style={{
              background: spinning
                ? "#a08020"
                : "linear-gradient(135deg, #D4AF37 0%, #f0d060 50%, #D4AF37 100%)",
              boxShadow: spinning ? "none" : "0 4px 24px rgba(212,175,55,0.4)",
            }}
          >
            <span
              style={
                spinning
                  ? {
                      animation: "spin-pulse 1s ease-in-out infinite",
                      display: "inline-block",
                    }
                  : {}
              }
            >
              {spinning
                ? "⏳ Spinning..."
                : processing
                  ? "⏳ Saving..."
                  : freeSpin
                    ? "🔄 Free Spin!"
                    : "🎰 Spin the Wheel"}
            </span>
          </button>
        ) : (
          <>
            <div
              className="w-full py-3 rounded-2xl border border-white/10 text-center text-xs text-gray-500"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              {dailySpinLimit > 0
                ? `⏳ Daily spins used up — resets midnight UTC`
                : `🎯 Get Tier 1 (100 ${PRIMARY_CUSTOM_ASSET_CODE}) for 3 daily spins`}
            </div>
            <button
              onClick={onBack}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-gray-300 border border-white/10 active:scale-95 transition"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              Back to Hub
            </button>
          </>
        )}
        <p className="text-center text-[10px] text-gray-700">
          {tierLabel} ·{" "}
          {dailySpinLimit > 0
            ? `${dailySpinLimit} daily spins`
            : "3 welcome spins (once)"}
        </p>
      </div>
    </div>
  );
}

// ── Hub View ──────────────────────────────────────────────────────────────────
function HubView({
  onLucky,
  onSlot,
  onScratch,
  onQuiz,
  quizPoints,
  luckyCanSpin,
  luckySpinsRemaining,
  luckyDailyLimit,
  luckyBonusSpins,
  slotCanSpin,
  slotSpinsRemaining,
  scratchCanPlay,
  scratchCardsRemaining,
  tierLabel,
  isTier0,
}: {
  onLucky: () => void;
  onSlot: () => void;
  onScratch: () => void;
  onQuiz: () => void;
  quizPoints: number;
  luckyCanSpin: boolean;
  luckySpinsRemaining: number;
  luckyDailyLimit: number;
  luckyBonusSpins: number;
  slotCanSpin: boolean;
  slotSpinsRemaining: number;
  scratchCanPlay: boolean;
  scratchCardsRemaining: number;
  tierLabel: string;
  isTier0: boolean;
}) {
  const router = useRouter();
  const luckyUnlocked = DEV_BYPASS || luckyCanSpin || luckyBonusSpins > 0;
  const luckyLockedBySpins = !luckyCanSpin && luckyBonusSpins === 0;

  // Countdown to midnight UTC
  const [resetCountdown, setResetCountdown] = useState("");
  useEffect(() => {
    function tick() {
      const now = new Date();
      const midnight = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
      );
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setResetCountdown(
        `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`,
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0E1A] pb-28">
      <div
        className="sticky top-0 z-40 px-4 pt-3 pb-2 border-b border-white/5"
        style={{
          background: "rgba(10,14,26,0.95)",
          backdropFilter: "blur(20px)",
        }}
      >
        <h1
          className="text-xl font-bold text-white"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          Game Hub
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Upgrade your tier for more daily spins
        </p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Spins card */}
        <div
          className="rounded-2xl p-4 border border-[#D4AF37]/30"
          style={{
            background: "rgba(212,175,55,0.06)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-[#D4AF37]/70 uppercase tracking-widest font-semibold mb-1">
                Your Spins
              </p>
              <div className="flex items-baseline space-x-2">
                <span
                  className="text-5xl font-bold text-[#D4AF37]"
                  style={{ fontFamily: "Playfair Display, serif" }}
                >
                  {isTier0 ? luckyBonusSpins : luckyDailyLimit}
                </span>
                <span className="text-xl">🎰</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                {isTier0
                  ? "Welcome spins (one-time gift)"
                  : `${luckyDailyLimit} spins per day`}
              </p>
              {!isTier0 && resetCountdown && (
                <p className="text-[10px] text-gray-600 mt-0.5">
                  Resets in{" "}
                  <span className="font-mono text-gray-400">
                    {resetCountdown}
                  </span>
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider">
                Tier
              </p>
              <p className="text-sm font-bold text-white">{tierLabel}</p>
            </div>
          </div>

          {isTier0 ? (
            <div className="rounded-xl bg-[#D4AF37]/8 border border-[#D4AF37]/20 p-3 mb-3">
              <p className="text-xs font-semibold text-[#D4AF37] mb-0.5">
                🚀 Upgrade to Tier 1
              </p>
              <p className="text-[10px] text-gray-400">
                Hold 100 {PRIMARY_CUSTOM_ASSET_CODE} → unlock 3 spins every day
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-white/3 border border-white/8 p-3 mb-3">
              <p className="text-xs font-semibold text-white mb-0.5">
                ⬆️ Double your spins
              </p>
              <p className="text-[10px] text-gray-400">
                Higher tiers unlock more daily spins
              </p>
            </div>
          )}

          <button
            onClick={() => {
              haptic.light();
              router.push("/buy");
            }}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-black bg-[#D4AF37] active:scale-95 transition"
          >
            Buy {PRIMARY_CUSTOM_ASSET_LABEL} → More Spins
          </button>
        </div>

        {/* ── WhipLash347 sponsor tile ── */}
        <div
          className="rounded-2xl overflow-hidden relative flex items-center gap-3 px-4 py-3"
          style={{ background: 'linear-gradient(90deg, rgba(232,25,44,0.10) 0%, rgba(0,212,255,0.05) 100%)', border: '1px solid rgba(232,25,44,0.30)' }}
        >
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #E8192C, #00D4FF, transparent)' }} />
          <img src="/whiplash347.png" alt="WhipLash347" width={36} height={36} className="rounded-full object-cover shrink-0" style={{ boxShadow: '0 0 10px rgba(232,25,44,0.60)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#E8192C' }}>⚡ Games Sponsored by</p>
            <p className="text-sm font-bold text-white leading-tight">WhipLash347</p>
          </div>
          <span className="text-[9px] text-gray-500 shrink-0">Official Partner</span>
        </div>

        {/* ── Lucky Draw card ── */}
        <div
          className={`rounded-2xl border overflow-hidden ${
            luckyUnlocked ? "border-[#D4AF37]/40" : "border-white/10"
          }`}
          style={{
            background: luckyUnlocked
              ? "rgba(212,175,55,0.07)"
              : "rgba(255,255,255,0.03)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <span
                  className={`material-symbols-outlined text-2xl ${luckyUnlocked ? "text-[#D4AF37]" : "text-gray-500"}`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  casino
                </span>
                <p
                  className={`text-base font-bold ${luckyUnlocked ? "text-white" : "text-gray-400"}`}
                >
                  Lucky Draw
                </p>
              </div>
              {luckyUnlocked ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30">
                  {luckySpinsRemaining} spin
                  {luckySpinsRemaining !== 1 ? "s" : ""} left
                </span>
              ) : luckyLockedBySpins ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-white/10 font-mono">
                  {isTier0 ? "used up" : resetCountdown}
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-white/10">
                  🔒 Locked
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 ml-8">
              Win wXLM, wNSAFL, wXRP, wUSDC — or bonus spins 🎰
            </p>
          </div>

          {luckyUnlocked && (
            <div className="px-4 pb-4">
              <button
                onClick={() => {
                  haptic.medium();
                  onLucky();
                }}
                className="w-full py-3 rounded-xl text-sm font-bold text-black active:scale-95 transition"
                style={{
                  background:
                    "linear-gradient(135deg, #D4AF37 0%, #f0d060 50%, #D4AF37 100%)",
                }}
              >
                🎰 Spin the Wheel
              </button>
            </div>
          )}

          {luckyLockedBySpins && (
            <div className="px-4 pb-4">
              <div className="rounded-xl bg-white/4 border border-white/8 p-3">
                {isTier0 ? (
                  <>
                    <p className="text-xs text-gray-300 font-semibold mb-1">
                      Welcome spins used up 🎯
                    </p>
                    <p className="text-[11px] text-gray-500 mb-2">
                      Get Tier 1 to unlock 3 spins every day
                    </p>
                    <button
                      onClick={() => {
                        haptic.light();
                        router.push("/buy");
                      }}
                      className="w-full py-2 rounded-lg text-[11px] font-bold text-black bg-[#D4AF37] active:scale-95 transition"
                    >
                      Buy {PRIMARY_CUSTOM_ASSET_LABEL} →
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-400">
                      All spins used for today.
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Resets in{" "}
                      <span className="font-mono text-gray-300">
                        {resetCountdown}
                      </span>
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Slot Machine card ── */}
        {(() => {
          const slotUnlocked = DEV_BYPASS || slotCanSpin;
          const slotLocked = !slotCanSpin;
          return (
            <div
              className={`rounded-2xl border overflow-hidden ${
                slotUnlocked ? "border-purple-500/40" : "border-white/10"
              }`}
              style={{
                background: slotUnlocked
                  ? "rgba(168,85,247,0.06)"
                  : "rgba(255,255,255,0.03)",
                backdropFilter: "blur(12px)",
              }}
            >
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`material-symbols-outlined text-2xl ${slotUnlocked ? "text-purple-400" : "text-gray-500"}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      smart_toy
                    </span>
                    <p
                      className={`text-base font-bold ${slotUnlocked ? "text-white" : "text-gray-400"}`}
                    >
                      Slot Machine
                    </p>
                  </div>
                  {slotUnlocked ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {slotSpinsRemaining} spin
                      {slotSpinsRemaining !== 1 ? "s" : ""} left
                    </span>
                  ) : slotLocked ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-white/10">
                      {isTier0 ? "used up" : resetCountdown}
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-gray-500 ml-8">
                  Match 3 reels — win wXLM, wNSAFL, wXRP, wUSDC 🎰
                </p>
              </div>

              {slotUnlocked && (
                <div className="px-4 pb-4">
                  <button
                    onClick={() => {
                      haptic.medium();
                      onSlot();
                    }}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white active:scale-95 transition"
                    style={{
                      background:
                        "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #7c3aed 100%)",
                    }}
                  >
                    🎰 Pull the Lever
                  </button>
                </div>
              )}

              {slotLocked && (
                <div className="px-4 pb-4">
                  <div className="rounded-xl bg-white/4 border border-white/8 p-3">
                    {isTier0 ? (
                      <>
                        <p className="text-xs text-gray-300 font-semibold mb-1">
                          Welcome spins used up 🎯
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Get Tier 1 for 3 daily slot spins
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-gray-400">
                          All spins used for today.
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Resets in{" "}
                          <span className="font-mono text-gray-300">
                            {resetCountdown}
                          </span>
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Scratch Card card ── */}
        {(() => {
          const scratchUnlocked = DEV_BYPASS || scratchCanPlay;
          const scratchLocked = !scratchCanPlay;
          return (
            <div
              className={`rounded-2xl border overflow-hidden ${
                scratchUnlocked ? "border-emerald-500/40" : "border-white/10"
              }`}
              style={{
                background: scratchUnlocked
                  ? "rgba(16,185,129,0.06)"
                  : "rgba(255,255,255,0.03)",
                backdropFilter: "blur(12px)",
              }}
            >
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`material-symbols-outlined text-2xl ${scratchUnlocked ? "text-emerald-400" : "text-gray-500"}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      playing_cards
                    </span>
                    <p
                      className={`text-base font-bold ${scratchUnlocked ? "text-white" : "text-gray-400"}`}
                    >
                      Scratch Card
                    </p>
                  </div>
                  {scratchUnlocked ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {scratchCardsRemaining} card
                      {scratchCardsRemaining !== 1 ? "s" : ""} left
                    </span>
                  ) : scratchLocked ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-white/10">
                      {isTier0 ? "used up" : resetCountdown}
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-gray-500 ml-8">
                  Scratch 3×3 grid — match 3 to win prizes 🃏
                </p>
              </div>

              {scratchUnlocked && (
                <div className="px-4 pb-4">
                  <button
                    onClick={() => {
                      haptic.medium();
                      onScratch();
                    }}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white active:scale-95 transition"
                    style={{
                      background:
                        "linear-gradient(135deg, #059669 0%, #10b981 50%, #059669 100%)",
                    }}
                  >
                    🃏 Scratch a Card
                  </button>
                </div>
              )}

              {scratchLocked && (
                <div className="px-4 pb-4">
                  <div className="rounded-xl bg-white/4 border border-white/8 p-3">
                    {isTier0 ? (
                      <>
                        <p className="text-xs text-gray-300 font-semibold mb-1">
                          Welcome card used up 🃏
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Get Tier 1 for 1 daily scratch card
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-gray-400">
                          Card used for today.
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Resets in{" "}
                          <span className="font-mono text-gray-300">
                            {resetCountdown}
                          </span>
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Quiz card */}
        <div
          onClick={onQuiz}
          className="glass-card rounded-2xl p-5 cursor-pointer hover:bg-white/5 active:scale-[0.98] transition border border-purple-500/20"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-purple-400 text-xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  quiz
                </span>
              </div>
              <div>
                <p className="text-base font-bold text-white">AFL/WAFL Quiz</p>
                <p className="text-xs text-gray-400">
                  Test your footy knowledge
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-gray-500">
              chevron_right
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Quick", q: "5 Q", color: "text-blue-300" },
              { label: "Standard", q: "10 Q", color: "text-[#D4AF37]" },
              { label: "Champion", q: "20 Q", color: "text-purple-400" },
            ].map(({ label, q, color }) => (
              <div
                key={label}
                className="bg-white/3 rounded-lg py-1.5 text-center border border-white/8"
              >
                <p className={`text-xs font-bold ${color}`}>{label}</p>
                <p className="text-[9px] text-gray-500">{q}</p>
              </div>
            ))}
          </div>
          {quizPoints > 0 && (
            <p className="text-[10px] text-purple-400 mt-2 text-center">
              +{quizPoints} quiz points earned
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GamePage() {
  const router = useRouter();
  const [view, setView] = useState<GameView>("hub");

  const tokenBalance = useWalletStore((s) => s.tokenBalance);
  const stellarAddress = useWalletStore((s) => s.stellarAddress);
  const setBalances = useWalletStore((s) => s.setBalances);

  // Re-verify balance on mount and bfcache restore
  useEffect(() => {
    if (stellarAddress) {
      fetch(`/api/stellar/balance?address=${stellarAddress}`)
        .then((r) => r.json())
        .then((j) => {
          if (j.success) setBalances(j.data.token, j.data.xlm);
        })
        .catch(() => null);
    }
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && stellarAddress) {
        fetch(`/api/stellar/balance?address=${stellarAddress}`)
          .then((r) => r.json())
          .then((j) => {
            if (j.success) setBalances(j.data.token, j.data.xlm);
          })
          .catch(() => null);
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [stellarAddress, setBalances]);

  const balance = parseFloat(tokenBalance) || 0;
  const currentTier = getTierForBalance(balance);
  const tierLabel = currentTier.label;
  const isTier0 = currentTier.id === "pre-tier";

  // ── Lucky Draw spin status ─────────────────────────────────────────────────
  const [luckyKey, setLuckyKey] = useState(0);
  const [luckyStatusReady, setLuckyStatusReady] = useState(DEV_BYPASS); // true once first fetch done
  const [luckyCanSpin, setLuckyCanSpin] = useState(DEV_BYPASS);
  const [luckySpinsRemaining, setLuckySpinsRemaining] = useState(
    DEV_BYPASS ? 99 : 0,
  );
  const [luckyDailyLimit, setLuckyDailyLimit] = useState(DEV_BYPASS ? 99 : 0);
  const [luckyBonusSpins, setLuckyBonusSpins] = useState(0);

  // Returns fresh spin values so callers can act on them immediately (avoids stale closure)
  const fetchSpinStatus = useCallback((): Promise<{
    canSpin: boolean;
    spinsRemaining: number;
    bonusSpins: number;
  } | null> => {
    if (DEV_BYPASS) return Promise.resolve(null);
    return fetch("/api/game/win", {
      headers: { "x-telegram-init-data": getTelegramInitData() },
    })
      .then((r) => r.json())
      .then((j) => {
        const d = j.data ?? j;
        const canSpin = d.canSpin ?? false;
        const spinsRemaining = d.spinsRemaining ?? 0;
        const bonusSpins = d.bonusSpins ?? 0;
        setLuckyCanSpin(canSpin);
        setLuckySpinsRemaining(spinsRemaining);
        setLuckyDailyLimit(d.dailyLimit ?? 0);
        setLuckyBonusSpins(bonusSpins);
        setLuckyStatusReady(true);
        return { canSpin, spinsRemaining, bonusSpins };
      })
      .catch(() => {
        setLuckyCanSpin(false);
        setLuckyStatusReady(true);
        return null;
      });
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchSpinStatus();
  }, [fetchSpinStatus]);

  // Enter Lucky Draw: fetch fresh data FIRST, then switch view — never mount with stale state
  const handleEnterLucky = useCallback(async () => {
    setLuckyStatusReady(false);
    await fetchSpinStatus();
    setLuckyKey((k) => k + 1);
    setView("lucky");
  }, [fetchSpinStatus]);

  // ── Slot Machine spin status ───────────────────────────────────────────────
  const [slotKey, setSlotKey] = useState(0);
  const [slotStatusReady, setSlotStatusReady] = useState(DEV_BYPASS);
  const [slotCanSpin, setSlotCanSpin] = useState(DEV_BYPASS);
  const [slotSpinsRemaining, setSlotSpinsRemaining] = useState(
    DEV_BYPASS ? 99 : 0,
  );
  const [slotDailyLimit, setSlotDailyLimit] = useState(DEV_BYPASS ? 99 : 0);
  const [slotBonusSpins, setSlotBonusSpins] = useState(0);

  const fetchSlotStatus = useCallback((): Promise<{
    canSpin: boolean;
    spinsRemaining: number;
    bonusSpins: number;
  } | null> => {
    if (DEV_BYPASS) return Promise.resolve(null);
    return fetch("/api/game/slot", {
      headers: { "x-telegram-init-data": getTelegramInitData() },
    })
      .then((r) => r.json())
      .then((j) => {
        const d = j.data ?? j;
        const canSpin = d.canSpin ?? false;
        const spinsRemaining = d.spinsRemaining ?? 0;
        const bonusSpins = d.bonusSpins ?? 0;
        setSlotCanSpin(canSpin);
        setSlotSpinsRemaining(spinsRemaining);
        setSlotDailyLimit(d.dailyLimit ?? 0);
        setSlotBonusSpins(bonusSpins);
        setSlotStatusReady(true);
        return { canSpin, spinsRemaining, bonusSpins };
      })
      .catch(() => {
        setSlotCanSpin(false);
        setSlotStatusReady(true);
        return null;
      });
  }, []);

  useEffect(() => {
    fetchSlotStatus();
  }, [fetchSlotStatus]);

  const handleEnterSlot = useCallback(async () => {
    if (!DEV_BYPASS) {
      setSlotStatusReady(false);
      await fetchSlotStatus();
    }
    setSlotKey((k) => k + 1);
    setView("slot");
  }, [fetchSlotStatus]);

  const handleSlotSpinComplete = useCallback(
    async (
      onFresh: (can: boolean, remaining: number, bonus: number) => void,
    ) => {
      const fresh = await fetchSlotStatus();
      if (fresh) onFresh(fresh.canSpin, fresh.spinsRemaining, fresh.bonusSpins);
    },
    [fetchSlotStatus],
  );

  // ── Scratch Card state ─────────────────────────────────────────────────────
  const [scratchKey, setScratchKey] = useState(0);
  const [scratchStatusReady, setScratchStatusReady] = useState(DEV_BYPASS);
  const [scratchCanPlay, setScratchCanPlay] = useState(DEV_BYPASS);
  const [scratchCardsRemaining, setScratchCardsRemaining] = useState(
    DEV_BYPASS ? 99 : 0,
  );
  const [scratchDailyLimit, setScratchDailyLimit] = useState(
    DEV_BYPASS ? 99 : 0,
  );
  const [scratchBonusCards, setScratchBonusCards] = useState(0);

  const fetchScratchStatus = useCallback((): Promise<{
    canScratch: boolean;
    cardsRemaining: number;
    bonusCards: number;
  } | null> => {
    if (DEV_BYPASS) return Promise.resolve(null);
    return fetch("/api/game/scratch", {
      headers: { "x-telegram-init-data": getTelegramInitData() },
    })
      .then((r) => r.json())
      .then((j) => {
        const d = j.data ?? j;
        const canScratch = d.canScratch ?? false;
        const cardsRemaining = d.cardsRemaining ?? 0;
        const bonusCards = d.bonusCards ?? 0;
        setScratchCanPlay(canScratch);
        setScratchCardsRemaining(cardsRemaining);
        setScratchDailyLimit(d.dailyLimit ?? 0);
        setScratchBonusCards(bonusCards);
        setScratchStatusReady(true);
        return { canScratch, cardsRemaining, bonusCards };
      })
      .catch(() => {
        setScratchCanPlay(false);
        setScratchStatusReady(true);
        return null;
      });
  }, []);

  useEffect(() => {
    fetchScratchStatus();
  }, [fetchScratchStatus]);

  const handleEnterScratch = useCallback(async () => {
    if (!DEV_BYPASS) {
      setScratchStatusReady(false);
      await fetchScratchStatus();
    }
    setScratchKey((k) => k + 1);
    setView("scratch");
  }, [fetchScratchStatus]);

  const handleScratchComplete = useCallback(
    async (
      onFresh: (can: boolean, remaining: number, bonus: number) => void,
    ) => {
      const fresh = await fetchScratchStatus();
      if (fresh)
        onFresh(fresh.canScratch, fresh.cardsRemaining, fresh.bonusCards);
    },
    [fetchScratchStatus],
  );

  const handleBackFromScratch = useCallback(() => {
    fetchScratchStatus();
    setScratchStatusReady(false);
    setView("hub");
  }, [fetchScratchStatus]);

  // ── Quiz state ─────────────────────────────────────────────────────────────
  const [quizMode, setQuizMode] = useState<QuizMode | null>(null);
  const [quizSessionId, setQuizSessionId] = useState<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [quizResult, setQuizResult] = useState<any>(null);
  const [playsLeft, setPlaysLeft] = useState<Record<string, number>>({
    quick: 3,
    standard: 3,
    champion: 3,
  });
  const [quizPoints, setQuizPoints] = useState(0);

  useEffect(() => {
    fetch("/api/quiz/status", {
      headers: { "x-telegram-init-data": getTelegramInitData() },
    })
      .then((r) => r.json())
      .then((j) => {
        const d = j.data ?? j;
        if (d.playsLeft) setPlaysLeft(d.playsLeft);
        if (d.quizPoints !== undefined) setQuizPoints(d.quizPoints);
      })
      .catch(() => {});
  }, []);

  const handleSpinComplete = useCallback(
    async (
      onFresh: (can: boolean, remaining: number, bonus: number) => void,
    ) => {
      const fresh = await fetchSpinStatus();
      if (fresh) onFresh(fresh.canSpin, fresh.spinsRemaining, fresh.bonusSpins);
    },
    [fetchSpinStatus],
  );

  const startQuiz = async (mode: QuizMode) => {
    haptic.light();
    try {
      const res = await fetch(`/api/quiz/session?mode=${mode.id}`, {
        headers: { "x-telegram-init-data": getTelegramInitData() },
      });
      const json = await res.json();
      const data = json.data ?? json;
      if (!res.ok) {
        alert(data.error ?? "Could not start quiz");
        return;
      }
      setQuizMode(mode);
      setQuizSessionId(data.sessionId);
      setQuizQuestions(data.questions);
      setPlaysLeft((prev) => ({
        ...prev,
        [mode.id]: data.playsRemainingToday,
      }));
      setView("quiz");
    } catch {
      alert("Network error — please try again");
    }
  };

  useTelegramBack(
    useCallback(() => {
      if (view === "quiz") setView("quiz-pick");
      else if (view === "quiz-pick" || view === "quiz-result") setView("hub");
      else if (view === "slot") {
        fetchSlotStatus();
        setSlotStatusReady(false);
        setView("hub");
      } else if (view === "scratch") {
        fetchScratchStatus();
        setScratchStatusReady(false);
        setView("hub");
      } else if (view !== "hub") setView("hub");
      else router.back();
    }, [view, router, fetchSlotStatus, fetchScratchStatus]),
  );

  const handleBackFromSlot = useCallback(() => {
    fetchSlotStatus();
    setSlotStatusReady(false);
    setView("hub");
  }, [fetchSlotStatus]);

  return (
    <WalletGuard>
      {view === "scratch" ? (
        !scratchStatusReady ? (
          <div className="fixed inset-0 bg-[#0A0E1A] flex items-center justify-center">
            <span className="material-symbols-outlined text-[#D4AF37] text-4xl animate-spin">
              progress_activity
            </span>
          </div>
        ) : (
          <ScratchCard
            key={scratchKey}
            onBack={handleBackFromScratch}
            stellarAddress={stellarAddress}
            onCardComplete={handleScratchComplete}
            initialCanScratch={scratchCanPlay}
            initialCardsRemaining={scratchCardsRemaining}
            initialDailyLimit={scratchDailyLimit}
            initialBonusCards={scratchBonusCards}
            tierLabel={tierLabel}
          />
        )
      ) : view === "slot" ? (
        !slotStatusReady ? (
          <div className="fixed inset-0 bg-[#0A0E1A] flex items-center justify-center">
            <span className="material-symbols-outlined text-[#D4AF37] text-4xl animate-spin">
              progress_activity
            </span>
          </div>
        ) : (
          <SlotMachine
            key={slotKey}
            onBack={handleBackFromSlot}
            stellarAddress={stellarAddress}
            onSpinComplete={handleSlotSpinComplete}
            initialCanSpin={slotCanSpin}
            initialSpinsRemaining={slotSpinsRemaining}
            initialDailyLimit={slotDailyLimit}
            initialBonusSpins={slotBonusSpins}
            tierLabel={tierLabel}
          />
        )
      ) : view === "lucky" ? (
        !luckyStatusReady ? (
          <div className="fixed inset-0 bg-[#0A0E1A] flex items-center justify-center">
            <span className="material-symbols-outlined text-[#D4AF37] text-4xl animate-spin">
              progress_activity
            </span>
          </div>
        ) : (
          <LuckyDraw
            key={luckyKey}
            onBack={() => {
              fetchSpinStatus();
              setLuckyStatusReady(false);
              setView("hub");
            }}
            stellarAddress={stellarAddress}
            onSpinComplete={handleSpinComplete}
            initialCanSpin={luckyCanSpin}
            initialSpinsRemaining={luckySpinsRemaining}
            initialDailyLimit={luckyDailyLimit}
            initialBonusSpins={luckyBonusSpins}
            tierLabel={tierLabel}
          />
        )
      ) : view === "quiz-pick" ? (
        <ModePicker
          playsLeft={playsLeft}
          onSelect={startQuiz}
          onBack={() => setView("hub")}
        />
      ) : view === "quiz" && quizMode && quizSessionId ? (
        <QuizSession
          mode={quizMode}
          sessionId={quizSessionId}
          questions={quizQuestions}
          onComplete={(result) => {
            setQuizResult(result);
            setView("quiz-result");
          }}
          onBack={() => setView("hub")}
        />
      ) : view === "quiz-result" && quizResult ? (
        <ResultScreen
          result={quizResult}
          modeName={quizMode?.label ?? "Quiz"}
          onPlayAgain={() => setView("quiz-pick")}
          onBack={() => setView("hub")}
        />
      ) : (
        <>
          <HubView
            onLucky={handleEnterLucky}
            onSlot={handleEnterSlot}
            onScratch={handleEnterScratch}
            onQuiz={() => setView("quiz-pick")}
            tierLabel={tierLabel}
            isTier0={isTier0}
            quizPoints={quizPoints}
            luckyCanSpin={luckyCanSpin}
            luckySpinsRemaining={luckySpinsRemaining}
            luckyDailyLimit={luckyDailyLimit}
            luckyBonusSpins={luckyBonusSpins}
            slotCanSpin={slotCanSpin}
            slotSpinsRemaining={slotSpinsRemaining}
            scratchCanPlay={scratchCanPlay}
            scratchCardsRemaining={scratchCardsRemaining}
          />
          <BottomNav />
        </>
      )}
    </WalletGuard>
  );
}

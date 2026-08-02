'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { haptic } from '@/lib/telegram-ui'
import { getTelegramInitData, openTelegramLink, buildBotStartLink } from '@/lib/telegram'
import { BRANDING } from '@/config/branding'

// ── Constants ──────────────────────────────────────────────────────────────────
const SYM_SIZE = 64       // px per symbol cell
const STRIP_COUNT = 27    // 9 symbols × 3 repetitions per reel
const STRIP_HEIGHT = STRIP_COUNT * SYM_SIZE  // 1728px
const INIT_IDX = 13       // which symbol is centred at startup (midpoint)
const INIT_Y = (1 - INIT_IDX) * SYM_SIZE    // -768px

// ── Prize table ────────────────────────────────────────────────────────────────
interface SlotPrize {
  label: string
  symbol: string
  weight: number
  isAsset?: boolean
  isWXLM?: boolean
  isWNSAFL?: boolean
  isWXRP?: boolean
  isWUSDC?: boolean
  amount?: number
}

// Client-side reel rendering ONLY (labels/symbols) — the server (lib/gamePool.ts
// PRIZE_TABLES.slot_machine) rolls the prize and returns its index. This array's order MUST
// match PRIZE_TABLES.slot_machine exactly so `prizeIndex` from the server maps to the right prize.
export const SLOT_PRIZES: SlotPrize[] = [
  { label: '100 wXLM',    symbol: '💎', weight: 10,  isAsset: true, isWXLM: true,   amount: 100  },
  { label: '5000 wNSAFL', symbol: '🏆', weight: 15,  isAsset: true, isWNSAFL: true, amount: 5000 },
  { label: '2500 wNSAFL', symbol: '🥇', weight: 25,  isAsset: true, isWNSAFL: true, amount: 2500 },
  { label: '1000 wNSAFL', symbol: '⭐', weight: 50,  isAsset: true, isWNSAFL: true, amount: 1000 },
  { label: '50 wXRP',     symbol: '🔷', weight: 50,  isAsset: true, isWXRP: true,   amount: 50   },
  { label: '100 wUSDC',   symbol: '💵', weight: 50,  isAsset: true, isWUSDC: true,  amount: 100  },
  { label: '+2 Spins',    symbol: '🎱', weight: 50  },
  { label: 'Free Spin',   symbol: '🔄', weight: 250 },
  { label: 'Better Luck', symbol: '💨', weight: 450 },
]

const SYMBOLS = SLOT_PRIZES.map(p => p.symbol)

interface SpinResult {
  prize: string
  amount: number | null
  prizeIndex: number
  winCode: string | null
  freeSpin?: boolean
  autoSent: boolean
  txHash?: string
  paymentError?: string
  lobstrDeeplink?: string
}

function getAssetLabel(p: SlotPrize): string {
  if (p.isWXLM) return 'wXLM'
  if (p.isWNSAFL) return 'wNSAFL'
  if (p.isWXRP) return 'wXRP'
  return 'wUSDC'
}

/** Build a shuffled strip of STRIP_COUNT symbols (each of 9 symbols appearing 3×). */
function buildStrip(): string[] {
  const strip: string[] = []
  for (let r = 0; r < 3; r++) for (const s of SYMBOLS) strip.push(s)
  for (let i = strip.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [strip[i], strip[j]] = [strip[j], strip[i]]
  }
  return strip
}

/**
 * translateY so that strip[idx] is centred in the 3-symbol window.
 * Window centre = row 1 (pixels SYM_SIZE … 2*SYM_SIZE from top).
 * strip[i] top = translateY + i*SYM_SIZE.  For that to equal SYM_SIZE: Y = (1-i)*SYM_SIZE.
 */
function yForIdx(idx: number): number {
  return (1 - idx) * SYM_SIZE
}

/**
 * Return a Y that is equivalent to `desiredY` (mod STRIP_HEIGHT) but sufficiently
 * less than `currentY` so the reel travels forward by at least minRots full loops.
 */
function spinToY(currentY: number, desiredY: number, minRots = 4): number {
  const minTravel = minRots * STRIP_HEIGHT
  let k = Math.ceil((currentY - desiredY + minTravel) / STRIP_HEIGHT)
  k += Math.floor(Math.random() * 2) // add 0–1 bonus rotation for variety
  return desiredY - k * STRIP_HEIGHT
}

/** Pick a random symbol for the loss case that is different from `exclude`. */
function randomOtherSymbol(exclude: string[]): string {
  const pool = SYMBOLS.filter(s => !exclude.includes(s))
  return pool[Math.floor(Math.random() * pool.length)] ?? SYMBOLS[0]
}

// ── Reel column ────────────────────────────────────────────────────────────────
// Receives a stable ref directly — no hook-in-array issues.
function ReelColumn({ strip, stripRef }: {
  strip: string[]
  stripRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-white/15"
      style={{
        width: 84,
        height: SYM_SIZE * 3,
        background: 'rgba(10,14,26,0.85)',
        boxShadow: 'inset 0 2px 16px rgba(0,0,0,0.6)',
        flexShrink: 0,
      }}
    >
      {/* win-line tint */}
      <div className="absolute inset-x-0 pointer-events-none z-10" style={{
        top: SYM_SIZE, height: SYM_SIZE,
        background: 'rgba(212,175,55,0.07)',
        borderTop: '1px solid rgba(212,175,55,0.35)',
        borderBottom: '1px solid rgba(212,175,55,0.35)',
      }} />
      {/* top fade */}
      <div className="absolute inset-x-0 top-0 pointer-events-none z-20"
        style={{ height: SYM_SIZE * 0.8, background: 'linear-gradient(to bottom, rgba(10,14,26,0.88), transparent)' }} />
      {/* bottom fade */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none z-20"
        style={{ height: SYM_SIZE * 0.8, background: 'linear-gradient(to top, rgba(10,14,26,0.88), transparent)' }} />

      {/* symbol strip — initial transform set inline so there's zero flash before useEffect */}
      <div ref={stripRef} style={{ willChange: 'transform', transform: `translateY(${INIT_Y}px)` }}>
        {strip.map((sym, i) => (
          <div key={i} style={{ height: SYM_SIZE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 34, lineHeight: 1, userSelect: 'none' }}>{sym}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
interface Props {
  onBack: () => void
  stellarAddress: string | null
  onSpinComplete: (onFresh: (can: boolean, remaining: number, bonus: number) => void) => Promise<void>
  initialCanSpin: boolean
  initialSpinsRemaining: number
  initialDailyLimit: number
  initialBonusSpins: number
  tierLabel: string
}

export default function SlotMachine({
  onBack, onSpinComplete,
  initialCanSpin, initialSpinsRemaining, initialDailyLimit, initialBonusSpins, tierLabel,
}: Props) {
  // ── Strips (one per reel) ──────────────────────────────────────────────────
  const [strips] = useState<string[][]>(() => [buildStrip(), buildStrip(), buildStrip()])

  // ── Reel refs — proper individual useRef calls (no hook-in-array) ──────────
  const ref0 = useRef<HTMLDivElement>(null)
  const ref1 = useRef<HTMLDivElement>(null)
  const ref2 = useRef<HTMLDivElement>(null)

  // Stable container for the refs — never recreated, so closures always get the live refs
  const reelRefs = useRef([ref0, ref1, ref2])

  // Current translateY for each reel — starts at INIT_Y matching the inline style
  const pos0 = useRef(INIT_Y)
  const pos1 = useRef(INIT_Y)
  const pos2 = useRef(INIT_Y)
  const posRefs = useRef([pos0, pos1, pos2])

  // ── Game state ─────────────────────────────────────────────────────────────
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<SlotPrize | null>(null)
  const [freeSpin, setFreeSpin] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [winCode, setWinCode] = useState<string | null>(null)
  const [autoSent, setAutoSent] = useState(false)
  const [autoSentTxHash, setAutoSentTxHash] = useState<string | null>(null)
  const [claimed, setClaimed] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [spinError, setSpinError] = useState<string | null>(null)
  const winSentRef = useRef(false)
  const serverResultRef = useRef<SpinResult | null>(null)

  const [canSpin, setCanSpin] = useState(initialCanSpin)
  const [spinsRemaining, setSpinsRemaining] = useState(initialSpinsRemaining)
  const [dailySpinLimit] = useState(initialDailyLimit)
  const [bonusSpinsLeft, setBonusSpinsLeft] = useState(initialBonusSpins)
  const usingBonus = spinsRemaining === 0 && bonusSpinsLeft > 0

  const [recentWins, setRecentWins] = useState<{ prize: string; created_at: string }[]>([])
  useEffect(() => {
    fetch('/api/game/wins')
      .then(r => r.json())
      .then(j => {
        if (!j.success) return
        const wins = (j.data as { prize: string; prize_source?: string; created_at: string }[])
          .filter(w => w.prize_source === 'slot_machine')
          .slice(0, 5)
        setRecentWins(wins)
      })
      .catch(() => null)
  }, [])

  // ── Animate one reel to a target symbol ───────────────────────────────────
  // Uses reelRefs.current and posRefs.current — always stable, no closure issues
  const animateReel = useCallback((
    reelIdx: number,
    targetSymbol: string,
    duration: number,
    onStopped?: () => void,
  ) => {
    const strip = strips[reelIdx]
    const stripRef = reelRefs.current[reelIdx]
    const posRef = posRefs.current[reelIdx]
    if (!stripRef.current) return

    // Find strip positions that have the target symbol; prefer midpoint positions
    const candidates = strip.reduce<number[]>((acc, s, i) => (s === targetSymbol ? [...acc, i] : acc), [])
    const targetIdx = candidates.length
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : INIT_IDX

    const desiredY = yForIdx(targetIdx)
    const newY = spinToY(posRef.current, desiredY, 4)

    stripRef.current.style.transition = `transform ${duration}ms cubic-bezier(0.1, 0.8, 0.15, 1)`
    stripRef.current.style.transform = `translateY(${newY}px)`
    posRef.current = newY

    setTimeout(() => {
      if (stripRef.current) {
        stripRef.current.style.transition = 'none'
        stripRef.current.style.transform = `translateY(${desiredY}px)`
        posRef.current = desiredY
      }
      onStopped?.()
    }, duration + 40)
  }, [strips]) // strips is stable (useState initialiser, never changes)

  // ── Spin handler ───────────────────────────────────────────────────────────
  const handleSpin = useCallback(async () => {
    if (spinning || processing) return
    if (!canSpin && !freeSpin) return

    setSpinError(null)
    setProcessing(true)
    let data: SpinResult | null = null
    try {
      const res = await fetch('/api/game/slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!json.success) {
        setProcessing(false)
        if (json.code === 'DAILY_LIMIT' || json.code === 'RATE_LIMITED') {
          setCanSpin(false)
          setSpinsRemaining(0)
        } else {
          setSpinError(json.error ?? 'Something went wrong — try again.')
        }
        return
      }
      data = json.data
    } catch {
      setProcessing(false)
      setSpinError('Network error — try again.')
      return
    }
    setProcessing(false)
    if (!data) return

    winSentRef.current = false
    setResult(null)
    setWinCode(null)
    setAutoSent(false)
    setAutoSentTxHash(null)
    setClaimed(false)
    setFreeSpin(false)
    setSpinning(true)
    haptic.medium()
    serverResultRef.current = data

    const prize = SLOT_PRIZES[data.prizeIndex]
    const isLoss = prize.label === 'Better Luck'

    // Reel symbols: win = all 3 match; loss = near-miss (reels 0+1 match, reel 2 is off)
    const r0sym = prize.symbol
    const r1sym = prize.symbol
    let r2sym = prize.symbol
    if (isLoss) {
      // Classic near-miss: reels 0 and 1 show a random non-prize symbol, reel 2 shows something else
      const missA = randomOtherSymbol([prize.symbol])
      const missB = randomOtherSymbol([prize.symbol, missA])
      r2sym = missB // reel 2 deliberately misses
      animateReel(0, missA, 1400, () => haptic.light())
      animateReel(1, missA, 2100, () => haptic.light())
      animateReel(2, missB, 2800, () => {
        haptic.light()
        setSpinning(false)
        setResult(prize)
      })
    } else {
      animateReel(0, r0sym, 1400, () => haptic.light())
      animateReel(1, r1sym, 2100, () => haptic.light())
      animateReel(2, r2sym, 2800, () => {
        haptic.light()
        setSpinning(false)
        setResult(prize)
      })
    }
  }, [canSpin, freeSpin, spinning, processing, animateReel])

  // ── Handle result ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!result || winSentRef.current) return
    winSentRef.current = true
    setClaimed(false)

    if (result.label === 'Free Spin') {
      haptic.success()
      setTimeout(() => { winSentRef.current = false; setFreeSpin(true); setResult(null) }, 2200)
      return
    }

    // The server already rolled + recorded this win in the POST that kicked off the spin
    // (handleSpin) — read that response back out of the ref, no second request.
    const data = serverResultRef.current
    const isAsset = result.isAsset
    if (isAsset && data?.winCode) setWinCode(data.winCode)

    const isWin = isAsset || result.label === '+2 Spins'
    if (isWin) {
      haptic.success()
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 2500)
    } else {
      haptic.warning()
    }

    if (data?.autoSent) { setAutoSent(true); setAutoSentTxHash(data.txHash ?? null) }

    void onSpinComplete((can, remaining, bonus) => {
      setCanSpin(can); setSpinsRemaining(remaining); setBonusSpinsLeft(bonus)
    })
  }, [result, onSpinComplete])

  const handleClaimViaBot = useCallback(() => {
    if (!winCode || claimed) return
    setClaimed(true)
    openTelegramLink(buildBotStartLink(`claim_${winCode}`))
  }, [winCode, claimed])

  const isWin = result && result.label !== 'Free Spin' && (result.isAsset || result.label === '+2 Spins')

  return (
    <div className="fixed inset-0 flex flex-col overflow-y-auto"
      style={{ background: `radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.07) 0%, ${BRANDING.colors.background} 60%)` }}>
      <style>{`
        @keyframes result-pop { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes confetti-fall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-2 flex-shrink-0">
        <button onClick={onBack}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-white/20 active:scale-95 transition"
          style={{ backdropFilter: 'blur(12px)', background: 'rgba(255,255,255,0.07)' }}>
          <span className="material-symbols-outlined text-white text-base">arrow_back</span>
          <span className="text-white text-xs font-semibold">Hub</span>
        </button>
        <div className="text-center">
          <p className="text-primary font-bold text-xl tracking-wide" style={{ fontFamily: 'Playfair Display, serif' }}>
            Slot Machine
          </p>
          <p className="text-white/40 text-[10px] mt-0.5">
            {freeSpin ? '🔄 Free spin ready!'
              : usingBonus ? `🎁 ${bonusSpinsLeft} bonus spin${bonusSpinsLeft !== 1 ? 's' : ''} available`
              : canSpin ? `${spinsRemaining} spin${spinsRemaining !== 1 ? 's' : ''} remaining today`
              : '⏳ No spins left — resets at midnight UTC'}
          </p>
        </div>
        <div className="w-16" />
      </div>

      {/* Recent win ticker */}
      {recentWins.length > 0 && (
        <div className="px-4 mb-1 flex-shrink-0">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-primary/20"
            style={{ background: 'rgba(212,175,55,0.06)' }}>
            <span className="text-[9px] text-primary font-bold whitespace-nowrap">🎰 LATEST WIN</span>
            <p className="text-[9px] text-gray-400 truncate flex-1">
              {recentWins[0].prize} · {new Date(recentWins[0].created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}

      {/* Machine frame */}
      <div className="flex-shrink-0 flex flex-col items-center py-4 px-4">
        <div className="rounded-3xl p-5 w-full max-w-xs"
          style={{
            background: 'linear-gradient(160deg, rgba(212,175,55,0.1) 0%, rgba(10,14,26,0.97) 60%)',
            border: '1px solid rgba(212,175,55,0.28)',
            boxShadow: spinning ? '0 0 40px rgba(212,175,55,0.12)' : '0 0 20px rgba(0,0,0,0.5)',
          }}>

          {/* Reels */}
          <div className="flex items-center justify-center gap-3">
            <ReelColumn strip={strips[0]} stripRef={ref0} />
            <ReelColumn strip={strips[1]} stripRef={ref1} />
            <ReelColumn strip={strips[2]} stripRef={ref2} />
          </div>

          {/* Win line label */}
          <div className="flex items-center justify-center mt-3 space-x-2">
            <div className="h-px flex-1 bg-primary/20" />
            <span className="text-[9px] text-primary/50 font-bold tracking-widest uppercase">WIN LINE</span>
            <div className="h-px flex-1 bg-primary/20" />
          </div>
        </div>
      </div>

      {/* Confetti */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 100 }}>
          {[...Array(12)].map((_, i) => {
            const colors = [BRANDING.colors.primary, '#f0d060', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#fb923c', '#34d399']
            return (
              <div key={i} style={{
                position: 'absolute', left: `${5 + i * 8}%`, top: 0,
                width: 8 + (i % 3) * 4, height: 8 + (i % 3) * 4,
                borderRadius: i % 2 === 0 ? '50%' : '2px',
                background: colors[i % colors.length],
                animation: `confetti-fall ${(1.8 + (i % 4) * 0.25).toFixed(2)}s ease-in ${(i * 0.15).toFixed(2)}s both`,
              }} />
            )
          })}
        </div>
      )}

      {/* Result banner */}
      {result && result.label !== 'Free Spin' && (
        <div className="px-4 mb-3 flex-shrink-0" style={{ animation: 'result-pop 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <div className={`rounded-3xl px-5 py-4 border text-center ${isWin ? 'border-primary/60' : 'border-white/10'}`}
            style={{
              background: isWin ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.03)',
              boxShadow: isWin ? '0 0 32px rgba(212,175,55,0.2)' : 'none',
            }}>
            <p className="text-4xl mb-1">{result.symbol}</p>
            <p className={`text-lg font-bold ${isWin ? 'text-primary' : 'text-gray-500'}`}>{result.label}</p>

            {result.label === '+2 Spins' && (
              <p className="text-xs text-green-400/80 mt-1">Added to your spin balance 🎱</p>
            )}

            {result.isAsset && (
              <div className="mt-3 space-y-3 text-left">
                {winCode && (
                  <div className="px-3 py-2 rounded-xl border border-primary/40 text-[11px] text-primary font-mono font-bold tracking-widest text-center"
                    style={{ background: 'rgba(212,175,55,0.08)' }}>{winCode}</div>
                )}
                {autoSent ? (
                  <div className="rounded-xl border border-green-500/30 px-4 py-3 text-center space-y-1"
                    style={{ background: 'rgba(74,222,128,0.06)' }}>
                    <p className="text-sm font-bold text-green-400">✅ Prize sent to your wallet!</p>
                    <p className="text-[10px] text-gray-500">Check your Stellar wallet — {getAssetLabel(result)} is on its way.</p>
                    {autoSentTxHash && <p className="text-[9px] text-gray-600 font-mono break-all">{autoSentTxHash}</p>}
                  </div>
                ) : (
                  <button onClick={handleClaimViaBot} disabled={claimed}
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-black active:scale-95 transition disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg, ${BRANDING.colors.primary} 0%, #f0d060 100%)` }}>
                    {claimed ? '✅ Claim sent — check bot' : '🤖 Claim via Bot'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spin error */}
      {spinError && (
        <div className="px-4 mb-2 flex-shrink-0">
          <div className="rounded-2xl border border-red-500/30 px-4 py-2.5 text-center text-xs text-red-400"
            style={{ background: 'rgba(248,113,113,0.08)' }}>
            {spinError}
          </div>
        </div>
      )}

      {/* Spin button */}
      <div className="px-4 pb-8 flex-shrink-0 space-y-2">
        {canSpin || freeSpin ? (
          <button onClick={handleSpin} disabled={spinning || processing}
            className="w-full py-4 rounded-2xl text-base font-bold text-black active:scale-95 transition disabled:opacity-50"
            style={{
              background: spinning ? '#a08020' : `linear-gradient(135deg, ${BRANDING.colors.primary} 0%, #f0d060 50%, ${BRANDING.colors.primary} 100%)`,
              boxShadow: spinning ? 'none' : '0 4px 24px rgba(212,175,55,0.4)',
            }}>
            {spinning ? '🎰 Spinning...' : processing ? '🎲 Rolling...' : freeSpin ? '🔄 Free Spin!' : '🎰 Pull the Lever'}
          </button>
        ) : (
          <>
            <div className="w-full py-3 rounded-2xl border border-white/10 text-center text-xs text-gray-500"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              {dailySpinLimit > 0 ? '⏳ Daily spins used up — resets midnight UTC' : `🎯 Get Tier 1 for 3 daily spins`}
            </div>
            <button onClick={onBack}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-gray-300 border border-white/10 active:scale-95 transition"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              Back to Hub
            </button>
          </>
        )}
        <p className="text-center text-[10px] text-gray-700">
          {tierLabel} · {dailySpinLimit > 0 ? `${dailySpinLimit} daily spins` : '3 welcome spins (once)'}
        </p>
      </div>
    </div>
  )
}

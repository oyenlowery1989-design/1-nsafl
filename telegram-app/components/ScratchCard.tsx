'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { haptic } from '@/lib/telegram-ui'
import { getTelegramInitData, openTelegramLink, buildBotStartLink } from '@/lib/telegram'
import { BRANDING } from '@/config/branding'
import { GAME_PRIZE_DEFINITIONS, type GamePrizeDefinition } from '@/lib/rewardAssets'

// ── Prize table ────────────────────────────────────────────────────────────────
interface ScratchPrize extends GamePrizeDefinition {
  emoji: string
}

// Client-side grid rendering ONLY (labels/emoji) — the server (lib/gamePool.ts
// PRIZE_TABLES.scratch_card) rolls the prize and returns its index. This array's order MUST
// match PRIZE_TABLES.scratch_card exactly so `prizeIndex` from the server maps to the right prize.
export const SCRATCH_PRIZES = GAME_PRIZE_DEFINITIONS.scratch_card.map((prize, index) => ({
  ...prize,
  emoji: ['💎', '🏆', '🥇', '⭐', '🔷', '💵', '🃏', '💨'][index],
})) as ScratchPrize[]
const WIN_PRIZES = SCRATCH_PRIZES.filter(p => !p.isMiss)
const ALL_EMOJIS = SCRATCH_PRIZES.map(p => p.emoji)

interface ScratchResult {
  prize: string
  amount: number | null
  prizeIndex: number
  winCode: string | null
  autoSent: boolean
  txHash?: string
  paymentError?: string
  lobstrDeeplink?: string
}

function getAssetLabel(p: ScratchPrize): string {
  return p.label.trim().split(/\s+/).at(-1) ?? ''
}

function buildGrid(prizeIdx: number): string[] {
  const prize = SCRATCH_PRIZES[prizeIdx]
  const grid: string[] = Array(9).fill('')
  if (prize.isMiss) {
    const pool = ALL_EMOJIS.filter(e => e !== prize.emoji)
    const counts: Record<string, number> = {}
    for (let i = 0; i < 9; i++) {
      let sym: string; let attempts = 0
      do { sym = pool[Math.floor(Math.random() * pool.length)]; attempts++ }
      while ((counts[sym] ?? 0) >= 2 && attempts < 30)
      grid[i] = sym; counts[sym] = (counts[sym] ?? 0) + 1
    }
    return grid
  }
  const winPos = new Set<number>()
  while (winPos.size < 3) winPos.add(Math.floor(Math.random() * 9))
  const fillerPool = ALL_EMOJIS.filter(e => e !== prize.emoji)
  const fillerCounts: Record<string, number> = {}
  let fi = 0
  for (let i = 0; i < 9; i++) {
    if (winPos.has(i)) { grid[i] = prize.emoji; continue }
    let sym: string; let attempts = 0
    do { sym = fillerPool[fi % fillerPool.length]; fi++; attempts++ }
    while ((fillerCounts[sym] ?? 0) >= 2 && attempts < 20)
    grid[i] = sym; fillerCounts[sym] = (fillerCounts[sym] ?? 0) + 1
  }
  return grid
}

// ── Scratch tile ───────────────────────────────────────────────────────────────
// Uses a div with data-tile-idx; interaction is handled by the grid container.
function ScratchTile({ emoji, revealed, isWinner, tileIdx }: {
  emoji: string
  revealed: boolean
  isWinner: boolean
  tileIdx: number
}) {
  return (
    <div
      data-tile-idx={tileIdx}
      className="relative rounded-xl overflow-hidden select-none"
      style={{
        aspectRatio: '1',
        background: revealed
          ? isWinner ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)'
          : 'linear-gradient(135deg, rgba(212,175,55,0.28) 0%, rgba(140,90,10,0.45) 100%)',
        border: revealed
          ? isWinner ? '1.5px solid rgba(212,175,55,0.55)' : '1px solid rgba(255,255,255,0.08)'
          : '1px solid rgba(212,175,55,0.32)',
        boxShadow: isWinner && revealed ? '0 0 18px rgba(212,175,55,0.35)' : 'none',
        transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
        cursor: revealed ? 'default' : 'crosshair',
      }}
    >
      {/* Scratch cover */}
      {!revealed && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.22) 0%, rgba(120,75,5,0.42) 100%)' }}>
          <span style={{ fontSize: 18, opacity: 0.35 }}>✨</span>
        </div>
      )}
      {/* Revealed emoji */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'scale(1)' : 'scale(0.4)',
          transition: 'opacity 0.18s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
        <span style={{ fontSize: 28, lineHeight: 1 }}>{emoji}</span>
      </div>
    </div>
  )
}

// ── History pill ───────────────────────────────────────────────────────────────
function HistoryPill({ prize, date }: { prize: string; date: string }) {
  const p = SCRATCH_PRIZES.find(x => x.label === prize)
  const isWin = p && !p.isMiss
  return (
    <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border flex-shrink-0"
      style={{
        background: isWin ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.03)',
        borderColor: isWin ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.08)',
      }}>
      <span style={{ fontSize: 14 }}>{p?.emoji ?? '💨'}</span>
      <div>
        <p className={`text-[9px] font-bold ${isWin ? 'text-primary' : 'text-gray-500'}`}>{prize}</p>
        <p className="text-[8px] text-gray-600">{new Date(date).toLocaleDateString()}</p>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
interface Props {
  onBack: () => void
  stellarAddress: string | null
  onCardComplete: (onFresh: (can: boolean, remaining: number, bonus: number) => void) => Promise<void>
  initialCanScratch: boolean
  initialCardsRemaining: number
  initialDailyLimit: number
  initialBonusCards: number
  tierLabel: string
}

export default function ScratchCard({
  onBack, onCardComplete,
  initialCanScratch, initialCardsRemaining, initialDailyLimit, initialBonusCards, tierLabel,
}: Props) {
  const [canScratch, setCanScratch] = useState(initialCanScratch)
  const [cardsRemaining, setCardsRemaining] = useState(initialCardsRemaining)
  const [dailyLimit] = useState(initialDailyLimit)
  const [bonusCardsLeft, setBonusCardsLeft] = useState(initialBonusCards)

  // Card state
  const [cardDealt, setCardDealt] = useState(false)
  const [cardPending, setCardPending] = useState(false) // POST for this card's prize is in flight
  const [scratchError, setScratchError] = useState<string | null>(null)
  const [prizeIdx, setPrizeIdx] = useState<number | null>(null)
  const [grid, setGrid] = useState<string[]>([])
  const [revealed, setRevealed] = useState<boolean[]>(Array(9).fill(false))
  const [submitted, setSubmitted] = useState(false)
  const [autoSent, setAutoSent] = useState(false)
  const [autoSentTxHash, setAutoSentTxHash] = useState<string | null>(null)
  const [winCode, setWinCode] = useState<string | null>(null)
  const [claimed, setClaimed] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [isRevealingAll, setIsRevealingAll] = useState(false)
  const fetchingRef = useRef(false)
  const serverResultRef = useRef<ScratchResult | null>(null)

  // History
  const [history, setHistory] = useState<{ prize: string; created_at: string }[]>([])
  useEffect(() => {
    fetch('/api/game/wins')
      .then(r => r.json())
      .then(j => {
        if (!j.success) return
        const wins = (j.data as { prize: string; prize_source?: string; created_at: string }[])
          .filter(w => w.prize_source === 'scratch_card')
          .slice(0, 5)
        setHistory(wins)
      })
      .catch(() => null)
  }, [submitted]) // refetch after each card is submitted

  // Derived state
  const prize = prizeIdx !== null ? SCRATCH_PRIZES[prizeIdx] : null
  const isWin = prize ? !prize.isMiss : false
  const isAsset = prize?.isAsset ?? false
  const allRevealed = revealed.every(Boolean)
  const revealedCount = revealed.filter(Boolean).length

  const winPositions = prizeIdx !== null && prize && !prize.isMiss
    ? grid.reduce<number[]>((acc, sym, i) => sym === prize.emoji ? [...acc, i] : acc, [])
    : []

  // How many win-symbol tiles have been revealed so far (for match counter)
  const matchCount = prize && !prize.isMiss
    ? grid.filter((sym, i) => revealed[i] && sym === prize.emoji).length
    : 0

  // ── Scratch gesture refs ───────────────────────────────────────────────────
  const gridRef = useRef<HTMLDivElement>(null)
  const scratchingRef = useRef(false)
  const submittedRef = useRef(false)
  const revealTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const revealedRef = useRef<boolean[]>(Array(9).fill(false))

  // ── Reveal a single tile ───────────────────────────────────────────────────
  const revealTile = useCallback((i: number) => {
    if (revealedRef.current[i]) return // already revealed — bail early
    setRevealed(prev => {
      if (prev[i]) return prev // already revealed — no update
      const next = [...prev]
      next[i] = true
      revealedRef.current = next
      // Haptic on each scratch
      const newCount = next.filter(Boolean).length
      if (newCount === 9) haptic.medium() // last tile
      else haptic.light()
      return next
    })
  }, [])

  // ── Fetch the server-rolled prize on first scratch interaction ────────────
  // POST resolves before we know the grid contents — the returned prizeIndex decides
  // what goes under the cover. Returns the prize index, or null on failure (caller bails).
  const ensurePrizeFetched = useCallback(async (): Promise<number | null> => {
    if (fetchingRef.current) return null
    fetchingRef.current = true
    setCardPending(true)
    let data: ScratchResult | null = null
    try {
      const res = await fetch('/api/game/scratch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!json.success) {
        fetchingRef.current = false
        setCardPending(false)
        setCardDealt(false)
        if (json.code === 'DAILY_LIMIT' || json.code === 'RATE_LIMITED') {
          setCanScratch(false)
          setCardsRemaining(0)
        } else {
          setScratchError(json.error ?? 'Something went wrong — try again.')
        }
        return null
      }
      data = json.data
    } catch {
      fetchingRef.current = false
      setCardPending(false)
      setCardDealt(false)
      setScratchError('Network error — try again.')
      return null
    }
    fetchingRef.current = false
    if (!data) return null

    serverResultRef.current = data
    setPrizeIdx(data.prizeIndex)
    setGrid(buildGrid(data.prizeIndex))
    setCardPending(false)
    return data.prizeIndex
  }, [])

  // ── Pointer handlers for drag-to-scratch ──────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!cardDealt || submitted || allRevealed || isRevealingAll || cardPending) return
    scratchingRef.current = true
    gridRef.current?.setPointerCapture(e.pointerId)
    // Reveal the tile under the initial press
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const tileEl = el?.closest('[data-tile-idx]') as HTMLElement | null
    if (!tileEl) return
    const idx = parseInt(tileEl.dataset.tileIdx ?? '', 10)
    if (isNaN(idx)) return
    if (prizeIdx === null) {
      ensurePrizeFetched().then(resolved => { if (resolved !== null) revealTile(idx) })
      return
    }
    revealTile(idx)
  }, [cardDealt, submitted, allRevealed, isRevealingAll, cardPending, prizeIdx, ensurePrizeFetched, revealTile])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!scratchingRef.current || submitted || allRevealed || isRevealingAll || cardPending || prizeIdx === null) return
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const tileEl = el?.closest('[data-tile-idx]') as HTMLElement | null
    if (tileEl) {
      const idx = parseInt(tileEl.dataset.tileIdx ?? '', 10)
      if (!isNaN(idx)) revealTile(idx)
    }
  }, [submitted, allRevealed, isRevealingAll, cardPending, prizeIdx, revealTile])

  const handlePointerUp = useCallback(() => {
    scratchingRef.current = false
  }, [])

  // ── Staggered "Reveal All" ─────────────────────────────────────────────────
  const revealAllTiles = useCallback(async () => {
    if (isRevealingAll || cardPending) return
    // Prize may not be known yet if the player hits "Reveal All" before ever scratching
    if (prizeIdx === null) {
      const resolved = await ensurePrizeFetched()
      if (resolved === null) return
    }
    setIsRevealingAll(true)
    haptic.medium()

    // Read current revealed state from ref (no spurious re-render)
    const unrevealedIndices = revealedRef.current
      .map((r, i) => r ? -1 : i)
      .filter(i => i >= 0)
    // Shuffle
    for (let i = unrevealedIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unrevealedIndices[i], unrevealedIndices[j]] = [unrevealedIndices[j], unrevealedIndices[i]]
    }
    // Schedule reveals
    revealTimers.current.forEach(clearTimeout)
    revealTimers.current = []
    unrevealedIndices.forEach((tileIdx, pos) => {
      const t = setTimeout(() => {
        haptic.light()
        setRevealed(curr => {
          const next = [...curr]
          next[tileIdx] = true
          revealedRef.current = next
          return next
        })
        if (pos === unrevealedIndices.length - 1) {
          setIsRevealingAll(false)
        }
      }, pos * 80)
      revealTimers.current.push(t)
    })
  }, [isRevealingAll, cardPending, prizeIdx, ensurePrizeFetched])

  // Cleanup timers on unmount
  useEffect(() => () => { revealTimers.current.forEach(clearTimeout) }, [])

  // ── Submit result when all revealed ───────────────────────────────────────
  useEffect(() => {
    if (!allRevealed || submittedRef.current || prizeIdx === null) return
    submittedRef.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot transition when reveal completes, guarded by submittedRef
    setSubmitted(true)

    const p = SCRATCH_PRIZES[prizeIdx]
    if (!p.isMiss) {
      haptic.success()
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 2500)
    } else {
      haptic.warning()
    }

    // The server already rolled + recorded this card in the POST fired on first scratch
    // (ensurePrizeFetched) — read that response back out of the ref, no second request.
    const data = serverResultRef.current
    if (p.isAsset && data?.winCode) setWinCode(data.winCode)
    if (data?.autoSent) { setAutoSent(true); setAutoSentTxHash(data.txHash ?? null) }

    void onCardComplete((can, remaining, bonus) => {
      setCanScratch(can); setCardsRemaining(remaining); setBonusCardsLeft(bonus)
    })
  }, [allRevealed, prizeIdx, onCardComplete])

  // ── Deal a new card ────────────────────────────────────────────────────────
  // Prize is unknown until the first scratch (fetchPrize) — deal a covered placeholder
  // grid so there's something to touch; real symbols land once the server responds.
  const dealCard = useCallback(() => {
    revealTimers.current.forEach(clearTimeout)
    setCardDealt(true)
    setCardPending(false)
    setScratchError(null)
    fetchingRef.current = false
    serverResultRef.current = null
    setPrizeIdx(null)
    setGrid(Array(9).fill(''))
    setRevealed(Array(9).fill(false))
    revealedRef.current = Array(9).fill(false)
    setSubmitted(false)
    setAutoSent(false)
    setAutoSentTxHash(null)
    setWinCode(null)
    setClaimed(false)
    setIsRevealingAll(false)
    submittedRef.current = false
    scratchingRef.current = false
    haptic.light()
  }, [])

  const handleClaimViaBot = useCallback(() => {
    if (!winCode || claimed) return
    setClaimed(true)
    openTelegramLink(buildBotStartLink(`claim_${winCode}`))
  }, [winCode, claimed])

  const usingBonus = cardsRemaining === 0 && bonusCardsLeft > 0

  return (
    <div className="fixed inset-0 flex flex-col overflow-y-auto"
      style={{ background: `radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.07) 0%, ${BRANDING.colors.background} 60%)` }}>
      <style>{`
        @keyframes result-pop { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes confetti-fall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
        @keyframes card-deal { from { transform: translateY(20px) scale(0.96); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes match-pulse { 0%,100% { opacity:1 } 50% { opacity:0.6 } }
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
            Scratch Card
          </p>
          <p className="text-white/40 text-[10px] mt-0.5">
            {usingBonus
              ? `🎁 ${bonusCardsLeft} bonus card${bonusCardsLeft !== 1 ? 's' : ''}`
              : canScratch
              ? `${cardsRemaining} card${cardsRemaining !== 1 ? 's' : ''} remaining today`
              : '⏳ Resets at midnight UTC'}
          </p>
        </div>
        <div className="w-16" />
      </div>

      {/* Scratch error */}
      {scratchError && (
        <div className="px-4 mb-2 flex-shrink-0">
          <div className="rounded-2xl border border-red-500/30 px-4 py-2.5 text-center text-xs text-red-400"
            style={{ background: 'rgba(248,113,113,0.08)' }}>
            {scratchError}
          </div>
        </div>
      )}

      {/* Card history row */}
      {history.length > 0 && (
        <div className="px-4 mb-1 flex-shrink-0">
          <div className="flex space-x-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <span className="text-[9px] text-gray-600 uppercase tracking-widest self-center flex-shrink-0">History</span>
            {history.map((h, i) => <HistoryPill key={i} prize={h.prize} date={h.created_at} />)}
          </div>
        </div>
      )}

      {/* Card area */}
      <div className="flex-1 flex flex-col items-center px-4 py-2">

        {!cardDealt ? (
          /* No card yet */
          <div className="w-full max-w-xs rounded-3xl border border-dashed border-primary/30 flex flex-col items-center justify-center py-14 space-y-4"
            style={{ background: 'rgba(212,175,55,0.04)' }}>
            <span style={{ fontSize: 52 }}>🃏</span>
            <p className="text-gray-400 text-sm font-semibold">Your card is waiting</p>
            <p className="text-gray-600 text-xs">Tap below to deal a card</p>
          </div>
        ) : (
          /* Active card */
          <div className="w-full max-w-xs rounded-3xl p-5 border border-primary/25"
            style={{
              background: 'linear-gradient(160deg, rgba(212,175,55,0.09) 0%, rgba(10,14,26,0.97) 70%)',
              animation: 'card-deal 0.35s cubic-bezier(0.34,1.56,0.64,1)',
            }}>

            {/* Card header — reveal counter + match indicator */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-primary/60 font-bold uppercase tracking-widest">
                {allRevealed
                  ? (isWin ? '🎉 You won!' : '💨 Better luck next time')
                  : cardPending ? '⏳ Dealing…' : 'Scratch to reveal'}
              </p>
              <div className="flex items-center space-x-2">
                {/* Match counter — shown while scratching, hides on allRevealed */}
                {!allRevealed && matchCount > 0 && prize && !prize.isMiss && (
                  <span className="text-[10px] font-bold text-primary"
                    style={{ animation: matchCount >= 2 ? 'match-pulse 0.8s ease-in-out infinite' : 'none' }}>
                    {matchCount}/3 {prize.emoji}
                  </span>
                )}
                <p className="text-[10px] text-gray-600">{revealedCount}/9</p>
              </div>
            </div>

            {/* 3×3 grid — pointer events handled here for drag-scratch */}
            <div
              ref={gridRef}
              className="grid grid-cols-3 gap-2.5 mb-4"
              style={{ touchAction: 'none', userSelect: 'none' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {grid.map((emoji, i) => (
                <ScratchTile
                  key={i}
                  tileIdx={i}
                  emoji={emoji}
                  revealed={revealed[i]}
                  isWinner={winPositions.includes(i) && allRevealed}
                />
              ))}
            </div>

            {/* Prize legend — shown while card is active */}
            {!allRevealed && (
              <div className="mb-3">
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {WIN_PRIZES.map(p => (
                    <div key={p.emoji}
                      className="flex items-center space-x-1 px-1.5 py-0.5 rounded-lg border border-white/8"
                      style={{
                        background: prize && !prize.isMiss && p.emoji === prize.emoji
                          ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.03)',
                        borderColor: prize && !prize.isMiss && p.emoji === prize.emoji
                          ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.08)',
                      }}>
                      <span style={{ fontSize: 10 }}>{p.emoji}</span>
                      <span className="text-[8px] text-gray-500">{p.label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-center text-[8px] text-gray-700 mt-1">Match 3 of the same to win</p>
              </div>
            )}

            {/* Reveal All button */}
            {!allRevealed && !submitted && !isRevealingAll && !cardPending && (
              <button onClick={revealAllTiles}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-primary border border-primary/30 active:scale-95 transition"
                style={{ background: 'rgba(212,175,55,0.06)' }}>
                Reveal All
              </button>
            )}
            {isRevealingAll && (
              <div className="w-full py-2.5 rounded-xl text-xs text-center text-gray-500">
                Revealing…
              </div>
            )}
          </div>
        )}

        {/* Confetti */}
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 100 }}>
            {[...Array(14)].map((_, i) => {
              const colors = [BRANDING.colors.primary, '#f0d060', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#fb923c', '#34d399']
              return (
                <div key={i} style={{
                  position: 'absolute', left: `${4 + i * 7}%`, top: 0,
                  width: 8 + (i % 3) * 4, height: 8 + (i % 3) * 4,
                  borderRadius: i % 2 === 0 ? '50%' : '2px',
                  background: colors[i % colors.length],
                  animation: `confetti-fall ${(1.8 + (i % 4) * 0.25).toFixed(2)}s ease-in ${(i * 0.12).toFixed(2)}s both`,
                }} />
              )
            })}
          </div>
        )}

        {/* Result banner */}
        {allRevealed && prize && (
          <div className="w-full max-w-xs mt-4" style={{ animation: 'result-pop 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div className={`rounded-3xl px-5 py-4 border text-center ${isWin ? 'border-primary/60' : 'border-white/10'}`}
              style={{
                background: isWin ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.03)',
                boxShadow: isWin ? '0 0 32px rgba(212,175,55,0.2)' : 'none',
              }}>
              <p className="text-4xl mb-1">{prize.emoji}</p>
              <p className={`text-lg font-bold ${isWin ? 'text-primary' : 'text-gray-500'}`}>{prize.label}</p>

              {prize.label === '+2 Cards' && (
                <p className="text-xs text-green-400/80 mt-1">Added to your card balance 🃏</p>
              )}

              {isAsset && (
                <div className="mt-3 space-y-3 text-left">
                  {winCode && (
                    <div className="px-3 py-2 rounded-xl border border-primary/40 text-[11px] text-primary font-mono font-bold tracking-widest text-center"
                      style={{ background: 'rgba(212,175,55,0.08)' }}>{winCode}</div>
                  )}
                  {autoSent ? (
                    <div className="rounded-xl border border-green-500/30 px-4 py-3 text-center space-y-1"
                      style={{ background: 'rgba(74,222,128,0.06)' }}>
                      <p className="text-sm font-bold text-green-400">✅ Prize sent to your wallet!</p>
                      <p className="text-[10px] text-gray-500">Check your Stellar wallet — {getAssetLabel(prize)} is on its way.</p>
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
      </div>

      {/* Bottom actions */}
      <div className="px-4 pb-8 flex-shrink-0 space-y-2 mt-3">
        {allRevealed && canScratch && (
          <button onClick={dealCard}
            className="w-full py-4 rounded-2xl text-base font-bold text-black active:scale-95 transition"
            style={{ background: `linear-gradient(135deg, ${BRANDING.colors.primary} 0%, #f0d060 50%, ${BRANDING.colors.primary} 100%)`, boxShadow: '0 4px 24px rgba(212,175,55,0.4)' }}>
            🃏 New Card ({cardsRemaining} left)
          </button>
        )}

        {!cardDealt && canScratch && (
          <button onClick={dealCard}
            className="w-full py-4 rounded-2xl text-base font-bold text-black active:scale-95 transition"
            style={{ background: `linear-gradient(135deg, ${BRANDING.colors.primary} 0%, #f0d060 50%, ${BRANDING.colors.primary} 100%)`, boxShadow: '0 4px 24px rgba(212,175,55,0.4)' }}>
            🃏 Deal Card
          </button>
        )}

        {!canScratch && (allRevealed || !cardDealt) && (
          <div className="w-full py-3 rounded-2xl border border-white/10 text-center text-xs text-gray-500"
            style={{ background: 'rgba(255,255,255,0.03)' }}>
            {dailyLimit > 0 ? '⏳ Daily card used — resets midnight UTC' : '🎯 Get Tier 1 for 1 daily scratch card'}
          </div>
        )}

        {(allRevealed || !cardDealt) && (
          <button onClick={onBack}
            className="w-full py-3 rounded-2xl text-sm font-semibold text-gray-300 border border-white/10 active:scale-95 transition"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            Back to Hub
          </button>
        )}

        <p className="text-center text-[10px] text-gray-700">
          {tierLabel} · {dailyLimit > 0 ? `${dailyLimit} card/day` : '1 welcome card (once)'}
        </p>
      </div>
    </div>
  )
}

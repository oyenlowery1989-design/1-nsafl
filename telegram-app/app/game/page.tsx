'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTelegramBack } from '@/hooks/useTelegramBack'
import { haptic } from '@/lib/telegram-ui'
import { getTelegramInitData } from '@/lib/telegram'
import { useWalletStore } from '@/hooks/useStore'
import { getTierForBalance } from '@/config/tiers'
import { PRIMARY_CUSTOM_ASSET_CODE, PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'
import { getTotalPoints, getPointsFromTier } from '@/lib/points'
import WalletGuard from '@/components/WalletGuard'
import BottomNav from '@/components/BottomNav'

// ── Physics ───────────────────────────────────────────────────────────────────
const GRAVITY = 0.18
const BOUNCE = 0.55
const SPIN_DECAY = 0.97
const TRAIL_LENGTH = 10
const KICK_RADIUS = 100

interface Ball {
  x: number; y: number
  vx: number; vy: number
  spin: number; angle: number
  size: number; opacity: number
  trail: { x: number; y: number }[]
}

function makeBall(x: number, y: number, kicked = false): Ball {
  const size = 56 + Math.random() * 24
  const speed = kicked ? 14 + Math.random() * 6 : 6 + Math.random() * 8
  const dir = kicked
    ? -Math.PI / 2 + (Math.random() - 0.5) * 1.2
    : Math.random() * Math.PI * 2
  return {
    x, y,
    vx: Math.cos(dir) * speed,
    vy: Math.sin(dir) * speed,
    spin: (Math.random() - 0.5) * 14,
    angle: Math.random() * 360,
    size, opacity: 0.75 + Math.random() * 0.25,
    trail: [],
  }
}

function randomBall(w: number, h: number): Ball {
  return makeBall(w * 0.2 + Math.random() * w * 0.6, h * 0.2 + Math.random() * h * 0.5, false)
}

// ── Community stats shape ─────────────────────────────────────────────────────
interface GameStats {
  totalSessions: number
  totalKicks: number
  totalBalls: number
  highScore: number
  uniquePlayers: number
  leaderboard: { rank: number; name: string; kicks: number }[]
}

type GameView = 'hub' | 'playing'

// ── Canvas Game Component ─────────────────────────────────────────────────────
function CanvasGame({ numBalls, onBack }: { numBalls: number; onBack: () => void }) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ballsRef = useRef<Ball[]>([])
  const rafRef = useRef<number>(0)
  const kicksRef = useRef(0)
  const ballsSpawnedRef = useRef(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sessionStartRef = useRef<number>(0)
  if (sessionStartRef.current === 0) sessionStartRef.current = Date.now()
  const savedRef = useRef(false)

  const [kicks, setKicks] = useState(0)
  const [ballCount, setBallCount] = useState(numBalls)
  const [communityStats, setCommunityStats] = useState<GameStats | null>(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  // Fetch community stats on mount
  useEffect(() => {
    fetch('/api/game')
      .then(r => r.json())
      .then(j => { if (j.success) setCommunityStats(j.data) })
      .catch(() => null)
  }, [])

  // Save session stats (called on exit)
  const saveSession = useCallback(() => {
    if (savedRef.current) return
    savedRef.current = true
    const k = kicksRef.current
    const b = ballsSpawnedRef.current
    if (k === 0 && b === 0) return   // nothing to save
    const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
    fetch('/api/game', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': getTelegramInitData(),
      },
      body: JSON.stringify({ kicks: k, ballsSpawned: b, durationSeconds: duration }),
      keepalive: true,
    }).catch(() => null)
  }, [])

  // Wire Telegram back button WITH session save
  useTelegramBack(useCallback(() => {
    saveSession()
    router.back()
  }, [saveSession, router]))

  // Also save on browser unload
  useEffect(() => {
    const handler = () => saveSession()
    window.addEventListener('pagehide', handler)
    return () => window.removeEventListener('pagehide', handler)
  }, [saveSession])

  // Canvas physics loop
  const initBalls = useCallback((w: number, h: number) => {
    const count = Math.max(1, numBalls)
    ballsRef.current = Array.from({ length: count }, () => randomBall(w, h))
    setBallCount(count)
  }, [numBalls])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initBalls(canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    function step() {
      if (!canvas || !ctx) return
      const W = canvas.width, H = canvas.height

      ctx.fillStyle = 'rgba(10,14,26,0.35)'
      ctx.fillRect(0, 0, W, H)

      for (const b of ballsRef.current) {
        b.trail.push({ x: b.x, y: b.y })
        if (b.trail.length > TRAIL_LENGTH) b.trail.shift()

        for (let i = 0; i < b.trail.length; i++) {
          const t = b.trail[i]
          const alpha = ((i + 1) / b.trail.length) * 0.14 * b.opacity
          const tr = (b.size * 0.52) * (i / b.trail.length)
          ctx.beginPath()
          ctx.ellipse(t.x, t.y, tr, tr * 0.6, 0, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(139,69,19,${alpha})`
          ctx.fill()
        }

        // Draw AFL ball
        ctx.save()
        ctx.globalAlpha = b.opacity
        ctx.translate(b.x, b.y)
        ctx.rotate((b.angle * Math.PI) / 180)

        const rx = b.size * 0.52  // horizontal radius
        const ry = b.size * 0.32  // vertical radius (oval shape)

        // Body gradient — brown leather
        const grad = ctx.createRadialGradient(-rx * 0.3, -ry * 0.3, ry * 0.1, 0, 0, rx)
        grad.addColorStop(0, '#c8752a')
        grad.addColorStop(0.5, '#8b4513')
        grad.addColorStop(1, '#5c2d0a')
        ctx.beginPath()
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        // Dark outline
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'
        ctx.lineWidth = 1.5
        ctx.stroke()

        // White seam — horizontal centre line
        ctx.beginPath()
        ctx.moveTo(-rx * 0.75, 0)
        ctx.lineTo(rx * 0.75, 0)
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'
        ctx.lineWidth = 1.2
        ctx.stroke()

        // White lace stitches (4 short vertical lines across centre)
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.lineWidth = 1.5
        const stitchH = ry * 0.45
        for (const sx of [-rx * 0.22, -rx * 0.07, rx * 0.07, rx * 0.22]) {
          ctx.beginPath()
          ctx.moveTo(sx, -stitchH)
          ctx.lineTo(sx, stitchH)
          ctx.stroke()
        }

        ctx.restore()

        b.vy += GRAVITY
        b.x += b.vx; b.y += b.vy
        b.angle += b.spin
        b.spin *= SPIN_DECAY

        if (b.y + b.size / 2 >= H) {
          b.y = H - b.size / 2; b.vy *= -BOUNCE; b.vx *= 0.9; b.spin *= -0.5
          if (Math.abs(b.vy) < 1.5) b.vy = -2 - Math.random() * 3
        }
        if (b.x - b.size / 2 <= 0) { b.x = b.size / 2; b.vx *= -BOUNCE }
        if (b.x + b.size / 2 >= W) { b.x = W - b.size / 2; b.vx *= -BOUNCE }
        if (b.y - b.size / 2 <= 0) { b.y = b.size / 2; b.vy *= -BOUNCE }
      }

      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [initBalls])

  const handleTap = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    const tx = e.clientX - rect.left
    const ty = e.clientY - rect.top

    let nearest: Ball | null = null
    let nearestDist = Infinity
    for (const b of ballsRef.current) {
      const d = Math.hypot(b.x - tx, b.y - ty)
      if (d < nearestDist) { nearestDist = d; nearest = b }
    }

    if (nearest && nearestDist <= KICK_RADIUS) {
      const dx = nearest.x - tx, dy = nearest.y - ty
      const len = Math.hypot(dx, dy) || 1
      const power = 14 + Math.random() * 6
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      nearest!.vx = (dx / len) * power
      nearest!.vy = (dy / len) * power - 3
      nearest!.spin = (Math.random() - 0.5) * 20
      haptic.light()
      kicksRef.current += 1
      setKicks(k => k + 1)
    }
  }, [])

  const fmt = (n: number) => n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n)

  return (
    <div className="fixed inset-0 bg-[#0A0E1A] overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        onPointerDown={handleTap}
        style={{ touchAction: 'none' }}
      />

      {/* ── Centre hint — fades after first kick ── */}
      {kicks === 0 && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full pointer-events-none select-none">
          <p className="text-white/20 text-[11px] animate-pulse">Tap a ball to kick it</p>
        </div>
      )}

      {/* ── Top-left: back to hub + ball count ── */}
      <button
        onClick={() => { saveSession(); onBack() }}
        className="absolute top-12 left-4 z-20 flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-white/10 hover:bg-white/10 transition active:scale-95"
        style={{ backdropFilter: 'blur(12px)', background: 'rgba(255,255,255,0.05)' }}
      >
        <span className="material-symbols-outlined text-white text-base">arrow_back</span>
        <span className="text-white text-xs font-medium">Back to Hub</span>
      </button>

      <div className="absolute top-12 right-16 z-20 px-2.5 py-1.5 rounded-full border border-white/10 text-[10px] font-semibold text-gray-400"
        style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)' }}>
        🏈 {ballCount}
      </div>

      {/* ── Top-right: kicks + leaderboard toggle ── */}
      {kicks > 0 && (
        <div className="absolute top-12 right-4 z-20 px-3 py-1.5 rounded-full border border-[#D4AF37]/30 text-[11px] font-bold text-[#D4AF37]"
          style={{ background: 'rgba(212,175,55,0.1)', backdropFilter: 'blur(8px)' }}>
          ⚡ {kicks}
        </div>
      )}

      <button
        onClick={() => setShowLeaderboard(v => !v)}
        className="absolute top-24 right-4 z-20 w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 hover:bg-white/10 transition"
        style={{ backdropFilter: 'blur(12px)', background: 'rgba(255,255,255,0.05)' }}
      >
        <span className="material-symbols-outlined text-[#D4AF37] text-lg">emoji_events</span>
      </button>

      {/* ── Leaderboard panel ── */}
      {showLeaderboard && communityStats && (
        <div className="absolute top-36 right-4 z-30 w-56 rounded-2xl border border-white/10 overflow-hidden"
          style={{ background: 'rgba(10,14,26,0.92)', backdropFilter: 'blur(16px)' }}>
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-[#D4AF37] text-base">emoji_events</span>
              <span className="text-xs font-bold text-white">Top Kickers</span>
            </div>
            <span className="text-[9px] text-gray-500">{fmt(communityStats.totalSessions)} sessions</span>
          </div>
          <div className="divide-y divide-white/5">
            {communityStats.leaderboard.length === 0 ? (
              <p className="text-center text-gray-500 text-xs py-4">No sessions yet — be first!</p>
            ) : (
              communityStats.leaderboard.slice(0, 5).map((p) => (
                <div key={p.rank} className="flex items-center justify-between px-4 py-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className={`text-xs font-bold w-4 flex-shrink-0 ${p.rank === 1 ? 'text-[#D4AF37]' : 'text-gray-500'}`}>
                      {p.rank}
                    </span>
                    <span className="text-xs text-gray-300 truncate">{p.name}</span>
                  </div>
                  <span className={`text-xs font-bold flex-shrink-0 ${p.rank === 1 ? 'text-[#D4AF37]' : 'text-white'}`}>
                    {fmt(p.kicks)} ⚡
                  </span>
                </div>
              ))
            )}
          </div>
          {kicks > 0 && (
            <div className="px-4 py-2 border-t border-white/10 text-center">
              <p className="text-[10px] text-[#D4AF37]">Your session: {kicks} kicks</p>
              <p className="text-[9px] text-gray-500">Saved when you leave</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Hub View ──────────────────────────────────────────────────────────────────
function HubView({ onPlay, totalPoints, tierPoints, tierLabel }: {
  onPlay: () => void
  totalPoints: number
  tierPoints: number
  tierLabel: string  // e.g. "Tier 1"
}) {
  const router = useRouter()

  const games = [
    {
      id: 'ball',
      icon: 'sports_football',
      name: `${PRIMARY_CUSTOM_ASSET_CODE} Ball`,
      description: 'Physics ball game — kick, bounce, score',
      cost: 0,
      unlocked: true,
      onPlay,
    },
    {
      id: 'lucky',
      icon: 'casino',
      name: 'Lucky Draw',
      description: `Spin for ${PRIMARY_CUSTOM_ASSET_CODE} prizes`,
      cost: 3,
      unlocked: false,
      comingSoon: true,
    },
    {
      id: 'quiz',
      icon: 'quiz',
      name: `${PRIMARY_CUSTOM_ASSET_CODE} Quiz`,
      description: `Answer AFL & ${PRIMARY_CUSTOM_ASSET_CODE} questions`,
      cost: 2,
      unlocked: false,
      comingSoon: true,
    },
    {
      id: 'scorer',
      icon: 'military_tech',
      name: 'Top Scorer',
      description: 'Daily leaderboard challenge',
      cost: 5,
      unlocked: false,
      comingSoon: true,
    },
  ]

  return (
    <div className="min-h-screen bg-[#0A0E1A] pb-28">
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 pt-3 pb-2 border-b border-white/5"
        style={{ background: 'rgba(10,14,26,0.95)', backdropFilter: 'blur(20px)' }}>
        <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
          Game Hub
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">More {PRIMARY_CUSTOM_ASSET_CODE} = more balls</p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Points card */}
        <div className="rounded-2xl p-4 border border-[#D4AF37]/30"
          style={{ background: 'rgba(212,175,55,0.06)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-[#D4AF37]/70 uppercase tracking-widest font-semibold mb-1">Your Balls</p>
              <div className="flex items-baseline space-x-2">
                <span className="text-5xl font-bold text-[#D4AF37]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {totalPoints}
                </span>
                <span className="text-2xl">🏈</span>
              </div>
            </div>
            <span className="material-symbols-outlined text-[#D4AF37] text-3xl mt-1"
              style={{ fontVariationSettings: "'FILL' 1" }}>
              workspace_premium
            </span>
          </div>

          <div className="space-y-1.5 mb-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Tier ({tierLabel})</span>
              <span className="text-white font-semibold">{tierPoints} ball{tierPoints !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Base (everyone)</span>
              <span className="text-white font-semibold">1 ball</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Referrals</span>
              <span className="text-gray-500">0 balls</span>
            </div>
          </div>

          <p className="text-[10px] text-gray-500 leading-relaxed mb-3">
            Hold more {PRIMARY_CUSTOM_ASSET_CODE} or complete tasks to earn more balls
          </p>

          <button
            onClick={() => { haptic.light(); router.push('/buy') }}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-black bg-[#D4AF37] active:scale-95 transition"
          >
            Buy {PRIMARY_CUSTOM_ASSET_LABEL}
          </button>
        </div>

        {/* How to earn */}
        <div className="rounded-2xl p-4 border border-white/10"
          style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }}>
          <p className="text-xs font-bold text-white mb-3">How to earn balls</p>
          <div className="space-y-3">
            {[
              {
                icon: 'workspace_premium',
                label: 'Tier Level',
                desc: `Tier 1 = 1 ball, Tier 2 = 2 balls, etc. You have ${tierPoints} from your tier.`,
              },
              {
                icon: 'group_add',
                label: 'Referrals',
                desc: '1 ball per person you bring (coming soon)',
                muted: true,
              },
              {
                icon: 'task_alt',
                label: 'Tasks',
                desc: 'Complete challenges for bonus balls (coming soon)',
                muted: true,
              },
            ].map(({ icon, label, desc, muted }) => (
              <div key={label} className="flex items-start space-x-3">
                <span className={`material-symbols-outlined text-lg mt-0.5 ${muted ? 'text-gray-600' : 'text-[#D4AF37]'}`}
                  style={{ fontVariationSettings: "'FILL' 1" }}>
                  {icon}
                </span>
                <div>
                  <p className={`text-xs font-semibold ${muted ? 'text-gray-500' : 'text-white'}`}>{label}</p>
                  <p className="text-[10px] text-gray-600 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Games grid */}
        <div>
          <p className="text-xs font-bold text-white mb-2.5">Games</p>
          <div className="grid grid-cols-2 gap-3">
            {games.map((game) => (
              <div
                key={game.id}
                className={`rounded-2xl p-3.5 border flex flex-col space-y-2 ${
                  game.unlocked
                    ? 'border-[#D4AF37]/25'
                    : 'border-white/8 opacity-60'
                }`}
                style={{
                  background: game.unlocked
                    ? 'rgba(212,175,55,0.05)'
                    : 'rgba(255,255,255,0.02)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <div className="flex items-start justify-between">
                  <span
                    className={`material-symbols-outlined text-2xl ${game.unlocked ? 'text-[#D4AF37]' : 'text-gray-600'}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {game.icon}
                  </span>
                  {game.unlocked ? null : (
                    game.comingSoon ? (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-white/10 text-gray-500 uppercase tracking-wider">
                        Soon
                      </span>
                    ) : (
                      <span className="material-symbols-outlined text-gray-600 text-base">lock</span>
                    )
                  )}
                </div>

                <div>
                  <p className={`text-xs font-bold leading-tight ${game.unlocked ? 'text-white' : 'text-gray-500'}`}>
                    {game.name}
                  </p>
                  <p className="text-[9px] text-gray-600 leading-snug mt-0.5">{game.description}</p>
                </div>

                {game.cost > 0 && (
                  <div className={`text-[9px] font-semibold ${game.unlocked ? 'text-[#D4AF37]/70' : 'text-gray-600'}`}>
                    {game.cost} ball{game.cost !== 1 ? 's' : ''} to play
                  </div>
                )}

                {game.unlocked && game.onPlay ? (
                  <button
                    onClick={() => { haptic.medium(); game.onPlay!() }}
                    className="w-full py-2 rounded-xl text-[11px] font-bold text-black bg-[#D4AF37] active:scale-95 transition"
                  >
                    Play
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GamePage() {
  const [view, setView] = useState<GameView>('hub')

  const tokenBalance = useWalletStore((s) => s.tokenBalance)
  const balance = parseFloat(tokenBalance) || 0
  const tierPoints = getPointsFromTier(balance)
  const totalPoints = Math.max(1, getTotalPoints(balance)) // everyone gets at least 1 ball
  const currentTier = getTierForBalance(balance)
  const tierLabel = currentTier.label

  useTelegramBack(useCallback(() => {
    if (view === 'playing') {
      setView('hub')
    }
    // When in hub, let Telegram handle back naturally
  }, [view]))

  return (
    <WalletGuard>
      {view === 'playing' ? (
        <CanvasGame
          numBalls={totalPoints}
          onBack={() => setView('hub')}
        />
      ) : (
        <>
          <HubView
            onPlay={() => setView('playing')}
            totalPoints={totalPoints}
            tierPoints={tierPoints}
            tierLabel={tierLabel}
          />
          <BottomNav />
        </>
      )}
    </WalletGuard>
  )
}

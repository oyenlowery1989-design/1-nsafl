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
const GRAVITY = 0.22
const BOUNCE = 0.52
const FRICTION = 0.88
const SPIN_DECAY = 0.96
const TRAIL_LENGTH = 8
const KICK_RADIUS = 100
const PB_KEY = 'nsafl_game_pb'

interface Ball {
  x: number; y: number
  vx: number; vy: number
  spin: number; angle: number
  size: number; opacity: number
  trail: { x: number; y: number }[]
  dead: boolean
}

interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number // 0–1 countdown
  size: number
}

function makeBall(x: number, y: number, kicked = false): Ball {
  const size = 58 + Math.random() * 20
  const speed = kicked ? 14 + Math.random() * 6 : 5 + Math.random() * 6
  const dir = kicked
    ? -Math.PI / 2 + (Math.random() - 0.5) * 1.0
    : Math.random() * Math.PI * 2
  return {
    x, y,
    vx: Math.cos(dir) * speed,
    vy: Math.sin(dir) * speed,
    spin: 0,
    angle: Math.random() * 360,
    size, opacity: 0.9 + Math.random() * 0.1,
    trail: [],
    dead: false,
  }
}

function randomBall(w: number, h: number): Ball {
  return makeBall(
    w * 0.25 + Math.random() * w * 0.5,
    h * 0.15 + Math.random() * h * 0.4,
    false
  )
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

// ── Canvas Game ───────────────────────────────────────────────────────────────
function CanvasGame({ numBalls, onBack }: { numBalls: number; onBack: () => void }) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ballsRef = useRef<Ball[]>([])
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number>(0)
  const kicksRef = useRef(0)
  const sessionStartRef = useRef<number>(Date.now())
  const savedRef = useRef(false)
  const ballsLeftRef = useRef(numBalls)
  const gameOverRef = useRef(false)

  const [kicks, setKicks] = useState(0)
  const [ballsLeft, setBallsLeft] = useState(numBalls)
  const [gameOver, setGameOver] = useState(false)
  const [personalBest, setPersonalBest] = useState(() => {
    if (typeof window === 'undefined') return 0
    return parseInt(localStorage.getItem(PB_KEY) ?? '0', 10)
  })
  const [communityStats, setCommunityStats] = useState<GameStats | null>(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  useEffect(() => {
    fetch('/api/game')
      .then(r => r.json())
      .then(j => { if (j.success) setCommunityStats(j.data) })
      .catch(() => null)
  }, [])

  const saveSession = useCallback(() => {
    if (savedRef.current) return
    savedRef.current = true
    const k = kicksRef.current
    if (k === 0) return
    const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
    fetch('/api/game', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': getTelegramInitData(),
      },
      body: JSON.stringify({ kicks: k, ballsSpawned: 0, durationSeconds: duration }),
      keepalive: true,
    }).catch(() => null)
  }, [])

  useTelegramBack(useCallback(() => {
    saveSession()
    router.back()
  }, [saveSession, router]))

  useEffect(() => {
    const handler = () => saveSession()
    window.addEventListener('pagehide', handler)
    return () => window.removeEventListener('pagehide', handler)
  }, [saveSession])

  // Spawn dust particles on floor hit
  const spawnDust = useCallback((x: number) => {
    for (let i = 0; i < 6; i++) {
      particlesRef.current.push({
        x, y: 0, // y set at call site via canvas height
        vx: (Math.random() - 0.5) * 4,
        vy: -(Math.random() * 3 + 1),
        life: 1,
        size: 2 + Math.random() * 3,
      })
    }
  }, [])

  const initBalls = useCallback((w: number, h: number) => {
    ballsRef.current = Array.from({ length: Math.max(1, numBalls) }, () => randomBall(w, h))
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

    function drawBall(b: Ball) {
      if (!ctx) return
      const rx = b.size * 0.52
      const ry = b.size * 0.30

      // trail
      for (let i = 0; i < b.trail.length; i++) {
        const t = b.trail[i]
        const alpha = ((i + 1) / b.trail.length) * 0.12 * b.opacity
        const tr = rx * (i / b.trail.length) * 0.6
        ctx.beginPath()
        ctx.ellipse(t.x, t.y, Math.max(tr, 1), Math.max(tr * 0.55, 1), 0, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(139,69,19,${alpha})`
        ctx.fill()
      }

      ctx.save()
      ctx.globalAlpha = b.opacity
      ctx.translate(b.x, b.y)
      // angle tracks velocity direction for realistic tumbling
      ctx.rotate((b.angle * Math.PI) / 180)

      // leather body
      const grad = ctx.createRadialGradient(-rx * 0.28, -ry * 0.35, ry * 0.08, 0, 0, rx)
      grad.addColorStop(0, '#d4823a')
      grad.addColorStop(0.45, '#8b4513')
      grad.addColorStop(1, '#4a1c08')
      ctx.beginPath()
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()

      // outline
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // highlight sheen
      const shine = ctx.createLinearGradient(-rx * 0.3, -ry, rx * 0.3, 0)
      shine.addColorStop(0, 'rgba(255,255,255,0.18)')
      shine.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.beginPath()
      ctx.ellipse(0, -ry * 0.2, rx * 0.55, ry * 0.38, 0, 0, Math.PI * 2)
      ctx.fillStyle = shine
      ctx.fill()

      // centre seam
      ctx.beginPath()
      ctx.moveTo(-rx * 0.72, 0)
      ctx.lineTo(rx * 0.72, 0)
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 1.2
      ctx.stroke()

      // lace stitches
      ctx.strokeStyle = 'rgba(255,255,255,0.88)'
      ctx.lineWidth = 1.6
      const sh = ry * 0.42
      for (const sx of [-rx * 0.21, -rx * 0.07, rx * 0.07, rx * 0.21]) {
        ctx.beginPath()
        ctx.moveTo(sx, -sh)
        ctx.lineTo(sx, sh)
        ctx.stroke()
      }

      ctx.restore()
    }

    function step() {
      try {
        if (!canvas || !ctx) return
        const W = canvas.width, H = canvas.height

        ctx.fillStyle = 'rgba(10,14,26,0.38)'
        ctx.fillRect(0, 0, W, H)

        // particles
        particlesRef.current = particlesRef.current.filter(p => p.life > 0)
        for (const p of particlesRef.current) {
          p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 0.07
          ctx.beginPath()
          ctx.arc(p.x, p.y, Math.max(p.size * p.life, 0.1), 0, Math.PI * 2)
          ctx.fillStyle = `rgba(180,120,60,${p.life * 0.5})`
          ctx.fill()
        }

        if (!gameOverRef.current) {
          for (const b of ballsRef.current) {
            if (b.dead) continue

            b.trail.push({ x: b.x, y: b.y })
            if (b.trail.length > TRAIL_LENGTH) b.trail.shift()
            drawBall(b)

            // physics
            b.vy += GRAVITY
            b.x += b.vx; b.y += b.vy
            b.angle = (Math.atan2(b.vy, b.vx) * 180 / Math.PI)
            b.spin *= SPIN_DECAY

            // floor — ball is lost
            if (b.y + b.size * 0.3 >= H) {
              b.dead = true
              // dust burst
              for (let i = 0; i < 8; i++) {
                particlesRef.current.push({
                  x: b.x + (Math.random() - 0.5) * 40,
                  y: H - 4,
                  vx: (Math.random() - 0.5) * 6,
                  vy: -(Math.random() * 4 + 1),
                  life: 1,
                  size: 3 + Math.random() * 4,
                })
              }
              const remaining = ballsLeftRef.current - 1
              ballsLeftRef.current = remaining
              setBallsLeft(remaining)
              haptic.error()
              if (remaining <= 0) {
                gameOverRef.current = true
                setGameOver(true)
                const k = kicksRef.current
                const prev = parseInt(localStorage.getItem(PB_KEY) ?? '0', 10)
                if (k > prev) {
                  localStorage.setItem(PB_KEY, String(k))
                  setPersonalBest(k)
                }
                saveSession()
              }
            }

            // walls
            if (b.x - b.size * 0.52 <= 0) { b.x = b.size * 0.52; b.vx = Math.abs(b.vx) * BOUNCE }
            if (b.x + b.size * 0.52 >= W) { b.x = W - b.size * 0.52; b.vx = -Math.abs(b.vx) * BOUNCE }
            if (b.y - b.size * 0.3 <= 0) { b.y = b.size * 0.3; b.vy = Math.abs(b.vy) * BOUNCE }
          }
        }
      } catch {
        // swallow any draw error so the loop never dies
      }

      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [initBalls, saveSession])

  const handleTap = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (gameOverRef.current) return
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    const tx = e.clientX - rect.left
    const ty = e.clientY - rect.top

    let nearest: Ball | null = null
    let nearestDist = Infinity
    for (const b of ballsRef.current) {
      if (b.dead) continue
      const d = Math.hypot(b.x - tx, b.y - ty)
      if (d < nearestDist) { nearestDist = d; nearest = b }
    }

    if (nearest && nearestDist <= KICK_RADIUS) {
      const dx = nearest.x - tx, dy = nearest.y - ty
      const len = Math.hypot(dx, dy) || 1
      const power = 15 + Math.random() * 5
      nearest.vx = (dx / len) * power
      nearest.vy = (dy / len) * power - 4
      nearest.spin = (Math.random() - 0.5) * 18
      haptic.light()
      kicksRef.current += 1
      setKicks(k => k + 1)
    }
  }, [])

  const restartGame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    ballsLeftRef.current = numBalls
    gameOverRef.current = false
    kicksRef.current = 0
    savedRef.current = false
    sessionStartRef.current = Date.now()
    particlesRef.current = []
    ballsRef.current = Array.from({ length: numBalls }, () =>
      randomBall(canvas.width, canvas.height)
    )
    setBallsLeft(numBalls)
    setKicks(0)
    setGameOver(false)
  }, [numBalls])

  const fmt = (n: number) => n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n)

  const isNewPB = gameOver && kicks > 0 && kicks >= personalBest

  return (
    <div className="fixed inset-0 bg-[#0A0E1A] overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        onPointerDown={handleTap}
        style={{ touchAction: 'none' }}
      />

      {/* hint */}
      {kicks === 0 && !gameOver && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full pointer-events-none select-none">
          <p className="text-white/20 text-[11px] animate-pulse">Tap a ball to kick it — don't let it hit the ground!</p>
        </div>
      )}

      {/* ── Back button ── */}
      <button
        onClick={() => { saveSession(); onBack() }}
        className="absolute top-12 left-4 z-20 flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-white/20 active:scale-95 transition"
        style={{ backdropFilter: 'blur(12px)', background: 'rgba(255,255,255,0.08)' }}
      >
        <span className="material-symbols-outlined text-white text-base">arrow_back</span>
        <span className="text-white text-xs font-semibold">Hub</span>
      </button>

      {/* ── Balls remaining ── */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-1 px-3 py-1.5 rounded-full border border-white/10"
        style={{ background: 'rgba(10,14,26,0.7)', backdropFilter: 'blur(8px)' }}>
        {Array.from({ length: numBalls }).map((_, i) => (
          <span key={i} className={`text-sm transition-opacity duration-300 ${i < ballsLeft ? 'opacity-100' : 'opacity-15'}`}>🏈</span>
        ))}
      </div>

      {/* ── Kick counter ── */}
      {kicks > 0 && (
        <div className="absolute top-12 right-4 z-20 px-3 py-1.5 rounded-full border border-[#D4AF37]/30 text-[11px] font-bold text-[#D4AF37]"
          style={{ background: 'rgba(212,175,55,0.1)', backdropFilter: 'blur(8px)' }}>
          ⚡ {kicks}
          {personalBest > 0 && <span className="text-[9px] text-[#D4AF37]/50 ml-1">/ {personalBest} PB</span>}
        </div>
      )}

      {/* ── Leaderboard toggle ── */}
      <button
        onClick={() => setShowLeaderboard(v => !v)}
        className="absolute top-24 right-4 z-20 w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 transition active:scale-95"
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
        </div>
      )}

      {/* ── Game Over overlay ── */}
      {gameOver && (
        <div className="absolute inset-0 z-40 flex items-center justify-center"
          style={{ background: 'rgba(10,14,26,0.88)', backdropFilter: 'blur(8px)' }}>
          <div className="text-center px-8 space-y-5">
            <div className="text-5xl">{isNewPB ? '🏆' : '🏈'}</div>
            <div>
              <p className="text-white font-bold text-2xl" style={{ fontFamily: 'Playfair Display, serif' }}>
                {isNewPB ? 'New Best!' : 'Game Over'}
              </p>
              <p className="text-gray-400 text-sm mt-1">You kicked the ball {kicks} time{kicks !== 1 ? 's' : ''}</p>
            </div>
            {isNewPB && (
              <div className="px-4 py-2 rounded-xl border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-bold"
                style={{ background: 'rgba(212,175,55,0.1)' }}>
                🎉 Personal Best: {kicks} kicks
              </div>
            )}
            {!isNewPB && personalBest > 0 && (
              <p className="text-gray-500 text-xs">Personal best: {personalBest} kicks</p>
            )}
            <div className="flex flex-col space-y-2 pt-2">
              <button
                onClick={restartGame}
                className="w-full py-3 rounded-xl text-sm font-bold text-black bg-[#D4AF37] active:scale-95 transition"
              >
                Play Again
              </button>
              <button
                onClick={() => { onBack() }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-300 border border-white/10 active:scale-95 transition"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                Back to Hub
              </button>
            </div>
          </div>
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
  tierLabel: string
}) {
  const router = useRouter()
  const personalBest = typeof window !== 'undefined'
    ? parseInt(localStorage.getItem(PB_KEY) ?? '0', 10)
    : 0

  const games = [
    {
      id: 'ball',
      icon: 'sports_football',
      name: `${PRIMARY_CUSTOM_ASSET_CODE} Ball`,
      description: 'Keep the ball in the air — don\'t let it hit the ground',
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
      <div className="sticky top-0 z-40 px-4 pt-3 pb-2 border-b border-white/5"
        style={{ background: 'rgba(10,14,26,0.95)', backdropFilter: 'blur(20px)' }}>
        <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
          Game Hub
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">More {PRIMARY_CUSTOM_ASSET_CODE} = more balls in the game</p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Balls card */}
        <div className="rounded-2xl p-4 border border-[#D4AF37]/30"
          style={{ background: 'rgba(212,175,55,0.06)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-[#D4AF37]/70 uppercase tracking-widest font-semibold mb-1">Your Balls</p>
              <div className="flex items-baseline space-x-2">
                <span className="text-5xl font-bold text-[#D4AF37]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {totalPoints}
                </span>
                <span className="text-xl">🏈</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                {totalPoints === 1 ? 'You start each round with 1 ball' : `You start each round with ${totalPoints} balls`}
              </p>
            </div>
            {personalBest > 0 && (
              <div className="text-right">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider">Best</p>
                <p className="text-lg font-bold text-[#D4AF37]">{personalBest} ⚡</p>
              </div>
            )}
          </div>

          <div className="space-y-1.5 mb-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Base (all players)</span>
              <span className="text-white font-semibold">1 ball</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Tier ({tierLabel})</span>
              <span className="text-white font-semibold">+{tierPoints} ball{tierPoints !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Referrals</span>
              <span className="text-gray-500">+0 balls</span>
            </div>
          </div>

          <button
            onClick={() => { haptic.light(); router.push('/buy') }}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-black bg-[#D4AF37] active:scale-95 transition"
          >
            Buy {PRIMARY_CUSTOM_ASSET_LABEL} for more balls
          </button>
        </div>

        {/* How to earn */}
        <div className="rounded-2xl p-4 border border-white/10"
          style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }}>
          <p className="text-xs font-bold text-white mb-3">How to earn more balls</p>
          <div className="space-y-3">
            {[
              {
                icon: 'workspace_premium',
                label: 'Tier Level',
                desc: `Tier 1 = +1 ball, Tier 2 = +2, etc. You get +${tierPoints} from ${tierLabel}.`,
              },
              {
                icon: 'group_add',
                label: 'Referrals',
                desc: '+1 ball per person you bring (coming soon)',
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
                  game.unlocked ? 'border-[#D4AF37]/25' : 'border-white/8 opacity-60'
                }`}
                style={{
                  background: game.unlocked ? 'rgba(212,175,55,0.05)' : 'rgba(255,255,255,0.02)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <div className="flex items-start justify-between">
                  <span className={`material-symbols-outlined text-2xl ${game.unlocked ? 'text-[#D4AF37]' : 'text-gray-600'}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}>
                    {game.icon}
                  </span>
                  {!game.unlocked && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-white/10 text-gray-500 uppercase tracking-wider">
                      Soon
                    </span>
                  )}
                </div>
                <div>
                  <p className={`text-xs font-bold leading-tight ${game.unlocked ? 'text-white' : 'text-gray-500'}`}>
                    {game.name}
                  </p>
                  <p className="text-[9px] text-gray-600 leading-snug mt-0.5">{game.description}</p>
                </div>
                {game.cost > 0 && (
                  <div className="text-[9px] font-semibold text-gray-600">
                    {game.cost} balls to play
                  </div>
                )}
                {game.unlocked && game.onPlay && (
                  <button
                    onClick={() => { haptic.medium(); game.onPlay!() }}
                    className="w-full py-2 rounded-xl text-[11px] font-bold text-black bg-[#D4AF37] active:scale-95 transition"
                  >
                    Play
                  </button>
                )}
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
  const totalPoints = 1 + getTotalPoints(balance) // 1 base + tier/referral balls
  const currentTier = getTierForBalance(balance)
  const tierLabel = currentTier.label

  useTelegramBack(useCallback(() => {
    if (view === 'playing') setView('hub')
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

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
import ModePicker, { type QuizMode } from '@/components/quiz/ModePicker'
import QuizSession from '@/components/quiz/QuizSession'
import ResultScreen from '@/components/quiz/ResultScreen'

// ── Physics ───────────────────────────────────────────────────────────────────
const GRAVITY = 0.22
const BOUNCE = 0.52
const FRICTION = 0.88
const SPIN_DECAY = 0.96
const TRAIL_LENGTH = 8
const KICK_RADIUS = 160
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

type GameView = 'hub' | 'playing' | 'lucky' | 'quiz-pick' | 'quiz' | 'quiz-result'
const LUCKY_BALLS_REQUIRED = 3
const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

// ── Lucky Draw ────────────────────────────────────────────────────────────────
interface Prize {
  label: string
  emoji: string
  color: string
  weight: number   // out of 1000 total
  isNSAFL?: boolean
  isXLM?: boolean
  amount?: number
}

// Total weight = 1000
// 1000 XLM: 1% | 100 XLM: 2% | 100 NSAFL: 3% | 50 NSAFL: 4% | 25 NSAFL: 5% | rest split evenly
const PRIZES: Prize[] = [
  { label: '1000 XLM', emoji: '💎', color: '#0a3d62', weight: 10,  isXLM: true,   amount: 1000 },
  { label: '100 XLM',  emoji: '✨', color: '#1e6091', weight: 20,  isXLM: true,   amount: 100  },
  { label: '100 NSAFL',emoji: '🏆', color: '#b7791f', weight: 30,  isNSAFL: true, amount: 100  },
  { label: '50 NSAFL', emoji: '🥇', color: '#D4AF37', weight: 40,  isNSAFL: true, amount: 50   },
  { label: '25 NSAFL', emoji: '🥈', color: '#c8a030', weight: 50,  isNSAFL: true, amount: 25   },
  { label: '+1 Ball',  emoji: '🎯', color: '#1a5c2e', weight: 170 },
  { label: 'Free Spin',emoji: '🔄', color: '#1a4a8a', weight: 170 },
  { label: 'Top Badge',emoji: '⭐', color: '#4a1070', weight: 170 },
  { label: 'Try Again',emoji: '😔', color: '#2d3748', weight: 170 },
  { label: 'Better Luck',emoji:'💨',color: '#1a202c', weight: 170 },
]

// weighted random pick
function pickPrize(): number {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0)
  let r = Math.random() * total
  for (let i = 0; i < PRIZES.length; i++) {
    r -= PRIZES[i].weight
    if (r <= 0) return i
  }
  return PRIZES.length - 1
}

function LuckyDraw({ onBack, stellarAddress, totalBalls, onBallWon, initialCanSpin, initialSpinsRemaining, initialDailyLimit }: { onBack: () => void; stellarAddress: string | null; totalBalls: number; onBallWon: () => void; initialCanSpin: boolean; initialSpinsRemaining: number; initialDailyLimit: number }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const angleRef = useRef(0)
  const targetAngleRef = useRef(0)
  const targetPrizeIdxRef = useRef(0)
  const segCount = PRIZES.length
  const segAngle = (Math.PI * 2) / segCount

  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<Prize | null>(null)
  const [freeSpin, setFreeSpin] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [winCode, setWinCode] = useState<string | null>(null)
  const [recentWins, setRecentWins] = useState<{ telegram_id: number; prize: string; created_at: string }[]>([])

  useEffect(() => {
    fetch('/api/game/wins')
      .then(r => r.json())
      .then(j => { if (j.success) setRecentWins(j.data) })
      .catch(() => null)
  }, [])

  // ── Spins-per-day (initialised from parent, which already fetched) ──────────
  const [canSpin, setCanSpin] = useState(initialCanSpin)
  const [spinsRemaining, setSpinsRemaining] = useState(initialSpinsRemaining)
  const [dailySpinLimit] = useState(initialDailyLimit)
  const spinStatusLoaded = true

  // ── Draw ───────────────────────────────────────────────────────────────────
  const drawWheel = useCallback((angle: number) => {
    const canvas = canvasRef.current
    if (!canvas || canvas.width === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height
    const cx = W / 2, cy = H / 2
    const r = Math.min(W, H) * 0.42

    ctx.clearRect(0, 0, W, H)

    // outer shadow ring
    ctx.beginPath()
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(212,175,55,0.15)'
    ctx.fill()

    for (let i = 0; i < segCount; i++) {
      const start = angle + i * segAngle - Math.PI / 2
      const end = start + segAngle
      const prize = PRIZES[i]
      const midAngle = start + segAngle / 2

      // segment fill with subtle radial gradient
      const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r)
      grad.addColorStop(0, prize.color + 'dd')
      grad.addColorStop(1, prize.color + '99')

      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, start, end)
      ctx.closePath()
      ctx.fillStyle = grad
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // text along segment midpoint
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(midAngle)
      // emoji
      ctx.font = `${r * 0.13}px serif`
      ctx.textAlign = 'center'
      ctx.fillText(prize.emoji, r * 0.72, r * 0.06)
      // label
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.font = `bold ${r * 0.085}px Inter,sans-serif`
      ctx.shadowColor = 'rgba(0,0,0,0.8)'
      ctx.shadowBlur = 4
      ctx.fillText(prize.label, r * 0.72, -r * 0.07)
      ctx.shadowBlur = 0
      ctx.restore()
    }

    // gold outer ring
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = '#D4AF37'
    ctx.lineWidth = 6
    ctx.stroke()

    // inner divider ring
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2)
    ctx.fillStyle = '#0A0E1A'
    ctx.fill()
    ctx.strokeStyle = '#D4AF37'
    ctx.lineWidth = 3
    ctx.stroke()

    // hub dot
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.07, 0, Math.PI * 2)
    ctx.fillStyle = '#D4AF37'
    ctx.fill()

    // pointer triangle at top (outside ring)
    const pSize = Math.max(14, r * 0.08)
    ctx.beginPath()
    ctx.moveTo(cx, cy - r + 2)
    ctx.lineTo(cx - pSize, cy - r - pSize * 1.8)
    ctx.lineTo(cx + pSize, cy - r - pSize * 1.8)
    ctx.closePath()
    ctx.fillStyle = '#D4AF37'
    ctx.shadowColor = 'rgba(212,175,55,0.8)'
    ctx.shadowBlur = 10
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#0A0E1A'
    ctx.lineWidth = 2
    ctx.stroke()
  }, [segAngle, segCount])

  // size canvas once the wrapper has dimensions
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const sz = Math.min(wrap.clientWidth, wrap.clientHeight, 420)
      canvas.width = sz
      canvas.height = sz
      drawWheel(angleRef.current)
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [drawWheel])

  // smooth spin via ease-out cubic interpolation
  const spinStartAngleRef = useRef(0)
  const spinStartTimeRef = useRef(0)
  const SPIN_DURATION_MS = 3800

  // RAF loop
  useEffect(() => {
    let done = false
    function tick() {
      if (done) return
      if (spinning) {
        const elapsed = Date.now() - spinStartTimeRef.current
        const t = Math.min(elapsed / SPIN_DURATION_MS, 1)
        // ease-out cubic: starts fast, decelerates smoothly to stop
        const eased = 1 - Math.pow(1 - t, 3)
        angleRef.current = spinStartAngleRef.current + eased * (targetAngleRef.current - spinStartAngleRef.current)
        if (t >= 1) {
          angleRef.current = targetAngleRef.current
          setSpinning(false)
          setResult(PRIZES[targetPrizeIdxRef.current])
        }
      }
      drawWheel(angleRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { done = true; cancelAnimationFrame(rafRef.current) }
  }, [spinning, drawWheel])

  // spin trigger
  const handleSpin = useCallback(() => {
    if (!canSpin || spinning) return
    const idx = pickPrize()
    targetPrizeIdxRef.current = idx
    // Pointer is at top. Segment i is centered at: angle + i*segAngle - π/2 + segAngle/2
    // For segment idx center to hit top (-π/2), we need:
    //   targetAngle ≡ -(idx + 0.5) * segAngle  (mod 2π)
    const PI2 = Math.PI * 2
    const desiredMod = ((-(idx + 0.5) * segAngle) % PI2 + PI2) % PI2
    const currentMod = ((angleRef.current % PI2) + PI2) % PI2
    const delta = ((desiredMod - currentMod) + PI2) % PI2
    const fullRotations = (6 + Math.floor(Math.random() * 4)) * PI2
    spinStartAngleRef.current = angleRef.current
    targetAngleRef.current = angleRef.current + fullRotations + delta
    spinStartTimeRef.current = Date.now()
    setResult(null)
    setSpinning(true)
    haptic.medium()
    if (!freeSpin) {
      const next = spinsRemaining - 1
      setSpinsRemaining(next)
      setCanSpin(next > 0)
    }
    setFreeSpin(false)
  }, [canSpin, spinning, freeSpin, segAngle, spinsRemaining])

  // result effects
  useEffect(() => {
    if (!result) return
    if (result.label === 'Free Spin') {
      haptic.success()
      setTimeout(() => { setFreeSpin(true); setResult(null) }, 2200)
    } else if (result.isNSAFL || result.isXLM) {
      haptic.success()
      const tag = result.isXLM ? `${result.amount}XLM` : `${result.amount}NSAFL`
      const code = `WIN-${tag}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`
      setWinCode(code)
      fetch('/api/game/win', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
        body: JSON.stringify({ prize: result.label, amount: result.amount, code, wallet: stellarAddress }),
        keepalive: true,
      }).catch(() => null)
    } else if (result.label === '+1 Ball') {
      haptic.success()
      onBallWon()
    } else {
      haptic.warning()
    }
    // confetti for any win
    if (result.isNSAFL || result.isXLM || result.label === '+1 Ball') {
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 2500)
    }
  }, [result, stellarAddress])

  const isWin = result && (result.isNSAFL || result.isXLM || result.label === '+1 Ball')

  return (
    <div className="fixed inset-0 flex flex-col overflow-y-auto"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.08) 0%, #0A0E1A 60%)' }}>
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
        <button onClick={onBack}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-white/20 active:scale-95 transition"
          style={{ backdropFilter: 'blur(12px)', background: 'rgba(255,255,255,0.07)' }}>
          <span className="material-symbols-outlined text-white text-base">arrow_back</span>
          <span className="text-white text-xs font-semibold">Hub</span>
        </button>
        <div className="text-center">
          <p className="text-[#D4AF37] font-bold text-xl tracking-wide" style={{ fontFamily: 'Playfair Display, serif' }}>
            Lucky Draw
          </p>
          <p className="text-white/40 text-[10px] mt-0.5">
            {!spinStatusLoaded ? '⏳ Checking…' : freeSpin ? '🔄 Free spin ready!' : canSpin
              ? `${spinsRemaining} of ${dailySpinLimit} spin${dailySpinLimit !== 1 ? 's' : ''} remaining today`
              : '⏳ No spins left today — come back tomorrow'}
          </p>
        </div>
        <div className="w-16" />
      </div>

      {/* recent winners ticker */}
      {recentWins.length > 0 && (
        <div className="px-4 mb-1 flex-shrink-0">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-[#D4AF37]/20"
            style={{ background: 'rgba(212,175,55,0.06)' }}>
            <span className="text-[9px] text-[#D4AF37] font-bold whitespace-nowrap">🏆 LATEST WIN</span>
            <p className="text-[9px] text-gray-400 truncate flex-1">
              {recentWins[0].prize} · {new Date(recentWins[0].created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}

      {/* wheel */}
      <div ref={wrapRef} className="flex items-center justify-center px-1 py-2 relative">
        {/* glow ring behind wheel */}
        <div className="absolute rounded-full pointer-events-none"
          style={{
            width: 320, height: 320,
            background: 'radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)',
            filter: 'blur(24px)',
          }} />
        <canvas ref={canvasRef} style={{ touchAction: 'none', display: 'block', position: 'relative', zIndex: 1 }} />
      </div>

      {/* confetti */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 100 }}>
          {[...Array(10)].map((_, i) => {
            const colors = ['#D4AF37','#f0d060','#4ade80','#60a5fa','#f472b6','#a78bfa','#fb923c','#34d399']
            const color = colors[i % colors.length]
            const left = 5 + (i * 9.5)
            const size = 8 + (i % 3) * 4
            const delay = (i * 0.18).toFixed(2)
            const duration = (1.8 + (i % 4) * 0.25).toFixed(2)
            return (
              <div key={i} style={{
                position: 'absolute',
                left: `${left}%`,
                top: 0,
                width: size,
                height: size,
                borderRadius: i % 2 === 0 ? '50%' : '2px',
                background: color,
                animation: `confetti-fall ${duration}s ease-in ${delay}s both`,
              }} />
            )
          })}
        </div>
      )}

      {/* result banner */}
      {result && (
        <div className="px-4 mb-2 flex-shrink-0" style={{ animation: 'result-pop 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <div className={`rounded-3xl px-5 py-4 border text-center ${isWin ? 'border-[#D4AF37]/60' : 'border-white/10'}`}
            style={{
              background: isWin ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.03)',
              boxShadow: isWin ? '0 0 32px rgba(212,175,55,0.2)' : 'none',
            }}>
            <p className="text-4xl mb-1">{result.emoji}</p>
            <p className={`text-lg font-bold ${isWin ? 'text-[#D4AF37]' : 'text-gray-400'}`}>{result.label}</p>
            {result.label === 'Free Spin' && (
              <p className="text-xs text-[#D4AF37]/70 mt-1">Spinning again in a moment...</p>
            )}
            {(result.isNSAFL || result.isXLM) && (
              <div className="mt-3 space-y-2">
                {winCode && (
                  <>
                    <p className="text-[11px] text-gray-400">
                      Screenshot & DM <span className="text-[#D4AF37] font-bold">@NSAFL_bot</span> to claim
                    </p>
                    <div className="px-3 py-2 rounded-xl border border-[#D4AF37]/40 text-[11px] text-[#D4AF37] font-mono font-bold tracking-widest"
                      style={{ background: 'rgba(212,175,55,0.08)' }}>{winCode}</div>
                  </>
                )}
                {stellarAddress && (
                  <p className="text-[9px] text-gray-600 font-mono break-all">
                    {stellarAddress.slice(0, 8)}...{stellarAddress.slice(-8)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* spin button */}
      <div className="px-4 pb-8 flex-shrink-0 space-y-2">
        {canSpin || freeSpin ? (
          <button onClick={handleSpin} disabled={spinning || !spinStatusLoaded}
            className="w-full py-4 rounded-2xl text-base font-bold text-black active:scale-95 transition disabled:opacity-50"
            style={{
              background: spinning
                ? '#a08020'
                : 'linear-gradient(135deg, #D4AF37 0%, #f0d060 50%, #D4AF37 100%)',
              boxShadow: spinning ? 'none' : '0 4px 24px rgba(212,175,55,0.4)',
            }}>
            <span style={spinning ? { animation: 'spin-pulse 1s ease-in-out infinite', display: 'inline-block' } : {}}>
              {spinning ? '⏳ Spinning...' : freeSpin ? '🔄 Free Spin!' : '🎰 Spin the Wheel'}
            </span>
          </button>
        ) : (
          <>
            <div className="w-full py-3 rounded-2xl border border-white/10 text-center text-xs text-gray-500"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              ⏳ Spins reset in 24h · earn more balls = more spins
            </div>
            <button onClick={onBack}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-gray-300 border border-white/10 active:scale-95 transition"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              Back to Hub
            </button>
          </>
        )}
        <p className="text-center text-[10px] text-gray-700">
          {totalBalls} spin{totalBalls !== 1 ? 's' : ''} per day · requires {LUCKY_BALLS_REQUIRED} balls to unlock
        </p>
      </div>
    </div>
  )
}

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
function HubView({ onPlay, onLucky, onQuiz, totalPoints, tierPoints, tierLabel, referralBalls, bonusBalls, quizPoints, luckyCanSpin, luckySpinsRemaining, luckyDailyLimit }: {
  onPlay: () => void
  onLucky: () => void
  onQuiz: () => void
  totalPoints: number
  tierPoints: number
  tierLabel: string
  referralBalls: number
  bonusBalls: number
  quizPoints: number
  luckyCanSpin: boolean
  luckySpinsRemaining: number
  luckyDailyLimit: number
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
      description: luckyCanSpin
        ? `${luckySpinsRemaining} of ${luckyDailyLimit} spin${luckyDailyLimit !== 1 ? 's' : ''} left today`
        : 'No spins left today — come back tomorrow',
      cost: LUCKY_BALLS_REQUIRED,
      unlocked: (DEV_BYPASS || totalPoints >= LUCKY_BALLS_REQUIRED) && luckyCanSpin,
      onPlay: onLucky,
      lockReason: totalPoints < LUCKY_BALLS_REQUIRED
        ? `Need ${LUCKY_BALLS_REQUIRED} balls to unlock`
        : 'No spins remaining today',
    },
    {
      id: 'quiz',
      icon: 'quiz',
      name: `${PRIMARY_CUSTOM_ASSET_CODE} Quiz`,
      description: 'Answer AFL & WAFL trivia questions',
      cost: 0,
      unlocked: true,
      onPlay: onQuiz,
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
              {referralBalls > 0
                ? <span className="text-white font-semibold">+{referralBalls} ball{referralBalls !== 1 ? 's' : ''}</span>
                : <span className="text-gray-600">+0 (invite friends!)</span>}
            </div>
            {bonusBalls > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Lucky Draw wins</span>
                <span className="text-white font-semibold">+{bonusBalls} ball{bonusBalls !== 1 ? 's' : ''}</span>
              </div>
            )}
            {quizPoints > 0 && (
              <div className="flex items-center justify-between text-xs py-1 border-t border-white/5">
                <span className="text-gray-400 flex items-center space-x-1">
                  <span className="material-symbols-outlined text-purple-400 text-sm">quiz</span>
                  <span>Quiz points earned</span>
                </span>
                <span className="font-bold text-purple-300">+{quizPoints}</span>
              </div>
            )}
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
                desc: referralBalls > 0
                  ? `You have ${referralBalls} referral ball${referralBalls !== 1 ? 's' : ''} · invite more friends!`
                  : '+1 ball per person you bring · share your referral link',
                muted: referralBalls === 0,
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

        {/* Quiz card */}
        <div
          onClick={onQuiz}
          className="glass-card rounded-2xl p-5 cursor-pointer hover:bg-white/5 active:scale-[0.98] transition border border-purple-500/20"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-purple-400 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>quiz</span>
              </div>
              <div>
                <p className="text-base font-bold text-white">AFL/WAFL Quiz</p>
                <p className="text-xs text-gray-400">Test your footy knowledge</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-gray-500">chevron_right</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Quick', q: '5 Q', color: 'text-blue-300' },
              { label: 'Standard', q: '10 Q', color: 'text-[#D4AF37]' },
              { label: 'Champion', q: '20 Q', color: 'text-purple-400' },
            ].map(({ label, q, color }) => (
              <div key={label} className="bg-white/3 rounded-lg py-1.5 text-center border border-white/8">
                <p className={`text-xs font-bold ${color}`}>{label}</p>
                <p className="text-[9px] text-gray-500">{q}</p>
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
                      {'lockReason' in game ? '🔒' : 'Soon'}
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
const BONUS_BALLS_KEY = 'nsafl_bonus_balls'

export default function GamePage() {
  const [view, setView] = useState<GameView>('hub')

  const tokenBalance = useWalletStore((s) => s.tokenBalance)
  const stellarAddress = useWalletStore((s) => s.stellarAddress)
  const balance = parseFloat(tokenBalance) || 0
  const tierPoints = getPointsFromTier(balance)
  const currentTier = getTierForBalance(balance)
  const tierLabel = currentTier.label

  // Referral balls — fetched from API
  const [referralBalls, setReferralBalls] = useState(0)
  // Bonus balls won via Lucky Draw "+1 Ball" prize — persisted in localStorage
  const [bonusBalls, setBonusBalls] = useState(() => {
    if (typeof window === 'undefined') return 0
    return parseInt(localStorage.getItem(BONUS_BALLS_KEY) ?? '0', 10)
  })

  useEffect(() => {
    fetch('/api/user/referrals', {
      headers: { 'x-telegram-init-data': getTelegramInitData() },
    })
      .then(r => r.json())
      .then(j => { if (j.success) setReferralBalls(j.data?.referralCount ?? 0) })
      .catch(() => null)
  }, [])

  const [quizMode, setQuizMode] = useState<QuizMode | null>(null)
  const [quizSessionId, setQuizSessionId] = useState<string>('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [quizQuestions, setQuizQuestions] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [quizResult, setQuizResult] = useState<any>(null)
  const [playsLeft, setPlaysLeft] = useState<Record<string, number>>({ quick: 3, standard: 3, champion: 3 })
  const [quizPoints, setQuizPoints] = useState(0)

  // ── Lucky Draw spin status (fetched here so HubView can disable the button) ─
  const [luckyCanSpin, setLuckyCanSpin] = useState(DEV_BYPASS)
  const [luckySpinsRemaining, setLuckySpinsRemaining] = useState(DEV_BYPASS ? 99 : 0)
  const [luckyDailyLimit, setLuckyDailyLimit] = useState(DEV_BYPASS ? 99 : 0)

  useEffect(() => {
    if (DEV_BYPASS) return
    fetch('/api/game/win', { headers: { 'x-telegram-init-data': getTelegramInitData() } })
      .then(r => r.json())
      .then(j => {
        const d = j.data ?? j
        setLuckyCanSpin(d.canSpin ?? false)
        setLuckySpinsRemaining(d.spinsRemaining ?? 0)
        setLuckyDailyLimit(d.dailyLimit ?? 1)
      })
      .catch(() => setLuckyCanSpin(false))
  }, [])

  useEffect(() => {
    fetch('/api/quiz/status', { headers: { 'x-telegram-init-data': getTelegramInitData() } })
      .then(r => r.json())
      .then(j => {
        const d = j.data ?? j
        if (d.playsLeft) setPlaysLeft(d.playsLeft)
        if (d.quizPoints !== undefined) setQuizPoints(d.quizPoints)
      }).catch(() => {})
  }, [])

  const addBonusBall = useCallback(() => {
    setBonusBalls(prev => {
      const next = prev + 1
      localStorage.setItem(BONUS_BALLS_KEY, String(next))
      return next
    })
  }, [])

  const totalPoints = 1 + getTotalPoints(balance) + referralBalls + bonusBalls

  const startQuiz = async (mode: QuizMode) => {
    haptic.light()
    try {
      const res = await fetch(`/api/quiz/session?mode=${mode.id}`, {
        headers: { 'x-telegram-init-data': getTelegramInitData() },
      })
      const json = await res.json()
      const data = json.data ?? json
      if (!res.ok) {
        alert(data.error ?? 'Could not start quiz')
        return
      }
      setQuizMode(mode)
      setQuizSessionId(data.sessionId)
      setQuizQuestions(data.questions)
      setPlaysLeft(prev => ({ ...prev, [mode.id]: data.playsRemainingToday }))
      setView('quiz')
    } catch {
      alert('Network error — please try again')
    }
  }

  useTelegramBack(useCallback(() => {
    if (view === 'quiz') setView('quiz-pick')
    else if (view === 'quiz-pick' || view === 'quiz-result') setView('hub')
    else if (view !== 'hub') setView('hub')
  }, [view]))

  return (
    <WalletGuard>
      {view === 'playing' ? (
        <CanvasGame
          numBalls={totalPoints}
          onBack={() => setView('hub')}
        />
      ) : view === 'lucky' ? (
        <LuckyDraw
          onBack={() => setView('hub')}
          stellarAddress={stellarAddress}
          totalBalls={totalPoints}
          onBallWon={addBonusBall}
          initialCanSpin={luckyCanSpin}
          initialSpinsRemaining={luckySpinsRemaining}
          initialDailyLimit={luckyDailyLimit}
        />
      ) : view === 'quiz-pick' ? (
        <ModePicker
          playsLeft={playsLeft}
          onSelect={startQuiz}
          onBack={() => setView('hub')}
        />
      ) : view === 'quiz' && quizMode && quizSessionId ? (
        <QuizSession
          mode={quizMode}
          sessionId={quizSessionId}
          questions={quizQuestions}
          onComplete={(result) => { setQuizResult(result); setView('quiz-result') }}
          onBack={() => setView('hub')}
        />
      ) : view === 'quiz-result' && quizResult ? (
        <ResultScreen
          result={quizResult}
          modeName={quizMode?.label ?? 'Quiz'}
          onPlayAgain={() => setView('quiz-pick')}
          onBack={() => setView('hub')}
        />
      ) : (
        <>
          <HubView
            onPlay={() => setView('playing')}
            onLucky={() => setView('lucky')}
            onQuiz={() => setView('quiz-pick')}
            totalPoints={totalPoints}
            tierPoints={tierPoints}
            referralBalls={referralBalls}
            bonusBalls={bonusBalls}
            tierLabel={tierLabel}
            quizPoints={quizPoints}
            luckyCanSpin={luckyCanSpin}
            luckySpinsRemaining={luckySpinsRemaining}
            luckyDailyLimit={luckyDailyLimit}
          />
          <BottomNav />
        </>
      )}
    </WalletGuard>
  )
}

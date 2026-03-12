'use client'
import { useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { NAV_ITEMS } from '@/lib/constants'
import { haptic } from '@/lib/telegram-ui'

const LONG_PRESS_MS = 1500

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number>(0)
  const pressStartRef = useRef(0)
  const firedRef = useRef(false)
  const longPressReadyRef = useRef(false)

  const [charge, setCharge] = useState(0) // 0–1
  const [launched, setLaunched] = useState(false)

  const startPress = useCallback(() => {
    pressStartRef.current = Date.now()
    firedRef.current = false
    longPressReadyRef.current = false
    setCharge(0)
    setLaunched(false)

    // animate charge bar
    const tick = () => {
      const elapsed = Date.now() - pressStartRef.current
      const pct = Math.min(elapsed / LONG_PRESS_MS, 1)
      setCharge(pct)
      if (pct < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    // haptic ticks
    timerRef.current = setTimeout(() => {
      haptic.light()
    }, LONG_PRESS_MS * 0.5)

    setTimeout(() => {
      if (!firedRef.current) haptic.medium()
    }, LONG_PRESS_MS * 0.9)

    // mark long press ready — actual navigation fires on pointer release
    setTimeout(() => {
      if (firedRef.current) return
      longPressReadyRef.current = true
      setLaunched(true)
      haptic.success()
      cancelAnimationFrame(rafRef.current)
      setCharge(1)
    }, LONG_PRESS_MS)
  }, [router])

  const endPress = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (firedRef.current) return
    firedRef.current = true
    if (longPressReadyRef.current) {
      // long press completed — navigate to game
      router.push('/game')
    } else {
      // short press — go home
      setCharge(0)
      setLaunched(false)
      router.push('/')
    }
  }, [router])

  const cancelPress = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!firedRef.current) {
      firedRef.current = true
      setCharge(0)
    }
  }, [])

  const scale = launched ? 1.9 : 1 + charge * 0.55
  const glowPx = 20 + charge * 60
  const ringOpacity = charge > 0 ? charge * 0.6 : 0
  const ringSize = 48 + charge * 32

  return (
    <nav className="fixed bottom-0 w-full bg-[#0A0E1A]/90 backdrop-blur-xl border-t border-white/10 pb-safe pt-2 px-4 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      <div className="flex justify-between items-center pb-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          if (item.isCenter) {
            return (
              <div key={item.href} className="relative -top-5 flex flex-col items-center justify-center">
                {/* expanding ring */}
                <div
                  className="absolute rounded-full border border-[#D4AF37] pointer-events-none"
                  style={{
                    width: ringSize,
                    height: ringSize,
                    opacity: ringOpacity,
                    transition: 'opacity 0.1s',
                  }}
                />
                <button
                  onPointerDown={startPress}
                  onPointerUp={endPress}
                  onPointerLeave={cancelPress}
                  onPointerCancel={cancelPress}
                  style={{
                    touchAction: 'none',
                    transform: `scale(${scale})`,
                    transition: launched ? 'transform 0.18s ease-out' : 'none',
                    boxShadow: `0 0 ${glowPx}px rgba(212,175,55,0.85)`,
                    willChange: 'transform',
                  }}
                  className="w-12 h-12 bg-[#D4AF37] text-black rounded-full flex items-center justify-center border-4 border-[#0A0E1A] select-none"
                >
                  <span
                    className="material-symbols-outlined text-2xl"
                    style={{
                      animation: charge > 0
                        ? `spin ${Math.max(0.15, 0.6 - charge * 0.45)}s linear infinite`
                        : 'ball-pulse 2s ease-in-out infinite',
                    }}
                  >
                    sports_football
                  </span>
                </button>
                <span className="text-[8px] text-[#D4AF37]/60 font-semibold tracking-wide mt-1 select-none">
                  {charge > 0 ? 'release!' : 'hold to play'}
                </span>
              </div>
            )
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center space-y-0.5 transition ${
                isActive ? 'text-[#D4AF37]' : 'text-gray-500 hover:text-[#D4AF37]'
              }`}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              <span className="text-[9px] font-medium tracking-wide uppercase">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>

      {/* charge bar */}
      {charge > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
          <div
            className="h-full bg-[#D4AF37] transition-none"
            style={{ width: `${charge * 100}%` }}
          />
        </div>
      )}
    </nav>
  )
}

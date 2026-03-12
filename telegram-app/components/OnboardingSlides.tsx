'use client'
import { useState, useRef } from 'react'

interface Props {
  onDone: () => void
}

const SLIDES = [
  {
    icon: 'sports_football',
    title: 'Welcome to The Homecoming Hub',
    body: 'The home of $NSAFL — supporting AFL & WAFL players on their journey home.',
    showTiers: false,
  },
  {
    icon: 'account_balance_wallet',
    title: 'Connect Your Stellar Wallet',
    body: 'Hold $NSAFL tokens to earn rewards, climb tiers, and back your team\'s homecoming campaign.',
    showTiers: true,
  },
  {
    icon: 'shield',
    title: 'Pick Your Club',
    body: 'Pledge allegiance to an AFL or WAFL club. Your team identity lives on the blockchain.',
    showTiers: false,
  },
]

const TIERS = [
  { label: 'Pre-Tier', range: '0–99', color: 'text-gray-400', border: 'border-gray-600' },
  { label: 'T1 Starter', range: '100+', color: 'text-blue-400', border: 'border-blue-500/50' },
  { label: 'T10 Legend', range: '100k+', color: 'text-[#D4AF37]', border: 'border-[#D4AF37]/50' },
]

export default function OnboardingSlides({ onDone }: Props) {
  const [index, setIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const slide = SLIDES[index]
  const isLast = index === SLIDES.length - 1

  function next() {
    if (isLast) {
      onDone()
    } else {
      setIndex((i) => i + 1)
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const delta = touchStartX.current - e.changedTouches[0].clientX
    if (delta > 50 && !isLast) setIndex((i) => i + 1)
    if (delta < -50 && index > 0) setIndex((i) => i - 1)
    touchStartX.current = null
  }

  return (
    <div
      className="min-h-screen bg-[#0A0E1A] flex flex-col select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Ambient background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-80px] left-1/2 -translate-x-1/2 w-[320px] h-[320px] bg-[#D4AF37]/10 rounded-full blur-[80px]" />
      </div>

      {/* Skip link */}
      <div className="relative z-10 flex justify-end pt-4 px-6 h-12">
        {!isLast && (
          <button
            onClick={onDone}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1"
          >
            Skip
          </button>
        )}
      </div>

      {/* Slide content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center">
        {/* Icon orb */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-[#D4AF37]/20 rounded-full blur-2xl scale-150" />
          <div className="relative w-24 h-24 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.25)]">
            <span
              className="material-symbols-outlined text-[52px] text-[#D4AF37]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {slide.icon}
            </span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-4 leading-snug font-['Playfair_Display'] max-w-[280px]">
          {slide.title}
        </h1>

        {/* Body */}
        <p className="text-sm text-gray-400 leading-relaxed max-w-[280px]">
          {slide.body}
        </p>

        {/* Tier progression (slide 2 only) */}
        {slide.showTiers && (
          <div className="mt-8 flex items-center gap-2">
            {TIERS.map((tier, i) => (
              <div key={tier.label} className="flex items-center gap-2">
                <div
                  className={`px-3 py-1.5 rounded-full border text-[11px] font-semibold ${tier.color} ${tier.border} bg-white/5`}
                >
                  <div>{tier.label}</div>
                  <div className="text-[10px] opacity-70 font-normal">{tier.range}</div>
                </div>
                {i < TIERS.length - 1 && (
                  <span className="material-symbols-outlined text-gray-600 text-[16px]">
                    chevron_right
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 px-8 pb-10 flex flex-col items-center gap-6">
        {/* Dot indicators */}
        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`rounded-full transition-all duration-300 ${
                i === index
                  ? 'w-6 h-2 bg-[#D4AF37]'
                  : 'w-2 h-2 bg-white/20 hover:bg-white/40'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* CTA button */}
        <button
          onClick={next}
          className="w-full bg-[#D4AF37] text-[#0A0E1A] font-bold py-4 rounded-xl text-base transition hover:bg-[#D4AF37]/90 shadow-[0_0_20px_rgba(212,175,55,0.35)] flex items-center justify-center gap-2"
        >
          {isLast ? (
            <>
              Get Started
              <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
            </>
          ) : (
            <>
              Next
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

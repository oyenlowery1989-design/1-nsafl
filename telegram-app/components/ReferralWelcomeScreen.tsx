'use client'
import { useEffect, useState } from 'react'
import { getTelegramInitData } from '@/lib/telegram'

interface Props {
  referrerId: number
  onContinue: () => void
}

export default function ReferralWelcomeScreen({ referrerId, onContinue }: Props) {
  const [name, setName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/user/referrer?id=${referrerId}`, {
      headers: { 'x-telegram-init-data': getTelegramInitData() },
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          const n = j.data.username
            ? `@${j.data.username}`
            : (j.data.firstName ?? null)
          setName(n)
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [referrerId])

  const displayName = loading ? '…' : (name ?? 'a friend')

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center px-8 text-center select-none">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-80px] left-1/2 -translate-x-1/2 w-[320px] h-[320px] bg-[#D4AF37]/10 rounded-full blur-[80px]" />
      </div>

      {/* Icon orb */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-[#D4AF37]/20 rounded-full blur-2xl scale-150" />
        <div className="relative w-28 h-28 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center shadow-[0_0_40px_rgba(212,175,55,0.3)]">
          <span
            className="material-symbols-outlined text-[60px] text-[#D4AF37]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            handshake
          </span>
        </div>
      </div>

      {/* Text */}
      <p className="text-sm font-semibold uppercase tracking-widest text-[#D4AF37] mb-3">
        You were invited by
      </p>
      <h1 className="text-3xl font-bold text-white font-['Playfair_Display'] mb-3 leading-snug">
        {displayName}
      </h1>
      <p className="text-sm text-gray-400 max-w-[260px] leading-relaxed mb-10">
        Welcome to the NSAFL Homecoming Hub — the home of Australian football on Stellar.
      </p>

      {/* CTA */}
      <button
        onClick={onContinue}
        className="w-full max-w-xs bg-[#D4AF37] text-[#0A0E1A] font-bold py-4 rounded-xl text-base transition hover:bg-[#D4AF37]/90 shadow-[0_0_20px_rgba(212,175,55,0.4)] flex items-center justify-center gap-2"
      >
        Get Started
        <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
      </button>
    </div>
  )
}

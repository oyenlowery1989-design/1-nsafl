'use client'
import { useEffect, useState } from 'react'
import type { TelegramUser } from '@/lib/telegram'

type TelegramWindow = { Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void; initDataUnsafe?: { user?: TelegramUser } } } }

const isDev =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

export default function TelegramGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    const check = () => {
      if (isDev) { setAllowed(true); return }
      const tg = (window as TelegramWindow).Telegram?.WebApp
      if (tg && tg.initData) {
        tg.ready?.()
        tg.expand?.()
        setAllowed(true)
      } else {
        setAllowed(false)
      }
    }
    const t = setTimeout(check, 0)
    return () => clearTimeout(t)
  }, [])

  if (allowed === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0A0E1A]">
        <span
          className="material-symbols-outlined text-[#D4AF37] text-5xl"
          style={{ animation: 'spin 2s linear infinite' }}
        >
          sports_football
        </span>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0A0E1A] px-8 text-center space-y-4">
        <span className="material-symbols-outlined text-[#D4AF37] text-6xl">lock</span>
        <h1 className="text-2xl font-bold text-white">Telegram Only</h1>
        <p className="text-gray-400 text-sm">
          This app must be opened inside Telegram.
        </p>
      </div>
    )
  }

  return <>{children}</>
}

'use client'
import { useEffect, useState } from 'react'
import type { TelegramUser } from '@/lib/telegram'
import { getTelegramInitData } from '@/lib/telegram'
import { useWalletStore } from '@/hooks/useStore'

type TelegramWebApp = {
  initData?: string
  ready?: () => void
  expand?: () => void
  initDataUnsafe?: { user?: TelegramUser; start_param?: string }
}
type TelegramWindow = { Telegram?: { WebApp?: TelegramWebApp } }

// DEV_BYPASS is stripped by tree-shaking in production builds.
// The explicit NODE_ENV check is a belt-and-suspenders guard so that even if
// NEXT_PUBLIC_DEV_BYPASS is accidentally set in Vercel env vars, it never fires.
const isDev =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

// Record session — returns status + whether the user has a wallet in DB
async function recordSession(): Promise<{ status: 'ok' | 'blocked' | 'error'; hasWallet: boolean }> {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'x-telegram-init-data': getTelegramInitData() },
    })
    const j = await res.json().catch(() => ({}))
    if (!j.success && j.code === 'BLOCKED') return { status: 'blocked', hasWallet: false }
    return { status: 'ok', hasWallet: j.data?.hasWallet ?? true }
  } catch {
    return { status: 'error', hasWallet: true }
  }
}


// DevTools detection — reports once per session when devtools is opened.
// Uses a regular expression with a custom toString() that fires when DevTools
// formats console output — only triggers when the console panel is actually open.
let devtoolsReported = false
let devtoolsInterval: ReturnType<typeof setInterval> | null = null

function startDevToolsWatch(tgUser?: TelegramUser | null) {
  if (isDev) return
  const el = new Image()
  Object.defineProperty(el, 'id', {
    get() {
      if (!devtoolsReported) {
        devtoolsReported = true
        fetch('/api/trap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            devtoolsOpened: true,
            screen: `${screen.width}x${screen.height} @${devicePixelRatio}x`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language,
            url: window.location.href,
            telegramId: tgUser?.id ?? null,
            telegramUsername: tgUser?.username ?? null,
            telegramFirstName: tgUser?.first_name ?? null,
          }),
        }).catch(() => null)
      }
      return ''
    },
  })
  devtoolsInterval = setInterval(() => {
    // eslint-disable-next-line no-console
    console.log('%c', el)
  }, 3000)
}

function stopDevToolsWatch() {
  if (devtoolsInterval) {
    clearInterval(devtoolsInterval)
    devtoolsInterval = null
  }
}

// Honeypot: silently log anyone who hits the block screen (non-Telegram browser).
// Collects standard server-log data (IP via headers) + lightweight client signals.
// Deduped per browser session via sessionStorage — one record per visit, not per page load.
const ACCESS_RECORDED_KEY = 'nyseau_access_recorded'

function recordAccessAttempt(tgSdkPresent: boolean, tgSdkFake: boolean) {
  // Admin panel is intentionally accessed from a browser — don't log it as a suspicious attempt
  if (window.location.pathname.startsWith('/admin')) return
  if (sessionStorage.getItem(ACCESS_RECORDED_KEY)) return
  sessionStorage.setItem(ACCESS_RECORDED_KEY, '1')
  const params = new URLSearchParams(window.location.search)
  const payload = {
    tgStartParam:  params.get('tgWebAppStartParam') ?? params.get('startapp') ?? null,
    tgSdkPresent,
    tgSdkFake,
    screen:        `${screen.width}x${screen.height} @${devicePixelRatio}x`,
    timezone:      Intl.DateTimeFormat().resolvedOptions().timeZone,
    language:      navigator.language,
    url:           window.location.href,
  }
  fetch('/api/trap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => null)
}

type GuardState = 'pending' | 'allowed' | 'blocked' | 'denied'

export default function TelegramGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GuardState>('pending')
  const disconnect = useWalletStore((s) => s.disconnect)

  useEffect(() => {
    const check = async () => {
      if (isDev) {
        const { hasWallet } = await recordSession()
        if (!hasWallet) disconnect()
        setState('allowed')
        return
      }
      const tg = (window as TelegramWindow).Telegram?.WebApp
      const sdkPresent = !!tg
      const sdkFake    = sdkPresent && !tg?.initData

      if (tg && tg.initData) {
        tg.ready?.()
        tg.expand?.()

        // Capture referral param — Telegram passes it via initDataUnsafe.start_param
        // (URL query params are NOT populated for ?start= deep links)
        const startParam = (tg.initDataUnsafe as Record<string, unknown>)?.start_param as string | undefined
        const urlParams = new URLSearchParams(window.location.search)
        const refParam = startParam ?? urlParams.get('tgWebAppStartParam') ?? urlParams.get('startapp') ?? null
        if (refParam?.startsWith('ref_')) {
          sessionStorage.setItem('nyseau_referrer', refParam.replace('ref_', ''))
        }
        const { status, hasWallet } = await recordSession()
        if (status === 'blocked') {
          setState('blocked')
          return
        }
        // If admin logged the user out server-side, clear local wallet state
        if (!hasWallet) disconnect()
        startDevToolsWatch(tg.initDataUnsafe?.user ?? null)
        setState('allowed')
      } else {
        recordAccessAttempt(sdkPresent, sdkFake)
        setState('denied')
      }
    }
    const t = setTimeout(check, 0)
    return () => {
      clearTimeout(t)
      stopDevToolsWatch()
    }
  }, [])

  // Dismiss the inline loader once guard resolves AND Material Symbols font is loaded.
  // Uses document.fonts.load() to explicitly wait for the icon font — document.fonts.ready
  // can resolve prematurely if the font request hasn't started yet.
  useEffect(() => {
    if (state === 'pending') return
    const dismiss = () => {
      const loader = document.getElementById('app-loader')
      if (loader) {
        loader.style.transition = 'opacity 0.2s ease'
        loader.style.opacity = '0'
        setTimeout(() => loader.remove(), 200)
      }
    }
    // Wait for Material Symbols font specifically, with a 4s timeout fallback
    const fontPromise = document.fonts?.load
      ? document.fonts.load('24px "Material Symbols Outlined"', 'sports_football')
      : Promise.resolve()
    const timeout = new Promise<void>((r) => setTimeout(r, 4000))
    Promise.race([fontPromise, timeout]).then(dismiss)
  }, [state])

  // While checking, the CSS-only app-loader overlay is visible — render nothing here
  // to avoid showing unloaded material icon text underneath
  if (state === 'pending') return null

  if (state === 'blocked') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0A0E1A] px-8 text-center space-y-4">
        <span className="material-symbols-outlined text-[#D4AF37] text-6xl">error_outline</span>
        <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
        <p className="text-gray-400 text-sm">We couldn&apos;t load your session. Please contact support for assistance.</p>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0A0E1A] px-8 text-center space-y-4">
        <span className="material-symbols-outlined text-[#D4AF37] text-6xl">lock</span>
        <h1 className="text-2xl font-bold text-white">Telegram Only</h1>
        <p className="text-gray-400 text-sm">This app must be opened inside Telegram.</p>
      </div>
    )
  }

  return <>{children}</>
}

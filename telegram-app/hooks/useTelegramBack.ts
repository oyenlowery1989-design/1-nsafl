'use client'
import { useEffect } from 'react'
import { showBackButton } from '@/lib/telegram-ui'

/**
 * Shows the Telegram native BackButton while this component is mounted.
 * Automatically hides and cleans up on unmount.
 * Falls back gracefully if not inside Telegram WebApp.
 */
export function useTelegramBack(onBack: () => void) {
  useEffect(() => {
    const cleanup = showBackButton(onBack)
    return cleanup
  // onBack identity changes each render — intentionally omitted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

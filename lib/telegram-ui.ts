/**
 * Helpers for Telegram WebApp UI features:
 * - HapticFeedback for tactile responses
 * - BackButton for native Android back navigation
 */

type TgWebApp = {
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
  BackButton?: {
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
    isVisible: boolean
  }
}

function getTg(): TgWebApp | null {
  if (typeof window === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).Telegram?.WebApp ?? null
}

export const haptic = {
  light: () => getTg()?.HapticFeedback?.impactOccurred('light'),
  medium: () => getTg()?.HapticFeedback?.impactOccurred('medium'),
  heavy: () => getTg()?.HapticFeedback?.impactOccurred('heavy'),
  success: () => getTg()?.HapticFeedback?.notificationOccurred('success'),
  error: () => getTg()?.HapticFeedback?.notificationOccurred('error'),
  warning: () => getTg()?.HapticFeedback?.notificationOccurred('warning'),
  selection: () => getTg()?.HapticFeedback?.selectionChanged(),
}

export function showBackButton(onBack: () => void) {
  const tg = getTg()
  if (!tg?.BackButton) return () => {}
  tg.BackButton.show()
  tg.BackButton.onClick(onBack)
  return () => {
    tg.BackButton!.offClick(onBack)
    tg.BackButton!.hide()
  }
}


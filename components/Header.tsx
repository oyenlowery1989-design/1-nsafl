'use client'
import { useRouter } from 'next/navigation'

interface Props {
  title: string
  subtitle?: string
  /** Show a back arrow that calls router.back() (default: false) */
  showBack?: boolean
  /** Replace the default back action */
  onBack?: () => void
  /** Slot for right-side content (e.g. logout button, notification bell) */
  right?: React.ReactNode
}

/**
 * Reusable sticky page header used across all sub-pages.
 * Matches the navy + gold design system exactly.
 */
export default function Header({ title, subtitle, showBack = false, onBack, right }: Props) {
  const router = useRouter()
  const handleBack = onBack ?? (() => router.back())

  return (
    <header className="pt-3 pb-2 px-4 sticky top-0 z-20 bg-[#0A0E1A] border-b border-white/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 min-w-0">
          {showBack && (
            <button
              onClick={handleBack}
              className="flex-shrink-0 w-9 h-9 rounded-lg glass-card flex items-center justify-center hover:bg-white/10 transition active:scale-95"
              aria-label="Go back"
            >
              <span className="material-symbols-outlined text-white text-lg">arrow_back</span>
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white tracking-tight truncate">{title}</h1>
            {subtitle && (
              <p className="text-[11px] text-[#D4AF37] font-medium truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {right && <div className="flex-shrink-0 ml-3">{right}</div>}
      </div>
    </header>
  )
}

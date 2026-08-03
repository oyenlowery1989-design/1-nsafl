import type { ReactNode } from 'react'

interface HeaderProps {
  title: string
  subtitle?: string
  /** Shows a back button when provided; omit for top-level bottom-nav pages */
  onBack?: () => void
  /** Back-button visual style — glass-card (profile/buy/rewards) or plain circle (leaderboard/donate) */
  backStyle?: 'glass' | 'plain'
  /** Material Symbols icon shown in a circular avatar, left of the title (no-back pages only) */
  icon?: string
  /** Right-side slot — action buttons, stat counts, etc. */
  right?: ReactNode
  zIndex?: 10 | 20 | 30
}

export default function Header({
  title,
  subtitle,
  onBack,
  backStyle = 'glass',
  icon,
  right,
  zIndex = 10,
}: HeaderProps) {
  const zClass = zIndex === 30 ? 'z-30' : zIndex === 20 ? 'z-20' : 'z-10'

  return (
    <header className={`pt-3 pb-2 px-4 sticky top-0 ${zClass} bg-background-dark border-b border-white/10`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {onBack && backStyle === 'glass' && (
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-lg glass-card flex items-center justify-center hover:bg-white/10 transition"
            >
              <span className="material-symbols-outlined text-white text-lg">arrow_back</span>
            </button>
          )}
          {onBack && backStyle === 'plain' && (
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors"
            >
              <span className="material-symbols-outlined text-white text-base">arrow_back</span>
            </button>
          )}
          {icon && !onBack && (
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">{icon}</span>
            </div>
          )}
          <div>
            <h1 className={`${onBack ? 'text-lg' : 'text-xl'} font-bold text-white tracking-tight`}>{title}</h1>
            {subtitle && <p className="text-xs text-primary font-medium">{subtitle}</p>}
          </div>
        </div>
        {right && <div className="flex items-center space-x-2">{right}</div>}
      </div>
    </header>
  )
}

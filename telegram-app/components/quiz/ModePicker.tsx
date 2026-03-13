'use client'

export interface QuizMode {
  id: 'quick' | 'standard' | 'champion'
  label: string
  questions: number
  multiplier: string
  icon: string
  color: string
  border: string
}

export const QUIZ_MODES: QuizMode[] = [
  { id: 'quick', label: 'Quick', questions: 5, multiplier: '1×', icon: 'bolt', color: 'text-blue-300', border: 'border-blue-500/30' },
  { id: 'standard', label: 'Standard', questions: 10, multiplier: '1.5×', icon: 'sports_football', color: 'text-[#D4AF37]', border: 'border-[#D4AF37]/30' },
  { id: 'champion', label: 'Champion', questions: 20, multiplier: '2×', icon: 'emoji_events', color: 'text-purple-400', border: 'border-purple-500/30' },
]

interface Props {
  playsLeft: Record<string, number>
  onSelect: (mode: QuizMode) => void
  onBack: () => void
}

export default function ModePicker({ playsLeft, onSelect, onBack }: Props) {
  return (
    <div className="flex flex-col min-h-dvh bg-[#0A0E1A]">
      <header className="pt-3 pb-2 px-4 sticky top-0 z-30 bg-[#0A0E1A] border-b border-white/10">
        <div className="flex items-center space-x-3">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition">
            <span className="material-symbols-outlined text-white">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold text-white">AFL/WAFL Quiz</h1>
        </div>
      </header>

      <main className="flex-1 px-6 py-6 space-y-4">
        <p className="text-sm text-gray-400 text-center">Choose your challenge</p>

        {QUIZ_MODES.map((mode) => {
          const left = playsLeft[mode.id] ?? 3
          const disabled = left <= 0
          return (
            <button
              key={mode.id}
              onClick={() => !disabled && onSelect(mode)}
              disabled={disabled}
              className={`w-full rounded-2xl border p-5 text-left transition active:scale-[0.98] ${mode.border} bg-white/3 ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/6'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className={`material-symbols-outlined text-2xl ${mode.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{mode.icon}</span>
                  <div>
                    <p className="text-base font-bold text-white">{mode.label}</p>
                    <p className="text-xs text-gray-400">{mode.questions} questions · {mode.multiplier} points</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${disabled ? 'text-red-400' : 'text-gray-300'}`}>
                    {disabled ? 'Done for today' : `${left} left`}
                  </p>
                  <p className="text-[10px] text-gray-600">of 3 daily plays</p>
                </div>
              </div>
            </button>
          )
        })}

        <div className="glass-card rounded-2xl p-4 mt-2 space-y-1.5">
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">How it works</p>
          <p className="text-xs text-gray-300">• +10 pts per correct answer × mode multiplier</p>
          <p className="text-xs text-gray-300">• 15 seconds per question</p>
          <p className="text-xs text-gray-300">• Perfect round? You enter the prize draw 🏆</p>
        </div>
      </main>
    </div>
  )
}

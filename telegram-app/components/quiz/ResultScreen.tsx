'use client'
import { useState, useEffect } from 'react'

interface SessionResult {
  correctCount: number
  totalQuestions: number
  pointsEarned: number
  isPerfect: boolean
  prize: { label: string; winCode: string } | null
}

interface Props {
  result: SessionResult
  modeName: string
  onPlayAgain: () => void
  onBack: () => void
}

export default function ResultScreen({ result, modeName, onPlayAgain, onBack }: Props) {
  const { correctCount, totalQuestions, pointsEarned, isPerfect, prize } = result
  const pct = Math.round((correctCount / totalQuestions) * 100)
  const [showPrize, setShowPrize] = useState(false)

  useEffect(() => {
    if (isPerfect && prize) {
      setTimeout(() => setShowPrize(true), 800)
    }
  }, [isPerfect, prize])

  const grade = pct === 100 ? '🏆 Perfect!' : pct >= 80 ? '⭐ Excellent' : pct >= 60 ? '👍 Good' : pct >= 40 ? '📚 Keep learning' : '💪 Try again'

  return (
    <div className="flex flex-col min-h-dvh bg-[#0A0E1A]">
      <header className="pt-3 pb-2 px-4 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition">
            <span className="material-symbols-outlined text-white">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold text-white">Quiz Results</h1>
        </div>
      </header>

      <main className="flex-1 px-6 py-6 space-y-5">
        <div className={`rounded-2xl border p-6 text-center ${isPerfect ? 'border-[#D4AF37]/50 bg-[#D4AF37]/5' : 'border-white/10 glass-card'}`}>
          <p className="text-4xl font-bold text-white mb-1">{correctCount}/{totalQuestions}</p>
          <p className="text-lg text-gray-300">{grade}</p>
          <p className="text-sm text-gray-500 mt-1">{modeName} mode · {pct}% correct</p>
        </div>

        {pointsEarned > 0 && (
          <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-[#D4AF37]" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
              <p className="text-sm font-bold text-white">Points earned</p>
            </div>
            <p className="text-lg font-bold text-[#D4AF37]">+{pointsEarned}</p>
          </div>
        )}

        {isPerfect && showPrize && prize && (
          <div className="rounded-2xl border border-[#D4AF37]/50 bg-[#D4AF37]/5 p-5 text-center space-y-2">
            <span className="material-symbols-outlined text-[#D4AF37] text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
            <p className="text-base font-bold text-[#D4AF37]">Perfect Round Prize!</p>
            <p className="text-2xl font-bold text-white">{prize.label}</p>
            <div className="glass-card rounded-lg p-2 mt-2">
              <p className="text-[10px] text-gray-500 mb-0.5">Win code (show to admin)</p>
              <p className="text-sm font-mono font-bold text-[#D4AF37]">{prize.winCode}</p>
            </div>
            <p className="text-[10px] text-gray-500">Admin will send your reward within 48h</p>
          </div>
        )}

        {isPerfect && !prize && showPrize && (
          <div className="rounded-2xl border border-white/10 glass-card p-4 text-center">
            <p className="text-sm font-bold text-white">Perfect round! 🎯</p>
            <p className="text-xs text-gray-400 mt-1">No prize this time — but the glory is yours!</p>
          </div>
        )}

        <div className="flex space-x-3 pt-2">
          <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-white/15 text-gray-300 font-bold text-sm transition hover:bg-white/5">
            Back to Hub
          </button>
          <button onClick={onPlayAgain} className="flex-1 py-3 rounded-xl bg-[#D4AF37] text-black font-bold text-sm transition hover:brightness-110 active:scale-[0.98]">
            Play Again
          </button>
        </div>
      </main>
    </div>
  )
}

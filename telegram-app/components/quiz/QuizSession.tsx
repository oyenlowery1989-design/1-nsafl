'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { getTelegramInitData } from '@/lib/telegram'
import { haptic } from '@/lib/telegram-ui'
import type { QuizMode } from './ModePicker'

interface Question {
  id: string
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  category: string
  difficulty: string
}

interface AnswerResult {
  correct: boolean
  correctOption: string
  explanation: string | null
}

interface SessionResult {
  correctCount: number
  totalQuestions: number
  pointsEarned: number
  isPerfect: boolean
  prize: { label: string; winCode: string } | null
}

interface Props {
  mode: QuizMode
  sessionId: string
  questions: Question[]
  onComplete: (result: SessionResult) => void
  onBack: () => void
}

const OPTIONS = ['a', 'b', 'c', 'd'] as const
const OPTION_LABELS: Record<string, string> = { a: 'A', b: 'B', c: 'C', d: 'D' }
const TIMER_SECONDS = 15

export default function QuizSession({ mode, sessionId, questions, onComplete, onBack }: Props) {
  const [qIdx, setQIdx] = useState(0)
  const [chosen, setChosen] = useState<string | null>(null)
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS)
  const [streak, setStreak] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const answeredRef = useRef(false)

  const currentQ = questions[qIdx]
  const isLast = qIdx === questions.length - 1

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const submitAnswer = useCallback(async (pick: string) => {
    if (answeredRef.current || loading) return
    answeredRef.current = true
    stopTimer()
    setChosen(pick)
    setLoading(true)
    haptic.light()

    try {
      const res = await fetch('/api/quiz/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': getTelegramInitData(),
        },
        body: JSON.stringify({ sessionId, questionId: currentQ.id, chosen: pick }),
      })
      const json = await res.json()
      const data = json.data ?? json
      setResult(data)
      if (data.correct) {
        setCorrectCount(c => c + 1)
        setStreak(s => s + 1)
        haptic.success()
      } else {
        setStreak(0)
        haptic.error()
      }
    } catch {
      setResult({ correct: false, correctOption: '', explanation: null })
    } finally {
      setLoading(false)
    }
  }, [sessionId, currentQ, loading, stopTimer])

  useEffect(() => {
    setTimeLeft(TIMER_SECONDS)
    answeredRef.current = false
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          timerRef.current = null
          submitAnswer('_timeout')
          return 0
        }
        return t - 1
      })
    }, 1000)
    return stopTimer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIdx])

  const handleNext = async () => {
    if (isLast) {
      try {
        const res = await fetch('/api/quiz/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-init-data': getTelegramInitData(),
          },
          body: JSON.stringify({ sessionId }),
        })
        const json = await res.json()
        onComplete(json.data ?? json)
      } catch {
        onComplete({ correctCount, totalQuestions: questions.length, pointsEarned: 0, isPerfect: false, prize: null })
      }
    } else {
      setQIdx(i => i + 1)
      setChosen(null)
      setResult(null)
    }
  }

  const pct = (qIdx / questions.length) * 100
  const timerPct = (timeLeft / TIMER_SECONDS) * 100

  const optionStyle = (opt: string) => {
    if (!result) return 'border-white/10 bg-white/3 hover:bg-white/8 text-white'
    if (opt === result.correctOption) return 'border-green-500 bg-green-500/15 text-green-300'
    if (opt === chosen && !result.correct) return 'border-red-500 bg-red-500/15 text-red-300'
    return 'border-white/5 bg-white/2 text-gray-500'
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[#0A0E1A]">
      <header className="pt-3 pb-2 px-4 sticky top-0 z-30 bg-[#0A0E1A] border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition">
              <span className="material-symbols-outlined text-white text-lg">close</span>
            </button>
            <p className="text-sm font-bold text-white">{mode.label} Quiz</p>
          </div>
          <div className="flex items-center space-x-3">
            {streak >= 2 && (
              <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30">
                <span className="material-symbols-outlined text-orange-400 text-sm">local_fire_department</span>
                <span className="text-xs font-bold text-orange-300">{streak}</span>
              </div>
            )}
            <p className="text-xs text-gray-400">{qIdx + 1}/{questions.length}</p>
          </div>
        </div>
        <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-1 bg-[#D4AF37] rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <main className="flex-1 px-5 py-5 flex flex-col space-y-4">
        <div className="flex items-center space-x-2">
          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-1000 ${timeLeft <= 5 ? 'bg-red-500' : timeLeft <= 10 ? 'bg-orange-400' : 'bg-green-400'}`}
              style={{ width: `${timerPct}%` }}
            />
          </div>
          <span className={`text-xs font-bold w-5 text-right ${timeLeft <= 5 ? 'text-red-400' : 'text-gray-400'}`}>{timeLeft}</span>
        </div>

        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center space-x-2 mb-3">
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${currentQ.category === 'wafl' ? 'bg-blue-500/15 text-blue-300' : 'bg-[#D4AF37]/15 text-[#D4AF37]'}`}>
              {currentQ.category.toUpperCase()}
            </span>
            <span className="text-[10px] text-gray-500 uppercase">{currentQ.difficulty}</span>
          </div>
          <p className="text-base font-semibold text-white leading-relaxed">{currentQ.question}</p>
        </div>

        <div className="space-y-2.5">
          {OPTIONS.map((opt) => {
            const text = currentQ[`option_${opt}` as keyof Question] as string
            return (
              <button
                key={opt}
                onClick={() => !result && submitAnswer(opt)}
                disabled={!!result || loading}
                className={`w-full rounded-xl border p-4 text-left transition active:scale-[0.98] ${optionStyle(opt)}`}
              >
                <div className="flex items-center space-x-3">
                  <span className="w-7 h-7 rounded-full border border-current flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {OPTION_LABELS[opt]}
                  </span>
                  <span className="text-sm leading-snug">{text}</span>
                  {result && opt === result.correctOption && (
                    <span className="material-symbols-outlined text-green-400 text-base ml-auto" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  )}
                  {result && opt === chosen && !result.correct && (
                    <span className="material-symbols-outlined text-red-400 text-base ml-auto" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {result && (
          <div className="space-y-3">
            {result.explanation && (
              <div className="glass-card rounded-xl p-3">
                <p className="text-xs text-gray-400 leading-relaxed">{result.explanation}</p>
              </div>
            )}
            <button
              onClick={handleNext}
              className="w-full py-3 rounded-xl bg-[#D4AF37] text-black font-bold text-sm transition active:scale-[0.98] hover:brightness-110"
            >
              {isLast ? 'See Results' : 'Next Question →'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

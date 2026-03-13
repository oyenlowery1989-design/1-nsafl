'use client'
import { useEffect, useState } from 'react'

interface Question {
  id: string
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: string
  explanation: string | null
  category: string
  difficulty: string
  active: boolean
  created_at: string
}

interface Stats {
  totalQuestions: number
  activeQuestions: number
  totalSessions: number
  avgScorePct: number
}

const DIFF_COLORS: Record<string, string> = {
  easy: 'text-green-400',
  medium: 'text-yellow-400',
  hard: 'text-red-400',
}
const CAT_COLORS: Record<string, string> = {
  afl: 'text-[#D4AF37]',
  wafl: 'text-blue-300',
  general: 'text-gray-300',
}

const BLANK_FORM = {
  question: '', option_a: '', option_b: '', option_c: '', option_d: '',
  correct_option: 'a', explanation: '', category: 'afl', difficulty: 'medium',
}

export default function AdminQuizPage() {
  const [token, setToken] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') ?? ''
    setToken(t)
    if (t) fetchData(t)
  }, [])

  async function fetchData(t: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/quiz?token=${t}`)
      const json = await res.json()
      const data = json.data ?? json
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setQuestions(data.questions ?? [])
      setStats(data.stats ?? null)
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  async function toggleActive(q: Question) {
    const res = await fetch(`/api/admin/quiz/questions/${q.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ active: !q.active }),
    })
    if (res.ok) {
      setQuestions(qs => qs.map(x => x.id === q.id ? { ...x, active: !q.active } : x))
    }
  }

  async function deleteQuestion(id: string) {
    if (!confirm('Delete this question permanently?')) return
    const res = await fetch(`/api/admin/quiz/questions/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': token },
    })
    if (res.ok) setQuestions(qs => qs.filter(x => x.id !== id))
  }

  async function addQuestion() {
    if (!form.question || !form.option_a || !form.option_b || !form.option_c || !form.option_d) {
      alert('Fill all option fields')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/quiz/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      const data = json.data ?? json
      if (res.ok) {
        setQuestions(qs => [data, ...qs])
        setShowAddForm(false)
        setForm(BLANK_FORM)
      } else {
        alert(data.error ?? 'Failed to add')
      }
    } finally { setSaving(false) }
  }

  const filtered = questions.filter(q =>
    !search || q.question.toLowerCase().includes(search.toLowerCase()) ||
    q.category.includes(search.toLowerCase()) || q.difficulty.includes(search.toLowerCase())
  )

  if (loading) return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
      <p className="text-white">Loading…</p>
    </div>
  )
  if (error) return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
      <p className="text-red-400">{error}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
      <header className="sticky top-0 bg-[#0A0E1A]/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <a href={`/admin?token=${token}`} className="text-gray-400 hover:text-white text-sm transition">← Admin</a>
          <span className="text-gray-600">/</span>
          <h1 className="text-base font-bold">Quiz Management</h1>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="px-3 py-1.5 rounded-lg bg-[#D4AF37] text-black text-sm font-bold hover:brightness-110 transition"
        >
          + Add Question
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Questions', value: stats.totalQuestions, color: 'text-white' },
              { label: 'Active', value: stats.activeQuestions, color: 'text-green-400' },
              { label: 'Sessions Played', value: stats.totalSessions, color: 'text-blue-300' },
              { label: 'Avg Score', value: `${stats.avgScorePct}%`, color: 'text-[#D4AF37]' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white/3 border border-white/8 rounded-xl p-3 text-center">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        {showAddForm && (
          <div className="bg-white/3 border border-white/10 rounded-2xl p-5 space-y-3">
            <h2 className="font-bold text-sm text-white">New Question</h2>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white resize-none placeholder-gray-600"
              rows={3}
              placeholder="Question text…"
              value={form.question}
              onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              {(['a', 'b', 'c', 'd'] as const).map(opt => (
                <input
                  key={opt}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-600"
                  placeholder={`Option ${opt.toUpperCase()}`}
                  value={form[`option_${opt}` as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [`option_${opt}`]: e.target.value }))}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 uppercase block mb-0.5">Correct</label>
                <select
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
                  value={form.correct_option}
                  onChange={e => setForm(f => ({ ...f, correct_option: e.target.value }))}
                >
                  {['a', 'b', 'c', 'd'].map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase block mb-0.5">Category</label>
                <select
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  {['afl', 'wafl', 'general'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase block mb-0.5">Difficulty</label>
                <select
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
                  value={form.difficulty}
                  onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}
                >
                  {['easy', 'medium', 'hard'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-600"
              placeholder="Explanation (optional)…"
              value={form.explanation}
              onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))}
            />
            <div className="flex space-x-2">
              <button
                onClick={() => { setShowAddForm(false); setForm(BLANK_FORM) }}
                className="flex-1 py-2 rounded-lg border border-white/15 text-sm text-gray-300 hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                onClick={addQuestion}
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-[#D4AF37] text-black font-bold text-sm disabled:opacity-60 hover:brightness-110 transition"
              >
                {saving ? 'Saving…' : 'Add Question'}
              </button>
            </div>
          </div>
        )}

        {/* Search + question list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
              Question Bank ({filtered.length}{search ? ` of ${questions.length}` : ''})
            </h2>
            <input
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 w-40"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {filtered.length === 0 && (
            <p className="text-center text-gray-600 text-sm py-8">No questions found.</p>
          )}

          {filtered.map(q => (
            <div
              key={q.id}
              className={`bg-white/2 border rounded-xl p-4 space-y-2 transition ${q.active ? 'border-white/8' : 'border-white/3 opacity-50'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-white leading-snug flex-1">{q.question}</p>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <button
                    onClick={() => toggleActive(q)}
                    className={`text-xs px-2 py-0.5 rounded-full border font-medium transition ${q.active ? 'border-green-500/40 text-green-400 hover:bg-green-500/10' : 'border-gray-600 text-gray-500 hover:bg-white/5'}`}
                  >
                    {q.active ? 'Active' : 'Off'}
                  </button>
                  <button
                    onClick={() => deleteQuestion(q.id)}
                    className="text-red-500 hover:text-red-300 text-xs px-1 transition"
                    title="Delete question"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className={CAT_COLORS[q.category] ?? 'text-gray-400'}>{q.category.toUpperCase()}</span>
                <span className={DIFF_COLORS[q.difficulty] ?? 'text-gray-400'}>{q.difficulty}</span>
                <span className="text-gray-600">Correct: <strong className="text-gray-300">{q.correct_option.toUpperCase()}</strong></span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                {(['a', 'b', 'c', 'd'] as const).map(opt => (
                  <span key={opt} className={opt === q.correct_option ? 'text-green-400 font-semibold' : 'text-gray-500'}>
                    {opt.toUpperCase()}: {q[`option_${opt}` as keyof Question] as string}
                  </span>
                ))}
              </div>
              {q.explanation && (
                <p className="text-[10px] text-gray-600 italic">{q.explanation}</p>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

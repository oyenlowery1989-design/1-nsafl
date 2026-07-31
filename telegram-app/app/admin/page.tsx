'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'
import { Icon } from './components/ui'

function AdminLoginContent() {
  const router = useRouter()
  const [tokenInput, setTokenInput] = useState('')
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('admin_token')
    if (stored) {
      router.push('/admin/overview')
      return
    }
    setChecked(true)
  }, [router])

  function handleSubmit() {
    const t = tokenInput.trim()
    if (!t) return
    localStorage.setItem('admin_token', t)
    router.push('/admin/overview')
  }

  if (!checked) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center text-gray-600 text-sm">Loading…</div>
  )

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="bg-[#111827] border border-white/10 rounded-2xl p-8 w-full max-w-sm shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37] flex items-center justify-center">
            <Icon name="sports_football" className="text-base text-black" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Admin Panel</h1>
            <p className="text-xs text-gray-500">{PRIMARY_CUSTOM_ASSET_CODE} Hub</p>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Admin Token</label>
          <input
            type="password"
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Enter token…"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/50 focus:ring-1 focus:ring-[#D4AF37]/30"
            autoFocus
          />
        </div>
        <div>
          <button
            onClick={handleSubmit}
            className="w-full bg-[#D4AF37] text-black font-bold rounded-lg py-2.5 text-sm hover:bg-[#c9a42e] transition"
          >
            Enter
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  return (
    <Suspense>
      <AdminLoginContent />
    </Suspense>
  )
}

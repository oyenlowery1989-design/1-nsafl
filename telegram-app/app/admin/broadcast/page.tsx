'use client'
import { useEffect, useState, Suspense } from 'react'
import { useAdminToken } from '../hooks/useAdminToken'
import { Icon } from '../components/ui'
import { BRANDING } from '@/config/branding'

const TEMPLATES = BRANDING.copy.broadcastTemplates

function BroadcastContent() {
  const token = useAdminToken() ?? ''
  const [message, setMessage] = useState('')
  const [onlyOptedIn, setOnlyOptedIn] = useState(true)
  const [preview, setPreview] = useState<{ recipientCount: number } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; errors: number } | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('')

  async function handlePreview() {
    setPreviewing(true); setPreview(null)
    const res = await fetch('/api/admin/broadcast', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ message, onlyOptedIn, previewOnly: true }),
    })
    const json = await res.json()
    setPreview(json.data ?? json)
    setPreviewing(false)
  }

  async function handleSend() {
    setConfirm(false); setSending(true); setResult(null)
    const res = await fetch('/api/admin/broadcast', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ message, onlyOptedIn }),
    })
    const json = await res.json()
    setResult(json.data ?? json)
    setSending(false)
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <Icon name="campaign" className="text-primary text-xl" />
        Broadcast Message
      </h2>
      <div className="bg-[#0d1424] border border-white/8 rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Quick Templates</label>
          <select
            value={selectedTemplate}
            onChange={e => {
              const tmpl = TEMPLATES.find(t => t.label === e.target.value)
              if (tmpl) { setMessage(tmpl.message); setPreview(null); setConfirm(false); setResult(null) }
              setSelectedTemplate(e.target.value)
            }}
            className="w-full bg-black/40 border border-white/10 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            <option value="">— Select a template —</option>
            {TEMPLATES.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Message <span className="text-gray-600">(HTML supported: &lt;b&gt;bold&lt;/b&gt;, &lt;i&gt;italic&lt;/i&gt;, &lt;a href=&quot;...&quot;&gt;link&lt;/a&gt;)</span></label>
          <textarea
            value={message}
            onChange={e => { setMessage(e.target.value); setPreview(null); setConfirm(false); setResult(null) }}
            rows={6}
            placeholder="Write your broadcast message here…"
            className="w-full bg-black/40 border border-white/10 text-gray-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder-gray-600 resize-y"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
          <input type="checkbox" checked={onlyOptedIn} onChange={e => setOnlyOptedIn(e.target.checked)} className="rounded" />
          Only send to users who opted in to notifications
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handlePreview} disabled={previewing || !message.trim()}
            className="flex items-center gap-1.5 text-sm bg-white/8 text-gray-300 hover:bg-white/15 px-4 py-2 rounded-lg font-semibold transition disabled:opacity-40">
            {previewing ? <Icon name="progress_activity" className="text-sm animate-spin" /> : <Icon name="visibility" className="text-sm" />}
            Preview count
          </button>
          {preview && (
            <span className="text-sm text-gray-300">
              Will send to <span className="text-white font-bold">{preview.recipientCount}</span> users
            </span>
          )}
          {preview && !confirm && (
            <button onClick={() => setConfirm(true)} disabled={sending || !message.trim()}
              className="flex items-center gap-1.5 text-sm font-bold text-black px-4 py-2 rounded-lg disabled:opacity-40 transition"
              style={{ background: `linear-gradient(135deg, ${BRANDING.colors.primary} 0%, #f0d060 100%)` }}>
              <Icon name="send" className="text-sm" />
              Send to {preview.recipientCount}
            </button>
          )}
          {confirm && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-yellow-400 font-semibold">⚠ Confirm broadcast?</span>
              <button onClick={handleSend} className="text-sm bg-primary text-black font-bold px-3 py-1.5 rounded-lg hover:bg-[#f0d060] transition">Yes, send</button>
              <button onClick={() => setConfirm(false)} className="text-sm bg-white/10 text-gray-400 px-3 py-1.5 rounded-lg hover:bg-white/20 transition">Cancel</button>
            </div>
          )}
        </div>
        {sending && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Icon name="progress_activity" className="text-base animate-spin" />
            Sending messages… this may take a minute
          </div>
        )}
        {result && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold ${result.errors > 0 ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-300' : 'bg-green-500/10 border border-green-500/20 text-green-300'}`}>
            <Icon name={result.errors > 0 ? 'warning' : 'check_circle'} className="text-base" />
            Sent {result.sent} messages{result.errors > 0 ? `, ${result.errors} failed` : ' — all delivered ✓'}
          </div>
        )}
      </div>
    </div>
  )
}

export default function BroadcastPage() {
  return <Suspense><BroadcastContent /></Suspense>
}

'use client'
import { useEffect, useState, useCallback, Suspense, Fragment } from 'react'
import Link from 'next/link'
import type { AccessAttempt } from '../types'
import { Badge, Card, Th, Td, Icon } from '../components/ui'
import { dt, ago } from '../utils'
import { useAdminToken } from '../hooks/useAdminToken'

// ── Helpers ───────────────────────────────────────────────────────────────────
type TimeFilter = '1h' | '24h' | '7d' | 'all'

const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
  { key: '1h',  label: 'Last hour' },
  { key: '24h', label: 'Last 24h' },
  { key: '7d',  label: 'Last 7d' },
  { key: 'all', label: 'All time' },
]

function cutoff(f: TimeFilter): number {
  const now = Date.now()
  if (f === '1h')  return now - 3_600_000
  if (f === '24h') return now - 86_400_000
  if (f === '7d')  return now - 604_800_000
  return 0
}

function parseUA(ua: string | null): string {
  if (!ua) return '\u2014'
  const browser = ua.includes('Edg') ? 'Edge' : ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Unknown'
  const os = ua.includes('Android') ? 'Android' : ua.includes('iPhone') || ua.includes('iPad') ? 'iOS' : ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'Mac' : ua.includes('Linux') ? 'Linux' : 'Unknown'
  return `${browser} / ${os}`
}

function isSuspicious(a: AccessAttempt): boolean {
  return a.tg_sdk_fake || a.devtools_opened
}

function typeBadge(a: AccessAttempt): { label: string; color: string } {
  if (a.devtools_opened)  return { label: 'DevTools opened', color: 'red' }
  if (a.tg_sdk_fake)      return { label: 'Fake SDK', color: 'red' }
  if (!a.tg_sdk_present)  return { label: 'Browser \u2014 no Telegram', color: 'gray' }
  if (a.tg_sdk_present && !a.telegram_id) return { label: 'SDK present, no user', color: 'yellow' }
  return { label: 'Telegram session', color: 'green' }
}

// ── Inner component ───────────────────────────────────────────────────────────
function AccessPageInner() {
  const token = useAdminToken() ?? ''

  const [attempts, setAttempts] = useState<AccessAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('24h')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [blockedIps, setBlockedIps] = useState<Set<string>>(new Set())
  const [blockingIp, setBlockingIp] = useState<string | null>(null)
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    if (!token) { setError('No admin token'); setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch('/api/admin', {
        headers: { 'x-admin-token': token },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setAttempts(json.data?.accessAttempts ?? [])
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fetch failed')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchData()
    if (token) {
      fetch('/api/admin/blocklist', { headers: { 'x-admin-token': token } })
        .then(r => r.json())
        .then(j => {
          if (j.success) setBlockedIps(new Set((j.data.blockedIps ?? []).map((b: { ip: string }) => b.ip)))
        })
    }
  }, [fetchData, token])

  // ── Block / Unblock IP ──
  async function blockIp(ip: string) {
    setBlockingIp(ip)
    const res = await fetch('/api/admin/blocklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ ip, reason: 'Blocked via admin panel' }),
    })
    const j = await res.json()
    if (j.success) setBlockedIps(prev => new Set([...prev, ip]))
    setBlockingIp(null)
  }

  async function unblockIp(ip: string) {
    setBlockingIp(ip)
    const res = await fetch('/api/admin/blocklist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ ip }),
    })
    const j = await res.json()
    if (j.success) setBlockedIps(prev => { const s = new Set(prev); s.delete(ip); return s })
    setBlockingIp(null)
  }

  // ── Delete single entry ──
  const handleDelete = async (id: string) => {
    if (!token) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/access/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token },
      })
      if (res.ok) {
        setAttempts(prev => prev.filter(a => a.id !== id))
        if (expandedId === id) setExpandedId(null)
      }
    } finally {
      setDeletingId(null)
    }
  }

  // ── Bulk delete old logs ──
  const handleBulkDelete = async () => {
    if (!token) return
    setBulkDeleting(true)
    try {
      const res = await fetch('/api/admin/access/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ olderThanDays: 7 }),
      })
      if (res.ok) {
        await fetchData()
      }
    } finally {
      setBulkDeleting(false)
      setBulkConfirm(false)
    }
  }

  // ── Filter by time ──
  const co = cutoff(timeFilter)
  const filtered = attempts.filter(a => new Date(a.created_at).getTime() >= co)
  const suspiciousCount = filtered.filter(isSuspicious).length

  // ── Render ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center text-gray-600 gap-3">
        <span className="material-symbols-outlined animate-spin text-2xl leading-none">progress_activity</span>
        <span className="text-sm">Loading...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="text-center">
          <Icon name="error" className="text-4xl text-red-400 mb-2" />
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={fetchData} className="mt-3 text-xs text-primary underline">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-gray-200">
      {/* Header */}
      <div className="border-b border-white/8 bg-[#0a0f1e]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-gray-500 hover:text-white transition">
              <Icon name="arrow_back" className="text-xl" />
            </Link>
            <Icon name="shield" className="text-xl text-primary" />
            <h1 className="text-base font-bold text-white">Access Attempts</h1>
            {suspiciousCount > 0 && (
              <Badge color="red">{suspiciousCount} suspicious</Badge>
            )}
            <Badge color="gray">{filtered.length} total</Badge>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="text-gray-500 hover:text-white transition p-1" title="Refresh">
              <Icon name="refresh" className="text-lg" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Time filters */}
          <div className="flex items-center gap-1 bg-[#111827] rounded-lg p-1 border border-white/6">
            {TIME_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setTimeFilter(f.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  timeFilter === f.key
                    ? 'bg-primary text-black'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Bulk delete */}
          <div className="ml-auto">
            {bulkConfirm ? (
              <span className="inline-flex items-center gap-2 text-xs">
                <span className="text-gray-400">Delete logs older than 7 days?</span>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="px-3 py-1.5 rounded bg-red-500/20 text-red-400 ring-1 ring-red-500/30 font-semibold hover:bg-red-500/30 transition disabled:opacity-50"
                >
                  {bulkDeleting ? 'Deleting...' : 'Yes, clear'}
                </button>
                <button
                  onClick={() => setBulkConfirm(false)}
                  className="px-3 py-1.5 rounded bg-white/10 text-gray-400 font-semibold hover:bg-white/20 transition"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                onClick={() => setBulkConfirm(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-md bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/6 transition flex items-center gap-1.5"
              >
                <Icon name="delete_sweep" className="text-sm" />
                Clear old logs
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <Card>
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-600">
              <Icon name="verified_user" className="text-4xl mb-2" />
              <p className="text-sm">No access attempts in this time range</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <Th>Type</Th>
                    <Th>IP + Location</Th>
                    <Th>User Agent</Th>
                    <Th>Telegram User</Th>
                    <Th>Screen</Th>
                    <Th>Timezone</Th>
                    <Th>Language</Th>
                    <Th>When</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map(a => {
                      const suspicious = isSuspicious(a)
                      const tb = typeBadge(a)
                      const expanded = expandedId === a.id

                      return (
                        <Fragment key={a.id}>
                          <tr
                            onClick={() => setExpandedId(expanded ? null : a.id)}
                            className={`cursor-pointer transition border-b border-white/4 ${
                              suspicious
                                ? 'bg-red-500/5 hover:bg-red-500/10'
                                : 'hover:bg-white/3'
                            }`}
                          >
                            <Td>
                              <div className="flex flex-col gap-1">
                                <Badge color={tb.color}>{tb.label}</Badge>
                                {a.tg_sdk_fake && <Badge color="red">FAKE SDK</Badge>}
                                {a.devtools_opened && <Badge color="red">DEVTOOLS</Badge>}
                              </div>
                            </Td>
                            <Td>
                              <span className="font-mono text-xs">{a.ip ?? '\u2014'}</span>
                              {a.ip && (
                                <>
                                  {blockedIps.has(a.ip) && (
                                    <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">BLOCKED</span>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); blockedIps.has(a.ip!) ? unblockIp(a.ip!) : blockIp(a.ip!) }}
                                    disabled={blockingIp === a.ip}
                                    className={`ml-2 text-[10px] px-2 py-0.5 rounded transition disabled:opacity-40 ${
                                      blockedIps.has(a.ip)
                                        ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                        : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                    }`}
                                  >
                                    {blockingIp === a.ip ? '\u2026' : blockedIps.has(a.ip) ? 'Unblock' : 'Block'}
                                  </button>
                                </>
                              )}
                              {a.geo_location && (
                                <span className="block text-[10px] text-gray-500 mt-0.5">{a.geo_location}</span>
                              )}
                            </Td>
                            <Td>
                              <span className="text-xs">{parseUA(a.user_agent)}</span>
                            </Td>
                            <Td>
                              {a.telegram_id ? (
                                <div>
                                  <span className="font-medium text-white text-xs block">
                                    {a.telegram_first_name ?? a.telegram_username ?? '\u2014'}
                                    {a.telegram_username && <span className="text-gray-500"> @{a.telegram_username}</span>}
                                  </span>
                                  <span className="text-[10px] text-gray-600 font-mono">#{a.telegram_id}</span>
                                </div>
                              ) : (
                                <span className="text-gray-600 text-xs">\u2014</span>
                              )}
                            </Td>
                            <Td><span className="text-xs font-mono">{a.screen ?? '\u2014'}</span></Td>
                            <Td><span className="text-xs">{a.timezone ?? '\u2014'}</span></Td>
                            <Td><span className="text-xs">{a.language ?? '\u2014'}</span></Td>
                            <Td>
                              <span className="text-xs whitespace-nowrap" title={dt(a.created_at)}>
                                {ago(a.created_at)}
                              </span>
                            </Td>
                            <Td>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(a.id) }}
                                disabled={deletingId === a.id}
                                className="text-gray-600 hover:text-red-400 transition disabled:opacity-30"
                                title="Delete"
                              >
                                <Icon name={deletingId === a.id ? 'progress_activity' : 'delete'} className={`text-base ${deletingId === a.id ? 'animate-spin' : ''}`} />
                              </button>
                            </Td>
                          </tr>

                          {/* Expanded detail row */}
                          {expanded && (
                            <tr className={suspicious ? 'bg-red-500/5' : 'bg-[#111827]'}>
                              <td colSpan={9} className="px-4 py-3">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                  <Detail label="ID" value={a.id} mono />
                                  <Detail label="IP" value={a.ip} mono />
                                  <Detail label="Geo Location" value={a.geo_location} />
                                  <Detail label="Telegram ID" value={a.telegram_id?.toString()} mono />
                                  <Detail label="Username" value={a.telegram_username ? `@${a.telegram_username}` : null} />
                                  <Detail label="First Name" value={a.telegram_first_name} />
                                  <Detail label="Screen" value={a.screen} mono />
                                  <Detail label="Timezone" value={a.timezone} />
                                  <Detail label="Language" value={a.language} />
                                  <Detail label="SDK Present" value={a.tg_sdk_present ? 'Yes' : 'No'} />
                                  <Detail label="SDK Fake" value={a.tg_sdk_fake ? 'YES' : 'No'} highlight={a.tg_sdk_fake} />
                                  <Detail label="DevTools" value={a.devtools_opened ? 'YES' : 'No'} highlight={a.devtools_opened} />
                                  <Detail label="Referrer / URL" value={a.url} mono className="col-span-2 md:col-span-3" />
                                  <Detail label="Full User Agent" value={a.user_agent} mono className="col-span-2 md:col-span-3" />
                                  <Detail label="Timestamp" value={a.created_at ? dt(a.created_at) : null} />
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// ── Detail cell for expanded row ──────────────────────────────────────────────
function Detail({ label, value, mono, highlight, className = '' }: {
  label: string
  value: string | null | undefined
  mono?: boolean
  highlight?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`${mono ? 'font-mono text-[11px]' : 'text-xs'} ${highlight ? 'text-red-400 font-bold' : 'text-gray-300'} break-all`}>
        {value || '\u2014'}
      </p>
    </div>
  )
}

// ── Export (wrapped in Suspense for useSearchParams) ──────────────────────────
export default function AccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center text-gray-600 gap-3">
        <span className="material-symbols-outlined animate-spin text-2xl leading-none">progress_activity</span>
        <span className="text-sm">Loading...</span>
      </div>
    }>
      <AccessPageInner />
    </Suspense>
  )
}

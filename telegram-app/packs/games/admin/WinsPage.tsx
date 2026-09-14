'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useAdminToken } from '@/app/admin/hooks/useAdminToken'
import { REWARD_ASSETS, prizeToAsset } from '@/lib/rewardAssets'
import { buildTrustlineMessage } from '@/lib/messages'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'
import { BRANDING } from '@/config/branding'

// ── Types ─────────────────────────────────────────────────────────────────────
interface WinRow {
  id: number
  telegram_id: number
  user_first_name: string | null
  user_username: string | null
  prize: string
  prize_source: 'lucky_draw' | 'slot_machine' | 'scratch_card' | null
  amount: number | null
  win_code: string
  wallet_address: string | null
  claimed: boolean
  claimed_at: string | null
  payout_status: 'pending' | 'paid' | 'skipped'
  payout_tx_hash: string | null
  payout_notes: string | null
  payout_at: string | null
  paid_by: string | null
  created_at: string
}

interface WinsApiResponse {
  wins: WinRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  counts?: {
    pending: number
    paid: number
    skipped: number
  }
}

type FilterStatus = 'all' | 'pending' | 'paid' | 'skipped'
type FilterSource = 'all' | 'lucky_draw' | 'slot_machine' | 'scratch_card'

const SOURCE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  lucky_draw:   { label: 'Lucky Draw',  icon: 'casino',        color: 'text-primary' },
  slot_machine: { label: 'Slot',        icon: 'view_column',   color: 'text-purple-400' },
  scratch_card: { label: 'Scratch',     icon: 'grid_view',     color: 'text-blue-400' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const ago = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
const shortStr = (s: string, n = 8) =>
  s.length <= n ? s : `${s.slice(0, 4)}…${s.slice(-4)}`

// ── Dark UI primitives ────────────────────────────────────────────────────────
function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  const map: Record<string, string> = {
    green:  'bg-green-500/15 text-green-400 ring-1 ring-green-500/30',
    red:    'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
    yellow: 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30',
    gray:   'bg-white/10 text-gray-400 ring-1 ring-white/10',
    blue:   'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${map[color] ?? map.gray}`}>
      {children}
    </span>
  )
}

function CopyBtn({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      title={`Copy ${label ?? value}`}
      className="ml-1.5 text-gray-600 hover:text-primary transition align-middle"
    >
      {copied ? <span className="text-[10px] text-green-400">✓</span> : <span className="text-[11px]">⎘</span>}
    </button>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0a1020] border-b border-white/10">
      {children}
    </th>
  )
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td className={`px-3 py-3 text-sm text-gray-200 align-middle ${mono ? 'font-mono text-xs' : ''}`}>
      {children}
    </td>
  )
}

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined leading-none ${className}`}>{name}</span>
}

function StatTile({
  label,
  value,
  accent = 'text-white',
  sub,
}: {
  label: string
  value: string | number
  accent?: string
  sub?: string
}) {
  return (
    <div className="bg-[#111827] border border-white/6 rounded-xl p-4">
      <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

function PayoutBadge({ status }: { status: WinRow['payout_status'] }) {
  const map: Record<WinRow['payout_status'], string> = {
    pending: 'yellow',
    paid:    'green',
    skipped: 'gray',
  }
  return <Badge color={map[status]}>{status.toUpperCase()}</Badge>
}

// ── Main inner component ──────────────────────────────────────────────────────
function WinsPageInner() {
  const token = useAdminToken() ?? ''

  const [wins, setWins] = useState<WinRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [counts, setCounts] = useState({ pending: 0, paid: 0, skipped: 0 })

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterSource, setFilterSource] = useState<FilterSource>('all')
  const [filterPrize, setFilterPrize] = useState('')
  const [prizeInput, setPrizeInput] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  // CSV export
  const [exporting, setExporting] = useState(false)

  // Bulk notify no-trust
  const [bulkNotifying, setBulkNotifying] = useState(false)
  const [bulkNotifyDone, setBulkNotifyDone] = useState(false)

  // Prize override
  const [overrideId, setOverrideId] = useState<number | null>(null)
  const [overrideInput, setOverrideInput] = useState('')
  const [overrideSaving, setOverrideSaving] = useState(false)

  // paying: id currently being submitted; confirmPay: {id, action} awaiting confirm
  const [paying, setPaying] = useState<number | null>(null)
  const [confirmPay, setConfirmPay] = useState<{ id: number; action: 'paid' | 'skipped' } | null>(null)

  // Auto-send state
  const [sending, setSending] = useState<number | null>(null)
  const [sendError, setSendError] = useState<Record<number, string>>({})
  const [noTrustInfo, setNoTrustInfo] = useState<Record<number, { lobstrDeeplink: string; telegram_id: number }>>({})
  const [notifying, setNotifying] = useState<number | null>(null)
  const [notifyDone, setNotifyDone] = useState<Record<number, boolean>>({})

  // Send All state
  const [sendingAll, setSendingAll] = useState(false)
  const [sendAllProgress, setSendAllProgress] = useState<{ done: number; total: number; errors: number } | null>(null)
  const [confirmSendAll, setConfirmSendAll] = useState(false)

  // Sender wallet balances
  const [senderBalances, setSenderBalances] = useState<Record<string, string>>({})
  const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'

  const fetchWins = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
        ...(filterSource !== 'all' ? { source: filterSource } : {}),
        ...(filterPrize ? { prize: filterPrize } : {}),
      })
      const res = await fetch(`/api/admin/wins?${qs}`, {
        headers: { 'x-admin-token': token },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      const json = await res.json()
      const data: WinsApiResponse = json.data ?? json
      setWins(data.wins ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
      if (data.counts) setCounts(data.counts)
      setLastRefreshed(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [token, page, pageSize, filterStatus, filterSource, filterPrize])

  useEffect(() => { fetchWins() }, [fetchWins])

  // Auto-refresh every 30s
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchWins, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchWins])

  // Fetch sender wallet balances from Horizon
  useEffect(() => {
    const senderAddr = process.env.NEXT_PUBLIC_REWARD_SENDER_ADDRESS
    if (!senderAddr) return
    fetch(`${HORIZON_URL}/accounts/${senderAddr}`)
      .then(r => r.json())
      .then(account => {
        const bals: Record<string, string> = {}
        for (const b of (account.balances ?? [])) {
          if (b.asset_code) bals[b.asset_code] = parseFloat(b.balance).toLocaleString(undefined, { maximumFractionDigits: 2 })
        }
        setSenderBalances(bals)
      })
      .catch(() => {})
  }, [HORIZON_URL])

  const handleSend = async (id: number) => {
    setSending(id)
    setSendError(p => ({ ...p, [id]: '' }))
    setNoTrustInfo(p => { const n = { ...p }; delete n[id]; return n })
    try {
      const res = await fetch('/api/admin/send-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ winId: id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (json?.code === 'NO_TRUST' && json?.lobstrDeeplink) {
          setNoTrustInfo(p => ({ ...p, [id]: { lobstrDeeplink: json.lobstrDeeplink, telegram_id: json.telegram_id } }))
          setSendError(p => ({ ...p, [id]: 'No trustline — user must add it first.' }))
          return
        }
        if (json?.code === 'TIER_REQUIRED') {
          setSendError(p => ({ ...p, [id]: json?.error ?? `User does not meet Tier 1 (100 ${PRIMARY_CUSTOM_ASSET_CODE}) requirement.` }))
          return
        }
        throw new Error(json?.error ?? `HTTP ${res.status}`)
      }
      const txHash: string = json?.data?.txHash ?? ''
      setWins(prev => prev.map(w => w.id === id
        ? { ...w, payout_status: 'paid', payout_at: new Date().toISOString(), payout_tx_hash: txHash, claimed: true }
        : w,
      ))
      setCounts(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1), paid: prev.paid + 1 }))
    } catch (e) {
      setSendError(p => ({ ...p, [id]: e instanceof Error ? e.message : 'Send failed' }))
    } finally {
      setSending(null)
    }
  }

  const handleSendAll = async () => {
    setConfirmSendAll(false)
    const sendable = wins.filter(w => w.payout_status === 'pending' && !!prizeToAsset(w.prize) && !!w.wallet_address)
    if (sendable.length === 0) return
    setSendingAll(true)
    setSendAllProgress({ done: 0, total: sendable.length, errors: 0 })
    let errors = 0
    for (let i = 0; i < sendable.length; i++) {
      const w = sendable[i]
      try {
        const res = await fetch('/api/admin/send-reward', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
          body: JSON.stringify({ winId: w.id }),
        })
        const json = await res.json().catch(() => ({}))
        if (res.ok) {
          const txHash: string = json?.data?.txHash ?? ''
          setWins(prev => prev.map(r => r.id === w.id
            ? { ...r, payout_status: 'paid', payout_at: new Date().toISOString(), payout_tx_hash: txHash, claimed: true }
            : r,
          ))
          setCounts(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1), paid: prev.paid + 1 }))
        } else {
          errors++
          if (json?.code === 'NO_TRUST' && json?.lobstrDeeplink) {
            setNoTrustInfo(p => ({ ...p, [w.id]: { lobstrDeeplink: json.lobstrDeeplink, telegram_id: json.telegram_id } }))
            setSendError(p => ({ ...p, [w.id]: 'No trustline — user must add it first.' }))
          } else if (json?.code === 'TIER_REQUIRED') {
            setSendError(p => ({ ...p, [w.id]: json?.error ?? 'Does not meet Tier 1 requirement.' }))
          } else {
            setSendError(p => ({ ...p, [w.id]: json?.error ?? `HTTP ${res.status}` }))
          }
        }
      } catch {
        errors++
        setSendError(p => ({ ...p, [w.id]: 'Send failed' }))
      }
      setSendAllProgress({ done: i + 1, total: sendable.length, errors })
    }
    setSendingAll(false)
  }

  const handleNotifyTrustline = async (winId: number) => {
    const info = noTrustInfo[winId]
    if (!info) return
    const win = wins.find(w => w.id === winId)
    setNotifying(winId)
    try {
      await fetch('/api/bot/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({
          telegram_id: info.telegram_id,
          message: buildTrustlineMessage(true, win?.prize, win?.win_code),
        }),
      })
      setNotifyDone(p => ({ ...p, [winId]: true }))
    } finally {
      setNotifying(null)
    }
  }

  // Debounce prizeInput → filterPrize (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilterPrize(prizeInput)
      setPage(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [prizeInput])

  const handlePay = async (id: number, action: 'paid' | 'skipped') => {
    setPaying(id)
    setConfirmPay(null)
    try {
      const res = await fetch(`/api/admin/wins/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify({ status: action }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      // Optimistic update — patch local row
      setWins(prev =>
        prev.map(w =>
          w.id === id
            ? {
                ...w,
                payout_status: action,
                payout_at: new Date().toISOString(),
              }
            : w,
        ),
      )
      // Update counts optimistically
      setCounts(prev => {
        const next = { ...prev }
        // decrement old status if was pending/skipped
        const old = wins.find(w => w.id === id)?.payout_status
        if (old && old !== 'paid' && old in next) {
          next[old as 'pending' | 'skipped'] = Math.max(0, next[old as 'pending' | 'skipped'] - 1)
        }
        if (action in next) {
          next[action] += 1
        }
        return next
      })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update win')
    } finally {
      setPaying(null)
    }
  }

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const qs = new URLSearchParams({
        page: '1', limit: '500',
        ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
        ...(filterSource !== 'all' ? { source: filterSource } : {}),
        ...(filterPrize ? { prize: filterPrize } : {}),
      })
      const res = await fetch(`/api/admin/wins?${qs}`, { headers: { 'x-admin-token': token } })
      const json = await res.json()
      const rows: WinRow[] = (json.data ?? json).wins ?? []
      const header = ['id','telegram_id','user','prize','source','wallet','status','payout_tx_hash','date']
      const lines = [header.join(','), ...rows.map(w => [
        w.id,
        w.telegram_id,
        `"${(w.user_first_name ?? '') + (w.user_username ? ' @'+w.user_username : '')}"`,
        `"${w.prize}"`,
        w.prize_source ?? '',
        w.wallet_address ?? '',
        w.payout_status,
        w.payout_tx_hash ?? '',
        new Date(w.created_at).toISOString(),
      ].join(','))]
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url
      a.download = `wins-${new Date().toISOString().slice(0,10)}.csv`
      a.click(); URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  const handleBulkNotifyNoTrust = async () => {
    const entries = Object.entries(noTrustInfo)
    if (entries.length === 0) return
    setBulkNotifying(true)
    for (const [winIdStr, info] of entries) {
      const win = wins.find(w => w.id === Number(winIdStr))
      await fetch('/api/bot/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({
          telegram_id: info.telegram_id,
          message: buildTrustlineMessage(true, win?.prize, win?.win_code),
        }),
      })
      setNotifyDone(p => ({ ...p, [Number(winIdStr)]: true }))
    }
    setBulkNotifying(false)
    setBulkNotifyDone(true)
  }

  const handlePrizeOverride = async (id: number) => {
    const prize = overrideInput.trim()
    if (!prize) return
    setOverrideSaving(true)
    try {
      const res = await fetch(`/api/admin/wins/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ prize }),
      })
      if (res.ok) {
        setWins(prev => prev.map(w => w.id === id ? { ...w, prize } : w))
        setOverrideId(null)
        setOverrideInput('')
      }
    } finally { setOverrideSaving(false) }
  }

  const handleReset = () => {
    setFilterStatus('all')
    setFilterSource('all')
    setFilterPrize('')
    setPrizeInput('')
    setPage(1)
  }

  const handlePrizeSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFilterPrize(prizeInput)
    setPage(1)
  }

  return (
    <div className="min-h-screen bg-background-dark text-gray-100" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ── Header ── */}
      <header className="bg-surface border-b border-white/8 px-6 py-3 flex items-center gap-4 sticky top-0 z-20">
        <Link
          href="/admin"
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition shrink-0"
        >
          <Icon name="arrow_back" className="text-base" />
          Admin
        </Link>
        <div className="w-px h-5 bg-white/10" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon name="emoji_events" className="text-primary text-xl" />
          <h1 className="text-white font-bold text-sm truncate">Game Wins</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastRefreshed && (
            <span className="text-[10px] text-gray-600 hidden sm:block">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => setAutoRefresh(p => !p)}
            title={autoRefresh ? 'Auto-refresh ON — click to disable' : 'Auto-refresh OFF — click to enable'}
            className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-semibold transition ${autoRefresh ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/8 text-gray-500 border border-white/10 hover:bg-white/15'}`}
          >
            <Icon name="autorenew" className={`text-sm ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? '30s' : 'Auto'}
          </button>
          <span className="text-[11px] text-gray-500">{total} total</span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Stat tiles ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Total"   value={total}           accent="text-white" />
          <StatTile label="Pending" value={counts.pending}  accent="text-yellow-400" />
          <StatTile label="Paid"    value={counts.paid}     accent="text-green-400" />
          <StatTile label="Skipped" value={counts.skipped}  accent="text-gray-400" />
        </div>

        {/* ── Send All Pending ── */}
        {counts.pending > 0 && (
          <div className="bg-surface border border-primary/20 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">
                {counts.pending} pending reward{counts.pending !== 1 ? 's' : ''} waiting
              </p>
              {sendAllProgress && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {sendingAll ? `Sending ${sendAllProgress.done + 1} of ${sendAllProgress.total}…` : `Done — ${sendAllProgress.done} sent${sendAllProgress.errors > 0 ? `, ${sendAllProgress.errors} failed` : ', all successful ✓'}`}
                </p>
              )}
            </div>
            {confirmSendAll ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Send all {wins.filter(w => w.payout_status === 'pending' && !!prizeToAsset(w.prize) && !!w.wallet_address).length} sendable?</span>
                <button
                  onClick={handleSendAll}
                  className="text-xs bg-primary text-black font-bold px-3 py-1.5 rounded-lg hover:bg-[#f0d060] transition"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmSendAll(false)}
                  className="text-xs bg-white/10 text-gray-400 hover:bg-white/20 px-3 py-1.5 rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmSendAll(true)}
                disabled={sendingAll}
                className="flex items-center gap-2 text-sm font-bold text-black px-4 py-2 rounded-lg disabled:opacity-50 transition"
                style={{ background: sendingAll ? '#888' : `linear-gradient(135deg, ${BRANDING.colors.primary} 0%, #f0d060 100%)` }}
              >
                {sendingAll ? (
                  <><Icon name="progress_activity" className="text-sm animate-spin" /><span>Sending…</span></>
                ) : (
                  <><Icon name="send" className="text-sm" /><span>Send All Pending</span></>
                )}
              </button>
            )}
          </div>
        )}

        {/* ── Sender wallet balances + low-balance alert ── */}
        {Object.keys(senderBalances).length > 0 && (
          <div className="bg-surface border border-white/8 rounded-xl px-4 py-3 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] text-gray-500 uppercase font-medium mr-1">Sender Wallet</span>
              {REWARD_ASSETS.filter(a => senderBalances[a.code] !== undefined).map(a => {
                const bal = parseFloat(senderBalances[a.code]?.replace(/,/g, '') ?? '0')
                const isLow = bal < 50
                return (
                  <span key={a.code} className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${isLow ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-primary/10 text-primary border-primary/20'}`}>
                    {isLow && <Icon name="warning" className="text-[11px]" />}
                    {a.code}
                    <span className="text-white font-bold">{senderBalances[a.code]}</span>
                  </span>
                )
              })}
            </div>
            {REWARD_ASSETS.some(a => {
              const bal = parseFloat(senderBalances[a.code]?.replace(/,/g, '') ?? '999')
              return senderBalances[a.code] !== undefined && bal < 50
            }) && (
              <p className="text-[11px] text-red-400 flex items-center gap-1">
                <Icon name="error" className="text-sm" />
                Low balance warning — top up sender wallet before sending rewards
              </p>
            )}
          </div>
        )}

        {/* ── Bulk notify no-trust ── */}
        {Object.keys(noTrustInfo).length > 0 && (
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-yellow-300">
                {Object.keys(noTrustInfo).length} win{Object.keys(noTrustInfo).length !== 1 ? 's' : ''} blocked by missing trustline
              </p>
              {bulkNotifyDone && <p className="text-xs text-green-400 mt-0.5">✓ All users notified via Telegram</p>}
            </div>
            {!bulkNotifyDone && (
              <button
                onClick={handleBulkNotifyNoTrust}
                disabled={bulkNotifying}
                className="flex items-center gap-2 text-sm font-bold text-black px-4 py-2 rounded-lg disabled:opacity-50 bg-yellow-400 hover:bg-yellow-300 transition"
              >
                {bulkNotifying
                  ? <><Icon name="progress_activity" className="text-sm animate-spin" /><span>Notifying…</span></>
                  : <><Icon name="send" className="text-sm" /><span>Notify All</span></>}
              </button>
            )}
          </div>
        )}

        {/* ── Prize breakdown ── */}
        {wins.length > 0 && (() => {
          const breakdown: Record<string, number> = {}
          for (const w of wins) { breakdown[w.prize] = (breakdown[w.prize] ?? 0) + 1 }
          const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1])
          const max = sorted[0]?.[1] ?? 1
          return (
            <div className="bg-surface border border-white/8 rounded-xl px-4 py-3">
              <p className="text-[11px] text-gray-500 uppercase font-medium mb-3">Prize Breakdown (this page)</p>
              <div className="space-y-1.5">
                {sorted.map(([prize, count]) => (
                  <div key={prize} className="flex items-center gap-3">
                    <span className="text-xs text-primary w-32 truncate shrink-0" title={prize}>{prize}</span>
                    <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60 transition-all"
                        style={{ width: `${(count / max) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-6 text-right shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* ── Secret Key Checker ── */}
        <SecretKeyChecker token={token} />

        {/* ── Filter bar ── */}
        <div className="bg-surface border border-white/8 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
          {/* Status dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-500 uppercase font-medium">Status</label>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value as FilterStatus); setPage(1) }}
              className="bg-[#111827] border border-white/10 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="skipped">Skipped</option>
            </select>
          </div>

          {/* Game filter */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-500 uppercase font-medium">Game</label>
            <select
              value={filterSource}
              onChange={e => { setFilterSource(e.target.value as FilterSource); setPage(1) }}
              className="bg-[#111827] border border-white/10 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value="all">All Games</option>
              <option value="lucky_draw">Lucky Draw</option>
              <option value="slot_machine">Slot Machine</option>
              <option value="scratch_card">Scratch Card</option>
            </select>
          </div>

          {/* Prize filter */}
          <form onSubmit={handlePrizeSearch} className="flex items-center gap-2">
            <label className="text-[11px] text-gray-500 uppercase font-medium">Prize</label>
            <input
              type="text"
              value={prizeInput}
              onChange={e => setPrizeInput(e.target.value)}
              placeholder="filter prize…"
              className="bg-[#111827] border border-white/10 text-gray-200 text-sm rounded-lg px-3 py-1.5 w-40 focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder-gray-600"
            />
            <button
              type="submit"
              className="text-xs bg-primary/15 text-primary hover:bg-primary/25 px-3 py-1.5 rounded-lg font-semibold transition"
            >
              Search
            </button>
          </form>

          {/* Page size */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-500 uppercase font-medium">Per page</label>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="bg-[#111827] border border-white/10 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="flex items-center gap-1.5 text-xs bg-white/8 text-gray-300 hover:bg-white/15 px-3 py-1.5 rounded-lg font-semibold transition disabled:opacity-40"
            >
              <Icon name={exporting ? 'progress_activity' : 'download'} className={`text-sm ${exporting ? 'animate-spin' : ''}`} />
              CSV
            </button>
            <button
              onClick={handleReset}
              className="text-xs bg-white/8 text-gray-400 hover:bg-white/15 px-3 py-1.5 rounded-lg font-semibold transition"
            >
              Reset
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
            <Icon name="error" className="text-base" />
            {error}
            <button onClick={fetchWins} className="ml-auto underline text-xs">Retry</button>
          </div>
        )}

        {/* ── Table ── */}
        <div className="bg-surface border border-white/8 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-600 gap-3">
              <Icon name="progress_activity" className="text-2xl animate-spin" />
              <span className="text-sm">Loading wins…</span>
            </div>
          ) : wins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-600 gap-2">
              <Icon name="emoji_events" className="text-4xl text-gray-700" />
              <p className="text-sm">No wins found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>ID</Th>
                    <Th>User</Th>
                    <Th>Game</Th>
                    <Th>Prize</Th>
                    <Th>Amount</Th>
                    <Th>Win Code</Th>
                    <Th>Wallet</Th>
                    <Th>Claimed</Th>
                    <Th>Payout</Th>
                    <Th>Date</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {wins.map(w => (
                    <WinTableRow
                      key={w.id}
                      win={w}
                      paying={paying}
                      confirmPay={confirmPay}
                      onSetConfirm={setConfirmPay}
                      onPay={handlePay}
                      sending={sending}
                      sendError={sendError[w.id]}
                      onSend={handleSend}
                      noTrustInfo={noTrustInfo[w.id]}
                      notifying={notifying}
                      notifyDone={notifyDone[w.id]}
                      onNotify={handleNotifyTrustline}
                      overrideId={overrideId}
                      overrideInput={overrideInput}
                      overrideSaving={overrideSaving}
                      onStartOverride={(id, prize) => { setOverrideId(id); setOverrideInput(prize) }}
                      onOverrideInput={setOverrideInput}
                      onSaveOverride={handlePrizeOverride}
                      onCancelOverride={() => { setOverrideId(null); setOverrideInput('') }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10"
            >
              <Icon name="chevron_left" className="text-base" />
              Prev
            </button>
            <span className="text-sm text-gray-400">
              Page <span className="text-white font-semibold">{page}</span> of{' '}
              <span className="text-white font-semibold">{totalPages}</span>
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10"
            >
              Next
              <Icon name="chevron_right" className="text-base" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Secret Key Checker ────────────────────────────────────────────────────────
interface KeyCheckResult {
  valid: boolean
  reason?: string
  publicKey?: string
  isRewardSender?: boolean
  wallet?: { id: number; label: string | null; isPrimary: boolean; createdAt: string; lastConnectedAt: string | null } | null
  user?: { telegramId: number; username: string | null; firstName: string | null; createdAt: string } | null
  balance?: { nsafl: string | null; xlm: string | null; lastSynced: string | null } | null
}

function SecretKeyChecker({ token }: { token: string }) {
  const [open, setOpen] = useState(false)
  const [secretInput, setSecretInput] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<KeyCheckResult | null>(null)
  const [err, setErr] = useState('')

  const handleCheck = async () => {
    const secret = secretInput.trim()
    if (!secret) return
    setErr('')
    setResult(null)
    setChecking(true)
    try {
      // Derive public key client-side — secret NEVER sent to server
      const { Keypair } = await import('stellar-sdk')
      let publicKey: string
      try {
        publicKey = Keypair.fromSecret(secret).publicKey()
      } catch {
        setErr('Invalid Stellar secret key format.')
        return
      }

      const res = await fetch('/api/admin/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ publicKey }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(json?.error ?? `HTTP ${res.status}`); return }
      setResult(json?.data ?? json)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Check failed')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="bg-surface border border-white/8 rounded-xl overflow-hidden">
      <button
        onClick={() => { setOpen(p => !p); setResult(null); setErr(''); setSecretInput('') }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition text-left"
      >
        <div className="flex items-center gap-2">
          <Icon name="key" className="text-primary text-base" />
          <span className="text-sm font-semibold text-gray-200">Secret Key Checker</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 font-bold">ADMIN</span>
        </div>
        <Icon name={open ? 'expand_less' : 'expand_more'} className="text-gray-500 text-base" />
      </button>

      {open && (
        <div className="border-t border-white/8 px-4 py-4 space-y-4">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Enter a Stellar secret key to derive its public key and verify it exists in Supabase.
            The secret key is used <span className="text-yellow-400 font-medium">only in your browser</span> — only the public key is sent to the server.
          </p>

          <div className="flex gap-2">
            <input
              type="password"
              placeholder="S… (Stellar secret key)"
              value={secretInput}
              onChange={e => { setSecretInput(e.target.value); setResult(null); setErr('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleCheck() }}
              className="flex-1 bg-black/40 border border-white/10 text-gray-200 text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder-gray-600"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              onClick={handleCheck}
              disabled={checking || !secretInput.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-black disabled:opacity-40 transition"
              style={{ background: `linear-gradient(135deg, ${BRANDING.colors.primary} 0%, #f0d060 100%)` }}
            >
              {checking
                ? <><Icon name="progress_activity" className="text-xs animate-spin" /><span>Checking…</span></>
                : <><Icon name="search" className="text-xs" /><span>Verify</span></>}
            </button>
          </div>

          {err && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
              <Icon name="error" className="text-sm flex-shrink-0 mt-0.5" />
              {err}
            </div>
          )}

          {result && !result.valid && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 text-xs">
              <Icon name="warning" className="text-sm flex-shrink-0 mt-0.5" />
              {result.reason ?? 'Key not found in Supabase.'}
            </div>
          )}

          {result?.valid && (
            <div className="rounded-xl border border-green-500/25 bg-green-500/5 overflow-hidden">
              {/* Reward sender badge */}
              {result.isRewardSender && (
                <div className="px-4 py-2.5 bg-primary/10 border-b border-primary/20 flex items-center gap-2">
                  <Icon name="verified" className="text-primary text-base" />
                  <span className="text-xs font-bold text-primary">Reward Sender Wallet — key is correct ✓</span>
                </div>
              )}
              {/* Public key */}
              <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Derived Public Key</p>
                  <p className="text-xs font-mono text-green-300 break-all">{result.publicKey}</p>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(result.publicKey ?? '')}
                  className="text-gray-600 hover:text-primary transition flex-shrink-0"
                  title="Copy public key"
                >
                  <Icon name="content_copy" className="text-sm" />
                </button>
              </div>

              {/* Wallet info */}
              {result.wallet && (
                <div className="px-4 py-3 border-b border-white/6 grid grid-cols-2 gap-x-6 gap-y-1.5">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest col-span-2 mb-0.5">Wallet</p>
                  <KeyVal label="Wallet ID" value={String(result.wallet.id)} />
                  <KeyVal label="Primary" value={result.wallet.isPrimary ? '✅ Yes' : 'No'} />
                  <KeyVal label="Label" value={result.wallet.label ?? '—'} />
                  <KeyVal label="Created" value={new Date(result.wallet.createdAt).toLocaleDateString()} />
                  {result.wallet.lastConnectedAt && (
                    <KeyVal label="Last Connected" value={new Date(result.wallet.lastConnectedAt).toLocaleDateString()} />
                  )}
                </div>
              )}

              {/* User info */}
              {result.user && (
                <div className="px-4 py-3 border-b border-white/6 grid grid-cols-2 gap-x-6 gap-y-1.5">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest col-span-2 mb-0.5">Owner</p>
                  <KeyVal label="Telegram ID" value={String(result.user.telegramId)} />
                  <KeyVal label="Username" value={result.user.username ? `@${result.user.username}` : '—'} />
                  <KeyVal label="Name" value={result.user.firstName ?? '—'} />
                  <KeyVal label="Joined" value={new Date(result.user.createdAt).toLocaleDateString()} />
                </div>
              )}

              {/* Balance */}
              {result.balance && (
                <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest col-span-2 mb-0.5">Balance</p>
                  <KeyVal label={PRIMARY_CUSTOM_ASSET_CODE} value={result.balance.nsafl != null ? Number(result.balance.nsafl).toLocaleString() : '—'} accent="text-primary" />
                  <KeyVal label="XLM" value={result.balance.xlm != null ? Number(result.balance.xlm).toLocaleString() : '—'} />
                  {result.balance.lastSynced && (
                    <KeyVal label="Last Synced" value={new Date(result.balance.lastSynced).toLocaleString()} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function KeyVal({ label, value, accent = 'text-gray-200' }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-[10px] text-gray-600">{label}</p>
      <p className={`text-xs font-semibold ${accent}`}>{value}</p>
    </div>
  )
}

// ── Win table row (extracted to avoid re-render thrash) ───────────────────────
function WinTableRow({
  win: w,
  paying,
  confirmPay,
  onSetConfirm,
  onPay,
  sending,
  sendError,
  onSend,
  noTrustInfo,
  notifying,
  notifyDone,
  onNotify,
  overrideId,
  overrideInput,
  overrideSaving,
  onStartOverride,
  onOverrideInput,
  onSaveOverride,
  onCancelOverride,
}: {
  win: WinRow
  paying: number | null
  confirmPay: { id: number; action: 'paid' | 'skipped' } | null
  onSetConfirm: (v: { id: number; action: 'paid' | 'skipped' } | null) => void
  onPay: (id: number, action: 'paid' | 'skipped') => void
  sending: number | null
  sendError?: string
  onSend: (id: number) => void
  noTrustInfo?: { lobstrDeeplink: string; telegram_id: number }
  notifying: number | null
  notifyDone?: boolean
  onNotify: (id: number) => void
  overrideId: number | null
  overrideInput: string
  overrideSaving: boolean
  onStartOverride: (id: number, prize: string) => void
  onOverrideInput: (v: string) => void
  onSaveOverride: (id: number) => void
  onCancelOverride: () => void
}) {
  const [showMsg, setShowMsg] = useState(false)
  const [copied, setCopied] = useState(false)

  const isPaying = paying === w.id
  const isSending = sending === w.id
  const isConfirmingPaid    = confirmPay?.id === w.id && confirmPay?.action === 'paid'
  const isConfirmingSkipped = confirmPay?.id === w.id && confirmPay?.action === 'skipped'
  const alreadyDone = w.payout_status !== 'pending'
  const isSendable = !!prizeToAsset(w.prize) && !!w.wallet_address

  const trustlineMessageFull = buildTrustlineMessage(false, w.prize, w.win_code)

  function handleCopy() {
    navigator.clipboard.writeText(trustlineMessageFull).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <tr className="hover:bg-white/5 transition-colors">
      <Td mono><span className="text-gray-500">{w.id}</span></Td>
      <Td>
        <div className="flex flex-col gap-0.5">
          {(w.user_first_name || w.user_username) && (
            <span className="text-white font-semibold text-xs">
              {w.user_first_name ?? ''}{w.user_username ? ` @${w.user_username}` : ''}
            </span>
          )}
          <div className="flex items-center">
            <span className="text-gray-500 font-mono text-[11px]">{w.telegram_id}</span>
            <CopyBtn value={String(w.telegram_id)} label="Telegram ID" />
          </div>
        </div>
      </Td>
      <Td>
        {w.prize_source ? (
          <div className="flex items-center gap-1">
            <span className={`material-symbols-outlined text-sm leading-none ${SOURCE_LABELS[w.prize_source]?.color ?? 'text-gray-400'}`}>
              {SOURCE_LABELS[w.prize_source]?.icon ?? 'casino'}
            </span>
            <span className={`text-xs font-semibold ${SOURCE_LABELS[w.prize_source]?.color ?? 'text-gray-400'}`}>
              {SOURCE_LABELS[w.prize_source]?.label ?? w.prize_source}
            </span>
          </div>
        ) : (
          <span className="text-gray-600 text-xs">—</span>
        )}
      </Td>
      <Td>
        {overrideId === w.id ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={overrideInput}
              onChange={e => onOverrideInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onSaveOverride(w.id); if (e.key === 'Escape') onCancelOverride() }}
              className="bg-black/40 border border-primary/40 text-gray-200 text-xs font-mono rounded px-2 py-1 w-28 focus:outline-none focus:ring-1 focus:ring-primary/50"
              autoFocus
            />
            <button onClick={() => onSaveOverride(w.id)} disabled={overrideSaving} className="text-green-400 hover:text-green-300 transition disabled:opacity-40">
              <Icon name="check" className="text-sm" />
            </button>
            <button onClick={onCancelOverride} className="text-gray-500 hover:text-gray-300 transition">
              <Icon name="close" className="text-sm" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 group">
            <span className="text-primary font-medium">{w.prize}</span>
            {w.payout_status === 'pending' && (
              <button
                onClick={() => onStartOverride(w.id, w.prize)}
                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-gray-300 transition ml-1"
                title="Override prize"
              >
                <Icon name="edit" className="text-[11px]" />
              </button>
            )}
          </div>
        )}
      </Td>
      <Td>
        {w.amount != null
          ? <span className="font-semibold text-white">{w.amount.toLocaleString()}</span>
          : <span className="text-gray-600">—</span>
        }
      </Td>
      <Td mono>
        <span className="text-xs text-gray-400 bg-black/30 px-2 py-0.5 rounded" title={w.win_code}>
          {shortStr(w.win_code, 12)}
        </span>
        <CopyBtn value={w.win_code} label="win code" />
      </Td>
      <Td mono>
        {w.wallet_address
          ? <span className="inline-flex items-center gap-0.5">
              <span className="text-xs text-primary" title={w.wallet_address}>{shortStr(w.wallet_address)}</span>
              <CopyBtn value={w.wallet_address} label="wallet address" />
            </span>
          : <span className="text-gray-600">—</span>
        }
      </Td>
      <Td>
        {w.claimed
          ? <div>
              <Badge color="green">Yes</Badge>
              {w.claimed_at && <div className="text-[10px] text-gray-600 mt-0.5">{ago(w.claimed_at)}</div>}
            </div>
          : <Badge color="gray">No</Badge>
        }
      </Td>
      <Td>
        <div className="space-y-1">
          <PayoutBadge status={w.payout_status} />
          {w.payout_at && (
            <div className="text-[10px] text-gray-600">{ago(w.payout_at)}</div>
          )}
          {w.payout_tx_hash && (
            <div
              className="text-[10px] font-mono text-gray-500 bg-black/20 rounded px-1.5 py-0.5 max-w-[100px] truncate"
              title={w.payout_tx_hash}
            >
              {w.payout_tx_hash}
            </div>
          )}
          {w.payout_notes && (
            <div className="text-[10px] text-gray-500 italic max-w-[120px] truncate" title={w.payout_notes}>
              {w.payout_notes}
            </div>
          )}
          {w.paid_by && (
            <div className="text-[10px] text-gray-600">by {w.paid_by}</div>
          )}
        </div>
      </Td>
      <Td>
        <div className="text-xs text-gray-500">
          <div>{ago(w.created_at)}</div>
          <div className="text-[10px] text-gray-700">{new Date(w.created_at).toLocaleDateString()}</div>
        </div>
      </Td>
      <Td>
        {isPaying || isSending ? (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm leading-none animate-spin">progress_activity</span>
            {isSending ? 'Sending…' : 'Saving…'}
          </span>
        ) : alreadyDone ? (
          <div className="space-y-1">
            <span className="text-xs text-gray-600 italic">Done</span>
            {w.payout_tx_hash && (
              <a
                href={`https://stellar.expert/explorer/public/tx/${w.payout_tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-blue-400 hover:underline"
              >
                <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                Explorer
              </a>
            )}
            {/* Resend for paid wins — in case tx dropped */}
            {w.payout_status === 'paid' && isSendable && (
              <button
                onClick={() => onSend(w.id)}
                disabled={isSending}
                className="flex items-center gap-1 text-[10px] text-orange-400 hover:text-orange-300 transition disabled:opacity-40"
                title="Resend payment (use if original tx dropped)"
              >
                <Icon name="replay" className="text-[10px]" />
                Resend
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {/* Auto-Send Payment (asset prizes only) */}
            {isSendable && (
              <button
                onClick={() => onSend(w.id)}
                className="text-xs bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 px-2 py-0.5 rounded font-semibold transition whitespace-nowrap flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-xs leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                Send Payment
              </button>
            )}
            {sendError && (
              <p className="text-[10px] text-red-400 max-w-[160px] leading-tight">{sendError}</p>
            )}
            {noTrustInfo && (
              <div className="flex flex-col gap-1 mt-0.5">
                {notifyDone ? (
                  <span className="text-[10px] text-green-400 font-semibold">✓ Notified via Telegram</span>
                ) : (
                  <button
                    onClick={() => onNotify(w.id)}
                    disabled={notifying === w.id}
                    className="text-[10px] bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25 px-2 py-0.5 rounded font-semibold transition whitespace-nowrap flex items-center gap-1 disabled:opacity-50"
                  >
                    {notifying === w.id
                      ? <span className="material-symbols-outlined text-[10px] leading-none animate-spin">progress_activity</span>
                      : <span className="material-symbols-outlined text-[10px] leading-none">send</span>
                    }
                    Notify User
                  </button>
                )}
                {/* Toggle to preview + manually copy the message */}
                <button
                  onClick={() => setShowMsg(v => !v)}
                  className="text-[10px] text-gray-500 hover:text-gray-300 transition flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-[10px] leading-none">
                    {showMsg ? 'expand_less' : 'expand_more'}
                  </span>
                  {showMsg ? 'Hide message' : 'View message'}
                </button>
                {showMsg && (
                  <div className="mt-0.5 rounded bg-black/30 border border-white/10 p-2 space-y-1.5">
                    <pre className="text-[9px] text-gray-400 whitespace-pre-wrap leading-relaxed font-mono">
                      {trustlineMessageFull}
                    </pre>
                    <button
                      onClick={handleCopy}
                      className="text-[9px] bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 px-2 py-0.5 rounded transition flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[9px] leading-none">
                        {copied ? 'check' : 'content_copy'}
                      </span>
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                )}
                <a
                  href={noTrustInfo.lobstrDeeplink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-400 hover:underline flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-[10px] leading-none">open_in_new</span>
                  Trustline link
                </a>
              </div>
            )}

            {/* Mark Paid manually */}
            {isConfirmingPaid ? (
              <span className="inline-flex items-center gap-1 text-xs">
                <span className="text-gray-400">Sure?</span>
                <button
                  onClick={() => onPay(w.id, 'paid')}
                  className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 font-semibold transition"
                >
                  Yes
                </button>
                <button
                  onClick={() => onSetConfirm(null)}
                  className="px-2 py-0.5 rounded bg-white/10 text-gray-400 hover:bg-white/20 font-semibold transition"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={() => onSetConfirm({ id: w.id, action: 'paid' })}
                className="text-xs bg-green-500/15 text-green-400 hover:bg-green-500/25 px-2 py-0.5 rounded font-semibold transition whitespace-nowrap"
              >
                Mark Paid
              </button>
            )}

            {/* Skip */}
            {isConfirmingSkipped ? (
              <span className="inline-flex items-center gap-1 text-xs">
                <span className="text-gray-400">Sure?</span>
                <button
                  onClick={() => onPay(w.id, 'skipped')}
                  className="px-2 py-0.5 rounded bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 font-semibold transition"
                >
                  Yes
                </button>
                <button
                  onClick={() => onSetConfirm(null)}
                  className="px-2 py-0.5 rounded bg-white/10 text-gray-400 hover:bg-white/20 font-semibold transition"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={() => onSetConfirm({ id: w.id, action: 'skipped' })}
                className="text-xs bg-white/8 text-gray-400 hover:bg-white/15 px-2 py-0.5 rounded font-semibold transition whitespace-nowrap"
              >
                Skip
              </button>
            )}
          </div>
        )}
      </Td>
    </tr>
  )
}

// ── Export (wrapped in Suspense for useSearchParams) ──────────────────────────
export default function WinsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background-dark flex items-center justify-center text-gray-600 gap-3">
        <span className="material-symbols-outlined animate-spin text-2xl leading-none">progress_activity</span>
        <span className="text-sm">Loading…</span>
      </div>
    }>
      <WinsPageInner />
    </Suspense>
  )
}

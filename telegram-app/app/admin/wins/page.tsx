'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────
interface WinRow {
  id: number
  telegram_id: number
  prize: string
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

// ── Helpers ───────────────────────────────────────────────────────────────────
const ago = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
const dt = (iso: string) => new Date(iso).toLocaleString()
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

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-white/5">
      {children}
    </th>
  )
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td className={`px-3 py-2.5 text-sm text-gray-200 align-top ${mono ? 'font-mono text-xs' : ''}`}>
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
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const [wins, setWins] = useState<WinRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [counts, setCounts] = useState({ pending: 0, paid: 0, skipped: 0 })

  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterPrize, setFilterPrize] = useState('')
  const [prizeInput, setPrizeInput] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // paying: id currently being submitted; confirmPay: {id, action} awaiting confirm
  const [paying, setPaying] = useState<number | null>(null)
  const [confirmPay, setConfirmPay] = useState<{ id: number; action: 'paid' | 'skipped' } | null>(null)

  const fetchWins = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        token,
        page: String(page),
        ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
        ...(filterPrize ? { prize: filterPrize } : {}),
      })
      const res = await fetch(`/api/admin/wins?${qs}`)
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [token, page, filterStatus, filterPrize])

  useEffect(() => { fetchWins() }, [fetchWins])

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

  const handleReset = () => {
    setFilterStatus('all')
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
    <div className="min-h-screen bg-[#0a0f1e] text-gray-100" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ── Header ── */}
      <header className="bg-[#0d1424] border-b border-white/8 px-6 py-3 flex items-center gap-4 sticky top-0 z-20">
        <Link
          href={`/admin?token=${token}`}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition shrink-0"
        >
          <Icon name="arrow_back" className="text-base" />
          Admin
        </Link>
        <div className="w-px h-5 bg-white/10" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon name="emoji_events" className="text-[#D4AF37] text-xl" />
          <h1 className="text-white font-bold text-sm truncate">Lucky Draw Wins</h1>
        </div>
        <span className="text-[11px] text-gray-500 shrink-0">{total} total</span>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Stat tiles ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Total"   value={total}           accent="text-white" />
          <StatTile label="Pending" value={counts.pending}  accent="text-yellow-400" />
          <StatTile label="Paid"    value={counts.paid}     accent="text-green-400" />
          <StatTile label="Skipped" value={counts.skipped}  accent="text-gray-400" />
        </div>

        {/* ── Filter bar ── */}
        <div className="bg-[#0d1424] border border-white/8 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
          {/* Status dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-500 uppercase font-medium">Status</label>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value as FilterStatus); setPage(1) }}
              className="bg-[#111827] border border-white/10 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="skipped">Skipped</option>
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
              className="bg-[#111827] border border-white/10 text-gray-200 text-sm rounded-lg px-3 py-1.5 w-40 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50 placeholder-gray-600"
            />
            <button
              type="submit"
              className="text-xs bg-[#D4AF37]/15 text-[#D4AF37] hover:bg-[#D4AF37]/25 px-3 py-1.5 rounded-lg font-semibold transition"
            >
              Search
            </button>
          </form>

          <button
            onClick={handleReset}
            className="text-xs bg-white/8 text-gray-400 hover:bg-white/15 px-3 py-1.5 rounded-lg font-semibold transition ml-auto"
          >
            Reset
          </button>
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
        <div className="bg-[#0d1424] border border-white/8 rounded-xl overflow-hidden">
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
                <thead className="bg-white/3 sticky top-[52px] z-10">
                  <tr>
                    <Th>ID</Th>
                    <Th>Telegram ID</Th>
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
                <tbody className="divide-y divide-white/4">
                  {wins.map(w => (
                    <WinTableRow
                      key={w.id}
                      win={w}
                      paying={paying}
                      confirmPay={confirmPay}
                      onSetConfirm={setConfirmPay}
                      onPay={handlePay}
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

// ── Win table row (extracted to avoid re-render thrash) ───────────────────────
function WinTableRow({
  win: w,
  paying,
  confirmPay,
  onSetConfirm,
  onPay,
}: {
  win: WinRow
  paying: number | null
  confirmPay: { id: number; action: 'paid' | 'skipped' } | null
  onSetConfirm: (v: { id: number; action: 'paid' | 'skipped' } | null) => void
  onPay: (id: number, action: 'paid' | 'skipped') => void
}) {
  const isPaying = paying === w.id
  const isConfirmingPaid    = confirmPay?.id === w.id && confirmPay?.action === 'paid'
  const isConfirmingSkipped = confirmPay?.id === w.id && confirmPay?.action === 'skipped'
  const alreadyDone = w.payout_status !== 'pending'

  return (
    <tr className="hover:bg-white/3 transition-colors">
      <Td mono><span className="text-gray-500">{w.id}</span></Td>
      <Td mono><span className="text-gray-300">{w.telegram_id}</span></Td>
      <Td>
        <span className="text-[#D4AF37] font-medium">{w.prize}</span>
      </Td>
      <Td>
        {w.amount != null
          ? <span className="font-semibold text-white">{w.amount.toLocaleString()}</span>
          : <span className="text-gray-600">—</span>
        }
      </Td>
      <Td mono>
        <span
          className="text-xs text-gray-400 bg-black/30 px-2 py-0.5 rounded"
          title={w.win_code}
        >
          {shortStr(w.win_code, 12)}
        </span>
      </Td>
      <Td mono>
        {w.wallet_address
          ? <span className="text-xs text-gray-400" title={w.wallet_address}>{shortStr(w.wallet_address)}</span>
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
        {isPaying ? (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm leading-none animate-spin">progress_activity</span>
            Saving…
          </span>
        ) : alreadyDone ? (
          <span className="text-xs text-gray-600 italic">Done</span>
        ) : (
          <div className="flex flex-col gap-1.5">
            {/* Mark Paid */}
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
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center text-gray-600 gap-3">
        <span className="material-symbols-outlined animate-spin text-2xl leading-none">progress_activity</span>
        <span className="text-sm">Loading…</span>
      </div>
    }>
      <WinsPageInner />
    </Suspense>
  )
}

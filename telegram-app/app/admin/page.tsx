'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ALL_CLUBS } from "@/config/afl"
import { Suspense } from 'react'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'

// ── Types ─────────────────────────────────────────────────────────────────────
interface WalletBalance { nsafl_balance: number; xlm_balance: number; balance_week_ago: number; last_synced_at: string }
interface Wallet { id: string; stellar_address: string; label: string | null; is_primary: boolean; created_at: string; last_connected_at: string | null; wallet_balances: WalletBalance[] }
interface User {
  telegram_id: number; telegram_username: string | null; telegram_first_name: string | null
  telegram_photo_url: string | null; telegram_phone: string | null; favorite_team: string | null
  display_preference: string; opt_in_telegram_notifications: boolean; is_blocked: boolean
  referred_by: number | null; created_at: string; updated_at: string; wallets: Wallet[]
}
interface TeamRequest { id: string; telegram_id: number; requested_team: string; status: string; admin_note: string | null; created_at: string; resolved_at: string | null }
interface GameSession { id: string; telegram_id: number | null; wallet_id: string | null; kicks: number; balls_spawned: number; duration_seconds: number; created_at: string }
interface Donation { id: string; wallet_id: string; amount: number; asset_code: string; donation_type: string; donation_target: string | null; stellar_tx_hash: string | null; verified: boolean; created_at: string }
interface Purchase { id: string; wallet_id: string; xlm_amount: number; token_amount: number; stellar_tx_hash: string | null; purchase_type: string; verified: boolean; created_at: string }
interface AccessAttempt { id: string; ip: string | null; user_agent: string | null; tg_sdk_present: boolean; tg_sdk_fake: boolean; devtools_opened: boolean; screen: string | null; timezone: string | null; language: string | null; url: string | null; telegram_id: number | null; telegram_username: string | null; telegram_first_name: string | null; geo_location: string | null; created_at: string }
interface ReferralStat { referrer_id: number; referrer_name: string | null; referrer_username: string | null; referral_count: number; last_referral_at: string }
interface ReferredUser { telegram_id: number; telegram_first_name: string | null; telegram_username: string | null; referred_by: number | null; created_at: string }
interface TrustlineSubmission { id: number; ip: string | null; xdr: string; horizon_result: Record<string, unknown> | null; success: boolean | null; tx_hash: string | null; type: string; created_at: string }
interface AdminData { users: User[]; teamRequests: TeamRequest[]; gameSessions: GameSession[]; donations: Donation[]; purchases: Purchase[]; accessAttempts: AccessAttempt[]; referralStats: ReferralStat[]; referredUsers: ReferredUser[]; trustlineSubmissions: TrustlineSubmission[] }

type Tab = 'overview' | 'users' | 'requests' | 'game' | 'donations' | 'purchases' | 'access' | 'referrals' | 'trustline'
type ConfirmAction = { type: 'block' | 'delete' | 'logout'; telegramId: number } | null

// ── Helpers ───────────────────────────────────────────────────────────────────
const dt = (iso: string) => new Date(iso).toLocaleString()
const ago = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
const teamName = (id: string | null) => id ? (ALL_CLUBS.find(c => c.id === id)?.name ?? id) : '—'
const num = (n: number | null | undefined) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
const shortAddr = (addr: string) => `${addr.slice(0, 4)}…${addr.slice(-6)}`
function TgUser({ users, id }: { users: User[]; id: number | null | undefined }) {
  if (!id) return <span className="text-gray-600">anon</span>
  const u = users.find(x => x.telegram_id === id)
  const name = u?.telegram_first_name ?? u?.telegram_username ?? null
  return (
    <span>
      {name && <span className="font-medium text-white block">{name}{u?.telegram_username ? ` (@${u.telegram_username})` : ''}</span>}
      <span className="text-[10px] text-gray-600 font-mono">#{id}</span>
    </span>
  )
}

// ── Dark UI primitives ────────────────────────────────────────────────────────
function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  const map: Record<string, string> = {
    green:  'bg-green-500/15 text-green-400 ring-1 ring-green-500/30',
    red:    'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
    yellow: 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30',
    gray:   'bg-white/10 text-gray-400 ring-1 ring-white/10',
    blue:   'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
    orange: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30',
    purple: 'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30',
    gold:   'bg-yellow-500/10 text-[#D4AF37] ring-1 ring-[#D4AF37]/30',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${map[color] ?? map.gray}`}>{children}</span>
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-white/5">{children}</th>
}
function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`px-3 py-2.5 text-sm text-gray-200 align-top ${mono ? 'font-mono text-xs' : ''}`}>{children}</td>
}
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-[#111827] border border-white/8 rounded-xl overflow-hidden ${className}`}>{children}</div>
}

// ── Material Symbol icon ──────────────────────────────────────────────────────
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined leading-none ${className}`}>{name}</span>
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionTitle({ icon, title, count }: { icon: string; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon name={icon} className="text-lg text-[#D4AF37]" />
      <h3 className="text-sm font-bold text-white">{title}</h3>
      {count !== undefined && (
        <span className="bg-white/8 text-gray-400 text-[11px] font-semibold px-2 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, accent = 'text-white' }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-[#111827] border border-white/6 rounded-xl p-4">
      <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Summary stats strip ───────────────────────────────────────────────────────
function SummaryStrip({ data }: { data: AdminData }) {
  const totalUsers = data.users.length
  const totalDonations = data.donations.length
  const donationSum = data.donations.reduce((s, d) => s + Number(d.amount), 0)
  const verifiedDonations = data.donations.filter(d => d.verified).length
  const pendingTeamRequests = data.teamRequests.filter(r => r.status === 'pending').length

  const stats = [
    { label: 'Total Users',       value: totalUsers,                       accent: 'text-blue-400',   icon: 'group' },
    { label: 'Total Donations',   value: `${totalDonations}`,              sub: `${num(donationSum)} total`, accent: 'text-green-400',  icon: 'volunteer_activism' },
    { label: 'Verified Donations',value: verifiedDonations,                accent: 'text-[#D4AF37]',  icon: 'verified' },
    { label: 'Pending Requests',  value: pendingTeamRequests,              accent: pendingTeamRequests > 0 ? 'text-red-400' : 'text-gray-500', icon: 'pending_actions' },
  ]

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 px-6 pt-4">
      {stats.map(s => (
        <div key={s.label} className="flex-none min-w-[150px] bg-white/3 border border-white/8 rounded-xl p-3 backdrop-blur-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
            <Icon name={s.icon} className={`text-base ${s.accent}`} />
          </div>
          <div>
            <p className={`text-xl font-bold leading-tight ${s.accent}`}>{s.value}</p>
            <p className="text-[10px] text-gray-500 font-medium leading-tight">{s.label}</p>
            {s.sub && <p className="text-[10px] text-gray-600 mt-0.5">{s.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Inline confirm buttons ────────────────────────────────────────────────────
function InlineConfirm({
  label,
  confirmStyle,
  confirmId,
  activeId,
  onConfirm,
  onSetActive,
  buttonStyle,
}: {
  label: string
  confirmStyle: string
  confirmId: string
  activeId: ConfirmAction
  onConfirm: () => void
  onSetActive: (v: ConfirmAction) => void
  buttonStyle: string
}) {
  const isActive = activeId?.telegramId === parseInt(confirmId) && activeId?.type === (label.toLowerCase() as 'block' | 'delete' | 'logout')
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <span className="text-gray-400">Sure?</span>
        <button onClick={onConfirm} className={`px-2 py-0.5 rounded font-semibold transition ${confirmStyle}`}>Yes</button>
        <button onClick={() => onSetActive(null)} className="px-2 py-0.5 rounded bg-white/10 text-gray-400 hover:bg-white/20 font-semibold transition">No</button>
      </span>
    )
  }
  return (
    <button
      onClick={() => onSetActive({ type: label.toLowerCase() as 'block' | 'delete' | 'logout', telegramId: parseInt(confirmId) })}
      className={`text-xs px-2 py-0.5 rounded font-semibold transition ${buttonStyle}`}
    >
      {label}
    </button>
  )
}

// ── Donation type badge ───────────────────────────────────────────────────────
function DonationTypeBadge({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    team: 'blue',
    player: 'purple',
    general: 'gray',
  }
  return <Badge color={colorMap[type] ?? 'gray'}>{type.toUpperCase()}</Badge>
}

// ── User detail full page ─────────────────────────────────────────────────────
// ── Activity Timeline ─────────────────────────────────────────────────────────
interface TimelineItem {
  date: string
  type: 'game' | 'donation' | 'purchase' | 'team' | 'access' | 'wallet'
  label: string
  detail?: string
  isAlert?: boolean
}

const TIMELINE_DOT: Record<TimelineItem['type'], string> = {
  game:     'bg-green-500',
  donation: 'bg-[#D4AF37]',
  purchase: 'bg-blue-500',
  team:     'bg-purple-500',
  access:   'bg-gray-500',
  wallet:   'bg-cyan-500',
}

function buildTimeline(
  u: User,
  userSessions: GameSession[],
  userDonations: Donation[],
  userPurchases: Purchase[],
  userRequests: TeamRequest[],
  userAccess: AccessAttempt[],
): TimelineItem[] {
  const items: TimelineItem[] = []

  for (const w of u.wallets) {
    items.push({
      date: w.created_at,
      type: 'wallet',
      label: `Connected wallet ${shortAddr(w.stellar_address)}`,
      detail: w.label ?? undefined,
    })
  }

  for (const g of userSessions) {
    items.push({
      date: g.created_at,
      type: 'game',
      label: `Played a game — ${g.kicks} kicks in ${g.duration_seconds}s`,
      detail: g.balls_spawned ? `${g.balls_spawned} balls spawned` : undefined,
    })
  }

  for (const d of userDonations) {
    const target = d.donation_target ?? 'General'
    items.push({
      date: d.created_at,
      type: 'donation',
      label: `Donated ${num(d.amount)} ${d.asset_code} to ${target}`,
      detail: d.verified ? 'Verified' : 'Pending verification',
    })
  }

  for (const p of userPurchases) {
    items.push({
      date: p.created_at,
      type: 'purchase',
      label: `Purchased ${num(p.token_amount)} ${PRIMARY_CUSTOM_ASSET_CODE} for ${num(p.xlm_amount)} XLM`,
      detail: p.verified ? 'Verified' : 'Pending verification',
    })
  }

  for (const r of userRequests) {
    items.push({
      date: r.created_at,
      type: 'team',
      label: `Requested team change to ${teamName(r.requested_team)} — ${r.status}`,
      detail: r.admin_note ?? undefined,
    })
  }

  for (const a of userAccess) {
    const isAlert = a.devtools_opened || a.tg_sdk_fake
    const location = a.geo_location ? ` from ${a.geo_location}` : a.ip ? ` from ${a.ip}` : ''
    const eventLabel = a.devtools_opened
      ? `Suspicious: DevTools opened${location}`
      : a.tg_sdk_fake
      ? `Suspicious: Fake SDK detected${location}`
      : `Opened app${location}`
    items.push({
      date: a.created_at,
      type: 'access',
      label: eventLabel,
      detail: a.screen ?? undefined,
      isAlert,
    })
  }

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return items
}

function ActivityTimeline({
  u, userSessions, userDonations, userPurchases, userRequests, userAccess,
}: {
  u: User
  userSessions: GameSession[]
  userDonations: Donation[]
  userPurchases: Purchase[]
  userRequests: TeamRequest[]
  userAccess: AccessAttempt[]
}) {
  const [showAll, setShowAll] = useState(false)
  const all = buildTimeline(u, userSessions, userDonations, userPurchases, userRequests, userAccess)
  const visible = showAll ? all : all.slice(0, 20)

  if (all.length === 0) {
    return (
      <section>
        <SectionTitle icon="timeline" title="Activity Timeline" count={0} />
        <p className="text-gray-600 text-sm">No activity recorded yet.</p>
      </section>
    )
  }

  return (
    <section>
      <SectionTitle icon="timeline" title="Activity Timeline" count={all.length} />
      <div className="relative pl-6 border-l-2 border-white/10 space-y-0">
        {visible.map((item, tIdx) => (
          <div key={tIdx} className="relative pb-5">
            <span
              className={`absolute -left-[25px] top-1 w-3 h-3 rounded-full border-2 border-[#0a0f1e] ${item.isAlert ? 'bg-red-500' : TIMELINE_DOT[item.type]}`}
            />
            <div className="ml-2">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={`text-sm font-medium ${item.isAlert ? 'text-red-300' : 'text-gray-200'}`}>
                  {item.label}
                </span>
                <span className="text-[11px] text-gray-600 shrink-0">{ago(item.date)}</span>
              </div>
              {item.detail && (
                <p className="text-[11px] text-gray-500 mt-0.5">{item.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      {all.length > 20 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-2 text-xs text-[#D4AF37] hover:text-yellow-300 font-semibold transition"
        >
          {showAll ? 'Show less' : `Show all ${all.length} events`}
        </button>
      )}
    </section>
  )
}

function UserDetail({
  u, data, token,
  onBack,
  onAction,
  onDeleteAccess,
  deletingAccessId,
  onUserUpdated,
}: {
  u: User
  data: AdminData
  token: string
  onBack: () => void
  onAction: (type: 'logout' | 'block' | 'unblock' | 'delete') => void
  onDeleteAccess: (id: string) => void
  deletingAccessId: string | null
  onUserUpdated: (telegramId: number, patch: Partial<User>) => void
}) {
  const walletIds = new Set(u.wallets.map(w => w.id))
  const userAccess    = data.accessAttempts.filter(a => a.telegram_id === u.telegram_id)
  const userSessions  = data.gameSessions.filter(g => g.telegram_id === u.telegram_id)
  const userDonations = data.donations.filter(d => walletIds.has(d.wallet_id))
  const userPurchases = data.purchases.filter(p => walletIds.has(p.wallet_id))
  const userRequests  = data.teamRequests.filter(r => r.telegram_id === u.telegram_id)
  const totalKicks    = userSessions.reduce((s, g) => s + g.kicks, 0)
  const totalTokenBal       = u.wallets.reduce((s, w) => s + Number(w.wallet_balances[0]?.nsafl_balance ?? 0), 0)
  const totalXLM      = u.wallets.reduce((s, w) => s + Number(w.wallet_balances[0]?.xlm_balance ?? 0), 0)
  const lastSeen      = u.wallets.reduce<string | null>((best, w) => {
    if (!w.last_connected_at) return best
    if (!best) return w.last_connected_at
    return w.last_connected_at > best ? w.last_connected_at : best
  }, null)

  const [detailConfirm, setDetailConfirm] = useState<ConfirmAction>(null)

  // ── Inline edit state ──
  const [editingTeam, setEditingTeam] = useState(false)
  const [teamDraft, setTeamDraft] = useState(u.favorite_team ?? '')
  const [editingPref, setEditingPref] = useState(false)
  const [prefDraft, setPrefDraft] = useState(u.display_preference)
  const [editSaving, setEditSaving] = useState(false)
  const [editToast, setEditToast] = useState<string | null>(null)

  function showEditToast(msg: string) {
    setEditToast(msg)
    setTimeout(() => setEditToast(null), 3000)
  }

  async function saveTeam() {
    setEditSaving(true)
    try {
      const res = await fetch(`/api/admin/user/${u.telegram_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ favorite_team: teamDraft || null }),
      })
      const j = await res.json()
      if (j.success) {
        onUserUpdated(u.telegram_id, { favorite_team: teamDraft || null })
        setEditingTeam(false)
        showEditToast('Updated')
      } else {
        showEditToast('Save failed')
      }
    } finally {
      setEditSaving(false)
    }
  }

  async function savePref() {
    setEditSaving(true)
    try {
      const res = await fetch(`/api/admin/user/${u.telegram_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ display_preference: prefDraft }),
      })
      const j = await res.json()
      if (j.success) {
        onUserUpdated(u.telegram_id, { display_preference: prefDraft })
        setEditingPref(false)
        showEditToast('Updated')
      } else {
        showEditToast('Save failed')
      }
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-gray-100">

      {/* ── Edit toast ── */}
      {editToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-[#1a2235] border border-white/10 text-white text-sm px-5 py-3 rounded-xl shadow-2xl backdrop-blur-sm">
          {editToast}
        </div>
      )}

      {/* ── Top bar ── */}
      <header className="bg-[#0d1424] border-b border-white/8 px-6 py-3 flex items-center gap-4 sticky top-0 z-20">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition">
          ← Back
        </button>
        <div className="w-px h-5 bg-white/10" />
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {u.telegram_photo_url
            ? <img src={u.telegram_photo_url} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
            : <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-bold text-sm shrink-0">{(u.telegram_first_name ?? '?')[0]}</div>
          }
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-semibold text-sm">{u.telegram_first_name ?? '—'}</span>
              {u.telegram_username && <span className="text-[#D4AF37] text-sm">@{u.telegram_username}</span>}
              <Badge color={u.is_blocked ? 'red' : 'green'}>{u.is_blocked ? 'Blocked' : 'Active'}</Badge>
            </div>
            <span className="text-gray-600 text-xs font-mono">ID {u.telegram_id}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Logout with inline confirm */}
          {detailConfirm?.type === 'logout' && detailConfirm.telegramId === u.telegram_id ? (
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="text-gray-400">Log out?</span>
              <button onClick={() => { setDetailConfirm(null); onAction('logout') }} className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-semibold">Yes</button>
              <button onClick={() => setDetailConfirm(null)} className="px-2 py-1 rounded bg-white/10 text-gray-400 hover:bg-white/20 font-semibold">No</button>
            </span>
          ) : (
            <button onClick={() => setDetailConfirm({ type: 'logout', telegramId: u.telegram_id })} className="text-xs bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 px-3 py-1.5 rounded-lg font-semibold transition">Logout</button>
          )}
          {u.is_blocked ? (
            <button onClick={() => onAction('unblock')} className="text-xs bg-green-500/15 text-green-400 hover:bg-green-500/25 px-3 py-1.5 rounded-lg font-semibold transition">Unblock</button>
          ) : (
            detailConfirm?.type === 'block' && detailConfirm.telegramId === u.telegram_id ? (
              <span className="inline-flex items-center gap-1 text-xs">
                <span className="text-gray-400">Block?</span>
                <button onClick={() => { setDetailConfirm(null); onAction('block') }} className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 font-semibold">Yes</button>
                <button onClick={() => setDetailConfirm(null)} className="px-2 py-1 rounded bg-white/10 text-gray-400 hover:bg-white/20 font-semibold">No</button>
              </span>
            ) : (
              <button onClick={() => setDetailConfirm({ type: 'block', telegramId: u.telegram_id })} className="text-xs bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 px-3 py-1.5 rounded-lg font-semibold transition">Block</button>
            )
          )}
          {detailConfirm?.type === 'delete' && detailConfirm.telegramId === u.telegram_id ? (
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="text-gray-400">Delete?</span>
              <button onClick={() => { setDetailConfirm(null); onAction('delete') }} className="px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 font-semibold">Yes</button>
              <button onClick={() => setDetailConfirm(null)} className="px-2 py-1 rounded bg-white/10 text-gray-400 hover:bg-white/20 font-semibold">No</button>
            </span>
          ) : (
            <button onClick={() => setDetailConfirm({ type: 'delete', telegramId: u.telegram_id })} className="text-xs bg-red-500/15 text-red-400 hover:bg-red-500/25 px-3 py-1.5 rounded-lg font-semibold transition">Delete</button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── Hero identity ── */}
        <div className="bg-[#111827] border border-white/8 rounded-2xl p-6">
          <div className="flex items-start gap-5">
            {u.telegram_photo_url
              ? <img src={u.telegram_photo_url} className="w-16 h-16 rounded-2xl object-cover shrink-0" alt="" />
              : <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/15 flex items-center justify-center text-[#D4AF37] font-bold text-2xl shrink-0">{(u.telegram_first_name ?? '?')[0]}</div>
            }
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl font-bold text-white">{u.telegram_first_name ?? '—'}</h1>
                {u.telegram_username && <span className="text-[#D4AF37]">@{u.telegram_username}</span>}
                <Badge color={u.is_blocked ? 'red' : 'green'}>{u.is_blocked ? 'Blocked' : 'Active'}</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {[
                  { label: 'Telegram ID',   value: String(u.telegram_id) },
                  { label: 'Phone',         value: u.telegram_phone ?? '—' },
                  { label: 'Invited By',    value: u.referred_by ? (() => { const r = data?.users.find(x => x.telegram_id === u.referred_by); return r ? `${r.telegram_first_name ?? ''}${r.telegram_username ? ` (@${r.telegram_username})` : ''} #${u.referred_by}` : `#${u.referred_by}` })() : '—' },
                  { label: 'Notifications', value: u.opt_in_telegram_notifications ? 'On' : 'Off' },
                  { label: 'Joined',        value: dt(u.created_at) },
                  { label: 'Last Active',   value: lastSeen ? ago(lastSeen) : '—' },
                  { label: 'Updated',       value: u.updated_at ? ago(u.updated_at) : '—' },
                ].map(f => (
                  <div key={f.label}>
                    <p className="text-[10px] text-gray-500 font-medium uppercase">{f.label}</p>
                    <p className="text-sm text-gray-200 break-all">{f.value}</p>
                  </div>
                ))}

                {/* Editable: Favorite Team */}
                <div>
                  <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">Favorite Team</p>
                  {editingTeam ? (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={teamDraft}
                        onChange={e => setTeamDraft(e.target.value)}
                        className="bg-black/40 border border-white/15 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#D4AF37]/50 flex-1 min-w-0"
                      >
                        <option value="">— None —</option>
                        {ALL_CLUBS.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.league})</option>
                        ))}
                      </select>
                      <button onClick={saveTeam} disabled={editSaving} className="text-xs bg-[#D4AF37] text-black px-2 py-1 rounded font-bold disabled:opacity-50">Save</button>
                      <button onClick={() => { setEditingTeam(false); setTeamDraft(u.favorite_team ?? '') }} className="text-xs bg-white/10 text-gray-400 px-2 py-1 rounded">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-gray-200">{teamName(u.favorite_team)}</span>
                      <button onClick={() => setEditingTeam(true)} className="text-[10px] text-gray-500 hover:text-[#D4AF37] border border-white/10 rounded px-1.5 py-0.5 transition">Edit</button>
                    </div>
                  )}
                </div>

                {/* Editable: Display As */}
                <div>
                  <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">Display As</p>
                  {editingPref ? (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={prefDraft}
                        onChange={e => setPrefDraft(e.target.value)}
                        className="bg-black/40 border border-white/15 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#D4AF37]/50"
                      >
                        <option value="address">address</option>
                        <option value="name">name</option>
                        <option value="username">username</option>
                      </select>
                      <button onClick={savePref} disabled={editSaving} className="text-xs bg-[#D4AF37] text-black px-2 py-1 rounded font-bold disabled:opacity-50">Save</button>
                      <button onClick={() => { setEditingPref(false); setPrefDraft(u.display_preference) }} className="text-xs bg-white/10 text-gray-400 px-2 py-1 rounded">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-gray-200">{u.display_preference}</span>
                      <button onClick={() => setEditingPref(true)} className="text-[10px] text-gray-500 hover:text-[#D4AF37] border border-white/10 rounded px-1.5 py-0.5 transition">Edit</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatTile label="Wallets"      value={u.wallets.length}          accent="text-blue-400" />
          <StatTile label={PRIMARY_CUSTOM_ASSET_CODE} value={num(totalTokenBal)} accent="text-yellow-400" />
          <StatTile label="XLM"          value={num(totalXLM)}             accent="text-gray-300" />
          <StatTile label="Game Sessions" value={userSessions.length}       accent="text-purple-400" sub={`${totalKicks.toLocaleString()} kicks`} />
          <StatTile label="Donations"    value={userDonations.length}       accent="text-green-400" />
          <StatTile label="Purchases"    value={userPurchases.length}       accent="text-orange-400" />
        </div>

        {/* ── Activity Timeline ── */}
        <ActivityTimeline
          u={u}
          userSessions={userSessions}
          userDonations={userDonations}
          userPurchases={userPurchases}
          userRequests={userRequests}
          userAccess={userAccess}
        />

        {/* ── Wallets ── */}
        <section>
          <SectionTitle icon="account_balance_wallet" title="Connected Wallets" count={u.wallets.length} />
          {u.wallets.length === 0
            ? <p className="text-gray-600 text-sm">No wallets connected yet.</p>
            : <div className="space-y-3">
                {u.wallets.map((w, i) => {
                  const b = w.wallet_balances[0]
                  return (
                    <div key={w.id} className="bg-[#111827] border border-white/6 rounded-xl p-5">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {w.is_primary && <Badge color="yellow">Primary</Badge>}
                          <span className="text-gray-400 text-xs">Wallet #{i + 1}</span>
                        </div>
                        <div className="text-[11px] text-gray-500 text-right shrink-0">
                          <div>Added {dt(w.created_at)}</div>
                          {w.last_connected_at && <div>Last used {dt(w.last_connected_at)}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2 mb-4">
                        <p className="font-mono text-sm text-gray-200 break-all flex-1">{w.stellar_address}</p>
                        <button
                          onClick={() => { navigator.clipboard.writeText(w.stellar_address); }}
                          className="ml-1 text-gray-600 hover:text-[#D4AF37] transition shrink-0"
                          title="Copy address"
                        >
                          <Icon name="content_copy" className="text-xs" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase font-medium">{PRIMARY_CUSTOM_ASSET_CODE}</p>
                          <p className="text-lg font-bold text-yellow-400 mt-0.5">{num(b?.nsafl_balance)}</p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase font-medium">XLM</p>
                          <p className="text-lg font-bold text-gray-300 mt-0.5">{num(b?.xlm_balance)}</p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase font-medium">Week Ago</p>
                          <p className="text-lg font-bold text-gray-400 mt-0.5">{num(b?.balance_week_ago)}</p>
                          {b?.last_synced_at && (
                            <>
                              <p className="text-[10px] text-gray-600 mt-0.5">synced {ago(b.last_synced_at)}</p>
                              {(Date.now() - new Date(b.last_synced_at).getTime()) > 24 * 60 * 60 * 1000 && (
                                <Badge color="yellow">Stale</Badge>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
          }
        </section>

        {/* ── Game sessions ── */}
        <section>
          <SectionTitle icon="sports_esports" title="Game Sessions" count={userSessions.length} />
          {userSessions.length === 0
            ? <p className="text-gray-600 text-sm">No game sessions yet.</p>
            : <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/3"><tr><Th>#</Th><Th>Kicks</Th><Th>Balls Spawned</Th><Th>Duration</Th><Th>Wallet</Th><Th>When</Th></tr></thead>
                    <tbody className="divide-y divide-white/4">
                      {userSessions.map((g, i) => (
                        <tr key={g.id} className="hover:bg-white/3">
                          <Td><span className="text-gray-600 text-xs">{userSessions.length - i}</span></Td>
                          <Td><span className="font-bold text-purple-400">{g.kicks}</span></Td>
                          <Td><span className="text-gray-400">{g.balls_spawned}</span></Td>
                          <Td><span className="text-gray-400">{g.duration_seconds}s</span></Td>
                          <Td mono><span className="text-xs text-gray-500">{g.wallet_id ? `…${g.wallet_id.slice(-8)}` : '—'}</span></Td>
                          <Td><span className="text-gray-500 text-xs">{dt(g.created_at)}</span></Td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-white/3">
                        <td colSpan={2} className="px-3 py-2 text-xs font-bold text-purple-400">Total: {totalKicks.toLocaleString()} kicks</td>
                        <td colSpan={4} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
          }
        </section>

        {/* ── Team change requests ── */}
        {userRequests.length > 0 && (
          <section>
            <SectionTitle icon="sports_football" title="Team Change Requests" count={userRequests.length} />
            <Card>
              <table className="w-full">
                <thead className="bg-white/3"><tr><Th>Requested Team</Th><Th>Status</Th><Th>Admin Note</Th><Th>Submitted</Th><Th>Resolved</Th></tr></thead>
                <tbody className="divide-y divide-white/4">
                  {userRequests.map(r => (
                    <tr key={r.id} className="hover:bg-white/3">
                      <Td><span className="text-gray-200">{teamName(r.requested_team)}</span></Td>
                      <Td><Badge color={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'yellow'}>{r.status}</Badge></Td>
                      <Td><span className="text-gray-500 text-sm">{r.admin_note ?? '—'}</span></Td>
                      <Td><span className="text-gray-500 text-xs">{dt(r.created_at)}</span></Td>
                      <Td><span className="text-gray-500 text-xs">{r.resolved_at ? dt(r.resolved_at) : '—'}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>
        )}

        {/* ── Donations ── */}
        <section>
          <SectionTitle icon="volunteer_activism" title="Donations" count={userDonations.length} />
          {userDonations.length === 0
            ? <p className="text-gray-600 text-sm">No donations yet.</p>
            : <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/3"><tr><Th>Amount</Th><Th>Asset</Th><Th>Type</Th><Th>Target</Th><Th>TX Hash</Th><Th>Verified</Th><Th>When</Th></tr></thead>
                    <tbody className="divide-y divide-white/4">
                      {userDonations.map(d => (
                        <tr key={d.id} className="hover:bg-white/3">
                          <Td><span className="font-bold text-yellow-400">{num(d.amount)}</span></Td>
                          <Td><span className="text-gray-300">{d.asset_code}</span></Td>
                          <Td><DonationTypeBadge type={d.donation_type} /></Td>
                          <Td>
                            {d.donation_target
                              ? <span className="font-bold text-[#D4AF37] text-sm">{d.donation_target}</span>
                              : <span className="text-gray-500 text-sm italic">General</span>
                            }
                          </Td>
                          <Td mono><span className="text-xs text-gray-500">{d.stellar_tx_hash ? `${d.stellar_tx_hash.slice(0, 20)}…` : '—'}</span></Td>
                          <Td><Badge color={d.verified ? 'green' : 'yellow'}>{d.verified ? 'Verified' : 'Pending'}</Badge></Td>
                          <Td><span className="text-gray-500 text-xs">{dt(d.created_at)}</span></Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
          }
        </section>

        {/* ── Purchases ── */}
        <section>
          <SectionTitle icon="shopping_cart" title="Purchases" count={userPurchases.length} />
          {userPurchases.length === 0
            ? <p className="text-gray-600 text-sm">No purchases yet.</p>
            : <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/3"><tr><Th>XLM Sent</Th><Th>{PRIMARY_CUSTOM_ASSET_CODE}</Th><Th>Type</Th><Th>TX Hash</Th><Th>Verified</Th><Th>When</Th></tr></thead>
                    <tbody className="divide-y divide-white/4">
                      {userPurchases.map(p => (
                        <tr key={p.id} className="hover:bg-white/3">
                          <Td><span className="text-gray-300">{num(p.xlm_amount)} XLM</span></Td>
                          <Td><span className="font-bold text-yellow-400">{num(p.token_amount)}</span></Td>
                          <Td><span className="text-gray-400 text-xs">{p.purchase_type}</span></Td>
                          <Td mono><span className="text-xs text-gray-500">{p.stellar_tx_hash ? `${p.stellar_tx_hash.slice(0, 24)}…` : '—'}</span></Td>
                          <Td><Badge color={p.verified ? 'green' : 'yellow'}>{p.verified ? 'Verified' : 'Pending'}</Badge></Td>
                          <Td><span className="text-gray-500 text-xs">{dt(p.created_at)}</span></Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
          }
        </section>

        {/* ── Access / Activity log ── */}
        <section>
          <SectionTitle icon="manage_search" title="Access & Activity Log" count={userAccess.length} />
          {userAccess.length === 0
            ? <p className="text-gray-600 text-sm">No access events logged for this user.</p>
            : <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/3"><tr><Th>IP / Location</Th><Th>Event</Th><Th>Device / Browser</Th><Th>Screen</Th><Th>Timezone</Th><Th>Language</Th><Th>URL</Th><Th>When</Th><Th></Th></tr></thead>
                    <tbody className="divide-y divide-white/4">
                      {userAccess.map(a => (
                        <tr key={a.id} className={`${a.devtools_opened || a.tg_sdk_fake ? 'bg-red-500/5' : 'hover:bg-white/3'}`}>
                          <Td mono>
                            <span className="text-gray-300">{a.ip ?? '—'}</span>
                            {a.geo_location && <span className="block text-[11px] text-gray-500 font-sans">({a.geo_location})</span>}
                          </Td>
                          <Td>
                            {a.devtools_opened ? <Badge color="red">DevTools Opened</Badge>
                              : a.tg_sdk_fake   ? <Badge color="red">Fake SDK</Badge>
                              : <Badge color="gray">App Open</Badge>}
                          </Td>
                          <Td><span className="text-gray-500 text-xs max-w-[160px] block truncate">{a.user_agent ?? '—'}</span></Td>
                          <Td><span className="text-gray-400 text-xs whitespace-nowrap">{a.screen ?? '—'}</span></Td>
                          <Td><span className="text-gray-400 text-xs whitespace-nowrap">{a.timezone ?? '—'}</span></Td>
                          <Td><span className="text-gray-400 text-xs">{a.language ?? '—'}</span></Td>
                          <Td mono><span className="text-xs text-gray-600 max-w-[120px] block truncate">{a.url ?? '—'}</span></Td>
                          <Td><span className="text-gray-500 text-xs whitespace-nowrap">{dt(a.created_at)}</span></Td>
                          <Td>
                            <button
                              onClick={() => onDeleteAccess(a.id)}
                              disabled={deletingAccessId === a.id}
                              className="text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2 py-0.5 rounded transition disabled:opacity-40"
                            >
                              {deletingAccessId === a.id ? '…' : 'Delete'}
                            </button>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
          }
        </section>

      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
function AdminContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [token, setToken] = useState('')
  const [authed, setAuthed] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [resolving, setResolving] = useState<string | null>(null)
  const [noteMap, setNoteMap] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [userAction, setUserAction] = useState<{ telegramId: number; name: string; type: 'logout' | 'delete' | 'block' | 'unblock' } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [deletingAccessId, setDeletingAccessId] = useState<string | null>(null)
  const [donationFilter, setDonationFilter] = useState<'all' | 'unverified' | 'team' | 'player' | 'general'>('all')
  const [donationSearch, setDonationSearch] = useState('')
  const [purchaseFilter, setPurchaseFilter] = useState<'all' | 'unverified' | 'direct' | 'advanced'>('all')
  const [purchaseSearch, setPurchaseSearch] = useState('')
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [clearLogsConfirm, setClearLogsConfirm] = useState(false)
  const [clearingLogs, setClearingLogs] = useState(false)
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'blocked'>('all')
  const [userTeamFilter, setUserTeamFilter] = useState('all')
  const [accessTimeFilter, setAccessTimeFilter] = useState<'1h' | '24h' | '7d' | 'all'>('all')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [winStats, setWinStats] = useState<{ total: number; pending: number }>({ total: 0, pending: 0 })

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  async function deleteAccessAttempt(id: string) {
    setDeletingAccessId(id)
    const res = await fetch(`/api/admin/access/${id}`, { method: 'DELETE', headers: { 'x-admin-token': token } })
    setDeletingAccessId(null)
    if (res.ok) {
      setData((prev) => prev ? { ...prev, accessAttempts: prev.accessAttempts.filter((a) => a.id !== id) } : prev)
    }
  }

  useEffect(() => {
    const urlToken = searchParams.get('token')
    const stored = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
    const t = urlToken ?? stored ?? ''
    setToken(t)
    if (t) setAuthed(true)
    if (urlToken) localStorage.setItem('admin_token', urlToken)
  }, [searchParams])

  const fetchData = useCallback(async (t: string) => {
    setLoading(true)
    setError(null)
    try {
      const [res, winsRes] = await Promise.all([
        fetch('/api/admin', { headers: { 'x-admin-token': t } }),
        fetch(`/api/admin/wins?token=${t}&limit=1`, { headers: { 'x-admin-token': t } }),
      ])
      const j = await res.json()
      if (j.success) setData(j.data)
      else { setAuthed(false); localStorage.removeItem('admin_token') }
      if (winsRes.ok) {
        const wj = await winsRes.json()
        if (wj.success) setWinStats({ total: wj.data.total ?? 0, pending: wj.data.counts?.pending ?? 0 })
      }
    } catch (e) {
      setError('Failed to load admin data. Check your token or try again.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (authed && token) fetchData(token) }, [authed, token, fetchData])

  function handleTokenSubmit() {
    if (!tokenInput.trim()) return
    localStorage.setItem('admin_token', tokenInput.trim())
    setToken(tokenInput.trim())
    setAuthed(true)
  }

  async function executeUserAction() {
    if (!userAction) return
    setActionLoading(true)
    try {
      if (userAction.type === 'delete') {
        await fetch(`/api/admin/user/${userAction.telegramId}`, {
          method: 'DELETE',
          headers: { 'x-admin-token': token },
        })
      } else if (userAction.type === 'logout') {
        await fetch(`/api/admin/user/${userAction.telegramId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
          body: JSON.stringify({ action: 'logout' }),
        })
      } else {
        await fetch(`/api/admin/user/${userAction.telegramId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
          body: JSON.stringify({ block: userAction.type === 'block' }),
        })
      }
      setUserAction(null)
      fetchData(token)
    } finally {
      setActionLoading(false)
    }
  }

  async function resolveRequest(requestId: string, action: 'approve' | 'reject') {
    setResolving(requestId)
    try {
      const res = await fetch('/api/admin/team-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ requestId, action, adminNote: noteMap[requestId] }),
      })
      const j = await res.json()
      if (j.success) { setNoteMap(m => { const n = { ...m }; delete n[requestId]; return n }); fetchData(token) }
    } finally { setResolving(null) }
  }

  async function verifyItem(type: 'donation' | 'purchase', id: string) {
    setVerifyingId(id)
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ type, id }),
      })
      const j = await res.json()
      if (j.success) {
        setData(prev => {
          if (!prev) return prev
          if (type === 'donation') {
            return { ...prev, donations: prev.donations.map(d => d.id === id ? { ...d, verified: true } : d) }
          } else {
            return { ...prev, purchases: prev.purchases.map(p => p.id === id ? { ...p, verified: true } : p) }
          }
        })
        showToast('Marked as verified')
      } else {
        showToast('Failed to verify: ' + (j.error ?? 'Unknown error'))
      }
    } finally {
      setVerifyingId(null)
    }
  }

  async function bulkDeleteOldLogs(olderThanDays: number) {
    setClearingLogs(true)
    try {
      const res = await fetch('/api/admin/access/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ olderThanDays }),
      })
      const j = await res.json()
      if (j.success) {
        const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()
        setData(prev => prev ? { ...prev, accessAttempts: prev.accessAttempts.filter(a => a.created_at >= cutoff) } : prev)
        showToast(`Deleted ${j.data.deleted} log${j.data.deleted === 1 ? '' : 's'} older than ${olderThanDays} days`)
      } else {
        showToast('Failed to delete logs: ' + (j.error ?? 'Unknown error'))
      }
    } finally {
      setClearingLogs(false)
      setClearLogsConfirm(false)
    }
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  if (!authed) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="bg-[#111827] border border-white/10 rounded-2xl p-8 w-full max-w-sm shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37] flex items-center justify-center font-bold text-black">CB</div>
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
            onKeyDown={e => e.key === 'Enter' && handleTokenSubmit()}
            placeholder="Enter token…"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/50 focus:ring-1 focus:ring-[#D4AF37]/30"
          />
        </div>
        <button onClick={handleTokenSubmit} className="w-full bg-[#D4AF37] text-black font-bold rounded-lg py-2.5 text-sm hover:bg-[#c9a42e] transition">
          Enter
        </button>
      </div>
    </div>
  )

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-6">
      <div className="bg-[#111827] border border-red-500/30 rounded-2xl p-8 w-full max-w-md text-center space-y-4">
        <Icon name="error" className="text-4xl text-red-400" />
        <p className="text-white font-semibold">Failed to load admin data</p>
        <p className="text-gray-400 text-sm">{error}</p>
        <button
          onClick={() => fetchData(token)}
          className="bg-[#D4AF37] text-black font-bold rounded-lg px-6 py-2.5 text-sm hover:bg-[#c9a42e] transition"
        >
          Retry
        </button>
      </div>
    </div>
  )
  if (loading || !data) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center gap-2 text-gray-500">
      <svg className="animate-spin h-5 w-5 text-[#D4AF37]" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
      <span className="text-sm">Loading data…</span>
    </div>
  )

  // ── User detail full page ──────────────────────────────────────────────────
  if (selectedUser) {
    return (
      <>
        <UserDetail
          u={selectedUser}
          data={data}
          token={token}
          onBack={() => setSelectedUser(null)}
          onAction={(type) => {
            setSelectedUser(null)
            setUserAction({ telegramId: selectedUser.telegram_id, name: selectedUser.telegram_first_name ?? String(selectedUser.telegram_id), type })
          }}
          onDeleteAccess={deleteAccessAttempt}
          deletingAccessId={deletingAccessId}
          onUserUpdated={(telegramId, patch) => {
            setData(prev => prev ? {
              ...prev,
              users: prev.users.map(u => u.telegram_id === telegramId ? { ...u, ...patch } : u)
            } : prev)
            setSelectedUser(prev => prev && prev.telegram_id === telegramId ? { ...prev, ...patch } : prev)
          }}
        />
        {/* confirmation modal can still appear on top */}
        {userAction && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
              <p className="text-white font-semibold capitalize">{userAction.type === 'logout' ? 'Log out user' : userAction.type === 'delete' ? 'Delete user' : userAction.type === 'block' ? 'Block user' : 'Unblock user'}</p>
              <p className="text-gray-300 text-sm">
                {userAction.type === 'logout' ? 'Disconnects all wallets. The user keeps their account and can reconnect on next open.' : userAction.type === 'delete' ? 'Wipes all data and removes the account. They can return as a brand new user — not blocked.' : userAction.type === 'block' ? 'User will immediately lose access and see a generic error screen.' : 'Restores full app access for this user.'}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setUserAction(null)} disabled={actionLoading} className="flex-1 border border-white/10 text-gray-300 text-sm rounded-lg py-2 hover:bg-white/5 transition disabled:opacity-40">Cancel</button>
                <button onClick={executeUserAction} disabled={actionLoading} className={`flex-1 text-sm font-semibold rounded-lg py-2 transition disabled:opacity-40 ${userAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : userAction.type === 'block' ? 'bg-orange-600 hover:bg-orange-700' : userAction.type === 'logout' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} text-white`}>
                  {actionLoading ? '…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalUsers = data.users.length
  const totalWallets = data.users.reduce((s, u) => s + u.wallets.length, 0)
  const totalTokenHeld = data.users.reduce((s, u) => s + u.wallets.reduce((ws, w) => ws + Number(w.wallet_balances[0]?.nsafl_balance ?? 0), 0), 0)
  const pendingCount = data.teamRequests.filter(r => r.status === 'pending').length
  const totalKicks = data.gameSessions.reduce((s, g) => s + g.kicks, 0)
  const suspiciousAccess = data.accessAttempts.filter(a => a.tg_sdk_fake || a.devtools_opened).length

  const walletById: Record<string, { stellar_address: string; user: User }> = {}
  for (const u of data.users) for (const w of u.wallets) walletById[w.id] = { stellar_address: w.stellar_address, user: u }

  const uniqueTeams = Array.from(new Set(data.users.map(u => u.favorite_team).filter((t): t is string => !!t)))

  const filteredUsers = data.users.filter(u => {
    if (search && !(
      u.telegram_username?.toLowerCase().includes(search.toLowerCase()) ||
      u.telegram_first_name?.toLowerCase().includes(search.toLowerCase()) ||
      String(u.telegram_id).includes(search) ||
      u.wallets.some(w => w.stellar_address.toLowerCase().includes(search.toLowerCase()))
    )) return false
    if (userStatusFilter === 'active' && u.is_blocked) return false
    if (userStatusFilter === 'blocked' && !u.is_blocked) return false
    if (userTeamFilter !== 'all' && u.favorite_team !== userTeamFilter) return false
    return true
  })

  // Donations filtered
  const filteredDonations = data.donations.filter(d => {
    if (donationFilter !== 'all') {
      if (donationFilter === 'unverified' && d.verified) return false
      if (donationFilter !== 'unverified' && d.donation_type !== donationFilter) return false
    }
    if (donationSearch) {
      const q = donationSearch.toLowerCase()
      const addr = walletById[d.wallet_id]?.stellar_address ?? ''
      if (
        !addr.toLowerCase().includes(q) &&
        !(d.stellar_tx_hash ?? '').toLowerCase().includes(q) &&
        !(d.donation_target ?? '').toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  // Purchases filtered
  const filteredPurchases = data.purchases.filter(p => {
    if (purchaseFilter !== 'all') {
      if (purchaseFilter === 'unverified' && p.verified) return false
      if (purchaseFilter !== 'unverified' && p.purchase_type !== purchaseFilter) return false
    }
    if (purchaseSearch) {
      const q = purchaseSearch.toLowerCase()
      const addr = walletById[p.wallet_id]?.stellar_address ?? ''
      if (
        !addr.toLowerCase().includes(q) &&
        !(p.stellar_tx_hash ?? '').toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const TABS: { key: Tab; label: string; icon: string; alert?: boolean; badge?: number }[] = [
    { key: 'overview',   label: 'Overview',      icon: 'dashboard' },
    { key: 'users',      label: `Users`,          icon: 'group',              badge: totalUsers },
    { key: 'requests',   label: `Requests`,       icon: 'pending_actions',    alert: pendingCount > 0, badge: pendingCount > 0 ? pendingCount : undefined },
    { key: 'game',       label: `Game`,           icon: 'sports_esports',     badge: data.gameSessions.length },
    { key: 'donations',  label: `Donations`,      icon: 'volunteer_activism', badge: data.donations.length },
    { key: 'purchases',  label: `Purchases`,      icon: 'shopping_cart',      badge: data.purchases.length },
    { key: 'access',     label: `Access`,         icon: 'manage_search',      alert: suspiciousAccess > 0, badge: suspiciousAccess > 0 ? suspiciousAccess : data.accessAttempts.length },
    { key: 'referrals',  label: `Referrals`,      icon: 'group_add',          badge: data.referralStats?.length || undefined },
    { key: 'trustline',  label: `Trustline`,      icon: 'add_link',           badge: data.trustlineSubmissions?.length || undefined },
  ]

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-gray-100">

      {/* ── Toast ── */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-[#1a2235] border border-white/10 text-white text-sm px-5 py-3 rounded-xl shadow-2xl backdrop-blur-sm">
          {toastMsg}
        </div>
      )}

      {/* ── Top bar ── */}
      <header className="bg-[#0d1424] border-b border-white/8 px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#D4AF37] flex items-center justify-center font-bold text-black text-sm">CB</div>
          <div>
            <h1 className="text-sm font-bold text-white">{PRIMARY_CUSTOM_ASSET_CODE} Admin</h1>
            <p className="text-[11px] text-gray-500">Homecoming Hub</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData(token)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-white/10 rounded-lg px-3 py-1.5 hover:bg-white/5 transition">
            <Icon name="refresh" className="text-sm" /> Refresh
          </button>
          {confirmAction?.type === 'logout' && confirmAction.telegramId === 0 ? (
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="text-gray-400">Log out admin?</span>
              <button onClick={() => { setConfirmAction(null); localStorage.removeItem('admin_token'); router.push('/') }} className="px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 font-semibold">Yes</button>
              <button onClick={() => setConfirmAction(null)} className="px-2 py-1 rounded bg-white/10 text-gray-400 hover:bg-white/20 font-semibold">No</button>
            </span>
          ) : (
            <button onClick={() => setConfirmAction({ type: 'logout', telegramId: 0 })} className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg px-3 py-1.5 hover:bg-red-500/10 transition">
              Logout
            </button>
          )}
        </div>
      </header>

      {/* ── Summary stats strip ── */}
      <SummaryStrip data={data} />

      {/* ── Tabs ── */}
      <div className="bg-[#0d1424] border-b border-white/8 px-4 flex gap-0 overflow-x-auto mt-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition relative flex items-center gap-1.5 ${
              tab === t.key
                ? 'border-[#D4AF37] text-[#D4AF37]'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon name={t.icon} className="text-sm" />
            {t.label}
            {t.badge !== undefined && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                t.alert
                  ? 'bg-red-500/25 text-red-400'
                  : tab === t.key
                    ? 'bg-[#D4AF37]/15 text-[#D4AF37]'
                    : 'bg-white/8 text-gray-500'
              }`}>{t.badge}</span>
            )}
            {t.alert && !t.badge && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />}
          </button>
        ))}
        {/* Lucky Draw wins — external page link */}
        <a
          href={`/admin/wins?token=${token}`}
          className="px-4 py-3 text-xs font-semibold border-b-2 border-transparent whitespace-nowrap transition flex items-center gap-1.5 text-gray-500 hover:text-[#D4AF37] ml-auto"
        >
          <Icon name="emoji_events" className="text-sm" />
          Lucky Draw
          <Icon name="open_in_new" className="text-[10px]" />
        </a>
        <a href={`/admin/quiz?token=${token}`} className="px-3 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-medium hover:bg-purple-500/25 transition">
          Quiz ↗
        </a>
      </div>

      <div className="px-6 py-6 max-w-[1600px] mx-auto space-y-5">

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Total Users',       value: totalUsers,                    accent: 'text-blue-400',   bg: 'bg-blue-500/8'   },
                { label: 'Wallets',           value: totalWallets,                  accent: 'text-green-400',  bg: 'bg-green-500/8'  },
                { label: `${PRIMARY_CUSTOM_ASSET_CODE} Held`, value: num(totalTokenHeld), accent: 'text-yellow-400', bg: 'bg-yellow-500/8' },
                { label: 'Pending Requests',  value: pendingCount,                  accent: pendingCount > 0 ? 'text-red-400' : 'text-gray-400', bg: pendingCount > 0 ? 'bg-red-500/8' : 'bg-white/4' },
                { label: 'Total Kicks',       value: totalKicks.toLocaleString(),   accent: 'text-purple-400', bg: 'bg-purple-500/8' },
                { label: 'Suspicious Access', value: suspiciousAccess,              accent: suspiciousAccess > 0 ? 'text-red-400' : 'text-gray-400', bg: suspiciousAccess > 0 ? 'bg-red-500/8' : 'bg-white/4' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl p-4 border border-white/6 ${s.bg}`}>
                  <p className="text-[11px] text-gray-500 font-medium">{s.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${s.accent}`}>{s.value}</p>
                </div>
              ))}
              <button onClick={() => setTab('referrals')} className="rounded-xl p-4 border border-white/6 bg-green-500/8 text-left hover:bg-green-500/12 transition">
                <p className="text-[11px] text-gray-500 font-medium">Referrals</p>
                <p className="text-2xl font-bold mt-1 text-green-400">{data.referredUsers?.length ?? 0}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{data.referralStats?.length ?? 0} referrers → view tab</p>
              </button>
            </div>

            {/* Lucky Draw stats tile */}
            <div className="rounded-xl p-4 border border-[#D4AF37]/20 bg-yellow-500/5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center shrink-0">
                  <Icon name="casino" className="text-base text-[#D4AF37]" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">Lucky Draw</p>
                  <p className="text-lg font-bold text-[#D4AF37] leading-tight">{winStats.total} <span className="text-sm font-normal text-gray-400">total wins</span></p>
                  {winStats.pending > 0 && (
                    <p className="text-[11px] text-orange-400 font-medium">{winStats.pending} pending payout</p>
                  )}
                  {winStats.pending === 0 && (
                    <p className="text-[11px] text-gray-600">No pending payouts</p>
                  )}
                </div>
              </div>
              <a
                href={`/admin/wins?token=${token}`}
                className="text-xs text-[#D4AF37] hover:text-yellow-300 border border-[#D4AF37]/30 rounded-lg px-3 py-1.5 hover:bg-[#D4AF37]/10 transition shrink-0 font-semibold"
              >
                View all →
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Card>
                <div className="px-4 py-3 border-b border-white/8 text-sm font-semibold text-gray-300">Recent Users</div>
                <table className="w-full">
                  <thead><tr><Th>User</Th><Th>Team</Th><Th>Joined</Th></tr></thead>
                  <tbody className="divide-y divide-white/4">
                    {data.users.slice(0, 8).map(u => (
                      <tr key={u.telegram_id} className="hover:bg-white/3">
                        <Td>
                          <span className="font-medium text-white">{u.telegram_first_name ?? '—'}</span>
                          {u.telegram_username && <span className="text-[#D4AF37] text-xs ml-1.5">@{u.telegram_username}</span>}
                        </Td>
                        <Td>{teamName(u.favorite_team)}</Td>
                        <Td><span className="text-gray-500 text-xs">{ago(u.created_at)}</span></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <Card>
                <div className="px-4 py-3 border-b border-white/8 text-sm font-semibold text-gray-300 flex items-center gap-2">
                  Pending Team Requests
                  {pendingCount > 0 && <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
                </div>
                {pendingCount === 0 ? (
                  <p className="text-sm text-gray-600 px-4 py-8 text-center">No pending requests</p>
                ) : (
                  <table className="w-full">
                    <thead><tr><Th>User</Th><Th>Requested</Th><Th>When</Th><Th>Actions</Th></tr></thead>
                    <tbody className="divide-y divide-white/4">
                      {data.teamRequests.filter(r => r.status === 'pending').map(r => (
                        <tr key={r.id} className="hover:bg-white/3">
                          <Td><TgUser users={data.users} id={r.telegram_id} /></Td>
                          <Td>{teamName(r.requested_team)}</Td>
                          <Td><span className="text-gray-500 text-xs">{ago(r.created_at)}</span></Td>
                          <Td>
                            <div className="flex gap-1">
                              <button onClick={() => resolveRequest(r.id, 'approve')} disabled={resolving === r.id} className="text-xs bg-green-500/15 text-green-400 hover:bg-green-500/25 px-2 py-0.5 rounded font-semibold transition disabled:opacity-40">✓</button>
                              <button onClick={() => resolveRequest(r.id, 'reject')} disabled={resolving === r.id} className="text-xs bg-red-500/15 text-red-400 hover:bg-red-500/25 px-2 py-0.5 rounded font-semibold transition disabled:opacity-40">✗</button>
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {tab === 'users' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="text"
                placeholder="Search by name, @username, Telegram ID, or Stellar address…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 min-w-[200px] bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/40"
              />
              <select
                value={userStatusFilter}
                onChange={e => setUserStatusFilter(e.target.value as 'all' | 'active' | 'blocked')}
                className="bg-[#0d1424] border border-white/10 text-gray-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#D4AF37]/50"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
              </select>
              <select
                value={userTeamFilter}
                onChange={e => setUserTeamFilter(e.target.value)}
                className="bg-[#0d1424] border border-white/10 text-gray-300 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#D4AF37]/50"
              >
                <option value="all">All Teams</option>
                {uniqueTeams.map(t => (
                  <option key={t} value={t}>{teamName(t)}</option>
                ))}
              </select>
              <span className="text-sm text-gray-500 whitespace-nowrap">{filteredUsers.length} results</span>
            </div>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/3"><tr>
                    <Th>Name</Th><Th>Username</Th><Th>Status</Th><Th>Team</Th>
                    <Th>Wallet</Th><Th>{PRIMARY_CUSTOM_ASSET_CODE}</Th><Th>XLM</Th><Th>Joined</Th><Th>Actions</Th>
                  </tr></thead>
                  <tbody className="divide-y divide-white/4">
                    {filteredUsers.map(u => {
                      const primaryWallet = u.wallets.find(w => w.is_primary) ?? u.wallets[0]
                      const bal = primaryWallet?.wallet_balances[0]
                      const addrShort = primaryWallet ? `…${primaryWallet.stellar_address.slice(-6)}` : null
                      return (
                        <tr
                          key={u.telegram_id}
                          onClick={() => setSelectedUser(u)}
                          className="hover:bg-white/5 cursor-pointer transition"
                        >
                          <Td>
                            <div>
                              <span className="font-medium text-white">{u.telegram_first_name ?? '—'}</span>
                              <span className="block text-[10px] text-gray-600 font-mono">{u.telegram_id}</span>
                            </div>
                          </Td>
                          <Td>{u.telegram_username ? <span className="text-[#D4AF37]">@{u.telegram_username}</span> : <span className="text-gray-600">—</span>}</Td>
                          <Td><Badge color={u.is_blocked ? 'red' : 'green'}>{u.is_blocked ? 'Blocked' : 'Active'}</Badge></Td>
                          <Td><span className="text-gray-300 text-sm">{teamName(u.favorite_team)}</span></Td>
                          <Td mono>
                            {addrShort
                              ? <span className="text-xs text-gray-400">{addrShort}{u.wallets.length > 1 && <span className="ml-1 text-gray-600">+{u.wallets.length - 1}</span>}</span>
                              : <span className="text-gray-600 text-xs">None</span>}
                          </Td>
                          <Td><span className="font-semibold text-yellow-400">{num(bal?.nsafl_balance)}</span></Td>
                          <Td><span className="text-gray-400">{num(bal?.xlm_balance)}</span></Td>
                          <Td><span className="text-gray-500 text-xs">{ago(u.created_at)}</span></Td>
                          <Td>
                            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                              {/* Block/Unblock with inline confirm */}
                              {u.is_blocked ? (
                                <button onClick={() => setUserAction({ telegramId: u.telegram_id, name: u.telegram_first_name ?? String(u.telegram_id), type: 'unblock' })} className="text-xs bg-green-500/15 text-green-400 hover:bg-green-500/25 px-2 py-0.5 rounded font-semibold transition">Unblock</button>
                              ) : (
                                confirmAction?.type === 'block' && confirmAction.telegramId === u.telegram_id ? (
                                  <span className="inline-flex items-center gap-1 text-xs">
                                    <span className="text-gray-400">Sure?</span>
                                    <button onClick={() => { setConfirmAction(null); setUserAction({ telegramId: u.telegram_id, name: u.telegram_first_name ?? String(u.telegram_id), type: 'block' }) }} className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 font-semibold">Yes</button>
                                    <button onClick={() => setConfirmAction(null)} className="px-2 py-0.5 rounded bg-white/10 text-gray-400 hover:bg-white/20 font-semibold">No</button>
                                  </span>
                                ) : (
                                  <button onClick={() => setConfirmAction({ type: 'block', telegramId: u.telegram_id })} className="text-xs bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 px-2 py-0.5 rounded font-semibold transition">Block</button>
                                )
                              )}
                              {/* Logout with inline confirm */}
                              {confirmAction?.type === 'logout' && confirmAction.telegramId === u.telegram_id ? (
                                <span className="inline-flex items-center gap-1 text-xs">
                                  <span className="text-gray-400">Sure?</span>
                                  <button onClick={() => { setConfirmAction(null); setUserAction({ telegramId: u.telegram_id, name: u.telegram_first_name ?? String(u.telegram_id), type: 'logout' }) }} className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-semibold">Yes</button>
                                  <button onClick={() => setConfirmAction(null)} className="px-2 py-0.5 rounded bg-white/10 text-gray-400 hover:bg-white/20 font-semibold">No</button>
                                </span>
                              ) : (
                                <button onClick={() => setConfirmAction({ type: 'logout', telegramId: u.telegram_id })} className="text-xs bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 px-2 py-0.5 rounded font-semibold transition">Logout</button>
                              )}
                              {/* Delete with inline confirm */}
                              {confirmAction?.type === 'delete' && confirmAction.telegramId === u.telegram_id ? (
                                <span className="inline-flex items-center gap-1 text-xs">
                                  <span className="text-gray-400">Sure?</span>
                                  <button onClick={() => { setConfirmAction(null); setUserAction({ telegramId: u.telegram_id, name: u.telegram_first_name ?? String(u.telegram_id), type: 'delete' }) }} className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 font-semibold">Yes</button>
                                  <button onClick={() => setConfirmAction(null)} className="px-2 py-0.5 rounded bg-white/10 text-gray-400 hover:bg-white/20 font-semibold">No</button>
                                </span>
                              ) : (
                                <button onClick={() => setConfirmAction({ type: 'delete', telegramId: u.telegram_id })} className="text-xs bg-red-500/15 text-red-400 hover:bg-red-500/25 px-2 py-0.5 rounded font-semibold transition">Delete</button>
                              )}
                            </div>
                          </Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ── TEAM REQUESTS ── */}
        {tab === 'requests' && (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/3"><tr>
                  <Th>User</Th><Th>Requested Team</Th><Th>Status</Th><Th>Admin Note</Th><Th>Requested</Th><Th>Resolved</Th><Th>Actions</Th>
                </tr></thead>
                <tbody className="divide-y divide-white/4">
                  {data.teamRequests.map(r => (
                    <tr key={r.id} className="hover:bg-white/3">
                      <Td><TgUser users={data.users} id={r.telegram_id} /></Td>
                      <Td><span className="font-medium text-white">{teamName(r.requested_team)}</span></Td>
                      <Td><Badge color={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'yellow'}>{r.status}</Badge></Td>
                      <Td><span className="text-gray-400">{r.admin_note ?? <span className="text-gray-600">—</span>}</span></Td>
                      <Td><span className="text-gray-500 text-xs">{dt(r.created_at)}</span></Td>
                      <Td><span className="text-gray-500 text-xs">{r.resolved_at ? dt(r.resolved_at) : <span className="text-gray-600">—</span>}</span></Td>
                      <Td>
                        {r.status === 'pending' && (
                          <div className="flex items-center gap-1">
                            <input type="text" placeholder="Note…" value={noteMap[r.id] ?? ''} onChange={e => setNoteMap(m => ({ ...m, [r.id]: e.target.value }))}
                              className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white w-28 focus:outline-none focus:border-white/20" />
                            <button onClick={() => resolveRequest(r.id, 'approve')} disabled={resolving === r.id}
                              className="text-xs bg-green-500/15 text-green-400 hover:bg-green-500/25 px-2.5 py-1 rounded font-semibold transition disabled:opacity-40">Approve</button>
                            <button onClick={() => resolveRequest(r.id, 'reject')} disabled={resolving === r.id}
                              className="text-xs bg-red-500/15 text-red-400 hover:bg-red-500/25 px-2.5 py-1 rounded font-semibold transition disabled:opacity-40">Reject</button>
                          </div>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── GAME ── */}
        {tab === 'game' && (
          <div className="space-y-4">
          {(() => {
            const sessions = data.gameSessions
            const totalSessions = sessions.length
            const totalGameKicks = sessions.reduce((s, g) => s + g.kicks, 0)
            const avgKicks = totalSessions > 0 ? Math.round(totalGameKicks / totalSessions) : 0
            const totalSeconds = sessions.reduce((s, g) => s + g.duration_seconds, 0)
            const playHours = Math.floor(totalSeconds / 3600)
            const playMins = Math.floor((totalSeconds % 3600) / 60)
            const playTime = playHours > 0 ? `${playHours}h ${playMins}m` : `${playMins}m`
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatTile label="Total Sessions" value={totalSessions} accent="text-purple-400" />
                <StatTile label="Total Kicks" value={totalGameKicks.toLocaleString()} accent="text-yellow-400" />
                <StatTile label="Avg Kicks / Session" value={avgKicks} accent="text-blue-400" />
                <StatTile label="Total Play Time" value={playTime} accent="text-green-400" />
              </div>
            )
          })()}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/3"><tr><Th>User</Th><Th>Kicks</Th><Th>Balls</Th><Th>Duration</Th><Th>Stellar Address</Th><Th>When</Th></tr></thead>
                <tbody className="divide-y divide-white/4">
                  {data.gameSessions.map(s => {
                    const w = s.wallet_id ? walletById[s.wallet_id] : null
                    return (
                      <tr key={s.id} className="hover:bg-white/3">
                        <Td><TgUser users={data.users} id={s.telegram_id} /></Td>
                        <Td><span className="font-bold text-purple-400">{s.kicks}</span></Td>
                        <Td><span className="text-gray-300">{s.balls_spawned}</span></Td>
                        <Td><span className="text-gray-400">{s.duration_seconds}s</span></Td>
                        <Td mono>{w ? <span className="text-xs text-gray-300 break-all">{w.stellar_address}</span> : <span className="text-gray-600">—</span>}</Td>
                        <Td><span className="text-gray-500 text-xs">{dt(s.created_at)}</span></Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          </div>
        )}

        {/* ── DONATIONS ── */}
        {tab === 'donations' && (
          <div className="space-y-3">
            {/* Search input */}
            <input
              type="text"
              placeholder="Search by wallet address, TX hash, or donation target…"
              value={donationSearch}
              onChange={e => setDonationSearch(e.target.value)}
              className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/40"
            />
            {/* Filter buttons */}
            <div className="flex flex-wrap gap-2 items-center">
              {(['all', 'unverified', 'team', 'player', 'general'] as const).map(f => (
                <button key={f} onClick={() => setDonationFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                    donationFilter === f
                      ? 'bg-[#D4AF37] text-black'
                      : 'bg-white/6 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}>
                  {f === 'all' ? 'All' : f === 'unverified' ? 'Unverified' : f.charAt(0).toUpperCase() + f.slice(1)}
                  <span className="ml-1.5 text-[10px] opacity-70">
                    {f === 'all' ? data.donations.length
                      : f === 'unverified' ? data.donations.filter(d => !d.verified).length
                      : data.donations.filter(d => d.donation_type === f).length}
                  </span>
                </button>
              ))}
            </div>
            <Card>
              {filteredDonations.length === 0
                ? <p className="text-sm text-gray-600 px-6 py-12 text-center">No donations match this filter</p>
                : <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-white/3">
                        <tr>
                          <Th>Stellar Address</Th><Th>Amount</Th><Th>Asset</Th><Th>Type</Th><Th>Target</Th><Th>TX Hash</Th><Th>Verified</Th><Th>Date</Th><Th></Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/4">
                        {filteredDonations.map(d => {
                          const w = walletById[d.wallet_id]
                          return (
                            <tr key={d.id} className="hover:bg-white/3">
                              <Td mono>
                                <span className="text-xs text-gray-300">{w?.stellar_address ? shortAddr(w.stellar_address) : d.wallet_id.slice(-8)}</span>
                              </Td>
                              <Td><span className="font-semibold text-yellow-400">{num(d.amount)}</span></Td>
                              <Td><span className="text-gray-300">{d.asset_code}</span></Td>
                              <Td><DonationTypeBadge type={d.donation_type} /></Td>
                              <Td>
                                {d.donation_target
                                  ? <span className="font-bold text-[#D4AF37] text-sm">{d.donation_target}</span>
                                  : <span className="text-gray-500 italic text-sm">General</span>
                                }
                              </Td>
                              <Td mono><span className="text-xs text-gray-500">{d.stellar_tx_hash ? `${d.stellar_tx_hash.slice(0, 16)}…` : '—'}</span></Td>
                              <Td><Badge color={d.verified ? 'green' : 'yellow'}>{d.verified ? 'Verified' : 'Pending'}</Badge></Td>
                              <Td><span className="text-gray-500 text-xs">{dt(d.created_at)}</span></Td>
                              <Td>
                                {!d.verified && (
                                  <button
                                    onClick={() => verifyItem('donation', d.id)}
                                    disabled={verifyingId === d.id}
                                    className="text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 px-2 py-0.5 rounded transition whitespace-nowrap disabled:opacity-40"
                                  >
                                    {verifyingId === d.id ? '…' : 'Mark Verified'}
                                  </button>
                                )}
                              </Td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
              }
            </Card>
          </div>
        )}

        {/* ── PURCHASES ── */}
        {tab === 'purchases' && (
          <div className="space-y-3">
            {/* Search input */}
            <input
              type="text"
              placeholder="Search by wallet address or TX hash…"
              value={purchaseSearch}
              onChange={e => setPurchaseSearch(e.target.value)}
              className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/40"
            />
            {/* Filter buttons */}
            <div className="flex flex-wrap gap-2 items-center">
              {(['all', 'unverified', 'direct', 'advanced'] as const).map(f => (
                <button key={f} onClick={() => setPurchaseFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                    purchaseFilter === f
                      ? 'bg-[#D4AF37] text-black'
                      : 'bg-white/6 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}>
                  {f === 'all' ? 'All' : f === 'unverified' ? 'Unverified' : f.charAt(0).toUpperCase() + f.slice(1)}
                  <span className="ml-1.5 text-[10px] opacity-70">
                    {f === 'all' ? data.purchases.length
                      : f === 'unverified' ? data.purchases.filter(p => !p.verified).length
                      : data.purchases.filter(p => p.purchase_type === f).length}
                  </span>
                </button>
              ))}
            </div>
            <Card>
              {filteredPurchases.length === 0
                ? <p className="text-sm text-gray-600 px-6 py-12 text-center">No purchases match this filter</p>
                : <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-white/3">
                        <tr>
                          <Th>Stellar Address</Th><Th>XLM Sent</Th><Th>{PRIMARY_CUSTOM_ASSET_CODE}</Th><Th>Type</Th><Th>TX Hash</Th><Th>Verified</Th><Th>Date</Th><Th></Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/4">
                        {filteredPurchases.map(p => {
                          const w = walletById[p.wallet_id]
                          return (
                            <tr key={p.id} className="hover:bg-white/3">
                              <Td mono>
                                <span className="text-xs text-gray-300">{w?.stellar_address ? shortAddr(w.stellar_address) : p.wallet_id.slice(-8)}</span>
                              </Td>
                              <Td><span className="text-gray-300">{num(p.xlm_amount)} XLM</span></Td>
                              <Td><span className="font-semibold text-yellow-400">{num(p.token_amount)}</span></Td>
                              <Td><Badge color={p.purchase_type === 'direct' ? 'blue' : 'purple'}>{p.purchase_type}</Badge></Td>
                              <Td mono><span className="text-xs text-gray-500">{p.stellar_tx_hash ? `${p.stellar_tx_hash.slice(0, 16)}…` : '—'}</span></Td>
                              <Td><Badge color={p.verified ? 'green' : 'yellow'}>{p.verified ? 'Verified' : 'Pending'}</Badge></Td>
                              <Td><span className="text-gray-500 text-xs">{dt(p.created_at)}</span></Td>
                              <Td>
                                {!p.verified && (
                                  <button
                                    onClick={() => verifyItem('purchase', p.id)}
                                    disabled={verifyingId === p.id}
                                    className="text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 px-2 py-0.5 rounded transition whitespace-nowrap disabled:opacity-40"
                                  >
                                    {verifyingId === p.id ? '…' : 'Mark Verified'}
                                  </button>
                                )}
                              </Td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
              }
            </Card>
          </div>
        )}

        {/* ── ACCESS ATTEMPTS ── */}
        {tab === 'access' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              {(['1h', '24h', '7d', 'all'] as const).map(f => (
                <button key={f} onClick={() => setAccessTimeFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                    accessTimeFilter === f
                      ? 'bg-[#D4AF37]/15 text-[#D4AF37]'
                      : 'bg-white/6 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}>
                  {f === '1h' ? 'Last hour' : f === '24h' ? 'Last 24h' : f === '7d' ? 'Last 7d' : 'All time'}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2">
                {suspiciousAccess > 0 && <Badge color="red">{suspiciousAccess} suspicious</Badge>}
                <Badge color="gray">{data.accessAttempts.length} total (last 100)</Badge>
                {clearLogsConfirm ? (
                  <span className="inline-flex items-center gap-1 text-xs">
                    <span className="text-gray-400">Delete logs older than 7 days?</span>
                    <button
                      onClick={() => bulkDeleteOldLogs(7)}
                      disabled={clearingLogs}
                      className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 font-semibold disabled:opacity-40"
                    >
                      {clearingLogs ? '…' : 'Yes'}
                    </button>
                    <button onClick={() => setClearLogsConfirm(false)} className="px-2 py-0.5 rounded bg-white/10 text-gray-400 hover:bg-white/20 font-semibold">No</button>
                  </span>
                ) : (
                  <button
                    onClick={() => setClearLogsConfirm(true)}
                    className="text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2.5 py-1 rounded-lg font-semibold transition"
                  >
                    Clear old logs
                  </button>
                )}
              </div>
            </div>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/3"><tr>
                    <Th>Type</Th><Th>IP / Location</Th><Th>User</Th><Th>Screen</Th><Th>Timezone</Th><Th>Language</Th><Th>When</Th><Th></Th>
                  </tr></thead>
                  <tbody className="divide-y divide-white/4">
                    {data.accessAttempts.filter(a => {
                      if (accessTimeFilter === 'all') return true
                      const ms = { '1h': 60 * 60 * 1000, '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000 }[accessTimeFilter]
                      return Date.now() - new Date(a.created_at).getTime() <= ms
                    }).map(a => {
                      const isTelegramSession = !!a.telegram_id && !a.devtools_opened && !a.tg_sdk_fake
                      const isDevtools        = a.devtools_opened
                      const isFakeSdk        = a.tg_sdk_fake
                      const isBrowserBlock   = !a.telegram_id && !a.tg_sdk_present
                      const isSpoofAttempt   = !a.telegram_id && a.tg_sdk_present && !a.tg_sdk_fake
                      void isTelegramSession
                      return (
                      <tr key={a.id} className={`${isDevtools || isFakeSdk ? 'bg-red-500/5' : isBrowserBlock ? 'bg-white/2' : 'hover:bg-white/3'}`}>
                        <Td>
                          {isDevtools      ? <Badge color="red">DevTools opened</Badge>
                            : isFakeSdk    ? <Badge color="red">Fake SDK</Badge>
                            : isBrowserBlock ? <Badge color="gray">Browser — no Telegram</Badge>
                            : isSpoofAttempt ? <Badge color="yellow">SDK present, no user</Badge>
                            : <Badge color="green">Telegram session</Badge>}
                        </Td>
                        <Td mono>
                          <span className="text-gray-300">{a.ip ?? '—'}</span>
                          {a.geo_location && <span className="block text-[11px] text-gray-500 font-sans">({a.geo_location})</span>}
                        </Td>
                        <Td>
                          {a.telegram_id
                            ? <div>
                                <span className="text-white text-xs font-medium">{a.telegram_first_name ?? ''}</span>
                                {a.telegram_username && <span className="text-[#D4AF37] text-xs ml-1">@{a.telegram_username}</span>}
                                <span className="block text-[10px] text-gray-600 font-mono">{a.telegram_id}</span>
                              </div>
                            : <span className="text-gray-600 text-xs italic">No Telegram user</span>}
                        </Td>
                        <Td><span className="text-gray-400 text-xs">{a.screen ?? '—'}</span></Td>
                        <Td><span className="text-gray-400 text-xs">{a.timezone ?? '—'}</span></Td>
                        <Td><span className="text-gray-400 text-xs">{a.language ?? '—'}</span></Td>
                        <Td><span className="text-gray-500 text-xs">{dt(a.created_at)}</span></Td>
                        <Td>
                          <button
                            onClick={() => deleteAccessAttempt(a.id)}
                            disabled={deletingAccessId === a.id}
                            className="text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2 py-0.5 rounded transition disabled:opacity-40"
                          >
                            {deletingAccessId === a.id ? '…' : 'Delete'}
                          </button>
                        </Td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}


        {/* ── REFERRALS ── */}
        {tab === 'referrals' && (() => {
          const stats = data.referralStats ?? []
          const referred = data.referredUsers ?? []
          const totalReferrers = stats.length
          const totalReferred = referred.length
          const topReferrer = stats[0] ?? null
          const pct = data.users.length > 0 ? Math.round((totalReferred / data.users.length) * 100) : 0
          return (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatTile label="Total Referrers" value={totalReferrers} accent="text-blue-400" sub="users who referred at least 1 person" />
                <StatTile label="Total Referred Users" value={totalReferred} accent="text-green-400" sub={`${pct}% of all users`} />
                <StatTile label="Top Referrer" value={topReferrer ? (topReferrer.referrer_name ?? `#${topReferrer.referrer_id}`) : '—'} accent="text-[#D4AF37]" sub={topReferrer ? `${topReferrer.referral_count} referrals${topReferrer.referrer_username ? ` · @${topReferrer.referrer_username}` : ''}` : 'No referrals yet'} />
              </div>
              <section>
                <SectionTitle icon="leaderboard" title="Top Referrers" count={totalReferrers} />
                {totalReferrers === 0
                  ? <p className="text-gray-600 text-sm py-8 text-center">No referrals recorded yet.</p>
                  : <Card><div className="overflow-x-auto"><table className="w-full">
                      <thead className="bg-white/3"><tr><Th>Rank</Th><Th>User</Th><Th>@Username</Th><Th>Telegram ID</Th><Th>Referrals</Th><Th>Last Referral</Th><Th>Actions</Th></tr></thead>
                      <tbody className="divide-y divide-white/4">
                        {stats.map((s, i) => {
                          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
                          const uInData = data.users.find(u => u.telegram_id === s.referrer_id)
                          return (
                            <tr key={s.referrer_id} className="hover:bg-white/5 cursor-pointer transition" onClick={() => uInData && setSelectedUser(uInData)}>
                              <Td><span className="flex items-center gap-1.5">{medal && <span className="text-base leading-none">{medal}</span>}<span className={`font-bold text-sm ${i < 3 ? 'text-[#D4AF37]' : 'text-gray-500'}`}>#{i + 1}</span></span></Td>
                              <Td><span className="font-medium text-white">{s.referrer_name ?? '—'}</span></Td>
                              <Td>{s.referrer_username ? <span className="text-[#D4AF37]">@{s.referrer_username}</span> : <span className="text-gray-600">—</span>}</Td>
                              <Td mono><span className="text-gray-400 text-xs">{s.referrer_id}</span></Td>
                              <Td><span className="font-bold text-green-400 text-base">{s.referral_count}</span></Td>
                              <Td><span className="text-gray-500 text-xs">{ago(s.last_referral_at)}</span></Td>
                              <Td>{uInData ? <button onClick={e => { e.stopPropagation(); setSelectedUser(uInData) }} className="text-xs bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 px-2 py-0.5 rounded font-semibold transition">View User</button> : <span className="text-gray-600 text-xs">—</span>}</Td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table></div></Card>}
              </section>
              <section>
                <SectionTitle icon="person_add" title="Referred Users" count={totalReferred} />
                {totalReferred === 0
                  ? <p className="text-gray-600 text-sm py-8 text-center">No users have been referred yet.</p>
                  : <Card><div className="overflow-x-auto"><table className="w-full">
                      <thead className="bg-white/3"><tr><Th>User</Th><Th>@Username</Th><Th>Referred By</Th><Th>Joined</Th></tr></thead>
                      <tbody className="divide-y divide-white/4">
                        {referred.map(r => {
                          const referrer = data.users.find(u => u.telegram_id === r.referred_by)
                          return (
                            <tr key={r.telegram_id} className="hover:bg-white/3">
                              <Td><span className="font-medium text-white">{r.telegram_first_name ?? '—'}</span><span className="block text-[10px] text-gray-600 font-mono">{r.telegram_id}</span></Td>
                              <Td>{r.telegram_username ? <span className="text-[#D4AF37]">@{r.telegram_username}</span> : <span className="text-gray-600">—</span>}</Td>
                              <Td>{referrer
                                ? <button onClick={() => setSelectedUser(referrer)} className="text-left hover:text-[#D4AF37] transition">
                                    <span className="font-medium text-gray-200">{referrer.telegram_first_name ?? `#${r.referred_by}`}</span>
                                    {referrer.telegram_username && <span className="text-[#D4AF37] text-xs ml-1.5">@{referrer.telegram_username}</span>}
                                    <span className="block text-[10px] text-gray-600 font-mono">{r.referred_by}</span>
                                  </button>
                                : <span className="text-gray-500 font-mono text-xs">#{r.referred_by}</span>}
                              </Td>
                              <Td><span className="text-gray-500 text-xs">{ago(r.created_at)}</span></Td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table></div></Card>}
              </section>
            </div>
          )
        })()}

        {/* ── TRUSTLINE SUBMISSIONS ── */}
        {tab === 'trustline' && (() => {
          const all = data.trustlineSubmissions ?? []
          return (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge color="gray">{all.length} submissions (last 50)</Badge>
                <Badge color="blue">{all.filter(s => s.type === 'trustline').length} trustline</Badge>
                <Badge color="yellow">{all.filter(s => s.type === 'purchase').length} purchase</Badge>
              </div>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/3"><tr>
                      <Th>ID</Th><Th>Type</Th><Th>IP</Th><Th>Result</Th><Th>TX Hash</Th><Th>XDR (truncated)</Th><Th>When</Th>
                    </tr></thead>
                    <tbody className="divide-y divide-white/4">
                      {all.length === 0
                        ? <tr><td colSpan={7} className="text-center text-gray-600 text-sm py-10">No submissions yet</td></tr>
                        : all.map(s => (
                          <tr key={s.id} className="hover:bg-white/3 transition-colors">
                            <Td mono><span className="text-gray-500">{s.id}</span></Td>
                            <Td>
                              {s.type === 'purchase'
                                ? <Badge color="yellow">Purchase</Badge>
                                : <Badge color="blue">Trustline</Badge>}
                            </Td>
                            <Td mono><span className="text-gray-300">{s.ip ?? '—'}</span></Td>
                            <Td>
                              {s.success
                                ? <Badge color="green">Success</Badge>
                                : <Badge color="red">Failed</Badge>}
                            </Td>
                            <Td mono>
                              {s.tx_hash
                                ? <span className="text-xs text-[#D4AF37]" title={s.tx_hash}>{s.tx_hash.slice(0, 8)}…{s.tx_hash.slice(-8)}</span>
                                : <span className="text-gray-600">—</span>}
                            </Td>
                            <Td mono>
                              <span className="text-xs text-gray-400 bg-black/30 px-2 py-0.5 rounded" title={s.xdr}>
                                {s.xdr.slice(0, 20)}…
                              </span>
                            </Td>
                            <Td><span className="text-gray-500 text-xs">{dt(s.created_at)}</span></Td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )
        })()}
      </div>

      {/* ── Confirmation modal ── */}
      {userAction && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className={`text-2xl ${userAction.type === 'delete' ? 'text-red-400' : userAction.type === 'block' ? 'text-orange-400' : userAction.type === 'logout' ? 'text-blue-400' : 'text-green-400'}`}>
                <Icon name={userAction.type === 'delete' ? 'delete' : userAction.type === 'block' ? 'block' : userAction.type === 'logout' ? 'logout' : 'check_circle'} className="text-2xl" />
              </span>
              <div>
                <p className="text-white font-semibold text-sm">{userAction.type === 'logout' ? 'Log out user' : userAction.type === 'delete' ? 'Delete user' : userAction.type === 'block' ? 'Block user' : 'Unblock user'}</p>
                <p className="text-gray-400 text-xs">{userAction.name}</p>
              </div>
            </div>
            <p className="text-gray-300 text-sm">
              {userAction.type === 'logout'
                ? 'Disconnects all wallets. The user keeps their account and can reconnect on next open.'
                : userAction.type === 'delete'
                ? 'Wipes all data and removes the account. They can return as a brand new user — not blocked.'
                : userAction.type === 'block'
                ? 'User will immediately lose access to the app and see a generic error screen.'
                : 'Restores full app access for this user.'}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setUserAction(null)}
                disabled={actionLoading}
                className="flex-1 border border-white/10 text-gray-300 text-sm rounded-lg py-2 hover:bg-white/5 transition disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={executeUserAction}
                disabled={actionLoading}
                className={`flex-1 text-sm font-semibold rounded-lg py-2 transition disabled:opacity-40 ${
                  userAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700 text-white'
                  : userAction.type === 'block' ? 'bg-orange-600 hover:bg-orange-700 text-white'
                  : userAction.type === 'logout' ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {actionLoading ? '…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  return <Suspense><AdminContent /></Suspense>
}

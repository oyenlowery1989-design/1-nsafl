'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useAdminToken } from '../hooks/useAdminToken'
import Link from 'next/link'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'
import { Icon } from '../components/ui'
import { num, ago, teamName } from '../utils'
import type { AdminData, User } from '../types'
import { UserDetail } from '../components/UserDetail'
import { ConfirmModal } from '../components/ConfirmModal'
import { isPackEnabled } from '@/config/app'

// ── Sparkline bar chart ───────────────────────────────────────────────────────
function Sparkline({ days, labels, color }: { days: number[]; labels: string[]; color: string }) {
  const max = Math.max(...days, 1)
  return (
    <div className="flex items-end gap-1 h-12 mt-2">
      {days.map((v, i) => (
        <div key={i} className="flex flex-col items-center flex-1 gap-0.5">
          <div
            className={`w-full rounded-sm ${color} opacity-80 transition-all`}
            style={{ height: `${Math.max(2, Math.round((v / max) * 40))}px` }}
            title={`${labels[i]}: ${v}`}
          />
          <span className="text-[8px] text-gray-600">{labels[i].slice(0, 2)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Trend badge ───────────────────────────────────────────────────────────────
function TrendBadge({ today, yesterday }: { today: number; yesterday: number }) {
  const diff = today - yesterday
  if (diff === 0) return <span className="text-[10px] text-gray-500">= same as yesterday</span>
  const color = diff > 0 ? 'text-green-400' : 'text-red-400'
  const icon = diff > 0 ? '↑' : '↓'
  return <span className={`text-[10px] font-semibold ${color}`}>{icon} {Math.abs(diff)} vs yesterday</span>
}

function OverviewContent() {
  const hasGames = isPackEnabled('games')
  const hasRewards = isPackEnabled('rewards')
  const token = useAdminToken() ?? ''
  const [data, setData] = useState<AdminData | null>(null)
  const [winStats, setWinStats] = useState({ total: 0, pending: 0 })
  const [stats, setStats] = useState<{
    sparklines: { users: { days: number[]; labels: string[]; today: number; yesterday: number }; wins: { days: number[]; labels: string[]; today: number; yesterday: number } }
    rewardAssets: { code: string; label: string; balance: string | null; low: boolean }[]
    activeToday: number
    lastPaidAt: string | null
    senderPublicKey: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userAction, setUserAction] = useState<{ telegramId: number; name: string; type: 'logout' | 'delete' | 'block' | 'unblock' } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  // Pending wins notification
  const [prevPending, setPrevPending] = useState<number | null>(null)
  const [newPendingToast, setNewPendingToast] = useState(false)

  const fetchAll = useCallback(async (t: string) => {
    if (!t) return
    const [adminRes, winsRes, statsRes] = await Promise.all([
      fetch('/api/admin', { headers: { 'x-admin-token': t } }),
      hasGames ? fetch('/api/admin/wins?status=pending&limit=1', { headers: { 'x-admin-token': t } }) : null,
      hasRewards ? fetch('/api/admin/overview-stats', { headers: { 'x-admin-token': t } }) : null,
    ])
    const [adminJ, winsJ, statsJ] = await Promise.all([adminRes.json(), winsRes?.json(), statsRes?.json()])
    if (adminJ.success) setData(adminJ.data)
    if (winsJ?.success) {
      const pending = winsJ.data.counts?.pending ?? 0
      setWinStats({ total: winsJ.data.total ?? 0, pending })
      if (prevPending !== null && pending > prevPending) setNewPendingToast(true)
      setPrevPending(pending)
    }
    if (statsJ?.success) setStats(statsJ.data)
    setLoading(false)
  }, [hasGames, hasRewards, prevPending])

  useEffect(() => { if (token) fetchAll(token) }, [token, fetchAll])

  // Poll for new pending wins
  useEffect(() => {
    if (!token || !hasGames) return
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/wins?status=pending&limit=1', { headers: { 'x-admin-token': token } })
        const j = await res.json()
        if (j.success) {
          const p = j.data.counts?.pending ?? 0
          setWinStats(prev => ({ ...prev, pending: p }))
          setPrevPending(prev => {
            if (prev !== null && p > prev) setNewPendingToast(true)
            return p
          })
        }
      } catch { /* ignore */ }
    }, 60_000)
    return () => clearInterval(id)
  }, [hasGames, token])

  async function executeUserAction() {
    if (!userAction) return
    setActionLoading(true)
    try {
      if (userAction.type === 'delete') {
        await fetch(`/api/admin/user/${userAction.telegramId}`, { method: 'DELETE', headers: { 'x-admin-token': token } })
      } else if (userAction.type === 'logout') {
        await fetch(`/api/admin/user/${userAction.telegramId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
          body: JSON.stringify({ action: 'logout' }),
        })
      } else {
        await fetch(`/api/admin/user/${userAction.telegramId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
          body: JSON.stringify({ block: userAction.type === 'block' }),
        })
      }
      setUserAction(null)
      fetchAll(token)
    } finally { setActionLoading(false) }
  }

  if (selectedUser) return (
    <>
      <UserDetail
        u={selectedUser} data={data!} token={token}
        onBack={() => setSelectedUser(null)}
        onAction={(type) => {
          setSelectedUser(null)
          setUserAction({ telegramId: selectedUser.telegram_id, name: selectedUser.telegram_first_name ?? String(selectedUser.telegram_id), type })
        }}
        onDeleteAccess={async () => {}}
        deletingAccessId={null}
        onUserUpdated={(telegramId, patch) => {
          setData(prev => prev ? { ...prev, users: prev.users.map(u => u.telegram_id === telegramId ? { ...u, ...patch } : u) } : prev)
          setSelectedUser(prev => prev && prev.telegram_id === telegramId ? { ...prev, ...patch } : prev)
        }}
      />
      {userAction && (
        <ConfirmModal type={userAction.type} name={userAction.name} loading={actionLoading}
          onConfirm={executeUserAction} onCancel={() => setUserAction(null)} />
      )}
    </>
  )

  const totalUsers       = data?.users.length ?? 0
  const totalWallets     = data?.users.reduce((s, u) => s + u.wallets.length, 0) ?? 0
  const totalTokenHeld   = data?.totalNsafl ?? 0
  const totalXlmHeld     = data?.totalXlm ?? 0
  const totalKicks       = data?.gameSessions.reduce((s, g) => s + g.kicks, 0) ?? 0
  const suspiciousAccess = data?.accessAttempts.filter(a => a.tg_sdk_fake || a.devtools_opened).length ?? 0

  return (
    <div className="space-y-5">
      {/* Toast */}
      {newPendingToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-orange-500/20 border border-orange-500/30 text-orange-300 text-sm px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3">
          <Icon name="notifications" className="text-base" />
          <span>{winStats.pending} pending win{winStats.pending !== 1 ? 's' : ''} need sending</span>
          <Link href="/admin/wins" className="underline font-semibold">View →</Link>
          <button onClick={() => setNewPendingToast(false)} className="ml-2 text-orange-400 hover:text-orange-200"><Icon name="close" className="text-sm" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-12">
          <svg className="animate-spin h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          <span className="text-sm">Loading overview…</span>
        </div>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total Users',       value: totalUsers,              accent: 'text-blue-400',   bg: 'bg-blue-500/8'   },
              { label: 'Wallets',           value: totalWallets,            accent: 'text-cyan-400',   bg: 'bg-cyan-500/8'   },
              { label: `${PRIMARY_CUSTOM_ASSET_CODE} Held`, value: num(totalTokenHeld), accent: 'text-yellow-400', bg: 'bg-yellow-500/8' },
              { label: 'XLM Held',          value: num(totalXlmHeld),       accent: 'text-blue-300',   bg: 'bg-blue-500/8'   },
              { label: 'Total Kicks',       value: totalKicks.toLocaleString(), accent: 'text-purple-400', bg: 'bg-purple-500/8' },
              { label: 'Suspicious Access', value: suspiciousAccess,        accent: suspiciousAccess > 0 ? 'text-red-400' : 'text-gray-400', bg: suspiciousAccess > 0 ? 'bg-red-500/8' : 'bg-white/4' },
              { label: 'Donations',         value: data?.donations.length ?? 0, accent: 'text-green-400', bg: 'bg-green-500/8' },
              { label: 'Referrals',         value: data?.referredUsers?.length ?? 0, accent: 'text-emerald-400', bg: 'bg-emerald-500/8' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-4 border border-white/6 ${s.bg}`}>
                <p className="text-[11px] text-gray-500 font-medium">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.accent}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Active today + last paid */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl p-4 border border-emerald-500/20 bg-emerald-500/8">
                <p className="text-[11px] text-gray-500 font-medium">Active Today</p>
                <p className="text-2xl font-bold mt-1 text-emerald-400">{stats.activeToday}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">unique players today</p>
              </div>
              <div className="rounded-xl p-4 border border-white/6 bg-white/3">
                <p className="text-[11px] text-gray-500 font-medium">Last Prize Sent</p>
                <p className="text-lg font-bold mt-1 text-white">{stats.lastPaidAt ? ago(stats.lastPaidAt) : 'Never'}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{stats.lastPaidAt ? new Date(stats.lastPaidAt).toLocaleDateString() : '\u2014'}</p>
              </div>
            </div>
          )}

          {/* Sparklines */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface border border-white/8 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-300">New Users (7 days)</p>
                  <TrendBadge today={stats.sparklines.users.today} yesterday={stats.sparklines.users.yesterday} />
                </div>
                <p className="text-2xl font-bold text-blue-400">{stats.sparklines.users.today} <span className="text-sm font-normal text-gray-500">today</span></p>
                <Sparkline days={stats.sparklines.users.days} labels={stats.sparklines.users.labels} color="bg-blue-500" />
              </div>
              <div className="bg-surface border border-white/8 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-300">Wins (7 days)</p>
                  <TrendBadge today={stats.sparklines.wins.today} yesterday={stats.sparklines.wins.yesterday} />
                </div>
                <p className="text-2xl font-bold text-primary">{stats.sparklines.wins.today} <span className="text-sm font-normal text-gray-500">today</span></p>
                <Sparkline days={stats.sparklines.wins.days} labels={stats.sparklines.wins.labels} color="bg-yellow-500" />
              </div>
            </div>
          )}

          {/* Lucky Draw wins tile */}
          <div className="rounded-xl p-4 border border-primary/20 bg-yellow-500/5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon name="casino" className="text-base text-primary" />
              </div>
              <div>
                <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">Game Wins</p>
                <p className="text-lg font-bold text-primary leading-tight">
                  {winStats.total} <span className="text-sm font-normal text-gray-400">total asset wins</span>
                </p>
                {winStats.pending > 0
                  ? <p className="text-[11px] text-orange-400 font-medium">{winStats.pending} pending payout</p>
                  : <p className="text-[11px] text-gray-600">No pending payouts</p>
                }
              </div>
            </div>
            <Link href="/admin/wins" className="text-xs text-primary hover:text-yellow-300 border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition shrink-0 font-semibold">
              View all →
            </Link>
          </div>

          {/* Reward wallet balances */}
          {stats?.rewardAssets && stats.rewardAssets.some(a => a.balance !== null) && (
            <div className="bg-surface border border-white/8 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Icon name="account_balance_wallet" className="text-sm text-primary" />
                Reward Wallet Balances
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {stats.rewardAssets.map(a => (
                  <div key={a.code} className={`rounded-lg p-2.5 border ${a.low ? 'bg-red-500/10 border-red-500/30' : 'bg-white/3 border-white/6'}`}>
                    <p className={`text-[10px] font-semibold ${a.low ? 'text-red-400' : 'text-gray-500'}`}>{a.code}</p>
                    {a.balance !== null
                      ? <p className={`text-sm font-bold mt-0.5 ${a.low ? 'text-red-300' : 'text-white'}`}>{parseFloat(a.balance).toFixed(2)}</p>
                      : <p className="text-xs text-gray-600 mt-0.5">—</p>
                    }
                    {a.low && <p className="text-[9px] text-red-500 mt-0.5">LOW</p>}
                  </div>
                ))}
              </div>
              {stats.senderPublicKey && stats.senderPublicKey !== 'NOT_SET' && stats.senderPublicKey !== 'INVALID_SECRET' && (
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/6">
                  <p className="text-[11px] text-gray-500 font-mono truncate flex-1">{stats.senderPublicKey.slice(0, 12)}&hellip;{stats.senderPublicKey.slice(-6)}</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(stats.senderPublicKey!); }}
                    className="text-[11px] text-primary hover:text-yellow-300 border border-primary/30 rounded px-2 py-1 transition"
                  >
                    Copy Address
                  </button>
                  <a
                    href={`https://stellar.expert/explorer/public/account/${stats.senderPublicKey}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-blue-400 hover:text-blue-300 border border-blue-500/20 rounded px-2 py-1 transition"
                  >
                    Stellar.Expert
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Recent users */}
          <div className="bg-[#111827] border border-white/8 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 text-sm font-semibold text-gray-300">Recent Users</div>
            <table className="w-full">
              <thead><tr>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-white/5">User</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-white/5">Team</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-white/5">Joined</th>
              </tr></thead>
              <tbody className="divide-y divide-white/4">
                {(data?.users ?? []).slice(0, 8).map(u => (
                  <tr key={u.telegram_id} className="hover:bg-white/3 cursor-pointer" onClick={() => setSelectedUser(u)}>
                    <td className="px-3 py-2.5 text-sm text-gray-200">
                      <span className="font-medium text-white">{u.telegram_first_name ?? '—'}</span>
                      {u.telegram_username && <span className="text-primary text-xs ml-1.5">@{u.telegram_username}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-200">{teamName(u.favorite_team)}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-200"><span className="text-gray-500 text-xs">{ago(u.created_at)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {userAction && !selectedUser && (
        <ConfirmModal type={userAction.type} name={userAction.name} loading={actionLoading}
          onConfirm={executeUserAction} onCancel={() => setUserAction(null)} />
      )}
    </div>
  )
}

export default function OverviewPage() {
  return <Suspense><OverviewContent /></Suspense>
}

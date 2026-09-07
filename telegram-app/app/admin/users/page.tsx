'use client'
import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { useAdminToken } from '../hooks/useAdminToken'
import { Badge, Card, Th, Td, Icon, StatTile } from '../components/ui'
import { UserDetail } from '../components/UserDetail'
import { ConfirmModal } from '../components/ConfirmModal'
import { ago, num, teamName, shortAddr, dt } from '../utils'
import type { AdminData, User, ConfirmAction } from '../types'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'
import { ALL_CLUBS } from '@/config/afl'
import { isPackEnabled } from '@/config/app'

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTier(bal: number): string {
  if (bal >= 2501) return 'T4'
  if (bal >= 1001) return 'T3'
  if (bal >= 501) return 'T2'
  if (bal >= 100) return 'T1'
  return 'T0'
}

const TIER_COLORS: Record<string, string> = {
  T0: 'text-gray-400',
  T1: 'text-blue-400',
  T2: 'text-green-400',
  T3: 'text-purple-400',
  T4: 'text-primary',
}

function primaryBal(u: User): number {
  const w = u.wallets.find(w => w.is_primary) ?? u.wallets[0]
  return Number(w?.wallet_balances[0]?.primary_asset_balance ?? 0)
}

function xlmBal(u: User): number {
  const w = u.wallets.find(w => w.is_primary) ?? u.wallets[0]
  return Number(w?.wallet_balances[0]?.xlm_balance ?? 0)
}

function primaryAddr(u: User): string {
  const w = u.wallets.find(w => w.is_primary) ?? u.wallets[0]
  return w?.stellar_address ?? ''
}

type SortKey = 'balance' | 'joined' | 'wins'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | 'active' | 'blocked'

// ── Inner page ───────────────────────────────────────────────────────────────

function UsersPageInner() {
  const hasGames = isPackEnabled('games')
  const hasWallet = isPackEnabled('stellar-wallet')
  // Auth
  const token = useAdminToken()

  // Data
  const [data, setData] = useState<AdminData | null>(null)
  const [winCounts, setWinCounts] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // UI state
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('balance')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [teamFilter, setTeamFilter] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [deletingAccessId, setDeletingAccessId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncToast, setSyncToast] = useState<string | null>(null)

  // Fetch
  const fetchData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [adminRes, winsRes] = await Promise.all([
        fetch('/api/admin', { headers: { 'x-admin-token': token } }),
        hasGames ? fetch('/api/admin/wins?limit=1000', { headers: { 'x-admin-token': token } }) : null,
      ])
      if (!adminRes.ok) throw new Error(`Admin API ${adminRes.status}`)
      const adminJson = await adminRes.json()
      if (!adminJson.success) throw new Error(adminJson.error ?? 'Failed')
      setData(adminJson.data)

      // Build win counts per telegram_id
      if (winsRes?.ok) {
        const winsJson = await winsRes.json()
        const wins: { telegram_id: number }[] = winsJson.data?.wins ?? winsJson.wins ?? []
        const counts: Record<number, number> = {}
        for (const w of wins) {
          if (w.telegram_id) counts[w.telegram_id] = (counts[w.telegram_id] ?? 0) + 1
        }
        setWinCounts(counts)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [hasGames, token])

  useEffect(() => { if (token) fetchData() }, [token, fetchData])

  // Filtered + sorted users
  const filteredUsers = useMemo(() => {
    if (!data) return []
    let users = [...data.users]

    // Status filter
    if (statusFilter === 'active') users = users.filter(u => !u.is_blocked)
    if (statusFilter === 'blocked') users = users.filter(u => u.is_blocked)

    // Team filter
    if (teamFilter) users = users.filter(u => u.favorite_team === teamFilter)

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      users = users.filter(u =>
        (u.telegram_first_name?.toLowerCase().includes(q)) ||
        (u.telegram_username?.toLowerCase().includes(q)) ||
        String(u.telegram_id).includes(q) ||
        primaryAddr(u).toLowerCase().includes(q)
      )
    }

    // Sort
    users.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'balance') cmp = primaryBal(a) - primaryBal(b)
      else if (sortKey === 'joined') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      else if (sortKey === 'wins') cmp = (winCounts[a.telegram_id] ?? 0) - (winCounts[b.telegram_id] ?? 0)
      return sortDir === 'desc' ? -cmp : cmp
    })

    return users
  }, [data, search, sortKey, sortDir, statusFilter, teamFilter, winCounts])

  // Tier breakdown
  const tierBreakdown = useMemo(() => {
    if (!data) return { T0: 0, T1: 0, T2: 0, T3: 0, T4: 0 }
    const counts = { T0: 0, T1: 0, T2: 0, T3: 0, T4: 0 }
    for (const u of data.users) {
      const tier = getTier(primaryBal(u)) as keyof typeof counts
      counts[tier]++
    }
    return counts
  }, [data])

  // Teams present in user base (for filter dropdown)
  const teamsInUse = useMemo(() => {
    if (!data) return []
    const set = new Set<string>()
    for (const u of data.users) if (u.favorite_team) set.add(u.favorite_team)
    return ALL_CLUBS.filter(c => set.has(c.id))
  }, [data])

  // Sync all balances
  async function syncAllBalances() {
    if (!hasWallet) return
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/sync-missing-balances', {
        method: 'POST',
        headers: { 'x-admin-token': token ?? '' },
      })
      const j = await res.json()
      setSyncToast(j.success ? `Synced ${j.data?.updated ?? 'all'} wallets` : (j.error ?? 'Sync failed'))
      setTimeout(() => setSyncToast(null), 4000)
    } catch { setSyncToast('Sync failed') }
    finally { setSyncing(false) }
  }

  // CSV export
  function exportCsv() {
    const rows = filteredUsers.map(u => {
      const w = u.wallets.find(w => w.is_primary) ?? u.wallets[0]
      const bal = Number(w?.wallet_balances[0]?.primary_asset_balance ?? 0)
      const tier = getTier(bal)
      return [u.telegram_id, u.telegram_first_name ?? '', u.telegram_username ?? '', w?.stellar_address ?? '', bal, tier, u.favorite_team ?? '', u.created_at].join(',')
    })
    const csv = ['id,name,username,wallet,primary_asset_balance,tier,team,joined', ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${PRIMARY_CUSTOM_ASSET_CODE.toLowerCase()}_users.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // Actions
  async function doAction(type: 'block' | 'unblock' | 'logout' | 'delete', telegramId: number) {
    if (!token) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/user/${telegramId}/${type}`, {
        method: 'POST',
        headers: { 'x-admin-token': token },
      })
      const j = await res.json()
      if (!j.success) throw new Error(j.error ?? 'Failed')
      setConfirmAction(null)
      setSelectedUser(null)
      await fetchData()
    } catch {
      // silently fail — user sees modal close and data refresh
    } finally {
      setActionLoading(false)
    }
  }

  async function deleteAccess(id: string) {
    if (!token) return
    setDeletingAccessId(id)
    try {
      await fetch(`/api/admin/access/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token },
      })
      await fetchData()
    } finally {
      setDeletingAccessId(null)
    }
  }

  function handleUserUpdated(telegramId: number, patch: Partial<User>) {
    if (!data) return
    setData({
      ...data,
      users: data.users.map(u => u.telegram_id === telegramId ? { ...u, ...patch } : u),
    })
    if (selectedUser?.telegram_id === telegramId) {
      setSelectedUser(prev => prev ? { ...prev, ...patch } : prev)
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  // Auth gate
  if (token === null) return <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center"><span className="text-gray-500 text-sm">Loading...</span></div>
  if (token === '') return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <p className="text-red-400 text-sm">No admin token. Log in via <a href="/admin" className="underline">/admin</a>.</p>
    </div>
  )

  // Loading
  if (loading && !data) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-400 text-sm">
        <Icon name="sync" className="text-lg animate-spin" /> Loading users...
      </div>
    </div>
  )

  // Error
  if (error) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={fetchData} className="text-xs bg-white/10 text-gray-300 px-4 py-2 rounded-lg hover:bg-white/15 transition">Retry</button>
      </div>
    </div>
  )

  // User detail view
  if (selectedUser && data) return (
    <>
      <UserDetail
        u={selectedUser}
        data={data}
        token={token}
        onBack={() => setSelectedUser(null)}
        onAction={(type) => setConfirmAction({ type, telegramId: selectedUser.telegram_id, name: selectedUser.telegram_first_name ?? `#${selectedUser.telegram_id}` })}
        onDeleteAccess={deleteAccess}
        deletingAccessId={deletingAccessId}
        onUserUpdated={handleUserUpdated}
      />
      {confirmAction && (
        <ConfirmModal
          type={confirmAction.type}
          name={confirmAction.name ?? `#${confirmAction.telegramId}`}
          loading={actionLoading}
          onConfirm={() => doAction(confirmAction.type, confirmAction.telegramId)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  )

  return (
    <div className="min-h-screen bg-background-dark text-gray-100">
      {/* Header */}
      <header className="bg-surface border-b border-white/8 px-6 py-4 flex items-center justify-between gap-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Icon name="group" className="text-xl text-primary" />
          <h1 className="text-lg font-bold text-white">Users</h1>
          {data && <span className="bg-white/8 text-gray-400 text-xs font-semibold px-2.5 py-0.5 rounded-full">{data.users.length}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <Icon name="download" className="text-sm" /> CSV
          </button>
          <button onClick={fetchData} disabled={loading} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-40 transition" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <Icon name="sync" className={`text-sm ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={syncAllBalances} disabled={syncing}
            className="flex items-center gap-1.5 text-xs bg-white/6 text-gray-300 hover:bg-white/12 px-3 py-1.5 rounded-lg font-semibold transition disabled:opacity-40">
            {syncing ? <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> : <span className="material-symbols-outlined text-sm">sync</span>}
            {syncing ? 'Syncing\u2026' : 'Sync All Balances'}
          </button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">

        {/* Tier Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatTile label="T0 (< 100)" value={tierBreakdown.T0} accent="text-gray-400" />
          <StatTile label="T1 (100-500)" value={tierBreakdown.T1} accent="text-blue-400" />
          <StatTile label="T2 (501-1k)" value={tierBreakdown.T2} accent="text-green-400" />
          <StatTile label="T3 (1k-2.5k)" value={tierBreakdown.T3} accent="text-purple-400" />
          <StatTile label="T4 (2.5k+)" value={tierBreakdown.T4} accent="text-primary" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-base" />
            <input
              type="text"
              placeholder="Search name, username, ID, or address..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#111827] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/40 transition"
            />
          </div>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-primary/40"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>

          {/* Team */}
          <select
            value={teamFilter}
            onChange={e => setTeamFilter(e.target.value)}
            className="bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-primary/40"
          >
            <option value="">All Teams</option>
            {teamsInUse.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* Sort */}
          <div className="flex items-center gap-1 bg-[#111827] border border-white/10 rounded-lg overflow-hidden">
            {(['balance', 'joined', 'wins'] as SortKey[]).map(key => (
              <button
                key={key}
                onClick={() => toggleSort(key)}
                className={`px-3 py-2 text-xs font-semibold transition ${sortKey === key ? 'bg-primary/15 text-primary' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {key === 'balance' ? PRIMARY_CUSTOM_ASSET_CODE : key === 'joined' ? 'Joined' : 'Wins'}
                {sortKey === key && <span className="ml-1">{sortDir === 'desc' ? '\u2193' : '\u2191'}</span>}
              </button>
            ))}
          </div>

          {/* Count */}
          <span className="text-xs text-gray-500 ml-auto">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Users Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/3">
                <tr>
                  <Th>Name / ID</Th>
                  <Th>Username</Th>
                  <Th>Status</Th>
                  <Th>Team</Th>
                  <Th>Wallet</Th>
                  <Th>{PRIMARY_CUSTOM_ASSET_CODE}</Th>
                  <Th>XLM</Th>
                  <Th>Tier</Th>
                  <Th>Wins</Th>
                  <Th>Joined</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-12 text-center text-gray-600 text-sm">No users match your filters.</td>
                  </tr>
                ) : filteredUsers.map(u => {
                  const bal = primaryBal(u)
                  const xlm = xlmBal(u)
                  const tier = getTier(bal)
                  const addr = primaryAddr(u)
                  const wins = winCounts[u.telegram_id] ?? 0
                  return (
                    <tr
                      key={u.telegram_id}
                      className="hover:bg-white/3 cursor-pointer transition"
                      onClick={() => setSelectedUser(u)}
                    >
                      <Td>
                        <div className="flex items-center gap-2">
                          {u.telegram_photo_url
                            ? <img src={u.telegram_photo_url} className="w-7 h-7 rounded-full object-cover shrink-0" alt="" />
                            : <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-xs shrink-0">{(u.telegram_first_name ?? '?')[0]}</div>
                          }
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-white block truncate max-w-[140px]">{u.telegram_first_name ?? '—'}</span>
                            <span className="text-[10px] text-gray-600 font-mono">#{u.telegram_id}</span>
                          </div>
                        </div>
                      </Td>
                      <Td>{u.telegram_username ? <span className="text-primary text-xs">@{u.telegram_username}</span> : <span className="text-gray-600 text-xs">—</span>}</Td>
                      <Td><Badge color={u.is_blocked ? 'red' : 'green'}>{u.is_blocked ? 'Blocked' : 'Active'}</Badge></Td>
                      <Td><span className="text-gray-400 text-xs">{teamName(u.favorite_team)}</span></Td>
                      <Td mono>{addr ? <span className="text-xs text-gray-500">{shortAddr(addr)}</span> : <span className="text-gray-600 text-xs">—</span>}</Td>
                      <Td><span className="font-bold text-yellow-400 text-sm">{num(bal)}</span></Td>
                      <Td><span className="text-gray-300 text-sm">{num(xlm)}</span></Td>
                      <Td><span className={`font-bold text-xs ${TIER_COLORS[tier]}`}>{tier}</span></Td>
                      <Td><span className={`text-sm ${wins > 0 ? 'font-semibold text-purple-400' : 'text-gray-600'}`}>{wins}</span></Td>
                      <Td><span className="text-gray-500 text-xs whitespace-nowrap">{ago(u.created_at)}</span></Td>
                      <Td>
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          {u.is_blocked ? (
                            <button
                              onClick={() => setConfirmAction({ type: 'unblock', telegramId: u.telegram_id, name: u.telegram_first_name ?? `#${u.telegram_id}` })}
                              className="text-[10px] px-2 py-0.5 rounded bg-green-500/15 text-green-400 hover:bg-green-500/25 font-semibold transition"
                            >Unblock</button>
                          ) : (
                            <button
                              onClick={() => setConfirmAction({ type: 'block', telegramId: u.telegram_id, name: u.telegram_first_name ?? `#${u.telegram_id}` })}
                              className="text-[10px] px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 font-semibold transition"
                            >Block</button>
                          )}
                          <button
                            onClick={() => setConfirmAction({ type: 'logout', telegramId: u.telegram_id, name: u.telegram_first_name ?? `#${u.telegram_id}` })}
                            className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 font-semibold transition"
                          >Logout</button>
                          <button
                            onClick={() => setConfirmAction({ type: 'delete', telegramId: u.telegram_id, name: u.telegram_first_name ?? `#${u.telegram_id}` })}
                            className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 font-semibold transition"
                          >Del</button>
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

      {/* Sync toast */}
      {syncToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1a2235] border border-white/10 text-white text-sm px-5 py-3 rounded-xl shadow-2xl">{syncToast}</div>
      )}

      {/* Confirm Modal */}
      {confirmAction && (
        <ConfirmModal
          type={confirmAction.type}
          name={confirmAction.name ?? `#${confirmAction.telegramId}`}
          loading={actionLoading}
          onConfirm={() => doAction(confirmAction.type, confirmAction.telegramId)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  )
}

// ── Suspense wrapper ─────────────────────────────────────────────────────────

export default function UsersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <span className="text-gray-500 text-sm">Loading...</span>
      </div>
    }>
      <UsersPageInner />
    </Suspense>
  )
}

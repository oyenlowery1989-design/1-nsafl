'use client'
import { useState } from 'react'
import { Badge, Card, Th, Td, StatTile, SectionTitle, Icon, CopyAddressRow, DonationTypeBadge } from './ui'
import { ActivityTimeline } from './ActivityTimeline'
import { ago, dt, num, teamName } from '../utils'
import type { User, AdminData } from '../types'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'
import { getTierForBalance } from '@/config/tiers'
import { ALL_CLUBS } from '@/config/afl'
import { isPackEnabled } from '@/config/app'

interface Props {
  u: User
  data: AdminData
  token: string
  onBack: () => void
  onAction: (type: 'logout' | 'block' | 'unblock' | 'delete') => void
  onDeleteAccess: (id: string) => void
  deletingAccessId: string | null
  onUserUpdated: (telegramId: number, patch: Partial<User>) => void
}

export function UserDetail({ u, data, token, onBack, onAction, onDeleteAccess, deletingAccessId, onUserUpdated }: Props) {
  const hasWallet = isPackEnabled('stellar-wallet')
  const walletIds     = new Set(u.wallets.map(w => w.id))
  const userAccess    = data.accessAttempts.filter(a => a.telegram_id === u.telegram_id)
  const userSessions  = data.gameSessions.filter(g => g.telegram_id === u.telegram_id)
  const userDonations = data.donations.filter(d => walletIds.has(d.wallet_id))
  const userPurchases = data.purchases.filter(p => walletIds.has(p.wallet_id))
  const totalKicks    = userSessions.reduce((s, g) => s + g.kicks, 0)
  const totalTokenBal = u.wallets.reduce((s, w) => s + Number(w.wallet_balances[0]?.primary_asset_balance ?? 0), 0)
  const totalXLM      = u.wallets.reduce((s, w) => s + Number(w.wallet_balances[0]?.xlm_balance ?? 0), 0)
  const lastSeen      = u.wallets.reduce<string | null>((best, w) => {
    if (!w.last_connected_at) return best
    if (!best) return w.last_connected_at
    return w.last_connected_at > best ? w.last_connected_at : best
  }, null)

  const [detailConfirm, setDetailConfirm] = useState<{ type: 'logout' | 'block' | 'delete' } | null>(null)
  const [editingTeam, setEditingTeam]     = useState(false)
  const [teamDraft, setTeamDraft]         = useState(u.favorite_team ?? '')
  const [editingPref, setEditingPref]     = useState(false)
  const [prefDraft, setPrefDraft]         = useState(u.display_preference)
  const [editSaving, setEditSaving]       = useState(false)
  const [editToast, setEditToast]         = useState<string | null>(null)
  const [bonusBalls, setBonusBalls]       = useState(u.bonus_balls ?? 0)
  const [grantingBall, setGrantingBall]   = useState(false)
  const [bonusSpins, setBonusSpins]       = useState(u.bonus_spins ?? 0)
  const [grantingSpin, setGrantingSpin]   = useState(false)
  const [refreshing, setRefreshing]       = useState(false)
  const [refreshToast, setRefreshToast]   = useState<string | null>(null)

  function showEditToast(msg: string) {
    setEditToast(msg)
    setTimeout(() => setEditToast(null), 3000)
  }

  async function refreshBalance() {
    if (!hasWallet) return
    setRefreshing(true)
    setRefreshToast(null)
    try {
      const res = await fetch(`/api/admin/user/${u.telegram_id}/refresh-balance`, {
        method: 'POST',
        headers: { 'x-admin-token': token },
      })
      const j = await res.json()
      if (j.success) {
        setRefreshToast(`✓ ${PRIMARY_CUSTOM_ASSET_CODE}: ${Number(j.data.primary_asset_balance).toLocaleString()} · XLM: ${Number(j.data.xlm_balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
        onUserUpdated(u.telegram_id, {
          wallets: u.wallets.map(w => w.is_primary ? {
            ...w,
            wallet_balances: [{ primary_asset_balance: j.data.primary_asset_balance, xlm_balance: j.data.xlm_balance, balance_week_ago: w.wallet_balances[0]?.balance_week_ago ?? 0, last_synced_at: new Date().toISOString() }],
          } : w),
        })
      } else {
        setRefreshToast(`✗ ${j.error ?? 'Failed'}`)
      }
    } catch {
      setRefreshToast('✗ Network error')
    } finally {
      setRefreshing(false)
      setTimeout(() => setRefreshToast(null), 4000)
    }
  }

  async function grantBonusBall() {
    setGrantingBall(true)
    try {
      const next = bonusBalls + 1
      const res = await fetch(`/api/admin/user/${u.telegram_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ bonus_balls: next }),
      })
      const j = await res.json()
      if (j.success) { setBonusBalls(next); onUserUpdated(u.telegram_id, { bonus_balls: next }); showEditToast(`+1 ball granted`) }
      else showEditToast('Failed to grant ball')
    } catch { showEditToast('Error — try again') }
    finally { setGrantingBall(false) }
  }

  async function revokeBonusBall() {
    if (bonusBalls <= 0) return
    setGrantingBall(true)
    try {
      const next = bonusBalls - 1
      const res = await fetch(`/api/admin/user/${u.telegram_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ bonus_balls: next }),
      })
      const j = await res.json()
      if (j.success) { setBonusBalls(next); onUserUpdated(u.telegram_id, { bonus_balls: next }); showEditToast(`Revoked 1 ball`) }
      else showEditToast('Failed to revoke ball')
    } catch { showEditToast('Error — try again') }
    finally { setGrantingBall(false) }
  }

  async function adjustBonusSpin(delta: number) {
    const next = Math.max(0, bonusSpins + delta)
    if (next === bonusSpins) return
    setGrantingSpin(true)
    try {
      const res = await fetch(`/api/admin/user/${u.telegram_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ bonus_spins: next }),
      })
      const j = await res.json()
      if (j.success) { setBonusSpins(next); onUserUpdated(u.telegram_id, { bonus_spins: next }); showEditToast(delta > 0 ? `+${delta} spin${delta !== 1 ? 's' : ''} granted` : `${delta} spin removed`) }
      else showEditToast('Failed to update spins')
    } catch { showEditToast('Error — try again') }
    finally { setGrantingSpin(false) }
  }

  async function setBonusSpinDirect(value: number) {
    if (isNaN(value) || value < 0) return
    setGrantingSpin(true)
    try {
      const res = await fetch(`/api/admin/user/${u.telegram_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ bonus_spins: value }),
      })
      const j = await res.json()
      if (j.success) { setBonusSpins(value); onUserUpdated(u.telegram_id, { bonus_spins: value }); showEditToast(`Spins set to ${value}`) }
      else showEditToast('Failed to update spins')
    } catch { showEditToast('Error — try again') }
    finally { setGrantingSpin(false) }
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
      if (j.success) { onUserUpdated(u.telegram_id, { favorite_team: teamDraft || null }); setEditingTeam(false); showEditToast('Updated') }
      else showEditToast('Save failed')
    } finally { setEditSaving(false) }
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
      if (j.success) { onUserUpdated(u.telegram_id, { display_preference: prefDraft }); setEditingPref(false); showEditToast('Updated') }
      else showEditToast('Save failed')
    } finally { setEditSaving(false) }
  }

  return (
    <div className="min-h-screen bg-background-dark text-gray-100">
      {editToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-[#1a2235] border border-white/10 text-white text-sm px-5 py-3 rounded-xl shadow-2xl backdrop-blur-sm">
          {editToast}
        </div>
      )}

      {/* Header */}
      <header className="bg-surface border-b border-white/8 px-6 py-3 flex items-center gap-4 sticky top-0 z-20">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition">
          ← Back
        </button>
        <div className="w-px h-5 bg-white/10" />
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {u.telegram_photo_url
            ? <img src={u.telegram_photo_url} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
            : <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">{(u.telegram_first_name ?? '?')[0]}</div>
          }
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-semibold text-sm">{u.telegram_first_name ?? '—'}</span>
              {u.telegram_username && <span className="text-primary text-sm">@{u.telegram_username}</span>}
              <Badge color={u.is_blocked ? 'red' : 'green'}>{u.is_blocked ? 'Blocked' : 'Active'}</Badge>
            </div>
            <span className="text-gray-600 text-xs font-mono">ID {u.telegram_id}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Logout */}
          {detailConfirm?.type === 'logout' ? (
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="text-gray-400">Log out?</span>
              <button onClick={() => { setDetailConfirm(null); onAction('logout') }} className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 font-semibold">Yes</button>
              <button onClick={() => setDetailConfirm(null)} className="px-2 py-1 rounded bg-white/10 text-gray-400 font-semibold">No</button>
            </span>
          ) : (
            <button onClick={() => setDetailConfirm({ type: 'logout' })} className="text-xs bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 px-3 py-1.5 rounded-lg font-semibold transition">Logout</button>
          )}
          {/* Block / Unblock */}
          {u.is_blocked ? (
            <button onClick={() => onAction('unblock')} className="text-xs bg-green-500/15 text-green-400 hover:bg-green-500/25 px-3 py-1.5 rounded-lg font-semibold transition">Unblock</button>
          ) : detailConfirm?.type === 'block' ? (
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="text-gray-400">Block?</span>
              <button onClick={() => { setDetailConfirm(null); onAction('block') }} className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 font-semibold">Yes</button>
              <button onClick={() => setDetailConfirm(null)} className="px-2 py-1 rounded bg-white/10 text-gray-400 font-semibold">No</button>
            </span>
          ) : (
            <button onClick={() => setDetailConfirm({ type: 'block' })} className="text-xs bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 px-3 py-1.5 rounded-lg font-semibold transition">Block</button>
          )}
          {/* Delete */}
          {detailConfirm?.type === 'delete' ? (
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="text-gray-400">Delete?</span>
              <button onClick={() => { setDetailConfirm(null); onAction('delete') }} className="px-2 py-1 rounded bg-red-500/20 text-red-400 font-semibold">Yes</button>
              <button onClick={() => setDetailConfirm(null)} className="px-2 py-1 rounded bg-white/10 text-gray-400 font-semibold">No</button>
            </span>
          ) : (
            <button onClick={() => setDetailConfirm({ type: 'delete' })} className="text-xs bg-red-500/15 text-red-400 hover:bg-red-500/25 px-3 py-1.5 rounded-lg font-semibold transition">Delete</button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Hero identity */}
        <div className="bg-[#111827] border border-white/8 rounded-2xl p-6">
          <div className="flex items-start gap-5">
            {u.telegram_photo_url
              ? <img src={u.telegram_photo_url} className="w-16 h-16 rounded-2xl object-cover shrink-0" alt="" />
              : <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center text-primary font-bold text-2xl shrink-0">{(u.telegram_first_name ?? '?')[0]}</div>
            }
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl font-bold text-white">{u.telegram_first_name ?? '—'}</h1>
                {u.telegram_username && <span className="text-primary">@{u.telegram_username}</span>}
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
                      <select value={teamDraft} onChange={e => setTeamDraft(e.target.value)}
                        className="bg-black/40 border border-white/15 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary/50 flex-1 min-w-0">
                        <option value="">— None —</option>
                        {ALL_CLUBS.map(c => <option key={c.id} value={c.id}>{c.name} ({c.league})</option>)}
                      </select>
                      <button onClick={saveTeam} disabled={editSaving} className="text-xs bg-primary text-black px-2 py-1 rounded font-bold disabled:opacity-50">Save</button>
                      <button onClick={() => { setEditingTeam(false); setTeamDraft(u.favorite_team ?? '') }} className="text-xs bg-white/10 text-gray-400 px-2 py-1 rounded">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-gray-200">{teamName(u.favorite_team)}</span>
                      <button onClick={() => setEditingTeam(true)} className="text-[10px] text-gray-500 hover:text-primary border border-white/10 rounded px-1.5 py-0.5 transition">Edit</button>
                    </div>
                  )}
                </div>
                {/* Editable: Display As */}
                <div>
                  <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">Display As</p>
                  {editingPref ? (
                    <div className="flex items-center gap-1.5">
                      <select value={prefDraft} onChange={e => setPrefDraft(e.target.value)}
                        className="bg-black/40 border border-white/15 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary/50">
                        <option value="address">address</option>
                        <option value="name">name</option>
                        <option value="username">username</option>
                      </select>
                      <button onClick={savePref} disabled={editSaving} className="text-xs bg-primary text-black px-2 py-1 rounded font-bold disabled:opacity-50">Save</button>
                      <button onClick={() => { setEditingPref(false); setPrefDraft(u.display_preference) }} className="text-xs bg-white/10 text-gray-400 px-2 py-1 rounded">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-gray-200">{u.display_preference}</span>
                      <button onClick={() => setEditingPref(true)} className="text-[10px] text-gray-500 hover:text-primary border border-white/10 rounded px-1.5 py-0.5 transition">Edit</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bonus Balls */}
        <div className="bg-[#111827] border border-white/8 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">Bonus Balls 🏈</p>
            <p className="text-3xl font-bold text-primary mt-1">{bonusBalls}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Admin-granted + wheel prize wins</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={revokeBonusBall} disabled={grantingBall || bonusBalls <= 0}
              className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-30 text-lg font-bold transition flex items-center justify-center">−</button>
            <button onClick={grantBonusBall} disabled={grantingBall}
              className="px-4 py-2 rounded-lg bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 disabled:opacity-50 text-sm font-semibold transition">
              {grantingBall ? 'Saving…' : '+1 Ball'}
            </button>
          </div>
        </div>

        {/* Bonus Spins */}
        <div className="bg-[#111827] border border-white/8 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">Bonus Spins 🎰</p>
              <p className="text-3xl font-bold text-purple-400 mt-1">{bonusSpins}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Remaining — auto-decrements when used</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => adjustBonusSpin(-1)} disabled={grantingSpin || bonusSpins <= 0}
                className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 disabled:opacity-30 text-lg font-bold transition flex items-center justify-center">
                −
              </button>
              <button onClick={() => adjustBonusSpin(1)} disabled={grantingSpin}
                className="w-9 h-9 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25 disabled:opacity-50 text-lg font-bold transition flex items-center justify-center">
                +
              </button>
            </div>
          </div>
          {/* Set custom amount */}
          <div className="flex items-center gap-2 pt-1 border-t border-white/5">
            <span className="text-[11px] text-gray-600">Set to:</span>
            {[5, 10, 25, 50].map(n => (
              <button key={n} onClick={() => setBonusSpinDirect(n)} disabled={grantingSpin}
                className="text-xs px-2.5 py-1 rounded-lg bg-white/5 text-gray-400 hover:bg-purple-500/15 hover:text-purple-400 disabled:opacity-40 font-semibold transition">
                {n}
              </button>
            ))}
            <button onClick={() => setBonusSpinDirect(0)} disabled={grantingSpin || bonusSpins === 0}
              className="text-xs px-2.5 py-1 rounded-lg bg-white/5 text-gray-500 hover:bg-red-500/15 hover:text-red-400 disabled:opacity-30 font-semibold transition ml-auto">
              Reset to 0
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatTile label="Wallets"       value={u.wallets.length}      accent="text-blue-400" />
          <StatTile label={PRIMARY_CUSTOM_ASSET_CODE} value={num(totalTokenBal)} accent="text-yellow-400" />
          <StatTile label="XLM"           value={num(totalXLM)}         accent="text-gray-300" />
          <StatTile label="Game Sessions" value={userSessions.length}   accent="text-purple-400" sub={`${totalKicks.toLocaleString()} kicks`} />
          <StatTile label="Donations"     value={userDonations.length}  accent="text-green-400" />
          <StatTile label="Purchases"     value={userPurchases.length}  accent="text-orange-400" />
        </div>

        {/* Activity Timeline */}
        <ActivityTimeline u={u} userSessions={userSessions} userDonations={userDonations} userPurchases={userPurchases} userAccess={userAccess} />

        {/* Wallets */}
        <section>
          <SectionTitle icon="account_balance_wallet" title="Connected Wallets" count={u.wallets.length} />
          <div className="flex justify-end items-center gap-2 mb-2">
            {refreshToast && <span className={`text-xs font-semibold ${refreshToast.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{refreshToast}</span>}
            <button onClick={refreshBalance} disabled={refreshing || u.wallets.length === 0}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-40 transition"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              <Icon name="sync" className={`text-sm ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : 'Refresh Balance'}
            </button>
          </div>
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
                      <CopyAddressRow address={w.stellar_address} />
                      {b ? (
                        <>
                          <div className="grid grid-cols-3 gap-3 mb-2">
                            <div className="bg-black/20 rounded-lg p-3">
                              <p className="text-[10px] text-gray-500 uppercase font-medium">{PRIMARY_CUSTOM_ASSET_CODE}</p>
                              <p className="text-lg font-bold text-yellow-400 mt-0.5">{num(b.primary_asset_balance)}</p>
                              <p className="text-[10px] font-semibold mt-0.5" style={{ color: getTierForBalance(Number(b.primary_asset_balance)).color }}>
                                {getTierForBalance(Number(b.primary_asset_balance)).label}
                              </p>
                            </div>
                            <div className="bg-black/20 rounded-lg p-3">
                              <p className="text-[10px] text-gray-500 uppercase font-medium">XLM</p>
                              <p className="text-lg font-bold text-gray-300 mt-0.5">{num(b.xlm_balance)}</p>
                              {b.last_synced_at && <p className="text-[10px] text-gray-600 mt-0.5">synced {ago(b.last_synced_at)}</p>}
                            </div>
                            <div className="bg-black/20 rounded-lg p-3">
                              <p className="text-[10px] text-gray-500 uppercase font-medium">Week Ago</p>
                              <p className="text-lg font-bold text-gray-400 mt-0.5">{num(b.balance_week_ago)}</p>
                              {b.last_synced_at && (Date.now() - new Date(b.last_synced_at).getTime()) > 24 * 60 * 60 * 1000 && <Badge color="yellow">Stale</Badge>}
                            </div>
                          </div>
                          {b.last_synced_at && <p className="text-[10px] text-gray-600">Balances from sync — may not reflect live Horizon state</p>}
                        </>
                      ) : (
                        <p className="text-[11px] text-gray-600 mb-4">No balance synced yet</p>
                      )}
                    </div>
                  )
                })}
              </div>
          }
        </section>

        {/* Game Sessions */}
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

        {/* Donations */}
        <section>
          <SectionTitle icon="volunteer_activism" title="Donations" count={userDonations.length} />
          {userDonations.length === 0
            ? <p className="text-gray-600 text-sm">No donations yet.</p>
            : <Card><div className="overflow-x-auto"><table className="w-full">
                <thead className="bg-white/3"><tr><Th>Amount</Th><Th>Asset</Th><Th>Type</Th><Th>Target</Th><Th>TX Hash</Th><Th>Verified</Th><Th>When</Th></tr></thead>
                <tbody className="divide-y divide-white/4">
                  {userDonations.map(d => (
                    <tr key={d.id} className="hover:bg-white/3">
                      <Td><span className="font-bold text-yellow-400">{num(d.amount)}</span></Td>
                      <Td><span className="text-gray-300">{d.asset_code}</span></Td>
                      <Td><DonationTypeBadge type={d.donation_type} /></Td>
                      <Td>{d.donation_target ? <span className="font-bold text-primary text-sm">{d.donation_target}</span> : <span className="text-gray-500 text-sm italic">General</span>}</Td>
                      <Td mono><span className="text-xs text-gray-500">{d.stellar_tx_hash ? `${d.stellar_tx_hash.slice(0, 20)}…` : '—'}</span></Td>
                      <Td><Badge color={d.verified ? 'green' : 'yellow'}>{d.verified ? 'Verified' : 'Pending'}</Badge></Td>
                      <Td><span className="text-gray-500 text-xs">{dt(d.created_at)}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table></div></Card>
          }
        </section>

        {/* Purchases */}
        <section>
          <SectionTitle icon="shopping_cart" title="Purchases" count={userPurchases.length} />
          {userPurchases.length === 0
            ? <p className="text-gray-600 text-sm">No purchases yet.</p>
            : <Card><div className="overflow-x-auto"><table className="w-full">
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
              </table></div></Card>
          }
        </section>

        {/* Access Log */}
        <section>
          <SectionTitle icon="manage_search" title="Access & Activity Log" count={userAccess.length} />
          {userAccess.length === 0
            ? <p className="text-gray-600 text-sm">No access events logged for this user.</p>
            : <Card><div className="overflow-x-auto"><table className="w-full">
                <thead className="bg-white/3"><tr><Th>IP / Location</Th><Th>Event</Th><Th>Device / Browser</Th><Th>Screen</Th><Th>Timezone</Th><Th>Language</Th><Th>URL</Th><Th>When</Th><Th /></tr></thead>
                <tbody className="divide-y divide-white/4">
                  {userAccess.map(a => (
                    <tr key={a.id} className={`${a.devtools_opened || a.tg_sdk_fake ? 'bg-red-500/5' : 'hover:bg-white/3'}`}>
                      <Td mono>
                        <span className="text-gray-300">{a.ip ?? '—'}</span>
                        {a.geo_location && <span className="block text-[11px] text-gray-500 font-sans">({a.geo_location})</span>}
                      </Td>
                      <Td>{a.devtools_opened ? <Badge color="red">DevTools Opened</Badge> : a.tg_sdk_fake ? <Badge color="red">Fake SDK</Badge> : <Badge color="gray">App Open</Badge>}</Td>
                      <Td><span className="text-gray-500 text-xs max-w-[160px] block truncate">{a.user_agent ?? '—'}</span></Td>
                      <Td><span className="text-gray-400 text-xs whitespace-nowrap">{a.screen ?? '—'}</span></Td>
                      <Td><span className="text-gray-400 text-xs whitespace-nowrap">{a.timezone ?? '—'}</span></Td>
                      <Td><span className="text-gray-400 text-xs">{a.language ?? '—'}</span></Td>
                      <Td mono><span className="text-xs text-gray-600 max-w-[120px] block truncate">{a.url ?? '—'}</span></Td>
                      <Td><span className="text-gray-500 text-xs whitespace-nowrap">{dt(a.created_at)}</span></Td>
                      <Td>
                        <button onClick={() => onDeleteAccess(a.id)} disabled={deletingAccessId === a.id}
                          className="text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2 py-0.5 rounded transition disabled:opacity-40">
                          {deletingAccessId === a.id ? '…' : 'Delete'}
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table></div></Card>
          }
        </section>

      </div>
    </div>
  )
}

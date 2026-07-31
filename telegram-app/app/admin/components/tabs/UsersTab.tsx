'use client'
import { Badge, Card, Th, Td, Icon } from '../ui'
import { ago, num, teamName, shortAddr } from '../../utils'
import type { AdminData, User, ConfirmAction, WalletRef } from '../../types'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'
import { ALL_CLUBS } from '@/config/afl'

interface Props {
  data: AdminData
  search: string
  setSearch: (v: string) => void
  userStatusFilter: 'all' | 'active' | 'blocked'
  setUserStatusFilter: (v: 'all' | 'active' | 'blocked') => void
  userTeamFilter: string
  setUserTeamFilter: (v: string) => void
  confirmAction: ConfirmAction
  setConfirmAction: (v: ConfirmAction) => void
  setUserAction: (v: { telegramId: number; name: string; type: 'logout' | 'delete' | 'block' | 'unblock' }) => void
  refreshingRows: Set<number>
  onRefreshRow: (telegramId: number) => void
  onSelectUser: (u: User) => void
}

export function UsersTab({
  data, search, setSearch,
  userStatusFilter, setUserStatusFilter,
  userTeamFilter, setUserTeamFilter,
  confirmAction, setConfirmAction, setUserAction,
  refreshingRows, onRefreshRow, onSelectUser,
}: Props) {
  const uniqueTeams = Array.from(new Set(
    data.users.map(u => u.favorite_team).filter((t): t is string => !!t)
  ))

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

  return (
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
                  <tr key={u.telegram_id} onClick={() => onSelectUser(u)} className="hover:bg-white/5 cursor-pointer transition">
                    <Td>
                      <div>
                        <span className="font-medium text-white">{u.telegram_first_name ?? '—'}</span>
                        <span className="block text-[10px] text-gray-600 font-mono">{u.telegram_id}</span>
                      </div>
                    </Td>
                    <Td>{u.telegram_username ? <span className="text-[#D4AF37]">@{u.telegram_username}</span> : <span className="text-gray-600">—</span>}</Td>
                    <Td><Badge color={u.is_blocked ? 'red' : 'green'}>{u.is_blocked ? 'Blocked' : 'Active'}</Badge></Td>
                    <Td><span className="text-gray-300 text-xs">{teamName(u.favorite_team)}</span></Td>
                    <Td mono>{addrShort ? <span className="text-gray-400">{addrShort}</span> : <span className="text-gray-600">—</span>}</Td>
                    <Td>{bal ? <span className="font-semibold text-yellow-400">{num(bal.nsafl_balance)}</span> : <span className="text-gray-600 text-xs">—</span>}</Td>
                    <Td>{bal ? <span className="text-gray-400">{num(bal.xlm_balance)}</span> : <span className="text-gray-600 text-xs">—</span>}</Td>
                    <Td><span className="text-gray-500 text-xs">{ago(u.created_at)}</span></Td>
                    <Td>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        {primaryWallet && (
                          <button
                            onClick={() => onRefreshRow(u.telegram_id)}
                            disabled={refreshingRows.has(u.telegram_id)}
                            title="Refresh balance"
                            className="text-xs bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 px-2 py-0.5 rounded font-semibold transition disabled:opacity-40"
                          >
                            <Icon name="sync" className={`text-sm ${refreshingRows.has(u.telegram_id) ? 'animate-spin' : ''}`} />
                          </button>
                        )}
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
                        {confirmAction?.type === 'logout' && confirmAction.telegramId === u.telegram_id ? (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <span className="text-gray-400">Sure?</span>
                            <button onClick={() => { setConfirmAction(null); setUserAction({ telegramId: u.telegram_id, name: u.telegram_first_name ?? String(u.telegram_id), type: 'logout' }) }} className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-semibold">Yes</button>
                            <button onClick={() => setConfirmAction(null)} className="px-2 py-0.5 rounded bg-white/10 text-gray-400 hover:bg-white/20 font-semibold">No</button>
                          </span>
                        ) : (
                          <button onClick={() => setConfirmAction({ type: 'logout', telegramId: u.telegram_id })} className="text-xs bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 px-2 py-0.5 rounded font-semibold transition">Logout</button>
                        )}
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
  )
}

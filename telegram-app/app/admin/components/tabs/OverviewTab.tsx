'use client'
import { Card, Th, Td, Icon } from '../ui'
import { ago, num, teamName } from '../../utils'
import type { AdminData, User } from '../../types'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'

interface Props {
  data: AdminData
  totalUsers: number
  totalWallets: number
  totalTokenHeld: number
  totalXlmHeld: number
  totalKicks: number
  suspiciousAccess: number
  winStats: { total: number; pending: number }
  onSelectUser: (u: User) => void
  onTabChange: (tab: import('../../types').Tab) => void
}

export function OverviewTab({
  data, totalUsers, totalWallets, totalTokenHeld, totalXlmHeld,
  totalKicks, suspiciousAccess, winStats, onSelectUser, onTabChange,
}: Props) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Users',       value: totalUsers,                    accent: 'text-blue-400',   bg: 'bg-blue-500/8'   },
          { label: 'Wallets',           value: totalWallets,                  accent: 'text-cyan-400',   bg: 'bg-cyan-500/8'   },
          { label: `${PRIMARY_CUSTOM_ASSET_CODE} Held`, value: num(totalTokenHeld), accent: 'text-yellow-400', bg: 'bg-yellow-500/8' },
          { label: 'XLM Held',          value: num(totalXlmHeld),             accent: 'text-blue-300',  bg: 'bg-blue-500/8'   },
          { label: 'Total Kicks',       value: totalKicks.toLocaleString(),   accent: 'text-purple-400', bg: 'bg-purple-500/8' },
          { label: 'Suspicious Access', value: suspiciousAccess,              accent: suspiciousAccess > 0 ? 'text-red-400' : 'text-gray-400', bg: suspiciousAccess > 0 ? 'bg-red-500/8' : 'bg-white/4' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 border border-white/6 ${s.bg}`}>
            <p className="text-[11px] text-gray-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.accent}`}>{s.value}</p>
          </div>
        ))}
        <button onClick={() => onTabChange('referrals')} className="rounded-xl p-4 border border-white/6 bg-green-500/8 text-left hover:bg-green-500/12 transition">
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
            <p className="text-lg font-bold text-[#D4AF37] leading-tight">
              {winStats.total} <span className="text-sm font-normal text-gray-400">total wins</span>
            </p>
            {winStats.pending > 0
              ? <p className="text-[11px] text-orange-400 font-medium">{winStats.pending} pending payout</p>
              : <p className="text-[11px] text-gray-600">No pending payouts</p>
            }
          </div>
        </div>
        <a
          href="/admin/wins"
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
                <tr key={u.telegram_id} className="hover:bg-white/3 cursor-pointer" onClick={() => onSelectUser(u)}>
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
      </div>
    </div>
  )
}

'use client'
import { Icon } from './ui'
import { num } from '../utils'
import type { AdminData } from '../types'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'

export function SummaryStrip({ data }: { data: AdminData }) {
  const totalUsers    = data.users.length
  const totalWallets  = data.users.reduce((s, u) => s + u.wallets.length, 0)
  const totalNsafl    = data.totalNsafl ?? data.users.reduce((s, u) =>
    s + u.wallets.reduce((ws, w) => ws + Number(w.wallet_balances[0]?.nsafl_balance ?? 0), 0), 0)
  const totalDonations    = data.donations.length
  const totalGameSessions = data.gameSessions.length
  const suspiciousAccess  = data.accessAttempts.filter(a => a.tg_sdk_fake || a.devtools_opened).length

  const tiles = [
    { label: 'Users',       value: totalUsers,                              accent: 'text-blue-400',   icon: 'group' },
    { label: 'Wallets',     value: totalWallets,                            accent: 'text-cyan-400',   icon: 'account_balance_wallet' },
    { label: PRIMARY_CUSTOM_ASSET_CODE, value: num(totalNsafl),             accent: 'text-[#D4AF37]',  icon: 'token' },
    { label: 'Donations',   value: totalDonations,                          accent: 'text-green-400',  icon: 'volunteer_activism' },
    { label: 'Game Sess.',  value: totalGameSessions,                       accent: 'text-purple-400', icon: 'sports_esports' },
    { label: 'Suspicious',  value: suspiciousAccess,                        accent: suspiciousAccess > 0 ? 'text-red-400' : 'text-gray-500', icon: 'warning' },
  ]

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 px-6 pt-4">
      {tiles.map(s => (
        <div key={s.label} className="flex-none min-w-[140px] bg-white/3 border border-white/8 rounded-xl p-3 backdrop-blur-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
            <Icon name={s.icon} className={`text-base ${s.accent}`} />
          </div>
          <div>
            <p className={`text-xl font-bold leading-tight ${s.accent}`}>{s.value}</p>
            <p className="text-[10px] text-gray-500 font-medium leading-tight">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

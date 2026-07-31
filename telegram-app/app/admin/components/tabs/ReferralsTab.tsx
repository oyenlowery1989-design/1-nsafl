'use client'
import { Card, Th, Td, StatTile, SectionTitle } from '../ui'
import { ago } from '../../utils'
import type { AdminData, User } from '../../types'

interface Props {
  data: AdminData
  onSelectUser: (u: User) => void
}

export function ReferralsTab({ data, onSelectUser }: Props) {
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
        <StatTile
          label="Top Referrer"
          value={topReferrer ? (topReferrer.referrer_name ?? `#${topReferrer.referrer_id}`) : '—'}
          accent="text-[#D4AF37]"
          sub={topReferrer ? `${topReferrer.referral_count} referrals${topReferrer.referrer_username ? ` · @${topReferrer.referrer_username}` : ''}` : 'No referrals yet'}
        />
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
                    <tr key={s.referrer_id} className="hover:bg-white/5 cursor-pointer transition" onClick={() => uInData && onSelectUser(uInData)}>
                      <Td><span className="flex items-center gap-1.5">{medal && <span className="text-base leading-none">{medal}</span>}<span className={`font-bold text-sm ${i < 3 ? 'text-[#D4AF37]' : 'text-gray-500'}`}>#{i + 1}</span></span></Td>
                      <Td><span className="font-medium text-white">{s.referrer_name ?? '—'}</span></Td>
                      <Td>{s.referrer_username ? <span className="text-[#D4AF37]">@{s.referrer_username}</span> : <span className="text-gray-600">—</span>}</Td>
                      <Td mono><span className="text-gray-400 text-xs">{s.referrer_id}</span></Td>
                      <Td><span className="font-bold text-green-400 text-base">{s.referral_count}</span></Td>
                      <Td><span className="text-gray-500 text-xs">{ago(s.last_referral_at)}</span></Td>
                      <Td>{uInData ? <button onClick={e => { e.stopPropagation(); onSelectUser(uInData) }} className="text-xs bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 px-2 py-0.5 rounded font-semibold transition">View User</button> : <span className="text-gray-600 text-xs">—</span>}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table></div></Card>
        }
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
                        ? <button onClick={() => onSelectUser(referrer)} className="text-left hover:text-[#D4AF37] transition">
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
            </table></div></Card>
        }
      </section>
    </div>
  )
}

'use client'
import { useEffect, useState, Suspense } from 'react'
import { useAdminToken } from '../hooks/useAdminToken'
import { Badge, Card, Th, Td, StatTile, SectionTitle, Icon } from '../components/ui'
import { ago, num } from '../utils'
import type { AdminData, ReferralStat, ReferredUser } from '../types'

function ReferralsPageInner() {
  const token = useAdminToken()
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (token === null || token === '') return
    fetch('/api/admin', { headers: { 'x-admin-token': token } })
      .then(r => r.json())
      .then(res => {
        if (!res.success) throw new Error(res.error ?? 'Failed to load')
        setData(res.data)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin h-8 w-8 border-2 border-[#D4AF37] border-t-transparent rounded-full" /></div>
  if (error) return <div className="text-red-400 text-center py-20">{error}</div>
  if (!data) return null

  const stats = data.referralStats ?? []
  const referred = data.referredUsers ?? []
  const totalReferrers = stats.length
  const totalReferred = referred.length
  const topReferrer = stats[0] ?? null
  const pct = data.users.length > 0 ? Math.round((totalReferred / data.users.length) * 100) : 0

  return (
    <div className="space-y-6 p-4 sm:p-6 min-h-screen bg-[#0a0f1e]">
      <div className="flex items-center gap-2 mb-2">
        <Icon name="group_add" className="text-xl text-[#D4AF37]" />
        <h1 className="text-lg font-bold text-white">Referrals</h1>
      </div>

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

      {/* Top Referrers */}
      <section>
        <SectionTitle icon="leaderboard" title="Top Referrers" count={totalReferrers} />
        {totalReferrers === 0
          ? <p className="text-gray-600 text-sm py-8 text-center">No referrals recorded yet.</p>
          : <Card><div className="overflow-x-auto"><table className="w-full">
              <thead className="bg-white/3"><tr>
                <Th>Name</Th><Th>@Username</Th><Th>Referral Count</Th><Th>Last Referral</Th>
              </tr></thead>
              <tbody className="divide-y divide-white/4">
                {stats.map((s, i) => {
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
                  return (
                    <tr key={s.referrer_id} className="hover:bg-white/3">
                      <Td>
                        <span className="flex items-center gap-1.5">
                          {medal && <span className="text-base leading-none">{medal}</span>}
                          <span className="font-medium text-white">{s.referrer_name ?? '—'}</span>
                        </span>
                        <span className="block text-[10px] text-gray-600 font-mono">#{s.referrer_id}</span>
                      </Td>
                      <Td>{s.referrer_username ? <span className="text-[#D4AF37]">@{s.referrer_username}</span> : <span className="text-gray-600">—</span>}</Td>
                      <Td><span className="font-bold text-green-400 text-base">{s.referral_count}</span></Td>
                      <Td><span className="text-gray-500 text-xs">{ago(s.last_referral_at)}</span></Td>
                    </tr>
                  )
                })}
              </tbody>
            </table></div></Card>
        }
      </section>

      {/* Referred Users */}
      <section>
        <SectionTitle icon="person_add" title="Referred Users" count={totalReferred} />
        {totalReferred === 0
          ? <p className="text-gray-600 text-sm py-8 text-center">No users have been referred yet.</p>
          : <Card><div className="overflow-x-auto"><table className="w-full">
              <thead className="bg-white/3"><tr>
                <Th>Name</Th><Th>@Username</Th><Th>Referred By</Th><Th>Joined</Th>
              </tr></thead>
              <tbody className="divide-y divide-white/4">
                {referred.map(r => (
                  <tr key={r.telegram_id} className="hover:bg-white/3">
                    <Td>
                      <span className="font-medium text-white">{r.telegram_first_name ?? '—'}</span>
                      <span className="block text-[10px] text-gray-600 font-mono">#{r.telegram_id}</span>
                    </Td>
                    <Td>{r.telegram_username ? <span className="text-[#D4AF37]">@{r.telegram_username}</span> : <span className="text-gray-600">—</span>}</Td>
                    <Td><span className="text-gray-500 font-mono text-xs">#{r.referred_by}</span></Td>
                    <Td><span className="text-gray-500 text-xs">{ago(r.created_at)}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table></div></Card>
        }
      </section>
    </div>
  )
}

export default function ReferralsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh] bg-[#0a0f1e]"><div className="animate-spin h-8 w-8 border-2 border-[#D4AF37] border-t-transparent rounded-full" /></div>}>
      <ReferralsPageInner />
    </Suspense>
  )
}

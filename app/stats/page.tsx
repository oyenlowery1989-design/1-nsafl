'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTelegramBack } from '@/hooks/useTelegramBack'
import BottomNav from '@/components/BottomNav'
import WalletGuard from '@/components/WalletGuard'
import PageLoader, { useMinLoader } from '@/components/PageLoader'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'
import { AFL_CLUBS } from '@/config/afl'

interface DonorEntry {
  rank: number
  name: string
  hub: string
  amount: string
  amountRaw: number
  causes?: string[]
}

interface DonationsData {
  topDonors: DonorEntry[]
  totalDonated: string
  totalDonatedRaw: number
  donationCount: number
}

interface StatsData {
  totalFunding: string
  totalFundingRaw: number
  weeklyChange: string
  chartData: number[]
  target: string
  topSupporters: { rank: number; name: string; hub: string; amount: string }[]
  walletCount: number
  activeWallets: number
  totalUsers: number
  totalXlm: string
  tokenStats: {
    totalSupply: string
    circulatingSupply: string
    holderCount: number
    issuerXlmReserve: string
  }
  tierDistribution: {
    preTier: number
    tier1_4: number
    tier5_8: number
    tier9_12: number
  }
  teamDistribution?: Record<string, number>
}

interface GameStatsData {
  totalSessions: number
  totalKicks: number
  highScore: number
  uniquePlayers: number
  leaderboard: { rank: number; name: string; kicks: number }[]
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May']

function MiniStat({ icon, label, value, color = 'text-white' }: { icon: string; label: string; value: string | number; color?: string }) {
  return (
    <div className="glass-card p-3 rounded-xl text-center">
      <span className="material-symbols-outlined text-[#D4AF37] text-lg">{icon}</span>
      <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
      <p className="text-[9px] text-gray-400 uppercase tracking-wide">{label}</p>
    </div>
  )
}

function DistributionBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-300">{label}</span>
        <span className="text-white font-semibold">{count} <span className="text-gray-500">({pct}%)</span></span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function StatsPage() {
  const router = useRouter()
  useTelegramBack(() => router.back())
  const [data, setData] = useState<StatsData | null>(null)
  const [donationsData, setDonationsData] = useState<DonationsData | null>(null)
  const [gameStats, setGameStats] = useState<GameStatsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const showContent = useMinLoader(!!data)

  useEffect(() => {
    // Fetch stats and donations in parallel — failures are independent
    Promise.allSettled([
      fetch('/api/stats/funding').then((r) => r.json()),
      fetch('/api/donations').then((r) => r.json()),
      fetch('/api/game').then((r) => r.json()),
    ]).then(([statsResult, donationsResult, gameResult]) => {
      if (statsResult.status === 'fulfilled' && statsResult.value.success)
        setData(statsResult.value.data)
      else
        setError('Failed to load stats')

      if (donationsResult.status === 'fulfilled' && donationsResult.value.success)
        setDonationsData(donationsResult.value.data)

      if (gameResult.status === 'fulfilled' && gameResult.value.success)
        setGameStats(gameResult.value.data)
    })
  }, [])

  return (
    <WalletGuard>
      <header className="pt-3 pb-2 px-4 sticky top-0 z-10 bg-[#0A0E1A] border-b border-white/10">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Movement Stats</h1>
          <p className="text-xs text-[#D4AF37] font-medium">Global Homecoming Progress</p>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 pb-28">
        {error && (
          <div className="glass-card rounded-xl p-4 flex items-center space-x-3 border border-red-500/30">
            <span className="material-symbols-outlined text-red-400">error</span>
            <p className="text-red-300 text-sm font-medium">{error}</p>
          </div>
        )}

        {!showContent && !error && <PageLoader label="Loading stats…" />}

        {showContent && data && (
          <>
            {/* ── Total Funding + Chart ──────────────────────────────── */}
            <div className="glass-card p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total Funding</p>
                  <div className="text-2xl font-bold text-white mt-0.5">
                    {data.totalFunding} <span className="text-[#D4AF37] text-base">{PRIMARY_CUSTOM_ASSET_LABEL}</span>
                  </div>
                </div>
                <div className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-semibold ${
                  data.weeklyChange.startsWith('-')
                    ? 'text-red-400 bg-red-500/10'
                    : 'text-green-400 bg-green-500/10'
                }`}>
                  <span className="material-symbols-outlined text-[13px]">
                    {data.weeklyChange.startsWith('-') ? 'trending_down' : 'trending_up'}
                  </span>
                  <span>{data.weeklyChange}</span>
                </div>
              </div>

              {/* Bar chart */}
              <div className="flex items-end justify-between h-24 space-x-1.5 pt-4">
                {data.chartData.map((pct, i) => {
                  const isLast = i === data.chartData.length - 1
                  const isPrev = i === data.chartData.length - 2
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div
                        className={`w-full rounded-t transition-all ${
                          isLast
                            ? 'bg-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.4)]'
                            : isPrev
                            ? 'bg-[#D4AF37]/50'
                            : 'bg-white/10'
                        }`}
                        style={{ height: `${pct}%`, minHeight: 4 }}
                      />
                      <span className={`text-[9px] mt-1 ${isLast ? 'text-[#D4AF37] font-bold' : 'text-gray-500'}`}>
                        {MONTH_LABELS[i]}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-[9px] text-gray-500 uppercase">
                <span>5 Month Trend</span>
                <span>Target: {data.target}</span>
              </div>
            </div>

            {/* ── Community Stats ─────────────────────────────────────── */}
            <section>
              <div className="flex items-center space-x-1.5 mb-2">
                <span className="material-symbols-outlined text-[#D4AF37] text-base">groups</span>
                <h3 className="text-sm font-bold text-white">Community</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <MiniStat icon="person" label="Users" value={data.totalUsers} />
                <MiniStat icon="account_balance_wallet" label="Wallets" value={data.tokenStats?.holderCount ?? 0} color="text-[#D4AF37]" />
                <MiniStat icon="verified" label="Active" value={data.activeWallets} color="text-green-400" />
              </div>
            </section>

            {/* ── Holder Distribution ──────────────────────────────────── */}
            {data.walletCount > 0 && (
              <section>
                <div className="flex items-center space-x-1.5 mb-2">
                  <span className="material-symbols-outlined text-[#D4AF37] text-base">pie_chart</span>
                  <h3 className="text-sm font-bold text-white">Holder Distribution</h3>
                </div>
                <div className="glass-card p-4 rounded-xl space-y-3">
                  <DistributionBar label="Pre-Tier (< 100)" count={data.tierDistribution.preTier} total={data.walletCount} color="bg-gray-500" />
                  <DistributionBar label="Tier 1–4 (100 – 5k)" count={data.tierDistribution.tier1_4} total={data.walletCount} color="bg-orange-500" />
                  <DistributionBar label="Tier 5–8 (5k – 100k)" count={data.tierDistribution.tier5_8} total={data.walletCount} color="bg-purple-500" />
                  <DistributionBar label="Tier 9–12 (100k+)" count={data.tierDistribution.tier9_12} total={data.walletCount} color="bg-emerald-500" />
                </div>
              </section>
            )}

            {/* ── Team Allegiance ──────────────────────────────────── */}
            {data.teamDistribution && Object.keys(data.teamDistribution).length > 0 && (() => {
              const entries = Object.entries(data.teamDistribution)
                .map(([teamId, count]) => {
                  const club = AFL_CLUBS.find((c) => c.id === teamId)
                  return { teamId, count, club }
                })
                .filter((e) => e.club)
                .sort((a, b) => b.count - a.count)
              const totalFans = entries.reduce((sum, e) => sum + e.count, 0)

              return (
                <section>
                  <div className="flex items-center space-x-1.5 mb-2">
                    <span className="material-symbols-outlined text-[#D4AF37] text-base">shield</span>
                    <h3 className="text-sm font-bold text-white">Team Allegiance</h3>
                    <span className="text-[10px] text-gray-500 ml-auto">{totalFans} members</span>
                  </div>
                  <div className="glass-card p-4 rounded-xl space-y-2">
                    {entries.slice(0, 8).map(({ teamId, count, club }) => {
                      const pct = totalFans > 0 ? Math.round((count / totalFans) * 100) : 0
                      return (
                        <div key={teamId} className="flex items-center space-x-2">
                          <img src={club!.logo} alt={club!.shortName} width={22} height={22} className="object-contain flex-shrink-0" />
                          <span className="text-[11px] text-gray-300 w-24 truncate">{club!.name}</span>
                          <div className="flex-1 bg-white/5 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all duration-700"
                              style={{ width: `${Math.max(pct, 3)}%`, background: club!.color }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-white w-6 text-right">{count}</span>
                        </div>
                      )
                    })}
                    {entries.length > 8 && (
                      <p className="text-[9px] text-gray-500 text-center mt-1">
                        +{entries.length - 8} more teams
                      </p>
                    )}
                  </div>
                </section>
              )
            })()}

            {/* ── AFL Snapshot ──────────────────────────────────────── */}
            <section>
              <div className="flex items-center space-x-1.5 mb-2">
                <span className="material-symbols-outlined text-[#D4AF37] text-base">sports_football</span>
                <h3 className="text-sm font-bold text-white">AFL Round 1 Results</h3>
              </div>
              <div className="glass-card rounded-xl overflow-hidden divide-y divide-white/5">
                {[
                  { home: 'SYD', homeId: 'sydney',           away: 'CAR', awayId: 'carlton',           hs: 132, as: 69 },
                  { home: 'GCS', homeId: 'gold-coast',       away: 'GEE', awayId: 'geelong',           hs: 125, as: 69 },
                  { home: 'GWS', homeId: 'gws',              away: 'HAW', awayId: 'hawthorn',          hs: 122, as: 95 },
                  { home: 'BRL', homeId: 'brisbane',         away: 'WBD', awayId: 'western-bulldogs',  hs: 106, as: 111 },
                  { home: 'STK', homeId: 'st-kilda',         away: 'COL', awayId: 'collingwood',       hs: 66,  as: 78 },
                ].map((m) => {
                  const homeWon = m.hs > m.as
                  const homeLogo = AFL_CLUBS.find((c) => c.id === m.homeId)?.logo
                  const awayLogo = AFL_CLUBS.find((c) => c.id === m.awayId)?.logo
                  return (
                    <div key={m.home} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center space-x-2 w-24">
                        {homeLogo ? (
                          <img src={homeLogo} alt={m.home} width={20} height={20} className="object-contain flex-shrink-0" loading="lazy" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-white/10 flex-shrink-0" />
                        )}
                        <span className={`text-xs font-bold ${homeWon ? 'text-white' : 'text-gray-500'}`}>{m.home}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs font-mono">
                        <span className={homeWon ? 'text-white font-bold' : 'text-gray-500'}>{m.hs}</span>
                        <span className="text-gray-600">–</span>
                        <span className={!homeWon ? 'text-white font-bold' : 'text-gray-500'}>{m.as}</span>
                      </div>
                      <div className="flex items-center justify-end space-x-2 w-24">
                        <span className={`text-xs font-bold ${!homeWon ? 'text-white' : 'text-gray-500'}`}>{m.away}</span>
                        {awayLogo ? (
                          <img src={awayLogo} alt={m.away} width={20} height={20} className="object-contain flex-shrink-0" loading="lazy" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-white/10 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* ── Top Holders ────────────────────────────────────── */}
            <section>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-1.5">
                  <span className="material-symbols-outlined text-[#D4AF37] text-base">emoji_events</span>
                  <h3 className="text-sm font-bold text-white">Top Holders</h3>
                </div>
              </div>
              <div className="space-y-2">
                {data.topSupporters.map((s) => (
                  <div key={s.rank} className="glass-card p-3 rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border ${
                        s.rank === 1
                          ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30'
                          : s.rank === 2
                          ? 'bg-white/10 text-gray-300 border-white/20'
                          : 'bg-white/5 text-gray-400 border-white/10'
                      }`}>
                        {s.rank}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white text-xs">{s.name}</h4>
                        <p className="text-[9px] text-gray-500 font-mono">{s.hub}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold text-xs ${s.rank === 1 ? 'text-[#D4AF37]' : 'text-white'}`}>
                        {s.amount}
                      </span>
                      <p className="text-[9px] text-gray-500">{PRIMARY_CUSTOM_ASSET_LABEL}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Top Supporters (Donors) ──────────────────────────── */}
            {donationsData && donationsData.topDonors.length > 0 && (
              <section>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="material-symbols-outlined text-[#D4AF37] text-base">volunteer_activism</span>
                    <h3 className="text-sm font-bold text-white">Top Supporters</h3>
                  </div>
                  <div className="flex items-center space-x-1 text-[10px] text-gray-400">
                    <span>{donationsData.totalDonated} {PRIMARY_CUSTOM_ASSET_LABEL} total</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {donationsData.topDonors.map((d) => (
                    <div key={d.rank} className="glass-card p-3 rounded-xl flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border ${
                          d.rank === 1
                            ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30'
                            : d.rank === 2
                            ? 'bg-white/10 text-gray-300 border-white/20'
                            : 'bg-white/5 text-gray-400 border-white/10'
                        }`}>
                          {d.rank}
                        </div>
                        <div>
                          <h4 className="font-semibold text-white text-xs">{d.name}</h4>
                          {d.causes && d.causes.length > 0 ? (
                            <div className="flex items-center flex-wrap gap-1 mt-0.5">
                              {d.causes.map((cause, i) => {
                                const teamMatch = cause.match(/^Team:\s*(.+)$/i)
                                const teamClub = teamMatch ? AFL_CLUBS.find((c) => c.id === teamMatch[1]) : null
                                return (
                                  <span key={i} className="inline-flex items-center space-x-1 text-[9px] text-[#D4AF37]/70">
                                    {teamClub && <img src={teamClub.logo} alt="" width={12} height={12} className="object-contain" />}
                                    <span>{teamClub ? teamClub.shortName : cause}</span>
                                    {i < d.causes!.length - 1 && <span className="text-gray-600 ml-0.5">·</span>}
                                  </span>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="text-[9px] text-gray-500 font-mono">{d.hub}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`font-bold text-xs ${d.rank === 1 ? 'text-[#D4AF37]' : 'text-white'}`}>
                          {d.amount}
                        </span>
                        <p className="text-[9px] text-gray-500">donated</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {/* ── Game Zone teaser ──────────────────────────────────── */}
            <section>
              <div className="flex items-center space-x-1.5 mb-2">
                <span className="material-symbols-outlined text-[#D4AF37] text-base">sports_esports</span>
                <h3 className="text-sm font-bold text-white">Game Zone</h3>
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 font-bold uppercase tracking-wide">
                  Beta
                </span>
              </div>

              <div className="glass-card rounded-xl p-4 border border-[#D4AF37]/20 bg-gradient-to-br from-[#D4AF37]/5 to-transparent relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 text-7xl opacity-10 select-none transition-opacity">🏈</div>
                  <div className="relative z-10">
                    <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                      A mini-game lives inside this app. Press the{' '}
                      <span className="text-[#D4AF37] font-semibold">🏈</span> button in the nav to enter.
                    </p>

                    {/* Stats grid */}
                    {gameStats && gameStats.totalSessions > 0 ? (
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {[
                          { label: 'Players', value: gameStats.uniquePlayers, icon: 'groups' },
                          { label: 'Total Kicks', value: gameStats.totalKicks, icon: 'sports_soccer' },
                          { label: 'Sessions', value: gameStats.totalSessions, icon: 'timer' },
                          { label: 'High Score', value: gameStats.highScore, icon: 'emoji_events' },
                        ].map(({ label, value, icon }) => {
                          const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n)
                          return (
                            <div key={label} className="flex items-center space-x-2 bg-black/20 rounded-lg px-3 py-2">
                              <span className="material-symbols-outlined text-[#D4AF37] text-sm">{icon}</span>
                              <div>
                                <p className="text-white text-xs font-bold leading-none">{fmt(value)}</p>
                                <p className="text-gray-500 text-[9px]">{label}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="bg-black/20 rounded-lg px-3 py-2 mb-3 text-center">
                        <p className="text-gray-500 text-xs">No one has found it yet — will you be first?</p>
                      </div>
                    )}

                    {/* Leaderboard preview */}
                    {gameStats && gameStats.leaderboard.length > 0 && (
                      <div className="space-y-1 mb-3">
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">Top Kickers</p>
                        {gameStats.leaderboard.slice(0, 3).map((p) => (
                          <div key={p.rank} className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-1.5">
                              <span className={`font-bold w-4 ${p.rank === 1 ? 'text-[#D4AF37]' : 'text-gray-500'}`}>{p.rank}</span>
                              <span className="text-gray-300 truncate max-w-[120px]">{p.name}</span>
                            </div>
                            <span className={`font-bold ${p.rank === 1 ? 'text-[#D4AF37]' : 'text-white'}`}>
                              {p.kicks} ⚡
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-[#D4AF37] font-semibold">
                        Press the 🏈 in the nav to enter →
                      </p>
                      <span className="material-symbols-outlined text-[#D4AF37] text-base">chevron_right</span>
                    </div>
                  </div>
              </div>
            </section>
          </>
        )}
      </main>
      <BottomNav />
    </WalletGuard>
  )
}

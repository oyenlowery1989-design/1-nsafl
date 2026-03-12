'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTelegramBack } from '@/hooks/useTelegramBack'
import BottomNav from '@/components/BottomNav'
import WalletGuard from '@/components/WalletGuard'
import PageLoader, { useMinLoader } from '@/components/PageLoader'
import Link from 'next/link'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'
import { ALL_CLUBS, AFL_CLUBS, WAFL_CLUBS } from "@/config/afl"
import { getTelegramInitData } from '@/lib/telegram'
import ErrorCard from '@/components/ErrorCard'
import type { LeaderboardEntry } from '@/app/api/leaderboard/route'
import { useWalletStore } from '@/hooks/useStore'

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
    issuerXlmReserveRaw: number
    xlmRaised: number
  }
  tierDistribution: {
    preTier: number
    tier1_4: number
    tier5_8: number
    tier9_12: number
  }
  teamDistribution?: Record<string, number>
  xlmGoal: number
}

interface GameStatsData {
  totalSessions: number
  totalKicks: number
  highScore: number
  uniquePlayers: number
  leaderboard: { rank: number; name: string; kicks: number }[]
}

const WEEK_LABELS = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Now']

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
  const [topHolders, setTopHolders] = useState<LeaderboardEntry[]>([])
  const currentAddress = useWalletStore((s) => s.stellarAddress)
  const [error, setError] = useState<string | null>(null)
  const showContent = useMinLoader(!!data)

  useEffect(() => {
    const initData = getTelegramInitData()
    // Fetch stats, donations, game, and leaderboard in parallel
    Promise.allSettled([
      fetch('/api/stats/funding').then((r) => r.json()),
      fetch('/api/donations').then((r) => r.json()),
      fetch('/api/game').then((r) => r.json()),
      fetch('/api/leaderboard', { headers: { 'x-telegram-init-data': initData } }).then((r) => r.json()),
    ]).then(([statsResult, donationsResult, gameResult, leaderboardResult]) => {
      if (statsResult.status === 'fulfilled' && statsResult.value.success)
        setData(statsResult.value.data)
      else
        setError('Failed to load stats')

      if (donationsResult.status === 'fulfilled' && donationsResult.value.success)
        setDonationsData(donationsResult.value.data)

      if (gameResult.status === 'fulfilled' && gameResult.value.success)
        setGameStats(gameResult.value.data)

      if (leaderboardResult.status === 'fulfilled' && leaderboardResult.value.success)
        setTopHolders((leaderboardResult.value.data.entries as LeaderboardEntry[]).slice(0, 5))
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
        {error && <ErrorCard error={error} context="Stats page" />}

        {!showContent && !error && <PageLoader label="Loading stats…" />}

        {showContent && data && (
          <>
            {/* ── Offer Sale Hero Card ────────────────────────────── */}
            {(() => {
              const raised = data.tokenStats?.xlmRaised ?? data.tokenStats?.issuerXlmReserveRaw ?? 0
              const goal = data.xlmGoal ?? 100_000
              const pct = Math.min(100, (raised / goal) * 100)
              const remaining = Math.max(0, goal - raised)
              const holders = data.tokenStats?.holderCount ?? 0
              const supply = data.tokenStats?.circulatingSupply ?? '0'
              // Milestone thresholds
              const milestones = [1000, 5000, 10000, 25000, 50000, 100000]
              const nextMilestone = milestones.find((m) => m > raised) ?? goal
              const toNextMilestone = Math.max(0, nextMilestone - raised)
              const milestoneLabel = nextMilestone >= 1000 ? `${nextMilestone / 1000}k` : nextMilestone.toString()
              return (
                <div className="rounded-2xl overflow-hidden border border-[#D4AF37]/25" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(10,14,26,0.95) 60%)', boxShadow: '0 0 40px rgba(212,175,55,0.1)' }}>
                  {/* Header */}
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest">Offer Sale · Live</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                            ✦ Early Backer
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-bold text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
                            {raised < 1000
                              ? raised.toLocaleString(undefined, { maximumFractionDigits: 0 })
                              : (raised / 1000).toFixed(1) + 'k'}
                          </span>
                          <span className="text-[#D4AF37] text-base font-semibold">XLM</span>
                          <span className="text-gray-500 text-xs">raised of 100k goal</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold ${
                          data.weeklyChange.startsWith('-') ? 'text-red-400 bg-red-500/10 border border-red-500/20' : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                        }`}>
                          <span className="material-symbols-outlined text-[13px]">
                            {data.weeklyChange.startsWith('-') ? 'trending_down' : 'trending_up'}
                          </span>
                          {data.weeklyChange}
                        </div>
                        <p className="text-[10px] text-gray-600 mt-1">this week</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="h-2.5 rounded-full bg-white/8 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{
                            width: `${Math.max(pct, 0.6)}%`,
                            background: 'linear-gradient(90deg, #D4AF3760, #D4AF37, #F5D76E)',
                            boxShadow: '0 0 12px rgba(212,175,55,0.6)',
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-1.5 text-[10px]">
                        <span className="text-[#D4AF37] font-bold">{pct < 0.1 ? '<0.1' : pct.toFixed(1)}% funded</span>
                        <span className="text-gray-500">{remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} XLM remaining</span>
                      </div>
                    </div>

                    {/* Next milestone nudge */}
                    <div className="mt-2.5 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#D4AF37]/8 border border-[#D4AF37]/15">
                      <span className="material-symbols-outlined text-[#D4AF37] text-base">flag</span>
                      <p className="text-[11px] text-gray-300 flex-1">
                        Next milestone: <span className="text-[#D4AF37] font-bold">{milestoneLabel} XLM</span>
                        <span className="text-gray-500"> · only </span>
                        <span className="text-white font-semibold">
                          {toNextMilestone < 1000
                            ? toNextMilestone.toLocaleString(undefined, { maximumFractionDigits: 0 })
                            : (toNextMilestone / 1000).toFixed(1) + 'k'} XLM
                        </span>
                        <span className="text-gray-500"> to go</span>
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-white/8 mx-4" />

                  {/* Metric pills */}
                  <div className="grid grid-cols-3 gap-0 divide-x divide-white/8">
                    <div className="px-3 py-3 text-center">
                      <p className="text-base font-bold text-white">{holders.toLocaleString()}</p>
                      <p className="text-[9px] text-gray-500 uppercase tracking-wide mt-0.5">Holders</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-base font-bold text-[#D4AF37]">{supply}</p>
                      <p className="text-[9px] text-gray-500 uppercase tracking-wide mt-0.5">Circulating</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-base font-bold text-emerald-400">{data.totalUsers}</p>
                      <p className="text-[9px] text-gray-500 uppercase tracking-wide mt-0.5">Members</p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-white/8 mx-4" />

                  {/* Bar chart */}
                  <div className="px-4 pt-3 pb-3">
                    <p className="text-[9px] text-gray-600 mb-2 uppercase tracking-wide">Weekly Activity</p>
                    <div className="flex items-end justify-between h-14 space-x-1.5">
                      {data.chartData.map((v, i) => {
                        const isLast = i === data.chartData.length - 1
                        const isPrev = i === data.chartData.length - 2
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center">
                            <div
                              className="w-full rounded-t-sm transition-all"
                              style={{
                                height: `${v}%`,
                                minHeight: 3,
                                background: isLast
                                  ? 'linear-gradient(180deg, #F5D76E, #D4AF37)'
                                  : isPrev
                                  ? 'rgba(212,175,55,0.35)'
                                  : 'rgba(255,255,255,0.08)',
                                boxShadow: isLast ? '0 0 8px rgba(212,175,55,0.5)' : undefined,
                              }}
                            />
                            <span className={`text-[8px] mt-1 ${isLast ? 'text-[#D4AF37] font-bold' : 'text-gray-600'}`}>
                              {WEEK_LABELS[i]}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-4 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="text-[9px] text-gray-600">Live · Stellar DEX trade volume</p>
                    </div>
                    <Link href="/buy" className="text-[10px] font-bold text-[#D4AF37] flex items-center gap-0.5">
                      Buy now <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              )
            })()}

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
            {(!data.teamDistribution || Object.keys(data.teamDistribution).length === 0) && (
              <section>
                <div className="flex items-center space-x-1.5 mb-2">
                  <span className="material-symbols-outlined text-[#D4AF37] text-base">shield</span>
                  <h3 className="text-sm font-bold text-white">Team Allegiance</h3>
                </div>
                <div className="glass-card rounded-xl">
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                      <span className="material-symbols-outlined text-2xl text-gray-500">shield</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-300">No allegiances yet</p>
                    <p className="text-xs text-gray-500 max-w-[220px] leading-relaxed">Connect a wallet and pick your team to appear here.</p>
                  </div>
                </div>
              </section>
            )}
            {data.teamDistribution && Object.keys(data.teamDistribution).length > 0 && (() => {
              const allEntries = Object.entries(data.teamDistribution)
                .map(([teamId, count]) => {
                  const club = ALL_CLUBS.find((c) => c.id === teamId)
                  return { teamId, count, club }
                })
                .filter((e) => e.club)
                .sort((a, b) => b.count - a.count)

              const aflEntries = allEntries.filter((e) => e.club!.league === 'AFL')
              const waflEntries = allEntries.filter((e) => e.club!.league === 'WAFL')
              const totalFans = allEntries.reduce((sum, e) => sum + e.count, 0)

              const AllegianceRows = ({ entries, limit = 6 }: { entries: typeof aflEntries; limit?: number }) => {
                const leagueTotal = entries.reduce((sum, e) => sum + e.count, 0)
                return (
                  <div className="space-y-2">
                    {entries.slice(0, limit).map(({ teamId, count, club }) => {
                      const pct = leagueTotal > 0 ? Math.round((count / leagueTotal) * 100) : 0
                      return (
                        <div key={teamId} className="flex items-center space-x-2">
                          {club!.logo
                            ? <img src={club!.logo} alt={club!.shortName} width={22} height={22} className="object-contain flex-shrink-0" />
                            : <div className="w-[22px] h-[22px] rounded-full flex-shrink-0 flex items-center justify-center text-white text-[7px] font-bold" style={{ background: club!.color }}>{club!.shortName.slice(0, 2)}</div>
                          }
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
                    {entries.length > limit && (
                      <p className="text-[9px] text-gray-500 text-center">+{entries.length - limit} more</p>
                    )}
                  </div>
                )
              }

              return (
                <section>
                  <div className="flex items-center space-x-1.5 mb-2">
                    <span className="material-symbols-outlined text-[#D4AF37] text-base">shield</span>
                    <h3 className="text-sm font-bold text-white">Team Allegiance</h3>
                    <span className="text-[10px] text-gray-500 ml-auto">{totalFans} members</span>
                  </div>
                  <div className="glass-card p-4 rounded-xl space-y-4">
                    {aflEntries.length > 0 && (
                      <div>
                        <p className="text-[9px] font-bold text-[#D4AF37] uppercase tracking-widest mb-2">AFL</p>
                        <AllegianceRows entries={aflEntries} />
                      </div>
                    )}
                    {waflEntries.length > 0 && (
                      <div>
                        {aflEntries.length > 0 && <div className="h-px bg-white/8 mb-3" />}
                        <p className="text-[9px] font-bold text-[#D4AF37] uppercase tracking-widest mb-2">WAFL</p>
                        <AllegianceRows entries={waflEntries} />
                      </div>
                    )}
                  </div>
                </section>
              )
            })()}

            {/* ── AFL Snapshot ──────────────────────────────────────── */}
            <section>
              <div className="flex items-center space-x-1.5 mb-2">
                <span className="material-symbols-outlined text-[#D4AF37] text-base">sports_football</span>
                <h3 className="text-sm font-bold text-white">AFL Results — Rds 1 & 2</h3>
              </div>
              {(() => {
                const snapshotFixtures = [
                  { home: 'CAR', homeId: 'carlton',          away: 'RIC', awayId: 'richmond',          hs: 75,  as: 71,  label: 'Rd 2' },
                  { home: 'SYD', homeId: 'sydney',           away: 'CAR', awayId: 'carlton',           hs: 132, as: 69,  label: 'Rd 1' },
                  { home: 'GCS', homeId: 'gold-coast',       away: 'GEE', awayId: 'geelong',           hs: 125, as: 69,  label: 'Rd 1' },
                  { home: 'GWS', homeId: 'gws',              away: 'HAW', awayId: 'hawthorn',          hs: 122, as: 95,  label: 'Rd 1' },
                  { home: 'BRL', homeId: 'brisbane',         away: 'WBD', awayId: 'western-bulldogs',  hs: 106, as: 111, label: 'Rd 1' },
                  { home: 'STK', homeId: 'st-kilda',         away: 'COL', awayId: 'collingwood',       hs: 66,  as: 78,  label: 'Rd 1' },
                ]
                return (
                  <div className="glass-card rounded-xl overflow-hidden divide-y divide-white/5">
                    {snapshotFixtures.map((m) => {
                      const homeWon = m.hs > m.as
                      const homeLogo = ALL_CLUBS.find((c) => c.id === m.homeId)?.logo
                      const awayLogo = ALL_CLUBS.find((c) => c.id === m.awayId)?.logo
                      return (
                        <div key={`${m.home}-${m.label}`} className="flex items-center justify-between px-4 py-2.5">
                          {'label' in m && <span className="text-[8px] font-bold text-gray-600 w-6 flex-shrink-0">{(m as typeof m & { label: string }).label}</span>}
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
                )
              })()}
            </section>

            {/* ── Top Holders ────────────────────────────────────── */}
            <section>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-1.5">
                  <span className="material-symbols-outlined text-[#D4AF37] text-base">emoji_events</span>
                  <h3 className="text-sm font-bold text-white">Top Holders</h3>
                </div>
                <Link href="/leaderboard" className="text-[10px] text-[#D4AF37] font-semibold flex items-center space-x-0.5 hover:opacity-80">
                  <span>View all</span>
                  <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                </Link>
              </div>
              {topHolders.length > 0 ? (
                <div className="space-y-2">
                  {topHolders.map((h) => {
                    const isMe = currentAddress && h.stellarAddress.toLowerCase() === currentAddress.toLowerCase()
                    const displayName = h.displayName
                    const bal = h.balance >= 1_000_000
                      ? `${(h.balance / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
                      : h.balance >= 1_000
                      ? `${(h.balance / 1_000).toFixed(1).replace(/\.0$/, '')}k`
                      : h.balance.toLocaleString()
                    return (
                      <div key={h.stellarAddress} className={`glass-card p-3 rounded-xl flex items-center justify-between relative overflow-hidden ${
                        isMe
                          ? 'border border-[#D4AF37]/60 bg-[#D4AF37]/8 shadow-[0_0_16px_rgba(212,175,55,0.18)]'
                          : ''
                      }`}>
                        {isMe && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#D4AF37] rounded-l-xl" />}
                        <div className="flex items-center space-x-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border ${
                            h.rank === 1
                              ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30'
                              : h.rank === 2
                              ? 'bg-white/10 text-gray-300 border-white/20'
                              : 'bg-white/5 text-gray-400 border-white/10'
                          }`}>
                            {h.rank}
                          </div>
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <h4 className={`font-semibold text-xs ${isMe ? 'text-[#D4AF37]' : 'text-white'}`}>{displayName}</h4>
                              {isMe && (
                                <span className="text-[9px] text-[#D4AF37] font-bold border border-[#D4AF37]/30 rounded px-1 py-px flex-shrink-0">YOU</span>
                              )}
                            </div>
                            <div className="flex items-center space-x-1 mt-0.5">
                              {h.inApp ? (
                                <span className="text-[8px] font-bold text-green-400 border border-green-500/30 bg-green-500/10 rounded px-1 py-px leading-none">In the Hub</span>
                              ) : (
                                <span className="text-[8px] font-bold text-gray-600 border border-white/8 bg-white/3 rounded px-1 py-px leading-none">Not joined</span>
                              )}
                              <p className="text-[9px] text-gray-600 font-mono">…{h.stellarAddress.slice(-4)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`font-bold text-xs ${isMe || h.rank === 1 ? 'text-[#D4AF37]' : 'text-white'}`}>{bal}</span>
                          <p className="text-[9px] text-gray-500">{PRIMARY_CUSTOM_ASSET_LABEL}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="glass-card rounded-xl">
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                      <span className="material-symbols-outlined text-2xl text-gray-500">emoji_events</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-300">No holders yet</p>
                    <p className="text-xs text-gray-500 max-w-[220px] leading-relaxed">Holder rankings will appear here once wallets connect and acquire {PRIMARY_CUSTOM_ASSET_LABEL}.</p>
                  </div>
                </div>
              )}
            </section>

            {/* ── Top Supporters (Donors) ──────────────────────────── */}
            <section>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-1.5">
                  <span className="material-symbols-outlined text-[#D4AF37] text-base">volunteer_activism</span>
                  <h3 className="text-sm font-bold text-white">Top Supporters</h3>
                </div>
                {donationsData && donationsData.topDonors.length > 0 && (
                  <div className="flex items-center space-x-1 text-[10px] text-gray-400">
                    <span>{donationsData.totalDonated} {PRIMARY_CUSTOM_ASSET_LABEL} total</span>
                  </div>
                )}
              </div>
              {donationsData && donationsData.topDonors.length > 0 ? (
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
                                const teamClub = teamMatch ? ALL_CLUBS.find((c) => c.id === teamMatch[1]) : null
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
              ) : (
                <div className="glass-card rounded-xl">
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                      <span className="material-symbols-outlined text-2xl text-gray-500">volunteer_activism</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-300">No donations yet</p>
                    <p className="text-xs text-gray-500 max-w-[220px] leading-relaxed">Be the first to support a player&apos;s homecoming campaign.</p>
                    <a
                      href="/rewards"
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-bold hover:bg-[#D4AF37]/90 transition active:scale-[0.98]"
                    >
                      <span>Donate Now</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </a>
                  </div>
                </div>
              )}
            </section>
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
            {/* ── View Leaderboard CTA ──────────────────────────────── */}
            <section>
              <Link href="/leaderboard">
                <div className="glass-card rounded-xl p-4 border border-[#D4AF37]/20 flex items-center justify-between hover:bg-[#D4AF37]/5 transition-colors cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-[#D4AF37]/15 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[#D4AF37] text-lg">emoji_events</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">View Leaderboard</p>
                      <p className="text-[10px] text-gray-400">Top {PRIMARY_CUSTOM_ASSET_LABEL} holders ranked</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#D4AF37] text-lg">chevron_right</span>
                </div>
              </Link>
            </section>
          </>
        )}
      </main>
      <BottomNav />
    </WalletGuard>
  )
}

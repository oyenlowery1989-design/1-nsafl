'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import BalanceCard from './_dashboard/BalanceCard'
import BottomNav from './BottomNav'
import TierHeroCard from './TierHeroCard'
import PageLoader, { useMinLoader } from './PageLoader'
import NotificationDrawer from './NotificationDrawer'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'
import { getTierForBalance } from '@/config/tiers'
import { useWalletStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { getTelegramInitData, buildReferralLink, shareReferralLink } from '@/lib/telegram'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { toast } from './Toast'
import { haptic } from '@/lib/telegram-ui'

interface Props {
  address: string
  balance: string
}

interface LiveStats {
  holderCount: number
  walletCount: number
  activeWallets: number
  totalFunding: string
  weeklyChange: string
  tierDistribution: { preTier: number; tier1_4: number; tier5_8: number; tier9_12: number }
  topSupporters: { rank: number; name: string; amount: string }[]
  tokenStats?: { holderCount: number }
}


export default function DashboardView({ address, balance }: Props) {
  const router = useRouter()
  const xlmBalance = useWalletStore((s) => s.xlmBalance)
  const setBalances = useWalletStore((s) => s.setBalances)
  const telegramUserId = useWalletStore((s) => s.telegramUserId)
  const tokenBalance   = useWalletStore((s) => s.tokenBalance)
  const myXlmRefundPct = getTierForBalance(parseFloat(tokenBalance) || 0).rewards?.xlmRefundPct ?? 20

  const [balanceReady, setBalanceReady] = useState(false)
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Fetch balance and unread count in parallel on mount
  useEffect(() => {
    const fetchBalance = fetch(`/api/stellar/balance?address=${address}`)
      .then(r => r.json())
      .then(j => { if (j.success) setBalances(j.data.token, j.data.xlm) })
      .catch(() => {})

    const fetchNotifs = fetch('/api/notifications', {
      headers: { 'x-telegram-init-data': getTelegramInitData() },
    })
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          const count = (j.data.notifications as Array<{ read: boolean }> ?? [])
            .filter(n => !n.read).length
          setUnreadCount(count)
        }
      })
      .catch(() => {})

    const fetchStats = fetch('/api/stats/funding')
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          const d = j.data
          setLiveStats({
            ...d,
            holderCount: d.tokenStats?.holderCount ?? d.holderCount ?? 0,
          })
        }
      })
      .catch(() => {})

    Promise.all([fetchBalance, fetchNotifs, fetchStats]).finally(() => setBalanceReady(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]) // setBalances is stable from Zustand — omitting prevents fetch loop

  // Poll balance every 60 seconds while on the dashboard
  useEffect(() => {
    if (!address) return

    const poll = () => {
      fetch(`/api/stellar/balance?address=${address}`)
        .then(r => r.json())
        .then(j => { if (j.success) setBalances(j.data.token, j.data.xlm) })
        .catch(() => {})
    }

    const intervalId = setInterval(poll, 60_000)

    return () => clearInterval(intervalId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]) // setBalances is stable from Zustand — omitting prevents unnecessary re-registrations

  // After balance ready, set up Supabase Realtime subscription on wallet_balances
  useEffect(() => {
    if (!balanceReady) return

    let active = true

    async function setupRealtime() {
      // Fetch wallet_id for this stellar address
      const { data: walletRow } = await supabase
        .from('wallets')
        .select('id')
        .eq('stellar_address', address)
        .maybeSingle()

      if (!walletRow || !active) return

      const walletId = (walletRow as { id: string }).id

      const channel = supabase
        .channel(`wallet-balances-${walletId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'wallet_balances',
            filter: `wallet_id=eq.${walletId}`,
          },
          (payload) => {
            const row = payload.new as { nsafl_balance?: string; xlm_balance?: string }
            setBalances(row.nsafl_balance ?? '0.00', row.xlm_balance ?? '0.00')
            haptic.light()
            toast.info('Balance updated')
          }
        )
        .subscribe()

      channelRef.current = channel
    }

    setupRealtime()

    return () => {
      active = false
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [balanceReady, address, setBalances])

  const handleRefresh = async () => {
    if (refreshing) return
    haptic.light()
    setRefreshing(true)
    try {
      const r = await fetch(`/api/stellar/balance?address=${address}`)
      const j = await r.json()
      if (j.success) {
        setBalances(j.data.token, j.data.xlm)
        haptic.success()
      }
    } catch {
      // silently ignore
    } finally {
      setRefreshing(false)
    }
  }

  // When drawer closes, refresh unread count
  const handleNotifClose = () => {
    setNotifOpen(false)
    setUnreadCount(0)
  }

  const showDashboard = useMinLoader(balanceReady)

  if (!showDashboard) {
    return <PageLoader label="Fetching your balances…" />
  }

  return (
    <>
      <header className="pt-3 pb-2 px-4 sticky top-0 z-30 bg-[#0A0E1A] border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#D4AF37]">sports_football</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">The Homecoming Hub</h1>
              <p className="text-xs text-[#D4AF37] font-medium">{PRIMARY_CUSTOM_ASSET_LABEL} Dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-10 h-10 rounded-full glass-card flex items-center justify-center hover:bg-white/10 transition disabled:opacity-60"
            aria-label="Refresh balance"
          >
            <span className={`material-symbols-outlined text-white${refreshing ? ' animate-spin' : ''}`}>refresh</span>
          </button>
          <button
            onClick={() => setNotifOpen(true)}
            className="w-10 h-10 rounded-full glass-card flex items-center justify-center hover:bg-white/10 transition relative"
            aria-label="Open notifications"
          >
            <span className="material-symbols-outlined text-white">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] bg-[#D4AF37] text-black text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border border-[#0A0E1A]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          </div>
        </div>
      </header>

      <main className="px-6 py-6 space-y-8 pb-32">
        <BalanceCard balance={balance} address={address} xlmBalance={xlmBalance} />

        <TierHeroCard />

        {/* ── Lucky Draw Promo ───────────────────────────────────── */}
        <div
          onClick={() => router.push('/game')}
          className="rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 p-4 cursor-pointer hover:bg-[#D4AF37]/10 active:scale-[0.98] transition"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[#D4AF37] text-xl animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>casino</span>
              </div>
              <div>
                <p className="text-sm font-bold text-white">Lucky Draw — Win XLM &amp; NSAFL</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Spin daily. Win up to 1000 XLM. Free to play!</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-[#D4AF37] text-lg">chevron_right</span>
          </div>
          <div className="flex items-center space-x-3 mt-3 pt-3 border-t border-white/5">
            {[
              { prize: '1000 XLM', label: 'Jackpot', color: 'text-yellow-300' },
              { prize: '100 XLM', label: 'Big Win', color: 'text-blue-300' },
              { prize: '100 NSAFL', label: 'Token Win', color: 'text-green-300' },
            ].map(({ prize, label, color }) => (
              <div key={prize} className="flex-1 bg-white/3 rounded-lg py-1.5 text-center border border-white/8">
                <p className={`text-xs font-bold ${color}`}>{prize}</p>
                <p className="text-[9px] text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Live Network Stats ─────────────────────────────────── */}
        {liveStats && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-1.5">
                <span className="material-symbols-outlined text-[#D4AF37] text-lg">monitoring</span>
                <h3 className="text-base font-bold text-white">Live Network</h3>
              </div>
              <div className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                liveStats.weeklyChange.startsWith('-') ? 'text-red-400 bg-red-500/10' : 'text-green-400 bg-green-500/10'
              }`}>
                <span className="material-symbols-outlined text-[11px]">
                  {liveStats.weeklyChange.startsWith('-') ? 'trending_down' : 'trending_up'}
                </span>
                <span>{liveStats.weeklyChange} this week</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="glass-card rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-[#D4AF37]">{liveStats.holderCount.toLocaleString()}</p>
                <p className="text-[9px] text-gray-400 uppercase tracking-wide">Holders</p>
              </div>
              <div className="glass-card rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-white">{liveStats.totalFunding}</p>
                <p className="text-[9px] text-gray-400 uppercase tracking-wide">Total Held</p>
              </div>
              <div className="glass-card rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-green-400">{liveStats.activeWallets}</p>
                <p className="text-[9px] text-gray-400 uppercase tracking-wide">Active</p>
              </div>
            </div>

            {/* Tier distribution — FOMO */}
            <div className="glass-card rounded-xl p-4 space-y-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1">Holder Distribution</p>
              {[
                { label: 'Tier 9–12 (Whales)', count: liveStats.tierDistribution.tier9_12, color: 'bg-emerald-500', textColor: 'text-emerald-400' },
                { label: 'Tier 5–8', count: liveStats.tierDistribution.tier5_8, color: 'bg-purple-500', textColor: 'text-purple-400' },
                { label: 'Tier 1–4', count: liveStats.tierDistribution.tier1_4, color: 'bg-orange-500', textColor: 'text-orange-400' },
                { label: 'Pre-Tier', count: liveStats.tierDistribution.preTier, color: 'bg-gray-500', textColor: 'text-gray-400' },
              ].map((t) => {
                const total = liveStats.walletCount || 1
                const pct = Math.round((t.count / total) * 100)
                return (
                  <div key={t.label} className="flex items-center space-x-2">
                    <div className="w-20 text-[10px] text-gray-300 truncate">{t.label}</div>
                    <div className="flex-1 bg-white/5 rounded-full h-1.5">
                      <div className={`${t.color} h-1.5 rounded-full`} style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                    <span className={`text-[10px] font-bold w-8 text-right ${t.textColor}`}>{t.count}</span>
                  </div>
                )
              })}
              <p className="text-[9px] text-[#D4AF37] font-semibold mt-2 text-center">
                {liveStats.tierDistribution.tier9_12 + liveStats.tierDistribution.tier5_8} wallets in Tier 5+. Are you one of them?
              </p>
            </div>
          </section>
        )}

        {/* ── Referral + Donate promos ───────────────────────────────── */}
        <section>
          <div className="space-y-2">

            {/* Referral promo */}
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
              <div className="flex items-start space-x-2.5">
                <span className="material-symbols-outlined text-blue-400 text-xl flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>group_add</span>
                <div>
                  <p className="text-sm font-bold text-white">Invite Friends — Earn Together</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                    For every friend you bring in: earn bonus game points, unlock bigger rewards, and get <span className="text-blue-300 font-semibold">+{myXlmRefundPct}% XLM refunded</span> from their first {PRIMARY_CUSTOM_ASSET_LABEL} purchase.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { icon: 'sports_esports', label: 'Bonus game points' },
                  { icon: 'redeem',         label: 'Bigger rewards' },
                  { icon: 'currency_exchange', label: `+${myXlmRefundPct}% XLM Refund` },
                ].map(({ icon, label }) => (
                  <div key={icon} className="bg-white/3 rounded-xl p-2 border border-white/8">
                    <span className="material-symbols-outlined text-blue-400 text-base">{icon}</span>
                    <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-gray-600 leading-relaxed">
                Send proof screenshots &amp; referral info to our support team to claim your bonus.
              </p>
              <button
                onClick={() => shareReferralLink(buildReferralLink(telegramUserId))}
                className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl border border-blue-500/40 bg-blue-500/15 text-blue-300 font-bold text-sm hover:bg-blue-500/25 transition active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[16px]">share</span>
                <span>Invite &amp; Earn</span>
              </button>
            </div>

            {/* Donate promo */}
            <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-4 space-y-3">
              <div className="flex items-start space-x-2.5">
                <span className="material-symbols-outlined text-green-400 text-xl flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>volunteer_activism</span>
                <div>
                  <p className="text-sm font-bold text-white">Donate — Be Known</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                    Support AFL homecoming campaigns. Top donors earn more game points, unlock exclusive rewards, and get featured on the Top Supporters board.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { icon: 'sports_esports', label: 'More game points' },
                  { icon: 'workspace_premium', label: 'Exclusive rewards' },
                  { icon: 'star',           label: 'Featured publicly' },
                ].map(({ icon, label }) => (
                  <div key={icon} className="bg-white/3 rounded-xl p-2 border border-white/8">
                    <span className="material-symbols-outlined text-green-400 text-base">{icon}</span>
                    <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">{label}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => router.push('/rewards')}
                className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl border border-green-500/40 bg-green-500/15 text-green-300 font-bold text-sm hover:bg-green-500/25 transition active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>volunteer_activism</span>
                <span>Donate Now</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      <BottomNav />

      <NotificationDrawer open={notifOpen} onClose={handleNotifClose} />
    </>
  )
}

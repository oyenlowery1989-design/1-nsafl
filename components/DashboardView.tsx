'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import BalanceCard from './_dashboard/BalanceCard'
import BottomNav from './BottomNav'
import TierHeroCard from './TierHeroCard'
import PageLoader, { useMinLoader } from './PageLoader'
import NotificationDrawer from './NotificationDrawer'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'
import { useWalletStore } from '@/hooks/useStore'
import { supabase } from '@/lib/supabase'
import { getTelegramInitData } from '@/lib/telegram'
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

interface DonationStats {
  totalDonated: string
  donationCount: number
}

export default function DashboardView({ address, balance }: Props) {
  const router = useRouter()
  const xlmBalance = useWalletStore((s) => s.xlmBalance)
  const setBalances = useWalletStore((s) => s.setBalances)
  const [balanceReady, setBalanceReady] = useState(false)
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null)
  const [donationStats, setDonationStats] = useState<DonationStats | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
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

    const fetchDonations = fetch('/api/donations')
      .then(r => r.json())
      .then(j => { if (j.success) setDonationStats(j.data) })
      .catch(() => {})

    Promise.all([fetchBalance, fetchNotifs, fetchStats, fetchDonations]).finally(() => setBalanceReady(true))
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
      </header>

      <main className="px-6 py-6 space-y-8 pb-32">
        <BalanceCard balance={balance} address={address} xlmBalance={xlmBalance} />

        {/* Buy Quick Action */}
        <button
          onClick={() => router.push('/buy')}
          className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl font-semibold text-sm bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 transition active:scale-[0.98] shadow-[0_4px_20px_rgba(212,175,55,0.25)]"
        >
          <span className="material-symbols-outlined text-lg">shopping_cart</span>
          <span>Buy {PRIMARY_CUSTOM_ASSET_LABEL}</span>
        </button>

        <TierHeroCard />

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

        {/* ── Movement Momentum ──────────────────────────────────── */}
        <section>
          <div className="flex items-center space-x-1.5 mb-3">
            <span className="material-symbols-outlined text-[#D4AF37] text-lg">local_fire_department</span>
            <h3 className="text-base font-bold text-white">Movement Momentum</h3>
          </div>
          <div className="space-y-2">
            {/* Top holder spotlight */}
            {liveStats && liveStats.topSupporters.length > 0 && (
              <div className="glass-card rounded-xl p-3 flex items-center justify-between border-l-2 border-l-[#D4AF37]">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#D4AF37] text-base" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">#1 Holder: {liveStats.topSupporters[0].name}</p>
                    <p className="text-[10px] text-gray-400">{liveStats.topSupporters[0].amount} {PRIMARY_CUSTOM_ASSET_LABEL}</p>
                  </div>
                </div>
                <span className="text-[9px] text-[#D4AF37] font-semibold uppercase">Top</span>
              </div>
            )}

            {/* Donation momentum */}
            {donationStats && donationStats.donationCount > 0 && (
              <div className="glass-card rounded-xl p-3 flex items-center justify-between border-l-2 border-l-green-500">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-green-400 text-base">volunteer_activism</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{donationStats.totalDonated} {PRIMARY_CUSTOM_ASSET_LABEL} donated</p>
                    <p className="text-[10px] text-gray-400">{donationStats.donationCount} supporter{donationStats.donationCount !== 1 ? 's' : ''} backing the movement</p>
                  </div>
                </div>
              </div>
            )}

            {/* FOMO CTA */}
            <div className="glass-card rounded-xl p-4 text-center border border-[#D4AF37]/20 bg-gradient-to-br from-[#D4AF37]/5 to-transparent">
              <p className="text-xs text-gray-300 mb-2">
                Early holders get the best tier rewards. Don&apos;t miss out.
              </p>
              <button
                onClick={() => router.push('/buy')}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-bold hover:bg-[#D4AF37]/90 transition"
              >
                <span className="material-symbols-outlined text-sm">rocket_launch</span>
                <span>Buy Now & Level Up</span>
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

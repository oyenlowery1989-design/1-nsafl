'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from './BottomNav'
import PageLoader, { useMinLoader } from './PageLoader'
import NotificationDrawer from './NotificationDrawer'
import { PRIMARY_CUSTOM_ASSET_CODE, PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'
import { BRANDING } from '@/config/branding'
import { PARTNER_CLUB, PARTNER_SQUAD } from '@/config/partnerClub'
import { getTierForBalance, getNextTier } from '@/config/tiers'
import { useIdentityStore } from '@/hooks/useStore'
import { useStellarWalletStore } from '@/packs/stellar-wallet/store'
import { getTelegramInitData, buildReferralLink, shareReferralLink } from '@/lib/telegram'
import { toast } from './Toast'
import { haptic } from '@/lib/telegram-ui'

interface Props {
  address: string
  balance: string
  referralShareText: string
}

interface LiveStats {
  holderCount: number
  walletCount: number
  activeWallets: number
  totalFunding: string
  weeklyChange: string
  tierDistribution: { preTier: number; tier1_4: number; tier5_9: number; top: number }
  topSupporters: { rank: number; name: string; amount: string }[]
  tokenStats?: { holderCount: number }
}

function WalletTierCard({ balance, address, xlmBalance }: { balance: string; address: string; xlmBalance?: string }) {
  const numericBalance = parseFloat(balance) || 0
  const currentTier = getTierForBalance(numericBalance)
  const nextTier = getNextTier(currentTier)
  const short = `${address.slice(0, 4)}...${address.slice(-4)}`

  const progressPct = nextTier
    ? Math.min(100, Math.round(((numericBalance - currentTier.minBalance) / (nextTier.minBalance - currentTier.minBalance)) * 100))
    : 100

  const toNext = nextTier ? Math.max(0, nextTier.minBalance - numericBalance) : 0

  return (
    <div className="glass-card rounded-2xl p-3 relative overflow-hidden border" style={{ borderColor: `${currentTier.color}4D`, background: BRANDING.colors.background }}>
      <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full blur-3xl pointer-events-none" style={{ background: currentTier.glowColor }} />
      <div className="relative z-10 flex items-center gap-3">
        {/* Left — balance */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
            <span className="text-[10px] text-gray-400 font-mono truncate">{short}</span>
          </div>
          <p className="text-xl font-bold text-white leading-tight truncate">
            {balance} <span className="text-sm font-semibold" style={{ color: currentTier.color }}>{PRIMARY_CUSTOM_ASSET_LABEL}</span>
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">XLM: <span className="text-gray-300">{xlmBalance ?? '0.00'}</span></p>
        </div>
        {/* Right — tier */}
        <div className="flex-shrink-0 text-right">
          <p className="text-[9px] text-gray-400 uppercase tracking-widest mb-0.5">Tier</p>
          <p className="text-sm font-bold leading-tight" style={{ color: currentTier.color }}>{currentTier.emoji} {currentTier.label}</p>
          <p className="text-[9px] text-gray-400 leading-tight">{currentTier.name}</p>
        </div>
      </div>
      {/* Progress */}
      <div className="relative z-10 mt-2">
        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${currentTier.color}88, ${currentTier.color})` }} />
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-[9px] text-gray-500">
            {nextTier ? `${Math.round(toNext).toLocaleString()} more → ${nextTier.label}` : '👑 Max Tier'}
          </p>
          <p className="text-[9px] font-semibold" style={{ color: currentTier.color }}>{progressPct}%</p>
        </div>
      </div>
    </div>
  )
}

export default function DashboardView({ address, balance, referralShareText }: Props) {
  const router = useRouter()
  const xlmBalance = useStellarWalletStore((s) => s.xlmBalance)
  const setBalances = useStellarWalletStore((s) => s.setBalances)
  const telegramUserId = useIdentityStore((s) => s.telegramUserId)
  const tokenBalance = useStellarWalletStore((s) => s.tokenBalance)
  const myXlmRefundPct = getTierForBalance(parseFloat(tokenBalance) || 0).rewards?.xlmRefundPct ?? 20

  const [balanceReady, setBalanceReady] = useState(false)
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [sponsorOpen, setSponsorOpen] = useState(false)

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

    Promise.all([fetchBalance, fetchNotifs, fetchStats]).finally(() => {
      setBalanceReady(true)
      if (PARTNER_CLUB.enabled) setSponsorOpen(true)
    })
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

  // After balance ready, poll the authed wallet-live route (replaces direct
  // anon-key table reads + Realtime subscription on wallets/wallet_balances)
  useEffect(() => {
    if (!balanceReady) return

    let lastToken: string | null = null

    const poll = () => {
      fetch('/api/user/wallet-live', {
        headers: { 'x-telegram-init-data': getTelegramInitData() },
      })
        .then(r => r.json())
        .then(j => {
          if (!j.success) return
          const { tokenBalance, xlmBalance } = j.data
          if (lastToken !== null && lastToken !== tokenBalance) {
            haptic.light()
            toast.info('Balance updated')
          }
          lastToken = tokenBalance
          setBalances(tokenBalance, xlmBalance)
        })
        .catch(() => {})
    }

    poll()
    const intervalId = setInterval(poll, 60_000)

    return () => clearInterval(intervalId)
  }, [balanceReady, setBalances])

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
      <header className="pt-3 pb-2 px-4 sticky top-0 z-30 bg-background-dark border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">sports_football</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">{BRANDING.appName}</h1>
              <p className="text-xs text-primary font-medium">{PRIMARY_CUSTOM_ASSET_LABEL} Dashboard</p>
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
              <span className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] bg-primary text-black text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border border-background-dark">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          </div>
        </div>
      </header>

      {/* Partner club sponsor bar — always visible below header */}
      {PARTNER_CLUB.enabled && (
        <div
          className="flex items-center justify-center gap-2 py-1.5 border-b border-white/5"
          style={{ background: 'linear-gradient(90deg, rgba(232,25,44,0.08) 0%, rgba(0,212,255,0.04) 100%)' }}
        >
          <img src={PARTNER_CLUB.logo} alt="" width={14} height={14} className="rounded-full object-cover" style={{ boxShadow: '0 0 6px rgba(232,25,44,0.7)' }} />
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: PARTNER_CLUB.color, opacity: 0.85 }}>⚡ {PARTNER_CLUB.sponsorLabel}</span>
        </div>
      )}

      <main className="px-4 py-4 space-y-4 pb-32">
        <WalletTierCard balance={balance} address={address} xlmBalance={xlmBalance} />

        {/* ── Lucky Draw Hero ────────────────────────────────────── */}
        <div
          onClick={() => router.push('/game')}
          className="rounded-2xl cursor-pointer active:scale-[0.98] transition relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, #1a1400 0%, #2a1f00 50%, ${BRANDING.colors.background} 100%)`, border: `1px solid ${BRANDING.colors.primary}66` }}
        >
          {/* glow */}
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(212,175,55,0.25)' }} />
          <div className="relative z-10 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: `${BRANDING.colors.primary}33`, color: BRANDING.colors.primary }}>🎰 Daily Game</span>
                </div>
                <h3 className="text-lg font-bold text-white leading-tight">Lucky Draw</h3>
                <p className="text-[11px] text-primary/80 font-medium">Spin the wheel — win real prizes</p>
              </div>
              <span className="material-symbols-outlined text-4xl" style={{ color: BRANDING.colors.primary, fontVariationSettings: "'FILL' 1" }}>casino</span>
            </div>
            {/* Prize pills */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[`5,000 w${PRIMARY_CUSTOM_ASSET_CODE}`, 'XLM', 'GOLD', 'SILVER', 'Free Spin'].map((prize) => (
                <span key={prize} className="text-[9px] font-semibold px-2 py-0.5 rounded-full border" style={{ borderColor: `${BRANDING.colors.primary}44`, color: BRANDING.colors.primary, background: `${BRANDING.colors.primary}11` }}>{prize}</span>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-gray-400">3 free spins/day · Bonus spins available</p>
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-black" style={{ background: BRANDING.colors.primary }}>
                <span>Spin Now</span>
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>arrow_forward</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Other Games ────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          {[
            { icon: 'view_module', label: 'Slot Machine', sub: '3 reels · 3 spins/day · Win tokens', color: '#a78bfa' },
            { icon: 'grid_on', label: 'Scratch Card', sub: 'Scratch & reveal · 1 card/day', color: '#34d399' },
          ].map(({ icon, label, sub, color }) => (
            <div
              key={label}
              onClick={() => router.push('/game')}
              className="rounded-xl border cursor-pointer active:scale-[0.98] transition flex items-center gap-3 px-3 py-3"
              style={{ borderColor: `${color}33`, background: `${color}0D` }}
            >
              <span className="material-symbols-outlined text-2xl flex-shrink-0" style={{ color, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-tight">{label}</p>
                <p className="text-[10px] text-gray-400">{sub}</p>
              </div>
              <span className="material-symbols-outlined text-base flex-shrink-0" style={{ color }}>chevron_right</span>
            </div>
          ))}
        </div>

        {/* ── Live Network Stats ─────────────────────────────────── */}
        {liveStats && (
          <section className="glass-card rounded-xl px-3 py-2.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5">
                <span className="material-symbols-outlined text-primary text-base">monitoring</span>
                <h3 className="text-sm font-bold text-white">Live Network</h3>
              </div>
              <div className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                liveStats.weeklyChange.startsWith('-') ? 'text-red-400 bg-red-500/10' : 'text-green-400 bg-green-500/10'
              }`}>
                <span className="material-symbols-outlined text-[10px]">
                  {liveStats.weeklyChange.startsWith('-') ? 'trending_down' : 'trending_up'}
                </span>
                <span>{liveStats.weeklyChange} this week</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: liveStats.holderCount.toLocaleString(), label: 'Holders', color: 'text-primary' },
                { value: String(Math.round(parseFloat(liveStats.totalFunding)).toLocaleString()), label: 'Total Held', color: 'text-white' },
                { value: liveStats.activeWallets.toLocaleString(),  label: 'Active', color: 'text-green-400' },
              ].map(({ value, label, color }) => (
                <div key={label} className="text-center">
                  <p className={`text-base font-bold ${color}`}>{value}</p>
                  <p className="text-[9px] text-gray-500 uppercase tracking-wide">{label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Referral + Donate promos ───────────────────────────────── */}
        <section>
          <div className="space-y-2">

            {/* Referral promo */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-2.5 flex items-center gap-3">
              <span className="material-symbols-outlined text-blue-400 text-lg flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>group_add</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white leading-tight">Invite Friends — Earn Together</p>
                <p className="text-[10px] text-gray-400 leading-tight">+{myXlmRefundPct}% XLM refund · bonus spins · bigger rewards</p>
              </div>
              <button
                onClick={() => shareReferralLink(buildReferralLink(telegramUserId), referralShareText)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-500/40 bg-blue-500/15 text-blue-300 font-bold text-[11px] flex-shrink-0 active:scale-[0.97] transition"
              >
                <span className="material-symbols-outlined text-[13px]">share</span>
                Invite
              </button>
            </div>

            {/* Donate promo */}
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-3 py-2.5 flex items-center gap-3">
              <span className="material-symbols-outlined text-green-400 text-lg flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>volunteer_activism</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white leading-tight">Donate — Be Known</p>
                <p className="text-[10px] text-gray-400 leading-tight">Support campaigns · get featured · unlock rewards</p>
              </div>
              <button
                onClick={() => router.push('/rewards')}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-green-500/40 bg-green-500/15 text-green-300 font-bold text-[11px] flex-shrink-0 active:scale-[0.97] transition"
              >
                <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>volunteer_activism</span>
                Donate
              </button>
            </div>
          </div>
        </section>
      </main>

      <BottomNav />

      <NotificationDrawer open={notifOpen} onClose={handleNotifClose} />

      {/* ── WhipLash347 Sponsor Modal ───────────────────────────────── */}
      {sponsorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center px-0 pb-0"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={() => setSponsorOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl overflow-hidden relative"
            style={{
              background: `linear-gradient(170deg, #0d0a0f 0%, ${BRANDING.colors.background} 60%)`,
              border: '1px solid rgba(232,25,44,0.45)',
              borderBottom: 'none',
              boxShadow: '0 -20px 80px rgba(232,25,44,0.20), 0 -4px 40px rgba(0,212,255,0.08)',
              maxHeight: '90dvh',
              overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Top glow line */}
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent 0%, ${PARTNER_CLUB.color} 35%, ${PARTNER_CLUB.secondaryColor} 65%, transparent 100%)` }} />

            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Badge */}
            <div className="flex justify-center mt-2 mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: 'rgba(232,25,44,0.15)', color: PARTNER_CLUB.color, border: '1px solid rgba(232,25,44,0.35)' }}>
                ⚡ {PARTNER_CLUB.coOwnerTagline}
              </span>
            </div>

            {/* Logo + name */}
            <div className="flex flex-col items-center px-6 pb-4">
              <div className="relative mb-4">
                <img
                  src={PARTNER_CLUB.logo}
                  alt={PARTNER_CLUB.name}
                  width={96}
                  height={96}
                  className="rounded-full object-cover"
                  style={{ boxShadow: '0 0 32px rgba(232,25,44,0.80), 0 0 60px rgba(0,212,255,0.25)' }}
                />
                <span className="absolute inset-0 rounded-full animate-ping opacity-15" style={{ border: `3px solid ${PARTNER_CLUB.color}` }} />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">{PARTNER_CLUB.name}</h2>
              <p className="text-[12px] text-gray-400 mt-1 text-center leading-snug">
                The force co-building {PRIMARY_CUSTOM_ASSET_CODE} — powering the<br/>{BRANDING.appName} with vision &amp; fire.
              </p>
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-3 gap-px mx-4 rounded-xl overflow-hidden mb-4" style={{ background: 'rgba(255,255,255,0.04)' }}>
              {[
                { value: String(PARTNER_SQUAD.length), label: 'Players Selected', icon: 'sports_football' },
                { value: String(PARTNER_CLUB.sourceClubs.length), label: 'AFL Clubs', icon: 'stadium' },
                { value: '#1', label: 'Partner Rank',     icon: 'workspace_premium' },
              ].map(({ value, label, icon }) => (
                <div key={label} className="flex flex-col items-center py-3 text-center" style={{ background: BRANDING.colors.background }}>
                  <span className="material-symbols-outlined text-lg mb-0.5" style={{ color: PARTNER_CLUB.color, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                  <p className="text-lg font-bold text-white leading-none">{value}</p>
                  <p className="text-[9px] text-gray-500 mt-0.5 leading-tight">{label}</p>
                </div>
              ))}
            </div>

            {/* Club logos */}
            <div className="flex items-center justify-center gap-3 mx-4 mb-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {PARTNER_CLUB.sourceClubs.map(({ logo, name }) => (
                <div key={name} className="flex items-center gap-2">
                  <img src={logo} alt={name} width={28} height={28} className="object-contain" />
                  <span className="text-[11px] text-gray-300 font-semibold">{name}</span>
                </div>
              ))}
              <span className="text-gray-600 text-xs">·</span>
              <span className="text-[10px] text-gray-500">{PARTNER_SQUAD.length} picks</span>
            </div>

            {/* CTA buttons */}
            <div className="px-4 pb-8 space-y-2">
              <button
                onClick={() => { setSponsorOpen(false); router.push('/clubs') }}
                className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98]"
                style={{
                  background: `linear-gradient(90deg, ${PARTNER_CLUB.color} 0%, #a0000f 100%)`,
                  boxShadow: '0 0 24px rgba(232,25,44,0.45)',
                  color: '#fff',
                }}
              >
                <img src={PARTNER_CLUB.logo} alt="" width={20} height={20} className="rounded-full object-cover" />
                View {PARTNER_CLUB.name} Team
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
              <button
                onClick={() => setSponsorOpen(false)}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-gray-400 hover:text-white transition border border-white/10 hover:border-white/20 active:scale-[0.98]"
              >
                Continue to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

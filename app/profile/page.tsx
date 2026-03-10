'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import BottomNav from '@/components/BottomNav'
import WalletGuard from '@/components/WalletGuard'
import PageLoader, { useMinLoader } from '@/components/PageLoader'
import { useWalletStore } from '@/hooks/useStore'
import { SHOWN_ASSET_CONFIGS, PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'
import { getTelegramUser } from '@/lib/telegram'
import { fetchAccountInfo, StellarAccountInfo } from '@/lib/stellar'
import { getTierForBalance } from '@/config/tiers'
import { AFL_CLUBS } from '@/config/afl'
import { useRouter } from 'next/navigation'
import { useTelegramBack } from '@/hooks/useTelegramBack'
import { haptic } from '@/lib/telegram-ui'
import TeamSelectScreen from '@/components/TeamSelectScreen'
import { getTelegramInitData } from '@/lib/telegram'
import { toast } from '@/components/Toast'

const ASSET_ISSUER = process.env.NEXT_PUBLIC_PRIMARY_ASSET_ISSUER ?? ''
const MOVEMENT_WALLET = process.env.NEXT_PUBLIC_DIRECT_BUY_XLM_ADDRESS ?? ''

interface HorizonPayment {
  id: string
  paging_token: string
  type: string
  created_at: string
  to?: string
  from?: string
  amount?: string
  asset_code?: string
  asset_type?: string
  asset_issuer?: string
}

interface TxDisplay {
  id: string
  label: string
  amount: string
  assetCode: string
  date: string
  isIncoming: boolean
  isSpam: boolean
  raw: HorizonPayment
}

interface DonationRecord {
  id: string
  amount: number
  asset_code: string
  donation_type: string
  donation_target: string | null
  stellar_tx_hash: string | null
  verified: boolean
  created_at: string
}

const SHOWN_CODES = SHOWN_ASSET_CONFIGS.map((c) => c.code)
const SPAM_THRESHOLD = 0.01
// How many extra pages to auto-fetch when visible results are all spam
const MAX_AUTO_FETCH = 3

function mapToDisplay(r: HorizonPayment, myAddress: string): TxDisplay {
  const isIncoming = r.to === myAddress
  const assetCode = r.asset_type === 'native' ? 'XLM' : (r.asset_code ?? '?')
  const amount = parseFloat(r.amount ?? '0')
  // Spam = unknown/disallowed asset OR any amount below the dust threshold
  const isSpam =
    !SHOWN_CODES.includes(assetCode) ||
    amount < SPAM_THRESHOLD

  return {
    id: r.id,
    label: isIncoming ? 'Received' : 'Sent',
    amount: `${r.amount ?? '?'} ${assetCode}`,
    assetCode,
    date: new Date(r.created_at).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric',
    }),
    isIncoming,
    isSpam,
    raw: r,
  }
}

function getCounterpartyLabel(address: string): { label: string; isNamed: boolean } {
  if (ASSET_ISSUER && address === ASSET_ISSUER) return { label: 'Issuer', isNamed: true }
  if (MOVEMENT_WALLET && address === MOVEMENT_WALLET) return { label: 'Movement Wallet', isNamed: true }
  return {
    label: `${address.slice(0, 4)}...${address.slice(-4)}`,
    isNamed: false,
  }
}

// ── Telegram avatar — photo or gold initial ───────────────────────────────────
function TelegramAvatar({ photoUrl, name, size = 72 }: { photoUrl?: string; name: string; size?: number }) {
  const initial = name?.[0]?.toUpperCase() ?? '?'
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover border-2 border-[#D4AF37]/40"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full bg-[#D4AF37]/20 border-2 border-[#D4AF37]/40 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <span className="text-[#D4AF37] font-bold" style={{ fontSize: size * 0.38 }}>{initial}</span>
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  useTelegramBack(() => router.back())
  const stellarAddress = useWalletStore((s) => s.stellarAddress)
  const tokenBalance = useWalletStore((s) => s.tokenBalance)
  const xlmBalance = useWalletStore((s) => s.xlmBalance)
  const telegramUser = useWalletStore((s) => s.telegramUser)
  const favoriteTeam = useWalletStore((s) => s.favoriteTeam)
  const pendingTeamRequest = useWalletStore((s) => s.pendingTeamRequest)
  const disconnect = useWalletStore((s) => s.disconnect)
  const setFavoriteTeam = useWalletStore((s) => s.setFavoriteTeam)
  const setPendingTeamRequest = useWalletStore((s) => s.setPendingTeamRequest)
  const displayPreference = useWalletStore((s) => s.displayPreference)
  const setDisplayPreference = useWalletStore((s) => s.setDisplayPreference)

  // Prefer live Telegram SDK data, fallback to persisted store value
  const liveTgUser = getTelegramUser()
  const tgUser = liveTgUser
    ? {
        firstName: liveTgUser.first_name,
        lastName: liveTgUser.last_name,
        username: liveTgUser.username,
        photoUrl: liveTgUser.photo_url,
      }
    : telegramUser

  const [copied, setCopied] = useState(false)
  const [changingTeam, setChangingTeam] = useState(false)
  const [allTxns, setAllTxns] = useState<TxDisplay[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  // Track initial data load — show full-page spinner until txns + balances are fetched
  const [pageReady, setPageReady] = useState(false)
  const showPage = useMinLoader(pageReady)
  // Show ALL transactions by default — spam shown but visually tagged
  const [hideSpam, setHideSpam] = useState(false)
  const [allBalances, setAllBalances] = useState<Record<string, string>>({})
  const [accountInfo, setAccountInfo] = useState<StellarAccountInfo | null>(null)
  const autoFetchCount = useRef(0)

  // Donations state
  const [donations, setDonations] = useState<DonationRecord[]>([])
  const [donationsLoading, setDonationsLoading] = useState(false)
  const [showAllDonations, setShowAllDonations] = useState(false)

  // Referrals state
  interface ReferralEntry {
    telegram_first_name: string | null
    telegram_username: string | null
    created_at: string | null
  }
  const [referralCount, setReferralCount] = useState(0)
  const [referrals, setReferrals] = useState<ReferralEntry[]>([])
  const [referralsLoading, setReferralsLoading] = useState(false)
  const [showAllReferrals, setShowAllReferrals] = useState(false)
  const [referralLinkCopied, setReferralLinkCopied] = useState(false)
  const telegramUserId = useWalletStore((s) => s.telegramUserId)

  // Fetch a page of transactions and return how many visible (non-spam) ones were added
  const loadTxns = useCallback(async (cursor?: string): Promise<number> => {
    if (!stellarAddress) return 0
    const isFirst = !cursor
    isFirst ? setLoading(true) : setLoadingMore(true)
    try {
      const cursorParam = cursor ? `&cursor=${cursor}` : ''
      const res = await fetch(
        `/api/stellar/transactions?address=${stellarAddress}&limit=15${cursorParam}`
      )
      const j = await res.json()
      if (j.success) {
        const mapped: TxDisplay[] = (j.data.records as HorizonPayment[]).map((r) =>
          mapToDisplay(r, stellarAddress)
        )
        setAllTxns((prev) => isFirst ? mapped : [...prev, ...mapped])
        setNextCursor(j.data.nextCursor ?? null)
        setHasMore(j.data.hasMore ?? false)
        return mapped.filter((t) => !t.isSpam).length
      }
    } finally {
      isFirst ? setLoading(false) : setLoadingMore(false)
    }
    return 0
  }, [stellarAddress])

  // Fetch donations
  const loadDonations = useCallback(async () => {
    if (!stellarAddress) return
    setDonationsLoading(true)
    try {
      const res = await fetch(`/api/donations?address=${stellarAddress}`)
      const j = await res.json()
      if (j.success) {
        setDonations(j.data.donations ?? [])
      }
    } catch {
      // silently ignore
    } finally {
      setDonationsLoading(false)
    }
  }, [stellarAddress])

  // Fetch referrals
  const loadReferrals = useCallback(async () => {
    setReferralsLoading(true)
    try {
      const res = await fetch('/api/user/referrals', {
        headers: { 'x-telegram-init-data': getTelegramInitData() },
      })
      const j = await res.json()
      if (j.success) {
        setReferralCount(j.data.referralCount ?? 0)
        setReferrals(j.data.referrals ?? [])
      }
    } catch {
      // silently ignore
    } finally {
      setReferralsLoading(false)
    }
  }, [])

  // Refresh all data
  const handleRefresh = useCallback(async () => {
    if (!stellarAddress || isRefreshing) return
    haptic.light()
    setIsRefreshing(true)
    try {
      await Promise.all([
        loadTxns(),
        fetch(`/api/stellar/balance?address=${stellarAddress}`)
          .then((r) => r.json())
          .then((j) => { if (j.success) setAllBalances(j.data.assets ?? {}) }),
        fetchAccountInfo(stellarAddress)
          .then(setAccountInfo)
          .catch(() => null),
        loadDonations(),
        loadReferrals(),
      ])
    } finally {
      setIsRefreshing(false)
    }
  }, [stellarAddress, isRefreshing, loadTxns, loadDonations, loadReferrals])

  // Smart "load more": if all fetched records are spam, auto-fetch another page
  const handleLoadMore = useCallback(async () => {
    if (!nextCursor) return
    autoFetchCount.current = 0
    const cursor = nextCursor
    const more = hasMore

    if (cursor && more) {
      const visible = await loadTxns(cursor)
      if (visible > 0 || autoFetchCount.current >= MAX_AUTO_FETCH) return
      autoFetchCount.current++
    }
  }, [nextCursor, hasMore, loadTxns])

  // Sync team + pending request from server on mount
  useEffect(() => {
    fetch('/api/user/team', {
      headers: { 'x-telegram-init-data': getTelegramInitData() },
    })
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) return
        if (j.data.favoriteTeam) setFavoriteTeam(j.data.favoriteTeam)
        if (j.data.pendingRequest) {
          setPendingTeamRequest({
            teamId: j.data.pendingRequest.requested_team,
            requestedAt: new Date(j.data.pendingRequest.created_at).getTime(),
          })
        } else {
          setPendingTeamRequest(null)
        }
      })
      .catch(() => null)
  }, [setFavoriteTeam, setPendingTeamRequest])

  // Sync display preference from server on mount
  useEffect(() => {
    fetch('/api/user/display-preference', {
      headers: { 'x-telegram-init-data': getTelegramInitData() },
    })
      .then((r) => r.json())
      .then((j) => { if (j.success) setDisplayPreference(j.data.displayPreference) })
      .catch(() => null)
  }, [setDisplayPreference])

  useEffect(() => {
    if (!stellarAddress) return
    // Fetch all in parallel; mark page ready when all settle
    Promise.all([
      loadTxns(),
      fetch(`/api/stellar/balance?address=${stellarAddress}`)
        .then((r) => r.json())
        .then((j) => { if (j.success) setAllBalances(j.data.assets ?? {}) }),
      fetchAccountInfo(stellarAddress)
        .then(setAccountInfo)
        .catch(() => null),
      loadDonations(),
      loadReferrals(),
    ]).finally(() => setPageReady(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stellarAddress]) // loadTxns/loadDonations are stable (depends only on stellarAddress) — omit to avoid double-run

  function copyAddress() {
    if (!stellarAddress) return
    haptic.selection()
    navigator.clipboard.writeText(stellarAddress)
    setCopied(true)
    toast.success('Address copied!')
    setTimeout(() => setCopied(false), 1500)
  }

  function handleDisconnect() {
    haptic.warning()
    disconnect()
    router.push('/')
  }

  async function handleTeamChangeRequest(teamId: string) {
    haptic.medium()
    setChangingTeam(false)
    try {
      const res = await fetch('/api/user/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': getTelegramInitData(),
        },
        body: JSON.stringify({ teamId }),
      })
      const j = await res.json()
      if (j.success) {
        haptic.success()
        setPendingTeamRequest({ teamId, requestedAt: Date.now() })
        toast.success('Request submitted — waiting for admin approval')
      } else {
        haptic.error()
        toast.error(j.error ?? 'Failed to submit request')
      }
    } catch {
      haptic.error()
      toast.error('Failed to submit request — try again')
    }
  }

  async function handleDisplayPreference(pref: 'address' | 'name' | 'username') {
    haptic.selection()
    setDisplayPreference(pref)
    try {
      await fetch('/api/user/display-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': getTelegramInitData(),
        },
        body: JSON.stringify({ displayPreference: pref }),
      })
    } catch {
      toast.error('Failed to save preference — try again')
    }
  }

  const short = stellarAddress
    ? `${stellarAddress.slice(0, 8)}...${stellarAddress.slice(-6)}`
    : ''

  const visibleTxns = hideSpam ? allTxns.filter((t) => !t.isSpam) : allTxns
  const spamCount = allTxns.filter((t) => t.isSpam).length

  // Compute tier from stored balance
  const tokenBal = parseFloat(allBalances[PRIMARY_CUSTOM_ASSET_CODE] ?? tokenBalance ?? '0')
  const currentTier = getTierForBalance(tokenBal)

  // Accordion state
  const [openSection, setOpenSection] = useState<string | null>('referrals')
  function toggleSection(id: string) {
    haptic.light()
    setOpenSection((prev) => (prev === id ? null : id))
  }

  // Donation totals
  const totalDonated = donations.reduce((sum, d) => sum + (d.amount ?? 0), 0)
  const displayedDonations = showAllDonations ? donations : donations.slice(0, 5)

  // Referral link
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME ?? ''
  const tgId = liveTgUser?.id ?? telegramUserId
  const referralCode = tgId ? `ref_${tgId}` : null
  const referralLink = botUsername && referralCode
    ? `https://t.me/${botUsername}?start=${referralCode}`
    : referralCode ?? ''
  const displayedReferrals = showAllReferrals ? referrals : referrals.slice(0, 5)

  function copyReferralLink() {
    if (!referralLink) return
    haptic.selection()
    navigator.clipboard.writeText(referralLink)
    setReferralLinkCopied(true)
    toast.success('Referral link copied!')
    setTimeout(() => setReferralLinkCopied(false), 2000)
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!showPage) {
    return (
      <WalletGuard>
        <header className="pt-3 pb-2 px-4 sticky top-0 z-20 bg-[#0A0E1A] border-b border-white/10">
          <div className="flex items-center space-x-4">
            <button onClick={() => router.back()} className="w-8 h-8 rounded-lg glass-card flex items-center justify-center">
              <span className="material-symbols-outlined text-white">arrow_back</span>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Profile</h1>
              <p className="text-sm text-[#D4AF37] font-medium">Stellar Network</p>
            </div>
          </div>
        </header>
        <PageLoader label="Loading your profile…" />
        <BottomNav />
      </WalletGuard>
    )
  }

  return (
    <WalletGuard>
      <header className="pt-3 pb-2 px-4 sticky top-0 z-20 bg-[#0A0E1A] border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={() => router.back()} className="w-8 h-8 rounded-lg glass-card flex items-center justify-center hover:bg-white/10 transition">
              <span className="material-symbols-outlined text-white text-lg">arrow_back</span>
            </button>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Profile</h1>
              <p className="text-xs text-[#D4AF37] font-medium">
                {tgUser?.username ? `@${tgUser.username}` : 'Stellar Network'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-8 h-8 rounded-lg glass-card flex items-center justify-center border border-white/10 hover:bg-white/10 transition disabled:opacity-50"
              aria-label="Refresh"
            >
              <span
                className={`material-symbols-outlined text-[#D4AF37] text-base ${isRefreshing ? 'animate-spin' : ''}`}
                style={isRefreshing ? { animationDuration: '0.8s' } : undefined}
              >
                refresh
              </span>
            </button>
            {/* Logout button */}
            <button
              onClick={handleDisconnect}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition"
            >
              <span className="material-symbols-outlined text-red-400 text-sm">logout</span>
              <span className="text-xs font-semibold text-red-400">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 pb-28">

        {/* ── Combined Identity + Team Card ─────────────────────────────── */}
        {(() => {
          const club = favoriteTeam ? AFL_CLUBS.find((c) => c.id === favoriteTeam) : null
          const pendingClub = pendingTeamRequest ? AFL_CLUBS.find((c) => c.id === pendingTeamRequest.teamId) : null
          return (
            <div className="glass-card p-4 rounded-2xl border-t-2 border-t-[#D4AF37]/40 relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#D4AF37]/10 rounded-full blur-3xl" />
              <div className="flex items-start relative z-10">
                {/* Left: Avatar + identity */}
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {tgUser ? (
                    <TelegramAvatar photoUrl={tgUser.photoUrl} name={tgUser.firstName} size={48} />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 border-2 border-[#D4AF37]/20 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[#D4AF37] text-xl">person</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {tgUser && (
                      <>
                        <div className="flex items-center space-x-2">
                          <h2 className="text-sm font-bold text-white truncate">
                            {tgUser.firstName}{tgUser.lastName ? ` ${tgUser.lastName}` : ''}
                          </h2>
                          <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-semibold bg-green-500/20 text-green-400 border border-green-500/30 uppercase">
                            Active
                          </span>
                        </div>
                        {tgUser.username && (
                          <p className="text-xs text-[#D4AF37] font-medium">@{tgUser.username}</p>
                        )}
                      </>
                    )}
                    <div className="flex items-center space-x-1 mt-0.5">
                      <span className="material-symbols-outlined text-[11px] text-blue-400">send</span>
                      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Telegram Member</span>
                    </div>
                  </div>
                </div>

                {/* Right: Club logo + name + change button */}
                {club ? (
                  <div className="flex flex-col items-center flex-shrink-0 ml-3" style={{ minWidth: 72 }}>
                    <img src={club.logo} alt={club.name} width={40} height={40} className="object-contain" />
                    <p className="text-[10px] font-semibold text-white text-center mt-1 leading-tight" style={{ maxWidth: 72 }}>{club.name}</p>
                    {!pendingTeamRequest && (
                      <button
                        onClick={() => { haptic.light(); setChangingTeam(true) }}
                        className="mt-1.5 flex items-center space-x-0.5 px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition text-[9px] font-semibold text-gray-400 hover:text-white"
                      >
                        <span className="material-symbols-outlined text-[11px]">swap_horiz</span>
                        <span>Change</span>
                      </button>
                    )}
                  </div>
                ) : !favoriteTeam ? (
                  <div className="flex flex-col items-center flex-shrink-0 ml-3" style={{ minWidth: 72 }}>
                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-gray-500 text-lg">stadium</span>
                    </div>
                    <button
                      onClick={() => { haptic.light(); router.push('/') }}
                      className="mt-1.5 text-[9px] font-semibold text-[#D4AF37] underline"
                    >
                      Pick team
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Pending request banner */}
              {pendingTeamRequest && pendingClub && (
                <div className="flex items-center space-x-3 px-3 py-2.5 rounded-xl border border-yellow-500/30 bg-yellow-500/5 mt-3 relative z-10">
                  <span className="material-symbols-outlined text-yellow-400 text-base animate-spin" style={{ animationDuration: '2s' }}>progress_activity</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-yellow-400">Change request pending</p>
                    <p className="text-[10px] text-gray-400 truncate">Requested: {pendingClub.name} — awaiting admin approval</p>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Wallet Card ────────────────────────────────────────────────── */}
        <div className="glass-card p-4 rounded-2xl relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="relative z-10 space-y-3">

            {/* Address row — tap the copy icon to copy the full address */}
            <div className="flex items-center space-x-2 bg-black/30 px-3 py-2 rounded-lg border border-white/5">
              <span className="material-symbols-outlined text-[14px] text-gray-500">account_balance_wallet</span>
              <span className="text-xs font-mono text-gray-300 flex-1 truncate">{short}</span>
              <button onClick={copyAddress} className="text-gray-400 hover:text-[#D4AF37] transition flex-shrink-0">
                <span className="material-symbols-outlined text-sm">
                  {copied ? 'check' : 'content_copy'}
                </span>
              </button>
            </div>

            {/* Home domain — set by the account owner on Stellar */}
            {accountInfo?.homeDomain && (
              <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-[#D4AF37]/5 border border-[#D4AF37]/15">
                <span className="material-symbols-outlined text-[15px] text-[#D4AF37]">language</span>
                <span className="text-xs text-[#D4AF37] font-medium">{accountInfo.homeDomain}</span>
                <span className="text-[10px] text-gray-500 ml-auto">Home Domain</span>
              </div>
            )}

            {/* Asset balances */}
            <div className="space-y-2">
              {SHOWN_ASSET_CONFIGS.map((cfg) => {
                const bal = allBalances[cfg.code] ?? (cfg.code === 'XLM' ? xlmBalance : tokenBalance)
                const isPrimary = cfg.code !== 'XLM'
                return (
                  <div key={cfg.code} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${isPrimary ? 'bg-[#D4AF37]/5 border-[#D4AF37]/20' : 'bg-white/5 border-white/10'}`}>
                    <div className="flex items-center space-x-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isPrimary ? 'bg-[#D4AF37]/20' : 'bg-white/10'}`}>
                        <span className={`material-symbols-outlined text-[14px] ${isPrimary ? 'text-[#D4AF37]' : 'text-gray-300'}`}>
                          {isPrimary ? 'token' : 'currency_exchange'}
                        </span>
                      </div>
                      <span className={`text-xs font-semibold ${isPrimary ? 'text-[#D4AF37]' : 'text-gray-300'}`}>{cfg.label}</span>
                    </div>
                    <span className="text-sm font-bold text-white">{bal}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Quick Stats Row ────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card p-3 rounded-xl text-center">
            <span className="material-symbols-outlined text-[#D4AF37] text-lg">receipt_long</span>
            <p className="text-lg font-bold text-white mt-0.5">{allTxns.length}</p>
            <p className="text-[10px] text-gray-400">Txns Loaded</p>
          </div>
          <div className="glass-card p-3 rounded-xl text-center">
            <span className="material-symbols-outlined text-gray-400 text-lg">block</span>
            <p className="text-lg font-bold text-white mt-0.5">{spamCount}</p>
            <p className="text-[10px] text-gray-400">Spam Filtered</p>
          </div>
          <div className="glass-card p-3 rounded-xl text-center">
            <span className="material-symbols-outlined text-blue-400 text-lg">link</span>
            <p className="text-lg font-bold text-white mt-0.5">{accountInfo?.subentryCount ?? '—'}</p>
            <p className="text-[10px] text-gray-400">Trustlines</p>
          </div>
        </div>

        {/* ── My Donations (accordion) ──────────────────────────────────── */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* Accordion header */}
          <button
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
            onClick={() => toggleSection('donations')}
          >
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-[#D4AF37] text-base">volunteer_activism</span>
              <h3 className="text-sm font-bold text-white">My Donations</h3>
              {totalDonated > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30">
                  {totalDonated.toLocaleString(undefined, { maximumFractionDigits: 2 })} {PRIMARY_CUSTOM_ASSET_CODE}
                </span>
              )}
            </div>
            <span className="material-symbols-outlined text-gray-400 text-lg">
              {openSection === 'donations' ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {/* Expanded content */}
          {openSection === 'donations' && (
            <div className="px-4 pb-4 space-y-3 border-t border-white/5">
              <div className="flex items-center justify-between pt-3">
                <span className="text-[11px] text-gray-400">
                  {donations.length === 0 ? 'No donations yet' : `${donations.length} donation${donations.length !== 1 ? 's' : ''}`}
                </span>
                <button
                  onClick={() => { haptic.light(); router.push('/rewards') }}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 hover:bg-[#D4AF37]/20 transition"
                >
                  <span className="material-symbols-outlined text-[#D4AF37] text-[12px]">favorite</span>
                  <span className="text-[10px] font-semibold text-[#D4AF37]">Donate</span>
                </button>
              </div>

              {donationsLoading ? (
                <div className="flex items-center justify-center py-3 space-x-2">
                  <span className="material-symbols-outlined text-[#D4AF37] text-base animate-spin" style={{ animationDuration: '0.8s' }}>progress_activity</span>
                  <span className="text-[11px] text-gray-400">Loading donations…</span>
                </div>
              ) : donations.length === 0 ? (
                <div className="flex flex-col items-center py-3 space-y-1">
                  <span className="material-symbols-outlined text-gray-600 text-xl">volunteer_activism</span>
                  <p className="text-[11px] text-gray-500">No donations yet</p>
                </div>
              ) : (
                <>
                  {/* Total donated */}
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#D4AF37]/8 border border-[#D4AF37]/20">
                    <span className="text-[11px] text-gray-400">Total donated</span>
                    <span className="text-sm font-bold text-[#D4AF37]">{totalDonated.toLocaleString(undefined, { maximumFractionDigits: 2 })} {PRIMARY_CUSTOM_ASSET_CODE}</span>
                  </div>

                  {/* Donation list */}
                  <div className="divide-y divide-white/5">
                    {displayedDonations.map((d) => (
                      <div key={d.id} className="py-2 flex items-center justify-between">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <span className={`material-symbols-outlined text-sm flex-shrink-0 ${d.verified ? 'text-green-400' : 'text-gray-500'}`}>
                            {d.verified ? 'verified' : 'schedule'}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs text-white font-medium truncate">
                              {d.donation_target ?? 'General'}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {new Date(d.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="text-xs font-bold text-[#D4AF37]">{d.amount} {d.asset_code}</p>
                          {!d.verified && <p className="text-[9px] text-gray-500">Pending</p>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* View all toggle */}
                  {donations.length > 5 && (
                    <button
                      onClick={() => { haptic.light(); setShowAllDonations((v) => !v) }}
                      className="w-full text-center text-[10px] text-[#D4AF37] hover:underline py-1"
                    >
                      {showAllDonations ? 'Show less' : `View all ${donations.length} donations`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── My Referrals (accordion) ──────────────────────────────────── */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* Accordion header */}
          <button
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
            onClick={() => toggleSection('referrals')}
          >
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-[#D4AF37] text-base">group_add</span>
              <h3 className="text-sm font-bold text-white">My Referrals</h3>
              {referralCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30">
                  {referralCount} joined
                </span>
              )}
            </div>
            <span className="material-symbols-outlined text-gray-400 text-lg">
              {openSection === 'referrals' ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {/* Expanded content */}
          {openSection === 'referrals' && (
            <div className="px-4 pb-4 space-y-3 border-t border-white/5">
              {/* Referral link box */}
              {referralCode ? (
                <div className="space-y-2 pt-3">
                  <p className="text-[11px] text-gray-400">Share your link to invite friends:</p>
                  <div className="flex items-center space-x-2 bg-black/30 px-3 py-2.5 rounded-xl border border-[#D4AF37]/20">
                    <span className="material-symbols-outlined text-[#D4AF37] text-[14px] flex-shrink-0">link</span>
                    <span className="text-[11px] font-mono text-gray-300 flex-1 truncate">
                      {referralLink || referralCode}
                    </span>
                    <button
                      onClick={copyReferralLink}
                      className="flex-shrink-0 text-gray-400 hover:text-[#D4AF37] transition"
                      aria-label="Copy referral link"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {referralLinkCopied ? 'check' : 'content_copy'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Referral list */}
              {referralsLoading ? (
                <div className="flex items-center justify-center py-3 space-x-2">
                  <span className="material-symbols-outlined text-[#D4AF37] text-base animate-spin" style={{ animationDuration: '0.8s' }}>progress_activity</span>
                  <span className="text-[11px] text-gray-400">Loading referrals…</span>
                </div>
              ) : referralCount === 0 ? (
                <div className="flex flex-col items-center py-3 space-y-1">
                  <span className="material-symbols-outlined text-gray-600 text-xl">group_add</span>
                  <p className="text-[11px] text-gray-500">No referrals yet</p>
                  <p className="text-[10px] text-gray-600 text-center max-w-[200px]">Share your link to earn balls in Game Zone</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-white/5">
                    {displayedReferrals.map((r, i) => {
                      const name = r.telegram_first_name ?? r.telegram_username ?? 'Anonymous'
                      const handle = r.telegram_username ? `@${r.telegram_username}` : null
                      const joinDate = r.created_at
                        ? new Date(r.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                        : ''
                      return (
                        <div key={i} className="py-2 flex items-center justify-between">
                          <div className="flex items-center space-x-2 min-w-0 flex-1">
                            <div className="w-7 h-7 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center flex-shrink-0">
                              <span className="text-[#D4AF37] text-[11px] font-bold">{name[0]?.toUpperCase() ?? '?'}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-white font-medium truncate">{name}</p>
                              {handle && <p className="text-[10px] text-[#D4AF37] truncate">{handle}</p>}
                            </div>
                          </div>
                          <p className="text-[9px] text-gray-500 flex-shrink-0 ml-2">{joinDate}</p>
                        </div>
                      )
                    })}
                  </div>

                  {referrals.length > 5 && (
                    <button
                      onClick={() => { haptic.light(); setShowAllReferrals((v) => !v) }}
                      className="w-full text-center text-[10px] text-[#D4AF37] hover:underline py-1"
                    >
                      {showAllReferrals ? 'Show less' : `View all ${referrals.length} referrals`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Public Identity (accordion) ───────────────────────────────── */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* Accordion header */}
          <button
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
            onClick={() => toggleSection('identity')}
          >
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-[#D4AF37] text-base">shield_person</span>
              <h3 className="text-sm font-bold text-white">Public Identity</h3>
              {displayPreference && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-gray-300 border border-white/15 capitalize">
                  {displayPreference}
                </span>
              )}
            </div>
            <span className="material-symbols-outlined text-gray-400 text-lg">
              {openSection === 'identity' ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {/* Expanded content */}
          {openSection === 'identity' && (
            <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
              <p className="text-[11px] text-gray-400 leading-relaxed">
                How you appear in leaderboards and community stats. By default your identity is hidden.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'address', label: 'Address', icon: 'account_balance_wallet',
                    preview: stellarAddress ? `${stellarAddress.slice(0,4)}…${stellarAddress.slice(-4)}` : 'G…XXXX' },
                  { value: 'name', label: 'Name', icon: 'person',
                    preview: tgUser?.firstName ?? 'First name' },
                  { value: 'username', label: 'Username', icon: 'alternate_email',
                    preview: tgUser?.username ? `@${tgUser.username}` : 'No username' },
                ] as const).map(({ value, label, icon, preview }) => {
                  const active = displayPreference === value
                  const unavailable = value === 'username' && !tgUser?.username
                  return (
                    <button
                      key={value}
                      disabled={unavailable}
                      onClick={() => handleDisplayPreference(value)}
                      className={`flex flex-col items-center p-2.5 rounded-xl border transition text-center ${
                        active
                          ? 'bg-[#D4AF37]/15 border-[#D4AF37]/50'
                          : unavailable
                            ? 'bg-white/2 border-white/5 opacity-40 cursor-not-allowed'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-lg ${active ? 'text-[#D4AF37]' : 'text-gray-400'}`}>
                        {icon}
                      </span>
                      <span className={`text-[10px] font-semibold mt-0.5 ${active ? 'text-[#D4AF37]' : 'text-gray-300'}`}>
                        {label}
                      </span>
                      <span className="text-[9px] text-gray-500 mt-0.5 truncate w-full">{preview}</span>
                      {active && (
                        <span className="material-symbols-outlined text-[#D4AF37] text-xs mt-0.5">check_circle</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Transaction History ────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-1.5">
              <span className="material-symbols-outlined text-[#D4AF37] text-base">receipt_long</span>
              <h3 className="text-sm font-bold text-white">Transactions</h3>
              <span className="text-[10px] text-gray-500">({visibleTxns.length})</span>
            </div>
            <button
              onClick={() => setHideSpam((v) => !v)}
              className={`flex items-center space-x-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border transition ${
                hideSpam
                  ? 'bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#D4AF37]'
                  : 'bg-white/5 border-white/10 text-gray-400'
              }`}
            >
              <span className="material-symbols-outlined text-[12px]">
                {hideSpam ? 'filter_alt' : 'filter_alt_off'}
              </span>
              <span>{hideSpam ? `Spam hidden (${spamCount})` : 'Show all'}</span>
            </button>
          </div>

          {loading ? (
            <div className="glass-card p-6 rounded-xl flex flex-col items-center justify-center space-y-2">
              <span
                className="material-symbols-outlined text-[#D4AF37] drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]"
                style={{ fontSize: 32, fontVariationSettings: "'FILL' 1", animation: 'football-throw 1.4s ease-in-out infinite' }}
              >
                sports_football
              </span>
              <p className="text-[10px] text-gray-500">Fetching transactions...</p>
            </div>
          ) : visibleTxns.length === 0 ? (
            <div className="glass-card p-6 rounded-xl text-center space-y-2">
              <span className="material-symbols-outlined text-gray-500 text-2xl">receipt_long</span>
              <p className="text-gray-400 text-xs">No transactions to show</p>
              {hideSpam && spamCount > 0 && (
                <button onClick={() => setHideSpam(false)} className="text-[#D4AF37] text-[10px] underline">
                  Show {spamCount} filtered transaction{spamCount > 1 ? 's' : ''}
                </button>
              )}
            </div>
          ) : (
            <div className="glass-card rounded-xl overflow-hidden divide-y divide-white/5">
              {visibleTxns.map((tx) => {
                const counterparty = tx.isIncoming ? tx.raw.from : tx.raw.to
                const { label: counterpartyLabel, isNamed } = counterparty
                  ? getCounterpartyLabel(counterparty)
                  : { label: '', isNamed: false }

                return (
                  <div
                    key={tx.id}
                    className={`px-3 py-2.5 flex items-center justify-between ${
                      tx.isSpam ? 'opacity-35' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        tx.isSpam
                          ? 'bg-gray-500/10'
                          : tx.isIncoming
                            ? 'bg-green-500/10'
                            : 'bg-red-500/10'
                      }`}>
                        <span className={`material-symbols-outlined text-[14px] ${
                          tx.isSpam ? 'text-gray-500' : tx.isIncoming ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {tx.isSpam ? 'block' : tx.isIncoming ? 'south_west' : 'north_east'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-semibold text-white">{tx.label}</span>
                          {tx.isSpam && (
                            <span className="text-[8px] px-1 py-px rounded bg-gray-500/20 text-gray-400 uppercase font-bold">
                              Spam
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1.5 mt-px">
                          {counterpartyLabel && (
                            <span className={`text-[9px] font-mono ${isNamed ? 'text-[#D4AF37] font-semibold' : 'text-gray-500'}`}>
                              {counterpartyLabel}
                            </span>
                          )}
                          <span className="text-[9px] text-gray-600">{tx.date}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                      <div className="text-right">
                        <p className={`text-xs font-bold ${
                          tx.isSpam ? 'text-gray-500' : tx.isIncoming ? 'text-green-400' : 'text-white'
                        }`}>
                          {tx.isIncoming ? '+' : '-'}{tx.amount}
                        </p>
                      </div>
                      {/* Stellar expert link */}
                      <button
                        onClick={() => {
                          haptic.light()
                          window.open(`https://stellar.expert/explorer/public/tx/${tx.id}`, '_blank')
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition flex-shrink-0"
                        aria-label="View on Stellar Expert"
                      >
                        <span className="material-symbols-outlined text-gray-500 hover:text-[#D4AF37] text-[13px] transition">open_in_new</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Load more */}
          {hasMore && !loading && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full glass-card border border-white/10 rounded-xl py-2.5 flex items-center justify-center space-x-2 hover:bg-white/5 transition text-xs text-gray-300 disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <span className="material-symbols-outlined text-[#D4AF37] text-sm animate-spin">progress_activity</span>
                  <span>Loading…</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-gray-400 text-sm">expand_more</span>
                  <span>Load more transactions</span>
                </>
              )}
            </button>
          )}

          {!hasMore && allTxns.length > 0 && (
            <p className="text-center text-[10px] text-gray-600 py-1">All transactions loaded</p>
          )}
        </div>

      </main>
      <BottomNav />

      {/* ── Full-screen team change overlay ─────────────────────── */}
      {changingTeam && (
        <div className="fixed inset-0 z-[100] bg-[#0A0E1A] overflow-y-auto">
          <button
            onClick={() => setChangingTeam(false)}
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-xl glass-card flex items-center justify-center border border-white/10 hover:bg-white/10 transition"
          >
            <span className="material-symbols-outlined text-white text-lg">close</span>
          </button>
          <TeamSelectScreen onSelect={handleTeamChangeRequest} />
        </div>
      )}
    </WalletGuard>
  )
}

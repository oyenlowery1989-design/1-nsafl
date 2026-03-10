'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTelegramBack } from '@/hooks/useTelegramBack'
import BottomNav from '@/components/BottomNav'
import WalletGuard from '@/components/WalletGuard'
import PageLoader, { useMinLoader } from '@/components/PageLoader'
import { useWalletStore } from '@/hooks/useStore'
import { getTierForBalance, getNextTier, TIERS, type Tier } from '@/config/tiers'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'
import { AFL_CLUBS } from '@/config/afl'
import { AFL_PLAYERS } from '@/config/afl-players'
import { haptic } from '@/lib/telegram-ui'
import { toast } from '@/components/Toast'


function getTierStatus(tier: Tier, currentTier: Tier, nextTier: Tier | null): 'current' | 'past' | 'next' | 'locked' {
  if (tier.id === currentTier.id) return 'current'
  const tierIdx = TIERS.findIndex((t) => t.id === tier.id)
  const currentIdx = TIERS.findIndex((t) => t.id === currentTier.id)
  if (tierIdx < currentIdx) return 'past'
  if (nextTier && tier.id === nextTier.id) return 'next'
  return 'locked'
}

interface TierCardProps {
  tier: Tier
  status: 'current' | 'past' | 'next' | 'locked'
  balance: number
}

function TierCard({ tier, status, balance }: TierCardProps) {
  const r = tier.rewards
  const isExpanded = status !== 'locked'
  const toUnlock = tier.minBalance - balance

  const borderStyle =
    status === 'current'
      ? { border: `1px solid ${tier.color}`, boxShadow: `0 0 20px ${tier.glowColor}` }
      : status === 'next'
      ? { border: '1px solid #F59E0B55' }
      : {}

  const containerClass =
    status === 'locked'
      ? 'glass-card rounded-xl p-4 opacity-50'
      : 'glass-card rounded-xl p-4'

  return (
    <div className={containerClass} style={borderStyle}>
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{tier.emoji}</span>
          <div>
            <h3 className="font-bold text-white text-sm">{tier.label}</h3>
            <p className="text-[11px] text-gray-400">
              {tier.maxBalance
                ? `${tier.minBalance.toLocaleString()} – ${tier.maxBalance.toLocaleString()} ${PRIMARY_CUSTOM_ASSET_LABEL}`
                : `${tier.minBalance.toLocaleString()}+ ${PRIMARY_CUSTOM_ASSET_LABEL}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {status === 'current' && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-black"
              style={{ background: tier.color }}
            >
              YOUR TIER
            </span>
          )}
          {status === 'next' && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-black">
              NEXT
            </span>
          )}
          {status === 'past' && (
            <span
              className="material-symbols-outlined text-base"
              style={{ color: tier.color, fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
          )}
          {status === 'locked' && (
            <span className="material-symbols-outlined text-base text-gray-500">lock</span>
          )}
        </div>
      </div>

      {/* Locked summary */}
      {!isExpanded && (
        <p className="text-[11px] text-gray-500 mt-2">
          {r?.treasury ?? `No rewards — hold ${tier.minBalance.toLocaleString()} ${PRIMARY_CUSTOM_ASSET_LABEL} to start`}
        </p>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-3 space-y-1.5">
          {r === null ? (
            <p className="text-xs text-gray-400">
              Hold {tier.minBalance > 0 ? `${tier.minBalance.toLocaleString()} ` : '50 '}{PRIMARY_CUSTOM_ASSET_LABEL} to unlock Tier 1 and claim your stock exchange share.
            </p>
          ) : (
            <>
              {/* Stock exchange share — primary reward */}
              <div className="flex items-center gap-2 bg-[#D4AF37]/8 border border-[#D4AF37]/20 rounded-lg px-3 py-2">
                <span className="material-symbols-outlined text-[#D4AF37] text-base flex-shrink-0">show_chart</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold leading-none mb-0.5">
                    Exchange Share
                  </p>
                  <p className="text-sm text-[#D4AF37] font-bold truncate">
                    {r.treasury ?? '—'}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* FOMO prompt for next tier */}
          {status === 'next' && toUnlock > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10 text-center">
              <p className="text-[11px] text-amber-400 font-semibold">
                Hold {toUnlock.toLocaleString()} more {PRIMARY_CUSTOM_ASSET_LABEL} to unlock!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const SUPPORTER_WALLET = process.env.NEXT_PUBLIC_PRIMARY_ASSET_ISSUER ?? 'GAWZCHDWMK43M6MZ2AX7AX52M7M5JLBJYTOEO3SV4LIMI6HJVJRYSY2Z'

type DonationType = 'general' | 'team' | 'player' | null

function DonationSection({ stellarAddress }: { stellarAddress: string | null }) {
  const [donationType, setDonationType] = useState<DonationType>(null)
  const [selectedClub, setSelectedClub] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState('') // from list or '__custom__'
  const [customPlayer, setCustomPlayer] = useState('')
  const [amount, setAmount] = useState('')
  const [txHash, setTxHash] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  // Resolved player name — either from list or custom input
  const playerName = selectedPlayer === '__custom__' ? customPlayer.trim() : selectedPlayer

  // Sorted full player list for the dropdown (all clubs combined)
  const allPlayers = [...AFL_PLAYERS].sort((a, b) => a.name.localeCompare(b.name))

  const truncatedWallet = SUPPORTER_WALLET.length > 12
    ? `${SUPPORTER_WALLET.slice(0, 6)}...${SUPPORTER_WALLET.slice(-6)}`
    : SUPPORTER_WALLET

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORTER_WALLET)
      haptic.selection()
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const handleSubmit = async () => {
    if (!stellarAddress) {
      haptic.error()
      toast.error('Connect your wallet first')
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      haptic.error()
      toast.error('Enter a valid amount')
      return
    }
    if (!txHash.trim()) {
      haptic.error()
      toast.error('Paste your transaction hash')
      return
    }

    // For team: use club name; for player: use resolved name; for general: undefined
    const teamName = AFL_CLUBS.find((c) => c.id === selectedClub)?.name ?? selectedClub
    const donationTarget = donationType === 'team' ? teamName
      : donationType === 'player' ? playerName
      : undefined

    if (donationType === 'team' && !selectedClub) {
      haptic.error()
      toast.error('Select a team')
      return
    }
    if (donationType === 'player' && !playerName) {
      haptic.error()
      toast.error('Select or enter a player name')
      return
    }

    haptic.medium()
    setSubmitting(true)

    try {
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stellarAddress,
          amount: parseFloat(amount),
          donationType,
          donationTarget,
          txHash: txHash.trim(),
        }),
      })
      const json = await res.json()
      if (json.success) {
        haptic.success()
        toast.success(json.data.verified
          ? 'Donation verified and recorded!'
          : 'Donation recorded — pending verification.')
        setAmount('')
        setTxHash('')
        setSelectedPlayer('')
        setCustomPlayer('')
        setSelectedClub('')
        setDonationType(null)
      } else {
        haptic.error()
        toast.error(json.error ?? 'Failed to record donation')
      }
    } catch {
      haptic.error()
      toast.error('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section>
      <div className="flex items-center space-x-2 mb-4">
        <span className="material-symbols-outlined text-[#D4AF37]">volunteer_activism</span>
        <h3 className="text-xl font-bold text-white">Support the Movement</h3>
      </div>

      {/* Intro card */}
      <div className="glass-card p-4 rounded-xl mb-4" style={{ borderLeft: '3px solid #D4AF37' }}>
        <p className="text-sm text-gray-300 leading-relaxed">
          Donate {PRIMARY_CUSTOM_ASSET_LABEL} to support AFL homecoming campaigns.
          Choose a general donation, back a specific team, or champion a player&apos;s return.
        </p>
      </div>

      {/* Donation type buttons */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {([
          { type: 'general' as const, label: 'AFL General', icon: 'sports_football' },
          { type: 'team' as const, label: 'Team', icon: 'stadium' },
          { type: 'player' as const, label: 'Player', icon: 'person' },
        ]).map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => setDonationType(donationType === type ? null : type)}
            className={`glass-card p-3 rounded-xl text-center transition-all ${
              donationType === type
                ? 'border-[#D4AF37] bg-[#D4AF37]/10 border'
                : 'border border-white/10 hover:bg-white/5'
            }`}
          >
            <span className={`material-symbols-outlined text-lg ${
              donationType === type ? 'text-[#D4AF37]' : 'text-gray-400'
            }`}>{icon}</span>
            <p className={`text-[10px] mt-1 font-semibold ${
              donationType === type ? 'text-[#D4AF37]' : 'text-gray-400'
            }`}>{label}</p>
          </button>
        ))}
      </div>

      {/* Form — shown when a type is selected */}
      {donationType && (
        <div className="glass-card p-4 rounded-xl space-y-3">
          {/* Team selector */}
          {donationType === 'team' && (
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">
                Select Team
              </label>
              <select
                value={selectedClub}
                onChange={(e) => setSelectedClub(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4AF37]/50 appearance-none"
              >
                <option value="" className="bg-[#0A0E1A]">Choose a club...</option>
                {AFL_CLUBS.map((club) => (
                  <option key={club.id} value={club.id} className="bg-[#0A0E1A]">
                    {club.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Player selector */}
          {donationType === 'player' && (
            <div className="space-y-2">
              <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">
                Select Player
              </label>
              <select
                value={selectedPlayer}
                onChange={(e) => { setSelectedPlayer(e.target.value); setCustomPlayer('') }}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4AF37]/50 appearance-none"
              >
                <option value="" className="bg-[#0A0E1A]">Choose a player...</option>
                {allPlayers.map((p) => (
                  <option key={p.name} value={p.name} className="bg-[#0A0E1A]">
                    {p.name}
                  </option>
                ))}
                <option value="__custom__" className="bg-[#0A0E1A]">✏️ Enter custom name...</option>
              </select>
              {selectedPlayer === '__custom__' && (
                <input
                  type="text"
                  value={customPlayer}
                  onChange={(e) => setCustomPlayer(e.target.value)}
                  placeholder="e.g. Patrick Ryder"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/50"
                />
              )}
            </div>
          )}

          {/* Supporter wallet address */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">
              Send {PRIMARY_CUSTOM_ASSET_LABEL} to
            </label>
            <div className="flex items-center space-x-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-300 font-mono flex-1 truncate">{truncatedWallet}</span>
              <button
                onClick={handleCopy}
                className="text-[#D4AF37] hover:text-[#D4AF37]/80 transition flex-shrink-0"
              >
                <span className="material-symbols-outlined text-base">
                  {copied ? 'check' : 'content_copy'}
                </span>
              </button>
            </div>
          </div>

          {/* Auto-generated memo */}
          {(() => {
            const teamName2 = AFL_CLUBS.find((c) => c.id === selectedClub)?.name ?? ''
            const memo = donationType === 'team' && teamName2
              ? teamName2
              : donationType === 'player' && playerName
              ? playerName
              : 'GENERAL'
            const memoReady = donationType === 'general' ||
              (donationType === 'team' && !!teamName2) ||
              (donationType === 'player' && !!playerName)
            return (
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">
                  Memo (include when sending)
                </label>
                <div className="flex items-center space-x-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                  <span className={`text-xs font-mono flex-1 ${memoReady ? 'text-[#D4AF37]' : 'text-gray-500'}`}>
                    {memoReady ? memo : '—'}
                  </span>
                  {memoReady && (
                    <button
                      onClick={async () => { try { await navigator.clipboard.writeText(memo) } catch {} }}
                      className="text-[#D4AF37] hover:text-[#D4AF37]/80 transition flex-shrink-0"
                    >
                      <span className="material-symbols-outlined text-base">content_copy</span>
                    </button>
                  )}
                </div>
                <p className="text-[9px] text-gray-500 mt-1">Add this memo to your Stellar transaction so we can track your cause</p>
              </div>
            )
          })()}

          {/* Amount input */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">
              Amount ({PRIMARY_CUSTOM_ASSET_LABEL})
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="any"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/50"
            />
          </div>

          {/* Transaction hash input */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">
              Stellar Transaction Hash
            </label>
            <input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="Paste your tx hash after sending..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/50 font-mono text-[11px]"
            />
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 active:scale-[0.98]"
          >
            {submitting ? (
              <span className="flex items-center justify-center space-x-2">
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                <span>Verifying...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center space-x-2">
                <span className="material-symbols-outlined text-base">verified</span>
                <span>Verify &amp; Record Donation</span>
              </span>
            )}
          </button>

        </div>
      )}
    </section>
  )
}

export default function RewardsPage() {
  const router = useRouter()
  useTelegramBack(() => router.back())
  const ready = useMinLoader(true)
  const tokenBalance = useWalletStore((s) => s.tokenBalance)
  const stellarAddress = useWalletStore((s) => s.stellarAddress)
  const balance = parseFloat(tokenBalance) || 0
  const currentTier = getTierForBalance(balance)
  const nextTier = getNextTier(currentTier)
  const toNext = nextTier ? nextTier.minBalance - balance : 0
  const progressPct = nextTier
    ? Math.min(
        100,
        ((balance - currentTier.minBalance) / (nextTier.minBalance - currentTier.minBalance)) * 100,
      )
    : 100

  if (!ready) {
    return (
      <WalletGuard>
        <PageLoader label="Loading rewards…" />
        <BottomNav />
      </WalletGuard>
    )
  }

  return (
    <WalletGuard>
      <header className="pt-3 pb-2 px-4 sticky top-0 z-20 bg-[#0A0E1A] border-b border-white/10">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-lg glass-card flex items-center justify-center hover:bg-white/10 transition"
          >
            <span className="material-symbols-outlined text-white">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Rewards</h1>
            <p className="text-sm text-[#D4AF37] font-medium">Stock Exchange Shares &amp; Tier Roadmap</p>
          </div>
        </div>
      </header>

      <main className="px-6 pt-4 pb-32 space-y-6">
        {/* Section 1 — Current Tier Status */}
        <div
          className="glass-card p-5 rounded-2xl relative overflow-hidden"
          style={{ border: `1px solid ${currentTier.color}55` }}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <span className="material-symbols-outlined text-8xl text-[#D4AF37]">show_chart</span>
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{currentTier.emoji}</span>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Current Tier</p>
                <h2 className="text-xl font-bold" style={{ color: currentTier.color }}>
                  {currentTier.label}
                </h2>
              </div>
            </div>

            {/* Stock exchange share for current tier */}
            {currentTier.rewards?.treasury && (
              <div className="flex items-center gap-2 mt-2 mb-1">
                <span className="material-symbols-outlined text-[#D4AF37] text-sm">trending_up</span>
                <p className="text-sm font-bold text-[#D4AF37]">{currentTier.rewards.treasury}</p>
              </div>
            )}

            {currentTier.id === 'pre-tier' ? (
              <p className="text-sm text-gray-400 mt-2">
                Hold 50 {PRIMARY_CUSTOM_ASSET_LABEL} to enter{' '}
                <span className="text-[#F97316] font-semibold">Tier 1</span> and claim your stock exchange share.
              </p>
            ) : nextTier ? (
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-gray-300">
                    {balance.toFixed(0)} {PRIMARY_CUSTOM_ASSET_LABEL}
                  </span>
                  <span className="text-gray-400">Next: {nextTier.label}</span>
                </div>
                <div className="w-full bg-[#0A0E1A] rounded-full h-2.5 border border-white/10">
                  <div
                    className="h-2.5 rounded-full transition-all"
                    style={{ width: `${progressPct}%`, background: currentTier.color }}
                  />
                </div>
                <p className="text-[10px] text-gray-500 text-right">
                  {toNext.toLocaleString()} more {PRIMARY_CUSTOM_ASSET_LABEL} to {nextTier.label}
                </p>
              </div>
            ) : (
              <p className="text-xs text-emerald-400 mt-2 font-semibold">
                Maximum tier reached — all rewards unlocked!
              </p>
            )}
          </div>
        </div>

        {/* Buy CTA — Level Up */}
        <div className="glass-card rounded-xl p-4 text-center border border-[#D4AF37]/20 bg-gradient-to-br from-[#D4AF37]/5 to-transparent">
          <p className="text-xs text-gray-300 mb-2">
            {nextTier
              ? <>Hold <span className="text-[#D4AF37] font-bold">{toNext.toLocaleString()}</span> more {PRIMARY_CUSTOM_ASSET_LABEL} to reach <span className="font-bold" style={{ color: nextTier.color }}>{nextTier.label}</span> and unlock a larger stock exchange share{nextTier.rewards?.treasury ? ` (${nextTier.rewards.treasury})` : ''}.</>
              : 'You\'ve reached the top tier! Maximum stock exchange share unlocked.'}
          </p>
          <button
            onClick={() => router.push('/buy')}
            className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-lg bg-[#D4AF37] text-black text-xs font-bold hover:bg-[#D4AF37]/90 transition active:scale-[0.98] shadow-[0_4px_20px_rgba(212,175,55,0.25)]"
          >
            <span className="material-symbols-outlined text-sm">rocket_launch</span>
            <span>Buy {PRIMARY_CUSTOM_ASSET_LABEL} & Level Up</span>
          </button>
        </div>

        {/* Section 2 — Tier Roadmap */}
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <span className="material-symbols-outlined text-[#D4AF37]">show_chart</span>
            <h3 className="text-xl font-bold text-white">Exchange Share Tiers</h3>
          </div>
          <div className="space-y-3">
            {TIERS.filter((tier) => getTierStatus(tier, currentTier, nextTier) !== 'past').map((tier) => {
              const status = getTierStatus(tier, currentTier, nextTier)
              return (
                <TierCard key={tier.id} tier={tier} status={status} balance={balance} />
              )
            })}
          </div>
        </section>

        {/* Section 3 — Support the Movement (Donations) */}
        <DonationSection stellarAddress={stellarAddress} />

      </main>

      <BottomNav />
    </WalletGuard>
  )
}

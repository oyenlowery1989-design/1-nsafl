'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTelegramBack } from '@/hooks/useTelegramBack'
import BottomNav from '@/components/BottomNav'
import WalletGuard from '@/components/WalletGuard'
import { useWalletStore } from '@/hooks/useStore'
import { ALL_CLUBS, AFL_CLUBS, WAFL_CLUBS } from '@/config/afl'
import { AFL_PLAYERS } from '@/config/afl-players'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'
import { haptic } from '@/lib/telegram-ui'
import { toast } from '@/components/Toast'

const SUPPORTER_WALLET = process.env.NEXT_PUBLIC_PRIMARY_ASSET_ISSUER ?? 'GAWZCHDWMK43M6MZ2AX7AX52M7M5JLBJYTOEO3SV4LIMI6HJVJRYSY2Z'

type DonationType = 'general' | 'team' | 'player' | null

export default function DonatePage() {
  const router = useRouter()
  useTelegramBack(() => router.back())
  const stellarAddress = useWalletStore((s) => s.stellarAddress)

  const [donationType, setDonationType] = useState<DonationType>(null)
  const [selectedClub, setSelectedClub] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [customPlayer, setCustomPlayer] = useState('')
  const [amount, setAmount] = useState('')
  const [txHash, setTxHash] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedMemo, setCopiedMemo] = useState(false)

  const allPlayers = [...AFL_PLAYERS].sort((a, b) => a.name.localeCompare(b.name))
  const playerName = selectedPlayer === '__custom__' ? customPlayer.trim() : selectedPlayer

  const truncatedWallet = `${SUPPORTER_WALLET.slice(0, 6)}...${SUPPORTER_WALLET.slice(-6)}`

  const teamName = ALL_CLUBS.find((c) => c.id === selectedClub)?.name ?? selectedClub
  const memo = donationType === 'team' && teamName
    ? teamName
    : donationType === 'player' && playerName
    ? playerName
    : 'GENERAL'
  const memoReady = donationType === 'general' ||
    (donationType === 'team' && !!teamName) ||
    (donationType === 'player' && !!playerName)

  async function handleCopy() {
    try { await navigator.clipboard.writeText(SUPPORTER_WALLET); haptic.selection(); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }
  async function handleCopyMemo() {
    try { await navigator.clipboard.writeText(memo); haptic.selection(); setCopiedMemo(true); setTimeout(() => setCopiedMemo(false), 2000) } catch {}
  }

  async function handleSubmit() {
    if (!stellarAddress) { haptic.error(); toast.error('Connect your wallet first'); return }
    if (!amount || parseFloat(amount) <= 0) { haptic.error(); toast.error('Enter a valid amount'); return }
    if (!txHash.trim()) { haptic.error(); toast.error('Paste your transaction hash'); return }
    if (donationType === 'team' && !selectedClub) { haptic.error(); toast.error('Select a team'); return }
    if (donationType === 'player' && !playerName) { haptic.error(); toast.error('Select or enter a player name'); return }

    haptic.medium()
    setSubmitting(true)
    try {
      const donationTarget = donationType === 'team' ? teamName
        : donationType === 'player' ? playerName
        : undefined
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stellarAddress, amount: parseFloat(amount), donationType, donationTarget, txHash: txHash.trim() }),
      })
      const json = await res.json()
      if (json.success) {
        haptic.success()
        toast.success(json.data.verified ? 'Donation verified and recorded!' : 'Donation recorded — pending verification.')
        setAmount(''); setTxHash(''); setSelectedPlayer(''); setCustomPlayer(''); setSelectedClub(''); setDonationType(null)
      } else {
        haptic.error(); toast.error(json.error ?? 'Failed to record donation')
      }
    } catch {
      haptic.error(); toast.error('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <WalletGuard>
      {/* Header */}
      <header className="pt-3 pb-2 px-4 sticky top-0 z-10 bg-[#0A0E1A] border-b border-white/10">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-white text-base">arrow_back</span>
          </button>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Support the Movement</h1>
            <p className="text-xs text-[#D4AF37] font-medium">Donate {PRIMARY_CUSTOM_ASSET_LABEL} to AFL campaigns</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 pb-28">
        {/* Intro */}
        <div className="glass-card p-4 rounded-xl" style={{ borderLeft: '3px solid #D4AF37' }}>
          <p className="text-sm text-gray-300 leading-relaxed">
            Choose a general donation, back a specific team, or champion a player&apos;s return home.
            Top donors get featured on the <span className="text-[#D4AF37] font-semibold">Top Supporters</span> board.
          </p>
        </div>

        {/* Donation type */}
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">What are you supporting?</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { type: 'general' as const, label: 'AFL General', icon: 'sports_football' },
              { type: 'team'    as const, label: 'A Team',      icon: 'stadium' },
              { type: 'player' as const, label: 'A Player',    icon: 'person' },
            ]).map(({ type, label, icon }) => (
              <button
                key={type}
                onClick={() => { setDonationType(donationType === type ? null : type); setSelectedClub(''); setSelectedPlayer(''); setCustomPlayer('') }}
                className={`glass-card p-3 rounded-xl text-center transition-all ${
                  donationType === type ? 'border border-[#D4AF37] bg-[#D4AF37]/10' : 'border border-white/10'
                }`}
              >
                <span className={`material-symbols-outlined text-lg ${donationType === type ? 'text-[#D4AF37]' : 'text-gray-400'}`}>{icon}</span>
                <p className={`text-[10px] mt-1 font-semibold ${donationType === type ? 'text-[#D4AF37]' : 'text-gray-400'}`}>{label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        {donationType && (
          <div className="glass-card p-4 rounded-xl space-y-4">
            {/* Team selector */}
            {donationType === 'team' && (
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5 block">Select Team</label>
                <select
                  value={selectedClub}
                  onChange={(e) => setSelectedClub(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]/50 appearance-none"
                >
                  <option value="" className="bg-[#0A0E1A]">Choose a club...</option>
                  <optgroup label="AFL">
                    {AFL_CLUBS.map((c) => <option key={c.id} value={c.id} className="bg-[#0A0E1A]">{c.name}</option>)}
                  </optgroup>
                  <optgroup label="WAFL">
                    {WAFL_CLUBS.map((c) => <option key={c.id} value={c.id} className="bg-[#0A0E1A]">{c.name}</option>)}
                  </optgroup>
                </select>
              </div>
            )}

            {/* Player selector */}
            {donationType === 'player' && (
              <div className="space-y-2">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5 block">Select Player</label>
                <select
                  value={selectedPlayer}
                  onChange={(e) => { setSelectedPlayer(e.target.value); setCustomPlayer('') }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]/50 appearance-none"
                >
                  <option value="" className="bg-[#0A0E1A]">Choose a player...</option>
                  {allPlayers.map((p) => <option key={p.name} value={p.name} className="bg-[#0A0E1A]">{p.name}</option>)}
                  <option value="__custom__" className="bg-[#0A0E1A]">✏️ Enter custom name...</option>
                </select>
                {selectedPlayer === '__custom__' && (
                  <input
                    type="text" value={customPlayer} onChange={(e) => setCustomPlayer(e.target.value)}
                    placeholder="e.g. Patrick Ryder"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/50"
                  />
                )}
              </div>
            )}

            {/* Send to wallet */}
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5 block">
                Send {PRIMARY_CUSTOM_ASSET_LABEL} to
              </label>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5">
                <span className="text-xs text-gray-300 font-mono flex-1 truncate">{truncatedWallet}</span>
                <button onClick={handleCopy} className="text-[#D4AF37] flex-shrink-0">
                  <span className="material-symbols-outlined text-base">{copied ? 'check' : 'content_copy'}</span>
                </button>
              </div>
            </div>

            {/* Memo */}
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5 block">
                Memo (include when sending)
              </label>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5">
                <span className={`text-xs font-mono flex-1 ${memoReady ? 'text-[#D4AF37]' : 'text-gray-500'}`}>
                  {memoReady ? memo : '—'}
                </span>
                {memoReady && (
                  <button onClick={handleCopyMemo} className="text-[#D4AF37] flex-shrink-0">
                    <span className="material-symbols-outlined text-base">{copiedMemo ? 'check' : 'content_copy'}</span>
                  </button>
                )}
              </div>
              <p className="text-[9px] text-gray-500 mt-1">Include this memo in your Stellar transaction so we can track your cause</p>
            </div>

            {/* Amount */}
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5 block">
                Amount ({PRIMARY_CUSTOM_ASSET_LABEL})
              </label>
              <input
                type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00" min="0" step="any"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/50"
              />
            </div>

            {/* Tx hash */}
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5 block">
                Stellar Transaction Hash
              </label>
              <input
                type="text" value={txHash} onChange={(e) => setTxHash(e.target.value)}
                placeholder="Paste your tx hash after sending..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/50 font-mono text-[11px]"
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 active:scale-[0.98] shadow-[0_4px_20px_rgba(212,175,55,0.3)]"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  Verifying...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-base">verified</span>
                  Verify &amp; Record Donation
                </span>
              )}
            </button>
          </div>
        )}
      </main>

      <BottomNav />
    </WalletGuard>
  )
}

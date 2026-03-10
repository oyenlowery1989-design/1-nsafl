'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTelegramBack } from '@/hooks/useTelegramBack'
import BottomNav from '@/components/BottomNav'
import WalletGuard from '@/components/WalletGuard'
import PageLoader, { useMinLoader } from '@/components/PageLoader'
import { useWalletStore } from '@/hooks/useStore'
import { getTierForBalance, getNextTier } from '@/config/tiers'
import { PRIMARY_CUSTOM_ASSET_LABEL, PRIMARY_CUSTOM_ASSET_CODE, PRIMARY_CUSTOM_ASSET_ISSUER } from '@/lib/constants'
import { toast } from '@/components/Toast'
import { haptic } from '@/lib/telegram-ui'

const XLM_TO_TOKEN_RATE = parseInt(process.env.NEXT_PUBLIC_XLM_TO_TOKEN_RATE ?? '1', 10)

const DIRECT_BUY_ADDRESS =
  process.env.NEXT_PUBLIC_DIRECT_BUY_XLM_ADDRESS ??
  'GAWZCHDWMK43M6MZ2AX7AX52M7M5JLBJYTOEO3SV4LIMI6HJVJRYSY2Z'

const LOBSTR_URL =
  `https://lobstr.co/trade/${PRIMARY_CUSTOM_ASSET_CODE}:${PRIMARY_CUSTOM_ASSET_ISSUER}`

const SCOPULY_URL =
  `https://scopuly.com/trade/${PRIMARY_CUSTOM_ASSET_CODE}-${PRIMARY_CUSTOM_ASSET_ISSUER}/XLM-native`

export default function BuyPage() {
  const router = useRouter()
  useTelegramBack(() => router.back())
  const ready = useMinLoader(true)
  const tokenBalance = useWalletStore((s) => s.tokenBalance)
  const stellarAddress = useWalletStore((s) => s.stellarAddress)
  const balance = parseFloat(tokenBalance) || 0
  const currentTier = getTierForBalance(balance)
  const nextTier = getNextTier(currentTier)
  const toNextTier = nextTier ? Math.max(0, nextTier.minBalance - balance) : 0

  // Direct buy form state
  const [xlmAmount, setXlmAmount] = useState('')
  const [txHash, setTxHash] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  // Advanced section state
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [advSecretKey, setAdvSecretKey] = useState('')
  const [advAmount, setAdvAmount] = useState('')
  const [advSubmitting, setAdvSubmitting] = useState(false)

  const calculatedTokens = xlmAmount ? (parseFloat(xlmAmount) * XLM_TO_TOKEN_RATE).toFixed(2) : '0.00'

  const truncatedAddress =
    DIRECT_BUY_ADDRESS.length > 12
      ? `${DIRECT_BUY_ADDRESS.slice(0, 6)}...${DIRECT_BUY_ADDRESS.slice(-6)}`
      : DIRECT_BUY_ADDRESS

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(DIRECT_BUY_ADDRESS)
      haptic.selection()
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const handleDirectBuy = async () => {
    if (!stellarAddress) {
      haptic.error(); toast.error('Connect your wallet first'); return
    }
    if (!xlmAmount || parseFloat(xlmAmount) <= 0) {
      haptic.error(); toast.error('Enter a valid XLM amount'); return
    }
    if (!txHash.trim()) {
      haptic.error(); toast.error('Paste your transaction hash'); return
    }

    haptic.medium()
    setSubmitting(true)

    try {
      const res = await fetch('/api/buy/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stellarAddress,
          xlmAmount: parseFloat(xlmAmount),
          txHash: txHash.trim(),
        }),
      })
      const json = await res.json()
      if (json.success) {
        haptic.success()
        toast.success(json.data.verified
          ? 'Purchase verified and recorded!'
          : 'Purchase recorded — pending verification.')
        setXlmAmount('')
        setTxHash('')
      } else {
        haptic.error()
        toast.error(json.error ?? 'Failed to record purchase')
      }
    } catch {
      haptic.error()
      toast.error('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAdvancedBuy = async () => {
    if (!advSecretKey.trim() || !advAmount || parseFloat(advAmount) <= 0) {
      haptic.error(); toast.error('Enter secret key and a valid amount'); return
    }

    haptic.medium()
    setAdvSubmitting(true)

    try {
      const res = await fetch('/api/buy/advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secretKey: advSecretKey.trim(),
          amount: parseFloat(advAmount),
        }),
      })
      const json = await res.json()
      if (json.success) {
        haptic.success()
        toast.success('Purchase executed successfully!')
        setAdvSecretKey('')
        setAdvAmount('')
      } else {
        haptic.error()
        toast.error(json.error ?? 'Advanced purchase failed')
      }
    } catch {
      haptic.error()
      toast.error('Network error — please try again')
    } finally {
      setAdvSubmitting(false)
    }
  }

  if (!ready) {
    return (
      <WalletGuard>
        <PageLoader label="Loading…" />
        <BottomNav />
      </WalletGuard>
    )
  }

  return (
    <WalletGuard>
      <header className="pt-3 pb-2 px-4 sticky top-0 z-20 bg-[#0A0E1A] border-b border-white/10">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-lg glass-card flex items-center justify-center hover:bg-white/10 transition"
          >
            <span className="material-symbols-outlined text-white text-lg">arrow_back</span>
          </button>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Buy {PRIMARY_CUSTOM_ASSET_LABEL}
            </h1>
            <p className="text-[11px] text-gray-400">
              {balance.toLocaleString()} {PRIMARY_CUSTOM_ASSET_LABEL} held
              {nextTier && (
                <span className="text-[#D4AF37]">
                  {' '}· {toNextTier.toLocaleString()} to {nextTier.label}
                </span>
              )}
            </p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 pb-28">
        {/* Tier Promotion Banner */}
        {nextTier && (
          <div
            className="glass-card rounded-xl p-4 relative overflow-hidden"
            style={{ border: '1px solid rgba(212,175,55,0.3)' }}
          >
            <div className="absolute -right-6 -top-6 w-28 h-28 bg-[#D4AF37]/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-xl">{currentTier.emoji}</span>
                <span className="material-symbols-outlined text-[#D4AF37] text-base">arrow_forward</span>
                <span className="text-xl">{nextTier.emoji}</span>
              </div>
              <p className="text-sm text-white font-semibold mb-1">
                Upgrade to <span style={{ color: nextTier.color }}>{nextTier.label}</span>
              </p>
              <p className="text-xs text-gray-400 mb-2">
                Buy {toNextTier.toLocaleString()} more {PRIMARY_CUSTOM_ASSET_LABEL} to unlock{' '}
                {nextTier.rewards
                  ? `+${nextTier.rewards.xlmRefundPct}% XLM Refund, ${nextTier.rewards.gold} oz Gold, and more`
                  : 'the next level of rewards'}
              </p>
              {/* Mini progress */}
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${nextTier ? Math.min(100, ((balance - currentTier.minBalance) / (nextTier.minBalance - currentTier.minBalance)) * 100) : 100}%`,
                    background: `linear-gradient(90deg, ${currentTier.color}, #D4AF37)`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 1 — Buy on Lobstr */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-400">swap_horiz</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Buy on Lobstr</h3>
              <p className="text-[11px] text-gray-400">Most popular Stellar DEX wallet</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Trade {PRIMARY_CUSTOM_ASSET_LABEL} on Lobstr — the most popular Stellar DEX wallet.
            Simple interface, fast trades.
          </p>
          <a
            href={LOBSTR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center space-x-2 w-full py-2.5 rounded-lg font-semibold text-sm bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
            <span>Trade on Lobstr</span>
          </a>
        </div>

        {/* Section 2 — Buy on Scopuly */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-purple-400">candlestick_chart</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Buy on Scopuly</h3>
              <p className="text-[11px] text-gray-400">Advanced Stellar DEX trading</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Trade {PRIMARY_CUSTOM_ASSET_LABEL} on Scopuly — advanced Stellar DEX trading with
            charts, order books, and more.
          </p>
          <a
            href={SCOPULY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center space-x-2 w-full py-2.5 rounded-lg font-semibold text-sm bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
            <span>Trade on Scopuly</span>
          </a>
        </div>

        {/* Section 3 — Buy Direct with XLM */}
        <div className="glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#D4AF37]">account_balance_wallet</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Buy Direct with XLM</h3>
              <p className="text-[11px] text-gray-400">Send XLM, receive {PRIMARY_CUSTOM_ASSET_CODE}</p>
            </div>
          </div>

          {/* Rate info */}
          <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/20">
            <span className="material-symbols-outlined text-[#D4AF37] text-sm">info</span>
            <p className="text-[11px] text-[#D4AF37]">
              Rate: 1 XLM = {XLM_TO_TOKEN_RATE} {PRIMARY_CUSTOM_ASSET_CODE}
            </p>
          </div>

          {/* Payment address */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">
              Send XLM to
            </label>
            <div className="flex items-center space-x-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-300 font-mono flex-1 truncate">{truncatedAddress}</span>
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

          {/* XLM amount input */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">
              XLM Amount
            </label>
            <input
              type="number"
              value={xlmAmount}
              onChange={(e) => setXlmAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="any"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/50"
            />
          </div>

          {/* Calculated token amount */}
          {xlmAmount && parseFloat(xlmAmount) > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10">
              <span className="text-xs text-gray-400">You&apos;ll receive</span>
              <span className="text-sm font-bold text-[#D4AF37]">
                {parseFloat(calculatedTokens).toLocaleString()} {PRIMARY_CUSTOM_ASSET_LABEL}
              </span>
            </div>
          )}

          {/* Instructions */}
          <p className="text-[11px] text-gray-500">
            Send XLM to the address above, then paste your transaction hash below to verify.
          </p>

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
            onClick={handleDirectBuy}
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
                <span>Verify Purchase</span>
              </span>
            )}
          </button>

        </div>

        {/* Section 4 — Advanced (Admin Only) */}
        <div className="glass-card rounded-xl overflow-hidden">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
          >
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-gray-500 text-lg">admin_panel_settings</span>
              <span className="text-sm text-gray-400 font-semibold">Advanced Purchase (Admin)</span>
            </div>
            <span className={`material-symbols-outlined text-gray-500 text-lg transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </button>

          {showAdvanced && (
            <div className="px-4 pb-4 space-y-3">
              {/* Warning */}
              <div className="flex items-start space-x-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <span className="material-symbols-outlined text-red-400 text-sm mt-0.5">warning</span>
                <p className="text-[11px] text-red-300 leading-relaxed">
                  This uses your secret key to sign a transaction directly.
                  Only use on trusted devices. Never share your secret key.
                </p>
              </div>

              {/* Secret key input */}
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">
                  Secret Key
                </label>
                <input
                  type="password"
                  value={advSecretKey}
                  onChange={(e) => setAdvSecretKey(e.target.value)}
                  placeholder="S..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 font-mono"
                />
              </div>

              {/* Amount input */}
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 block">
                  Amount ({PRIMARY_CUSTOM_ASSET_LABEL})
                </label>
                <input
                  type="number"
                  value={advAmount}
                  onChange={(e) => setAdvAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="any"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/50"
                />
              </div>

              {/* Execute button */}
              <button
                onClick={handleAdvancedBuy}
                disabled={advSubmitting}
                className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 active:scale-[0.98]"
              >
                {advSubmitting ? (
                  <span className="flex items-center justify-center space-x-2">
                    <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                    <span>Executing...</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center space-x-2">
                    <span className="material-symbols-outlined text-base">bolt</span>
                    <span>Execute Purchase</span>
                  </span>
                )}
              </button>

            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </WalletGuard>
  )
}

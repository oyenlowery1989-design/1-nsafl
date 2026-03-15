'use client'
import { useEffect, useState, useCallback } from 'react'
import { useWalletStore } from '@/hooks/useStore'
import { REWARD_ASSETS, RewardAsset } from '@/lib/rewardAssets'
import { HORIZON_URL } from '@/lib/constants'
import { getTelegramInitData } from '@/lib/telegram'
import WalletGuard from '@/components/WalletGuard'
import BottomNav from '@/components/BottomNav'

interface AssetStatus {
  asset: RewardAsset
  hasTrustline: boolean
  checking: boolean
}

interface SecretState {
  value: string
  signing: boolean
  error: string
  done: boolean
}

const EMPTY_SECRET: SecretState = { value: '', signing: false, error: '', done: false }

export default function TrustlinesPage() {
  const stellarAddress = useWalletStore(s => s.stellarAddress)

  const [statuses, setStatuses] = useState<AssetStatus[]>(
    REWARD_ASSETS.filter(a => a.issuer).map(a => ({ asset: a, hasTrustline: false, checking: true }))
  )
  const [secrets, setSecrets] = useState<Record<string, SecretState>>({})
  const [showSecretFor, setShowSecretFor] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState(false)

  const checkTrustlines = useCallback(() => {
    if (!stellarAddress) return
    setStatuses(prev => prev.map(s => ({ ...s, checking: true })))
    fetch(`${HORIZON_URL}/accounts/${stellarAddress}`)
      .then(r => r.json())
      .then(account => {
        const balances: { asset_code?: string; asset_issuer?: string }[] = account.balances ?? []
        setStatuses(prev => prev.map(s => ({
          ...s,
          checking: false,
          hasTrustline: balances.some(b => b.asset_code === s.asset.code && b.asset_issuer === s.asset.issuer),
        })))
      })
      .catch(() => setStatuses(prev => prev.map(s => ({ ...s, checking: false }))))
  }, [stellarAddress])

  useEffect(() => { checkTrustlines() }, [checkTrustlines])

  const handleSign = useCallback(async (asset: RewardAsset) => {
    const secret = secrets[asset.code]?.value?.trim()
    if (!secret) return
    setSecrets(p => ({ ...p, [asset.code]: { ...p[asset.code], signing: true, error: '' } }))

    try {
      const { Keypair, Asset: StellarAsset, TransactionBuilder, Networks, Operation, BASE_FEE, Horizon } =
        await import('stellar-sdk')
      const keypair = Keypair.fromSecret(secret)
      if (keypair.publicKey() !== stellarAddress) {
        throw new Error('Secret key does not match your connected wallet address.')
      }
      const server = new Horizon.Server(HORIZON_URL)
      const account = await server.loadAccount(keypair.publicKey())
      const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.PUBLIC })
        .addOperation(Operation.changeTrust({ asset: new StellarAsset(asset.code, asset.issuer) }))
        .setTimeout(180)
        .build()
      tx.sign(keypair)
      await server.submitTransaction(tx)

      setSecrets(p => ({ ...p, [asset.code]: { ...EMPTY_SECRET, done: true } }))
      setShowSecretFor(null)
      setStatuses(prev => prev.map(s => s.asset.code === asset.code ? { ...s, hasTrustline: true } : s))
    } catch (err) {
      setSecrets(p => ({ ...p, [asset.code]: { ...p[asset.code], signing: false, error: err instanceof Error ? err.message : 'Failed to add trustline' } }))
    }
  }, [secrets, stellarAddress])

  const allDone = statuses.every(s => s.hasTrustline)
  const checking = statuses.some(s => s.checking)
  const doneCount = statuses.filter(s => s.hasTrustline).length

  return (
    <WalletGuard>
      <div className="min-h-screen bg-[#0A0E1A] pb-28">

        {/* Header */}
        <div className="sticky top-0 z-40 px-4 pt-3 pb-3 border-b border-white/5"
          style={{ background: 'rgba(10,14,26,0.95)', backdropFilter: 'blur(20px)' }}>
          <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
            Prize Trustlines
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Add these once to receive Lucky Draw prizes directly to your wallet
          </p>
        </div>

        <div className="px-4 pt-5 space-y-5">

          {/* Status summary card */}
          <div className={`rounded-2xl p-4 border ${allDone ? 'border-green-500/30' : 'border-[#D4AF37]/25'}`}
            style={{ background: allDone ? 'rgba(74,222,128,0.06)' : 'rgba(212,175,55,0.06)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">
                  {checking ? '⏳ Checking your wallet…'
                    : allDone ? '✅ All trustlines active'
                    : `${doneCount} of ${statuses.length} trustlines added`}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {allDone
                    ? 'You can receive all Lucky Draw prize assets.'
                    : 'Add the missing trustlines to receive prizes automatically.'}
                </p>
              </div>
              <button
                onClick={checkTrustlines}
                disabled={checking}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 text-gray-300 hover:border-white/20 transition disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <span className={`material-symbols-outlined text-sm leading-none ${checking ? 'animate-spin' : ''}`}>
                  {checking ? 'progress_activity' : 'refresh'}
                </span>
                <span>Refresh</span>
              </button>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-1.5 rounded-full bg-white/8 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(doneCount / statuses.length) * 100}%`,
                  background: allDone ? '#4ade80' : '#D4AF37',
                }}
              />
            </div>
          </div>

          {/* Wallet address */}
          {stellarAddress && (
            <div className="rounded-xl border border-white/8 px-3 py-2.5 flex items-center justify-between"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="min-w-0">
                <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-0.5">Your Wallet</p>
                <p className="text-xs font-mono text-gray-300 truncate">{stellarAddress}</p>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(stellarAddress); setCopyFeedback(true); setTimeout(() => setCopyFeedback(false), 1500) }}
                className="ml-2 flex-shrink-0 text-gray-600 hover:text-[#D4AF37] transition"
              >
                <span className="material-symbols-outlined text-base leading-none">
                  {copyFeedback ? 'check' : 'content_copy'}
                </span>
              </button>
            </div>
          )}

          {/* Asset list */}
          <div className="space-y-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Prize Assets</p>
            {statuses.map(s => (
              <AssetRow
                key={s.asset.code}
                status={s}
                secret={secrets[s.asset.code] ?? EMPTY_SECRET}
                showSecret={showSecretFor === s.asset.code}
                onToggleSecret={() => setShowSecretFor(prev => prev === s.asset.code ? null : s.asset.code)}
                onSecretChange={val => setSecrets(p => ({ ...p, [s.asset.code]: { ...(p[s.asset.code] ?? EMPTY_SECRET), value: val } }))}
                onSign={() => handleSign(s.asset)}
              />
            ))}
          </div>

          {/* Explainer */}
          <div className="rounded-2xl border border-white/8 p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-xs font-bold text-white">What is a trustline?</p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              On Stellar, your wallet needs to explicitly trust each asset before it can receive it.
              This is a one-time transaction that costs a small XLM reserve (~0.5 XLM per asset).
            </p>
            <div className="space-y-1.5">
              {[
                { icon: 'open_in_new', text: 'Lobstr app — tap the asset link, open in Lobstr, confirm' },
                { icon: 'key', text: 'Secret key — sign directly here (key never leaves your device)' },
              ].map(({ icon, text }) => (
                <div key={icon} className="flex items-start space-x-2">
                  <span className="material-symbols-outlined text-[#D4AF37] text-sm mt-0.5 flex-shrink-0">{icon}</span>
                  <p className="text-[11px] text-gray-400">{text}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
      <BottomNav />
    </WalletGuard>
  )
}

// ── Asset row ─────────────────────────────────────────────────────────────────
function AssetRow({
  status, secret, showSecret, onToggleSecret, onSecretChange, onSign,
}: {
  status: AssetStatus
  secret: SecretState
  showSecret: boolean
  onToggleSecret: () => void
  onSecretChange: (v: string) => void
  onSign: () => void
}) {
  const { asset, hasTrustline, checking } = status

  // Colour theme per asset
  const theme: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    wXLM:   { bg: 'rgba(10,61,98,0.25)',   border: 'rgba(14,116,144,0.3)',  text: '#38bdf8', badge: '🌊' },
    wNSAFL: { bg: 'rgba(183,121,31,0.15)', border: 'rgba(212,175,55,0.3)',  text: '#D4AF37', badge: '🏉' },
    wXRP:   { bg: 'rgba(26,64,96,0.25)',   border: 'rgba(96,165,250,0.25)', text: '#60a5fa', badge: '🔷' },
    wUSDC:  { bg: 'rgba(10,74,42,0.25)',   border: 'rgba(74,222,128,0.25)', text: '#4ade80', badge: '💵' },
  }
  const t = theme[asset.code] ?? { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.1)', text: '#fff', badge: '🪙' }

  return (
    <div className="rounded-2xl border overflow-hidden transition-all"
      style={{
        borderColor: hasTrustline ? 'rgba(74,222,128,0.35)' : checking ? 'rgba(255,255,255,0.08)' : t.border,
        background: hasTrustline ? 'rgba(74,222,128,0.05)' : t.bg,
      }}>

      {/* Main row */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center space-x-3">
          {/* Status icon */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${hasTrustline ? 'bg-green-500/20' : 'bg-white/5'}`}>
            {checking ? (
              <span className="material-symbols-outlined text-gray-500 text-base animate-spin">progress_activity</span>
            ) : hasTrustline ? (
              <span className="material-symbols-outlined text-green-400 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            ) : (
              <span className="material-symbols-outlined text-yellow-400 text-base">link_off</span>
            )}
          </div>

          {/* Asset info */}
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-sm">{t.badge}</span>
              <p className="text-sm font-bold" style={{ color: hasTrustline ? '#4ade80' : t.text }}>{asset.code}</p>
              {hasTrustline && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-500">{asset.label}</p>
          </div>
        </div>

        {/* Action buttons — only shown when trustline is missing */}
        {!checking && !hasTrustline && (
          <div className="flex items-center space-x-1.5">
            <a
              href={asset.lobstrDeeplink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition hover:opacity-80"
              style={{ background: 'rgba(212,175,55,0.12)', borderColor: 'rgba(212,175,55,0.3)', color: '#D4AF37' }}
            >
              <span className="material-symbols-outlined text-xs leading-none">open_in_new</span>
              <span>Lobstr</span>
            </a>
            <button
              onClick={onToggleSecret}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-white/10 text-gray-300 hover:bg-white/8 transition"
              style={{ background: showSecret ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)' }}
            >
              <span className="material-symbols-outlined text-xs leading-none">key</span>
              <span>Key</span>
            </button>
          </div>
        )}
      </div>

      {/* Issuer detail row */}
      {asset.issuer && (
        <div className="px-4 pb-3 -mt-1">
          <p className="text-[9px] text-gray-600 font-mono truncate">Issuer: {asset.issuer}</p>
        </div>
      )}

      {/* Secret key form */}
      {showSecret && !hasTrustline && (
        <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-2">
          <div className="flex items-start space-x-1.5 mb-1">
            <span className="material-symbols-outlined text-yellow-400 text-xs mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Your secret key{' '}
              <span className="text-yellow-400 font-medium">never leaves your device</span>
              {' '}— signing happens locally in the browser.
            </p>
          </div>
          <input
            type="password"
            placeholder="S… (your Stellar secret key)"
            value={secret.value}
            onChange={e => onSecretChange(e.target.value)}
            className="w-full bg-black/40 border border-white/10 text-gray-200 text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50 placeholder-gray-600"
            autoComplete="off"
            spellCheck={false}
          />
          {secret.error && (
            <p className="text-[10px] text-red-400">{secret.error}</p>
          )}
          <button
            onClick={onSign}
            disabled={secret.signing || !secret.value.trim()}
            className="w-full py-2 rounded-lg text-xs font-bold text-black bg-[#D4AF37] hover:bg-[#D4AF37]/90 disabled:opacity-40 transition flex items-center justify-center space-x-1.5"
          >
            {secret.signing ? (
              <>
                <span className="material-symbols-outlined text-xs leading-none animate-spin">progress_activity</span>
                <span>Signing…</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-xs leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                <span>Sign &amp; Add Trustline</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useRef } from 'react'
import { PRIMARY_CUSTOM_ASSET_CODE, PRIMARY_CUSTOM_ASSET_ISSUER } from '@/lib/constants'
import { haptic } from '@/lib/telegram-ui'

interface Props {
  onTrustlineAdded: () => void   // called after successful auto-add — parent retries connect
}

type Step = 'idle' | 'loading' | 'success' | 'error'

export default function NoTrustlineHelp({ onTrustlineAdded }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [secretKey, setSecretKey] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const lobstrUrl = `https://lobstr.co/assets/${PRIMARY_CUSTOM_ASSET_CODE}:${PRIMARY_CUSTOM_ASSET_ISSUER}`
  const scopulyUrl = `https://scopuly.com/trade/${PRIMARY_CUSTOM_ASSET_CODE}-XLM/${PRIMARY_CUSTOM_ASSET_ISSUER}/native`

  async function handleAutoAdd() {
    const key = secretKey.trim()
    if (!key) {
      setErrorMsg('Please enter your secret key.')
      return
    }

    haptic.medium()
    setStep('loading')
    setErrorMsg('')

    try {
      // Dynamic import — keeps SDK out of initial bundle
      const { Keypair, Asset, TransactionBuilder, Operation, Networks, BASE_FEE } = await import('stellar-sdk')

      // Validate key format
      let keypair: ReturnType<typeof Keypair.fromSecret>
      try {
        keypair = Keypair.fromSecret(key)
      } catch {
        setStep('error')
        setErrorMsg('Invalid secret key format.')
        return
      }

      const publicKey = keypair.publicKey()
      const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org'

      // Fetch account from Horizon
      const accountRes = await fetch(`${HORIZON_URL}/accounts/${publicKey}`)
      if (!accountRes.ok) {
        setStep('error')
        setErrorMsg('Could not load account from Stellar network. Is the wallet funded?')
        return
      }
      const accountData = await accountRes.json()

      // Build change_trust transaction
      const asset = new Asset(PRIMARY_CUSTOM_ASSET_CODE, PRIMARY_CUSTOM_ASSET_ISSUER)
      const account = {
        id: accountData.id,
        sequence: accountData.sequence,
        incrementSequenceNumber() {
          this.sequence = (Number(this.sequence) + 1).toString()
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = new TransactionBuilder(account as any, {
        fee: BASE_FEE,
        networkPassphrase: Networks.PUBLIC,
      })
        .addOperation(Operation.changeTrust({ asset }))
        .setTimeout(30)
        .build()

      tx.sign(keypair)
      const xdr = tx.toEnvelope().toXDR('base64')

      // Submit via our server proxy (avoids CORS issues)
      const submitRes = await fetch('/api/stellar/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xdr }),
      })
      const submitJson = await submitRes.json()

      if (submitJson.success) {
        haptic.success()
        setStep('success')
        setSecretKey('')
        setTimeout(() => onTrustlineAdded(), 1500)
      } else {
        setStep('error')
        setErrorMsg(submitJson.error ?? 'Transaction failed. Please try again.')
      }
    } catch {
      setStep('error')
      setErrorMsg('Unexpected error. Please try again.')
    }
  }

  return (
    <div className="space-y-4 w-full max-w-sm mx-auto">

      {/* Header */}
      <div className="text-center space-y-1">
        <span className="material-symbols-outlined text-4xl text-yellow-400">link_off</span>
        <h2 className="text-base font-bold text-white">No Trustline Found</h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          Your wallet needs a trustline for{' '}
          <span className="text-[#D4AF37] font-semibold">{PRIMARY_CUSTOM_ASSET_CODE}</span>{' '}
          before connecting. Choose a method below.
        </p>
      </div>

      {/* Option 1 — Lobstr */}
      <a
        href={lobstrUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => haptic.light()}
        className="flex items-center space-x-3 glass-card border border-white/10 rounded-xl px-4 py-3 hover:border-[#D4AF37]/40 transition active:scale-[0.98]"
      >
        <div className="w-9 h-9 rounded-full bg-[#1a1a2e] border border-white/10 flex items-center justify-center flex-shrink-0">
          <span className="text-lg">🌊</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Add via Lobstr</p>
          <p className="text-[10px] text-gray-400 truncate">Open Lobstr wallet to add trustline</p>
        </div>
        <span className="material-symbols-outlined text-gray-500 text-base">open_in_new</span>
      </a>

      {/* Option 2 — Scopuly */}
      <a
        href={scopulyUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => haptic.light()}
        className="flex items-center space-x-3 glass-card border border-white/10 rounded-xl px-4 py-3 hover:border-[#D4AF37]/40 transition active:scale-[0.98]"
      >
        <div className="w-9 h-9 rounded-full bg-[#1a1a2e] border border-white/10 flex items-center justify-center flex-shrink-0">
          <span className="text-lg">📊</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Add via Scopuly</p>
          <p className="text-[10px] text-gray-400 truncate">Use Scopuly DEX to enable the asset</p>
        </div>
        <span className="material-symbols-outlined text-gray-500 text-base">open_in_new</span>
      </a>

      {/* Divider */}
      <div className="flex items-center space-x-2">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-[10px] text-gray-500 uppercase tracking-widest">or advanced</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Option 3 — Advanced (secret key) */}
      {!showAdvanced ? (
        <button
          onClick={() => { haptic.light(); setShowAdvanced(true); setTimeout(() => inputRef.current?.focus(), 100) }}
          className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition text-xs font-semibold"
        >
          <span className="material-symbols-outlined text-sm">key</span>
          <span>Add automatically with secret key</span>
        </button>
      ) : (
        <div className="glass-card border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex items-start space-x-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <span className="material-symbols-outlined text-red-400 text-sm mt-0.5">warning</span>
            <p className="text-[10px] text-red-300 leading-relaxed">
              Your secret key is used <strong>locally only</strong> to sign the transaction. It is never sent to our servers or stored anywhere.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Secret Key (S…)</label>
            <input
              ref={inputRef}
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="SXXXXXXXXXXXXXXXXXXXX..."
              disabled={step === 'loading' || step === 'success'}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/40 disabled:opacity-50"
            />
          </div>

          {errorMsg && (
            <p className="text-[11px] text-red-400 flex items-center space-x-1">
              <span className="material-symbols-outlined text-sm">error</span>
              <span>{errorMsg}</span>
            </p>
          )}

          {step === 'success' && (
            <p className="text-[11px] text-green-400 flex items-center space-x-1">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>Trustline added! Reconnecting…</span>
            </p>
          )}

          <button
            onClick={handleAutoAdd}
            disabled={step === 'loading' || step === 'success' || !secretKey.trim()}
            className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-xs disabled:opacity-40 transition active:scale-[0.98]"
          >
            {step === 'loading' ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                <span>Submitting…</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">add_link</span>
                <span>Add Trustline</span>
              </>
            )}
          </button>

          <button
            onClick={() => { setShowAdvanced(false); setSecretKey(''); setErrorMsg(''); setStep('idle') }}
            className="w-full text-[10px] text-gray-500 hover:text-gray-300 transition"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

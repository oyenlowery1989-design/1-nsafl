'use client'
import { useEffect, useState, Suspense } from 'react'
import { Icon } from '../components/ui'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'
import { REWARD_ASSETS } from '@/lib/rewardAssets'
import { useAdminToken } from '../hooks/useAdminToken'
import { isPackEnabled } from '@/config/app'

type SenderConfig = {
  senderPublicKey: string
  horizonUrl: string
  memo: string
  rewardAssets: { code: string; issuerSet: boolean; issuerPrefix: string }[]
}

function SettingsContent() {
  const hasRewards = isPackEnabled('rewards')
  const hasGames = isPackEnabled('games')
  const token = useAdminToken() ?? ''
  const [config, setConfig] = useState<SenderConfig | null>(null)
  const [loading, setLoading] = useState(hasRewards)
  const [envStatus, setEnvStatus] = useState<Record<string, boolean> | null>(null)
  const [envLoading, setEnvLoading] = useState(false)

  useEffect(() => {
    if (!token || !hasRewards) return
    fetch('/api/admin/send-reward', { headers: { 'x-admin-token': token } })
      .then(r => r.json())
      .then(j => { if (j.success) setConfig(j.data) })
      .finally(() => setLoading(false))
  }, [hasRewards, token])

  useEffect(() => {
    if (!token) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch spinner reset when token arrives
    setEnvLoading(true)
    fetch('/api/admin/env-status', { headers: { 'x-admin-token': token } })
      .then(r => r.json())
      .then(j => { if (j.success) setEnvStatus(j.data.status) })
      .finally(() => setEnvLoading(false))
  }, [token])

  const envVars = [
    'REWARD_SENDER_SECRET',
    'TELEGRAM_BOT_TOKEN',
    'NEXT_PUBLIC_HORIZON_URL',
    'REWARD_MEMO',
    'ADMIN_SECRET_TOKEN',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_PRIMARY_ASSET_CODE',
    'NEXT_PUBLIC_PRIMARY_ASSET_ISSUER',
  ]

  const gameConfig = [
    { game: 'Lucky Draw',    limit: '3 spins/day (T1+)', bonus: '3 bonus spins (T0 welcome)' },
    { game: 'Slot Machine',  limit: '3 spins/day (T1+)', bonus: '3 bonus spins (T0 welcome)' },
    { game: 'Scratch Card',  limit: '1 card/day (T1+)',  bonus: '1 bonus card (T0 welcome)' },
  ]

  return (
    <div className="space-y-5 max-w-3xl">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <Icon name="settings" className="text-primary text-xl" />
        Settings & Configuration
      </h2>

      {/* Reward wallet config */}
      {hasRewards && <div className="bg-[#0d1424] border border-white/8 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <Icon name="account_balance_wallet" className="text-sm text-primary" />
          Reward Wallet
        </h3>
        {loading ? <p className="text-sm text-gray-600">Loading…</p> : config ? (
          <div className="space-y-2.5">
            <ConfigRow label="Sender Public Key" value={config.senderPublicKey} mono badge={config.senderPublicKey === 'NOT_SET' ? 'red' : config.senderPublicKey === 'INVALID_SECRET' ? 'orange' : 'green'} />
            <ConfigRow label="Horizon URL" value={config.horizonUrl} mono />
            <ConfigRow label="Reward Memo" value={config.memo} />
            <div>
              <p className="text-[11px] text-gray-500 mb-2">Reward Assets</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {config.rewardAssets.map(a => (
                  <div key={a.code} className="bg-black/20 rounded-lg p-2.5">
                    <p className="text-xs font-bold text-white">{a.code}</p>
                    <p className={`text-[10px] mt-0.5 ${a.issuerSet ? 'text-green-400' : 'text-red-400'}`}>
                      {a.issuerSet ? `✓ Issuer: ${a.issuerPrefix}` : '✗ No issuer'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : <p className="text-sm text-red-400">Failed to load config</p>}
      </div>}

      {/* Game config */}
      {hasGames && <div className="bg-[#0d1424] border border-white/8 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <Icon name="sports_esports" className="text-sm text-primary" />
          Game Limits
        </h3>
        <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-xs text-primary">
          Tier 1 minimum: <strong>100 {PRIMARY_CUSTOM_ASSET_CODE}</strong> — only T1+ can receive prize payouts
        </div>
        <div className="space-y-2">
          {gameConfig.map(g => (
            <div key={g.game} className="flex items-start justify-between gap-3 py-2 border-b border-white/6 last:border-0">
              <span className="text-sm font-medium text-white">{g.game}</span>
              <div className="text-right">
                <p className="text-xs text-gray-300">{g.limit}</p>
                <p className="text-[11px] text-gray-500">{g.bonus}</p>
              </div>
            </div>
          ))}
        </div>
      </div>}

      {/* Env vars */}
      <div className="bg-[#0d1424] border border-white/8 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <Icon name="key" className="text-sm text-primary" />
          Environment Variables
        </h3>
        <p className="text-xs text-gray-600">Variable names only — values are never exposed in the UI.</p>
        {envLoading ? (
          <p className="text-xs text-gray-600">Checking…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {envVars.map(v => {
              const isSet = envStatus ? envStatus[v] : true
              return (
                <div key={v} className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2">
                  <span className={`material-symbols-outlined text-sm shrink-0 ${isSet ? 'text-green-400' : 'text-red-400'}`}>
                    {isSet ? 'check_circle' : 'cancel'}
                  </span>
                  <span className="text-xs font-mono text-gray-300">{v}</span>
                  {!isSet && <span className="ml-auto text-[10px] text-red-400 font-semibold">NOT SET</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function ConfigRow({ label, value, mono, badge }: { label: string; value: string; mono?: boolean; badge?: 'green' | 'red' | 'orange' }) {
  const badgeColors = { green: 'text-green-400', red: 'text-red-400', orange: 'text-orange-400' }
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className={`text-xs truncate max-w-[60%] ${mono ? 'font-mono' : ''} ${badge ? badgeColors[badge] : 'text-gray-300'}`} title={value}>
        {value}
      </span>
    </div>
  )
}

export default function SettingsPage() {
  return <Suspense><SettingsContent /></Suspense>
}

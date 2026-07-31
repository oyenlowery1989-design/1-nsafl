'use client'
import { useState } from 'react'
import { Icon } from './ui'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'

interface Props {
  token: string
  winStats: { total: number; pending: number }
  onRefresh: () => void
  onLogout: () => void
}

export function AdminHeader({ token, winStats, onRefresh, onLogout }: Props) {
  const [confirmLogout, setConfirmLogout] = useState(false)

  return (
    <header className="bg-[#0d1424] border-b border-white/8 px-6 py-3 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#D4AF37] flex items-center justify-center shrink-0">
          <Icon name="sports_football" className="text-sm text-black" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white">{PRIMARY_CUSTOM_ASSET_CODE} Admin</h1>
          <p className="text-[11px] text-gray-500">Homecoming Hub</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Wins link */}
        <a
          href={`/admin/wins?token=${token}`}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#D4AF37] border border-white/10 rounded-lg px-3 py-1.5 hover:bg-white/5 transition"
        >
          <Icon name="emoji_events" className="text-sm" />
          Wins
          {winStats.pending > 0 && (
            <span className="ml-0.5 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {winStats.pending}
            </span>
          )}
        </a>

        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-white/10 rounded-lg px-3 py-1.5 hover:bg-white/5 transition"
        >
          <Icon name="refresh" className="text-sm" /> Refresh
        </button>

        {confirmLogout ? (
          <span className="inline-flex items-center gap-1 text-xs">
            <span className="text-gray-400">Log out?</span>
            <button onClick={onLogout} className="px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 font-semibold">Yes</button>
            <button onClick={() => setConfirmLogout(false)} className="px-2 py-1 rounded bg-white/10 text-gray-400 hover:bg-white/20 font-semibold">No</button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmLogout(true)}
            className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg px-3 py-1.5 hover:bg-red-500/10 transition"
          >
            Logout
          </button>
        )}
      </div>
    </header>
  )
}

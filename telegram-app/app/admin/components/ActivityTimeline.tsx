'use client'
import { useState } from 'react'
import { ago } from '../utils'
import { SectionTitle } from './ui'
import type { User, GameSession, Donation, Purchase, AccessAttempt } from '../types'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'
import { shortAddr } from '../utils'

interface TimelineItem {
  date: string
  type: 'game' | 'donation' | 'purchase' | 'team' | 'access' | 'wallet'
  label: string
  detail?: string
  isAlert?: boolean
}

const TIMELINE_DOT: Record<TimelineItem['type'], string> = {
  game:     'bg-green-500',
  donation: 'bg-primary',
  purchase: 'bg-blue-500',
  team:     'bg-purple-500',
  access:   'bg-gray-500',
  wallet:   'bg-cyan-500',
}

function buildTimeline(
  u: User,
  userSessions: GameSession[],
  userDonations: Donation[],
  userPurchases: Purchase[],
  userAccess: AccessAttempt[],
): TimelineItem[] {
  const items: TimelineItem[] = []

  for (const w of u.wallets) {
    items.push({
      date: w.created_at,
      type: 'wallet',
      label: `Connected wallet ${shortAddr(w.stellar_address)}`,
      detail: w.label ?? undefined,
    })
  }
  for (const g of userSessions) {
    items.push({
      date: g.created_at,
      type: 'game',
      label: `Played a game — ${g.kicks} kicks in ${g.duration_seconds}s`,
      detail: g.balls_spawned ? `${g.balls_spawned} balls spawned` : undefined,
    })
  }
  for (const d of userDonations) {
    const target = d.donation_target ?? 'General'
    items.push({
      date: d.created_at,
      type: 'donation',
      label: `Donated ${d.amount} ${d.asset_code} to ${target}`,
      detail: d.verified ? 'Verified' : 'Pending verification',
    })
  }
  for (const p of userPurchases) {
    items.push({
      date: p.created_at,
      type: 'purchase',
      label: `Purchased ${p.token_amount} ${PRIMARY_CUSTOM_ASSET_CODE} for ${p.xlm_amount} XLM`,
      detail: p.verified ? 'Verified' : 'Pending verification',
    })
  }
  for (const a of userAccess) {
    const isAlert = a.devtools_opened || a.tg_sdk_fake
    const location = a.geo_location ? ` from ${a.geo_location}` : a.ip ? ` from ${a.ip}` : ''
    const eventLabel = a.devtools_opened
      ? `Suspicious: DevTools opened${location}`
      : a.tg_sdk_fake
      ? `Suspicious: Fake SDK detected${location}`
      : `Opened app${location}`
    items.push({
      date: a.created_at,
      type: 'access',
      label: eventLabel,
      detail: a.screen ?? undefined,
      isAlert,
    })
  }

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return items
}

interface Props {
  u: User
  userSessions: GameSession[]
  userDonations: Donation[]
  userPurchases: Purchase[]
  userAccess: AccessAttempt[]
}

export function ActivityTimeline({ u, userSessions, userDonations, userPurchases, userAccess }: Props) {
  const [showAll, setShowAll] = useState(false)
  const all = buildTimeline(u, userSessions, userDonations, userPurchases, userAccess)
  const visible = showAll ? all : all.slice(0, 20)

  if (all.length === 0) {
    return (
      <section>
        <SectionTitle icon="timeline" title="Activity Timeline" count={0} />
        <p className="text-gray-600 text-sm">No activity recorded yet.</p>
      </section>
    )
  }

  return (
    <section>
      <SectionTitle icon="timeline" title="Activity Timeline" count={all.length} />
      <div className="relative pl-6 border-l-2 border-white/10 space-y-0">
        {visible.map((item, tIdx) => (
          <div key={tIdx} className="relative pb-5">
            <span className={`absolute -left-[25px] top-1 w-3 h-3 rounded-full border-2 border-background-dark ${item.isAlert ? 'bg-red-500' : TIMELINE_DOT[item.type]}`} />
            <div className="ml-2">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={`text-sm font-medium ${item.isAlert ? 'text-red-300' : 'text-gray-200'}`}>{item.label}</span>
                <span className="text-[11px] text-gray-600 shrink-0">{ago(item.date)}</span>
              </div>
              {item.detail && <p className="text-[11px] text-gray-500 mt-0.5">{item.detail}</p>}
            </div>
          </div>
        ))}
      </div>
      {all.length > 20 && (
        <button onClick={() => setShowAll(v => !v)} className="mt-2 text-xs text-primary hover:text-yellow-300 font-semibold transition">
          {showAll ? 'Show less' : `Show all ${all.length} events`}
        </button>
      )}
    </section>
  )
}

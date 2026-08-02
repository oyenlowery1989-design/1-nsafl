'use client'
import { useState } from 'react'
import type { User, ConfirmAction } from '../types'

// ── Icon ─────────────────────────────────────────────────────────────────────
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined leading-none ${className}`}>{name}</span>
}

// ── Badge ────────────────────────────────────────────────────────────────────
const BADGE_MAP: Record<string, string> = {
  green:  'bg-green-500/15 text-green-400 ring-1 ring-green-500/30',
  red:    'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
  yellow: 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30',
  gray:   'bg-white/10 text-gray-400 ring-1 ring-white/10',
  blue:   'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
  orange: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30',
  purple: 'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30',
  gold:   'bg-yellow-500/10 text-[#D4AF37] ring-1 ring-[#D4AF37]/30',
}
export function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${BADGE_MAP[color] ?? BADGE_MAP.gray}`}>
      {children}
    </span>
  )
}

// ── Table primitives ─────────────────────────────────────────────────────────
export function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-white/5">
      {children}
    </th>
  )
}
export function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td className={`px-3 py-2.5 text-sm text-gray-200 align-top ${mono ? 'font-mono text-xs' : ''}`}>
      {children}
    </td>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#111827] border border-white/8 rounded-xl overflow-hidden ${className}`}>
      {children}
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
export function SectionTitle({ icon, title, count }: { icon: string; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon name={icon} className="text-lg text-[#D4AF37]" />
      <h3 className="text-sm font-bold text-white">{title}</h3>
      {count !== undefined && (
        <span className="bg-white/8 text-gray-400 text-[11px] font-semibold px-2 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
export function StatTile({ label, value, sub, accent = 'text-white' }: {
  label: string; value: string | number; sub?: string; accent?: string
}) {
  return (
    <div className="bg-[#111827] border border-white/6 rounded-xl p-4">
      <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── TgUser ────────────────────────────────────────────────────────────────────
export function TgUser({ users, id }: { users: User[]; id: number | null | undefined }) {
  if (!id) return <span className="text-gray-600">anon</span>
  const u = users.find(x => x.telegram_id === id)
  const name = u?.telegram_first_name ?? u?.telegram_username ?? null
  return (
    <span>
      {name && (
        <span className="font-medium text-white block">
          {name}{u?.telegram_username ? ` (@${u.telegram_username})` : ''}
        </span>
      )}
      <span className="text-[10px] text-gray-600 font-mono">#{id}</span>
    </span>
  )
}

// ── DonationTypeBadge ─────────────────────────────────────────────────────────
export function DonationTypeBadge({ type }: { type: string }) {
  const colorMap: Record<string, string> = { team: 'blue', player: 'purple', general: 'gray' }
  return <Badge color={colorMap[type] ?? 'gray'}>{type.toUpperCase()}</Badge>
}

// ── CopyAddressRow ────────────────────────────────────────────────────────────
export function CopyAddressRow({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {
      const el = document.createElement('textarea')
      el.value = address
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2 mb-3">
      <p className="font-mono text-xs text-gray-300 break-all flex-1">{address}</p>
      <button onClick={copy} className="ml-1 shrink-0 flex items-center gap-1 text-xs transition"
        style={{ color: copied ? '#4ade80' : '#6b7280' }} title="Copy address">
        <Icon name={copied ? 'check' : 'content_copy'} className="text-xs" />
        {copied && <span className="text-[10px] font-semibold">Copied!</span>}
      </button>
    </div>
  )
}

// ── InlineConfirm ─────────────────────────────────────────────────────────────
export function InlineConfirm({
  label, confirmStyle, confirmId, activeId, onConfirm, onSetActive, buttonStyle,
}: {
  label: string
  confirmStyle: string
  confirmId: string
  activeId: ConfirmAction
  onConfirm: () => void
  onSetActive: (v: ConfirmAction) => void
  buttonStyle: string
}) {
  const isActive = activeId?.telegramId === parseInt(confirmId) &&
    activeId?.type === (label.toLowerCase() as 'block' | 'delete' | 'logout')
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <span className="text-gray-400">Sure?</span>
        <button onClick={onConfirm} className={`px-2 py-0.5 rounded font-semibold transition ${confirmStyle}`}>Yes</button>
        <button onClick={() => onSetActive(null)} className="px-2 py-0.5 rounded bg-white/10 text-gray-400 hover:bg-white/20 font-semibold transition">No</button>
      </span>
    )
  }
  return (
    <button
      onClick={() => onSetActive({ type: label.toLowerCase() as 'block' | 'delete' | 'logout', telegramId: parseInt(confirmId) })}
      className={`text-xs px-2 py-0.5 rounded font-semibold transition ${buttonStyle}`}
    >
      {label}
    </button>
  )
}

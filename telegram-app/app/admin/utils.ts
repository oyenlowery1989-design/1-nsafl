import { ALL_CLUBS } from '@/config/afl'

export const dt = (iso: string) => new Date(iso).toLocaleString()

export const ago = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export const teamName = (id: string | null) =>
  id ? (ALL_CLUBS.find(c => c.id === id)?.name ?? id) : '—'

export const num = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })

export const shortAddr = (addr: string) => `${addr.slice(0, 4)}…${addr.slice(-6)}`

export function formatAmount(value: number): string {
  if (value >= 1_000_000_000) {
    const b = value / 1_000_000_000
    return b % 1 === 0 ? `${b}B` : `${parseFloat(b.toFixed(1))}B`
  }
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return m % 1 === 0 ? `${m}M` : `${parseFloat(m.toFixed(1))}M`
  }
  if (value >= 1_000) {
    const k = value / 1_000
    return k % 1 === 0 ? `${k}k` : `${parseFloat(k.toFixed(1))}k`
  }
  return String(Math.round(value))
}

import { NextRequest } from 'next/server'
import { fail } from './api-response'

const MAX_PER_MINUTE = 60
const store = new Map<string, number[]>()

// Purge stale entries every 5 minutes to prevent memory growth
setInterval(() => {
  const cutoff = Date.now() - 60_000
  for (const [key, times] of store.entries()) {
    const fresh = times.filter(t => t > cutoff)
    if (fresh.length === 0) store.delete(key)
    else store.set(key, fresh)
  }
}, 5 * 60 * 1000)

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export function checkRateLimit(req: NextRequest, max = MAX_PER_MINUTE, key?: string) {
  const bucket = key ?? getIp(req)
  const now = Date.now()
  const cutoff = now - 60_000
  const times = (store.get(bucket) ?? []).filter(t => t > cutoff)
  times.push(now)
  store.set(bucket, times)

  if (times.length > max) {
    return fail('Too many requests — please slow down', 'RATE_LIMITED', 429)
  }
  return null // OK
}

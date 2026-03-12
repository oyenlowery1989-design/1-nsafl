/**
 * Resolve a rough location string from an IP address.
 * Uses ipinfo.io free tier (no key required, 50k/month).
 * Returns null on failure or for private/local IPs.
 */
export async function resolveIpLocation(ip: string | null): Promise<string | null> {
  if (!ip) return null
  // Skip private / loopback ranges
  if (
    ip === '::1' ||
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.')
  ) return null

  try {
    const res = await fetch(`https://ipinfo.io/${ip}/json`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null
    const data = await res.json() as { city?: string; region?: string; country?: string }
    const parts = [data.city, data.region, data.country].filter(Boolean)
    return parts.length ? parts.join(', ') : null
  } catch {
    return null
  }
}

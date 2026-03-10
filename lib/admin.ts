/**
 * Admin access control.
 * ADMIN_TELEGRAM_USERNAMES is a comma-separated list of Telegram usernames (without @).
 * Example: ADMIN_TELEGRAM_USERNAMES=americandreamer8,anotheradmin
 */
export function isAdminUsername(username: string | null | undefined): boolean {
  if (!username) return false
  // NEXT_PUBLIC_ prefix makes it available client-side; real enforcement is server-side
  const allowed = (process.env.NEXT_PUBLIC_ADMIN_TELEGRAM_USERNAMES ?? '')
    .split(',')
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(username.toLowerCase())
}

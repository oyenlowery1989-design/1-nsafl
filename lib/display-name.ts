/**
 * Resolve a user's public display label based on their stored preference.
 * Falls back to stellar address (truncated) when the preferred field is unavailable.
 */
export function resolveDisplayName({
  displayPreference,
  stellarAddress,
  telegramUsername,
  telegramFirstName,
}: {
  displayPreference: string | null
  stellarAddress: string | null
  telegramUsername: string | null
  telegramFirstName: string | null
}): string {
  const addr = stellarAddress
    ? `${stellarAddress.slice(0, 4)}…${stellarAddress.slice(-6)}`
    : 'Unknown'

  switch (displayPreference) {
    case 'username':
      return telegramUsername ? `@${telegramUsername}` : addr
    case 'name':
      return telegramFirstName ?? addr
    case 'address':
    default:
      return addr
  }
}

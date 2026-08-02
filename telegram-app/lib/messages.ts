/**
 * Centralised Telegram message templates.
 * Used by admin notify flow AND the player "Claim via Bot" self-notification.
 */
import { REWARD_ASSETS } from '@/lib/rewardAssets'
import { PRIMARY_CUSTOM_ASSET_CODE } from '@/lib/constants'

/**
 * Build the trustline-setup message sent to a player via the bot.
 * @param html     true → use HTML formatting (<b>, <code>); false → plain text
 * @param prize    optional prize label, e.g. "100 wXLM"
 * @param winCode  optional win code, e.g. "SPIN-ABC123"
 */
export function buildTrustlineMessage(html: boolean, prize?: string, winCode?: string): string {
  const lines = REWARD_ASSETS
    .filter(a => a.issuer)
    .map(a => html ? `• <b>${a.code}</b> — ${a.lobstrDeeplink}` : `• ${a.code} — ${a.lobstrDeeplink}`)
    .join('\n')

  const prizeSection  = prize   ? (html ? `\nPrize: <b>${prize}</b>`       : `\nPrize: ${prize}`)       : ''
  const codeSection   = winCode ? (html ? `\nWin Code: <code>${winCode}</code>` : `\nWin Code: ${winCode}`) : ''

  return html
    ? `🏆 <b>${PRIMARY_CUSTOM_ASSET_CODE} Lucky Draw Prize Ready!</b>${prizeSection}${codeSection}\n\nTo receive prizes, your wallet needs trustlines for all reward assets. Please add them in LOBSTR:\n\n${lines}\n\nOnce all trustlines are added, contact the admin and we'll resend your reward.`
    : `🏆 ${PRIMARY_CUSTOM_ASSET_CODE} Lucky Draw Prize Ready!${prizeSection}${codeSection}\n\nTo receive prizes, your wallet needs trustlines for all reward assets. Please add them in LOBSTR:\n\n${lines}\n\nOnce all trustlines are added, contact the admin and we'll resend your reward.`
}

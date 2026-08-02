// config/branding.ts — per-clone file. A new project edits THIS file, .env,
// config/tiers.ts, config/afl.ts, and public/ assets. Nothing else.
import { PRIMARY_CUSTOM_ASSET_CODE, PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'

export const BRANDING = {
  appName: 'NSAFL Homecoming Hub',
  shortName: 'NSAFL Hub',
  domain: 'app.nsafl.com',
  botUsername: process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'NSAFL_bot',
  colors: { background: '#0A0E1A', primary: '#D4AF37' },
  teamSelection: 'afl' as 'afl' | 'custom' | 'off',
  copy: {
    onboardingSlides: [
      {
        icon: 'sports_football',
        title: 'Welcome to The Homecoming Hub',
        body: `The home of ${PRIMARY_CUSTOM_ASSET_LABEL} — supporting AFL & WAFL players on their journey home.`,
        showTiers: false,
      },
      {
        icon: 'account_balance_wallet',
        title: 'Connect Your Stellar Wallet',
        body: `Hold ${PRIMARY_CUSTOM_ASSET_LABEL} tokens to earn rewards, climb tiers, and back your team's homecoming campaign.`,
        showTiers: true,
      },
      {
        icon: 'shield',
        title: 'Pick Your Club',
        body: 'Pledge allegiance to an AFL or WAFL club. Your team identity lives on the blockchain.',
        showTiers: false,
      },
    ],
    referralShareText:
      `🔥 I've been spinning the Lucky Draw on the ${PRIMARY_CUSTOM_ASSET_CODE} Homecoming Hub and the wins are real!\n\nSo far I've won:\n🏆 200 wXLM (x2)\n🏆 25 wXRP\n🏆 100 wUSDC\n🏆 2500 w${PRIMARY_CUSTOM_ASSET_CODE}\n\nIt's actually fun and you really can win rewards from the wheel.\n\nIf you want to try your luck, use my link to join 👇\n\n🏉 Join the ${PRIMARY_CUSTOM_ASSET_CODE} Homecoming Hub — support AFL homecoming campaigns on the Stellar blockchain, climb the leaderboard, spin the Lucky Draw, and earn rewards.\n\nGive it a try and see what you win 😎👇`,
    broadcastTemplates: [
      {
        label: '🏆 Win Announcement',
        message: `<b>🏆 Congratulations to our latest prize winner!</b>\n\nAnother lucky <b>${PRIMARY_CUSTOM_ASSET_LABEL}</b> holder just won a prize from our games hub. Play Lucky Draw, Slot Machine, or Scratch Card daily for your chance to win!\n\n👉 Open the app to play now.`,
      },
      {
        label: '🔧 Maintenance Notice',
        message: `<b>🔧 Scheduled Maintenance</b>\n\nThe ${PRIMARY_CUSTOM_ASSET_CODE} app will be briefly unavailable for maintenance. Thank you for your patience — we'll be back shortly!\n\nFollow our community for updates.`,
      },
      {
        label: '🎁 Promo / Campaign',
        message: '<b>🎁 Special Promotion!</b>\n\nFor a limited time, bonus prizes are available in our games hub. Make sure your wallet is connected and trustlines are set up to claim any winnings.\n\n👉 Open the app to participate!',
      },
      {
        label: '📢 General Update',
        message: `<b>📢 ${PRIMARY_CUSTOM_ASSET_CODE} Update</b>\n\n`,
      },
    ],
    buyMemo: `${PRIMARY_CUSTOM_ASSET_CODE} buy`,
    rewardMemo: `${PRIMARY_CUSTOM_ASSET_CODE} Prize`,
    prizeNotificationTitle: `Your ${PRIMARY_CUSTOM_ASSET_CODE} prize has been sent!`,
  },
} as const

import { BRANDING } from '@/config/branding'
import { PRIMARY_CUSTOM_ASSET_CODE, PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'

export const stellarWalletCopy = {
  onboardingSlides: [
    {
      icon: 'sports_football',
      title: `Welcome to ${BRANDING.appName}`,
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
  walletConnectedSubtitle: `Your secure link to ${BRANDING.appName} has been successfully established.`,
  referralWelcome: `Welcome to the ${BRANDING.appName} — the home of Australian football on Stellar.`,
} as const

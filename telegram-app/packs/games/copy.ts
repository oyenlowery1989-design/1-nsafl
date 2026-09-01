import { PRIMARY_CUSTOM_ASSET_CODE, PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'

export const gamesCopy = {
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
    { label: '📢 General Update', message: `<b>📢 ${PRIMARY_CUSTOM_ASSET_CODE} Update</b>\n\n` },
  ],
} as const

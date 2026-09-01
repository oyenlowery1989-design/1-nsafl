const APP_NAME = 'The Homecoming Hub'

export const BRANDING = {
  appName: APP_NAME,
  shortName: 'NSAFL Hub',
  domain: 'app.nsafl.com',
  botUsername: process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'NSAFL_bot',
  description: 'Telegram Mini App',
  colors: { background: '#0A0E1A', primary: '#D4AF37' },
} as const

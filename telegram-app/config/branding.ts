const APP_NAME = 'The Homecoming Hub'

export const BRANDING = {
  appName: APP_NAME,
  shortName: 'NSAFL Hub',
  domain: 'app.nsafl.com',
  botUsername: process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'NSAFL_bot',
  description: 'Telegram Mini App',
  colors: {
    background: '#0A0E1A',
    surface: '#121A2A',
    surfaceRaised: '#18243A',
    border: 'rgba(255, 255, 255, 0.1)',
    text: '#F8FAFC',
    mutedText: '#94A3B8',
    primary: '#D4AF37',
    primaryForeground: '#0A0E1A',
  },
} as const

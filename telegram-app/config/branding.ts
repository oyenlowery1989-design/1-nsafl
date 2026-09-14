const APP_NAME = 'The Homecoming Hub'

export const BRANDING = {
  appName: APP_NAME,
  shortName: 'NSAFL Hub',
  domain: 'app.nsafl.com',
  botUsername: process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'NSAFL_bot',
  description: 'Telegram Mini App',
  colors: {
    background: '#0A0E1A',
    surface: '#1A2940',
    surfaceRaised: '#243957',
    border: 'rgba(255, 255, 255, 0.16)',
    text: '#F8FAFC',
    mutedText: '#B8C5D8',
    primary: '#D4AF37',
    primaryForeground: '#0A0E1A',
  },
} as const

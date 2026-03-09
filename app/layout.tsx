import type { Metadata } from 'next'
import './globals.css'
import TelegramGuard from '@/components/guards/TelegramGuard'

export const metadata: Metadata = {
  title: 'The Homecoming Hub',
  description: 'CRYPTOBANK AFL Movement',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body className="antialiased">
        <TelegramGuard>
          {children}
        </TelegramGuard>
      </body>
    </html>
  )
}

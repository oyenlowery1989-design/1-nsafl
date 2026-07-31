import { NextRequest } from 'next/server'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'NSAFL_bot'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? `https://t.me/${BOT_USERNAME}`

async function sendMessage(chatId: number, text: string, replyMarkup?: object) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  })
}

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? ''
  if (!secret || req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return new Response('forbidden', { status: 403 })
  }

  let update: {
    message?: {
      chat: { id: number }
      from?: { first_name?: string }
      text?: string
    }
  }

  try {
    update = await req.json()
  } catch {
    return new Response('ok', { status: 200 })
  }

  const message = update.message
  if (!message) return new Response('ok', { status: 200 })

  const chatId = message.chat.id
  const text = message.text ?? ''
  const firstName = message.from?.first_name ?? 'mate'

  // Handle /start [ref_X]
  if (text.startsWith('/start')) {
    const param = text.split(' ')[1] ?? ''
    const isRef = param.startsWith('ref_')

    const appLink = isRef
      ? `https://t.me/${BOT_USERNAME}?startapp=${param}`
      : APP_URL

    const welcomeText = isRef
      ? `👋 G'day ${firstName}!\n\nYou've been invited to <b>NSAFL Homecoming Hub</b> 🏉\n\nJoin the movement, connect your Stellar wallet, and track your favourite AFL teams.\n\nTap below to open the app — your referral is already saved.`
      : `👋 G'day ${firstName}!\n\nWelcome to <b>NSAFL Homecoming Hub</b> 🏉\n\nConnect your Stellar wallet, hold <b>$NSAFL</b> tokens, and support the AFL homecoming movement.\n\nTap below to open the app.`

    await sendMessage(chatId, welcomeText, {
      inline_keyboard: [[
        {
          text: '🏉 Open NSAFL App',
          url: appLink,
        },
      ]],
    })
  }

  return new Response('ok', { status: 200 })
}

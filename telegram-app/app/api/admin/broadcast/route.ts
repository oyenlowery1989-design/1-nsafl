/**
 * POST /api/admin/broadcast
 * Sends a Telegram message to all (or filtered) users.
 * Body: { message: string, onlyOptedIn?: boolean, previewOnly?: boolean }
 * Returns: { sent: number, skipped: number, errors: number }
 */
import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { ok, fail } from '@/lib/api-response'
import { verifyAdminToken } from '@/app/api/admin/route'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''

async function sendTelegramMessage(chatId: number, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  let body: { message?: string; onlyOptedIn?: boolean; previewOnly?: boolean } = {}
  try { body = await req.json() } catch { /* fallthrough */ }

  const { message, onlyOptedIn = true, previewOnly = false } = body

  if (!message?.trim()) return fail('message is required', 'BAD_REQUEST', 400)

  const supabase = createServiceClient()

  // Fetch eligible users (not blocked)
   
  let query = supabase
    .from('users')
    .select('telegram_id, opt_in_telegram_notifications')
    .eq('is_blocked', false)

  if (onlyOptedIn) {
    query = query.eq('opt_in_telegram_notifications', true)
  }

  const { data: users, error } = await query
  if (error) return fail('DB error', 'DB_ERROR', 500)

  const recipients: number[] = (users ?? []).map((u: { telegram_id: number }) => u.telegram_id)

  // Preview mode — return count without sending
  if (previewOnly) {
    return ok({ previewOnly: true, recipientCount: recipients.length })
  }

  // Send sequentially to avoid Telegram rate limits (30 msg/s limit)
  let sent = 0
  let errors = 0
  for (const chatId of recipients) {
    const success = await sendTelegramMessage(chatId, message.trim())
    if (success) sent++
    else errors++
    // Small delay to respect Telegram rate limits
    await new Promise(r => setTimeout(r, 50))
  }

  return ok({ sent, skipped: recipients.length - sent - errors, errors })
}

import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'

type Ctx = { params: Promise<{ telegramId: string }> }

// DELETE — wipe all data for this user. They can return as a fresh user (not blocked).
export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const { telegramId: rawId } = await ctx.params
  const telegramId = parseInt(rawId, 10)
  if (isNaN(telegramId)) return fail('Invalid telegram_id', 'INVALID_DATA')

  const adminId = process.env.ADMIN_TELEGRAM_ID ? parseInt(process.env.ADMIN_TELEGRAM_ID, 10) : null
  if (adminId && telegramId === adminId) return fail('Cannot perform this action on the admin account', 'FORBIDDEN', 403)

  const supabase = createServiceClient()

  // 1. Get user row to find internal id
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegramId)
    .single()

  if (user) {
    // 2. Get all wallet ids for this user
    const { data: wallets } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', user.id)

    const walletIds = (wallets ?? []).map((w) => w.id)

    // 3. Delete wallet-dependent data
    if (walletIds.length > 0) {
      await supabase.from('wallet_balances').delete().in('wallet_id', walletIds)
      await supabase.from('donations').delete().in('wallet_id', walletIds)
      await supabase.from('purchases').delete().in('wallet_id', walletIds)
      await supabase.from('wallets').delete().eq('user_id', user.id)
    }

    // 4. Delete telegram-id-keyed data
    await supabase.from('game_sessions').delete().eq('telegram_id', telegramId)
    await supabase.from('team_change_requests').delete().eq('telegram_id', telegramId)

    // 5. Delete user row — they can return fresh on next open (not blocked)
    await supabase.from('users').delete().eq('telegram_id', telegramId)
  }

  return ok({ deleted: true, telegramId })
}

// PATCH — logout (clear wallets only) or block/unblock
export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const { telegramId: rawId } = await ctx.params
  const telegramId = parseInt(rawId, 10)
  if (isNaN(telegramId)) return fail('Invalid telegram_id', 'INVALID_DATA')

  const adminId = process.env.ADMIN_TELEGRAM_ID ? parseInt(process.env.ADMIN_TELEGRAM_ID, 10) : null
  if (adminId && telegramId === adminId) return fail('Cannot perform this action on the admin account', 'FORBIDDEN', 403)

  const body = await req.json() as { action?: 'logout'; block?: boolean; reason?: string; favorite_team?: string | null; display_preference?: string; bonus_balls?: number; bonus_spins?: number }

  // Logout action — remove all wallet connections, keep user row
  if (body.action === 'logout') {
    const supabase = createServiceClient()
    const { data: user } = await supabase.from('users').select('id').eq('telegram_id', telegramId).single()
    if (user) {
      const { data: wallets } = await supabase.from('wallets').select('id').eq('user_id', user.id)
      const walletIds = (wallets ?? []).map((w) => w.id)
      if (walletIds.length > 0) {
        await supabase.from('wallet_balances').delete().in('wallet_id', walletIds)
        await supabase.from('wallets').delete().eq('user_id', user.id)
      }
    }
    return ok({ telegramId, action: 'logout' })
  }

  const supabase = createServiceClient()

  // Edit user fields (favorite_team, display_preference, bonus_balls, bonus_spins)
  if (body.favorite_team !== undefined || body.display_preference !== undefined || body.bonus_balls !== undefined || body.bonus_spins !== undefined) {
    const updatePayload: Record<string, unknown> = {}
    if (body.favorite_team !== undefined) updatePayload.favorite_team = body.favorite_team
    if (body.display_preference !== undefined) updatePayload.display_preference = body.display_preference
    if (typeof body.bonus_balls === 'number' && body.bonus_balls >= 0) updatePayload.bonus_balls = body.bonus_balls
    if (typeof body.bonus_spins === 'number' && body.bonus_spins >= 0) updatePayload.bonus_spins = body.bonus_spins
    const { error } = await (supabase as any).from('users').update(updatePayload).eq('telegram_id', telegramId)
    if (error) return fail('Failed to update user', 'DB_ERROR', 500)
    return ok({ telegramId, updated: updatePayload })
  }

  await supabase
    .from('users')
    .update({ is_blocked: body.block })
    .eq('telegram_id', telegramId)

  // Mirror into blocked_telegram_ids so the block persists even if user is later deleted
  if (body.block) {
    await supabase
      .from('blocked_telegram_ids')
      .upsert(
        { telegram_id: telegramId, blocked_at: new Date().toISOString(), reason: body.reason ?? null },
        { onConflict: 'telegram_id' }
      )
  } else {
    await supabase
      .from('blocked_telegram_ids')
      .delete()
      .eq('telegram_id', telegramId)
  }

  return ok({ telegramId, blocked: body.block })
}

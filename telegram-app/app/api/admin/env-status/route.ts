import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { verifyAdminToken } from '@/app/api/admin/route'

const REQUIRED_VARS = [
  'REWARD_SENDER_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'NEXT_PUBLIC_HORIZON_URL',
  'REWARD_MEMO',
  'ADMIN_SECRET_TOKEN',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_PRIMARY_ASSET_CODE',
  'NEXT_PUBLIC_PRIMARY_ASSET_ISSUER',
]

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)

  const status: Record<string, boolean> = {}
  for (const v of REQUIRED_VARS) {
    const val = process.env[v]
    status[v] = typeof val === 'string' && val.length > 0
  }

  return ok({ status })
}

import { NextRequest } from 'next/server'
import { fail } from '@/lib/api-response'
import { POST as verifyDonation } from '@/packs/donations/admin/verify-route'
import { POST as verifyPurchase } from '@/packs/stellar-wallet/admin/verify-purchase-route'

export async function POST(req: NextRequest) {
  const pack = req.headers.get('x-admin-pack')
  if (pack === 'donations') return verifyDonation(req)
  if (pack === 'stellar-wallet') return verifyPurchase(req)
  return fail('Missing pack context', 'INVALID_DATA')
}

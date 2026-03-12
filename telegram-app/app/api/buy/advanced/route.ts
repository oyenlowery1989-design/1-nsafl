import { fail } from '@/lib/api-response'

export async function POST() {
  return fail('Advanced purchase coming soon', 'NOT_IMPLEMENTED', 501)
}

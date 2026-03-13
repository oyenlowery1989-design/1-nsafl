import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)
  const body = await req.json().catch(() => null)
  if (!body?.question || !body?.option_a || !body?.option_b || !body?.option_c || !body?.option_d || !body?.correct_option) {
    return fail('Missing required fields', 'BAD_REQUEST', 400)
  }
  const supabase = createServiceClient()
  const { data, error } = await (supabase as any)
    .from('quiz_questions')
    .insert({
      question: body.question,
      option_a: body.option_a,
      option_b: body.option_b,
      option_c: body.option_c,
      option_d: body.option_d,
      correct_option: body.correct_option,
      explanation: body.explanation ?? null,
      category: body.category ?? 'afl',
      difficulty: body.difficulty ?? 'medium',
    })
    .select()
    .single()
  if (error) return fail('Failed to create question', 'DB_ERROR', 500)
  return ok(data)
}

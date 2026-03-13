import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyAdminToken } from '@/app/api/admin/route'

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return fail('Forbidden', 'FORBIDDEN', 403)
  const supabase = createServiceClient()

  const [{ data: questions }, { data: sessions }] = await Promise.all([
    (supabase as any).from('quiz_questions').select('*').order('created_at', { ascending: false }),
    (supabase as any).from('quiz_sessions').select('id, mode, score, correct_count, total_questions, is_perfect, points_earned, status, created_at, telegram_id').eq('status', 'completed').order('created_at', { ascending: false }).limit(200),
  ])

  const allSessions = sessions ?? []
  const avgScore = allSessions.length
    ? Math.round((allSessions.reduce((s: number, r: { correct_count: number; total_questions: number }) => s + (r.correct_count / Math.max(r.total_questions, 1)), 0) / allSessions.length) * 100)
    : 0

  return ok({
    questions: questions ?? [],
    sessions: allSessions,
    stats: {
      totalQuestions: (questions ?? []).length,
      activeQuestions: (questions ?? []).filter((q: { active: boolean }) => q.active).length,
      totalSessions: allSessions.length,
      avgScorePct: avgScore,
    },
  })
}

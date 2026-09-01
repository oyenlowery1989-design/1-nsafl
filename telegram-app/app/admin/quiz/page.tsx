'use client'

import FeatureRedirect from '@/components/FeatureRedirect'
import QuizPage from '@/packs/quiz/admin/QuizPage'

export default function AdminQuizPage() {
  return <FeatureRedirect feature="quiz"><QuizPage /></FeatureRedirect>
}

import type { PackManifest } from '@/packs/types'

export const quizPack = {
  id: 'quiz',
  admin: [{ href: '/admin/quiz', label: 'Quiz', icon: 'quiz' }],
} satisfies PackManifest

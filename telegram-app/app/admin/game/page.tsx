'use client'

import FeatureRedirect from '@/components/FeatureRedirect'
import GamePage from '@/packs/games/admin/GamePage'

export default function AdminGamePage() {
  return <FeatureRedirect feature="games"><GamePage /></FeatureRedirect>
}

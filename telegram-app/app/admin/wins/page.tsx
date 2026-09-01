'use client'

import FeatureRedirect from '@/components/FeatureRedirect'
import WinsPage from '@/packs/games/admin/WinsPage'

export default function AdminWinsPage() {
  return <FeatureRedirect feature="games"><WinsPage /></FeatureRedirect>
}

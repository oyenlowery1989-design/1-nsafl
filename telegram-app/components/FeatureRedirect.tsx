'use client'

import { redirect } from 'next/navigation'
import { isFeatureEnabled, type AppFeature } from '@/config/app'

export default function FeatureRedirect({ feature, children }: { feature: AppFeature; children: React.ReactNode }) {
  if (!isFeatureEnabled(feature)) redirect('/')

  return children
}

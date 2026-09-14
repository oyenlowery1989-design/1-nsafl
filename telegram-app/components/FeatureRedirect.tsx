'use client'

import { redirect } from 'next/navigation'
import { isPackEnabled, type AppFeature } from '@/config/app'

export default function FeatureRedirect({ feature, children }: { feature: AppFeature; children: React.ReactNode }) {
  if (!isPackEnabled(feature)) redirect('/')

  return children
}

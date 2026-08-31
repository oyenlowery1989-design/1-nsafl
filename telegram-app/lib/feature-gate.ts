import { NextResponse } from 'next/server'
import { isFeatureEnabled, type AppFeature } from '@/config/app'

export function requireFeature(feature: AppFeature) {
  if (isFeatureEnabled(feature)) return null

  return NextResponse.json({ success: false, code: 'FEATURE_DISABLED' }, { status: 404 })
}

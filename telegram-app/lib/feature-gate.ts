import { NextResponse } from 'next/server'
import { isPackEnabled, type AppFeature } from '@/config/app'
import type { PackId } from '@/packs/types'

export function requirePack(pack: PackId) {
  if (isPackEnabled(pack)) return null

  return NextResponse.json({ success: false, code: 'FEATURE_DISABLED' }, { status: 404 })
}

export const requireFeature = (feature: AppFeature) => requirePack(feature)

import { describe, expect, it } from 'vitest'
import { APP_CONFIG, getNavigationItems, isFeatureEnabled } from '@/config/app'

describe('template configuration', () => {
  it('keeps every NSAFL module enabled by default', () => {
    expect(isFeatureEnabled('sports')).toBe(true)
    expect(isFeatureEnabled('games')).toBe(true)
    expect(isFeatureEnabled('rewards')).toBe(true)
  })

  it('only returns navigation entries for enabled features', () => {
    const items = getNavigationItems({ ...APP_CONFIG.features, sports: false })

    expect(items.some((item) => item.href === '/clubs')).toBe(false)
    expect(items.some((item) => item.href === '/')).toBe(true)
  })
})

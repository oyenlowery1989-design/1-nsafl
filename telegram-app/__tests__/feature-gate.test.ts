import { expect, it } from 'vitest'
import { requireFeature, requirePack } from '@/lib/feature-gate'

it('allows enabled features to continue to their handlers', () => {
  expect(requirePack('games')).toBeNull()
  expect(requireFeature('games')).toBeNull()
})

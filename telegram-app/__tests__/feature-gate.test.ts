import { expect, it } from 'vitest'
import { requireFeature } from '@/lib/feature-gate'

it('allows enabled features to continue to their handlers', () => {
  expect(requireFeature('games')).toBeNull()
})

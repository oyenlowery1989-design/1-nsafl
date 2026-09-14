import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const guardSource = readFileSync('components/guards/TelegramGuard.tsx', 'utf8')
const sessionRouteSource = readFileSync('app/api/auth/session/route.ts', 'utf8')

it('keeps TelegramGuard independent from pack-owned stores', () => {
  expect(guardSource).not.toMatch(/packs\/(stellar-wallet|sports)\/store/)
})

it('keeps the core session route independent from the Stellar repository', () => {
  expect(sessionRouteSource).not.toMatch(/packs\/stellar-wallet\/repository/)
  expect(sessionRouteSource).toMatch(/getSessionData/)
})

import { NextRequest } from 'next/server'
import { expect, it, vi } from 'vitest'

const { select } = vi.hoisted(() => ({ select: vi.fn() }))

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: () => ({ from: () => ({ select }) }),
}))

import { GET } from '@/packs/leaderboard/api/route'

it('bypasses the Next data cache for Horizon holder responses', async () => {
  vi.stubEnv('NEXT_PUBLIC_PRIMARY_ASSET_CODE', 'TEST')
  vi.stubEnv('NEXT_PUBLIC_PRIMARY_ASSET_ISSUER', 'issuer')
  vi.stubEnv('NEXT_PUBLIC_HORIZON_URL', 'https://horizon.test')
  select.mockResolvedValue({ data: [], error: null })
  const fetchMock = vi.fn().mockResolvedValue(Response.json({
    _embedded: { records: [] },
    _links: {},
  }))
  vi.stubGlobal('fetch', fetchMock)

  const response = await GET(new NextRequest('https://app.test/api/leaderboard'))

  expect(response.status).toBe(200)
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('https://horizon.test/accounts?'),
    { cache: 'no-store' },
  )
})

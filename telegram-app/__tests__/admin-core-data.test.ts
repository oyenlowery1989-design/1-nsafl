import { beforeEach, expect, it, vi } from 'vitest'

const { from } = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('@/config/app', () => ({ isPackEnabled: () => false }))
vi.mock('@/lib/supabase-server', () => ({ createServiceClient: () => ({ from }) }))

function query() {
  return {
    select: vi.fn(() => query()),
    order: vi.fn(() => query()),
    limit: vi.fn(() => query()),
    not: vi.fn(() => query()),
    then: (resolve: (value: { data: [] }) => unknown) => resolve({ data: [] }),
  }
}

beforeEach(() => {
  process.env.ADMIN_SECRET_TOKEN = 'test-admin-token'
  from.mockImplementation(() => query())
})

it('loads only identity and access data when every pack is disabled', async () => {
  const { GET } = await import('@/app/api/admin/route')
  const response = await GET(new Request('https://example.test/api/admin', {
    headers: { 'x-admin-token': 'test-admin-token' },
  }) as never)

  expect(response.status).toBe(200)
  expect(from.mock.calls.map(([table]) => table)).toEqual(['users', 'access_attempts'])
})

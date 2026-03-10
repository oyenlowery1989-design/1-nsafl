import { NextRequest } from 'next/server'
import crypto from 'crypto'

// TEMPORARY debug endpoint — remove after fixing 401
export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data') ?? ''
  const token = process.env.TELEGRAM_BOT_TOKEN ?? ''

  const params = new URLSearchParams(initData)
  const hash = params.get('hash') ?? ''
  params.delete('hash')
  const sorted = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest()
  const expectedHash = crypto.createHmac('sha256', secretKey).update(sorted).digest('hex')

  return Response.json({
    tokenPrefix: token.slice(0, 10) + '...',
    hashFromClient: hash.slice(0, 16) + '...',
    expectedHash: expectedHash.slice(0, 16) + '...',
    match: expectedHash === hash,
    initDataLength: initData.length,
    tokenLength: token.length,
  })
}

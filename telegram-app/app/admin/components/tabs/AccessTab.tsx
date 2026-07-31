'use client'
import { Badge, Card, Th, Td } from '../ui'
import { dt } from '../../utils'
import type { AdminData } from '../../types'

interface Props {
  data: AdminData
  accessTimeFilter: '1h' | '24h' | '7d' | 'all'
  setAccessTimeFilter: (v: '1h' | '24h' | '7d' | 'all') => void
  suspiciousAccess: number
  clearLogsConfirm: boolean
  setClearLogsConfirm: (v: boolean) => void
  clearingLogs: boolean
  onBulkDelete: (days: number) => void
  deletingAccessId: string | null
  onDeleteAccess: (id: string) => void
}

export function AccessTab({
  data, accessTimeFilter, setAccessTimeFilter, suspiciousAccess,
  clearLogsConfirm, setClearLogsConfirm, clearingLogs, onBulkDelete,
  deletingAccessId, onDeleteAccess,
}: Props) {
  const visibleAttempts = data.accessAttempts.filter(a => {
    if (accessTimeFilter === 'all') return true
    const ms = { '1h': 60 * 60 * 1000, '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000 }[accessTimeFilter]
    return Date.now() - new Date(a.created_at).getTime() <= ms
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        {(['1h', '24h', '7d', 'all'] as const).map(f => (
          <button key={f} onClick={() => setAccessTimeFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
              accessTimeFilter === f ? 'bg-[#D4AF37]/15 text-[#D4AF37]' : 'bg-white/6 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}>
            {f === '1h' ? 'Last hour' : f === '24h' ? 'Last 24h' : f === '7d' ? 'Last 7d' : 'All time'}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {suspiciousAccess > 0 && <Badge color="red">{suspiciousAccess} suspicious</Badge>}
          <Badge color="gray">{data.accessAttempts.length} total (last 100)</Badge>
          {clearLogsConfirm ? (
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="text-gray-400">Delete logs older than 7 days?</span>
              <button onClick={() => onBulkDelete(7)} disabled={clearingLogs}
                className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 font-semibold disabled:opacity-40">
                {clearingLogs ? '…' : 'Yes'}
              </button>
              <button onClick={() => setClearLogsConfirm(false)} className="px-2 py-0.5 rounded bg-white/10 text-gray-400 hover:bg-white/20 font-semibold">No</button>
            </span>
          ) : (
            <button onClick={() => setClearLogsConfirm(true)} className="text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2.5 py-1 rounded-lg font-semibold transition">
              Clear old logs
            </button>
          )}
        </div>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/3"><tr>
              <Th>Type</Th><Th>IP / Location</Th><Th>User</Th><Th>Screen</Th><Th>Timezone</Th><Th>Language</Th><Th>When</Th><Th />
            </tr></thead>
            <tbody className="divide-y divide-white/4">
              {visibleAttempts.map(a => {
                const isDevtools      = a.devtools_opened
                const isFakeSdk       = a.tg_sdk_fake
                const isBrowserBlock  = !a.telegram_id && !a.tg_sdk_present
                const isSpoofAttempt  = !a.telegram_id && a.tg_sdk_present && !a.tg_sdk_fake
                return (
                  <tr key={a.id} className={`${isDevtools || isFakeSdk ? 'bg-red-500/5' : isBrowserBlock ? 'bg-white/2' : 'hover:bg-white/3'}`}>
                    <Td>
                      {isDevtools      ? <Badge color="red">DevTools opened</Badge>
                        : isFakeSdk    ? <Badge color="red">Fake SDK</Badge>
                        : isBrowserBlock ? <Badge color="gray">Browser — no Telegram</Badge>
                        : isSpoofAttempt ? <Badge color="yellow">SDK present, no user</Badge>
                        : <Badge color="green">Telegram session</Badge>}
                    </Td>
                    <Td mono>
                      <span className="text-gray-300">{a.ip ?? '—'}</span>
                      {a.geo_location && <span className="block text-[11px] text-gray-500 font-sans">({a.geo_location})</span>}
                    </Td>
                    <Td>
                      {a.telegram_id
                        ? <div>
                            <span className="text-white text-xs font-medium">{a.telegram_first_name ?? ''}</span>
                            {a.telegram_username && <span className="text-[#D4AF37] text-xs ml-1">@{a.telegram_username}</span>}
                            <span className="block text-[10px] text-gray-600 font-mono">{a.telegram_id}</span>
                          </div>
                        : <span className="text-gray-600 text-xs italic">No Telegram user</span>}
                    </Td>
                    <Td><span className="text-gray-400 text-xs">{a.screen ?? '—'}</span></Td>
                    <Td><span className="text-gray-400 text-xs">{a.timezone ?? '—'}</span></Td>
                    <Td><span className="text-gray-400 text-xs">{a.language ?? '—'}</span></Td>
                    <Td><span className="text-gray-500 text-xs">{dt(a.created_at)}</span></Td>
                    <Td>
                      <button onClick={() => onDeleteAccess(a.id)} disabled={deletingAccessId === a.id}
                        className="text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2 py-0.5 rounded transition disabled:opacity-40">
                        {deletingAccessId === a.id ? '…' : 'Delete'}
                      </button>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

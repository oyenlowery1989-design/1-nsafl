'use client'
import { Card, Th, Td, StatTile, TgUser } from '../ui'
import { dt } from '../../utils'
import type { AdminData, WalletRef } from '../../types'

interface Props {
  data: AdminData
  walletById: Record<string, WalletRef>
}

export function GameTab({ data, walletById }: Props) {
  const sessions = data.gameSessions
  const totalSessions = sessions.length
  const totalGameKicks = sessions.reduce((s, g) => s + g.kicks, 0)
  const avgKicks = totalSessions > 0 ? Math.round(totalGameKicks / totalSessions) : 0
  const totalSeconds = sessions.reduce((s, g) => s + g.duration_seconds, 0)
  const playHours = Math.floor(totalSeconds / 3600)
  const playMins = Math.floor((totalSeconds % 3600) / 60)
  const playTime = playHours > 0 ? `${playHours}h ${playMins}m` : `${playMins}m`

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total Sessions"      value={totalSessions}                    accent="text-purple-400" />
        <StatTile label="Total Kicks"         value={totalGameKicks.toLocaleString()}  accent="text-yellow-400" />
        <StatTile label="Avg Kicks / Session" value={avgKicks}                         accent="text-blue-400" />
        <StatTile label="Total Play Time"     value={playTime}                         accent="text-green-400" />
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/3"><tr>
              <Th>User</Th><Th>Kicks</Th><Th>Balls</Th><Th>Duration</Th><Th>Stellar Address</Th><Th>When</Th>
            </tr></thead>
            <tbody className="divide-y divide-white/4">
              {sessions.map(s => {
                const w = s.wallet_id ? walletById[s.wallet_id] : null
                return (
                  <tr key={s.id} className="hover:bg-white/3">
                    <Td><TgUser users={data.users} id={s.telegram_id} /></Td>
                    <Td><span className="font-bold text-purple-400">{s.kicks}</span></Td>
                    <Td><span className="text-gray-300">{s.balls_spawned}</span></Td>
                    <Td><span className="text-gray-400">{s.duration_seconds}s</span></Td>
                    <Td mono>{w ? <span className="text-xs text-gray-300 break-all">{w.stellar_address}</span> : <span className="text-gray-600">—</span>}</Td>
                    <Td><span className="text-gray-500 text-xs">{dt(s.created_at)}</span></Td>
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

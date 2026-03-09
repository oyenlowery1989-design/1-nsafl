import { ok } from '@/lib/api-response'

export async function GET() {
  return ok({
    totalFunding: '2.4M',
    weeklyChange: '+12.5%',
    chartData: [30, 45, 60, 75, 100],
    target: '3M',
    regional: [
      { name: 'Swan Districts', pct: 45, color: 'bg-blue-500' },
      { name: 'South Fremantle', pct: 30, color: 'bg-red-500' },
      { name: 'Other Regions', pct: 25, color: 'bg-gray-500' },
    ],
    topSupporters: [
      { rank: 1, name: 'CryptoKing99', hub: 'Swan Districts Hub', amount: '150k' },
      { rank: 2, name: 'WAFL_Fanatic', hub: 'South Fremantle Hub', amount: '120k' },
      { rank: 3, name: 'FootyLegend', hub: 'East Perth Hub', amount: '95k' },
    ],
  })
}

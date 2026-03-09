'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { PRIMARY_CUSTOM_ASSET_LABEL } from '@/lib/constants'

interface StatsData {
  totalFunding: string
  weeklyChange: string
  chartData: number[]
  target: string
  regional: { name: string; pct: number; color: string }[]
  topSupporters: { rank: number; name: string; hub: string; amount: string }[]
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May']

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null)

  useEffect(() => {
    fetch('/api/stats/funding')
      .then((r) => r.json())
      .then((j) => j.success && setData(j.data))
  }, [])

  return (
    <>
      <header className="pt-12 pb-4 px-6 sticky top-0 z-10 bg-[#0A0E1A]/80 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center space-x-4">
          <button onClick={() => history.back()} className="w-10 h-10 rounded-lg glass-card flex items-center justify-center hover:bg-white/10 transition">
            <span className="material-symbols-outlined text-white">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Movement Stats</h1>
            <p className="text-sm text-[#D4AF37] font-medium">Global Homecoming Progress</p>
          </div>
        </div>
      </header>
      <main className="px-6 py-6 space-y-6 pb-32">
        {data && (
          <div className="glass-card p-5 rounded-xl space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Total Funding</h2>
                <div className="text-3xl font-bold text-white mt-1">
                  {data.totalFunding} <span className="text-[#D4AF37] text-xl">{PRIMARY_CUSTOM_ASSET_LABEL}</span>
                </div>
              </div>
              <div className="flex items-center space-x-1 text-green-400 bg-green-500/10 px-2 py-1 rounded text-xs font-semibold">
                <span className="material-symbols-outlined text-[14px]">trending_up</span>
                <span>{data.weeklyChange}</span>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between h-32 space-x-2">
              {data.chartData.map((pct, i) => (
                <div
                  key={i}
                  className={`w-1/6 rounded-t-sm relative group ${i === data.chartData.length - 1 ? 'bg-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.4)]' : i === data.chartData.length - 2 ? 'bg-[#D4AF37]/60' : 'bg-white/10'}`}
                  style={{ height: `${pct}%` }}
                >
                  <div className={`absolute -top-6 left-1/2 -translate-x-1/2 text-xs transition ${i === data.chartData.length - 1 ? 'text-[#D4AF37] font-bold opacity-100' : 'text-gray-400 opacity-0 group-hover:opacity-100'}`}>
                    {MONTH_LABELS[i]}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 uppercase">
              <span>5 Months Trend</span>
              <span>Target: {data.target}</span>
            </div>
          </div>
        )}
        {data && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white">Regional Support</h2>
            <div className="glass-card p-4 rounded-xl space-y-4">
              {data.regional.map((r) => (
                <div key={r.name} className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${r.color}`} />
                      <span className="text-gray-300">{r.name}</span>
                    </div>
                    <span className="font-bold text-white">{r.pct}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div className={`${r.color} h-2 rounded-full`} style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {data && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Top Supporters</h2>
              <a className="text-xs text-[#D4AF37] hover:underline" href="#">View All</a>
            </div>
            <div className="space-y-2">
              {data.topSupporters.map((s) => (
                <div key={s.rank} className="glass-card p-3 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border ${s.rank === 1 ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30' : s.rank === 2 ? 'bg-white/10 text-gray-300 border-white/20' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                      {s.rank}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{s.name}</h3>
                      <p className="text-[10px] text-gray-400">{s.hub}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold text-sm ${s.rank === 1 ? 'text-[#D4AF37]' : 'text-white'}`}>{s.amount}</div>
                    <div className="text-[10px] text-gray-500">{PRIMARY_CUSTOM_ASSET_LABEL}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </>
  )
}

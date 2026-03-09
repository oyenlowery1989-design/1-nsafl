'use client'
import BottomNav from '@/components/BottomNav'
import { ROUND_1_FIXTURES, type AflFixture } from '@/config/afl'

function groupByDate(fixtures: AflFixture[]) {
  return fixtures.reduce((acc, f) => {
    if (!acc[f.date]) acc[f.date] = []
    acc[f.date].push(f)
    return acc
  }, {} as Record<string, AflFixture[]>)
}

export default function ClubsPage() {
  const grouped = groupByDate(ROUND_1_FIXTURES)

  return (
    <>
      <header className="pt-12 pb-4 px-6 sticky top-0 z-10 bg-[#0A0E1A]/80 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#D4AF37]">stadium</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">AFL Fixtures</h1>
            <p className="text-xs text-[#D4AF37] font-medium">Round 1 — 2025</p>
          </div>
        </div>
      </header>
      <main className="px-6 py-6 space-y-8 pb-32">
        {Object.entries(grouped).map(([date, fixtures]) => (
          <section key={date}>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">{date}</h2>
            <div className="space-y-3">
              {fixtures.map((f) => {
                const homeWins = (f.homeScore ?? 0) > (f.awayScore ?? 0)
                const awayWins = (f.awayScore ?? 0) > (f.homeScore ?? 0)
                return (
                  <div key={f.id} className="glass-card rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                        {f.status}
                      </span>
                      <span className="text-[10px] text-gray-500 text-right">{f.venue}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className={`font-bold text-sm leading-tight ${homeWins ? 'text-white' : 'text-gray-500'}`}>
                          {f.homeTeam}
                        </p>
                      </div>
                      <div className="flex items-center space-x-3 mx-4">
                        <span className={`text-2xl font-bold ${homeWins ? 'text-white' : 'text-gray-500'}`}>
                          {f.homeScore ?? '-'}
                        </span>
                        <span className="text-gray-600 text-sm font-mono">vs</span>
                        <span className={`text-2xl font-bold ${awayWins ? 'text-white' : 'text-gray-500'}`}>
                          {f.awayScore ?? '-'}
                        </span>
                      </div>
                      <div className="flex-1 text-right">
                        <p className={`font-bold text-sm leading-tight ${awayWins ? 'text-white' : 'text-gray-500'}`}>
                          {f.awayTeam}
                        </p>
                      </div>
                    </div>
                    {f.winner && (
                      <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        <p className="text-xs text-[#D4AF37] font-medium">{f.winner}</p>
                        <p className="text-[10px] text-gray-500">{f.country}</p>
                      </div>
                    )}
                    <a
                      href={f.matchReportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 text-xs text-[#D4AF37] hover:underline"
                    >
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      <span>Match Report</span>
                    </a>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </main>
      <BottomNav />
    </>
  )
}

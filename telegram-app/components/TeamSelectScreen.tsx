'use client'
import { useState } from 'react'
import { AFL_CLUBS, WAFL_CLUBS, type AflClub } from '@/config/afl'
import { haptic } from '@/lib/telegram-ui'

interface Props {
  onSelect: (teamId: string) => void
}

function ClubLogo({ club, size = 52 }: { club: AflClub; size?: number }) {
  if (club.logo) {
    return (
      <img
        src={club.logo}
        alt={club.name}
        width={size}
        height={size}
        className="object-contain drop-shadow-md"
        loading="lazy"
      />
    )
  }
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold"
      style={{ width: size, height: size, background: club.color, fontSize: size * 0.22 }}
    >
      {club.shortName}
    </div>
  )
}

// ── Step 1: League picker ──────────────────────────────────────────────────────

function LeaguePicker({ onPick }: { onPick: (league: 'AFL' | 'WAFL') => void }) {
  return (
    <main className="px-5 py-8 pb-32 min-h-[100dvh] flex flex-col">
      {/* Header */}
      <div className="text-center space-y-2 mb-10">
        <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 bg-[#D4AF37]/30 rounded-full blur-2xl" />
          <div className="w-14 h-14 rounded-full border border-[#D4AF37]/50 bg-[#0A0E1A]/80 backdrop-blur-md flex items-center justify-center relative z-10 shadow-[0_0_20px_rgba(212,175,55,0.4)]">
            <span
              className="material-symbols-outlined text-[32px] text-[#D4AF37]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              shield
            </span>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-[#D4AF37] font-['Playfair_Display'] tracking-tight">
          Choose Your League
        </h2>
        <p className="text-xs text-gray-400 max-w-[240px] mx-auto leading-relaxed">
          Which competition does your club play in?
        </p>
      </div>

      {/* League cards */}
      <div className="space-y-4 flex-1">
        <button
          onClick={() => { haptic.medium(); onPick('AFL') }}
          className="w-full glass-card rounded-2xl p-6 border border-white/10 hover:border-[#D4AF37]/40 active:scale-[0.98] transition-all text-left group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-bold text-white mb-1">AFL</p>
              <p className="text-xs text-gray-400">Australian Football League</p>
              <p className="text-[10px] text-gray-600 mt-1">{AFL_CLUBS.length} clubs</p>
            </div>
            <div className="flex items-center gap-1">
              {AFL_CLUBS.slice(0, 4).map((c) => (
                <img key={c.id} src={c.logo} alt={c.shortName} width={28} height={28} className="object-contain opacity-80" />
              ))}
              <span className="text-[10px] text-gray-500 ml-1">+{AFL_CLUBS.length - 4}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-[#D4AF37] font-semibold">
            <span>Select AFL club</span>
            <span className="material-symbols-outlined text-[16px] ml-1 group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </div>
        </button>

        <button
          onClick={() => { haptic.medium(); onPick('WAFL') }}
          className="w-full glass-card rounded-2xl p-6 border border-white/10 hover:border-[#D4AF37]/40 active:scale-[0.98] transition-all text-left group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-bold text-white mb-1">WAFL</p>
              <p className="text-xs text-gray-400">Western Australian Football League</p>
              <p className="text-[10px] text-gray-600 mt-1">{WAFL_CLUBS.length} clubs</p>
            </div>
            <div className="flex items-center gap-1">
              {WAFL_CLUBS.slice(0, 4).map((c) => (
                <ClubLogo key={c.id} club={c} size={28} />
              ))}
              <span className="text-[10px] text-gray-500 ml-1">+{WAFL_CLUBS.length - 4}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-[#D4AF37] font-semibold">
            <span>Select WAFL club</span>
            <span className="material-symbols-outlined text-[16px] ml-1 group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </div>
        </button>
      </div>
    </main>
  )
}

// ── Step 2: Club picker ────────────────────────────────────────────────────────

function ClubPicker({ league, onSelect, onBack }: {
  league: 'AFL' | 'WAFL'
  onSelect: (teamId: string) => void
  onBack: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const clubs = league === 'AFL' ? AFL_CLUBS : WAFL_CLUBS
  const selectedClub = clubs.find((c) => c.id === selected)

  const handleConfirm = () => {
    if (!selected) return
    setConfirming(true)
    onSelect(selected)
  }

  return (
    <main className="px-4 py-4 pb-32 min-h-[100dvh] flex flex-col">
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => { haptic.light(); onBack() }}
          className="w-9 h-9 rounded-xl glass-card flex items-center justify-center border border-white/10 hover:border-white/20 transition"
        >
          <span className="material-symbols-outlined text-[20px] text-gray-400">arrow_back</span>
        </button>
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">{league} Clubs</h2>
          <p className="text-[10px] text-gray-500">{clubs.length} teams · pick your allegiance</p>
        </div>
      </div>

      {/* Club grid */}
      <div className="grid grid-cols-3 gap-2.5 flex-1 content-start mb-5">
        {clubs.map((club) => {
          const isSelected = selected === club.id
          return (
            <button
              key={club.id}
              onClick={() => { haptic.light(); setSelected(club.id) }}
              className={`relative rounded-xl p-2.5 flex flex-col items-center transition-all duration-200 ${
                isSelected ? 'scale-[1.03]' : 'glass-card hover:bg-white/5 active:scale-[0.97]'
              }`}
              style={
                isSelected
                  ? { background: `${club.color}20`, border: `2px solid ${club.color}`, boxShadow: `0 0 24px ${club.color}50` }
                  : { border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              <div className="w-14 h-14 flex items-center justify-center mb-1">
                <ClubLogo club={club} />
              </div>
              <p className={`text-[9px] font-semibold leading-tight text-center ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                {club.name}
              </p>
              {isSelected && (
                <div
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-md"
                  style={{ background: club.color }}
                >
                  <span className="material-symbols-outlined text-white text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Confirm button */}
      <div className="sticky bottom-6">
        {selected && selectedClub && (
          <div className="flex items-center justify-center space-x-2 mb-3">
            <ClubLogo club={selectedClub} size={24} />
            <p className="text-xs text-gray-400">
              Pledging to <span className="font-bold text-white">{selectedClub.name}</span>
            </p>
          </div>
        )}
        <button
          onClick={handleConfirm}
          disabled={!selected || confirming}
          className="w-full py-4 rounded-xl font-bold text-base transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-[#D4AF37] text-[#0A0E1A] hover:bg-[#D4AF37]/90 shadow-[0_0_20px_rgba(212,175,55,0.4)] uppercase tracking-wide flex items-center justify-center active:scale-[0.98]"
        >
          {confirming ? (
            <>
              <span className="material-symbols-outlined text-[20px] mr-2 animate-spin">progress_activity</span>
              Joining...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[20px] mr-2">how_to_reg</span>
              {selected ? 'Confirm & Enter Hub' : 'Select a Team'}
            </>
          )}
        </button>
      </div>
    </main>
  )
}

// ── Main component — step machine ──────────────────────────────────────────────

export default function TeamSelectScreen({ onSelect }: Props) {
  const [league, setLeague] = useState<'AFL' | 'WAFL' | null>(null)

  if (!league) {
    return <LeaguePicker onPick={setLeague} />
  }

  return (
    <ClubPicker
      league={league}
      onSelect={onSelect}
      onBack={() => setLeague(null)}
    />
  )
}

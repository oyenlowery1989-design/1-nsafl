'use client'
import { useState } from 'react'
import { AFL_CLUBS } from '@/config/afl'

interface Props {
  onSelect: (teamId: string) => void
}

export default function TeamSelectScreen({ onSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const handleConfirm = () => {
    if (!selected) return
    setConfirming(true)
    onSelect(selected)
  }

  const selectedClub = AFL_CLUBS.find((c) => c.id === selected)

  return (
    <main className="px-4 py-6 pb-32 min-h-[100dvh] flex flex-col">
      {/* Header */}
      <div className="text-center space-y-2 mb-5">
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
          Choose Your Team
        </h2>
        <p className="text-xs text-gray-400 max-w-[260px] mx-auto leading-relaxed">
          Pledge allegiance to your club. This is your identity in the Homecoming Hub.
        </p>
      </div>

      {/* Team grid — logos prominently displayed */}
      <div className="grid grid-cols-3 gap-2.5 flex-1 content-start mb-5">
        {AFL_CLUBS.map((club) => {
          const isSelected = selected === club.id
          return (
            <button
              key={club.id}
              onClick={() => setSelected(club.id)}
              className={`relative rounded-xl p-2.5 flex flex-col items-center transition-all duration-200 ${
                isSelected
                  ? 'scale-[1.03]'
                  : 'glass-card hover:bg-white/5 active:scale-[0.97]'
              }`}
              style={
                isSelected
                  ? {
                      background: `${club.color}20`,
                      border: `2px solid ${club.color}`,
                      boxShadow: `0 0 24px ${club.color}50`,
                    }
                  : { border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {/* Club logo */}
              <div className="w-14 h-14 flex items-center justify-center mb-1">
                <img
                  src={club.logo}
                  alt={club.name}
                  width={52}
                  height={52}
                  className="object-contain drop-shadow-md"
                  loading="lazy"
                />
              </div>
              <p className={`text-[9px] font-semibold leading-tight text-center ${
                isSelected ? 'text-white' : 'text-gray-500'
              }`}>
                {club.name}
              </p>
              {isSelected && (
                <div
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-md"
                  style={{ background: club.color }}
                >
                  <span className="material-symbols-outlined text-white text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check
                  </span>
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
            <img src={selectedClub.logo} alt="" width={24} height={24} className="object-contain" />
            <p className="text-xs text-gray-400">
              Pledging to{' '}
              <span className="font-bold text-white">{selectedClub.name}</span>
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

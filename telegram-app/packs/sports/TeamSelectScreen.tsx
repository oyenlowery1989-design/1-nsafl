'use client'
import { useState } from 'react'
import Image from 'next/image'
import { AFL_CLUBS, WAFL_CLUBS, type AflClub } from '@/config/afl'
import { PARTNER_CLUB, PARTNER_SQUAD } from '@/config/partnerClub'
import { haptic } from '@/lib/telegram-ui'

interface Props {
  onSelect: (aflTeamId: string, waflTeamId: string | null) => void
}

// ── WhipLash347 Partner Card ───────────────────────────────────────────────────

function WhipLash347Card({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={() => { haptic.medium(); onSelect() }}
      className="w-full rounded-2xl p-4 flex items-center gap-4 transition-all duration-200 mb-5 relative overflow-hidden"
      style={
        selected
          ? {
              background: `linear-gradient(135deg, ${PARTNER_CLUB.color}18 0%, ${PARTNER_CLUB.secondaryColor}10 100%)`,
              border: `2px solid ${PARTNER_CLUB.color}`,
              boxShadow: `0 0 32px ${PARTNER_CLUB.color}40, inset 0 0 32px ${PARTNER_CLUB.secondaryColor}08`,
            }
          : {
              background: 'rgba(232,25,44,0.06)',
              border: '1px solid rgba(232,25,44,0.25)',
            }
      }
    >
      {/* Glow line top */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${PARTNER_CLUB.color}, ${PARTNER_CLUB.secondaryColor}, transparent)` }} />

      {/* Logo */}
      <div className="relative shrink-0">
        <Image
          src={PARTNER_CLUB.logo}
          alt={PARTNER_CLUB.name}
          width={56}
          height={56}
          className="rounded-full object-cover"
          style={{ boxShadow: selected ? `0 0 16px ${PARTNER_CLUB.color}80` : `0 0 8px ${PARTNER_CLUB.color}40` }}
        />
      </div>

      {/* Text */}
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: PARTNER_CLUB.color }}>⚡ {PARTNER_CLUB.partnerTeamLabel}</span>
        </div>
        <p className="text-base font-bold text-white tracking-tight">{PARTNER_CLUB.name}</p>
        <p className="text-[10px] text-gray-500 mt-0.5">{PARTNER_SQUAD.length} players · {PARTNER_CLUB.sourceClubs.map(c => c.name).join(' & ')} picks</p>
      </div>

      {/* Check / chevron */}
      {selected ? (
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: PARTNER_CLUB.color }}>
          <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
        </div>
      ) : (
        <span className="material-symbols-outlined text-gray-600 text-[22px]">chevron_right</span>
      )}
    </button>
  )
}

function ClubLogo({ club, size = 52 }: { club: AflClub; size?: number }) {
  if (club.logo) {
    return (
      <Image
        src={club.logo}
        alt={club.name}
        width={size}
        height={size}
        className="object-contain drop-shadow-md"
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

// ── Step 1: AFL Club picker ────────────────────────────────────────────────────

function AflPicker({ onNext, onSelectPartner }: {
  onNext: (aflTeamId: string) => void
  onSelectPartner: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const selectedClub = AFL_CLUBS.find((c) => c.id === selected)

  const handleNext = () => {
    if (!selected) return
    setConfirming(true)
    onNext(selected)
  }

  return (
    <main className="px-4 py-4 pb-32 min-h-[100dvh] flex flex-col">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-[10px] font-bold text-primary">1</div>
          <h2 className="text-lg font-bold text-white tracking-tight">Pick Your Team</h2>
        </div>
        <p className="text-[10px] text-gray-500 pl-8">{AFL_CLUBS.length} AFL clubs + partner team · required</p>
        <div className="mt-2 flex items-center gap-1.5 pl-8">
          <div className="h-1 w-16 rounded-full bg-primary" />
          <div className="h-1 w-16 rounded-full bg-white/10" />
        </div>
      </div>

      {/* Partner club card */}
      {PARTNER_CLUB.enabled && <WhipLash347Card selected={false} onSelect={onSelectPartner} />}

      {/* Divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-white/8" />
        <span className="text-[9px] text-gray-600 font-semibold uppercase tracking-widest">or pick an AFL club</span>
        <div className="flex-1 h-px bg-white/8" />
      </div>

      {/* Club grid */}
      <div className="grid grid-cols-3 gap-2.5 flex-1 content-start mb-5">
        {AFL_CLUBS.map((club) => {
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

      {/* Next button */}
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
          onClick={handleNext}
          disabled={!selected || confirming}
          className="w-full py-4 rounded-xl font-bold text-base transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-primary text-background-dark hover:bg-primary/90 shadow-[0_0_20px_rgba(212,175,55,0.4)] uppercase tracking-wide flex items-center justify-center active:scale-[0.98]"
        >
          {selected ? (
            <>Next — Pick WAFL Club <span className="material-symbols-outlined text-[20px] ml-2">arrow_forward</span></>
          ) : (
            'Select a Team'
          )}
        </button>
      </div>
    </main>
  )
}

// ── Step 2: WAFL Club picker ───────────────────────────────────────────────────

function WaflPicker({ aflTeamId, onDone, onBack }: {
  aflTeamId: string
  onDone: (waflTeamId: string | null) => void
  onBack: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const selectedClub = WAFL_CLUBS.find((c) => c.id === selected)
  const aflClub = AFL_CLUBS.find((c) => c.id === aflTeamId)

  const handleConfirm = () => {
    setConfirming(true)
    onDone(selected)
  }

  const handleSkip = () => {
    onDone(null)
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
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-[10px] font-bold text-primary">2</div>
            <h2 className="text-lg font-bold text-white tracking-tight">Pick Your WAFL Club</h2>
          </div>
          <p className="text-[10px] text-gray-500 pl-8">{WAFL_CLUBS.length} teams · optional</p>
          <div className="mt-2 flex items-center gap-1.5 pl-8">
            <div className="h-1 w-16 rounded-full bg-primary" />
            <div className="h-1 w-16 rounded-full bg-primary" />
          </div>
        </div>
      </div>

      {/* AFL pick summary */}
      {aflClub && (
        <div className="flex items-center gap-2 mb-4 glass-card rounded-xl px-3 py-2 border border-white/8">
          <ClubLogo club={aflClub} size={24} />
          <p className="text-[10px] text-gray-400">AFL: <span className="text-white font-semibold">{aflClub.name}</span></p>
          <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-green-500/15 text-green-400 border border-green-500/25">
            ✓ set
          </span>
        </div>
      )}

      {/* Club grid */}
      <div className="grid grid-cols-3 gap-2.5 flex-1 content-start mb-5">
        {WAFL_CLUBS.map((club) => {
          const isSelected = selected === club.id
          return (
            <button
              key={club.id}
              onClick={() => { haptic.light(); setSelected(isSelected ? null : club.id) }}
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

      {/* Buttons */}
      <div className="sticky bottom-6 space-y-2">
        {selected && selectedClub && (
          <div className="flex items-center justify-center space-x-2 mb-1">
            <ClubLogo club={selectedClub} size={24} />
            <p className="text-xs text-gray-400">
              Also following <span className="font-bold text-white">{selectedClub.name}</span>
            </p>
          </div>
        )}
        <button
          onClick={handleConfirm}
          disabled={!selected || confirming}
          className="w-full py-4 rounded-xl font-bold text-base transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-primary text-background-dark hover:bg-primary/90 shadow-[0_0_20px_rgba(212,175,55,0.4)] uppercase tracking-wide flex items-center justify-center active:scale-[0.98]"
        >
          {confirming ? (
            <><span className="material-symbols-outlined text-[20px] mr-2 animate-spin">progress_activity</span>Saving...</>
          ) : (
            <><span className="material-symbols-outlined text-[20px] mr-2">how_to_reg</span>{selected ? 'Confirm & Enter Hub' : 'Select a WAFL Club'}</>
          )}
        </button>
        <button
          onClick={handleSkip}
          disabled={confirming}
          className="w-full py-3 rounded-xl text-sm font-semibold text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition active:scale-[0.98] disabled:opacity-30"
        >
          Skip — I don&apos;t follow WAFL
        </button>
      </div>
    </main>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function TeamSelectScreen({ onSelect }: Props) {
  const [aflTeamId, setAflTeamId] = useState<string | null>(null)

  if (!aflTeamId) {
    return (
      <AflPicker
        onNext={setAflTeamId}
        onSelectPartner={() => onSelect(PARTNER_CLUB.id, null)}
      />
    )
  }

  return (
    <WaflPicker
      aflTeamId={aflTeamId}
      onDone={(waflTeamId) => onSelect(aflTeamId, waflTeamId)}
      onBack={() => setAflTeamId(null)}
    />
  )
}

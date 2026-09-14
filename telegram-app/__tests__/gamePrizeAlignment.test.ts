import { describe, it, expect } from 'vitest'
import { PRIZE_TABLES } from '@/lib/gamePool'
import { GAME_PRIZE_DEFINITIONS } from '@/lib/rewardAssets'
import { PRIZES } from '@/app/game/page'
import { SLOT_PRIZES } from '@/components/SlotMachine'
import { SCRATCH_PRIZES } from '@/components/ScratchCard'

// The server rolls a prize index into PRIZE_TABLES[source] and sends it back as
// `prizeIndex`; each client display array must be in the exact same order or the
// client renders the wrong prize for the index it's given.
describe('client prize display arrays match server PRIZE_TABLES order', () => {
  it('uses the shared definitions as the server prize tables', () => {
    expect(PRIZE_TABLES).toBe(GAME_PRIZE_DEFINITIONS)
  })

  it('lucky_draw: PRIZES labels match PRIZE_TABLES.lucky_draw', () => {
    expect(PRIZES.map((p) => p.label)).toEqual(PRIZE_TABLES.lucky_draw.map((p) => p.label))
  })
  it('slot_machine: SLOT_PRIZES labels match PRIZE_TABLES.slot_machine', () => {
    expect(SLOT_PRIZES.map((p) => p.label)).toEqual(PRIZE_TABLES.slot_machine.map((p) => p.label))
  })
  it('scratch_card: SCRATCH_PRIZES labels match PRIZE_TABLES.scratch_card', () => {
    expect(SCRATCH_PRIZES.map((p) => p.label)).toEqual(PRIZE_TABLES.scratch_card.map((p) => p.label))
  })
})

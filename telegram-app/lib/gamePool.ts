export type GameSource = 'lucky_draw' | 'slot_machine' | 'scratch_card'

export interface GamePrize {
  label: string          // exact string stored in lucky_draw_wins.prize, e.g. "100 wXLM"
  amount: number | null  // asset amount for sendable prizes, null for non-asset outcomes
  weight: number
}

export const PRIZE_TABLES: Record<GameSource, GamePrize[]> = {
  lucky_draw: [
    { label: '100 wXLM', amount: 100, weight: 15 },
    { label: '50 wXLM', amount: 50, weight: 20 },
    { label: '20 wXLM', amount: 20, weight: 30 },
    { label: '5000 wNSAFL', amount: 5000, weight: 10 },
    { label: '2500 wNSAFL', amount: 2500, weight: 25 },
    { label: '1000 wNSAFL', amount: 1000, weight: 50 },
    { label: '50 wXRP', amount: 50, weight: 50 },
    { label: '100 wUSDC', amount: 100, weight: 50 },
    { label: '+2 Spins', amount: null, weight: 50 },
    { label: 'Free Spin', amount: null, weight: 250 },
    { label: 'Better Luck', amount: null, weight: 450 },
  ],
  slot_machine: [
    { label: '100 wXLM', amount: 100, weight: 10 },
    { label: '5000 wNSAFL', amount: 5000, weight: 15 },
    { label: '2500 wNSAFL', amount: 2500, weight: 25 },
    { label: '1000 wNSAFL', amount: 1000, weight: 50 },
    { label: '50 wXRP', amount: 50, weight: 50 },
    { label: '100 wUSDC', amount: 100, weight: 50 },
    { label: '+2 Spins', amount: null, weight: 50 },
    { label: 'Free Spin', amount: null, weight: 250 },
    { label: 'Better Luck', amount: null, weight: 450 },
  ],
  scratch_card: [
    { label: '100 wXLM', amount: 100, weight: 8 },
    { label: '5000 wNSAFL', amount: 5000, weight: 12 },
    { label: '2500 wNSAFL', amount: 2500, weight: 20 },
    { label: '1000 wNSAFL', amount: 1000, weight: 40 },
    { label: '50 wXRP', amount: 50, weight: 40 },
    { label: '100 wUSDC', amount: 100, weight: 40 },
    { label: '+2 Cards', amount: null, weight: 60 },
    { label: 'Better Luck', amount: null, weight: 780 },
  ],
}

export function rollPrize(source: GameSource): { prize: GamePrize; index: number } {
  const table = PRIZE_TABLES[source]
  const total = table.reduce((s, p) => s + p.weight, 0)
  let r = Math.random() * total
  for (let i = 0; i < table.length; i++) {
    r -= table[i].weight
    if (r <= 0) return { prize: table[i], index: i }
  }
  return { prize: table[table.length - 1], index: table.length - 1 }
}

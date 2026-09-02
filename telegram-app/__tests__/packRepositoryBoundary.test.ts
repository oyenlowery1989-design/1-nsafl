import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const CORE_DIRS = ['app', 'components', 'hooks', 'lib']
const DOMAIN_TABLES = [
  'wallets', 'wallet_balances', 'purchases', 'trustline_submissions',
  'team_change_requests', 'game_sessions', 'game_aggregate', 'game_leaderboard', 'lucky_draw_wins',
  'tier_reward_claims', 'donations', 'funding_config', 'quiz_sessions', 'quiz_questions',
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.[tj]sx?$/.test(entry.name) ? [path] : []
  })
}

describe('pack repository boundary', () => {
  it('keeps domain-table queries and private database imports out of core', () => {
    const violations = CORE_DIRS.flatMap((dir) => sourceFiles(join(process.cwd(), dir)))
      .filter((file) => {
        const source = readFileSync(file, 'utf8')
        return /packs\/[^'";]+\/repository\/(database|private)/.test(source)
          || DOMAIN_TABLES.some((table) => new RegExp(`\\.from\\(['\"]${table}['\"]\\)`).test(source))
      })

    expect(violations).toEqual([])
  })
})

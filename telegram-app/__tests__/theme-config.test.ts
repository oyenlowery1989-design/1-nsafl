import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

it('maps semantic theme colors to brand CSS variables', () => {
  const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')

  expect(css).toContain('--color-primary: var(--brand-primary)')
  expect(css).toContain('--color-background-dark: var(--brand-background)')
})

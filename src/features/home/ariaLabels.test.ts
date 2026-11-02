/**
 * Screen-reader names on Home, You and onboarding go through `t()`: an `aria-label="…"` written in
 * English stays English for a Hindi or Tamil TalkBack user.
 */
import { describe, expect, it } from 'vitest'

const sources = import.meta.glob<string>(['../home/*.tsx', '../you/*.tsx', '../onboarding/*.tsx', '!../**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

describe('accessible names', () => {
  it('are read from the catalog, never written in English', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10)
    const literals = Object.entries(sources).flatMap(([path, code]) =>
      [...code.matchAll(/aria-label="([^"]*[A-Za-z]{2,}[^"]*)"/g)].map((match) => `${path}: ${match[1] ?? ''}`),
    )
    expect(literals).toEqual([])
  })
})

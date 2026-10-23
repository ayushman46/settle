import { describe, expect, it } from 'vitest'
import { parseMessage } from '../../i18n'
import { activity as en } from '../../i18n/en/activity'
import { activity as hi } from '../../i18n/hi/activity'

/** The placeholders a message uses (`{name}`, `{count, plural, …}`), sorted. */
function placeholders(message: string): string[] {
  return [...new Set([...message.matchAll(/\{\s*([A-Za-z_][\w]*)\s*[,}]/g)].map((m) => m[1] ?? ''))].sort()
}

describe('Activity copy', () => {
  it('has every English key in Hindi, with the same placeholders, and nothing extra', () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort())
    for (const [key, message] of Object.entries(en)) {
      expect(placeholders(hi[key as keyof typeof hi]), key).toEqual(placeholders(message))
    }
  })

  it('parses in both languages, with no empty messages', () => {
    for (const catalog of [en, hi]) {
      for (const [key, message] of Object.entries(catalog)) {
        expect(message.trim(), key).not.toBe('')
        expect(() => parseMessage(message), key).not.toThrow()
      }
    }
  })

  it('keys stay in the activity namespace', () => {
    for (const key of Object.keys(en)) expect(key.startsWith('activity.'), key).toBe(true)
  })
})

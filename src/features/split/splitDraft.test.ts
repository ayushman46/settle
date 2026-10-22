import { afterEach, describe, expect, it, vi } from 'vitest'
import { ME_ID } from '../../domain/types'
import { EMPTY_META } from '../../types'
import { clearSplitDraft, loadSplitDraft, saveSplitDraft, SPLIT_DRAFT_KEY } from './splitDraft'
import { blankForm, type SplitForm } from './splitForm'
import { DEFAULT_PLACEHOLDER, splitTemplate, titlePlaceholder } from './splitTemplates'

const URL = '/app/split/new?from=describe'
const NOW = 1_800_000_000_000

function form(patch: Partial<SplitForm> = {}): SplitForm {
  return { ...blankForm('INR', '2026-10-22'), title: 'Cab', total: 84_000, ...patch }
}

afterEach(() => {
  window.sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('split drafts', () => {
  it('comes back on the same screen after a reload', () => {
    saveSplitDraft({ url: URL, base: 'new', form: form(), prefilled: true, origin: 'describe' }, NOW)
    const draft = loadSplitDraft(URL, 'new', NOW + 5_000)
    expect(draft).toMatchObject({ url: URL, base: 'new', prefilled: true, origin: 'describe', savedAt: NOW })
    expect(draft?.form).toMatchObject({ title: 'Cab', total: 84_000, participants: [{ friendId: ME_ID, input: null }] })
  })

  it('never returns to another screen, another expense version or after it went stale', () => {
    saveSplitDraft({ url: URL, base: 'e1@5', form: form(), prefilled: false, origin: 'edit' }, NOW)
    expect(loadSplitDraft('/app/split/new', 'e1@5', NOW)).toBeNull()
    expect(loadSplitDraft(URL, 'e1@6', NOW)).toBeNull()
    expect(loadSplitDraft(URL, 'e1@5', NOW + 13 * 60 * 60 * 1000)).toBeNull()
    expect(loadSplitDraft(URL, 'e1@5', NOW - 1)).toBeNull()
    expect(loadSplitDraft(URL, 'e1@5', NOW)).not.toBeNull()
  })

  it('leaves the bill snapshot out (it comes back from the expense)', () => {
    const bill = { meta: EMPTY_META, items: [], assignments: {}, warnings: [] }
    saveSplitDraft({ url: URL, base: 'new', form: form({ bill }), prefilled: false, origin: 'new' }, NOW)
    const stored = JSON.parse(window.sessionStorage.getItem(SPLIT_DRAFT_KEY) ?? '{}') as { form: Record<string, unknown> }
    expect('bill' in stored.form).toBe(false)
  })

  it('ignores anything unreadable', () => {
    window.sessionStorage.setItem(SPLIT_DRAFT_KEY, '{not json')
    expect(loadSplitDraft(URL, 'new', NOW)).toBeNull()
    window.sessionStorage.setItem(SPLIT_DRAFT_KEY, JSON.stringify({ url: URL, base: 'new', form: { total: -5 }, prefilled: false, origin: 'new', savedAt: NOW }))
    expect(loadSplitDraft(URL, 'new', NOW)).toBeNull()
  })

  it('is forgotten when cleared', () => {
    saveSplitDraft({ url: URL, base: 'new', form: form(), prefilled: false, origin: 'new' }, NOW)
    clearSplitDraft()
    expect(loadSplitDraft(URL, 'new', NOW)).toBeNull()
  })

  it('keeps working when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(() => saveSplitDraft({ url: URL, base: 'new', form: form(), prefilled: false, origin: 'new' }, NOW)).not.toThrow()
    expect(loadSplitDraft(URL, 'new', NOW)).toBeNull()
  })
})

describe('split templates', () => {
  it('starts rent with a title and the percentage tip', () => {
    expect(splitTemplate('rent')).toMatchObject({ category: 'rent', title: 'Rent', tip: 'percent' })
  })

  it('suggests a group for a trip', () => {
    expect(splitTemplate('travel')).toMatchObject({ category: 'travel', title: '', tip: 'group' })
    expect(splitTemplate('trip')).toMatchObject({ category: 'travel', tip: 'group' })
    expect(splitTemplate('Cab')).toMatchObject({ category: 'transport', tip: null })
  })

  it('knows nothing about other words', () => {
    expect(splitTemplate('yachts')).toBeNull()
    expect(splitTemplate('')).toBeNull()
    expect(splitTemplate('constructor')).toBeNull()
    expect(splitTemplate(null)).toBeNull()
  })

  it('gives every category its own examples', () => {
    expect(titlePlaceholder('subscription')).toMatch(/Netflix/)
    expect(titlePlaceholder('other')).toBe(DEFAULT_PLACEHOLDER)
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { resetDataForTests } from '../../data'
import { STORAGE_KEYS } from '../../data/stores'
import { cleanPresence, decline, presenceStore, setStay, undecline } from './store'

beforeEach(() => resetDataForTests())

describe('the presence store', () => {
  it('keeps what it can read and drops the rest, one record at a time', () => {
    expect(cleanPresence(null)).toEqual({ stays: {}, declined: {} })
    expect(cleanPresence([1, 2])).toEqual({ stays: {}, declined: {} })
    expect(
      cleanPresence({
        stays: {
          goa: {
            sam: { from: '2026-11-12', to: null },
            riya: { from: 'soon' },
            neha: { from: '2026-11-15', to: '2026-11-12' },
            ok: { to: '2026-11-14' },
            bad: 7,
          },
          empty: {},
          junk: 'x',
        },
        declined: { goa: ['e1|sam', 5, '', 'e2|riya'], flat: 'nope' },
      }),
    ).toEqual({
      stays: {
        goa: {
          sam: { from: '2026-11-12', to: null },
          ok: { from: null, to: '2026-11-14' },
        },
      },
      declined: { goa: ['e1|sam', 'e2|riya'] },
    })
  })

  it('reads junk from storage without losing the good parts', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.presence,
      JSON.stringify({
        v: 1,
        data: {
          stays: { goa: { sam: { from: '2026-11-12', to: 3 } } },
          declined: 'x',
        },
      }),
    )
    presenceStore.reload()
    expect(presenceStore.get()).toEqual({
      stays: { goa: { sam: { from: '2026-11-12', to: null } } },
      declined: {},
    })
  })

  it('sets, clears and refuses impossible stays', () => {
    setStay('goa', 'sam', { from: '2026-11-12', to: null })
    expect(presenceStore.get().stays).toEqual({
      goa: { sam: { from: '2026-11-12', to: null } },
    })
    setStay('goa', 'sam', { from: '2026-11-15', to: '2026-11-12' })
    expect(presenceStore.get().stays).toEqual({})
    setStay('goa', 'sam', { from: '2026-11-12', to: '2026-11-14' })
    setStay('goa', 'sam', { from: null, to: null })
    expect(presenceStore.get().stays).toEqual({})
  })

  it('remembers what was left alone, once each, capped, and forgets on undo', () => {
    decline('goa', ['a|sam', 'b|sam'])
    decline('goa', ['a|sam'])
    expect(presenceStore.get().declined.goa).toEqual(['a|sam', 'b|sam'])
    undecline('goa', ['a|sam', 'b|sam'])
    expect(presenceStore.get().declined).toEqual({})
    decline(
      'goa',
      Array.from({ length: 400 }, (_, i) => `e${i}|sam`),
    )
    expect(presenceStore.get().declined.goa).toHaveLength(300)
    expect(presenceStore.get().declined.goa!.at(-1)).toBe('e399|sam')
  })
})

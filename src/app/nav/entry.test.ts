import { describe, expect, it } from 'vitest'
import {
  isWellFormed,
  onSameScreen,
  pageDepth,
  parseState,
  readEntry,
  resolveDestination,
  sameEntry,
  screenDepth,
  stepDepth,
  toFlowEntry,
  toState,
  urlOf,
  type NavEntry,
} from './entry'

const entry = (patch: Partial<NavEntry> = {}): NavEntry => ({ depth: 0, sheet: 0, bill: null, url: '/app', ...patch })

describe('parseState', () => {
  it('reads every kind of entry the app writes', () => {
    expect(parseState({ settle: 1, depth: 3 }, '/app/groups/g1')).toEqual(entry({ depth: 3, url: '/app/groups/g1' }))
    expect(parseState({ settle: 1, depth: 4, sheet: 1 }, '/app')).toEqual(entry({ depth: 4, sheet: 1 }))
    expect(parseState({ settle: 1, depth: 2, bill: 'review' }, '/app/bill')).toEqual(
      entry({ depth: 2, bill: 'review', url: '/app/bill' }),
    )
  })

  it('round-trips through toState', () => {
    const samples = [entry({ depth: 5 }), entry({ depth: 6, sheet: 2 }), entry({ depth: 3, bill: 'paid', sheet: 1 })]
    for (const sample of samples) expect(parseState(toState(sample), sample.url)).toEqual(sample)
    expect(toState(entry({ depth: 1 }))).toEqual({ settle: 1, depth: 1 })
  })

  it('reads the v2 format, whose flow always started at depth 0', () => {
    expect(parseState({ billsplit: 'paid', depth: 2 }, '/')).toEqual(entry({ depth: 2, bill: 'paid', url: '/' }))
    expect(parseState({ billsplit: 'paid', depth: 4, sheet: true }, '/')).toEqual(
      entry({ depth: 4, sheet: 2, bill: 'paid', url: '/' }),
    )
  })

  it('is lenient about numbers and strict about ownership', () => {
    expect(parseState({ settle: 1, depth: -2, sheet: 1.5, bill: 'nope' }, '/x')).toEqual(entry({ url: '/x' }))
    expect(parseState({ settle: 2, depth: 1 }, '/')).toBeNull()
    expect(parseState({ depth: 1 }, '/')).toBeNull()
    expect(parseState({ billsplit: 'nope', depth: 1 }, '/')).toBeNull()
    expect(parseState(null, '/')).toBeNull()
    expect(parseState('scan', '/')).toBeNull()
    expect(parseState(undefined, '/')).toBeNull()
  })
})

describe('isWellFormed', () => {
  it('accepts screens, sheets above a screen and flow steps above the flow start', () => {
    expect(isWellFormed(entry())).toBe(true)
    expect(isWellFormed(entry({ depth: 2, sheet: 2 }))).toBe(true)
    expect(isWellFormed(entry({ depth: 4, bill: 'assign' }))).toBe(true)
    expect(isWellFormed(entry({ depth: 7, bill: 'assign', sheet: 2 }))).toBe(true)
  })

  it('rejects entries whose numbers cannot be right', () => {
    expect(isWellFormed(entry({ depth: 1, sheet: 2 }))).toBe(false)
    expect(isWellFormed(entry({ depth: 1, bill: 'assign' }))).toBe(false)
    expect(isWellFormed(entry({ depth: 4, bill: 'assign', sheet: 1 }))).toBe(false)
  })
})

describe('depth helpers', () => {
  it('finds the screen under a sheet and the page under a flow step', () => {
    expect(screenDepth(entry({ depth: 6, sheet: 2 }))).toBe(4)
    expect(pageDepth(entry({ depth: 6, sheet: 2 }))).toBe(4)
    // review is the flow's second step: the flow started one entry below it.
    expect(pageDepth(entry({ depth: 4, bill: 'review', sheet: 1 }))).toBe(2)
    expect(stepDepth('scan')).toBe(0)
    expect(stepDepth('result')).toBe(5)
  })

  it('builds entries on the same screen', () => {
    const sheet = entry({ depth: 5, sheet: 2, bill: 'paid', url: '/app/bill' })
    expect(onSameScreen(sheet, 3)).toEqual(entry({ depth: 3, bill: 'paid', url: '/app/bill' }))
    expect(onSameScreen(sheet, 4)).toEqual(entry({ depth: 4, sheet: 1, bill: 'paid', url: '/app/bill' }))
  })

  it('compares entries by position and page', () => {
    expect(sameEntry(entry({ depth: 1 }), entry({ depth: 1 }))).toBe(true)
    expect(sameEntry(entry({ depth: 1 }), entry({ depth: 1, url: '/app/you' }))).toBe(false)
    expect(sameEntry(entry({ depth: 1 }), entry({ depth: 1, bill: 'scan' }))).toBe(false)
    expect(sameEntry(entry({ depth: 2, sheet: 1 }), entry({ depth: 2 }))).toBe(false)
  })
})

describe('bill-flow view', () => {
  it('readEntry parses flow entries only', () => {
    expect(readEntry({ settle: 1, depth: 3, bill: 'paid', sheet: 1 })).toEqual({ step: 'paid', depth: 3, sheet: true })
    expect(readEntry({ settle: 1, depth: 3 })).toBeNull()
    expect(toFlowEntry(entry({ depth: 2, bill: 'review' }))).toEqual({ step: 'review', depth: 2, sheet: false })
    expect(toFlowEntry(entry())).toBeNull()
  })
})

describe('URLs', () => {
  const here = { href: 'https://settle.example/app/groups?x=1#top', origin: 'https://settle.example' }

  it('keys pages by path, query and hash', () => {
    expect(urlOf({ pathname: '/pay', search: '', hash: '#abc' })).toBe('/pay#abc')
  })

  it('resolves app URLs (absolute, root-relative and relative)', () => {
    expect(resolveDestination('/app/you', here)).toEqual({ internal: true, url: '/app/you' })
    expect(resolveDestination('g1?tab=balances', here)).toEqual({ internal: true, url: '/app/g1?tab=balances' })
    expect(resolveDestination('https://settle.example/pay#p', here)).toEqual({ internal: true, url: '/pay#p' })
    expect(resolveDestination('#faq', here)).toEqual({ internal: true, url: '/app/groups?x=1#faq' })
  })

  it('tells other origins and schemes apart', () => {
    expect(resolveDestination('https://wa.me/?text=hi', here)).toEqual({ internal: false, href: 'https://wa.me/?text=hi' })
    expect(resolveDestination('upi://pay?pa=a@b', here)).toEqual({ internal: false, href: 'upi://pay?pa=a@b' })
    expect(resolveDestination('http://[', here)).toBeNull()
  })
})

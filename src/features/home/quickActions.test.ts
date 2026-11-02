/** The quick-action registry: order, flags, back-filling templates, and where each tile goes. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const flags = vi.hoisted(() => ({ lend: false, pools: false, sms: false, delivery: false }))
vi.mock('../lend/enabled', () => ({
  get LEND_ENABLED() {
    return flags.lend
  },
}))
vi.mock('../pools/enabled', () => ({
  get POOLS_ENABLED() {
    return flags.pools
  },
}))
vi.mock('../sharein/enabled', () => ({
  get SMS_ENABLED() {
    return flags.sms
  },
}))
vi.mock('../bill/delivery.enabled', () => ({
  get DELIVERY_ENABLED() {
    return flags.delivery
  },
}))

import { resetNavForTests } from '../../app/router'
import { CATEGORY_ICONS } from '../../components'
import { poolsStore, resetDataForTests } from '../../data'
import { resetBillLaunchForTests, takeBillStart, takeScanHint } from '../bill/launch'
import { GRID_SIZE, homeGridActions, overflowActions, quickActionDefs, templateActionDefs } from './quickActions'

const ids = (stuckCard = false) => homeGridActions(() => {}, { stuckCard }).map((a) => a.id)

beforeEach(() => {
  Object.assign(flags, { lend: false, pools: false, sms: false, delivery: false })
  resetDataForTests()
  resetNavForTests()
  resetBillLaunchForTests()
  window.history.replaceState(null, '', '/app')
})

afterEach(() => {
  resetNavForTests()
})

describe('homeGridActions', () => {
  it('with every feature off: scan, split, stuck money, bank charges, group, two templates, More', () => {
    expect(ids()).toEqual(['scan', 'split', 'stuck', 'fees', 'group', 'template:rent', 'template:travel', 'more'])
    expect(homeGridActions(() => {}).map((a) => a.label)).toEqual(['Scan bill', 'Split amount', 'Stuck money', 'Bank charges', 'New group', 'Rent', 'Trip', 'More'])
    expect(overflowActions()).toEqual([])
  })

  it('with every feature on and nothing stuck: Stuck money and Bank charges in the places of Group collection and From SMS, which move to the More sheet', () => {
    Object.assign(flags, { lend: true, pools: true, sms: true, delivery: true })
    expect(ids()).toEqual(['scan', 'split', 'lend', 'stuck', 'fees', 'food', 'group', 'more'])
    expect(overflowActions().map((a) => a.id)).toEqual(['collect', 'sms'])
  })

  it('with every feature on and Home showing the Stuck card: Group collection back in its place, From SMS in More', () => {
    Object.assign(flags, { lend: true, pools: true, sms: true, delivery: true })
    expect(ids(true)).toEqual(['scan', 'split', 'lend', 'collect', 'fees', 'food', 'group', 'more'])
    expect(overflowActions({ stuckCard: true }).map((a) => a.id)).toEqual(['sms'])
    expect(homeGridActions(() => {}, { stuckCard: true }).map((a) => a.label)).toEqual([
      'Scan bill',
      'Split amount',
      'Lend / borrow',
      'Group collection',
      'Bank charges',
      'Food order',
      'New group',
      'More',
    ])
  })

  it('back-fills with templates when only some are on', () => {
    Object.assign(flags, { lend: true, pools: true })
    expect(ids()).toEqual(['scan', 'split', 'lend', 'collect', 'stuck', 'fees', 'group', 'more'])
    Object.assign(flags, { lend: false, pools: false, delivery: true })
    expect(ids()).toEqual(['scan', 'split', 'stuck', 'fees', 'food', 'group', 'template:rent', 'more'])
    expect(ids(true)).toEqual(['scan', 'split', 'fees', 'food', 'group', 'template:rent', 'template:travel', 'more'])
  })

  it('offers Stuck money on the grid until Home has its card, and always keeps New group', () => {
    for (const mask of [0, 1, 3, 5, 7, 15]) {
      Object.assign(flags, { lend: !!(mask & 1), pools: !!(mask & 2), sms: !!(mask & 4), delivery: !!(mask & 8) })
      expect(ids()).toContain('stuck')
      expect(ids(true)).not.toContain('stuck')
      // The card leads there instead (and the More sheet has its own Stuck money tile).
      expect(overflowActions({ stuckCard: true }).map((a) => a.id)).not.toContain('stuck')
      expect(ids()).toContain('group')
      expect(ids(true)).toContain('group')
    }
  })

  it('is always two rows of four', () => {
    for (const mask of [0, 1, 3, 5, 7, 15]) {
      Object.assign(flags, { lend: !!(mask & 1), pools: !!(mask & 2), sms: !!(mask & 4), delivery: !!(mask & 8) })
      for (const stuckCard of [false, true]) {
        expect(ids(stuckCard)).toHaveLength(GRID_SIZE)
        expect(ids(stuckCard).at(-1)).toBe('more')
      }
    }
  })

  it('More opens the sheet; the sheet holds all five templates', () => {
    const open = vi.fn()
    homeGridActions(open).at(-1)?.run()
    expect(open).toHaveBeenCalledOnce()
    expect(templateActionDefs().map((a) => a.label)).toEqual(['Rent', 'Trip', 'Subscription', 'Utilities', 'Cab'])
  })

  it('gives Utilities its own icon, apart from Electricity’s bolt', () => {
    const utilities = templateActionDefs().find((a) => a.id === 'template:utilities')
    expect(utilities?.icon).toBeDefined()
    expect(utilities?.icon).not.toBe(CATEGORY_ICONS.utilities)
  })
})

describe('where the tiles go', () => {
  const run = (id: string) => quickActionDefs().find((a) => a.id === id)?.run()

  it.each([
    ['split', '/app/split/new'],
    ['lend', '/app/lend'],
    ['sms', '/app/share'],
    ['fees', '/app/fees'],
    ['group', '/app/groups?new=1'],
    ['stuck', '/app/stuck'],
  ])('%s → %s', (id, path) => {
    run(id)
    expect(window.location.pathname + window.location.search).toBe(path)
  })

  it('collect goes to the list when there are collections, else to a new one', () => {
    run('collect')
    expect(window.location.pathname).toBe('/app/pools/new')
    poolsStore.set([
      {
        id: 'p1',
        title: 'Farewell',
        occasion: 'farewell',
        emoji: '👋',
        currency: 'INR',
        mode: 'target',
        perPerson: null,
        target: null,
        memberIds: [],
        expectedCount: null,
        deadline: null,
        note: null,
        showAmounts: false,
        contributions: [],
        secret: 'AAAAAAAAAAAAAAAAAAAAAA',
        createdAt: 1,
        updatedAt: 1,
        closedAt: null,
      },
    ])
    run('collect')
    expect(window.location.pathname).toBe('/app/pools')
  })

  it('food opens the bill flow with the delivery hint; scan opens it plainly', () => {
    run('food')
    expect(window.location.pathname).toBe('/app/bill')
    expect(takeBillStart()).toEqual({ kind: 'delivery' })
    expect(takeScanHint()).toBe('delivery')
    resetBillLaunchForTests()
    run('scan')
    expect(takeBillStart()).toBeNull()
    expect(takeScanHint()).toBeNull()
  })
})

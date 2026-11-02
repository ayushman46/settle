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

const ids = (open = () => {}) => homeGridActions(open).map((a) => a.id)

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
  it('with every feature off: scan, split, stuck money, group, three templates, More', () => {
    expect(ids()).toEqual(['scan', 'split', 'stuck', 'group', 'template:rent', 'template:travel', 'template:subscription', 'more'])
    expect(homeGridActions(() => {}).map((a) => a.label)).toEqual(['Scan bill', 'Split amount', 'Stuck money', 'New group', 'Rent', 'Trip', 'Subscription', 'More'])
    expect(overflowActions()).toEqual([])
  })

  it('with every feature on: seven actions and More, no templates; New group moves to the More sheet', () => {
    Object.assign(flags, { lend: true, pools: true, sms: true, delivery: true })
    expect(ids()).toEqual(['scan', 'split', 'lend', 'collect', 'sms', 'food', 'stuck', 'more'])
    expect(overflowActions().map((a) => a.id)).toEqual(['group'])
  })

  it('back-fills with templates when only some are on', () => {
    Object.assign(flags, { lend: true, pools: true })
    expect(ids()).toEqual(['scan', 'split', 'lend', 'collect', 'stuck', 'group', 'template:rent', 'more'])
    Object.assign(flags, { lend: false, pools: false, delivery: true })
    expect(ids()).toEqual(['scan', 'split', 'food', 'stuck', 'group', 'template:rent', 'template:travel', 'more'])
  })

  it('always offers Stuck money on the grid, even before anything is stuck', () => {
    for (const mask of [0, 15]) {
      Object.assign(flags, { lend: !!(mask & 1), pools: !!(mask & 2), sms: !!(mask & 4), delivery: !!(mask & 8) })
      expect(ids()).toContain('stuck')
    }
  })

  it('is always two rows of four', () => {
    for (const mask of [0, 1, 3, 5, 7, 15]) {
      Object.assign(flags, { lend: !!(mask & 1), pools: !!(mask & 2), sms: !!(mask & 4), delivery: !!(mask & 8) })
      expect(ids()).toHaveLength(GRID_SIZE)
      expect(ids().at(-1)).toBe('more')
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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ME_ID, type ClaimPick, type Expense } from '../domain/types'
import { claimShare } from '../engine/claims'
import { claimLinkFromRound, signReply, type ClaimReplyPayload } from '../share/claim'
import {
  addClaimReply,
  applyClaimRound,
  checkClaimReply,
  createClaimRound,
  deleteClaimRound,
  onExpenseDeleted,
  roundBoard,
  roundHasNews,
  setClaimDecision,
  setOwnPicks,
} from './claims'
import { DataError } from './errors'
import { saveExpense } from './expenses'
import { addFriend, findFriendByName } from './friends'
import { claimsStore, expensesStore, friendsStore, profileStore } from './stores'
import { resetDataForTests } from './testing'
import { draft, everyone } from './testKit'

const ITEMS = [
  { id: 'chicken', name: 'Butter Chicken', amount: 45000, quantity: 1 },
  { id: 'paneer', name: 'Paneer Tikka', amount: 38000, quantity: 1 },
  { id: 'naan', name: 'Butter Naan', amount: 24000, quantity: 4 },
  { id: 'beer', name: 'Kingfisher Beer', amount: 90000, quantity: 3 },
  { id: 'soda', name: 'Fresh Lime Soda', amount: 12000, quantity: 1 },
  { id: 'jamun', name: 'Gulab Jamun', amount: 15000, quantity: 1 },
]

let riya: string
let sam: string
let kabir: string

function bill(extra: Partial<Expense['bill'] & object> = {}): Expense {
  return saveExpense(
    draft({
      kind: 'bill',
      title: 'Toit Brewpub',
      total: 276600,
      mode: 'items',
      participants: everyone(ME_ID, riya, sam, kabir),
      bill: {
        meta: { merchant: 'Toit Brewpub', date: null, subtotal: null, tax: null, serviceCharge: null, discount: null, tip: null, total: 276600 },
        items: ITEMS.map((i) => ({ ...i })),
        assignments: {},
        warnings: [],
        ...extra,
      },
    }),
  )
}

const pk = (item: number, num: number, den: number): [number, number, number] => [item, num, den]
const PICKS = {
  riya: [pk(1, 1, 2), pk(2, 1, 4), pk(4, 1, 1), pk(5, 1, 2)],
  sam: [pk(0, 1, 2), pk(2, 2, 4), pk(3, 1, 3)],
  kabir: [pk(1, 1, 2), pk(2, 1, 4), pk(3, 2, 3)],
}

function reply(roundId: string, w: number | null, n: string, x: Array<[number, number, number]>, extra: Partial<ClaimReplyPayload> = {}): ClaimReplyPayload {
  const round = claimsStore.get().find((r) => r.id === roundId)!
  const expense = expensesStore.get().find((e) => e.id === round.expenseId)!
  const link = claimLinkFromRound(round, expense, Object.fromEntries(friendsStore.get().map((f) => [f.id, f])), profileStore.get())
  const items = link.it.map((it) => ({ name: it.n, amount: it.a, quantity: it.q ?? 1 }))
  const picks: ClaimPick[] = x.map(([item, num, den]) => ({ item, num, den }))
  const share = claimShare({ items, total: link.tot, picks, personIndex: w }).share
  const { m: _m, ...body } = { v: 1 as const, k: 'reply' as const, r: round.id, h: link.h, w, n, x, pd: share, at: 1792748400, m: '', ...extra }
  return signReply(round.secret, body)
}

beforeEach(() => {
  resetDataForTests()
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
  kabir = addFriend({ name: 'Kabir' }).id
})

afterEach(() => {
  resetDataForTests()
})

describe('createClaimRound', () => {
  it('starts a round for an itemized bill', () => {
    const e = bill({ assignments: { jamun: { [riya]: 1 } } })
    const round = createClaimRound(e.id)
    expect(round.id).toMatch(/^[A-Za-z0-9_-]{10}$/)
    expect(round.secret).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(round.itemIds).toEqual(ITEMS.map((i) => i.id))
    expect(round.peopleIds).toEqual([ME_ID, riya, sam, kabir])
    expect(round.fixedItemIds).toEqual(['jamun'])
    expect(round.itemsHash).toMatch(/^[0-9a-f]{12}$/)
    expect(claimsStore.get()).toHaveLength(1)
  })

  it('uses the spec’s hash for the spec’s bill', () => {
    expect(createClaimRound(bill().id).itemsHash).toBe('e2738144e47b')
  })

  it('refuses a plain split, a missing expense and more than 60 items', () => {
    const plain = saveExpense(draft({ with: [riya] }))
    expect(() => createClaimRound(plain.id)).toThrow(DataError)
    expect(() => createClaimRound('nope')).toThrow(DataError)
    const many = Array.from({ length: 61 }, (_, i) => ({ id: `x${i}`, name: `Item ${i}`, amount: 100, quantity: 1 }))
    const big = saveExpense(
      draft({ kind: 'bill', mode: 'items', total: 6100, bill: { meta: { merchant: null, date: null, subtotal: null, tax: null, serviceCharge: null, discount: null, tip: null, total: null }, items: many, assignments: {}, warnings: [] } }),
    )
    try {
      createClaimRound(big.id)
      expect.unreachable()
    } catch (error) {
      expect((error as DataError).code).toBe('invalid')
    }
  })
})

describe('addClaimReply', () => {
  it('adds a reply, then calls the same one a duplicate', () => {
    const round = createClaimRound(bill().id)
    const r = reply(round.id, 1, 'Riya', PICKS.riya)
    const added = addClaimReply(r)
    expect(added.kind).toBe('added')
    if (added.kind !== 'added') return
    expect(added.reply).toMatchObject({ friendId: riya, personIndex: 1, name: 'Riya', paid: 54950, nothing: false, state: 'active', sentAt: 1792748400000 })
    expect(added.reply.picks).toHaveLength(4)
    expect(addClaimReply(r)).toEqual({ kind: 'duplicate' })
  })

  it('asks before replacing a newer reply, and ignores an older one', () => {
    const round = createClaimRound(bill().id)
    addClaimReply(reply(round.id, 1, 'Riya', PICKS.riya))
    const newer = reply(round.id, 1, 'Riya', [pk(0, 1, 1)], { at: 1792748500 })
    const older = reply(round.id, 1, 'Riya', [pk(4, 1, 1)], { at: 1792748300 })
    expect(addClaimReply(older)).toEqual({ kind: 'older' })
    const ask = addClaimReply(newer)
    expect(ask.kind).toBe('needs_confirm')
    const replaced = addClaimReply(newer, { replace: true })
    expect(replaced.kind).toBe('added')
    const stored = claimsStore.get()[0]!.replies
    expect(stored.map((r) => r.state)).toEqual(['replaced', 'active'])
  })

  it('knows unknown rounds, tampered replies and deleted bills', () => {
    const e = bill()
    const round = createClaimRound(e.id)
    const r = reply(round.id, 1, 'Riya', PICKS.riya)
    expect(addClaimReply({ ...r, r: 'AAAAAAAAAA' })).toEqual({ kind: 'unknown_round' })
    expect(addClaimReply({ ...r, pd: 1 })).toEqual({ kind: 'bad_signature' })
    expect(addClaimReply({ ...r, x: [pk(0, 1, 1)] })).toEqual({ kind: 'bad_signature' })
    expensesStore.set([])
    expect(addClaimReply(r)).toEqual({ kind: 'expense_gone' })
  })

  it('adds someone new by name, or matches an existing friend', () => {
    const round = createClaimRound(bill().id)
    const check = checkClaimReply(reply(round.id, null, 'Priya', [pk(0, 1, 2)]))
    expect(check.kind === 'new' && check.existing).toBeNull()
    const added = addClaimReply(reply(round.id, null, 'Priya', [pk(0, 1, 2)]))
    expect(added.kind).toBe('added')
    const priya = findFriendByName('Priya')
    expect(priya).not.toBeNull()
    if (added.kind === 'added') expect(added.reply.friendId).toBe(priya!.id)

    const match = checkClaimReply(reply(round.id, null, 'riya', [pk(4, 1, 1)]))
    expect(match.kind === 'new' && match.existing?.id).toBe(riya)
  })

  it('drops picks for items removed from the bill and says the bill changed', () => {
    const e = bill()
    const round = createClaimRound(e.id)
    const r = reply(round.id, 1, 'Riya', PICKS.riya)
    saveExpense({ ...e, total: 261600, bill: { ...e.bill!, items: e.bill!.items.filter((i) => i.id !== 'jamun') } })
    const check = checkClaimReply(r)
    expect(check.kind).toBe('new')
    if (check.kind !== 'new') return
    expect(check.changed).toBe(true)
    expect(check.dropped).toEqual([5])
    expect(check.reply.picks.map((p) => p.item)).toEqual([1, 2, 4])
  })
})

describe('decisions, own picks and applying', () => {
  function fullRound() {
    const e = bill()
    const round = createClaimRound(e.id)
    setOwnPicks(round.id, [
      { item: 0, num: 1, den: 2 },
      { item: 3, num: 1, den: 3 },
    ])
    addClaimReply(reply(round.id, 1, 'Riya', PICKS.riya))
    addClaimReply(reply(round.id, 2, 'Sam', PICKS.sam))
    addClaimReply(reply(round.id, 3, 'Kabir', PICKS.kabir))
    return { e, round: claimsStore.get()[0]! }
  }

  it('builds the board', () => {
    const { round } = fullRound()
    expect(roundBoard(round).map((r) => r.status)).toEqual(['complete', 'complete', 'complete', 'over', 'complete', 'partial'])
    expect(roundHasNews(round)).toBe(true)
  })

  it('writes the claims into the bill, with the spec’s numbers', () => {
    const { e, round } = fullRound()
    setClaimDecision(round.id, 'beer', { kind: 'as_claimed' })
    setClaimDecision(round.id, 'jamun', { kind: 'scale_up' })
    const result = applyClaimRound(round.id)
    expect(result.openItems).toBe(0)
    expect(result.expense.shares).toEqual({ [ME_ID]: 55567, [riya]: 64211, [sam]: 70385, [kabir]: 86437 })
    expect(result.expense.bill!.assignments.beer).toEqual({ [ME_ID]: 1, [sam]: 1, [kabir]: 2 })
    expect(result.gaps.map((g) => [g.friendId, g.due, g.settled])).toEqual([
      [riya, 9261, false],
      [sam, -9261, false],
      [kabir, -18523, false],
    ])
    // Nobody's payment covers the new share exactly: nobody is ticked off.
    expect(expensesStore.get().find((x) => x.id === e.id)!.paidBack).toEqual({})
    const after = claimsStore.get()[0]!
    expect(after.appliedAt).not.toBeNull()
    expect(roundHasNews(after)).toBe(false)
  })

  it('leaves an open item to everyone and ticks off people who paid their share', () => {
    const { round } = fullRound()
    setClaimDecision(round.id, 'beer', { kind: 'as_claimed' })
    const result = applyClaimRound(round.id)
    expect(result.openItems).toBe(1)
    expect(result.expense.shares).toEqual({ [ME_ID]: 60198, [riya]: 50319, [sam]: 75015, [kabir]: 91068 })
    expect(result.expense.bill!.assignments.jamun).toBeUndefined()
  })

  it('ticks off a friend whose payment covers the final share', () => {
    const e = bill()
    const round = createClaimRound(e.id)
    // Riya takes everything and pays for it all.
    const all = ITEMS.map((_, i) => pk(i, 1, 1))
    addClaimReply(reply(round.id, 1, 'Riya', all))
    const result = applyClaimRound(round.id)
    expect(result.gaps).toEqual([{ friendId: riya, paid: 276600, share: 276600, due: 0, settled: true }])
    expect(result.expense.paidBack[riya]).toBeTypeOf('number')
  })

  it('adds a new name to the bill', () => {
    const e = bill()
    const round = createClaimRound(e.id)
    addClaimReply(reply(round.id, null, 'Priya', [pk(4, 1, 1)]))
    const result = applyClaimRound(round.id)
    const priya = findFriendByName('Priya')!.id
    expect(result.expense.participants.map((p) => p.friendId)).toContain(priya)
    expect(result.expense.bill!.assignments.soda).toEqual({ [priya]: 1 })
    expect(Object.values(result.expense.shares).reduce((a, b) => a + b, 0)).toBe(276600)
  })

  it('validates decisions and own picks', () => {
    const round = createClaimRound(bill({ assignments: { soda: { [riya]: 1 } } }).id)
    expect(() => setClaimDecision(round.id, 'nope', { kind: 'scale_up' })).toThrow(DataError)
    setClaimDecision(round.id, 'beer', { kind: 'assign', shares: { [sam]: 2 } })
    expect(claimsStore.get()[0]!.decisions.beer).toEqual({ kind: 'assign', shares: { [sam]: 2 } })
    setClaimDecision(round.id, 'beer', null)
    expect(claimsStore.get()[0]!.decisions).toEqual({})
    // Soda was sorted before the link went out: the organiser's pick on it is dropped.
    const own = setOwnPicks(round.id, [{ item: 4, num: 1, den: 1 }, { item: 0, num: 1, den: 2 }])
    expect(own.ownPicks).toEqual([{ item: 0, num: 1, den: 2 }])
  })
})

describe('removing rounds', () => {
  it('drops a round, and every round of a deleted bill', () => {
    const e = bill()
    const a = createClaimRound(e.id)
    createClaimRound(e.id)
    deleteClaimRound(a.id)
    expect(claimsStore.get()).toHaveLength(1)
    onExpenseDeleted(e.id)
    expect(claimsStore.get()).toEqual([])
  })
})

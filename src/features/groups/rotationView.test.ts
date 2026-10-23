import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addFriend, createGroup, expensesStore, groupsStore, recordSettlement, resetDataForTests, saveExpense, setGroupArchived, updateGroup } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type Group } from '../../domain/types'
import { friendLabel } from '../../kit/friendName'
import {
  automaticRound,
  everyoneLabel,
  groupRound,
  nextRoundCardView,
  nextRoundPath,
  nextRoundPrefill,
  rotationPlanView,
  rotationState,
  roundBanner,
} from './rotationView'

let riya: string
let sam: string
let kabir: string
let gang: Group

const group = () => groupsStore.get().find((g) => g.id === gang.id) as Group
const names: Record<string, string> = {}
const nameOf = (id: string) => friendLabel(id, id === ME_ID ? null : { name: names[id] ?? '' })

/** Example A of spec 04: me +₹1,200, Riya +₹300, Sam −₹1,200, Kabir −₹300, three ₹2,400 rounds. */
function seedExampleA(): void {
  saveExpense(draft({ title: 'Dinner', total: 240000, groupId: gang.id, date: '2026-10-02', participants: everyone(ME_ID, riya, sam, kabir) }))
  saveExpense(draft({ title: 'Dinner', total: 240000, groupId: gang.id, date: '2026-10-09', payerId: riya, participants: everyone(ME_ID, riya, sam, kabir) }))
  saveExpense(
    draft({
      title: 'Dinner',
      total: 240000,
      groupId: gang.id,
      date: '2026-10-16',
      payerId: kabir,
      mode: 'exact',
      participants: [
        { friendId: riya, input: 90000 },
        { friendId: kabir, input: 150000 },
      ],
    }),
  )
}

beforeEach(() => {
  resetDataForTests()
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
  kabir = addFriend({ name: 'Kabir' }).id
  Object.assign(names, { [riya]: 'Riya', [sam]: 'Sam', [kabir]: 'Kabir' })
  gang = createGroup({ name: 'Friday gang', emoji: '🍕', kind: 'other', currency: 'INR', memberIds: [ME_ID, riya, sam, kabir] })
})

afterEach(() => resetDataForTests())

describe('words', () => {
  it('counts everyone in a round', () => {
    expect(everyoneLabel(2)).toBe('both of you')
    expect(everyoneLabel(4)).toBe('all 4 of you')
    expect(everyoneLabel(4, true)).toBe('all 4')
    expect(everyoneLabel(2, true)).toBe('both of you')
  })
})

describe('the usual round', () => {
  it('is the median of the group’s spending, unless one is saved', () => {
    seedExampleA()
    saveExpense(draft({ kind: 'loan', title: 'Cash', category: 'other', total: 990000, groupId: gang.id, participants: everyone(riya) }))
    expect(automaticRound(group(), expensesStore.get())).toBe(240000)
    updateGroup(gang.id, { roundSize: 150000 })
    expect(groupRound(group(), expensesStore.get())).toBe(150000)
    expect(automaticRound(group(), expensesStore.get())).toBe(240000)
  })
})

describe('nextRoundCardView', () => {
  it('names Sam for example A, with the usual round', () => {
    seedExampleA()
    expect(rotationState(group(), expensesStore.get()).balances).toEqual({ [ME_ID]: 120000, [riya]: 30000, [sam]: -120000, [kabir]: -30000 })
    const view = nextRoundCardView(group(), expensesStore.get(), nameOf)
    expect(view).toMatchObject({
      kind: 'next',
      title: "Next round's on Sam",
      body: "Sam's ₹1,200 behind. If Sam pays the next ₹1,600 for all 4 of you, Sam's square.",
      usualLine: 'A usual round here is ₹2,400 — that settles ₹300 of the ₹1,500 the group is out.',
    })
  })

  it('speaks to the owner when it’s their turn', () => {
    saveExpense(draft({ title: 'Movie', total: 100000, groupId: gang.id, payerId: riya, participants: everyone(ME_ID, riya) }))
    // A ₹1,000 round (the usual) would overshoot: the fallback says how far to go.
    const big = nextRoundCardView(group(), expensesStore.get(), nameOf)
    expect(big?.title).toBe("Next round's on you")
    expect(big?.kind === 'next' && big.body).toBe("You're ₹500 behind. Paying up to ₹666.67 for all 4 of you squares you up — a bigger round puts you ahead.")
    updateGroup(gang.id, { roundSize: 60000 })
    const view = nextRoundCardView(group(), expensesStore.get(), nameOf)
    expect(view?.title).toBe("Next round's on you")
    expect(view?.kind === 'next' && view.body).toBe("You're ₹500 behind. Pay the next ₹666.67 for all 4 and you're square.")
    expect(view?.kind === 'next' && view.usualLine).toBe('A usual round here is ₹600 — that settles ₹150 of the ₹500 the group is out.')
  })

  it('says "both of you" for a couple', () => {
    const us = createGroup({ name: 'Us', emoji: '💑', kind: 'couple', currency: 'INR', memberIds: [ME_ID, riya] })
    saveExpense(draft({ title: 'Groceries', total: 100000, groupId: us.id, payerId: riya, participants: everyone(ME_ID, riya) }))
    const couple = groupsStore.get().find((g) => g.id === us.id) as Group
    const view = nextRoundCardView(couple, expensesStore.get(), nameOf)
    expect(view?.kind === 'next' && view.body).toBe("You're ₹500 behind. Pay the next ₹1,000 for both of you and you're square.")
  })

  it('uses the fallback copy when the usual round is bigger than helps', () => {
    seedExampleA()
    updateGroup(gang.id, { roundSize: 900000 })
    const view = nextRoundCardView(group(), expensesStore.get(), nameOf)
    expect(view).toMatchObject({
      kind: 'next',
      title: "Next round's on Sam",
      body: "Sam's ₹1,200 behind. Paying up to ₹1,600 for all 4 of you squares Sam up — a bigger round puts Sam ahead.",
      usualLine: null,
    })
  })

  it('says to settle up when only someone who left is behind', () => {
    saveExpense(draft({ title: 'Cab', total: 30000, groupId: gang.id, participants: everyone(kabir) }))
    // Kabir still owes, so the app keeps him a member: take him out directly, as an old group could have it.
    groupsStore.update((gs) => gs.map((g) => (g.id === gang.id ? { ...g, memberIds: [ME_ID, riya, sam] } : g)))
    expect(nextRoundCardView(group(), expensesStore.get(), nameOf)).toEqual({
      kind: 'left',
      title: 'Settle up instead',
      body: 'Kabir left the group with ₹300 to settle — settle up instead.',
    })
  })

  it('is hidden when square, archived or one member', () => {
    expect(nextRoundCardView(group(), [], nameOf)).toBeNull()
    seedExampleA()
    recordSettlement(gang.id, { fromId: sam, toId: ME_ID, amount: 120000, date: '2026-10-20', method: 'upi' })
    recordSettlement(gang.id, { fromId: kabir, toId: riya, amount: 30000, date: '2026-10-20', method: 'cash' })
    expect(nextRoundCardView(group(), expensesStore.get(), nameOf)).toBeNull()
    saveExpense(draft({ title: 'Snacks', total: 40000, groupId: gang.id, participants: everyone(ME_ID, riya, sam, kabir) }))
    expect(nextRoundCardView(group(), expensesStore.get(), nameOf)).not.toBeNull()
    setGroupArchived(gang.id, true)
    expect(nextRoundCardView(group(), expensesStore.get(), nameOf)).toBeNull()
    const solo = createGroup({ name: 'Me', emoji: '👤', kind: 'other', currency: 'INR', memberIds: [ME_ID] })
    expect(nextRoundCardView(solo, expensesStore.get(), nameOf)).toBeNull()
  })
})

describe('the hand-off', () => {
  it('opens the next round paid by Sam, everyone in, with the banner', () => {
    expect(nextRoundPrefill(group(), sam, 160000, nameOf)).toEqual({
      groupId: gang.id,
      payerId: sam,
      mode: 'equal',
      currency: 'INR',
      participants: everyone(ME_ID, riya, sam, kabir),
      source: 'manual',
      banner: { icon: 'rotate', title: "Sam's round", body: 'Up to ₹1,600 squares Sam up. More than that and Sam is ahead.' },
    })
    expect(nextRoundPath(group())).toBe(`/app/split/new?from=rotation&group=${encodeURIComponent(gang.id)}`)
  })

  it('has an owner form, and keeps long names within the banner’s limits', () => {
    expect(roundBanner(ME_ID, 160000, 'INR', nameOf)).toEqual({ icon: 'rotate', title: 'Your round', body: "Up to ₹1,600 squares you up. More than that and you're ahead." })
    const long = roundBanner('x', 99_999_999_999, 'INR', () => 'W'.repeat(200))
    expect(long.title.length).toBeLessThanOrEqual(80)
    expect(long.body.length).toBeLessThanOrEqual(160)
  })
})

describe('rotationPlanView', () => {
  it('lists two rounds, then Riya pays Kabir ₹900', () => {
    seedExampleA()
    const view = rotationPlanView(group(), expensesStore.get(), 240000, nameOf)
    if (view.kind !== 'plan') throw new Error('expected a plan')
    expect(view.rows.map((r) => [r.title, r.subtitle, r.trailing])).toEqual([
      ['1 · Sam pays', 'Group out ₹1,500 → ₹1,200', 'settles ₹300'],
      ['2 · Kabir pays', 'Group out ₹1,200 → ₹900', 'settles ₹300'],
    ])
    expect(view.rows[0]?.aria).toBe('Round 1, Sam pays, group out ₹1,500 to ₹1,200, settles ₹300')
    expect(view.square).toBeNull()
    expect(view.leftoverLine).toBe('Then settle the last ₹900:')
    expect(view.finish).toEqual([{ fromId: riya, toId: kabir, amount: 90000 }])
    expect(view.logLabel).toBe('Log round 1 with Sam paying')
    expect(view.live).toBe('Plan updated: 2 rounds')
  })

  it('celebrates when the rounds square everyone', () => {
    saveExpense(draft({ title: 'Movie', total: 100000, groupId: gang.id, payerId: riya, participants: everyone(ME_ID, riya) }))
    const two = createGroup({ name: 'Us', emoji: '💑', kind: 'couple', currency: 'INR', memberIds: [ME_ID, riya] })
    saveExpense(draft({ title: 'Movie', total: 100000, groupId: two.id, payerId: riya, participants: everyone(ME_ID, riya) }))
    const view = rotationPlanView(groupsStore.get().find((g) => g.id === two.id) as Group, expensesStore.get(), 100000, nameOf)
    expect(view).toMatchObject({ kind: 'plan', square: "Everyone's square after round 1 🎉", leftoverLine: null, finish: [], logLabel: 'Log round 1 with you paying' })
    if (view.kind === 'plan') expect(view.rows[0]?.title).toBe('1 · You pay')
  })

  it('says when a round is bigger than anyone is behind', () => {
    seedExampleA()
    expect(rotationPlanView(group(), expensesStore.get(), 1000000, nameOf)).toEqual({
      kind: 'empty',
      title: "A ₹10,000 round is bigger than anyone's behind",
      body: 'Try a smaller round — or settle up.',
      live: 'Plan updated: no round helps',
    })
  })
})

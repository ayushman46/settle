import { describe, expect, it } from 'vitest'
import { claimBoard, fraction } from '../../engine/claims'
import { boardPortion, boardRowView, claimShareText, nudgeText, overLabel, pickAmount, pickLine, portionWords, replyMessage } from './claimView'
import { choicesToPicks, pickToChoice } from './picks'

describe('messages', () => {
  it('writes the claim link message', () => {
    expect(claimShareText('Toit Brewpub', 276600, 'INR', 'https://s.example/claim#abc')).toBe(
      '🧾 Toit Brewpub · ₹2,766\nTap what you had and pay your share — tax & service are split fairly:\nhttps://s.example/claim#abc',
    )
    expect(nudgeText('Riya', 'Toit Brewpub', 'L')).toBe('Hey Riya! Tap what you had at Toit Brewpub: L')
  })

  it('writes the reply message (spec 01 §2.3)', () => {
    const lines = [
      { name: 'Paneer Tikka', quantity: 1, pick: { num: 1, den: 2 } },
      { name: 'Butter Naan', quantity: 4, pick: { num: 1, den: 4 } },
      { name: 'Fresh Lime Soda', quantity: 1, pick: { num: 1, den: 1 } },
      { name: 'Gulab Jamun', quantity: 1, pick: { num: 1, den: 2 } },
    ]
    expect(replyMessage({ name: 'Riya', title: 'Toit Brewpub', lines, nothing: false, share: 54950, currency: 'INR', paid: true, link: 'https://s.example/app/claims/in#x' })).toBe(
      [
        'Riya’s picks for Toit Brewpub ✅',
        '• Paneer Tikka (shared by 2)',
        '• Butter Naan (1 of 4)',
        '• Fresh Lime Soda',
        '• Gulab Jamun (shared by 2)',
        'My share: ₹549.50 — paid ✓',
        'Add them to the bill: https://s.example/app/claims/in#x',
      ].join('\n'),
    )
    expect(replyMessage({ name: 'Kabir', title: 'Toit', lines: [], nothing: true, share: 0, currency: 'INR', paid: false, link: 'L' })).toBe(
      'Kabir’s picks for Toit ✅\nI had nothing on this bill\nAdd them to the bill: L',
    )
  })

  it('words a pick', () => {
    expect(pickLine('Beer', 3, { num: 2, den: 3 })).toBe('Beer (2 of 3)')
    expect(pickLine('Pizza', 1, { num: 2, den: 5 })).toBe('Pizza (2/5)')
    expect(portionWords(4, { num: 1, den: 4 }, 24000, 'INR')).toBe('1 of 4 · ₹60')
    expect(portionWords(1, { num: 1, den: 2 }, 38000, 'INR')).toBe('Shared by 2 · ₹190')
    expect(portionWords(1, { num: 1, den: 1 }, 12000, 'INR')).toBe('All yours · ₹120')
    expect(pickAmount(1001, { num: 1, den: 2 })).toBe(501)
  })
})

describe('board words', () => {
  const rows = claimBoard({
    itemCount: 4,
    fixedIndexes: new Set([3]),
    claimers: [
      { friendId: 'a', picks: [{ item: 0, num: 1, den: 3 }, { item: 1, num: 1, den: 2 }] },
      { friendId: 'b', picks: [{ item: 0, num: 2, den: 3 }, { item: 1, num: 1, den: 1 }] },
      { friendId: 'c', picks: [{ item: 0, num: 1, den: 3 }] },
    ],
  })

  it('labels each status', () => {
    expect(boardRowView(rows[0]!, 3, undefined, false)).toMatchObject({ label: 'Claimed 4 of 3', tone: 'warning', needsYou: true })
    expect(boardRowView(rows[1]!, 1, undefined, false)).toMatchObject({ label: 'Claimed 1½ of 1', needsYou: true })
    expect(boardRowView(rows[2]!, 1, undefined, false)).toMatchObject({ label: 'Nobody yet', icon: 'circle', needsYou: true })
    expect(boardRowView(rows[3]!, 1, undefined, false)).toMatchObject({ label: 'Sorted by you', icon: 'lock', needsYou: false })
    expect(boardRowView(rows[0]!, 3, { kind: 'as_claimed' }, true)).toMatchObject({ label: 'Decided', decided: true, needsYou: false })
  })

  it('says "Claimed twice" and partial parts', () => {
    const twice = claimBoard({ itemCount: 1, fixedIndexes: new Set(), claimers: [{ friendId: 'a', picks: [{ item: 0, num: 1, den: 1 }] }, { friendId: 'b', picks: [{ item: 0, num: 1, den: 1 }] }] })
    expect(overLabel(twice[0]!, 1)).toBe('Claimed twice')
    const half = claimBoard({ itemCount: 1, fixedIndexes: new Set(), claimers: [{ friendId: 'a', picks: [{ item: 0, num: 1, den: 2 }] }] })
    expect(boardRowView(half[0]!, 1, undefined, false).label).toBe('½ unclaimed')
  })

  it('writes portions on the board', () => {
    expect(boardPortion(fraction(2, 3), 3)).toBe('2')
    expect(boardPortion(fraction(1, 2), 1)).toBe('½')
    expect(boardPortion(fraction(1, 1), 1)).toBe('1')
  })
})

describe('picks from choices', () => {
  it('round-trips the picker’s choices', () => {
    const qs = [1, 4, 1, 3]
    const picks = choicesToPicks({ 0: { kind: 'shared', n: 2 }, 1: { kind: 'units', k: 1 }, 2: { kind: 'me' }, 3: { kind: 'units', k: 0 } }, qs)
    expect(picks).toEqual([
      { item: 0, num: 1, den: 2 },
      { item: 1, num: 1, den: 4 },
      { item: 2, num: 1, den: 1 },
    ])
    expect(pickToChoice({ num: 1, den: 2 }, 1)).toEqual({ kind: 'shared', n: 2 })
    expect(pickToChoice({ num: 2, den: 4 }, 4)).toEqual({ kind: 'units', k: 2 })
    expect(pickToChoice({ num: 1, den: 1 }, undefined)).toEqual({ kind: 'me' })
  })
})

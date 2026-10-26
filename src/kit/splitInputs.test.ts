import { describe, expect, it } from 'vitest'
import { ME_ID, type Participant } from '../domain/types'
import { splitAmount, type AmountSplitInput, type AmountSplitMode } from '../engine/split'
import { formatMoney } from '../lib/money'
import {
  clearedInputs,
  cleanPercentText,
  formatBps,
  parsePercentText,
  percentText,
  restoreInputs,
  restPreview,
  roundingCover,
  splitStatus,
} from './splitInputs'

const inr = (minor: number) => formatMoney(minor, 'INR', { trimZeros: true })
const people = (...inputs: Array<number | null>): Participant[] =>
  inputs.map((input, i) => ({ friendId: i === 0 ? ME_ID : `f${i}`, input }))

function status(mode: AmountSplitMode, total: number | null, participants: Participant[], roundToWhole = false) {
  const result = splitAmount({ total: total ?? 0, currency: 'INR', mode, participants, payerId: ME_ID, roundToWhole })
  return splitStatus({ total, currency: 'INR', mode, participants, result })
}

describe('percent text', () => {
  it.each([
    ['25', '25'],
    ['033.333', '33.33'],
    ['12,5', '12,5'],
    ['1234', '123'],
    ['.', '0.'],
    ['5.5.5', '5.55'],
    ['abc', ''],
    ['٣٣.٥', '33.5'],
    ['00', '0'],
  ])('cleans %j → %j', (typed, clean) => {
    expect(cleanPercentText(typed)).toBe(clean)
  })

  it('parses to basis points', () => {
    expect(parsePercentText('')).toBeNull()
    expect(parsePercentText('x')).toBeNull()
    expect(parsePercentText('12.5')).toBe(1250)
    expect(parsePercentText('33,33')).toBe(3333)
    expect(parsePercentText('100')).toBe(10_000)
    expect(parsePercentText('0')).toBe(0)
    expect(parsePercentText('12.')).toBe(1200)
    expect(parsePercentText('0.05')).toBe(5)
  })

  it('writes basis points back as editable text', () => {
    expect(percentText(null)).toBe('')
    expect(percentText(-5)).toBe('')
    expect(percentText(2500)).toBe('25')
    expect(percentText(1250)).toBe('12.5')
    expect(percentText(3333)).toBe('33.33')
    expect(percentText(5)).toBe('0.05')
    expect(percentText(10_000)).toBe('100')
    for (const bps of [0, 1, 99, 1250, 3333, 6667, 10_000]) expect(parsePercentText(percentText(bps))).toBe(bps)
  })

  it('formats basis points for display', () => {
    expect(formatBps(3333)).toBe(new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 }).format(0.3333))
    expect(formatBps(10_000)).toBe(new Intl.NumberFormat(undefined, { style: 'percent' }).format(1))
  })
})

describe('splitStatus', () => {
  it('asks for people, then for the amount', () => {
    expect(status('equal', 100_000, [])).toMatchObject({ tone: 'idle', message: 'Pick people to split with' })
    expect(status('exact', null, people(null, null))).toMatchObject({ tone: 'idle', message: 'Enter the amount first', canSplitRest: false })
    expect(status('equal', 0, people(null))).toMatchObject({ tone: 'idle' })
  })

  it('equal: adds up, with each share', () => {
    expect(status('equal', 100_000, people(null, null, null, null))).toEqual({
      tone: 'ok',
      message: 'Adds up',
      detail: `${inr(25_000)} each`,
      progress: null,
      canSplitRest: false,
    })
    expect(status('equal', 10_000, people(null, null, null)).detail).toBe(`About ${inr(3333)} each`)
  })

  it('exact: left to assign, too much, and adds up', () => {
    expect(status('exact', 100_000, people(40_000, null))).toEqual({
      tone: 'pending',
      message: `${inr(60_000)} left to assign`,
      detail: `${inr(40_000)} of ${inr(100_000)}`,
      progress: 0.4,
      canSplitRest: true,
    })
    expect(status('exact', 100_000, people(80_000, 30_000))).toMatchObject({
      tone: 'over',
      message: `${inr(10_000)} more than the total`,
      progress: 1,
      canSplitRest: false,
    })
    expect(status('exact', 100_000, people(70_000, 30_000))).toMatchObject({ tone: 'ok', message: 'Adds up', progress: 1 })
  })

  it('percent: left, over and complete', () => {
    expect(status('percent', 100_000, people(5000, null))).toMatchObject({
      tone: 'pending',
      message: `${formatBps(5000)} left to assign`,
      detail: `${formatBps(5000)} of 100%`,
      progress: 0.5,
      canSplitRest: true,
    })
    expect(status('percent', 100_000, people(8000, 3000))).toMatchObject({ tone: 'over', message: `${formatBps(1000)} over 100%` })
    expect(status('percent', 100_000, people(6000, 4000))).toMatchObject({ tone: 'ok', message: 'Adds up to 100%', progress: 1 })
  })

  it('shares: counts shares and the value of one', () => {
    expect(status('shares', 100_000, people(null, 2, 1))).toMatchObject({ tone: 'ok', detail: `4 shares · ${inr(25_000)} a share` })
    expect(status('shares', 100_000, people(null, 2)).detail).toBe(`3 shares · about ${inr(33_333)} a share`)
    expect(status('shares', 100_000, people(1, 0)).detail).toBe(`1 share · ${inr(100_000)} a share`)
    expect(status('shares', 100_000, people(0, 0))).toMatchObject({ tone: 'pending', message: 'Give someone at least one share' })
  })
})

describe('splitStatus — what each had', () => {
  it('asks what each had, then offers what it comes to as the total', () => {
    expect(status('had', null, people(null, null))).toMatchObject({ tone: 'pending', message: 'Type what each person had' })
    expect(status('had', 100_000, people(0, null))).toMatchObject({ tone: 'pending', message: 'Type what each person had' })
    expect(status('had', null, people(40_000, 30_000))).toMatchObject({
      tone: 'pending',
      message: `Comes to ${inr(70_000)}`,
      detail: 'use it as the total, or type what you paid above',
      useTotal: 70_000,
    })
  })

  it('says how tax and tip or a discount are shared', () => {
    expect(status('had', 70_000, people(40_000, 30_000))).toMatchObject({ tone: 'ok', message: 'Adds up', detail: null })
    expect(status('had', 80_500, people(40_000, 30_000))).toMatchObject({
      tone: 'ok',
      message: `${inr(10_500)} tax & tip shared in proportion`,
      detail: `${inr(70_000)} had · ${inr(80_500)} paid`,
    })
    expect(status('had', 56_000, people(40_000, 30_000))).toMatchObject({ tone: 'ok', message: `${inr(14_000)} off shared in proportion` })
    expect(status('had', 80_500, people(40_000, 30_000)).useTotal).toBeUndefined()
  })

  it('flags a total far above what everyone had', () => {
    expect(status('had', 200_000, people(40_000, 30_000))).toMatchObject({
      tone: 'pending',
      message: `${inr(130_000)} more than what everyone had`,
      detail: 'did someone miss an item?',
    })
  })
})

describe('restPreview', () => {
  const base: Omit<AmountSplitInput, 'participants' | 'mode'> = { total: 100_000, currency: 'INR', payerId: ME_ID }

  it('shows what the empty fields would get', () => {
    expect(restPreview({ ...base, mode: 'exact', participants: people(40_000, null, null) })).toEqual({ f1: 30_000, f2: 30_000 })
    expect(restPreview({ ...base, mode: 'percent', participants: people(null, 5000, null) })).toEqual({ [ME_ID]: 2500, f2: 2500 })
  })

  it('gives the payer the odd paisa first', () => {
    expect(restPreview({ ...base, total: 100, mode: 'exact', participants: people(null, null, null) })).toEqual({ [ME_ID]: 34, f1: 33, f2: 33 })
  })

  it('is empty when nothing is left or the mode has no fields', () => {
    expect(restPreview({ ...base, mode: 'exact', participants: people(100_000, null) })).toEqual({})
    expect(restPreview({ ...base, mode: 'exact', participants: people(120_000, null) })).toEqual({})
    expect(restPreview({ ...base, mode: 'equal', participants: people(null, null) })).toEqual({})
    expect(restPreview({ ...base, mode: 'shares', participants: people(null, null) })).toEqual({})
  })
})

describe('roundingCover', () => {
  const input = (roundToWhole: boolean, payerId = ME_ID): AmountSplitInput => ({
    total: 10_000,
    currency: 'INR',
    mode: 'equal',
    participants: people(null, null, null),
    payerId,
    roundToWhole,
  })

  it("is what the payer adds so others pay whole rupees", () => {
    // ₹100 / 3 → 33.34 (payer) + 33.33 + 33.33 → others ₹33 each, the payer ₹34.
    expect(roundingCover(input(true))).toBe(66)
    expect(roundingCover(input(false))).toBe(0)
  })

  it('counts a payer who is not in the split', () => {
    const outside = { ...input(true, 'payer'), participants: people(null, null, null) }
    expect(roundingCover(outside)).toBe(100)
  })

  it('is 0 for a split that does not add up yet', () => {
    expect(roundingCover({ ...input(true), mode: 'exact', participants: people(5000, null, null) })).toBe(0)
  })
})

describe('inputs between modes', () => {
  it('clears and restores inputs for whoever is in now', () => {
    expect(clearedInputs([...people(5, 7), { friendId: 'f1', input: 9 }])).toEqual([
      { friendId: ME_ID, input: null },
      { friendId: 'f1', input: null },
    ])
    expect(restoreInputs(people(null, null, null), { [ME_ID]: 400, f1: null, gone: 5 })).toEqual([
      { friendId: ME_ID, input: 400 },
      { friendId: 'f1', input: null },
      { friendId: 'f2', input: null },
    ])
    expect(restoreInputs(people(3), undefined)).toEqual([{ friendId: ME_ID, input: null }])
  })
})

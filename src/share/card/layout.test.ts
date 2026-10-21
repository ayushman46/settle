import { describe, expect, it } from 'vitest'
import { BRAND, CATEGORY_IDS } from '../../domain/types'
import { formatBillDate } from '../../lib/format'
import { formatMoney } from '../../lib/money'
import { categoryLabel } from '../categories'
import { CATEGORY_ICON_PATHS, CHECK_ICON_PATHS } from './icons'
import { AMOUNT_DESCENT, CARD_SIZE, layoutShareCard, type CardOp, type CardScene, type ShareCardInput, type ShareCardLayoutOptions } from './layout'
import { fakeMeasure } from './testMeasure'
import { CARD_THEMES, CATEGORY_COLORS } from './theme'

type TextOp = Extract<CardOp, { kind: 'text' }>

const money = (minor: number) => formatMoney(minor, 'INR', { trimZeros: true })

function input(extra: Partial<ShareCardInput> = {}): ShareCardInput {
  return {
    title: 'Dinner at Toit',
    category: 'food',
    currency: 'INR',
    date: '2026-10-18',
    total: 276_650,
    payerName: 'Ayush',
    people: [
      { name: 'Riya Kapoor', color: 5, amount: 69_163, paid: true, isPayer: false },
      { name: 'Ayush', color: 2, amount: 69_163, paid: true, isPayer: true },
      { name: 'Sam', color: 1, amount: 69_162, paid: false, isPayer: false },
      { name: 'Neha Sharma', color: 3, amount: 69_162, paid: false, isPayer: false },
    ],
    ...extra,
  }
}

const LIGHT: ShareCardLayoutOptions = { watermark: true, theme: 'light', siteLabel: 'settle.example' }

function people(n: number, extra: { paidEvery?: number } = {}): ShareCardInput['people'] {
  return Array.from({ length: n }, (_, i) => ({
    name: `Person ${i + 1}`,
    color: i,
    amount: 10_000 + i,
    paid: extra.paidEvery ? i % extra.paidEvery === 0 : false,
    isPayer: i === 0,
  }))
}

const texts = (scene: CardScene) => scene.ops.filter((op): op is TextOp => op.kind === 'text')
const textValues = (scene: CardScene) => texts(scene).map((op) => op.text)

/** Invariants every card must satisfy, whatever the input. */
function expectWellFormed(scene: CardScene, opts: ShareCardLayoutOptions) {
  expect(scene.width).toBe(CARD_SIZE.width)
  expect(scene.height).toBe(CARD_SIZE.height)
  const { card } = scene
  expect(card.y).toBeGreaterThanOrEqual(72)
  expect(card.y + card.h).toBeLessThanOrEqual(CARD_SIZE.height - 72 - (opts.watermark ? 96 : 0))
  for (const op of scene.ops) {
    if (op.kind === 'text') {
      expect(fakeMeasure(op.text, op.style), op.text).toBeLessThanOrEqual(op.maxWidth + 0.01)
      expect(op.x).toBeGreaterThanOrEqual(0)
      expect(op.x).toBeLessThanOrEqual(CARD_SIZE.width)
      expect(op.y).toBeGreaterThan(0)
      expect(op.y).toBeLessThan(CARD_SIZE.height)
      expect(op.text.length).toBeGreaterThan(0)
    }
    if (op.kind === 'rect' || op.kind === 'icon') {
      expect(op.x).toBeGreaterThanOrEqual(0)
      expect(op.y).toBeGreaterThanOrEqual(0)
    }
    if (op.kind === 'rect') {
      expect(op.x + op.w).toBeLessThanOrEqual(CARD_SIZE.width)
      expect(op.y + op.h).toBeLessThanOrEqual(CARD_SIZE.height)
    }
  }
  // Everything inside the card stays inside it (text left/right edges within the padding).
  for (const op of texts(scene)) {
    if (op.text.startsWith('Made with') || op.text.startsWith(' · ')) continue
    const width = fakeMeasure(op.text, op.style)
    const left = op.align === 'left' ? op.x : op.align === 'right' ? op.x - width : op.x - width / 2
    expect(left).toBeGreaterThanOrEqual(card.x)
    expect(left + width).toBeLessThanOrEqual(card.x + card.w + 0.01)
    expect(op.y).toBeGreaterThan(card.y)
    expect(op.y).toBeLessThan(card.y + card.h)
  }
}

describe('layoutShareCard', () => {
  it('lays out a premium receipt: category, date, title, payer, total, people, progress, footer', () => {
    const scene = layoutShareCard(input(), LIGHT, fakeMeasure)
    expectWellFormed(scene, LIGHT)
    const values = textValues(scene)
    expect(values).toEqual(
      expect.arrayContaining([
        'Food & drinks',
        formatBillDate('2026-10-18'),
        'Dinner at Toit',
        'Paid by Ayush · split 4 ways',
        money(276_650),
        'Ayush',
        'Riya Kapoor',
        'Paid the bill',
        'Paid back',
        'Yet to pay',
        `${money(69_163)} of ${money(207_487)} collected`,
        '1 of 3 paid',
        `Made with ${BRAND.name}`,
        ' · settle.example',
      ]),
    )
  })

  it('puts the payer first and keeps everyone else in order', () => {
    const scene = layoutShareCard(input(), LIGHT, fakeMeasure)
    const names = textValues(scene).filter((t) => ['Ayush', 'Riya Kapoor', 'Sam', 'Neha Sharma'].includes(t))
    expect(names).toEqual(['Ayush', 'Riya Kapoor', 'Sam', 'Neha Sharma'])
  })

  it('rings the payer in lime and ticks people who paid back', () => {
    const scene = layoutShareCard(input(), LIGHT, fakeMeasure)
    const rings = scene.ops.filter((op) => op.kind === 'circle' && op.stroke === CARD_THEMES.light.accent)
    expect(rings).toHaveLength(1)
    const ticks = scene.ops.filter((op) => op.kind === 'icon' && op.paths === CHECK_ICON_PATHS && op.color === CARD_THEMES.light.onPositive)
    expect(ticks).toHaveLength(1)
    const paidLabel = texts(scene).find((op) => op.text === 'Paid back')
    expect(paidLabel?.color).toBe(CARD_THEMES.light.positive)
  })

  it('draws the category tile and icon in the category colours', () => {
    for (const category of CATEGORY_IDS) {
      for (const theme of ['light', 'dark'] as const) {
        const scene = layoutShareCard(input({ category }), { ...LIGHT, theme }, fakeMeasure)
        const colors = CATEGORY_COLORS[theme][category]
        expect(scene.ops).toContainEqual(expect.objectContaining({ kind: 'rect', fill: colors.bg }))
        expect(scene.ops).toContainEqual(expect.objectContaining({ kind: 'icon', paths: CATEGORY_ICON_PATHS[category], color: colors.ink }))
        expect(texts(scene).find((op) => op.text === categoryLabel(category))?.color).toBe(colors.ink)
      }
    }
  })

  it('switches every colour with the theme; only the light card casts a shadow', () => {
    const light = layoutShareCard(input(), LIGHT, fakeMeasure)
    const dark = layoutShareCard(input(), { ...LIGHT, theme: 'dark' }, fakeMeasure)
    expect(light.ops[0]).toEqual({ kind: 'background', color: CARD_THEMES.light.bg })
    expect(dark.ops[0]).toEqual({ kind: 'background', color: CARD_THEMES.dark.bg })
    const ticket = (s: CardScene) => s.ops.find((op) => op.kind === 'ticket')
    expect(ticket(light)).toMatchObject({ fill: CARD_THEMES.light.surface, shadow: CARD_THEMES.light.shadow })
    expect(ticket(dark)).toMatchObject({ fill: CARD_THEMES.dark.surface, shadow: null })
    const title = (s: CardScene) => texts(s).find((op) => op.text === 'Dinner at Toit')?.color
    expect(title(light)).toBe(CARD_THEMES.light.ink)
    expect(title(dark)).toBe(CARD_THEMES.dark.ink)
    expectWellFormed(dark, { ...LIGHT, theme: 'dark' })
  })

  it('tears the ticket at the dashed divider', () => {
    const scene = layoutShareCard(input(), LIGHT, fakeMeasure)
    const ticket = scene.ops.find((op) => op.kind === 'ticket')
    const dashed = scene.ops.find((op) => op.kind === 'line' && op.dash)
    expect(ticket && dashed && ticket.kind === 'ticket' && dashed.kind === 'line').toBe(true)
    if (ticket?.kind !== 'ticket' || dashed?.kind !== 'line') return
    expect(dashed.y1).toBe(ticket.notchY)
    expect(dashed.x1).toBeGreaterThan(ticket.x + ticket.notchR)
    expect(dashed.x2).toBeLessThan(ticket.x + ticket.w - ticket.notchR)
    // Header above the tear, people below it.
    expect(texts(scene).find((op) => op.text === money(276_650))?.y).toBeLessThan(ticket.notchY)
    expect(texts(scene).find((op) => op.text === 'Sam')?.y).toBeGreaterThan(ticket.notchY)
  })

  it('leaves the footer off clean (Pro) cards and gives the card the room', () => {
    const clean = { ...LIGHT, watermark: false }
    const scene = layoutShareCard(input({ people: people(12) }), clean, fakeMeasure)
    expectWellFormed(scene, clean)
    expect(textValues(scene).some((t) => t.includes('Made with'))).toBe(false)
    const marked = layoutShareCard(input({ people: people(12) }), LIGHT, fakeMeasure)
    expect(scene.rows.shown).toBeGreaterThanOrEqual(marked.rows.shown)
  })

  it('omits the site label when there is none', () => {
    const scene = layoutShareCard(input(), { ...LIGHT, siteLabel: '' }, fakeMeasure)
    expect(textValues(scene)).toContain(`Made with ${BRAND.name}`)
    expect(textValues(scene).some((t) => t.startsWith(' · '))).toBe(false)
  })

  it('wraps long titles onto two lines with an ellipsis, and falls back to the category', () => {
    const long = 'Goa trip — villa, scooters, that beach shack dinner and the very late night at the club'
    const scene = layoutShareCard(input({ title: long }), LIGHT, fakeMeasure)
    expectWellFormed(scene, LIGHT)
    const titleSize = 56
    const lines = texts(scene).filter((op) => op.style.size === titleSize)
    expect(lines).toHaveLength(2)
    expect(lines[1]?.text.endsWith('…')).toBe(true)
    expect(textValues(layoutShareCard(input({ title: '   ' }), LIGHT, fakeMeasure))).toContain('Food & drinks')
  })

  it('shrinks big totals to fit', () => {
    const scene = layoutShareCard(input({ total: 99_999_999_999_999 }), LIGHT, fakeMeasure)
    expectWellFormed(scene, LIGHT)
    const amount = texts(scene).find((op) => op.text === money(99_999_999_999_999))
    expect(amount?.style.size).toBeLessThan(112)
    const small = texts(layoutShareCard(input(), LIGHT, fakeMeasure)).find((op) => op.text === money(276_650))
    expect(small?.style.size).toBe(112)
  })

  it("keeps the lime underline clear of the total's comma, at every size", () => {
    for (const total of [84_000, 276_650, 3_200_000, 99_999_999_999_999]) {
      const scene = layoutShareCard(input({ total }), LIGHT, fakeMeasure)
      const amount = texts(scene).find((op) => op.text === money(total))
      const underline = scene.ops.find((op) => op.kind === 'rect' && op.fill === CARD_THEMES.light.accent && op.h === 12)
      const ticket = scene.ops.find((op) => op.kind === 'ticket')
      if (!amount || underline?.kind !== 'rect' || ticket?.kind !== 'ticket') throw new Error('missing amount, underline or ticket')
      expect(underline.y - (amount.y + amount.style.size * AMOUNT_DESCENT), String(total)).toBeGreaterThanOrEqual(8)
      expect(underline.y + underline.h).toBeLessThan(ticket.notchY - ticket.notchR)
    }
  })

  it('truncates long names before they reach the amount', () => {
    const scene = layoutShareCard(
      input({ people: [{ name: 'Bartholomew Alexander Fitzgerald Wolfeschlegelsteinhausen', color: 0, amount: 99_999_999, paid: false, isPayer: false }] }),
      LIGHT,
      fakeMeasure,
    )
    expectWellFormed(scene, LIGHT)
    const name = texts(scene).find((op) => op.text.startsWith('Bartholomew'))
    const amount = texts(scene).find((op) => op.text === money(99_999_999))
    expect(name?.text.endsWith('…')).toBe(true)
    if (!name || !amount) return
    expect(name.x + fakeMeasure(name.text, name.style)).toBeLessThan(amount.x - fakeMeasure(amount.text, amount.style))
  })

  it('picks roomier rows for small groups and tighter ones for big groups', () => {
    expect(layoutShareCard(input({ people: people(2) }), LIGHT, fakeMeasure).rows).toEqual({ density: 'spacious', shown: 2, hidden: 0 })
    const six = layoutShareCard(input({ people: people(6) }), LIGHT, fakeMeasure).rows
    expect(six.hidden).toBe(0)
    expect(six.density).not.toBe('spacious')
    for (let n = 0; n <= 30; n++) {
      for (const watermark of [true, false]) {
        const opts = { ...LIGHT, watermark }
        const scene = layoutShareCard(input({ people: people(n, { paidEvery: 3 }) }), opts, fakeMeasure)
        expectWellFormed(scene, opts)
        expect(scene.rows.shown + scene.rows.hidden).toBe(n)
      }
    }
  })

  it('sums everyone who does not fit into a "+N more" row', () => {
    const many = people(20)
    const scene = layoutShareCard(input({ people: many }), LIGHT, fakeMeasure)
    const { shown, hidden } = scene.rows
    expect(scene.rows.density).toBe('tight')
    expect(hidden).toBeGreaterThan(0)
    expect(textValues(scene)).toContain(`${hidden} more people`)
    expect(textValues(scene)).toContain(`+${hidden}`)
    const hiddenSum = many.slice(shown).reduce((sum, p) => sum + p.amount, 0)
    expect(textValues(scene)).toContain(money(hiddenSum))
  })

  it('never hides just one person (their row would have fitted instead)', () => {
    for (let n = 1; n <= 40; n++) expect(layoutShareCard(input({ people: people(n) }), LIGHT, fakeMeasure).rows.hidden).not.toBe(1)
  })

  it('gives up the second title line before hiding people', () => {
    const long = 'Goa trip — villa, scooters, that beach shack dinner and the very late night at the club'
    const crowd = people(9)
    const scene = layoutShareCard(input({ title: long, people: crowd }), LIGHT, fakeMeasure)
    expect(texts(scene).filter((op) => op.style.size === 56)).toHaveLength(1)
    const roomy = layoutShareCard(input({ title: long, people: people(2) }), LIGHT, fakeMeasure)
    expect(texts(roomy).filter((op) => op.style.size === 56)).toHaveLength(2)
  })

  it('shows collection progress, and celebrates when everyone has paid', () => {
    const settled = input({ people: input().people.map((p) => ({ ...p, paid: true })) })
    const scene = layoutShareCard(settled, LIGHT, fakeMeasure)
    expect(textValues(scene)).toEqual(expect.arrayContaining(['All settled up', '3 of 3 paid']))
    const fills = scene.ops.filter((op) => op.kind === 'rect' && op.h === 14)
    expect(fills).toHaveLength(2)
    expect(fills[1]).toMatchObject({ w: fills[0]?.kind === 'rect' ? fills[0].w : -1, stroke: CARD_THEMES.light.accentEdge })

    const none = layoutShareCard(input({ people: input().people.map((p) => ({ ...p, paid: p.isPayer })) }), LIGHT, fakeMeasure)
    expect(none.ops.filter((op) => op.kind === 'rect' && op.h === 14)).toHaveLength(1)
    expect(textValues(none)).toContain('0 of 3 paid')
  })

  it('skips progress when nobody owes anything (e.g. the payer alone)', () => {
    const scene = layoutShareCard(input({ people: [{ name: 'Ayush', color: 0, amount: 276_650, paid: true, isPayer: true }] }), LIGHT, fakeMeasure)
    expectWellFormed(scene, LIGHT)
    expect(textValues(scene).some((t) => t.includes('collected') || t.includes('paid') && t.includes(' of '))).toBe(false)
    const zero = layoutShareCard(input({ people: [{ name: 'Sam', color: 0, amount: 0, paid: false, isPayer: false }] }), LIGHT, fakeMeasure)
    expect(textValues(zero)).toContain('Nothing to pay')
  })

  it('handles an empty split, a missing date and a missing payer name', () => {
    const scene = layoutShareCard(input({ people: [], date: 'not a date', payerName: '' }), LIGHT, fakeMeasure)
    expectWellFormed(scene, LIGHT)
    expect(scene.rows).toEqual({ density: 'spacious', shown: 0, hidden: 0 })
    expect(textValues(scene).some((t) => t.startsWith('Paid by') || t.startsWith('split'))).toBe(false)
    const noDate = layoutShareCard(input({ date: '' }), LIGHT, fakeMeasure)
    expect(textValues(noDate)).not.toContain(formatBillDate('2026-10-18'))
  })

  it('is deterministic', () => {
    expect(layoutShareCard(input(), LIGHT, fakeMeasure)).toEqual(layoutShareCard(input(), LIGHT, fakeMeasure))
  })
})

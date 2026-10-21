import { describe, expect, it } from 'vitest'
import { BRAND } from '../../domain/types'
import { formatMoney } from '../../lib/money'
import { ARROW_ICON_PATHS, CHECK_ICON_PATHS } from './icons'
import { GROUP_KIND_LABELS, layoutGroupCard, type GroupCardInput, type GroupCardTransfer } from './groupLayout'
import type { CardLayoutOptions } from './parts'
import { fakeMeasure } from './testMeasure'
import { expectWellFormed, texts, textValues } from './testScene'
import { CARD_ACCENTS, CARD_THEMES } from './theme'

const money = (minor: number) => formatMoney(minor, 'INR', { trimZeros: true })
const LIGHT: CardLayoutOptions = { watermark: true, theme: 'light', siteLabel: 'settle.example' }

const p = (name: string, color = 0) => ({ name, color })

function input(extra: Partial<GroupCardInput> = {}): GroupCardInput {
  return {
    name: 'Goa 2026',
    emoji: '🏖️',
    kind: 'trip',
    currency: 'INR',
    total: 4_812_050,
    expenseCount: 14,
    memberCount: 6,
    transfers: [
      { from: p('Sam', 1), to: p('Riya Kapoor', 5), amount: 640_000 },
      { from: p('Neha Sharma', 3), to: p('Riya Kapoor', 5), amount: 312_525 },
      { from: p('Dev', 6), to: p('Ayush', 2), amount: 240_000 },
    ],
    ...extra,
  }
}

function transfers(n: number): GroupCardTransfer[] {
  return Array.from({ length: n }, (_, i) => ({ from: p(`Person ${i + 1}`, i), to: p('Riya', 5), amount: 10_000 + i }))
}

describe('layoutGroupCard', () => {
  it('shows the group, what it spent, and who pays whom', () => {
    const scene = layoutGroupCard(input(), LIGHT, fakeMeasure)
    expectWellFormed(scene, LIGHT)
    expect(textValues(scene)).toEqual(
      expect.arrayContaining([
        '🏖️',
        'Trip',
        '6 people · 14 expenses',
        'Goa 2026',
        'Total spent',
        money(4_812_050),
        'To settle up',
        '3 payments',
        'Sam pays Riya Kapoor',
        money(640_000),
        'Dev pays Ayush',
        `Made with ${BRAND.name}`,
      ]),
    )
    expect(scene.rows).toEqual({ density: 'spacious', shown: 3, hidden: 0 })
  })

  it('labels the kind in the accent ink and keeps the payments in the given order', () => {
    const scene = layoutGroupCard(input(), LIGHT, fakeMeasure)
    expect(texts(scene).find((op) => op.text === 'Trip')?.color).toBe(CARD_THEMES.light.accentInk)
    const lines = textValues(scene).filter((t) => t.includes(' pays '))
    // Full names when they fit, first names when they don't.
    expect(lines).toEqual(['Sam pays Riya Kapoor', 'Neha pays Riya', 'Dev pays Ayush'])
    for (const kind of Object.keys(GROUP_KIND_LABELS) as Array<GroupCardInput['kind']>) {
      expect(textValues(layoutGroupCard(input({ kind }), LIGHT, fakeMeasure))).toContain(GROUP_KIND_LABELS[kind])
    }
  })

  it('draws both people of each payment with an arrow between them', () => {
    const scene = layoutGroupCard(input(), LIGHT, fakeMeasure)
    const arrows = scene.ops.filter((op) => op.kind === 'icon' && op.paths === ARROW_ICON_PATHS)
    expect(arrows).toHaveLength(3)
    // Initials of payer and payee on every row: S → RK, NS → RK, D → A.
    const initials = texts(scene).filter((op) => op.baseline === 'middle').map((op) => op.text)
    expect(initials).toEqual(['🏖️', 'S', 'RK', 'NS', 'RK', 'D', 'A'])
    for (const arrow of arrows) {
      if (arrow.kind !== 'icon') continue
      const avatars = scene.ops.filter((op) => op.kind === 'circle' && Math.abs(op.y - (arrow.y + arrow.size / 2)) < 0.01)
      expect(avatars).toHaveLength(2)
      const [from, to] = avatars
      if (from?.kind !== 'circle' || to?.kind !== 'circle') continue
      // The arrow sits in the gap: avatars never overlap it or each other.
      expect(arrow.x).toBeGreaterThanOrEqual(from.x + from.r)
      expect(arrow.x + arrow.size).toBeLessThanOrEqual(to.x - to.r)
    }
  })

  it('shortens to first names, then cuts with "…", before reaching the amount', () => {
    const long = input({
      transfers: [
        { from: p('Arjun Ramakrishnan Iyer'), to: p('Priya Venkataraman'), amount: 99_999_999 },
        { from: p('Wolfeschlegelsteinhausenbergerdorffvoralternwarenge Smith'), to: p('Riya'), amount: 99_999_999 },
      ],
    })
    const scene = layoutGroupCard(long, LIGHT, fakeMeasure)
    expectWellFormed(scene, LIGHT)
    const values = textValues(scene)
    expect(values).toContain('Arjun pays Priya')
    expect(values.some((t) => t.startsWith('Wolfeschlegel') && t.endsWith('…'))).toBe(true)
    const amounts = texts(scene).filter((op) => op.text === money(99_999_999))
    const lines = texts(scene).filter((op) => op.text.includes(' pays ') || op.text.startsWith('Wolfeschlegel'))
    lines.forEach((line, i) => {
      const amount = amounts[i]
      if (!amount) throw new Error('missing amount')
      expect(line.x + fakeMeasure(line.text, line.style)).toBeLessThan(amount.x - fakeMeasure(amount.text, amount.style))
    })
  })

  it("celebrates when everyone's square, and says when there's nothing yet", () => {
    for (const theme of ['light', 'dark'] as const) {
      const opts = { ...LIGHT, theme }
      const scene = layoutGroupCard(input({ transfers: [] }), opts, fakeMeasure)
      expectWellFormed(scene, opts)
      expect(textValues(scene)).toEqual(expect.arrayContaining(["Everyone's settled up", 'No payments needed']))
      expect(textValues(scene)).not.toContain('To settle up')
      expect(scene.ops).toContainEqual(expect.objectContaining({ kind: 'circle', fill: CARD_THEMES[theme].positive }))
      expect(scene.ops).toContainEqual(expect.objectContaining({ kind: 'icon', paths: CHECK_ICON_PATHS, color: CARD_THEMES[theme].onPositive }))
    }
    const fresh = layoutGroupCard(input({ transfers: [], expenseCount: 0, total: 0 }), LIGHT, fakeMeasure)
    expect(textValues(fresh)).toEqual(expect.arrayContaining(['Nothing to settle yet', 'No expenses so far', '6 people · 0 expenses', money(0)]))
  })

  it('ignores zero payments', () => {
    const scene = layoutGroupCard(input({ transfers: [{ from: p('A'), to: p('B'), amount: 0 }] }), LIGHT, fakeMeasure)
    expect(textValues(scene)).toContain("Everyone's settled up")
    expect(scene.rows.shown).toBe(0)
  })

  it('fits any number of payments, summing the rest into "+N more payments"', () => {
    for (let n = 0; n <= 40; n++) {
      for (const watermark of [true, false]) {
        const opts = { ...LIGHT, watermark }
        const scene = layoutGroupCard(input({ transfers: transfers(n) }), opts, fakeMeasure)
        expectWellFormed(scene, opts)
        expect(scene.rows.shown + scene.rows.hidden).toBe(n)
        // Never hides just one payment (its row would have fitted instead).
        expect(scene.rows.hidden).not.toBe(1)
      }
    }
    const many = transfers(30)
    const scene = layoutGroupCard(input({ transfers: many }), LIGHT, fakeMeasure)
    const { shown, hidden } = scene.rows
    expect(scene.rows.density).toBe('tight')
    expect(textValues(scene)).toEqual(expect.arrayContaining(['30 payments', `${hidden} more payments`, `+${hidden}`]))
    expect(textValues(scene)).toContain(money(many.slice(shown).reduce((sum, t) => sum + t.amount, 0)))
  })

  it('picks roomier rows for a few payments', () => {
    expect(layoutGroupCard(input({ transfers: transfers(2) }), LIGHT, fakeMeasure).rows.density).toBe('spacious')
    expect(layoutGroupCard(input({ transfers: transfers(9) }), LIGHT, fakeMeasure).rows.density).not.toBe('spacious')
  })

  it('gives a long name two lines, unless the payments need the room', () => {
    const name = 'Flat 4B — Indiranagar flatmates and the occasional weekend guest'
    const roomy = layoutGroupCard(input({ name }), LIGHT, fakeMeasure)
    expect(texts(roomy).filter((op) => op.style.size === 56)).toHaveLength(2)
    const crowded = layoutGroupCard(input({ name, transfers: transfers(10) }), LIGHT, fakeMeasure)
    const lines = texts(crowded).filter((op) => op.style.size === 56)
    expect(lines).toHaveLength(1)
    expect(lines[0]?.text.endsWith('…')).toBe(true)
  })

  it('copes with blank names, emoji and counts', () => {
    const scene = layoutGroupCard(
      input({ name: '  ', emoji: '', memberCount: 0, expenseCount: 1, transfers: [{ from: p(''), to: p(' '), amount: 500 }] }),
      LIGHT,
      fakeMeasure,
    )
    expectWellFormed(scene, LIGHT)
    expect(textValues(scene)).toEqual(expect.arrayContaining(['👥', '1 expense', 'Someone pays someone']))
    // The kind's label stands in for a blank name.
    expect(texts(scene).filter((op) => op.style.size === 56).map((op) => op.text)).toEqual(['Trip'])
    // Only the first emoji is drawn.
    expect(textValues(layoutGroupCard(input({ emoji: '🏖️🎉' }), LIGHT, fakeMeasure))).toContain('🏖️')
  })

  it('follows the theme and the accent', () => {
    const dark = layoutGroupCard(input(), { ...LIGHT, theme: 'dark', accent: 'mint' }, fakeMeasure)
    expectWellFormed(dark, LIGHT)
    expect(dark.ops[0]).toEqual({ kind: 'background', color: CARD_THEMES.dark.bg })
    expect(texts(dark).find((op) => op.text === 'Trip')?.color).toBe(CARD_ACCENTS.mint.accent)
    expect(dark.ops).toContainEqual(expect.objectContaining({ kind: 'rect', h: 12, fill: CARD_ACCENTS.mint.accent }))
    expect(texts(dark).find((op) => op.text === 'Goa 2026')?.color).toBe(CARD_THEMES.dark.ink)
  })

  it('leaves the footer off clean (Pro) cards', () => {
    const scene = layoutGroupCard(input(), { ...LIGHT, watermark: false }, fakeMeasure)
    expect(textValues(scene).some((t) => t.includes('Made with'))).toBe(false)
  })

  it('is deterministic', () => {
    expect(layoutGroupCard(input(), LIGHT, fakeMeasure)).toEqual(layoutGroupCard(input(), LIGHT, fakeMeasure))
  })
})

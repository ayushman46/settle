/**
 * The group summary card ("Goa 2026 — who pays whom"), in the same receipt language as the
 * expense card. Pure: text is measured through the injected `measure`.
 *
 *   ┌──────────────────────────────┐
 *   │ [🏖️] Trip                     │
 *   │      6 people · 14 expenses  │
 *   │ Goa 2026                     │   group name, up to 2 lines
 *   │ Total spent                  │
 *   │ ₹48,000                      │
 *   ├( - - - - - - - - - - - - - )─┤
 *   │ To settle up      3 payments │
 *   │ (S)→(R) Sam pays Riya   ₹800 │   the fewest payments that square everyone up
 *   └──────────────────────────────┘   …or "Everyone's settled up" with a tick
 */
import type { GroupKind, Minor } from '../../domain/types'
import { formatMoney } from '../../lib/money'
import { cleanText, firstName } from '../text'
import { ARROW_ICON_PATHS, CHECK_ICON_PATHS } from './icons'
import {
  AMOUNT_SIZES,
  BOTTOM_PAD,
  CARD_SIZE,
  CARD_W,
  CARD_X,
  cardTop,
  CW,
  DENSITIES,
  drawAvatar,
  drawBackdrop,
  drawFooter,
  drawHeadText,
  drawHero,
  drawMoreAvatar,
  drawTicket,
  heroGeometry,
  maxCardHeight,
  plural,
  STYLE,
  textOp,
  TILE,
  X0,
  type CardLayoutOptions,
  type CardOp,
  type CardScene,
  type RowDensity,
} from './parts'
import { cardTheme } from './theme'
import { fitFontSize, fitText, wrapText, type Measure, type TextStyle } from './textFit'

export interface GroupCardPerson {
  name: string
  /** Avatar palette index (`Friend.color`). */
  color: number
}

export interface GroupCardTransfer {
  from: GroupCardPerson
  to: GroupCardPerson
  amount: Minor
}

export interface GroupCardInput {
  name: string
  /** The group's emoji (one character); a people emoji when blank. */
  emoji: string
  kind: GroupKind
  currency: string
  /** Everything the group spent. */
  total: Minor
  expenseCount: number
  memberCount: number
  /** The fewest payments that square everyone up (engine `simplifyDebts`), largest first. */
  transfers: GroupCardTransfer[]
}

export const GROUP_KIND_LABELS: Readonly<Record<GroupKind, string>> = {
  trip: 'Trip',
  home: 'Home',
  couple: 'Couple',
  event: 'Event',
  other: 'Group',
}

const FALLBACK_EMOJI = '👥'

interface RowMetrics {
  height: number
  avatar: number
  name: TextStyle
  amount: TextStyle
}

const ROWS: Readonly<Record<RowDensity, RowMetrics>> = {
  spacious: { height: 104, avatar: 60, name: { size: 36, weight: 500 }, amount: { size: 38, weight: 600 } },
  regular: { height: 88, avatar: 52, name: { size: 32, weight: 500 }, amount: { size: 34, weight: 600 } },
  compact: { height: 72, avatar: 44, name: { size: 28, weight: 500 }, amount: { size: 30, weight: 600 } },
  tight: { height: 60, avatar: 38, name: { size: 26, weight: 500 }, amount: { size: 26, weight: 600 } },
}

/** "To settle up · 3 payments" above the rows. */
const SECTION_H = 56
/** The all-square message in place of rows. */
const SETTLED_H = 120

interface Row {
  from: GroupCardPerson
  to: GroupCardPerson
  amount: Minor
  /** "+N more payments" summary row. */
  more?: number
}

/** "Riya Kapoor pays Sam", first names when that's too wide, cut with "…" as a last resort. */
function payLine(row: Row, width: number, style: TextStyle, measure: Measure): string {
  const from = cleanText(row.from.name, 40) || 'Someone'
  const to = cleanText(row.to.name, 40) || 'someone'
  const full = `${from} pays ${to}`
  if (measure(full, style) <= width) return full
  return fitText(`${firstName(from)} pays ${firstName(to)}`, width, style, measure)
}

export function layoutGroupCard(input: GroupCardInput, opts: CardLayoutOptions, measure: Measure): CardScene {
  const theme = cardTheme(opts.theme, opts.accent)
  const money = (minor: Minor) => formatMoney(minor, input.currency, { trimZeros: true })
  const ops: CardOp[] = []
  const text = (op: Parameters<typeof textOp>[0]) => {
    ops.push(textOp(op))
  }

  const transfers = input.transfers.filter((t) => t.amount > 0)
  const title = cleanText(input.name, 120) || GROUP_KIND_LABELS[input.kind] || 'Group'
  const amountText = money(input.total)
  const amountSize = fitFontSize(amountText, CW, AMOUNT_SIZES, STYLE.amount, measure)
  const amountStyle = STYLE.amount(amountSize)
  const maxCardH = maxCardHeight(opts.watermark)
  const roomForRows = (lines: number) => maxCardH - heroGeometry(lines, amountSize).bodyTop - SECTION_H - BOTTOM_PAD
  const fitRows = (room: number, density: RowDensity) => Math.max(1, Math.floor(room / ROWS[density].height))

  // A long name gets two lines, unless that would push payments into "+N more".
  let titleLines = wrapText(title, CW, 2, STYLE.title, measure)
  if (titleLines.length > 1 && transfers.length > fitRows(roomForRows(titleLines.length), 'tight')) {
    titleLines = wrapText(title, CW, 1, STYLE.title, measure)
  }
  const hero = heroGeometry(titleLines.length, amountSize)
  const room = roomForRows(titleLines.length)

  /* ---- fit the payments ---- */
  const density: RowDensity = DENSITIES.find((d) => transfers.length * ROWS[d].height <= room) ?? 'tight'
  const fit = fitRows(room, density)
  const shown = transfers.length > fit ? fit - 1 : transfers.length
  const rows: Row[] = transfers.slice(0, shown)
  const hidden = transfers.slice(shown)
  if (hidden.length > 0) {
    rows.push({ from: { name: '', color: 0 }, to: { name: '', color: 0 }, amount: hidden.reduce((sum, t) => sum + t.amount, 0), more: hidden.length })
  }
  const m = ROWS[density]
  const bodyH = rows.length > 0 ? SECTION_H + rows.length * m.height : SETTLED_H
  const cardH = hero.bodyTop + bodyH + BOTTOM_PAD
  const cardY = cardTop(cardH, opts.watermark)
  const top = (rel: number) => cardY + rel

  /* ---- the card ---- */
  drawBackdrop(ops, theme, theme.accentInk, theme.categoryGlow)
  drawTicket(ops, theme, cardY, cardH, top(hero.dividerY))

  /* ---- header: emoji tile, kind, counts ---- */
  ops.push({ kind: 'rect', x: X0, y: top(hero.tileY), w: TILE, h: TILE, radius: 28, fill: theme.surface2 })
  const emoji = cleanText(input.emoji, 1, 16) || FALLBACK_EMOJI
  text({ text: emoji, x: X0 + TILE / 2, y: top(hero.tileY) + TILE / 2 + 2, style: { size: 48, weight: 400 }, color: theme.ink, align: 'center', baseline: 'middle', maxWidth: TILE })
  const counts = [
    input.memberCount > 0 ? plural(input.memberCount, 'person', 'people') : null,
    plural(Math.max(0, input.expenseCount), 'expense', 'expenses'),
  ]
    .filter(Boolean)
    .join(' · ')
  drawHeadText(ops, top(hero.tileY), { text: GROUP_KIND_LABELS[input.kind] ?? 'Group', color: theme.accentInk }, { text: counts, color: theme.ink2 }, measure)

  /* ---- name, "Total spent", total, tear ---- */
  drawHero(ops, theme, cardY, hero, { titleLines, subtitle: 'Total spent', amount: amountText, amountStyle }, measure)

  const bodyTop = top(hero.bodyTop)
  if (rows.length === 0) {
    /* ---- everyone's square ---- */
    const cy = bodyTop + SETTLED_H / 2 - 8
    const r = 28
    ops.push({ kind: 'circle', x: X0 + r, y: cy, r, fill: theme.positive })
    ops.push({ kind: 'icon', paths: CHECK_ICON_PATHS, x: X0 + r - 17, y: cy - 17, size: 34, color: theme.onPositive, lineWidth: 3 })
    const textX = X0 + 2 * r + 24
    const textW = CW - 2 * r - 24
    const [headline, detail] = input.expenseCount > 0 ? ["Everyone's settled up", 'No payments needed'] : ['Nothing to settle yet', 'No expenses so far']
    text({ text: fitText(headline, textW, STYLE.strong, measure), x: textX, y: cy - 6, style: STYLE.strong, color: theme.positive, align: 'left', maxWidth: textW })
    text({ text: fitText(detail, textW, STYLE.muted, measure), x: textX, y: cy + 30, style: STYLE.muted, color: theme.ink2, align: 'left', maxWidth: textW })
  } else {
    /* ---- to settle up ---- */
    const labelY = bodyTop + 30
    const count = plural(transfers.length, 'payment', 'payments')
    const countW = measure(count, STYLE.muted)
    text({ text: count, x: X0 + CW, y: labelY, style: STYLE.muted, color: theme.ink2, align: 'right', maxWidth: CW })
    text({ text: fitText('To settle up', CW - countW - 24, STYLE.strong, measure), x: X0, y: labelY, style: STYLE.strong, color: theme.ink, align: 'left', maxWidth: CW - countW - 24 })

    rows.forEach((row, i) => {
      const rowTop = bodyTop + SECTION_H + i * m.height
      const cy = rowTop + m.height / 2
      // Payer → payee: two avatars with an arrow between them.
      const a = m.avatar
      const arrow = Math.round(a * 0.42)
      const fromX = X0 + a / 2
      const toX = fromX + a + arrow + 8
      const textX = toX + a / 2 + 24
      if (row.more !== undefined) {
        drawMoreAvatar(ops, theme, fromX, cy, a, row.more)
      } else {
        drawAvatar(ops, fromX, cy, a, row.from.name, row.from.color)
        ops.push({ kind: 'icon', paths: ARROW_ICON_PATHS, x: fromX + a / 2 + 4, y: cy - arrow / 2, size: arrow, color: theme.ink2, lineWidth: 2.5 })
        drawAvatar(ops, toX, cy, a, row.to.name, row.to.color)
      }
      const amountLabel = money(row.amount)
      const amountW = measure(amountLabel, m.amount)
      const baseline = cy + Math.round(m.name.size * 0.35)
      text({ text: amountLabel, x: X0 + CW, y: cy + Math.round(m.amount.size * 0.35), style: m.amount, color: theme.ink, align: 'right', maxWidth: CW / 2 })
      const lineW = Math.max(0, X0 + CW - amountW - 28 - textX)
      const label = row.more !== undefined ? fitText(plural(row.more, 'more payment', 'more payments'), lineW, m.name, measure) : payLine(row, lineW, m.name, measure)
      if (label) text({ text: label, x: textX, y: baseline, style: m.name, color: row.more !== undefined ? theme.ink2 : theme.ink, align: 'left', maxWidth: lineW })
      if (i < rows.length - 1) {
        ops.push({ kind: 'line', x1: textX, y1: rowTop + m.height, x2: X0 + CW, y2: rowTop + m.height, color: theme.line, width: 2 })
      }
    })
  }

  if (opts.watermark) drawFooter(ops, theme, opts.siteLabel, measure)

  return {
    width: CARD_SIZE.width,
    height: CARD_SIZE.height,
    ops,
    card: { x: CARD_X, y: cardY, w: CARD_W, h: cardH },
    rows: { density, shown, hidden: hidden.length },
  }
}

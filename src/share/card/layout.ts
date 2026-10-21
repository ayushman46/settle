/**
 * The expense share card's layout, as a list of drawing operations. Pure (text is measured
 * through the injected `measure`), so the geometry is tested without a canvas; `paint.ts` draws it.
 *
 *   ┌──────────────────────────────┐   1080 × 1350 (4:5, the size chat apps show uncropped)
 *   │ [icon] Food & drinks         │
 *   │        18 Oct 2026           │
 *   │ Dinner at Toit               │   title, up to 2 lines
 *   │ Paid by Riya · split 4 ways  │
 *   │ ₹2,766                       │   shrink-to-fit total, accent underline
 *   ├( - - - - - - - - - - - - - )─┤   ticket tear with notches
 *   │ (RS) Riya    Paid the bill  ₹│   people (four densities, "+N more" when they don't fit)
 *   │ ████████░░░░  ₹1,382 of …    │   collected so far
 *   └──────────────────────────────┘
 *        ✓ Made with Settle · …        footer, only with the watermark
 */
import type { CategoryId, Minor } from '../../domain/types'
import { formatBillDate } from '../../lib/format'
import { formatMoney } from '../../lib/money'
import { categoryLabel } from '../categories'
import { cleanText } from '../text'
import { CATEGORY_ICON_PATHS, CHECK_ICON_PATHS, ICON_STROKE } from './icons'
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
import { CATEGORY_COLORS, cardTheme } from './theme'
import { fitFontSize, fitText, wrapText, type Measure, type TextStyle } from './textFit'

export { AMOUNT_DESCENT, CARD_SIZE, type CardOp, type CardScene, type RowDensity } from './parts'

export interface ShareCardPerson {
  name: string
  /** Avatar palette index (`Friend.color`). */
  color: number
  amount: Minor
  paid: boolean
  isPayer: boolean
}

export interface ShareCardInput {
  title: string
  category: CategoryId
  currency: string
  /** YYYY-MM-DD. */
  date: string
  total: Minor
  payerName: string
  people: ShareCardPerson[]
}

export type ShareCardLayoutOptions = CardLayoutOptions

/* ------------------------------------------------------------------ metrics */

interface RowMetrics {
  height: number
  avatar: number
  name: TextStyle
  /** Null: no status line (paid/payer still show on the avatar). */
  status: TextStyle | null
  amount: TextStyle
  /** Offsets from the row's vertical centre. */
  nameDy: number
  statusDy: number
  amountDy: number
}

const ROWS: Readonly<Record<RowDensity, RowMetrics>> = {
  spacious: {
    height: 108,
    avatar: 72,
    name: { size: 38, weight: 500 },
    status: { size: 26, weight: 400 },
    amount: { size: 40, weight: 600 },
    nameDy: -2,
    statusDy: 33,
    amountDy: 13,
  },
  regular: {
    height: 92,
    avatar: 64,
    name: { size: 34, weight: 500 },
    status: { size: 24, weight: 400 },
    amount: { size: 36, weight: 600 },
    nameDy: -2,
    statusDy: 30,
    amountDy: 12,
  },
  compact: {
    height: 72,
    avatar: 52,
    name: { size: 30, weight: 500 },
    status: { size: 21, weight: 400 },
    amount: { size: 32, weight: 600 },
    nameDy: -2,
    statusDy: 25,
    amountDy: 11,
  },
  tight: {
    height: 60,
    avatar: 44,
    name: { size: 28, weight: 500 },
    status: null,
    amount: { size: 28, weight: 600 },
    nameDy: 10,
    statusDy: 0,
    amountDy: 10,
  },
}

/** Height of the collected-so-far block (gap + bar + gap + text). */
const PROGRESS_H = 32 + 14 + 20 + 30

/* ------------------------------------------------------------------ helpers */

interface Row {
  name: string
  color: number
  amount: Minor
  paid: boolean
  isPayer: boolean
  /** "+N more" summary row. */
  more?: number
}

/** Payer first (they're who everyone pays), then everyone else in their original order. */
function orderPeople(people: readonly ShareCardPerson[]): ShareCardPerson[] {
  const payer = people.filter((p) => p.isPayer)
  return [...payer, ...people.filter((p) => !p.isPayer)]
}

/* ------------------------------------------------------------------ layout */

export function layoutShareCard(input: ShareCardInput, opts: ShareCardLayoutOptions, measure: Measure): CardScene {
  const theme = cardTheme(opts.theme, opts.accent)
  const cat = CATEGORY_COLORS[opts.theme][input.category] ?? CATEGORY_COLORS[opts.theme].other
  const money = (minor: Minor) => formatMoney(minor, input.currency, { trimZeros: true })
  const ops: CardOp[] = []
  const text = (op: Parameters<typeof textOp>[0]) => {
    ops.push(textOp(op))
  }

  const people = orderPeople(input.people)
  const debtors = people.filter((p) => !p.isPayer && p.amount > 0)
  const owed = debtors.reduce((sum, p) => sum + p.amount, 0)
  const collected = debtors.filter((p) => p.paid).reduce((sum, p) => sum + p.amount, 0)
  const paidCount = debtors.filter((p) => p.paid).length

  /* ---- measure the fixed blocks (y relative to the card's top) ---- */
  const title = cleanText(input.title, 120) || categoryLabel(input.category)
  const amountText = money(input.total)
  const amountSize = fitFontSize(amountText, CW, AMOUNT_SIZES, STYLE.amount, measure)
  const amountStyle = STYLE.amount(amountSize)
  const maxCardH = maxCardHeight(opts.watermark)
  const progressH = debtors.length > 0 ? PROGRESS_H : 0
  const roomForRows = (lines: number) => maxCardH - heroGeometry(lines, amountSize).bodyTop - progressH - BOTTOM_PAD
  /** Rows of the given density that fit, keeping a slot for "+N more" when needed. */
  const fitRows = (room: number, density: RowDensity) => Math.max(1, Math.floor(room / ROWS[density].height))

  // A long title gets two lines, unless that would push people into "+N more".
  let titleLines = wrapText(title, CW, 2, STYLE.title, measure)
  if (titleLines.length > 1 && people.length > fitRows(roomForRows(titleLines.length), 'tight')) {
    titleLines = wrapText(title, CW, 1, STYLE.title, measure)
  }
  const hero = heroGeometry(titleLines.length, amountSize)
  const room = roomForRows(titleLines.length)

  /* ---- fit the people ---- */
  const density: RowDensity = DENSITIES.find((d) => people.length * ROWS[d].height <= room) ?? 'tight'
  const fit = fitRows(room, density)
  const shown = people.length > fit ? fit - 1 : people.length
  const rows: Row[] = people.slice(0, shown)
  const hiddenPeople = people.slice(shown)
  if (hiddenPeople.length > 0) {
    rows.push({
      name: `${plural(hiddenPeople.length, 'more person', 'more people')}`,
      color: 0,
      amount: hiddenPeople.reduce((sum, p) => sum + p.amount, 0),
      paid: false,
      isPayer: false,
      more: hiddenPeople.length,
    })
  }
  const m = ROWS[density]
  const rowsH = rows.length * m.height
  const cardH = hero.bodyTop + rowsH + progressH + BOTTOM_PAD
  const cardY = cardTop(cardH, opts.watermark)
  const top = (rel: number) => cardY + rel

  /* ---- the card ---- */
  drawBackdrop(ops, theme, cat.ink, theme.categoryGlow)
  drawTicket(ops, theme, cardY, cardH, top(hero.dividerY))

  /* ---- header: category tile, label, date ---- */
  ops.push({ kind: 'rect', x: X0, y: top(hero.tileY), w: TILE, h: TILE, radius: 28, fill: cat.bg })
  const iconSize = 44
  ops.push({
    kind: 'icon',
    paths: CATEGORY_ICON_PATHS[input.category] ?? CATEGORY_ICON_PATHS.other,
    x: X0 + (TILE - iconSize) / 2,
    y: top(hero.tileY) + (TILE - iconSize) / 2,
    size: iconSize,
    color: cat.ink,
    lineWidth: ICON_STROKE,
  })
  const date = formatBillDate(input.date)
  drawHeadText(ops, top(hero.tileY), { text: categoryLabel(input.category), color: cat.ink }, date ? { text: date, color: theme.ink2 } : null, measure)

  /* ---- title, subtitle, total, tear ---- */
  const payer = cleanText(input.payerName, 40)
  const ways = input.people.length
  const subtitle = [payer ? `Paid by ${payer}` : null, ways > 0 ? `split ${plural(ways, 'way', 'ways')}` : null].filter(Boolean).join(' · ')
  drawHero(ops, theme, cardY, hero, { titleLines, subtitle, amount: amountText, amountStyle }, measure)

  /* ---- people ---- */
  rows.forEach((row, i) => {
    const rowTop = top(hero.bodyTop) + i * m.height
    const cy = rowTop + m.height / 2
    const ax = X0 + m.avatar / 2
    const nameX = X0 + m.avatar + 24

    if (row.more !== undefined) {
      drawMoreAvatar(ops, theme, ax, cy, m.avatar, row.more)
    } else {
      if (row.isPayer) ops.push({ kind: 'circle', x: ax, y: cy, r: m.avatar / 2 + 6, fill: null, stroke: theme.accent, lineWidth: 5 })
      drawAvatar(ops, ax, cy, m.avatar, row.name, row.color)
      if (row.paid && !row.isPayer) {
        const br = Math.round(m.avatar * 0.2)
        const bx = ax + m.avatar * 0.36
        const by = cy + m.avatar * 0.36
        ops.push({ kind: 'circle', x: bx, y: by, r: br + 4, fill: theme.surface })
        ops.push({ kind: 'circle', x: bx, y: by, r: br, fill: theme.positive })
        const checkSize = br * 1.3
        ops.push({ kind: 'icon', paths: CHECK_ICON_PATHS, x: bx - checkSize / 2, y: by - checkSize / 2, size: checkSize, color: theme.onPositive, lineWidth: 3.5 })
      }
    }

    const amountLabel = money(row.amount)
    const amountW = measure(amountLabel, m.amount)
    text({ text: amountLabel, x: X0 + CW, y: cy + m.amountDy, style: m.amount, color: theme.ink, align: 'right', maxWidth: CW / 2 })

    const nameW = Math.max(0, X0 + CW - amountW - 28 - nameX)
    text({ text: fitText(cleanText(row.name, 60) || '?', nameW, m.name, measure), x: nameX, y: cy + m.nameDy, style: m.name, color: theme.ink, align: 'left', maxWidth: nameW })
    const status = row.more !== undefined ? null : row.isPayer ? 'Paid the bill' : row.paid ? 'Paid back' : row.amount > 0 ? 'Yet to pay' : 'Nothing to pay'
    if (status && m.status) {
      text({
        text: fitText(status, nameW, m.status, measure),
        x: nameX,
        y: cy + m.statusDy,
        style: m.status,
        color: row.paid && !row.isPayer ? theme.positive : theme.ink2,
        align: 'left',
        maxWidth: nameW,
      })
    }
    if (i < rows.length - 1) {
      ops.push({ kind: 'line', x1: nameX, y1: rowTop + m.height, x2: X0 + CW, y2: rowTop + m.height, color: theme.line, width: 2 })
    }
  })

  /* ---- collected so far ---- */
  if (debtors.length > 0) {
    const barY = top(hero.bodyTop) + rowsH + 32
    const ratio = owed > 0 ? Math.min(1, collected / owed) : 0
    ops.push({ kind: 'rect', x: X0, y: barY, w: CW, h: 14, radius: 7, fill: theme.surface2 })
    if (ratio > 0) {
      const fill: CardOp = { kind: 'rect', x: X0, y: barY, w: Math.max(14, Math.round(CW * ratio)), h: 14, radius: 7, fill: theme.accent }
      ops.push(theme.accentEdge ? { ...fill, stroke: theme.accentEdge } : fill)
    }
    const lineY = barY + 14 + 20 + 26
    const right = `${paidCount} of ${debtors.length} paid`
    const rightW = measure(right, STYLE.muted)
    text({ text: right, x: X0 + CW, y: lineY, style: STYLE.muted, color: theme.ink2, align: 'right', maxWidth: CW })
    const settled = paidCount === debtors.length
    const leftW = CW - rightW - 24
    const left = settled ? 'All settled up' : `${money(collected)} of ${money(owed)} collected`
    if (settled) {
      ops.push({ kind: 'icon', paths: CHECK_ICON_PATHS, x: X0, y: lineY - 26, size: 30, color: theme.positive, lineWidth: 3 })
      text({ text: fitText(left, leftW - 40, STYLE.strong, measure), x: X0 + 40, y: lineY, style: STYLE.strong, color: theme.positive, align: 'left', maxWidth: leftW - 40 })
    } else {
      text({ text: fitText(left, leftW, STYLE.strong, measure), x: X0, y: lineY, style: STYLE.strong, color: theme.ink, align: 'left', maxWidth: leftW })
    }
  }

  if (opts.watermark) drawFooter(ops, theme, opts.siteLabel, measure)

  return {
    width: CARD_SIZE.width,
    height: CARD_SIZE.height,
    ops,
    card: { x: CARD_X, y: cardY, w: CARD_W, h: cardH },
    rows: { density, shown, hidden: hiddenPeople.length },
  }
}

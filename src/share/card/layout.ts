/**
 * The share card's layout, as a list of drawing operations. Pure (text is measured through the
 * injected `measure`), so the geometry is tested without a canvas; `paint.ts` draws the result.
 *
 *   ┌──────────────────────────────┐   1080 × 1350 (4:5, the size chat apps show uncropped)
 *   │ [icon] Food & drinks         │
 *   │        18 Oct 2026           │
 *   │ Dinner at Toit               │   title, up to 2 lines
 *   │ Paid by Riya · split 4 ways  │
 *   │ ₹2,766                       │   shrink-to-fit total, lime underline
 *   ├( - - - - - - - - - - - - - )─┤   ticket tear with notches
 *   │ (RS) Riya    Paid the bill  ₹│   people (two densities, "+N more" when they don't fit)
 *   │ ████████░░░░  ₹1,382 of …    │   collected so far
 *   └──────────────────────────────┘
 *        ✓ Made with Settle · …        footer, only with the watermark
 */
import { BRAND, type CategoryId, type Minor } from '../../domain/types'
import { formatBillDate } from '../../lib/format'
import { formatMoney } from '../../lib/money'
import { initials } from '../../lib/people'
import { categoryLabel } from '../categories'
import { cleanText } from '../text'
import { CATEGORY_ICON_PATHS, CHECK_ICON_PATHS, ICON_STROKE } from './icons'
import { avatarColor, CARD_THEMES, CATEGORY_COLORS, type CardThemeName } from './theme'
import { fitFontSize, fitText, wrapText, type Measure, type TextStyle } from './textFit'

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

export interface ShareCardLayoutOptions {
  /** Adds the "Made with Settle" footer (free plan). */
  watermark: boolean
  theme: CardThemeName
  /** Footer text after the brand: the site's host, or the tagline. */
  siteLabel: string
}

export type CardOp =
  | { kind: 'background'; color: string }
  | { kind: 'glow'; x: number; y: number; r: number; color: string; alpha: number }
  | {
      kind: 'ticket'
      x: number
      y: number
      w: number
      h: number
      radius: number
      notchY: number
      notchR: number
      fill: string
      stroke: string
      shadow: { color: string; blur: number; offsetY: number } | null
    }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; radius: number; fill: string; stroke?: string }
  | { kind: 'circle'; x: number; y: number; r: number; fill: string | null; stroke?: string; lineWidth?: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width: number; dash?: [number, number] }
  | {
      kind: 'text'
      text: string
      x: number
      /** Baseline (or middle, see `baseline`). */
      y: number
      style: TextStyle
      color: string
      align: 'left' | 'right' | 'center'
      baseline: 'alphabetic' | 'middle'
      /** The width the text was fitted to (for checks; not passed to fillText). */
      maxWidth: number
    }
  | { kind: 'icon'; paths: readonly string[]; x: number; y: number; size: number; color: string; lineWidth: number }

export type RowDensity = 'spacious' | 'regular' | 'compact' | 'tight'

export interface CardScene {
  width: number
  height: number
  ops: CardOp[]
  /** Card bounds and what made it in — for tests and callers that want to know. */
  card: { x: number; y: number; w: number; h: number }
  rows: { density: RowDensity; shown: number; hidden: number }
}

export const CARD_SIZE = { width: 1080, height: 1350 } as const

/* ------------------------------------------------------------------ metrics */

const MARGIN = 72
const CARD_X = MARGIN
const CARD_W = CARD_SIZE.width - 2 * MARGIN
const PAD = 56
const X0 = CARD_X + PAD
const CW = CARD_W - 2 * PAD
const RADIUS = 48
const NOTCH_R = 24
const FOOTER_H = 96
const BOTTOM_PAD = 56

const TILE = 88
const TITLE_LINE = 64
/** How far a comma reaches below the baseline, as a fraction of the font size (Geist). */
export const AMOUNT_DESCENT = 0.16
const STYLE = {
  category: { size: 30, weight: 600 },
  date: { size: 28, weight: 400 },
  title: { size: 56, weight: 600, tracking: -1 },
  subtitle: { size: 28, weight: 400 },
  amount: (size: number): TextStyle => ({ size, weight: 600, tracking: -Math.round(size * 0.025) }),
  progress: { size: 28, weight: 600 },
  progressMuted: { size: 28, weight: 400 },
  footerBrand: { size: 28, weight: 600 },
  footerSite: { size: 28, weight: 400 },
} as const satisfies Record<string, TextStyle | ((size: number) => TextStyle)>

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

/** Densest first fit wins; past the tightest, the rest go into a "+N more" row. */
const DENSITIES: readonly RowDensity[] = ['spacious', 'regular', 'compact', 'tight']

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

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/* ------------------------------------------------------------------ layout */

export function layoutShareCard(input: ShareCardInput, opts: ShareCardLayoutOptions, measure: Measure): CardScene {
  const theme = CARD_THEMES[opts.theme]
  const cat = CATEGORY_COLORS[opts.theme][input.category] ?? CATEGORY_COLORS[opts.theme].other
  const money = (minor: Minor) => formatMoney(minor, input.currency, { trimZeros: true })
  const ops: CardOp[] = []
  const text = (op: Omit<Extract<CardOp, { kind: 'text' }>, 'kind' | 'baseline'> & { baseline?: 'alphabetic' | 'middle' }) => {
    ops.push({ kind: 'text', baseline: 'alphabetic', ...op })
  }

  const people = orderPeople(input.people)
  const debtors = people.filter((p) => !p.isPayer && p.amount > 0)
  const owed = debtors.reduce((sum, p) => sum + p.amount, 0)
  const collected = debtors.filter((p) => p.paid).reduce((sum, p) => sum + p.amount, 0)
  const paidCount = debtors.filter((p) => p.paid).length

  /* ---- measure the fixed blocks (y relative to the card's top) ---- */
  const title = cleanText(input.title, 120) || categoryLabel(input.category)
  const amountText = money(input.total)
  const amountSize = fitFontSize(amountText, CW, { max: 112, min: 64, step: 4 }, STYLE.amount, measure)
  const amountStyle = STYLE.amount(amountSize)
  const footer = opts.watermark ? FOOTER_H : 0
  const maxCardH = CARD_SIZE.height - 2 * MARGIN - footer
  const progressH = debtors.length > 0 ? PROGRESS_H : 0

  const header = (titleLines: string[]) => {
    const tileY = PAD
    const titleTop = tileY + TILE + 36
    const subtitleY = titleTop + titleLines.length * TITLE_LINE + 32
    const amountY = subtitleY + 28 + Math.round(amountSize * 0.84)
    // Below the comma's tail (Geist descends 0.16em under the baseline), with clear air.
    const underlineY = amountY + Math.round(amountSize * AMOUNT_DESCENT) + 14
    const dividerY = underlineY + 12 + 34
    const peopleTop = dividerY + 32
    return { titleLines, tileY, titleTop, subtitleY, amountY, underlineY, dividerY, peopleTop, roomForRows: maxCardH - peopleTop - progressH - BOTTOM_PAD }
  }
  /** Rows of the given density that fit, keeping a slot for "+N more" when needed. */
  const fitRows = (room: number, density: RowDensity) => Math.max(1, Math.floor(room / ROWS[density].height))

  // A long title gets two lines, unless that would push people into "+N more".
  let geo = header(wrapText(title, CW, 2, STYLE.title, measure))
  if (geo.titleLines.length > 1 && people.length > fitRows(geo.roomForRows, 'tight')) {
    geo = header(wrapText(title, CW, 1, STYLE.title, measure))
  }
  const { titleLines, tileY, titleTop, subtitleY, amountY, underlineY, dividerY, peopleTop, roomForRows } = geo

  /* ---- fit the people ---- */
  const density: RowDensity = DENSITIES.find((d) => people.length * ROWS[d].height <= roomForRows) ?? 'tight'
  const fit = fitRows(roomForRows, density)
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
  const metrics = ROWS[density]
  const rowsH = rows.length * metrics.height
  const cardH = peopleTop + rowsH + progressH + BOTTOM_PAD
  const cardY = MARGIN + Math.max(0, Math.round((maxCardH - cardH) / 2))
  const top = (rel: number) => cardY + rel

  /* ---- background ---- */
  ops.push({ kind: 'background', color: theme.bg })
  ops.push({ kind: 'glow', x: CARD_SIZE.width - 40, y: 40, r: 640, color: theme.accent, alpha: theme.glow })
  ops.push({ kind: 'glow', x: 40, y: CARD_SIZE.height - 60, r: 560, color: cat.ink, alpha: theme.categoryGlow })

  /* ---- the card ---- */
  ops.push({
    kind: 'ticket',
    x: CARD_X,
    y: cardY,
    w: CARD_W,
    h: cardH,
    radius: RADIUS,
    notchY: top(dividerY),
    notchR: NOTCH_R,
    fill: theme.surface,
    stroke: theme.line,
    shadow: theme.shadow,
  })

  /* ---- header: category tile, label, date ---- */
  ops.push({ kind: 'rect', x: X0, y: top(tileY), w: TILE, h: TILE, radius: 28, fill: cat.bg })
  const iconSize = 44
  ops.push({
    kind: 'icon',
    paths: CATEGORY_ICON_PATHS[input.category] ?? CATEGORY_ICON_PATHS.other,
    x: X0 + (TILE - iconSize) / 2,
    y: top(tileY) + (TILE - iconSize) / 2,
    size: iconSize,
    color: cat.ink,
    lineWidth: ICON_STROKE,
  })
  const headX = X0 + TILE + 28
  const headW = CW - TILE - 28
  const date = formatBillDate(input.date)
  const labelY = date ? top(tileY) + 38 : top(tileY) + TILE / 2 + 11
  text({ text: fitText(categoryLabel(input.category), headW, STYLE.category, measure), x: headX, y: labelY, style: STYLE.category, color: cat.ink, align: 'left', maxWidth: headW })
  if (date) {
    text({ text: fitText(date, headW, STYLE.date, measure), x: headX, y: top(tileY) + 76, style: STYLE.date, color: theme.ink2, align: 'left', maxWidth: headW })
  }

  /* ---- title, subtitle, total ---- */
  titleLines.forEach((line, i) => {
    text({ text: line, x: X0, y: top(titleTop) + 50 + i * TITLE_LINE, style: STYLE.title, color: theme.ink, align: 'left', maxWidth: CW })
  })
  const payer = cleanText(input.payerName, 40)
  const ways = input.people.length
  const subtitle = [payer ? `Paid by ${payer}` : null, ways > 0 ? `split ${plural(ways, 'way', 'ways')}` : null].filter(Boolean).join(' · ')
  if (subtitle) {
    text({ text: fitText(subtitle, CW, STYLE.subtitle, measure), x: X0, y: top(subtitleY), style: STYLE.subtitle, color: theme.ink2, align: 'left', maxWidth: CW })
  }
  const amountFitted = fitText(amountText, CW, amountStyle, measure)
  text({ text: amountFitted, x: X0, y: top(amountY), style: amountStyle, color: theme.ink, align: 'left', maxWidth: CW })
  const underlineW = Math.min(CW, Math.max(96, measure(amountFitted, amountStyle) * 0.42))
  ops.push({ kind: 'rect', x: X0, y: top(underlineY), w: underlineW, h: 12, radius: 6, fill: theme.accent })

  /* ---- tear line ---- */
  ops.push({
    kind: 'line',
    x1: CARD_X + NOTCH_R + 20,
    y1: top(dividerY),
    x2: CARD_X + CARD_W - NOTCH_R - 20,
    y2: top(dividerY),
    color: theme.lineStrong,
    width: 3,
    dash: [12, 12],
  })

  /* ---- people ---- */
  const m = metrics
  rows.forEach((row, i) => {
    const rowTop = top(peopleTop) + i * m.height
    const cy = rowTop + m.height / 2
    const ax = X0 + m.avatar / 2
    const nameX = X0 + m.avatar + 24
    const avatar = avatarColor(row.color)

    if (row.more !== undefined) {
      ops.push({ kind: 'circle', x: ax, y: cy, r: m.avatar / 2, fill: theme.surface2 })
      const label = `+${row.more}`
      const labelStyle: TextStyle = { size: Math.round(m.avatar * 0.36), weight: 600 }
      text({ text: label, x: ax, y: cy, style: labelStyle, color: theme.ink2, align: 'center', baseline: 'middle', maxWidth: m.avatar })
    } else {
      if (row.isPayer) ops.push({ kind: 'circle', x: ax, y: cy, r: m.avatar / 2 + 6, fill: null, stroke: theme.accent, lineWidth: 5 })
      ops.push({ kind: 'circle', x: ax, y: cy, r: m.avatar / 2, fill: avatar.bg })
      const initialsStyle: TextStyle = { size: Math.round(m.avatar * 0.38), weight: 600 }
      text({ text: initials(row.name), x: ax, y: cy + 1, style: initialsStyle, color: avatar.ink, align: 'center', baseline: 'middle', maxWidth: m.avatar })
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
    const barY = top(peopleTop) + rowsH + 32
    const ratio = owed > 0 ? Math.min(1, collected / owed) : 0
    ops.push({ kind: 'rect', x: X0, y: barY, w: CW, h: 14, radius: 7, fill: theme.surface2 })
    if (ratio > 0) {
      const fill: CardOp = { kind: 'rect', x: X0, y: barY, w: Math.max(14, Math.round(CW * ratio)), h: 14, radius: 7, fill: theme.accent }
      ops.push(theme.accentEdge ? { ...fill, stroke: theme.accentEdge } : fill)
    }
    const lineY = barY + 14 + 20 + 26
    const right = `${paidCount} of ${debtors.length} paid`
    const rightW = measure(right, STYLE.progressMuted)
    text({ text: right, x: X0 + CW, y: lineY, style: STYLE.progressMuted, color: theme.ink2, align: 'right', maxWidth: CW })
    const settled = paidCount === debtors.length
    const leftW = CW - rightW - 24
    const left = settled ? 'All settled up' : `${money(collected)} of ${money(owed)} collected`
    if (settled) {
      ops.push({ kind: 'icon', paths: CHECK_ICON_PATHS, x: X0, y: lineY - 26, size: 30, color: theme.positive, lineWidth: 3 })
      text({ text: fitText(left, leftW - 40, STYLE.progress, measure), x: X0 + 40, y: lineY, style: STYLE.progress, color: theme.positive, align: 'left', maxWidth: leftW - 40 })
    } else {
      text({ text: fitText(left, leftW, STYLE.progress, measure), x: X0, y: lineY, style: STYLE.progress, color: theme.ink, align: 'left', maxWidth: leftW })
    }
  }

  /* ---- footer ---- */
  if (opts.watermark) {
    const brand = `Made with ${BRAND.name}`
    const mark = 40
    const gap = 14
    const brandW = measure(brand, STYLE.footerBrand)
    const sep = ' · '
    const maxSiteW = CARD_SIZE.width - 2 * MARGIN - mark - gap - brandW - measure(sep, STYLE.footerSite)
    const site = fitText(cleanText(opts.siteLabel, 80), maxSiteW, STYLE.footerSite, measure)
    const siteText = site ? `${sep}${site}` : ''
    const siteW = siteText ? measure(siteText, STYLE.footerSite) : 0
    const total = mark + gap + brandW + siteW
    const left = (CARD_SIZE.width - total) / 2
    const baseline = CARD_SIZE.height - MARGIN - 18
    ops.push({ kind: 'rect', x: left, y: baseline - 30, w: mark, h: mark, radius: 12, fill: theme.accent })
    ops.push({ kind: 'icon', paths: CHECK_ICON_PATHS, x: left + 8, y: baseline - 22, size: 24, color: theme.onAccent, lineWidth: 3 })
    text({ text: brand, x: left + mark + gap, y: baseline, style: STYLE.footerBrand, color: theme.ink, align: 'left', maxWidth: brandW })
    if (siteText) text({ text: siteText, x: left + mark + gap + brandW, y: baseline, style: STYLE.footerSite, color: theme.ink2, align: 'left', maxWidth: siteW })
  }

  return {
    width: CARD_SIZE.width,
    height: CARD_SIZE.height,
    ops,
    card: { x: CARD_X, y: cardY, w: CARD_W, h: cardH },
    rows: { density, shown, hidden: hiddenPeople.length },
  }
}


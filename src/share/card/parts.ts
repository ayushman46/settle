/**
 * What every share card is made of: the 1080×1350 frame, the ticket with its tear, the hero
 * (title, subtitle, big total), avatars and the "Made with Settle" footer — as pure drawing
 * operations, so each card's layout is tested without a canvas and `paint.ts` draws them all.
 */
import { BRAND, type AccentId } from '../../domain/types'
import { initials } from '../../lib/people'
import { cleanText } from '../text'
import { CHECK_ICON_PATHS } from './icons'
import { avatarColor, type CardTheme, type CardThemeName } from './theme'
import { fitText, type Measure, type TextStyle } from './textFit'

export const CARD_SIZE = { width: 1080, height: 1350 } as const

export interface CardLayoutOptions {
  /** Adds the "Made with Settle" footer (free plan). */
  watermark: boolean
  theme: CardThemeName
  /** Accent palette (Pro accent themes); lime by default. */
  accent?: AccentId
  /** Footer text after the brand: the site's host, or the tagline. */
  siteLabel: string
}

export type TextOp = {
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
  | TextOp
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

/* ------------------------------------------------------------------ metrics */

export const MARGIN = 72
export const CARD_X = MARGIN
export const CARD_W = CARD_SIZE.width - 2 * MARGIN
export const PAD = 56
/** Left edge and width of the card's content. */
export const X0 = CARD_X + PAD
export const CW = CARD_W - 2 * PAD
const RADIUS = 48
const NOTCH_R = 24
const FOOTER_H = 96
export const BOTTOM_PAD = 56

export const TILE = 88
const TITLE_LINE = 64
/** How far a comma reaches below the baseline, as a fraction of the font size (Geist). */
export const AMOUNT_DESCENT = 0.16
/** Densest first fit wins. */
export const DENSITIES: readonly RowDensity[] = ['spacious', 'regular', 'compact', 'tight']

export const STYLE = {
  /** The line beside the tile (category, group kind) and the one under it (date, counts). */
  headLabel: { size: 30, weight: 600 },
  headSub: { size: 28, weight: 400 },
  title: { size: 56, weight: 600, tracking: -1 },
  subtitle: { size: 28, weight: 400 },
  amount: (size: number): TextStyle => ({ size, weight: 600, tracking: -Math.round(size * 0.025) }),
  /** Section label inside the card ("To settle up"), and the bold/plain summary lines. */
  strong: { size: 28, weight: 600 },
  muted: { size: 28, weight: 400 },
  footerBrand: { size: 28, weight: 600 },
  footerSite: { size: 28, weight: 400 },
} as const satisfies Record<string, TextStyle | ((size: number) => TextStyle)>

export const AMOUNT_SIZES = { max: 112, min: 64, step: 4 } as const

/* ------------------------------------------------------------------ geometry */

/** Vertical positions of the hero blocks, relative to the card's top. */
export interface HeroGeometry {
  tileY: number
  titleTop: number
  subtitleY: number
  amountY: number
  underlineY: number
  /** The tear (and the notches). */
  dividerY: number
  /** Where the card's body (rows) starts. */
  bodyTop: number
}

export function heroGeometry(titleLines: number, amountSize: number): HeroGeometry {
  const tileY = PAD
  const titleTop = tileY + TILE + 36
  const subtitleY = titleTop + titleLines * TITLE_LINE + 32
  const amountY = subtitleY + 28 + Math.round(amountSize * 0.84)
  // Below the comma's tail (Geist descends 0.16em under the baseline), with clear air.
  const underlineY = amountY + Math.round(amountSize * AMOUNT_DESCENT) + 14
  const dividerY = underlineY + 12 + 34
  return { tileY, titleTop, subtitleY, amountY, underlineY, dividerY, bodyTop: dividerY + 32 }
}

/** The tallest the card may be: the canvas less its margins and, with the watermark, the footer. */
export function maxCardHeight(watermark: boolean): number {
  return CARD_SIZE.height - 2 * MARGIN - (watermark ? FOOTER_H : 0)
}

/** The card's top edge: centred in the room it has. */
export function cardTop(cardH: number, watermark: boolean): number {
  return MARGIN + Math.max(0, Math.round((maxCardHeight(watermark) - cardH) / 2))
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/* ------------------------------------------------------------------ drawing */

/** A text op on the alphabetic baseline unless told otherwise. */
export function textOp(op: Omit<TextOp, 'kind' | 'baseline'> & { baseline?: TextOp['baseline'] }): TextOp {
  return { kind: 'text', baseline: 'alphabetic', ...op }
}

/** The page behind the card: background, the accent glow top right, a tinted glow bottom left. */
export function drawBackdrop(ops: CardOp[], theme: CardTheme, tint: string, tintAlpha: number): void {
  ops.push({ kind: 'background', color: theme.bg })
  ops.push({ kind: 'glow', x: CARD_SIZE.width - 40, y: 40, r: 640, color: theme.accent, alpha: theme.glow })
  ops.push({ kind: 'glow', x: 40, y: CARD_SIZE.height - 60, r: 560, color: tint, alpha: tintAlpha })
}

export function drawTicket(ops: CardOp[], theme: CardTheme, cardY: number, cardH: number, notchY: number): void {
  ops.push({
    kind: 'ticket',
    x: CARD_X,
    y: cardY,
    w: CARD_W,
    h: cardH,
    radius: RADIUS,
    notchY,
    notchR: NOTCH_R,
    fill: theme.surface,
    stroke: theme.line,
    shadow: theme.shadow,
  })
}

/** The two lines beside the header tile; one line sits centred on the tile. */
export function drawHeadText(
  ops: CardOp[],
  tileTop: number,
  label: { text: string; color: string },
  sub: { text: string; color: string } | null,
  measure: Measure,
): void {
  const x = X0 + TILE + 28
  const w = CW - TILE - 28
  const labelY = sub ? tileTop + 38 : tileTop + TILE / 2 + 11
  ops.push(textOp({ text: fitText(label.text, w, STYLE.headLabel, measure), x, y: labelY, style: STYLE.headLabel, color: label.color, align: 'left', maxWidth: w }))
  if (sub) {
    ops.push(textOp({ text: fitText(sub.text, w, STYLE.headSub, measure), x, y: tileTop + 76, style: STYLE.headSub, color: sub.color, align: 'left', maxWidth: w }))
  }
}

/** Title lines, the subtitle, the big total with its accent underline, and the dashed tear. */
export function drawHero(
  ops: CardOp[],
  theme: CardTheme,
  cardY: number,
  hero: HeroGeometry,
  content: { titleLines: readonly string[]; subtitle: string; amount: string; amountStyle: TextStyle },
  measure: Measure,
): void {
  const top = (rel: number) => cardY + rel
  content.titleLines.forEach((line, i) => {
    ops.push(textOp({ text: line, x: X0, y: top(hero.titleTop) + 50 + i * TITLE_LINE, style: STYLE.title, color: theme.ink, align: 'left', maxWidth: CW }))
  })
  if (content.subtitle) {
    ops.push(textOp({ text: fitText(content.subtitle, CW, STYLE.subtitle, measure), x: X0, y: top(hero.subtitleY), style: STYLE.subtitle, color: theme.ink2, align: 'left', maxWidth: CW }))
  }
  const amount = fitText(content.amount, CW, content.amountStyle, measure)
  ops.push(textOp({ text: amount, x: X0, y: top(hero.amountY), style: content.amountStyle, color: theme.ink, align: 'left', maxWidth: CW }))
  const underlineW = Math.min(CW, Math.max(96, measure(amount, content.amountStyle) * 0.42))
  ops.push({ kind: 'rect', x: X0, y: top(hero.underlineY), w: underlineW, h: 12, radius: 6, fill: theme.accent })
  ops.push({
    kind: 'line',
    x1: CARD_X + NOTCH_R + 20,
    y1: top(hero.dividerY),
    x2: CARD_X + CARD_W - NOTCH_R - 20,
    y2: top(hero.dividerY),
    color: theme.lineStrong,
    width: 3,
    dash: [12, 12],
  })
}

/** A pastel circle with the person's initials. */
export function drawAvatar(ops: CardOp[], x: number, y: number, diameter: number, name: string, color: number): void {
  const avatar = avatarColor(color)
  ops.push({ kind: 'circle', x, y, r: diameter / 2, fill: avatar.bg })
  const style: TextStyle = { size: Math.round(diameter * 0.38), weight: 600 }
  ops.push(textOp({ text: initials(name), x, y: y + 1, style, color: avatar.ink, align: 'center', baseline: 'middle', maxWidth: diameter }))
}

/** The "+N" circle that stands in for people who didn't fit. */
export function drawMoreAvatar(ops: CardOp[], theme: CardTheme, x: number, y: number, diameter: number, count: number): void {
  ops.push({ kind: 'circle', x, y, r: diameter / 2, fill: theme.surface2 })
  const style: TextStyle = { size: Math.round(diameter * 0.36), weight: 600 }
  ops.push(textOp({ text: `+${count}`, x, y, style, color: theme.ink2, align: 'center', baseline: 'middle', maxWidth: diameter }))
}

/** "✓ Made with Settle · settle.app", centred under the card. */
export function drawFooter(ops: CardOp[], theme: CardTheme, siteLabel: string, measure: Measure): void {
  const brand = `Made with ${BRAND.name}`
  const mark = 40
  const gap = 14
  const brandW = measure(brand, STYLE.footerBrand)
  const sep = ' · '
  const maxSiteW = CARD_SIZE.width - 2 * MARGIN - mark - gap - brandW - measure(sep, STYLE.footerSite)
  const site = fitText(cleanText(siteLabel, 80), maxSiteW, STYLE.footerSite, measure)
  const siteText = site ? `${sep}${site}` : ''
  const siteW = siteText ? measure(siteText, STYLE.footerSite) : 0
  const total = mark + gap + brandW + siteW
  const left = (CARD_SIZE.width - total) / 2
  const baseline = CARD_SIZE.height - MARGIN - 18
  ops.push({ kind: 'rect', x: left, y: baseline - 30, w: mark, h: mark, radius: 12, fill: theme.accent })
  ops.push({ kind: 'icon', paths: CHECK_ICON_PATHS, x: left + 8, y: baseline - 22, size: 24, color: theme.onAccent, lineWidth: 3 })
  ops.push(textOp({ text: brand, x: left + mark + gap, y: baseline, style: STYLE.footerBrand, color: theme.ink, align: 'left', maxWidth: brandW }))
  if (siteText) {
    ops.push(textOp({ text: siteText, x: left + mark + gap + brandW, y: baseline, style: STYLE.footerSite, color: theme.ink2, align: 'left', maxWidth: siteW }))
  }
}

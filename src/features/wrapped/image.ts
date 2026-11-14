/**
 * A story slide as a picture for the group chat: the same 1080×1350 canvas path as the app's share
 * cards (`renderScene`: fonts, layout, paint, PNG), with the slide's own colours and big type.
 */
import { BRAND } from '../../domain/types'
import { t } from '../../i18n'
import { CARD_SIZE, type CardOp, type CardScene } from '../../share/card/layout'
import type { CardLayoutOptions } from '../../share/card/parts'
import { renderScene, type ShareCardOptions } from '../../share/card/render'
import { fitFontSize, fitText, wrapText, type Measure, type TextStyle } from '../../share/card/textFit'
import type { SlideWords } from './copy'

export interface SlidePicture {
  words: SlideWords
  colors: { bg: string; ink: string; glow: string }
  /** "🏖️ Goa" at the top of every picture. */
  groupLabel: string
  /** "3 / 9". */
  position: string
}

const PAD = 96

/** The picture's drawing operations (pure, so it is tested without a canvas). */
export function layoutSlidePicture(input: SlidePicture, opts: Pick<CardLayoutOptions, 'watermark' | 'siteLabel'>, measure: Measure): CardScene {
  const { width, height } = CARD_SIZE
  const maxWidth = width - PAD * 2
  const { ink, bg, glow } = input.colors
  const ops: CardOp[] = [
    { kind: 'background', color: bg },
    { kind: 'glow', x: width * 0.85, y: height * 0.12, r: 760, color: glow, alpha: 0.55 },
    { kind: 'glow', x: width * 0.05, y: height * 0.95, r: 620, color: glow, alpha: 0.3 },
  ]
  const text = (value: string, y: number, style: TextStyle): void => {
    ops.push({ kind: 'text', text: value, x: PAD, y, style, color: ink, align: 'left', baseline: 'alphabetic', maxWidth })
  }

  const top: TextStyle = { size: 40, weight: 600 }
  text(fitText(input.groupLabel, maxWidth - 160, top, measure), PAD + 40, top)
  ops.push({ kind: 'text', text: input.position, x: width - PAD, y: PAD + 40, style: { size: 36, weight: 500 }, color: ink, align: 'right', baseline: 'alphabetic', maxWidth: 160 })

  // The eyebrow, the big line (as large as fits, up to two lines), then the line under it.
  const eyebrow: TextStyle = { size: 46, weight: 500 }
  const size = fitFontSize(input.words.big, maxWidth, { max: 168, min: 88, step: 4 }, (s) => ({ size: s, weight: 700, tracking: -s * 0.03 }), measure)
  const big: TextStyle = { size, weight: 700, tracking: -size * 0.03 }
  const bigLines = wrapText(input.words.big, maxWidth, 2, big, measure)
  const line: TextStyle = { size: 48, weight: 500 }
  const lineLines = wrapText(input.words.line, maxWidth, 4, line, measure)
  const eyebrowLines = wrapText(input.words.eyebrow, maxWidth, 2, eyebrow, measure)

  const blockHeight = eyebrowLines.length * 60 + 36 + bigLines.length * size * 1.02 + 40 + lineLines.length * 64
  let y = Math.max(PAD + 200, (height - blockHeight) / 2)
  for (const l of eyebrowLines) {
    y += 60
    text(l, y, eyebrow)
  }
  y += 36
  for (const l of bigLines) {
    y += size * 1.02
    text(l, y, big)
  }
  y += 40
  for (const l of lineLines) {
    y += 64
    text(l, y, line)
  }

  if (opts.watermark) text(fitText(`${t('share.card.madeWith', { brand: BRAND.name })} · ${opts.siteLabel}`, maxWidth, { size: 34, weight: 500 }, measure), height - PAD, { size: 34, weight: 500 })

  return { width, height, ops, card: { x: 0, y: 0, w: width, h: height }, rows: { density: 'spacious', shown: 0, hidden: 0 } }
}

/** Every character the picture draws, once each (so the font loads every subset it needs). */
function pictureCharacters(input: SlidePicture): string {
  const text = [input.groupLabel, input.position, input.words.eyebrow, input.words.big, input.words.line, t('share.card.madeWith', { brand: BRAND.name }), BRAND.tagline, '0123456789 ·…'].join(' ')
  return [...new Set(Array.from(text))].join('')
}

/** The slide as a PNG. Rejects (with `ShareCardError`) when the browser can't draw it. */
export function renderSlidePicture(input: SlidePicture, opts: ShareCardOptions): Promise<Blob> {
  return renderScene(pictureCharacters(input), opts, (layoutOpts, measure) => layoutSlidePicture(input, layoutOpts, measure))
}

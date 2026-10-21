/** Scene checks shared by the card layout tests (imported by tests only). */
import { expect } from 'vitest'
import { CARD_SIZE, type CardLayoutOptions, type CardScene, type TextOp } from './parts'
import { fakeMeasure } from './testMeasure'

export const texts = (scene: CardScene): TextOp[] => scene.ops.filter((op): op is TextOp => op.kind === 'text')
export const textValues = (scene: CardScene): string[] => texts(scene).map((op) => op.text)

/** Invariants every card must satisfy, whatever the input. */
export function expectWellFormed(scene: CardScene, opts: Partial<CardLayoutOptions> & Pick<CardLayoutOptions, 'watermark'>): void {
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

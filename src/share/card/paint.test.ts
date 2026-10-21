import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHECK_ICON_PATHS } from './icons'
import { CARD_SIZE, layoutShareCard, type CardOp, type CardScene } from './layout'
import { canvasMeasure, paintScene } from './paint'
import { recordingContext } from './testCanvas'
import { fontOf } from './textFit'

const paths: string[] = []

beforeEach(() => {
  paths.length = 0
  vi.stubGlobal(
    'Path2D',
    class {
      constructor(d: string) {
        paths.push(d)
      }
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function scene(ops: CardOp[]): CardScene {
  return { width: 100, height: 80, ops, card: { x: 0, y: 0, w: 100, h: 80 }, rows: { density: 'regular', shown: 0, hidden: 0 } }
}

describe('paintScene', () => {
  it('fills the background and paints glows as fading radial gradients', () => {
    const rec = recordingContext()
    paintScene(rec.ctx, scene([{ kind: 'background', color: '#f5f6f8' }, { kind: 'glow', x: 90, y: 10, r: 50, color: '#cbf266', alpha: 0.5 }]))
    const fills = rec.named('fillRect')
    expect(fills[0]?.args).toEqual([0, 0, 100, 80])
    expect(fills[0]?.state.fillStyle).toBe('#f5f6f8')
    expect(rec.gradients[0]).toEqual({ args: [90, 10, 0, 90, 10, 50], stops: [[0, 'rgba(203, 242, 102, 0.5)'], [1, 'rgba(203, 242, 102, 0)']] })
  })

  it('draws the ticket with inward notches, a shadow on the fill only, then a hairline', () => {
    const rec = recordingContext()
    paintScene(
      rec.ctx,
      scene([
        {
          kind: 'ticket',
          x: 10,
          y: 10,
          w: 80,
          h: 60,
          radius: 12,
          notchY: 40,
          notchR: 6,
          fill: '#ffffff',
          stroke: '#e3e6ea',
          shadow: { color: 'rgba(0,0,0,0.1)', blur: 20, offsetY: 8 },
        },
      ]),
    )
    const arcs = rec.named('arc')
    expect(arcs.map((c) => c.args)).toEqual([
      [90, 40, 6, -Math.PI / 2, Math.PI / 2, true],
      [10, 40, 6, Math.PI / 2, -Math.PI / 2, true],
      [90, 40, 6, -Math.PI / 2, Math.PI / 2, true],
      [10, 40, 6, Math.PI / 2, -Math.PI / 2, true],
    ])
    const fill = rec.named('fill')[0]
    expect(fill?.state).toMatchObject({ fillStyle: '#ffffff', shadowBlur: 20, shadowOffsetY: 8, shadowColor: 'rgba(0,0,0,0.1)' })
    const stroke = rec.named('stroke')[0]
    expect(stroke?.state).toMatchObject({ strokeStyle: '#e3e6ea', lineWidth: 2, shadowBlur: 0 })
  })

  it('skips the shadow when the theme has none', () => {
    const rec = recordingContext()
    paintScene(rec.ctx, scene([{ kind: 'ticket', x: 0, y: 0, w: 50, h: 50, radius: 8, notchY: 25, notchR: 4, fill: '#16181b', stroke: '#262a2f', shadow: null }]))
    expect(rec.named('fill')[0]?.state.shadowBlur).toBe(0)
  })

  it('clamps rounded-rect radii and insets an edge stroke', () => {
    const rec = recordingContext()
    paintScene(rec.ctx, scene([{ kind: 'rect', x: 0, y: 0, w: 20, h: 10, radius: 50, fill: '#cbf266', stroke: '#3d6b0a' }]))
    // Radius clamps to half the height.
    expect(rec.named('arcTo')[0]?.args).toEqual([20, 0, 20, 5, 5])
    expect(rec.named('fill')[0]?.state.fillStyle).toBe('#cbf266')
    expect(rec.named('moveTo')[1]?.args).toEqual([5, 1])
    expect(rec.named('stroke')[0]?.state).toMatchObject({ strokeStyle: '#3d6b0a', lineWidth: 2 })
  })

  it('fills and strokes circles as asked', () => {
    const rec = recordingContext()
    paintScene(
      rec.ctx,
      scene([
        { kind: 'circle', x: 10, y: 10, r: 5, fill: '#ffd8c2' },
        { kind: 'circle', x: 10, y: 10, r: 8, fill: null, stroke: '#cbf266', lineWidth: 4 },
      ]),
    )
    expect(rec.named('arc').map((c) => c.args)).toEqual([
      [10, 10, 5, 0, Math.PI * 2],
      [10, 10, 8, 0, Math.PI * 2],
    ])
    expect(rec.named('fill')).toHaveLength(1)
    expect(rec.named('stroke')[0]?.state).toMatchObject({ strokeStyle: '#cbf266', lineWidth: 4 })
  })

  it('dashes lines and resets the dash afterwards', () => {
    const rec = recordingContext()
    paintScene(
      rec.ctx,
      scene([
        { kind: 'line', x1: 0, y1: 5, x2: 100, y2: 5, color: '#d3d7dd', width: 3, dash: [12, 12] },
        { kind: 'line', x1: 0, y1: 9, x2: 100, y2: 9, color: '#e3e6ea', width: 2 },
      ]),
    )
    expect(rec.named('setLineDash').map((c) => c.args[0])).toEqual([[12, 12], []])
    expect(rec.named('stroke').map((c) => c.state.strokeStyle)).toEqual(['#d3d7dd', '#e3e6ea'])
    expect(rec.named('save')).toHaveLength(2)
    expect(rec.named('restore')).toHaveLength(2)
  })

  it('sets font, alignment, baseline, colour and letter spacing for text', () => {
    const rec = recordingContext()
    const style = { size: 56, weight: 600, tracking: -1 } as const
    paintScene(rec.ctx, scene([{ kind: 'text', text: 'Dinner', x: 5, y: 50, style, color: '#0e1013', align: 'right', baseline: 'middle', maxWidth: 90 }]))
    const call = rec.named('fillText')[0]
    expect(call?.args).toEqual(['Dinner', 5, 50])
    expect(call?.state).toMatchObject({ font: fontOf(style), textAlign: 'right', textBaseline: 'middle', fillStyle: '#0e1013', letterSpacing: '-1px' })
    // Reset so later drawing on the same context isn't squeezed.
    expect(rec.ctx.letterSpacing).toBe('0px')
  })

  it('still draws text where letterSpacing is not supported', () => {
    const rec = recordingContext({ withLetterSpacing: false })
    paintScene(rec.ctx, scene([{ kind: 'text', text: 'Hi', x: 0, y: 10, style: { size: 20, weight: 400, tracking: -1 }, color: '#000000', align: 'left', baseline: 'alphabetic', maxWidth: 50 }]))
    expect(rec.named('fillText')).toHaveLength(1)
    expect('letterSpacing' in rec.ctx).toBe(false)
  })

  it('strokes icons from their 24-unit paths, scaled to size', () => {
    const rec = recordingContext()
    paintScene(rec.ctx, scene([{ kind: 'icon', paths: CHECK_ICON_PATHS, x: 10, y: 20, size: 48, color: '#0b7a43', lineWidth: 2 }]))
    expect(rec.named('translate')[0]?.args).toEqual([10, 20])
    expect(rec.named('scale')[0]?.args).toEqual([2, 2])
    expect(paths).toEqual([...CHECK_ICON_PATHS])
    expect(rec.named('stroke')[0]?.state).toMatchObject({ strokeStyle: '#0b7a43', lineWidth: 2, lineCap: 'round', lineJoin: 'round' })
  })

  it('skips icons without Path2D instead of failing', () => {
    vi.stubGlobal('Path2D', undefined)
    const rec = recordingContext()
    expect(() => paintScene(rec.ctx, scene([{ kind: 'icon', paths: CHECK_ICON_PATHS, x: 0, y: 0, size: 24, color: '#000000', lineWidth: 2 }]))).not.toThrow()
    expect(rec.named('stroke')).toHaveLength(0)
  })

  it('paints a whole laid-out card, every text in order', () => {
    const rec = recordingContext()
    const card = layoutShareCard(
      {
        title: 'Dinner at Toit',
        category: 'food',
        currency: 'INR',
        date: '2026-10-18',
        total: 276_650,
        payerName: 'Ayush',
        people: [
          { name: 'Ayush', color: 2, amount: 138_325, paid: true, isPayer: true },
          { name: 'Riya', color: 5, amount: 138_325, paid: true, isPayer: false },
        ],
      },
      { watermark: true, theme: 'light', siteLabel: 'settle.example' },
      canvasMeasure(rec.ctx),
    )
    expect(card.width).toBe(CARD_SIZE.width)
    paintScene(rec.ctx, card)
    const drawn = rec.named('fillText').map((c) => c.args[0])
    expect(drawn).toEqual(card.ops.filter((op) => op.kind === 'text').map((op) => (op.kind === 'text' ? op.text : '')))
    expect(drawn).toContain('All settled up')
  })
})

describe('canvasMeasure', () => {
  it('measures with the style applied and caches repeat lookups', () => {
    const seen: Array<{ font: string; letterSpacing: string; text: string }> = []
    const ctx = {
      font: '',
      letterSpacing: '0px',
      measureText(text: string) {
        seen.push({ font: this.font, letterSpacing: this.letterSpacing, text })
        return { width: text.length * 10 }
      },
    }
    const measure = canvasMeasure(ctx as unknown as CanvasRenderingContext2D)
    const style = { size: 20, weight: 600, tracking: 2 } as const
    expect(measure('abc', style)).toBe(30)
    expect(measure('abc', style)).toBe(30)
    expect(seen).toEqual([{ font: fontOf(style), letterSpacing: '2px', text: 'abc' }])
    expect(measure('abc', { size: 40, weight: 600 })).toBe(30)
    expect(seen).toHaveLength(2)
    expect(seen[1]?.letterSpacing).toBe('0px')
  })
})

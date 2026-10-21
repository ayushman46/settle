/** Draws a laid-out share card onto a 2D canvas context (DOM or offscreen). */
import { ICON_GRID } from './icons'
import type { CardOp, CardScene } from './layout'
import { withAlpha } from './theme'
import { fontOf, type Measure, type TextStyle } from './textFit'

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

/** `letterSpacing` is newer than the rest of the canvas API (Chrome 99, Safari 18). */
function setTracking(ctx: Ctx2D, style: TextStyle): void {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${style.tracking ?? 0}px`
}

/** Text widths from the canvas itself, cached (layout measures the same strings repeatedly). */
export function canvasMeasure(ctx: Ctx2D): Measure {
  const cache = new Map<string, number>()
  return (text, style) => {
    const key = `${style.weight}|${style.size}|${style.tracking ?? 0}|${text}`
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    ctx.font = fontOf(style)
    setTracking(ctx, style)
    const width = ctx.measureText(text).width
    cache.set(key, width)
    return width
  }
}

function roundRectPath(ctx: Ctx2D, x: number, y: number, w: number, h: number, radius: number): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

/** A rounded card with a semicircle bitten out of each side at `notchY` — a torn ticket. */
function ticketPath(ctx: Ctx2D, op: Extract<CardOp, { kind: 'ticket' }>): void {
  const { x, y, w, h, notchY, notchR } = op
  const r = Math.max(0, Math.min(op.radius, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, notchY - notchR)
  ctx.arc(x + w, notchY, notchR, -Math.PI / 2, Math.PI / 2, true)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, notchY + notchR)
  ctx.arc(x, notchY, notchR, Math.PI / 2, -Math.PI / 2, true)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function paintOp(ctx: Ctx2D, op: CardOp, scene: CardScene): void {
  switch (op.kind) {
    case 'background':
      ctx.fillStyle = op.color
      ctx.fillRect(0, 0, scene.width, scene.height)
      return
    case 'glow': {
      const gradient = ctx.createRadialGradient(op.x, op.y, 0, op.x, op.y, op.r)
      gradient.addColorStop(0, withAlpha(op.color, op.alpha))
      gradient.addColorStop(1, withAlpha(op.color, 0))
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, scene.width, scene.height)
      return
    }
    case 'ticket':
      ctx.save()
      ticketPath(ctx, op)
      if (op.shadow) {
        ctx.shadowColor = op.shadow.color
        ctx.shadowBlur = op.shadow.blur
        ctx.shadowOffsetY = op.shadow.offsetY
      }
      ctx.fillStyle = op.fill
      ctx.fill()
      ctx.restore()
      ticketPath(ctx, op)
      ctx.strokeStyle = op.stroke
      ctx.lineWidth = 2
      ctx.stroke()
      return
    case 'rect':
      roundRectPath(ctx, op.x, op.y, op.w, op.h, op.radius)
      ctx.fillStyle = op.fill
      ctx.fill()
      if (op.stroke) {
        // Inset by half the line so the edge stays inside the shape.
        roundRectPath(ctx, op.x + 1, op.y + 1, op.w - 2, op.h - 2, Math.max(0, op.radius - 1))
        ctx.strokeStyle = op.stroke
        ctx.lineWidth = 2
        ctx.stroke()
      }
      return
    case 'circle':
      ctx.beginPath()
      ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2)
      if (op.fill) {
        ctx.fillStyle = op.fill
        ctx.fill()
      }
      if (op.stroke) {
        ctx.strokeStyle = op.stroke
        ctx.lineWidth = op.lineWidth ?? 2
        ctx.stroke()
      }
      return
    case 'line':
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(op.x1, op.y1)
      ctx.lineTo(op.x2, op.y2)
      ctx.setLineDash(op.dash ?? [])
      ctx.lineCap = 'round'
      ctx.strokeStyle = op.color
      ctx.lineWidth = op.width
      ctx.stroke()
      ctx.restore()
      return
    case 'text':
      ctx.font = fontOf(op.style)
      setTracking(ctx, op.style)
      ctx.textAlign = op.align
      ctx.textBaseline = op.baseline
      ctx.fillStyle = op.color
      ctx.fillText(op.text, op.x, op.y)
      return
    case 'icon': {
      if (typeof Path2D !== 'function') return
      ctx.save()
      ctx.translate(op.x, op.y)
      ctx.scale(op.size / ICON_GRID, op.size / ICON_GRID)
      ctx.strokeStyle = op.color
      ctx.lineWidth = op.lineWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (const d of op.paths) ctx.stroke(new Path2D(d))
      ctx.restore()
      return
    }
  }
}

/** Paints every operation in order. */
export function paintScene(ctx: Ctx2D, scene: CardScene): void {
  for (const op of scene.ops) paintOp(ctx, op, scene)
  setTracking(ctx, { size: 0, weight: 400 })
}

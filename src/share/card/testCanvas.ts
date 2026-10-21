/** A recording 2D context for tests (jsdom has no canvas). */
import { fakeMeasure } from './testMeasure'

export interface Call {
  name: string
  args: unknown[]
  /** Context state when the call was made. */
  state: Record<string, unknown>
}

export interface RecordingContext {
  ctx: CanvasRenderingContext2D
  calls: Call[]
  gradients: Array<{ args: unknown[]; stops: Array<[number, string]> }>
  named(name: string): Call[]
}

/**
 * `withLetterSpacing: false` simulates browsers without `ctx.letterSpacing`; `throwOn` makes one
 * drawing method throw.
 */
export function recordingContext(opts: { withLetterSpacing?: boolean; throwOn?: string } = {}): RecordingContext {
  const calls: Call[] = []
  const gradients: RecordingContext['gradients'] = []
  const state: Record<string, unknown> = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetY: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
  }
  if (opts.withLetterSpacing !== false) state.letterSpacing = '0px'
  const stack: Array<Record<string, unknown>> = []
  const record = (name: string) => (...args: unknown[]) => {
    if (name === opts.throwOn) throw new Error(`${name} failed`)
    calls.push({ name, args, state: { ...state } })
  }

  const target: Record<string, unknown> = {
    save: () => {
      calls.push({ name: 'save', args: [], state: { ...state } })
      stack.push({ ...state })
    },
    restore: () => {
      calls.push({ name: 'restore', args: [], state: { ...state } })
      Object.assign(state, stack.pop() ?? {})
    },
    measureText: (text: string) => {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(String(state.font))?.[1] ?? 10)
      const tracking = Number(/(-?\d+(?:\.\d+)?)px/.exec(String(state.letterSpacing ?? '0px'))?.[1] ?? 0)
      return { width: fakeMeasure(text, { size, weight: 400, tracking }) }
    },
    createRadialGradient: (...args: unknown[]) => {
      const gradient = { args, stops: [] as Array<[number, string]> }
      gradients.push(gradient)
      calls.push({ name: 'createRadialGradient', args, state: { ...state } })
      return { addColorStop: (offset: number, color: string) => gradient.stops.push([offset, color]) }
    },
  }
  for (const name of [
    'fillRect',
    'beginPath',
    'closePath',
    'moveTo',
    'lineTo',
    'arc',
    'arcTo',
    'fill',
    'stroke',
    'fillText',
    'setLineDash',
    'translate',
    'scale',
  ]) {
    target[name] = record(name)
  }

  const ctx = new Proxy(target, {
    get: (t, key: string) => (key in t ? t[key] : state[key]),
    set: (_t, key: string, value: unknown) => {
      state[key] = value
      return true
    },
    has: (t, key: string) => key in t || key in state,
  }) as unknown as CanvasRenderingContext2D

  return { ctx, calls, gradients, named: (name) => calls.filter((c) => c.name === name) }
}


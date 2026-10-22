/** Test support (never imported by the app): turn motion on and drive animation frames by hand. */
import { vi } from 'vitest'

export interface FrameQueue {
  /** Advances the clock by `elapsedMs` and runs every frame requested so far. */
  flush(elapsedMs: number): void
}

/**
 * Makes `motionAllowed()` true (a `matchMedia` that prefers motion) and replaces
 * `requestAnimationFrame` with a queue the test flushes. Undo with `vi.unstubAllGlobals()`.
 */
export function allowMotion(): FrameQueue {
  let now = 0
  let nextId = 0
  let pending = new Map<number, FrameRequestCallback>()
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    nextId += 1
    pending.set(nextId, callback)
    return nextId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    pending.delete(id)
  })
  return {
    flush(elapsedMs) {
      now += elapsedMs
      const due = [...pending.values()]
      pending = new Map()
      for (const callback of due) callback(now)
    },
  }
}
